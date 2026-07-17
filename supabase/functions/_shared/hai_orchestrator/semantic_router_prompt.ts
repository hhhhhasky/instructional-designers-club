import {
  buildHanMethodCandidateCatalogForRouter,
  buildHanMethodIndexForRouter,
  hanCourseMethodCards,
  type HanMethodCard,
} from "./knowledge/method_bank/han_course_method_cards.ts";
import type {
  DiagnosticModuleName,
  IntentName,
  IntentResult,
  SupportDepth,
  TeachingScene,
  UserGoal,
} from "./types.ts";

export const semanticRouterAllowedIntents: IntentName[] = [
  "showcase_lesson_diagnosis",
  "showcase_lesson_design",
  "daily_improvement_diagnosis",
  "daily_improvement_design",
  "teaching_concept_qa",
  "unknown",
];

export const semanticRouterAllowedScenes: TeachingScene[] = [
  "public_lesson",
  "lesson_presentation",
  "competition_lesson",
  "daily_lesson",
  "review_lesson",
  "exam_review",
  "general_teaching",
  "unclear",
];

export const semanticRouterAllowedUserGoals: UserGoal[] = [
  "diagnosis",
  "design_support",
  "concept_qa",
  "unclear",
];

export const semanticRouterAllowedSupportDepths: SupportDepth[] = [
  "advice",
  "ideas",
  "demonstration",
];

export const semanticRouterAllowedDiagnosticModules: DiagnosticModuleName[] = [
  "showcase_lesson_diagnosis",
  "showcase_lesson_design",
  "daily_improvement_diagnosis",
  "daily_improvement_design",
  "teaching_concept_qa",
];

export const defaultSemanticRouterPolicy = `判断规则：
1. 按用户真正要解决的教学问题判断，不按有趣、互动、亮点、帮我写等表层词机械匹配。
2. 场景先分两组：公开课、说课、赛课等展示竞赛场景；日常课、复习课、试卷讲评、提分等常态教学场景。
3. 用户已经给出教案、说课稿、环节、方案、课堂表现或明确做法，并询问“怎么样、对不对、问题在哪、怎么改”，判为 diagnosis；用户没有成熟方案，询问“怎么设计、怎么上、给思路、示范一下”，判为 design_support。
4. 用户只询问教学概念、原理、方法区别，且不要求解决一节具体课，判为 teaching_concept_qa。
5. primary_intent 由场景和目的组合：
   - 展示竞赛场景 + diagnosis = showcase_lesson_diagnosis
   - 展示竞赛场景 + design_support = showcase_lesson_design
   - 常态教学场景 + diagnosis = daily_improvement_diagnosis
   - 常态教学场景 + design_support = daily_improvement_design
   - 概念答疑 = teaching_concept_qa
6. support_depth 只控制帮助深度：advice=判断建议，ideas=设计思路，demonstration=局部示范或结构样例。即使是 demonstration，也不得输出完整教案、完整说课稿、完整课堂流程或整套任务脚本。
7. 五个基础 diagnostic_module 与五类 primary_intent 一一对应。管理员新增的诊断模块只有在“诊断模块目录”中出现且确实更匹配时才可选择；学情、动机、评价等具体问题通常写入问题重构和基础诊断模块内部。
8. secondary_intents 通常返回空数组；不要用它承载学情、动机、评价等诊断主题。
9. 方法按语义和适用边界选择。优先具体下位方法；只有真正需要全局结构时才选总方法论。
10. methodology_ids 通常只有一个，最多两个；第二个只能是必要依赖。没有匹配就返回空数组，不得编造 id。`;

export function buildSemanticRouterPrompt(params: {
  question: string;
  fallbackIntent: IntentResult;
  maxMethodCandidates?: number;
  policyPrompt?: string;
  diagnosticModules?: DiagnosticModuleName[];
  diagnosticModuleCatalog?: string;
  methodCards?: HanMethodCard[];
}) {
  const methodCards = params.methodCards ?? hanCourseMethodCards;
  const methodCandidates = buildHanMethodCandidateCatalogForRouter(
    params.question,
    params.fallbackIntent,
    params.maxMethodCandidates ?? 6,
    methodCards,
  );
  const allowedDiagnosticModules = uniqueStrings([
    ...semanticRouterAllowedDiagnosticModules,
    ...(params.diagnosticModules ?? []),
  ]);

  return `你是 HAI 的语义路由器，只做内部判断，不回答用户。

任务：先识别场景和用户目的，再得到业务意图；随后重构表层问题、选择诊断模块，并选出最能解释题眼的课程方法。

允许的 primary_intent：
${semanticRouterAllowedIntents.join(", ")}

允许的 scene：
${semanticRouterAllowedScenes.join(", ")}

允许的 user_goal：
${semanticRouterAllowedUserGoals.join(", ")}

允许的 support_depth：
${semanticRouterAllowedSupportDepths.join(", ")}

允许的 diagnostic_module：
${allowedDiagnosticModules.join(", ")}

诊断模块目录：
${params.diagnosticModuleCatalog?.trim() || "仅使用上方五个基础诊断模块。"}

可编辑路由策略：
${params.policyPrompt?.trim() || defaultSemanticRouterPolicy}

方法完整索引（id｜名称）：
${buildHanMethodIndexForRouter(methodCards)}

本题重点候选（候选只用于减少阅读量，不是最终结论）：
${methodCandidates}

优先比较重点候选。如果完整索引中有明显更合适的方法，可直接选其 id。

只输出 JSON：
{
  "intent_result": {
    "primary_intent": "...",
    "secondary_intents": ["..."],
    "scene": "...",
    "user_goal": "...",
    "support_depth": "...",
    "explicit_need": "...",
    "implicit_need": "...",
    "risk_of_wrong_framing": "...",
    "confidence": 0.0,
    "route_reason": "..."
  },
  "problem_rewrite": {
    "surface_problem": "...",
    "deeper_problem": "...",
    "wrong_attribution_risk": "...",
    "hai_reframing": "...",
    "recommended_answer_direction": "..."
  },
  "diagnostic_module": "...",
  "methodology_ids": ["..."],
  "methodology_reason": "为什么主方法最匹配，以及为什么不选相邻方法",
  "methodology_confidence": 0.0
}`;
}

function uniqueStrings(values: string[]) {
  return values.filter((value, index, all) =>
    Boolean(value) && all.indexOf(value) === index
  );
}
