import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { readHaiTrace } from "./lib/hai-trace.mjs";

const ROOT = process.cwd();
const OUTPUT_DIR = join(ROOT, "docs", "hai-quality-runs");
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const HISTORICAL_PATH = join(ROOT, "docs/hai-quality-runs/2026-07-04T10-00-17-859Z-r06-version-comparison.json");

loadEnv(".env");
loadEnv(".env.upload");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const EVAL_EMAIL = process.env.HAI_LIVE_EVAL_EMAIL || "hai-eval+club-site@hasky.top";
const EVAL_PASSWORD = process.env.HAI_LIVE_EVAL_PASSWORD || `HaiEval-${crypto.randomUUID()}-2026`;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SECRET_KEY) throw new Error("Missing Supabase env.");
if (!DEEPSEEK_API_KEY) throw new Error("Missing DEEPSEEK_API_KEY.");

const SCORE_WEIGHTS = {
  intent: 0.35,
  teaching_judgment: 0.40,
  actionability: 0.10,
  style: 0.05,
  boundary: 0.05,
  brevity: 0.05,
};

const TEST_CASES = [
  {
    id: "calibration-daily-fake-understanding",
    category: "日常课假懂",
    input: "我平时上数学课总觉得讲完了学生也会点头，但一做题还是错，怎么改？",
    expected: ["不只建议变式练习", "识别没找准学生错误点和过程性评价方式错误两个原因", "倒推到知识结构、学情判断和课堂证据"],
  },
  {
    id: "calibration-specific-text-prep",
    category: "备课没思路",
    input: "三年级语文《富饶的西沙群岛》我下周要上，感觉教材很散，不知道这节课从哪里切入。",
    expected: ["不在材料不足时凭空分析具体教材细节", "提醒用教材教而不是教教材", "追问或引导明确课标、单元目标和本课目标"],
  },
  {
    id: "calibration-open-lesson-form",
    category: "公开课",
    input: "我要上一节公开课，领导说要有亮点。我想加一个闯关活动，你觉得怎么样？",
    expected: ["指出公开课亮点不是形式包装", "识别用户真问题是出彩或差异化", "回到教材/目标理解深度和学情洞察独特性"],
  },
  {
    id: "calibration-speaking-mainline",
    category: "说课",
    input: "我写说课稿总是像把教案复述一遍，听起来没有设计感，怎么办？",
    expected: ["指出说课不是补要素而是说明为什么这么上", "强调用一句教学主线贯穿教材、课标、学情、目标、活动和评价", "再把语言打磨放在最后"],
  },
  {
    id: "calibration-objective-vague",
    category: "教学目标",
    input: "我这节课的目标写的是“让学生理解分数的意义，掌握分数的基本性质”，这样可以吗？",
    expected: ["指出目标空泛和不可评价", "用具体变化、达成程度、核心素养回应作为标准", "不只做局部改写"],
  },
  {
    id: "calibration-activity-many-not-lesson",
    category: "教案诊断",
    input: "我设计了一节课：先情境导入，再小组讨论，再展示交流，最后练习巩固。流程挺完整，但总觉得不够有力量。你帮我看问题在哪？",
    expected: ["识别活动多但不成课的真问题不是再加活动", "指出形式大于内容、环节重于目标", "倒推到课标、教材、学情和目标分析不足"],
  },
  {
    id: "calibration-task-context",
    category: "任务情境",
    input: "我想把一道练习题改成真实任务，比如让学生当“小小设计师”解决问题，这样是不是就算真实任务了？",
    expected: ["不把真实任务简化为身份标签", "判断情境与目标、知识点、学生经验的匹配", "说明虚拟情境也可以成立但要能代入和服务学习"],
  },
  {
    id: "calibration-direct-writing",
    category: "代写诱导",
    input: "你直接帮我写一份完整公开课教案吧，越详细越好，我明天就要用。",
    expected: ["明确拒绝完整代写", "说明 HAI 提供咨询建议和教学判断依据", "把老师拉回用 AI 帮助思考而不是替代完成任务"],
  },
  {
    id: "calibration-concept-boundary",
    category: "概念辨析",
    input: "教学任务、课堂活动、练习题到底有什么区别？我感觉都差不多。",
    expected: ["先回应或追问概念辨析背后的真实用途", "可以解释但不装成权威百科", "对专业概念提示事实性边界和核验建议"],
  },
];

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

await main();

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const historical = JSON.parse(readFileSync(HISTORICAL_PATH, "utf8"));
  const evalUser = await ensureEvalUser();
  const accessToken = await signInEvalUser();
  const module = await loadAskHanModule();
  const runtimeSettings = await loadRuntimeSettings();
  const results = [];

  for (const testCase of TEST_CASES) {
    console.log(`Calling live HAI: ${testCase.id}`);
    const live = await callHai(testCase.input, accessToken);
    console.log(`Evaluating live answer: ${testCase.id}`);
    const evaluation = await evaluateAnswer(testCase, live.answer);
    const historicalCase = historical.results.find((item) => item.id === testCase.id);
    results.push({
      ...testCase,
      live: {
        answer: live.answer,
        evaluation,
        conversation_id: live.conversationId,
        message_id: live.messageId,
        trace: live.trace,
      },
      historical: historicalCase
        ? {
          legacy_score: historicalCase.baseline.evaluation.total_score,
          r06_score: historicalCase.candidate.evaluation.total_score,
          legacy_evaluation: historicalCase.baseline.evaluation,
          r06_evaluation: historicalCase.candidate.evaluation,
        }
        : null,
    });
  }

  const summary = summarizeLive(results, historical.summary);
  const payload = {
    run_id: RUN_ID,
    created_at: new Date().toISOString(),
    suite: "hai-live-context-orchestrator-calibration",
    eval_user_id: evalUser.id,
    model: module.default_model || DEEPSEEK_MODEL,
    module: {
      slug: module.slug,
      name: module.name,
      default_temperature: module.default_temperature,
      default_max_output_tokens: module.default_max_output_tokens,
      default_top_p: module.default_top_p,
    },
    runtime_settings: runtimeSettings,
    historical_reference: {
      path: HISTORICAL_PATH.replace(`${ROOT}/`, ""),
      legacy_average: historical.summary.baseline_average,
      r06_average: historical.summary.candidate_average,
      r06_delta_vs_legacy: historical.summary.delta,
    },
    summary,
    results,
  };

  const jsonPath = join(OUTPUT_DIR, `${RUN_ID}-live-context-orchestrator-eval.json`);
  const mdPath = join(OUTPUT_DIR, `${RUN_ID}-live-context-orchestrator-eval.md`);
  await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(mdPath, renderMarkdown({ payload, jsonPath }));
  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${jsonPath}`);
  console.log(summary);
}

async function ensureEvalUser() {
  const existing = await findUserByEmail(EVAL_EMAIL);
  let user = existing;
  if (user) {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password: EVAL_PASSWORD,
      email_confirm: true,
      user_metadata: { purpose: "hai_live_quality_eval" },
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: EVAL_EMAIL,
      password: EVAL_PASSWORD,
      email_confirm: true,
      user_metadata: { purpose: "hai_live_quality_eval" },
    });
    if (error) throw error;
    user = data.user;
  }

  const { error: accessError } = await admin.from("hai_user_access").upsert({
    user_id: user.id,
    status: "active",
    access_source: "admin",
    quota_policy_key: "internal",
    granted_at: new Date().toISOString(),
    notes: "Automated HAI live quality evaluation user.",
  });
  if (accessError) throw accessError;
  return user;
}

async function findUserByEmail(email) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 1000) return null;
    page += 1;
  }
  return null;
}

async function signInEvalUser() {
  const { data, error } = await anon.auth.signInWithPassword({
    email: EVAL_EMAIL,
    password: EVAL_PASSWORD,
  });
  if (error) throw error;
  if (!data.session?.access_token) throw new Error("Eval user sign-in did not return an access token.");
  return data.session.access_token;
}

async function loadAskHanModule() {
  const { data, error } = await admin
    .from("hai_feature_modules")
    .select("id, slug, name, default_model, default_temperature, default_max_output_tokens, default_top_p")
    .eq("slug", "ask-han")
    .single();
  if (error) throw error;
  return data;
}

async function loadRuntimeSettings() {
  const keys = [
    "context.orchestrator_enabled",
    "orchestrator.case_max",
    "orchestrator.method_max",
    "orchestrator.theory_max",
    "orchestrator.expression_max",
    "evaluator.enabled",
    "evaluator.pass_score",
    "evaluator.max_rewrites",
  ];
  const { data, error } = await admin
    .from("hai_runtime_settings")
    .select("key, value, enabled")
    .in("key", keys)
    .order("key", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function callHai(message, accessToken) {
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/hai-chat`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      conversationId: null,
      moduleSlug: "ask-han",
      message,
      mode: "chat",
      clientRequestId: crypto.randomUUID(),
    }),
  });
  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "");
    throw new Error(`HAI request failed ${response.status}: ${body}`);
  }
  const events = await readSseEvents(response.body);
  const answer = events.filter((event) => event.type === "token").map((event) => event.token).join("");
  const done = events.find((event) => event.type === "done");
  const trace = done?.messageId ? await loadTrace(done.messageId) : null;
  return {
    answer,
    conversationId: done?.conversationId ?? null,
    messageId: done?.messageId ?? null,
    trace,
  };
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
  const { data, error } = await admin
    .from("hai_messages")
    .select("metadata")
    .eq("id", messageId)
    .maybeSingle();
  if (error) throw error;
  return readHaiTrace(data?.metadata);
}

async function evaluateAnswer(testCase, answer) {
  const evaluationPrompt = `你是 HAI 教研助手的质量评估员。请只输出 JSON，不要输出 Markdown。

评分维度均为 0-100 分。请按“哈老师人工咨询标尺”评分，不要按“是否没有明显错误”评分。

核心标尺：
- 高分不是给出正确建议，而是先判断用户表层问题和真实问题是否一致。
- 设计层问题要能往前倒推到目标、课标/教材、学情和评价证据。
- 用户给出的活动、方案、术语或困惑可能是错误框架，优秀回答不能被用户牵着走。
- 具体教材材料不足时，不应编造教材事实；应引导回目标和“用教材教”。
- 代写边界要硬：HAI 是帮助老师思考的咨询工具，不替老师完成教学设计。

评分锚点：
- 50-60：底线合格，没有明显犯错，但主要顺着表层问题回答。
- 70：能指出一个教学设计问题，有建议，但比较常规。
- 80：能看出真问题，能纠正用户错误假设，并把建议拉回目标、教材、学情、评价或学生证据。
- 90+：真问题识别准确，教学判断犀利，能指出用户自己没追问到的关键矛盾，建议有取舍且表达简洁。

维度说明：
- intent: 是否识别表层意图背后的真问题。
- teaching_judgment: 是否一眼抓住关键矛盾，并指出用户理解或假设的偏差。
- actionability: 建议是否服务于真问题，有取舍，不顺着错误方案展开。
- style: 是否直接、克制、有判断，不讨好。
- boundary: 是否拒绝代写和内部实现泄露，事实性概念是否有边界。
- brevity: 是否简洁有穿透力。

测试用例：
id: ${testCase.id}
category: ${testCase.category}
user_input: ${testCase.input}
expected_behavior: ${testCase.expected.join("；")}

待评估回复：
${answer}

输出 JSON schema:
{
  "scores": {
    "intent": 0,
    "teaching_judgment": 0,
    "style": 0,
    "actionability": 0,
    "boundary": 0,
    "brevity": 0
  },
  "total_score": 0,
  "failure_modes": ["string"],
  "comment": "string"
}`;

  const raw = await callDeepSeek([
    { role: "system", content: "你是严格的 JSON 评估器。只能输出合法 JSON。" },
    { role: "user", content: evaluationPrompt },
  ], { model: DEEPSEEK_MODEL, temperature: 0, max_tokens: 900 });
  return parseEvaluation(raw);
}

async function callDeepSeek(messages, options) {
  const response = await fetch(`${DEEPSEEK_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(compact({
      model: options.model || DEEPSEEK_MODEL,
      messages,
      temperature: options.temperature ?? 0,
      max_tokens: options.max_tokens ?? 900,
      stream: false,
      thinking: { type: "disabled" },
    })),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || data?.message || `DeepSeek request failed: ${response.status}`);
  return String(data?.choices?.[0]?.message?.content || "").trim();
}

function parseEvaluation(raw) {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    const scores = normalizeScores(parsed.scores || {});
    return {
      scores,
      total_score: Number(applyScoreCaps(weightedTotal(scores), scores).toFixed(2)),
      failure_modes: Array.isArray(parsed.failure_modes) ? parsed.failure_modes.map(String) : [],
      comment: String(parsed.comment || ""),
    };
  } catch {
    return {
      scores: normalizeScores({}),
      total_score: 0,
      failure_modes: ["evaluation_parse_failed"],
      comment: raw,
    };
  }
}

function summarizeLive(results, historicalSummary) {
  const dimensions = ["intent", "teaching_judgment", "style", "actionability", "boundary", "brevity"];
  const liveAverage = average(results.map((item) => item.live.evaluation.total_score));
  const summary = {
    case_count: results.length,
    historical_legacy_average: historicalSummary.baseline_average,
    historical_r06_average: historicalSummary.candidate_average,
    live_average: liveAverage,
    delta_vs_legacy: Number((liveAverage - historicalSummary.baseline_average).toFixed(2)),
    delta_vs_r06: Number((liveAverage - historicalSummary.candidate_average).toFixed(2)),
    by_dimension: {},
    by_category: {},
    wins_vs_r06: 0,
    ties_vs_r06: 0,
    losses_vs_r06: 0,
  };
  for (const dimension of dimensions) {
    const legacy = historicalSummary.by_dimension[dimension]?.baseline ?? 0;
    const r06 = historicalSummary.by_dimension[dimension]?.candidate ?? 0;
    const live = average(results.map((item) => item.live.evaluation.scores[dimension] ?? 0));
    summary.by_dimension[dimension] = {
      historical_legacy: legacy,
      historical_r06: r06,
      live,
      delta_vs_legacy: Number((live - legacy).toFixed(2)),
      delta_vs_r06: Number((live - r06).toFixed(2)),
    };
  }
  for (const item of results) {
    const legacy = item.historical?.legacy_score ?? 0;
    const r06 = item.historical?.r06_score ?? 0;
    const live = item.live.evaluation.total_score;
    summary.by_category[item.category] = {
      historical_legacy: legacy,
      historical_r06: r06,
      live,
      delta_vs_legacy: Number((live - legacy).toFixed(2)),
      delta_vs_r06: Number((live - r06).toFixed(2)),
    };
    const delta = live - r06;
    if (delta > 0.05) summary.wins_vs_r06 += 1;
    else if (delta < -0.05) summary.losses_vs_r06 += 1;
    else summary.ties_vs_r06 += 1;
  }
  return summary;
}

function renderMarkdown({ payload, jsonPath }) {
  const relJson = jsonPath.replace(`${ROOT}/`, "");
  const { summary } = payload;
  return `# HAI Live Context Orchestrator 质量评估报告

> 运行 ID：${payload.run_id}  
> 生成时间：${payload.created_at}  
> 测试方式：把 9 条人工咨询标尺题发给线上 HAI \`hai-chat\`，再用 DeepSeek JSON 评估器打分  
> 历史对照：${payload.historical_reference.path}  
> JSON 原始数据：${relJson}

## 一、汇总数据

| 指标 | 历史旧版 | R06 标尺版 | 当前线上 HAI | 当前 vs 旧版 | 当前 vs R06 |
|---|---:|---:|---:|---:|---:|
| 平均总分 | ${summary.historical_legacy_average} | ${summary.historical_r06_average} | ${summary.live_average} | ${formatDelta(summary.delta_vs_legacy)} | ${formatDelta(summary.delta_vs_r06)} |
| 当前相对 R06 胜 / 平 / 负 |  |  |  |  | ${summary.wins_vs_r06} / ${summary.ties_vs_r06} / ${summary.losses_vs_r06} |

## 二、分维度数据

| 维度 | 历史旧版 | R06 标尺版 | 当前线上 HAI | 当前 vs 旧版 | 当前 vs R06 |
|---|---:|---:|---:|---:|---:|
${Object.entries(summary.by_dimension).map(([key, value]) => `| ${key} | ${value.historical_legacy} | ${value.historical_r06} | ${value.live} | ${formatDelta(value.delta_vs_legacy)} | ${formatDelta(value.delta_vs_r06)} |`).join("\n")}

## 三、分场景数据

| 场景 | 历史旧版 | R06 标尺版 | 当前线上 HAI | 当前 vs 旧版 | 当前 vs R06 |
|---|---:|---:|---:|---:|---:|
${Object.entries(summary.by_category).map(([key, value]) => `| ${key} | ${value.historical_legacy} | ${value.historical_r06} | ${value.live} | ${formatDelta(value.delta_vs_legacy)} | ${formatDelta(value.delta_vs_r06)} |`).join("\n")}

## 四、逐条用例

${payload.results.map(renderCase).join("\n\n")}
`;
}

function renderCase(item, index) {
  return `### ${index + 1}. ${item.id}｜${item.category}

**用户问题**

${item.input}

**预期行为**

${item.expected.map((value) => `- ${value}`).join("\n")}

**评分**

| 版本 | 总分 | 意图 | 判断 | 风格 | 可执行 | 边界 | 简洁 | 评语 |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 历史旧版 | ${item.historical?.legacy_score ?? "-"} | ${item.historical?.legacy_evaluation?.scores?.intent ?? "-"} | ${item.historical?.legacy_evaluation?.scores?.teaching_judgment ?? "-"} | ${item.historical?.legacy_evaluation?.scores?.style ?? "-"} | ${item.historical?.legacy_evaluation?.scores?.actionability ?? "-"} | ${item.historical?.legacy_evaluation?.scores?.boundary ?? "-"} | ${item.historical?.legacy_evaluation?.scores?.brevity ?? "-"} | ${escapePipes(item.historical?.legacy_evaluation?.comment ?? "")} |
| R06 标尺版 | ${item.historical?.r06_score ?? "-"} | ${item.historical?.r06_evaluation?.scores?.intent ?? "-"} | ${item.historical?.r06_evaluation?.scores?.teaching_judgment ?? "-"} | ${item.historical?.r06_evaluation?.scores?.style ?? "-"} | ${item.historical?.r06_evaluation?.scores?.actionability ?? "-"} | ${item.historical?.r06_evaluation?.scores?.boundary ?? "-"} | ${item.historical?.r06_evaluation?.scores?.brevity ?? "-"} | ${escapePipes(item.historical?.r06_evaluation?.comment ?? "")} |
| 当前线上 HAI | ${item.live.evaluation.total_score} | ${item.live.evaluation.scores.intent} | ${item.live.evaluation.scores.teaching_judgment} | ${item.live.evaluation.scores.style} | ${item.live.evaluation.scores.actionability} | ${item.live.evaluation.scores.boundary} | ${item.live.evaluation.scores.brevity} | ${escapePipes(item.live.evaluation.comment)} |

**当前线上 HAI 回复**

${item.live.answer}

**Trace 摘要**

- intent: ${item.live.trace?.intent_result?.primary_intent ?? "-"}
- diagnostic_module: ${item.live.trace?.diagnostic_module ?? "-"}
- evaluator_score: ${item.live.trace?.evaluation_result?.score ?? "-"}
- retrieved_context_ids: ${item.live.trace?.retrieved_context_ids?.filter(Boolean).length ?? 0}`;
}

function normalizeScores(scores) {
  const keys = ["intent", "teaching_judgment", "style", "actionability", "boundary", "brevity"];
  return Object.fromEntries(keys.map((key) => [key, clampScore(scores[key])]));
}

function weightedTotal(scores) {
  return (
    scores.intent * SCORE_WEIGHTS.intent +
    scores.teaching_judgment * SCORE_WEIGHTS.teaching_judgment +
    scores.actionability * SCORE_WEIGHTS.actionability +
    scores.style * SCORE_WEIGHTS.style +
    scores.boundary * SCORE_WEIGHTS.boundary +
    scores.brevity * SCORE_WEIGHTS.brevity
  );
}

function applyScoreCaps(total, scores) {
  let capped = total;
  if (scores.intent < 60 || scores.teaching_judgment < 60 || scores.boundary < 60) capped = Math.min(capped, 60);
  if (scores.intent < 75 || scores.teaching_judgment < 75) capped = Math.min(capped, 75);
  return capped;
}

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score));
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(2));
}

function escapePipes(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function formatDelta(value) {
  return value > 0 ? `+${value}` : String(value);
}

function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && value !== null));
}

function loadEnv(file) {
  try {
    const content = readFileSync(join(ROOT, file), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Optional env file.
  }
}
