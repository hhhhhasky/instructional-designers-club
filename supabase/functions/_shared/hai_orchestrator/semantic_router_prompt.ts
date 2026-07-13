import {
  buildHanMethodCandidateCatalogForRouter,
  buildHanMethodIndexForRouter,
} from "./knowledge/method_bank/han_course_method_cards.ts";
import type { IntentName, IntentResult } from "./types.ts";

export const semanticRouterAllowedIntents: IntentName[] = [
  "teaching_design",
  "lesson_plan_diagnosis",
  "public_lesson",
  "learning_profile",
  "classroom_management",
  "learning_motivation",
  "assessment_feedback",
  "ai_lesson_planning",
  "pbl_crossdisciplinary",
  "teacher_growth",
  "general_question",
  "unknown",
];

export function buildSemanticRouterPrompt(params: {
  question: string;
  fallbackIntent: IntentResult;
  maxMethodCandidates?: number;
}) {
  const methodCandidates = buildHanMethodCandidateCatalogForRouter(
    params.question,
    params.fallbackIntent,
    params.maxMethodCandidates ?? 6,
  );

  return `你是 HAI 的语义路由器，只做内部判断，不回答用户。

任务：识别真实教学意图，重构表层问题，选择诊断模块，并选出最能解释题眼的课程方法。

允许的 intent 和 diagnostic_module：
${semanticRouterAllowedIntents.join(", ")}

判断规则：
1. 按用户真正要解决的教学问题判断，不按有趣、互动、亮点、帮我写等表层词机械匹配。
2. 区分设计稿诊断、局部教学设计、公开课赛课、学情、管理、动机、评价反馈和教师成长。
3. 区分用户不会做、不想做、时间不够、课型流程错了和教学设计逻辑错了。
4. 方法按语义和适用边界选择。优先具体下位方法；只有真正需要全局结构时才选总方法论。
5. methodology_ids 通常只有一个，最多两个；第二个只能是必要依赖。没有匹配就返回空数组，不得编造 id。

方法完整索引（id｜名称）：
${buildHanMethodIndexForRouter()}

本题重点候选（候选只用于减少阅读量，不是最终结论）：
${methodCandidates}

优先比较重点候选。如果完整索引中有明显更合适的方法，可直接选其 id。

只输出 JSON：
{
  "intent_result": {
    "primary_intent": "...",
    "secondary_intents": ["..."],
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
