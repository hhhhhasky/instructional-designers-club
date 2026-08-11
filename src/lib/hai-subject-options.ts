/**
 * HAI 统一的学段与学科选项。
 *
 * Work 工具表单（HaiWorkPage）与 onboarding 任课信息采集（HaiProfileOnboardingDialog）
 * 共用此处的常量与联动函数，避免学段/学科列表在多处各写各的、彼此漂移。
 * 新增需要采集学段/学科的功能时，统一从这里取值。
 */

export const HAI_STAGES = [
  "幼儿园",
  "小学",
  "初中",
  "高中",
  "中职",
  "高职",
  "高校",
  "其他",
] as const;

/** 公开课设计学段：内置教材按学段/学科动态匹配，未覆盖时由教师提供教材证据。 */
export const HAI_PUBLIC_LESSON_STAGES = [
  "小学",
  "初中",
  "高中",
  "其他（中职/高职/高校等）",
] as const;

/**
 * 中小学及高校通用学科：覆盖主流考试学科，以及心理健康、体育、综合实践等
 * 非考试学科与「其他 / 专业课」（供专业课教师选用）。
 */
export const HAI_GENERAL_SUBJECTS = [
  "语文",
  "数学",
  "英语",
  "物理",
  "化学",
  "生物",
  "地理",
  "政治 / 道法",
  "历史",
  "科学",
  "信息科技",
  "心理健康",
  "音乐",
  "美术",
  "体育",
  "综合实践",
  "其他 / 专业课",
] as const;

/**
 * 公开课设计使用通用学科列表，同时保留数据库中道法/思想政治的精确学科名。
 * 这样已有思政教材可以直接命中，数学等尚未入库的学科也能先由教师提供教材。
 */
export function publicLessonSubjectsForStage(stage: string): readonly string[] {
  const politicsSubjects = stage === "高中"
    ? ["思想政治"]
    : stage === "小学" || stage === "初中"
      ? ["道德与法治"]
      : ["思想政治", "道德与法治", "其他思政课程"];
  return HAI_GENERAL_SUBJECTS.flatMap((subject) =>
    subject === "政治 / 道法" ? politicsSubjects : [subject]
  );
}

/** 幼儿园五大领域 + 综合主题活动。 */
export const HAI_KINDERGARTEN_SUBJECTS = [
  "语言",
  "健康",
  "社会",
  "科学",
  "艺术",
  "综合主题活动",
  "其他 / 专业课",
] as const;

/**
 * 按学段返回可选学科列表：幼儿园返回五大领域，其余学段返回通用学科。
 * 用于学段切换时联动刷新学科选项。
 */
export function subjectsForStage(stage: string): readonly string[] {
  return stage === "幼儿园" ? HAI_KINDERGARTEN_SUBJECTS : HAI_GENERAL_SUBJECTS;
}
