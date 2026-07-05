import type { HAIContextPackage, ResponseEvaluation } from "./types.ts";

type PromptRow = {
  system_prompt: string;
  developer_prompt: string;
  response_contract: string;
};

type ModuleRow = {
  name: string;
  slug: string;
};

type RetrievedTextContext = {
  text: string;
  citations: Array<Record<string, unknown>>;
};

export function buildComposedSystemPrompt(params: {
  prompt: PromptRow;
  module: ModuleRow;
  context: HAIContextPackage;
  memories: Array<{ category: string; content: string }>;
  materialContext: RetrievedTextContext;
  knowledgeContext: RetrievedTextContext;
  evaluation?: ResponseEvaluation;
  draftAnswer?: string;
}) {
  const memoryText = params.memories.length > 0
    ? params.memories.map((item) => `- ${memoryLabel(item.category)}：${item.content}`).join("\n")
    : "- 本轮未加载用户记忆或无命中记忆。";

  const caseText = (params.context.retrieved_cases ?? []).length > 0
    ? params.context.retrieved_cases!.map((item, index) => [
      `【案例 ${index + 1}｜${item.id}】`,
      `表层问题：${item.surface_problem}`,
      `深层问题：${item.deeper_problem}`,
      `HAI 判断：${item.hai_judgement}`,
      `建议结构：${item.recommended_structure}`,
      `表达参考：${item.sample_answer}`,
    ].join("\n")).join("\n\n")
    : "- 暂无命中案例。";

  const expressionText = (params.context.retrieved_expressions ?? []).length > 0
    ? params.context.retrieved_expressions!.map((item) => `- ${item}`).join("\n")
    : "- 使用自然、直接、短句表达。";

  const rewriteBlock = params.evaluation && params.evaluation.pass === false
    ? [
      "【质检未通过，必须重写】",
      `初稿：\n${params.draftAnswer ?? ""}`,
      `质检问题：${params.evaluation.problems.join("；")}`,
      `重写指令：\n${params.evaluation.rewrite_instructions}`,
    ].join("\n")
    : "";

  return [
    params.context.core_identity,
    params.context.safety_boundaries,
    `当前功能模块：${params.module.name}（${params.module.slug}）。`,
    `【意图识别】\n${JSON.stringify(params.context.intent_result, null, 2)}`,
    `【用户记忆选择】\n${JSON.stringify(params.context.memory_selection, null, 2)}\n${memoryText}\n使用方式：只在相关时自然融入判断，不要机械复述，也不要暴露记忆分类名。当前输入与记忆冲突时，以当前输入为准。`,
    `【问题重构】\n${JSON.stringify(params.context.problem_rewrite, null, 2)}`,
    `【诊断框架】\n${params.context.diagnostic_framework}`,
    `【检索规划】\n${JSON.stringify(params.context.retrieval_plan, null, 2)}`,
    `【案例库命中】\n${caseText}`,
    `【用户上传/沉淀素材】\n${params.materialContext.text || "- 暂无命中素材。不要声称引用了用户没有提供的材料。"}`,
    `【方法/理论库命中】\n${params.knowledgeContext.text || "- 暂无命中方法或理论。可以依靠通用教学设计常识，但不要声称引用了内部框架。"}`,
    `【表达库】\n${expressionText}`,
    `【风格要求】\n${params.context.style_pack}`,
    params.context.response_composer_prompt || `【输出结构】\n1. 先给判断：这个问题不要先理解成什么。\n2. 再做重构：表面上是什么，更深层是什么。\n3. 指出常见误区。\n4. 给出专业框架。\n5. 给出可执行步骤。\n6. 最后用一句有判断力的话收束。`,
    params.prompt.response_contract ? `【线上输出契约】\n${trimText(params.prompt.response_contract, 800)}` : "",
    params.prompt.developer_prompt ? `【线上补充规则摘要】\n${trimText(params.prompt.developer_prompt, 900)}` : "",
    rewriteBlock,
    "不要输出内部 JSON、trace、检索规划或质检结果。",
  ].filter(Boolean).join("\n\n");
}

function trimText(text: string, maxChars: number) {
  const normalized = text.trim();
  return normalized.length > maxChars ? `${normalized.slice(0, maxChars)}...` : normalized;
}

function memoryLabel(category: string) {
  const labels: Record<string, string> = {
    basic_info: "基础画像",
    education_philosophy: "教育观",
    student_view: "学生特点",
    teaching_view: "教学观",
    teaching_preference: "教学偏好",
    constraint: "现实限制",
    behavior: "执行反馈",
    vision: "长期追求",
    challenge: "反复困难",
  };
  return labels[category] ?? "补充信息";
}
