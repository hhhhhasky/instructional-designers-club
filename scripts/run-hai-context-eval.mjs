import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const GOLDEN_PATH = join(ROOT, "supabase/functions/_shared/hai_orchestrator/evals/golden_questions.json");
const OUTPUT_DIR = join(ROOT, "docs/hai-quality-runs");

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const accessToken = process.env.HAI_EVAL_ACCESS_TOKEN;
const moduleSlug = process.env.HAI_EVAL_MODULE_SLUG || "ask-han";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("Missing VITE_SUPABASE_URL or SUPABASE_URL.");
if (!accessToken) throw new Error("Missing HAI_EVAL_ACCESS_TOKEN.");

const functionsUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/hai-chat`;
const goldenQuestions = JSON.parse(await readFile(GOLDEN_PATH, "utf8"));
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
const outPath = join(OUTPUT_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}-context-orchestrator-eval.json`);
await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Saved ${outPath}`);
console.log(summary);

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
  return rows?.[0]?.metadata?.hai_context_trace ?? null;
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
  const intentPass = completed.filter((item) => item.intent_result?.primary_intent === item.expected_intent).length;
  return {
    total: items.length,
    completed: completed.length,
    failed: items.length - completed.length,
    rule_pass_rate: completed.length ? Number((rulePass / completed.length).toFixed(3)) : 0,
    intent_pass_rate: completed.length ? Number((intentPass / completed.length).toFixed(3)) : null,
    average_evaluator_score: evaluatorScores.length
      ? Number((evaluatorScores.reduce((sum, item) => sum + item, 0) / evaluatorScores.length).toFixed(2))
      : null,
  };
}
