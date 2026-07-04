import type { IntentResult, ProblemRewrite } from "./types.ts";

const rewriteFrames: Record<string, Omit<ProblemRewrite, "original_question">> = {
  learning_motivation: {
    surface_problem: "用户认为学生投入不足，可能想增加趣味、游戏或互动。",
    deeper_problem: "学生可能没有进入学习任务，也没有意识到这个知识为什么值得学。",
    wrong_attribution_risk: "用户可能把学生不投入误归因为课堂不够热闹。",
    hai_reframing: "这个问题不应该先问怎么让课堂有趣，而应该问如何给知识设计一个认知入口，让学生产生学习必要感。",
    recommended_answer_direction: "先纠偏，再解释认知入口，再给出可执行步骤。",
  },
  public_lesson: {
    surface_problem: "用户想让公开课更有亮点或更容易被看见。",
    deeper_problem: "真正需要判断的是这节课有没有学生理解变化，以及这个变化能否被活动和证据呈现出来。",
    wrong_attribution_risk: "用户可能把亮点误归因为技术、热闹活动或流程包装。",
    hai_reframing: "公开课亮点不是形式亮点，而是学习性亮点：学生从 A 理解走向 B 理解。",
    recommended_answer_direction: "先重定义亮点，再找学习转折，最后给出活动取舍路径。",
  },
  lesson_plan_diagnosis: {
    surface_problem: "用户想知道教案哪里不够好。",
    deeper_problem: "教案可能不是语言问题，而是目标、活动、评价和学情没有形成一致结构。",
    wrong_attribution_risk: "用户可能以为补充理念或活动就能改善教案。",
    hai_reframing: "教案诊断要先看学生学习过程是否清楚，而不是看环节是否完整。",
    recommended_answer_direction: "按目标、学情、活动、评价证据四层诊断，并给出最小修改顺序。",
  },
  assessment_feedback: {
    surface_problem: "用户想提高反馈效率或评价质量。",
    deeper_problem: "问题可能不是反馈不够多，而是没有设计能快速暴露学习状态的证据。",
    wrong_attribution_risk: "用户可能把评价理解成批改、打分或逐个点评。",
    hai_reframing: "评价反馈要先问收集什么学习证据，再问如何反馈。",
    recommended_answer_direction: "先重构反馈对象，再给低成本证据收集和分层反馈方法。",
  },
  ai_lesson_planning: {
    surface_problem: "用户想用 AI 生成更好的备课内容。",
    deeper_problem: "AI 产出普通，往往是因为它只被要求生成流程，没有参与目标、学情和任务诊断。",
    wrong_attribution_risk: "用户可能把模型能力问题误认为主要原因。",
    hai_reframing: "AI 备课不要从代写开始，要从诊断、追问和审稿开始。",
    recommended_answer_direction: "先改变 AI 的任务位置，再给提示词结构和审稿流程。",
  },
};

export function rewriteProblem(question: string, intent: IntentResult): ProblemRewrite {
  const frame = rewriteFrames[intent.primary_intent] ?? {
    surface_problem: "用户提出了一个教育教学问题，希望获得建议。",
    deeper_problem: intent.implicit_need || "需要把表层诉求转成更具体的教学判断问题。",
    wrong_attribution_risk: intent.risk_of_wrong_framing || "如果不先诊断，容易给出泛泛建议。",
    hai_reframing: "先不要急着给方法，要先判断这个问题背后的教学结构是什么。",
    recommended_answer_direction: "先说明假设和判断，再给出可执行的下一步。",
  };

  return {
    original_question: question,
    ...frame,
  };
}
