import {
  buildHanMethodCatalogForRouter,
  hanMethodCardIds,
} from "../supabase/functions/_shared/hai_orchestrator/knowledge/method_bank/han_course_method_cards.ts";

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

const systemPrompt = `你是 HAI 的课程方法语义路由测试器。
请从下列课程方法目录中，为用户问题选择最能解释当前题眼的方法。
优先选择具体下位方法，不要只要涉及教学就选择总领框架。
通常只选一个，最多两个；第二个只能解释必要依赖。没有真正匹配就返回空数组。
只能使用目录中的 id。只输出 JSON：{"methodology_ids":["..."],"reason":"..."}

${buildHanMethodCatalogForRouter()}`;

const results = [];
for (const item of cases) {
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
        { role: "user", content: item.question },
      ],
      temperature: 0,
      max_tokens: 300,
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
    reason: String(parsed.reason || ""),
  });
  console.log(
    `${pass ? "PASS" : "FAIL"} ${item.id} expected=${
      item.expected.join("|") || "[]"
    } actual=${ids.join("|") || "[]"}`,
  );
}

const passed = results.filter((item) => item.pass).length;
console.log(
  JSON.stringify({ passed, total: results.length, results }, null, 2),
);
if (passed !== results.length) Deno.exit(1);
