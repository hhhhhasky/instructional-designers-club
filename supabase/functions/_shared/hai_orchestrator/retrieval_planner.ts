import { expressionBank, sampleCases } from "./static_content.ts";
import type { IntentResult, ProblemRewrite, RetrievalPlan, RetrievedCase } from "./types.ts";

export function planRetrieval(intent: IntentResult, rewrite: ProblemRewrite): RetrievalPlan {
  const baseQuery = [
    intent.primary_intent,
    rewrite.surface_problem,
    rewrite.deeper_problem,
    rewrite.hai_reframing,
  ].join(" ");

  const theoryNeeded = ["learning_motivation", "teaching_design", "pbl_crossdisciplinary", "assessment_feedback"].includes(intent.primary_intent);

  return {
    retrieve_cases: true,
    case_query: baseQuery,
    retrieve_methods: true,
    method_query: `${rewrite.hai_reframing} 教学设计 方法 框架`,
    retrieve_theory: theoryNeeded,
    theory_query: theoryNeeded ? `${intent.primary_intent} 学习科学 教学设计 理论 支撑` : undefined,
    retrieve_expressions: true,
    expression_query: `${rewrite.recommended_answer_direction} 哈老师 表达`,
    max_cases: 3,
    max_methods: 2,
    max_theories: theoryNeeded ? 1 : 0,
    max_expressions: 5,
  };
}

export function selectLocalCases(intent: IntentResult, rewrite: ProblemRewrite, maxCases = 3): RetrievedCase[] {
  const query = `${intent.primary_intent} ${rewrite.surface_problem} ${rewrite.deeper_problem}`;
  return sampleCases
    .map((item) => ({
      item,
      score: scoreText(query, `${item.intent} ${item.user_question} ${item.surface_problem} ${item.deeper_problem} ${item.hai_judgement}`),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, maxCases))
    .map(({ item }) => item);
}

export function selectExpressions(rewrite: ProblemRewrite, maxExpressions = 5): string[] {
  const query = `${rewrite.hai_reframing} ${rewrite.recommended_answer_direction}`;
  return expressionBank
    .map((item) => ({ item, score: scoreText(query, item) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, maxExpressions))
    .map(({ item }) => item);
}

function scoreText(query: string, candidate: string) {
  const chars = new Set(query.replace(/\s+/g, "").split(""));
  let score = 0;
  for (const char of candidate.replace(/\s+/g, "")) {
    if (chars.has(char)) score += 1;
  }
  return score + (candidate.includes(query) ? 20 : 0);
}
