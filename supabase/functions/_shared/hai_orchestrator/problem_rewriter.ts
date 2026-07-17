import type { IntentResult, ProblemRewrite } from "./types.ts";

const rewriteFrames: Record<string, Omit<ProblemRewrite, "original_question">> =
  {
    showcase_lesson_diagnosis: {
      surface_problem:
        "用户希望判断已有公开课、说课或赛课方案是否成立，并找到需要修改的位置。",
      deeper_problem:
        "真正需要区分的是教学结构问题、展示表达问题和现实评审要求，而不是笼统地追求亮点。",
      wrong_attribution_risk:
        "用户可能把问题都归因于形式不够新、技术不够多或表达不够漂亮。",
      hai_reframing:
        "先判断现有方案的学习逻辑是否成立，再判断展示和评审层面需要怎样局部调整。",
      recommended_answer_direction:
        "先给明确诊断，再定位最早断点，最后提供局部修改建议或样例。",
    },
    showcase_lesson_design: {
      surface_problem:
        "用户缺少公开课、说课或赛课的设计思路，希望获得结构方向或局部示范。",
      deeper_problem:
        "用户需要先确定学习目标、理解转折和展示重点，再决定使用哪些形式。",
      wrong_attribution_risk:
        "用户可能在问题尚未界定时直接索要完整方案或堆叠亮点形式。",
      hai_reframing:
        "展示课设计先建立学习性亮点和结构主线，再提供局部示范，不代写完整交付物。",
      recommended_answer_direction:
        "给出设计框架、关键取舍和一个局部结构样例。",
    },
    daily_improvement_diagnosis: {
      surface_problem:
        "用户希望判断已有日常教学、复习或提分做法为什么效果不理想。",
      deeper_problem:
        "需要从学生学习结果倒查目标、任务、讲解、练习和评价证据之间的断点。",
      wrong_attribution_risk:
        "用户可能把问题简单归因于讲得不细、课堂不够有趣或学生不努力。",
      hai_reframing:
        "不要先补活动或加讲解，要先定位现有教学链条中最早失效的位置。",
      recommended_answer_direction:
        "先判断核心问题，再给最小修改顺序和局部改法。",
    },
    daily_improvement_design: {
      surface_problem: "用户不知道日常课、复习课或提分任务应该怎样设计和推进。",
      deeper_problem:
        "需要从目标、学情和学习证据出发形成一条可执行的教学主线。",
      wrong_attribution_risk:
        "用户可能直接安排环节或索要完整教案，没有先完成分析和取舍。",
      hai_reframing:
        "先给设计思路和结构骨架，再用局部示范帮助用户自己完成方案。",
      recommended_answer_direction:
        "给出设计框架、关键步骤和一个局部示范，不输出完整教案。",
    },
    teaching_concept_qa: {
      surface_problem: "用户希望理解一个教学概念、原理、方法或它们之间的区别。",
      deeper_problem:
        "用户通常不仅需要定义，还需要知道这个概念解决什么课堂问题、何时适用。",
      wrong_attribution_risk: "回答可能停留在百科解释，无法转化为教学判断。",
      hai_reframing: "概念答疑要同时解释含义、课堂用途和适用边界。",
      recommended_answer_direction:
        "先给一句清楚定义，再解释课堂含义、适用条件和一个小例子。",
    },
  };

export function rewriteProblem(
  question: string,
  intent: IntentResult,
): ProblemRewrite {
  const frame = rewriteFrames[intent.primary_intent] ?? {
    surface_problem: "用户提出了一个教育教学问题，希望获得建议。",
    deeper_problem: intent.implicit_need ||
      "需要把表层诉求转成更具体的教学判断问题。",
    wrong_attribution_risk: intent.risk_of_wrong_framing ||
      "如果不先诊断，容易给出泛泛建议。",
    hai_reframing: "先不要急着给方法，要先判断这个问题背后的教学结构是什么。",
    recommended_answer_direction: "先说明假设和判断，再给出可执行的下一步。",
  };

  return {
    original_question: question,
    ...frame,
  };
}
