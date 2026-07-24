import { estimateTokens } from "../hai.ts";
import { HAIContextOrchestrator } from "./context_orchestrator.ts";
import { buildComposedSystemPrompt } from "./response_composer.ts";
import type { SemanticRouteResult } from "./types.ts";

const question = "复习课总是把教材重新讲一遍，学生综合题还是不会，怎么改？";
const semanticRoute: SemanticRouteResult = {
  intent: {
    primary_intent: "daily_improvement_diagnosis",
    scene: "review_lesson",
    user_goal: "diagnosis",
    support_depth: "advice",
    explicit_need: "改进复习课",
    implicit_need: "从重新讲解转向迁移学习",
    confidence: 0.95,
    route_method: "llm",
  },
  problem_rewrite: {
    original_question: question,
    surface_problem: "复习课讲完仍不会综合题",
    deeper_problem: "复习活动没有帮学生建立迁移结构",
    hai_reframing: "不是再讲细一点，而是重做复习课流程",
    recommended_answer_direction: "用复习课四段式定位一个最早断点",
  },
  diagnostic_module: "daily_improvement_diagnosis",
  methodology_ids: ["review-four-stages"],
};

function assertIncludes(value: string, expected: string) {
  if (!value.includes(expected)) throw new Error(`missing: ${expected}`);
}

function assertExcludes(value: string, expected: string) {
  if (value.includes(expected)) throw new Error(`unexpected: ${expected}`);
}

Deno.test("compact composer keeps only required answer layers", () => {
  const orchestrator = new HAIContextOrchestrator();
  const context = orchestrator.buildInitialPackage(
    question,
    { caseMax: 3, methodMax: 2, theoryMax: 2, expressionMax: 5 },
    semanticRoute,
    {
      "diagnostic_module.daily_improvement_diagnosis":
        "SENTINEL_DIAGNOSTIC_FRAMEWORK",
      "custom_context.answer_preference": "SENTINEL_CUSTOM_CONTEXT",
    },
  );
  const prompt = buildComposedSystemPrompt({
    module: { name: "HAI Chat", slug: "hai-chat" },
    context,
    memories: [{ category: "constraint", content: "每周只有两节复习课" }],
    materialContext: { text: "SENTINEL_USER_MATERIAL", citations: [] },
    knowledgeContext: { text: "SENTINEL_KNOWLEDGE", citations: [] },
  });

  for (
    const required of [
      "总方法论标识",
      "备课流程＋教学设计框架",
      "意图识别",
      "用户记忆选择",
      "每周只有两节复习课",
      "问题重构",
      "本轮诊断模块",
      "SENTINEL_DIAGNOSTIC_FRAMEWORK",
      "SENTINEL_CUSTOM_CONTEXT",
      "本轮方法卡",
      "复习课四段式",
      "风格要求",
    ]
  ) assertIncludes(prompt, required);

  for (
    const disabled of [
      "SENTINEL_USER_MATERIAL",
      "SENTINEL_KNOWLEDGE",
      "当前功能模块",
      "检索规划",
      "案例库命中",
      "教学设计公式库",
      "表达库",
      "本轮唯一方法聚焦",
    ]
  ) assertExcludes(prompt, disabled);

  const tokens = estimateTokens(prompt);
  if (tokens > 2200) {
    throw new Error(`compact prompt is too long: ${tokens} tokens`);
  }
});

Deno.test("database-created diagnostic module becomes the selected answer context", () => {
  const orchestrator = new HAIContextOrchestrator();
  const context = orchestrator.buildInitialPackage(
    "学生总打断课堂，我应该怎么处理？",
    { caseMax: 0, methodMax: 0, theoryMax: 0, expressionMax: 0 },
    {
      intent: {
        primary_intent: "daily_improvement_diagnosis",
        scene: "daily_lesson",
        user_goal: "diagnosis",
        support_depth: "advice",
        explicit_need: "处理课堂秩序",
        confidence: 0.95,
        route_method: "llm",
      },
      diagnostic_module: "classroom_management",
    },
    {
      "diagnostic_module.classroom_management": "DYNAMIC_CLASSROOM_DIAGNOSTIC",
    },
  );
  if (context.diagnostic_module !== "classroom_management") {
    throw new Error(context.diagnostic_module);
  }
  if (context.diagnostic_framework !== "DYNAMIC_CLASSROOM_DIAGNOSTIC") {
    throw new Error(context.diagnostic_framework);
  }
});
