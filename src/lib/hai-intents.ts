const INTENT_LABELS: Record<string, string> = {
  showcase_lesson_diagnosis: "展示赛课诊断",
  showcase_lesson_design: "展示赛课设计",
  daily_improvement_diagnosis: "日常提分诊断",
  daily_improvement_design: "日常提分设计",
  teaching_concept_qa: "教学概念答疑",
  unknown: "意图不明确",
};

const SCENE_LABELS: Record<string, string> = {
  public_lesson: "公开课",
  lesson_presentation: "说课",
  competition_lesson: "赛课",
  daily_lesson: "日常课",
  review_lesson: "复习课",
  exam_review: "试卷讲评",
  general_teaching: "一般教学",
  unclear: "场景不明确",
};

const USER_GOAL_LABELS: Record<string, string> = {
  diagnosis: "诊断修改",
  design_support: "设计支持",
  concept_qa: "概念答疑",
  unclear: "目的不明确",
};

const SUPPORT_DEPTH_LABELS: Record<string, string> = {
  advice: "判断建议",
  ideas: "设计思路",
  demonstration: "局部示范",
};

function labelOf(labels: Record<string, string>, value: string) {
  return labels[value] ?? (value || "-");
}

export function haiIntentLabel(value: string) {
  return labelOf(INTENT_LABELS, value);
}

export function haiSceneLabel(value: string) {
  return labelOf(SCENE_LABELS, value);
}

export function haiUserGoalLabel(value: string) {
  return labelOf(USER_GOAL_LABELS, value);
}

export function haiSupportDepthLabel(value: string) {
  return labelOf(SUPPORT_DEPTH_LABELS, value);
}
