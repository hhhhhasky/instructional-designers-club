/**
 * HAI 统一的学段与学科选项。
 *
 * Work 工具表单（HaiWorkPage）使用教材覆盖映射；onboarding 任课信息采集
 * （HaiProfileOnboardingDialog）保留通用学科列表。两套口径集中维护在此处。
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

/** 公开课设计的学科入口先覆盖主要学科；是否有教材目录由表单运行时另行判断。 */
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

/** 四个 HAI Work 工具共用的学段—学科入口；教材是否已收录由目录请求决定。 */
export const HAI_WORK_SUBJECTS_BY_STAGE: Readonly<Record<string, readonly string[]>> = {
  小学: ["语文", "数学", "英语", "道德与法治", "科学", "信息科技", "心理健康", "音乐", "美术", "体育", "综合实践"],
  初中: ["语文", "数学", "英语", "物理", "化学", "生物", "地理", "历史", "道德与法治", "信息科技", "心理健康", "音乐", "美术", "体育", "综合实践"],
  高中: ["语文", "高中数学 A版", "高中数学 B版", "英语", "物理", "化学", "生物", "地理", "历史", "思想政治", "信息科技", "心理健康", "音乐", "美术", "体育", "综合实践", "通用技术"],
  "其他（中职/高职/高校等）": ["语文", "数学", "英语", "物理", "化学", "生物", "地理", "历史", "思想政治", "信息科技", "心理健康", "音乐", "美术", "体育", "综合实践", "通用技术", "其他 / 专业课"],
};

export function workSubjectsForStage(stage: string): readonly string[] {
  return HAI_WORK_SUBJECTS_BY_STAGE[stage] ?? [];
}

export function publicLessonSubjectsForStage(stage: string): readonly string[] {
  return workSubjectsForStage(stage);
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
