import type { HAIContextPackage, ResponseEvaluation } from "./types.ts";

type ModuleRow = {
  name: string;
  slug: string;
};

type RetrievedTextContext = {
  text: string;
  citations: Array<Record<string, unknown>>;
};

export function buildComposedSystemPrompt(params: {
  module: ModuleRow;
  context: HAIContextPackage;
  memories: Array<{ category: string; content: string }>;
  materialContext: RetrievedTextContext;
  knowledgeContext: RetrievedTextContext;
  evaluation?: ResponseEvaluation;
  draftAnswer?: string;
}) {
  const memoryText = params.memories.length > 0
    ? params.memories.map((item) =>
      `- ${memoryLabel(item.category)}：${item.content}`
    ).join("\n")
    : "- 未命中可用记忆。";

  const methodCardText = (params.context.retrieved_methods ?? []).length > 0
    ? params.context.retrieved_methods!.map((card, index) =>
      [
        `【课程方法卡 ${index + 1}｜${card.id}｜${card.name}】`,
        `所属课程：${card.course}`,
        `方法摘要：${card.summary}`,
        `适用情境：${card.useWhen.join("；")}`,
        `不适用或边界：${card.avoidWhen.join("；") || "无额外边界"}`,
        `核心判断：${card.coreJudgement}`,
        `可用动作：${card.moves.join("；")}`,
        `回答聚焦：${card.answerFocus}`,
      ].join("\n")
    ).join("\n\n")
    : "- 本轮没有选中已确认的课程方法卡，不得编造课程框架。";

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
    "【总方法论标识】\n备课流程＋教学设计框架。此处只用于识别和调用匹配的课程方法卡，不展开总框架。",
    `【意图识别】\n${JSON.stringify(params.context.intent_result)}`,
    `【用户记忆选择】\n${
      JSON.stringify(params.context.memory_selection)
    }\n${memoryText}\n只在相关时自然融入，不复述分类名；冲突时以当前输入为准。`,
    `【问题重构】\n${JSON.stringify(params.context.problem_rewrite)}`,
    `【本轮方法卡】\n${methodCardText}\n方法卡必须真正改变判断和建议，不只报名称。回答中自然说出主方法名称和所属课程。完整方法先用一句交代全貌，再聚焦一个抓手。只展开一个主方法，辅助方法最多一句。`,
    `【风格要求】\n${params.context.style_pack}`,
    rewriteBlock,
  ].filter(Boolean).join("\n\n");
}

export function normalizeHaiVoiceFormatting(answer: string) {
  return answer
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.、]\s*/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/第一个/g, "先看")
    .replace(/第二个/g, "再看")
    .replace(/第三个/g, "最后看")
    .replace(/第一[，,、]/g, "先看，")
    .replace(/第二[，,、]/g, "再看，")
    .replace(/第三[，,、]/g, "最后看，")
    .replace(/一是/g, "先看")
    .replace(/二是/g, "再看")
    .replace(/三是/g, "最后看")
    .replace(/这三件事/g, "这条主线")
    .replace(/三件事/g, "下面这条主线")
    .replace(/只写三行/g, "只写清一条主线")
    .replace(/[“”]/g, "")
    .replace(/：/g, "，")
    .replace(/；/g, "。")
    .replace(/——/g, "，")
    .replace(/，{2,}/g, "，")
    .replace(/。{2,}/g, "。")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/(?<!\n)\n(?!\n)/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
