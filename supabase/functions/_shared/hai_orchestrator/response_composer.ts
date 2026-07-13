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
    : "- 本轮未加载用户记忆或无命中记忆。";

  const caseText = (params.context.retrieved_cases ?? []).length > 0
    ? params.context.retrieved_cases!.map((item, index) =>
      [
        `【案例 ${index + 1}｜${item.id}】`,
        `表层问题：${item.surface_problem}`,
        `深层问题：${item.deeper_problem}`,
        `HAI 判断：${item.hai_judgement}`,
        `建议结构：${item.recommended_structure}`,
        `表达参考：${item.sample_answer}`,
      ].join("\n")
    ).join("\n\n")
    : "- 暂无命中案例。";

  const expressionText = (params.context.retrieved_expressions ?? []).length > 0
    ? params.context.retrieved_expressions!.map((item) => `- ${item}`).join(
      "\n",
    )
    : "- 使用自然、直接、短句表达。";

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
        `资料依据：${card.sourceRefs.join("；")}`,
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
    params.context.core_axioms
      ? `【教学公理】\n${params.context.core_axioms}`
      : "",
    params.context.han_methodology
      ? `【哈老师教学通识课方法论】\n${params.context.han_methodology}`
      : "",
    `当前功能模块：${params.module.name}（${params.module.slug}）。`,
    `【意图识别】\n${JSON.stringify(params.context.intent_result, null, 2)}`,
    `【用户记忆选择】\n${
      JSON.stringify(params.context.memory_selection, null, 2)
    }\n${memoryText}\n使用方式：只在相关时自然融入判断，不要机械复述，也不要暴露记忆分类名。当前输入与记忆冲突时，以当前输入为准。`,
    `【问题重构】\n${JSON.stringify(params.context.problem_rewrite, null, 2)}`,
    `【诊断框架】\n${params.context.diagnostic_framework}`,
    `【检索规划】\n${JSON.stringify(params.context.retrieval_plan, null, 2)}`,
    `【案例库命中】\n${caseText}`,
    `【教学通识课方法卡命中】\n${methodCardText}`,
    params.context.formula_bank
      ? `【教学设计公式库】\n${params.context.formula_bank}`
      : "",
    `【用户上传/沉淀素材】\n${
      params.materialContext.text ||
      "- 暂无命中素材。不要声称引用了用户没有提供的材料。"
    }`,
    `【方法/理论库命中】\n${
      params.knowledgeContext.text ||
      "- 暂无命中方法或理论。可以依靠通用教学设计常识，但不要声称引用了内部框架。"
    }`,
    `【表达库】\n${expressionText}`,
    `【风格要求】\n${params.context.style_pack}`,
    params.context.methodology_focus
      ? `【本轮唯一方法聚焦，必须服从，不得混入其他框架】\n${params.context.methodology_focus}`
      : "",
    params.context.response_composer_prompt || `【回答编排】
先选择一种主答法，不要把下列步骤全部输出。
概念含糊时先澄清关键词，不能追问就说明我先按什么来理解。
一句话里混了多个问题时先拆开判断。
答案依赖场景时先看刚入职、学段、日常课、公开课、赛课、时间和当地评审等变量。
错误归因明显时，再用目的和手段、原因和结果、往前倒的方式重构。
涉及教学设计时，优先调用哈老师教学通识课方法论，不另造通用框架。

方法路由是硬约束。优先服从本轮语义路由选中的教学通识课方法卡，不用模型自创框架替代。真正用方法卡完成判断和建议，不能只报名称。一次只展开一个主方法，辅助方法最多一句带过。区分哈老师课程方法、课程吸收改造的外部理论和咨询反馈校准标准，不把后两者说成哈老师原创理论。

最终回答先用一两句具体共情建立连接，然后讲透一条判断主线，只给一个精准抓手。需要解释时可以加一个课堂例子或前后对比。结尾给一个与本题直接相关的行动邀请，让用户可以把材料或结果发来继续讨论。

最终只输出纯文本自然段。不要使用 Markdown 标题、粗体、项目符号、有序编号、引用块或表格。不要写第一、第二、第三、第一个、第二个、第三个、一是、二是，也不要说我给你三点或先做三件事。尽量只使用逗号、句号和问号，不使用引号、冒号、分号、括号和破折号。输出前自行扫描并改掉这些枚举词和复杂标点。不要输出内部 JSON、trace、检索规划或质检结果。`,
    rewriteBlock,
    "只输出给用户看的纯文本自然段。不要输出 Markdown 标题、粗体、编号、项目符号、表格、内部 JSON、trace、检索规划或质检结果。",
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
