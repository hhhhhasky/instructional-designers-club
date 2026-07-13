import { HAIContextOrchestrator } from "../supabase/functions/_shared/hai_orchestrator/context_orchestrator.ts";
import {
  buildComposedSystemPrompt,
  normalizeHaiVoiceFormatting,
} from "../supabase/functions/_shared/hai_orchestrator/response_composer.ts";
import type {
  IntentName,
  SemanticRouteResult,
} from "../supabase/functions/_shared/hai_orchestrator/types.ts";

const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
const baseUrl =
  (Deno.env.get("DEEPSEEK_BASE_URL") || "https://api.deepseek.com").replace(
    /\/$/,
    "",
  );
const model = Deno.env.get("DEEPSEEK_MODEL") || "deepseek-v4-flash";
if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY.");

const cases: Array<
  {
    id: string;
    question: string;
    intent: IntentName;
    methodId: string;
    expectedName: string;
    expectedSignals: Array<string | string[]>;
  }
> = [
  {
    id: "master-framework",
    question: "我总分不清备课步骤和教案要素，你能讲清楚它们之间是什么关系吗？",
    intent: "teaching_design",
    methodId: "lesson-preparation-design-master",
    expectedName: "备课流程＋教学设计框架",
    expectedSignals: [
      "备课流程",
      "教学设计框架",
      "分析",
      "设计",
      "研发",
      "迭代",
      "教学通识课",
    ],
  },
  {
    id: "three-foundations",
    question:
      "学习科学、教学科学和教育哲学，在我的教学框架里分别解决什么问题？",
    intent: "general_question",
    methodId: "teaching-foundations-three-domains",
    expectedName: "教学框架三大底层领域",
    expectedSignals: ["学习科学", "教学科学", "教育哲学", "教学通识课"],
  },
  {
    id: "target",
    question: "我的教学目标写的是理解课文内容、培养核心素养，这样写合格吗？",
    intent: "lesson_plan_diagnosis",
    methodId: "target-quality-three-checks",
    expectedName: "目标质量三检法",
    expectedSignals: ["目标质量三检法", "教学目标篇"],
  },
  {
    id: "review",
    question:
      "复习课我总是把教材从头到尾重新讲一遍，学生综合题还是不会，应该怎么改？",
    intent: "teaching_design",
    methodId: "review-four-stages",
    expectedName: "复习课四段式",
    expectedSignals: ["补洞", "建网", "提法", "达标", "日常课教学"],
  },
  {
    id: "task",
    question:
      "我设计的任务是请同学们做一张海报，但学生还是不知道具体要做什么，怎么修改？",
    intent: "pbl_crossdisciplinary",
    methodId: "task-script-five-elements",
    expectedName: "任务脚本五要素",
    expectedSignals: [
      ["身份", "角色"],
      "受众",
      "场景",
      "产品",
      "目标",
      "任务情境篇",
    ],
  },
  {
    id: "participation",
    question:
      "课堂小组讨论很热闹，但总是几个人在说，其他人课后还是不会，怎么办？",
    intent: "learning_motivation",
    methodId: "all-student-evidence",
    expectedName: "全员学习证据",
    expectedSignals: ["全员学习证据", "日常课教学"],
  },
];

const orchestrator = new HAIContextOrchestrator();
let passed = 0;
for (const item of cases) {
  const semanticRoute: SemanticRouteResult = {
    intent: {
      primary_intent: item.intent,
      explicit_need: item.question,
      implicit_need: "需要使用课程方法做出针对性诊断。",
      confidence: 0.95,
      route_method: "llm",
    },
    problem_rewrite: {
      original_question: item.question,
      surface_problem: item.question,
      deeper_problem: "需要找到最能解释当前题眼的课程方法并落到一个动作。",
      hai_reframing: "使用课程方法完成诊断，而不是给通用建议。",
      recommended_answer_direction: "讲透一条主线，只给一个精准抓手。",
    },
    diagnostic_module: item.intent,
    methodology_ids: [item.methodId],
    methodology_reason: `该问题与${item.expectedName}的适用情境直接匹配。`,
    methodology_confidence: 0.95,
  };
  const context = orchestrator.buildInitialPackage(item.question, {
    caseMax: 0,
    methodMax: 2,
    theoryMax: 0,
    expressionMax: 3,
  }, semanticRoute);
  const systemPrompt = buildComposedSystemPrompt({
    module: { name: "问问哈老师", slug: "ask-han" },
    context,
    memories: [],
    materialContext: { text: "", citations: [] },
    knowledgeContext: { text: "", citations: [] },
  });
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
      temperature: 0.25,
      max_tokens: 900,
      stream: false,
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
  const answer = normalizeHaiVoiceFormatting(
    String(data?.choices?.[0]?.message?.content || ""),
  );
  const matchesSignal = (signal: string | string[]) =>
    Array.isArray(signal)
      ? signal.some((candidate) => answer.includes(candidate))
      : answer.includes(signal);
  const hasMethod = item.expectedSignals.every(matchesSignal);
  const missingSignals = item.expectedSignals.filter((signal) =>
    !matchesSignal(signal)
  ).map((signal) => Array.isArray(signal) ? signal.join("/") : signal);
  const noMarkdown = !/(^|\n)\s*(#{1,6}|[-*+]\s|\d+[.、]\s)/m.test(answer);
  const pass = hasMethod && noMarkdown;
  if (pass) passed += 1;
  console.log(
    `\n${
      pass ? "PASS" : "FAIL"
    } ${item.id} method=${item.expectedName} missing=${
      missingSignals.join("|") || "none"
    }\n${answer}\n`,
  );
}

console.log(JSON.stringify({ passed, total: cases.length }, null, 2));
if (passed !== cases.length) Deno.exit(1);
