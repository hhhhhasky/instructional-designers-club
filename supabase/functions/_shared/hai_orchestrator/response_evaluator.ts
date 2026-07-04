import type { HAIContextPackage, ResponseEvaluation } from "./types.ts";

const genericPhrases = [
  "提高课堂趣味性",
  "激发学生兴趣",
  "优化课堂管理",
  "因材施教",
  "以学生为主体",
  "充分调动积极性",
  "寓教于乐",
];

export function evaluateResponse(
  answer: string,
  context: HAIContextPackage,
  options: { passScore?: number } = {},
): ResponseEvaluation {
  const normalized = answer.replace(/\s+/g, "");
  const hasClearJudgement = /不是|不要先|真正|核心|关键|先判断|问题不在/.test(answer.slice(0, 180));
  const hasProblemReframing = /表面|更深层|真正的问题|不是.+而是|误区|归因/.test(answer);
  const hasActionableSteps = /第一步|第二步|第三步|1[.、]|2[.、]|3[.、]/.test(answer);
  const usesHaiStyle = /不要先|不是.+而是|表面上|很多老师|好，|你看/.test(answer) && answer.length <= 1800;
  const usesRelevantContext = includesAny(answer, [
    context.problem_rewrite.hai_reframing,
    context.problem_rewrite.deeper_problem,
    context.intent_result.primary_intent,
    ...(context.retrieved_cases ?? []).map((item) => item.hai_judgement),
  ]);
  const doesNotOverclaim = !/保证|一定能|彻底解决|唯一答案|必须完全/.test(answer);
  const handlesUncertainty = hasSpecificContext(context.user_question) || /如果|假设|信息不足|我先按/.test(answer);
  const avoidsGenericAdvice = !genericPhrases.some((phrase) => normalized.includes(phrase.replace(/\s+/g, ""))) || hasActionableSteps;

  const checks = {
    has_clear_judgement: hasClearJudgement,
    has_problem_reframing: hasProblemReframing,
    avoids_generic_advice: avoidsGenericAdvice,
    has_actionable_steps: hasActionableSteps,
    uses_hai_style: usesHaiStyle,
    uses_relevant_context: usesRelevantContext,
    does_not_overclaim: doesNotOverclaim,
    handles_uncertainty: handlesUncertainty,
  };

  const weights: Record<keyof typeof checks, number> = {
    has_clear_judgement: 16,
    has_problem_reframing: 18,
    avoids_generic_advice: 14,
    has_actionable_steps: 16,
    uses_hai_style: 12,
    uses_relevant_context: 12,
    does_not_overclaim: 6,
    handles_uncertainty: 6,
  };

  const score = Object.entries(checks).reduce((total, [key, passed]) => total + (passed ? weights[key as keyof typeof checks] : 0), 0);
  const problems = buildProblems(checks);

  const passScore = Math.max(0, Math.min(100, Math.round(options.passScore ?? 78)));

  return {
    pass: score >= passScore && problems.length <= 2,
    score,
    problems,
    rewrite_instructions: buildRewriteInstructions(problems, context),
    checks,
  };
}

function buildProblems(checks: ResponseEvaluation["checks"]) {
  const problems: string[] = [];
  if (!checks.has_clear_judgement) problems.push("回答开头没有明确判断。");
  if (!checks.has_problem_reframing) problems.push("没有重构用户真实问题或指出错误归因。");
  if (!checks.avoids_generic_advice) problems.push("出现了正确废话或泛泛建议。");
  if (!checks.has_actionable_steps) problems.push("缺少可执行步骤。");
  if (!checks.uses_hai_style) problems.push("表达不够像哈老师式咨询，可能偏论文腔或模板化。");
  if (!checks.uses_relevant_context) problems.push("没有使用问题重构、案例或诊断框架。");
  if (!checks.does_not_overclaim) problems.push("存在过度承诺或绝对化表达。");
  if (!checks.handles_uncertainty) problems.push("信息不足时没有说明假设。");
  return problems;
}

function buildRewriteInstructions(problems: string[], context: HAIContextPackage) {
  if (problems.length === 0) return "无需重写。";
  return [
    "重写回答，只输出最终给用户看的内容。",
    `开头先给判断：${context.problem_rewrite.hai_reframing}`,
    `必须体现问题重构：${context.problem_rewrite.deeper_problem}`,
    "减少泛泛建议，给出 3-4 个可执行步骤。",
    "保持短句、直接、有诊断感，不写论文腔。",
  ].join("\n");
}

function includesAny(text: string, candidates: string[]) {
  const normalized = text.replace(/\s+/g, "");
  return candidates
    .filter(Boolean)
    .some((candidate) => {
      const terms = candidate.replace(/\s+/g, "").match(/[\u4e00-\u9fa5]{2,}|[A-Za-z_]{4,}/g) ?? [];
      return terms.slice(0, 4).some((term) => normalized.includes(term));
    });
}

function hasSpecificContext(question: string) {
  return /年级|学科|教材|课文|单元|班|学生|公开课|教案|作业|AI|ai|评价|反馈/.test(question);
}
