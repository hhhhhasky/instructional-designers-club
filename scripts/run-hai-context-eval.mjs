import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readHaiTrace } from "./lib/hai-trace.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const GOLDEN_PATH = join(ROOT, "supabase/functions/_shared/hai_orchestrator/evals/golden_questions.json");
const OUTPUT_DIR = join(ROOT, "docs/hai-quality-runs");

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const configuredAccessToken = process.env.HAI_EVAL_ACCESS_TOKEN;
const moduleSlug = process.env.HAI_EVAL_MODULE_SLUG || "ask-han";
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
const caseLimit = Math.max(0, Number.parseInt(process.env.HAI_EVAL_CASE_LIMIT || "0", 10) || 0);

if (!supabaseUrl) throw new Error("Missing VITE_SUPABASE_URL or SUPABASE_URL.");
const accessToken = await resolveAccessToken();

const functionsUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/hai-chat`;
const allGoldenQuestions = JSON.parse(await readFile(GOLDEN_PATH, "utf8"));
const goldenQuestions = caseLimit > 0 ? allGoldenQuestions.slice(0, caseLimit) : allGoldenQuestions;
const startedAt = new Date();

const results = [];
for (const testCase of goldenQuestions) {
  console.log(`Running ${testCase.id}: ${testCase.question}`);
  const response = await fetch(functionsUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      conversationId: null,
      moduleSlug,
      message: testCase.question,
      mode: "chat",
      clientRequestId: crypto.randomUUID(),
      capturePromptSnapshot: true,
    }),
  });

  if (!response.ok || !response.body) {
    const payload = await response.text();
    results.push({ ...testCase, error: payload || response.statusText });
    continue;
  }

  const events = await readSseEvents(response.body);
  const finalAnswer = events
    .filter((event) => event.type === "token")
    .map((event) => event.token)
    .join("");
  const done = events.find((event) => event.type === "done");
  const trace = serviceRoleKey && done?.messageId ? await loadTrace(done.messageId) : null;
  const ruleEval = evaluateRules(testCase, finalAnswer);

  results.push({
    ...testCase,
    conversation_id: done?.conversationId ?? null,
    message_id: done?.messageId ?? null,
    usage: done?.usage ?? null,
    prompt_snapshot: done?.promptSnapshot ?? null,
    intent_result: trace?.intent_result ?? null,
    retrieval_plan: trace?.retrieval_plan ?? null,
    retrieved_context_ids: trace?.retrieved_context_ids ?? [],
    evaluator_score: trace?.evaluation_result?.score ?? null,
    evaluator_pass: trace?.evaluation_result?.pass ?? null,
    rule_eval: ruleEval,
    final_answer: finalAnswer,
  });
}

const summary = summarize(results);
const output = {
  suite: "hai-context-orchestrator-golden",
  started_at: startedAt.toISOString(),
  finished_at: new Date().toISOString(),
  summary,
  results,
};

await mkdir(OUTPUT_DIR, { recursive: true });
const fileStamp = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = join(OUTPUT_DIR, `${fileStamp}-context-orchestrator-eval.json`);
const markdownPath = join(OUTPUT_DIR, `${fileStamp}-context-orchestrator-eval.md`);
await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`);
await writeFile(markdownPath, renderMarkdown(output));
console.log(`Saved ${outPath}`);
console.log(`Saved ${markdownPath}`);
console.log(summary);

async function resolveAccessToken() {
  if (configuredAccessToken) return configuredAccessToken;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const phone = process.env.HAI_TEST_PHONE;
  const password = process.env.HAI_TEST_PASSWORD;
  if (!anonKey || !phone || !password) {
    throw new Error(
      "Missing HAI_EVAL_ACCESS_TOKEN or VITE_SUPABASE_ANON_KEY + HAI_TEST_PHONE + HAI_TEST_PASSWORD.",
    );
  }
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email: `${phone}@phone.local`, password }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(String(payload.msg || payload.message || "HAI test account login failed."));
  }
  return String(payload.access_token);
}

async function readSseEvents(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((item) => item.startsWith("data: "));
      if (!line) continue;
      events.push(JSON.parse(line.slice(6)));
    }
  }
  return events;
}

async function loadTrace(messageId) {
  const url = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/hai_messages?id=eq.${messageId}&select=metadata`;
  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!response.ok) return null;
  const rows = await response.json();
  return readHaiTrace(rows?.[0]?.metadata);
}

function evaluateRules(testCase, answer) {
  const normalized = answer.replace(/\s+/g, "");
  const included = testCase.must_include.filter((item) => normalized.includes(String(item).replace(/\s+/g, "")));
  const avoided = testCase.must_avoid.filter((item) => !normalized.includes(String(item).replace(/\s+/g, "")));
  return {
    include_hits: included,
    avoid_passes: avoided,
    include_rate: testCase.must_include.length ? included.length / testCase.must_include.length : 1,
    avoid_rate: testCase.must_avoid.length ? avoided.length / testCase.must_avoid.length : 1,
    pass: included.length === testCase.must_include.length && avoided.length === testCase.must_avoid.length,
  };
}

function summarize(items) {
  const completed = items.filter((item) => !item.error);
  const rulePass = completed.filter((item) => item.rule_eval?.pass).length;
  const evaluatorScores = completed
    .map((item) => item.evaluator_score)
    .filter((item) => typeof item === "number");
  const intentItems = completed.filter((item) => item.intent_result?.primary_intent);
  const intentPass = intentItems.filter((item) => item.intent_result.primary_intent === item.expected_intent).length;
  return {
    total: items.length,
    completed: completed.length,
    failed: items.length - completed.length,
    rule_pass_rate: completed.length ? Number((rulePass / completed.length).toFixed(3)) : 0,
    intent_pass_rate: intentItems.length ? Number((intentPass / intentItems.length).toFixed(3)) : null,
    average_evaluator_score: evaluatorScores.length
      ? Number((evaluatorScores.reduce((sum, item) => sum + item, 0) / evaluatorScores.length).toFixed(2))
      : null,
  };
}

function renderMarkdown(output) {
  const lines = [
    "# HAI 上下文编排测试快照",
    "",
    `- 开始时间：${output.started_at}`,
    `- 结束时间：${output.finished_at}`,
    `- 测试结果：${output.summary.completed}/${output.summary.total} 完成`,
    "",
    "> 本文档保存测试时实际发给模型的完整 messages。快照只能由管理员测试请求获取，不写入普通用户可读的消息 metadata。",
    "",
  ];

  for (const item of output.results) {
    lines.push(`## ${item.id}`, "", `用户问题：${item.question}`, "");
    if (item.error) {
      lines.push(`错误：${item.error}`, "");
      continue;
    }
    lines.push(
      `- conversation_id：${item.conversation_id ?? ""}`,
      `- message_id：${item.message_id ?? ""}`,
      `- 用量：${JSON.stringify(item.usage ?? {})}`,
      "",
    );
    const calls = item.prompt_snapshot?.model_calls ?? [];
    for (const [callIndex, call] of calls.entries()) {
      lines.push(
        `### 模型调用 ${callIndex + 1}：${call.stage}`,
        "",
        `估算输入 token：${call.estimated_input_tokens}`,
        "",
      );
      for (const [messageIndex, message] of call.messages.entries()) {
        lines.push(
          `#### message ${messageIndex + 1}：${message.role}`,
          "",
          "````text",
          message.content,
          "````",
          "",
        );
      }
    }
    lines.push("### AI 最终回答", "", "````text", item.final_answer, "````", "");
    lines.push("### 编排 trace", "", "````json", JSON.stringify({
      intent_result: item.intent_result,
      retrieval_plan: item.retrieval_plan,
      retrieved_context_ids: item.retrieved_context_ids,
      evaluator_score: item.evaluator_score,
      evaluator_pass: item.evaluator_pass,
      rule_eval: item.rule_eval,
    }, null, 2), "````", "");
  }
  return `${lines.join("\n")}\n`;
}
