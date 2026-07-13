import {
  hanMethodCardIds,
} from "../supabase/functions/_shared/hai_orchestrator/knowledge/method_bank/han_course_method_cards.ts";
import { classifyIntent } from "../supabase/functions/_shared/hai_orchestrator/intent_classifier.ts";
import { buildSemanticRouterPrompt } from "../supabase/functions/_shared/hai_orchestrator/semantic_router_prompt.ts";
import { estimateTokens } from "../supabase/functions/_shared/hai.ts";

const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
const baseUrl =
  (Deno.env.get("DEEPSEEK_BASE_URL") || "https://api.deepseek.com").replace(
    /\/$/,
    "",
  );
const model = Deno.env.get("DEEPSEEK_MODEL") || "deepseek-v4-flash";
if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY.");

const cases = [
  {
    id: "master-framework",
    question: "你先帮我讲清楚，我的备课步骤和教案里的设计要素到底是什么关系？",
    expected: ["lesson-preparation-design-master"],
  },
  {
    id: "six-elements",
    question: "我听了很多优质课，但不知道怎样用一套教学设计框架拆解和迁移。",
    expected: ["teaching-design-six-elements"],
  },
  {
    id: "three-foundations",
    question:
      "学习科学、教学科学和教育哲学分别在回答什么问题，它们怎样支撑教学设计？",
    expected: ["teaching-foundations-three-domains"],
  },
  {
    id: "novice",
    question: "我刚入职，每节课都想备得很精彩，结果压力特别大。",
    expected: ["novice-minimum-standard"],
  },
  {
    id: "workflow",
    question: "我总是先做课件，教案一改课件就跟着返工，备一节课要很久。",
    expected: ["lesson-preparation-workflow"],
  },
  {
    id: "target",
    question: "我的目标写的是理解课文内容、培养核心素养，这样合格吗？",
    expected: ["target-quality-three-checks"],
  },
  {
    id: "profile",
    question: "学情分析总写学生基础薄弱，但写完也不知道课堂怎么调整。",
    expected: ["insight-quality-spectrum"],
  },
  {
    id: "alignment",
    question: "我的教案活动很多，但不知道这些活动是否真的服务目标。",
    expected: ["backward-design", "design-logic-chain"],
  },
  {
    id: "questions",
    question: "我一节课问了几十个问题，学生都能答，但总觉得思考不深入。",
    expected: ["question-chain"],
  },
  {
    id: "task",
    question: "任务情境写成请同学们制作一份海报，学生还是不知道具体要做什么。",
    expected: ["task-script-five-elements"],
  },
  {
    id: "review",
    question: "复习课就是把教材重新过一遍，学生碰到综合题还是乱。",
    expected: ["review-four-stages"],
  },
  {
    id: "exam",
    question: "试卷讲评我从第一题一直讲到最后一题，下一次学生还是错。",
    expected: ["exam-review-four-steps"],
  },
  {
    id: "levels",
    question: "一个班差异太大，讲快了有人跟不上，讲慢了优生又无聊。",
    expected: ["one-lesson-three-levels"],
  },
  {
    id: "participation",
    question: "小组讨论很热闹，但总是几个人在说，其他人课后还是不会。",
    expected: ["all-student-evidence"],
  },
  {
    id: "concept",
    question: "学生会背概念定义，但换一个例子就不会判断。",
    expected: ["concept-induction"],
  },
  { id: "no-match", question: "学校明天几点放学？", expected: [] },
];

const results = [];
for (const item of cases) {
  const systemPrompt = buildSemanticRouterPrompt({
    question: item.question,
    fallbackIntent: classifyIntent(item.question),
  });
  const userPrompt = [
    `用户问题：${item.question}`,
    "请同时判断真实意图、真实教学问题、最合适的诊断模块和课程方法。只输出 JSON，不要解释。",
  ].join("\n\n");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
      max_tokens: 900,
      stream: false,
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      String(
        data?.error?.message || data?.message || `HTTP ${response.status}`,
      ),
    );
  }
  const content = String(data?.choices?.[0]?.message?.content || "{}");
  const parsed = JSON.parse(content) as {
    methodology_ids?: unknown;
    methodology_reason?: unknown;
    reason?: unknown;
  };
  const ids = Array.isArray(parsed.methodology_ids)
    ? parsed.methodology_ids.map(String).filter((id) =>
      hanMethodCardIds.has(id)
    ).slice(0, 2)
    : [];
  const pass = item.expected.length === 0
    ? ids.length === 0
    : item.expected.includes(ids[0]);
  results.push({
    id: item.id,
    pass,
    expected: item.expected,
    actual: ids,
    reason: String(parsed.methodology_reason || parsed.reason || ""),
    question: item.question,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    estimated_input_tokens: estimateTokens(`${systemPrompt}\n${userPrompt}`),
    raw_output: content,
  });
  console.log(
    `${pass ? "PASS" : "FAIL"} ${item.id} expected=${
      item.expected.join("|") || "[]"
    } actual=${ids.join("|") || "[]"}`,
  );
}

const passed = results.filter((item) => item.pass).length;
const tokenCounts = results.map((item) => item.estimated_input_tokens);
const tokenSummary = {
  average: Math.round(
    tokenCounts.reduce((sum, value) => sum + value, 0) / tokenCounts.length,
  ),
  min: Math.min(...tokenCounts),
  max: Math.max(...tokenCounts),
};
console.log(JSON.stringify({ passed, total: results.length, tokenSummary }));
const outputDir = new URL("../docs/hai-quality-runs/", import.meta.url);
await Deno.mkdir(outputDir, { recursive: true });
const fileStamp = new Date().toISOString().replaceAll(":", "-").replaceAll(
  ".",
  "-",
);
const outputPath = new URL(
  `${fileStamp}-methodology-routing-smoke.md`,
  outputDir,
);
await Deno.writeTextFile(outputPath, renderPromptArtifact(results, passed));
console.log(`Saved ${decodeURIComponent(outputPath.pathname)}`);
if (passed !== results.length) Deno.exit(1);

function renderPromptArtifact(
  items: Array<Record<string, unknown>>,
  passedCount: number,
) {
  const lines = [
    "# HAI 方法语义路由测试快照",
    "",
    `- 生成时间：${new Date().toISOString()}`,
    `- 结果：${passedCount}/${items.length} 通过`,
    `- 估算输入 token：平均 ${tokenSummary.average}，最小 ${tokenSummary.min}，最大 ${tokenSummary.max}`,
    "",
  ];
  for (const item of items) {
    lines.push(
      `## ${item.id}`,
      "",
      `- 通过：${item.pass}`,
      `- 估算输入 token：${item.estimated_input_tokens}`,
      `- 期望：${(item.expected as string[]).join("、") || "[]"}`,
      `- 实际：${(item.actual as string[]).join("、") || "[]"}`,
      "",
    );
    for (
      const message of item.messages as Array<{ role: string; content: string }>
    ) {
      lines.push(
        `### ${message.role}`,
        "",
        "````text",
        message.content,
        "````",
        "",
      );
    }
    lines.push(
      "### 模型原始输出",
      "",
      "````json",
      String(item.raw_output),
      "````",
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}
