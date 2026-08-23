export interface V2DictionaryPresetItem {
  key: string;
  label: string;
  englishName: string;
}

export interface V2DictionaryFieldDefinition {
  key: string;
  name: string;
  description: string;
  fieldPath: string;
  items: V2DictionaryPresetItem[];
}

export const V2_DICTIONARY_FIELD_CATALOG: V2DictionaryFieldDefinition[] = [
  {
    key: "unit_type",
    name: "单元类型",
    description: "用于区分基础建构、实践应用和综合迁移单元。",
    fieldPath: "v2_course_units.unit_type_id",
    items: [
      { key: "foundation", label: "基础建构", englishName: "Foundation" },
      { key: "practice", label: "实践应用", englishName: "Practice" },
      { key: "integration", label: "综合迁移", englishName: "Integration" },
    ],
  },
  {
    key: "lesson_type",
    name: "单课类型",
    description: "用于区分概念课、方法课、案例课和实践课。",
    fieldPath: "v2_course_lessons.lesson_type_id",
    items: [
      { key: "concept", label: "概念课", englishName: "Concept lesson" },
      { key: "method", label: "方法课", englishName: "Method lesson" },
      { key: "case", label: "案例课", englishName: "Case lesson" },
      { key: "practice", label: "实践课", englishName: "Practice lesson" },
    ],
  },
  {
    key: "objective_type",
    name: "教学目标类型",
    description: "由课程编辑人员为每条学习目标显式选择，不依赖 AI 生成。",
    fieldPath: "v2_course_lessons.objectives[].type_id",
    items: [
      { key: "knowledge", label: "知识理解", englishName: "Knowledge and understanding" },
      { key: "skill", label: "技能应用", englishName: "Skill and application" },
      { key: "attitude", label: "态度与价值", englishName: "Attitude and value" },
      { key: "transfer", label: "迁移与创造", englishName: "Transfer and creation" },
    ],
  },
  {
    key: "resource_type",
    name: "资源类型",
    description: "视频、音频、图片、PDF、文档、演示文稿或外链。",
    fieldPath: "v2_lesson_resources.resource_type_id",
    items: [
      { key: "video", label: "视频", englishName: "Video" },
      { key: "audio", label: "音频", englishName: "Audio" },
      { key: "image", label: "图片", englishName: "Image" },
      { key: "pdf", label: "PDF", englishName: "PDF" },
      { key: "document", label: "文档", englishName: "Document" },
      { key: "presentation", label: "演示文稿", englishName: "Presentation" },
      { key: "link", label: "外部链接", englishName: "External link" },
    ],
  },
  {
    key: "resource_usage",
    name: "资源用途",
    description: "标记资源是主要内容、补充材料、参考资料还是任务模板。",
    fieldPath: "v2_lesson_resources.usage_type_id",
    items: [
      { key: "primary", label: "主要内容", englishName: "Primary content" },
      { key: "supplement", label: "补充资料", englishName: "Supplement" },
      { key: "reference", label: "参考资料", englishName: "Reference" },
      { key: "template", label: "任务模板", englishName: "Template" },
    ],
  },
  {
    key: "knowledge_card_type",
    name: "知识卡类型",
    description: "用于区分概念、原理、方法、示例和检查清单。",
    fieldPath: "v2_lesson_knowledge_cards.card_type_id",
    items: [
      { key: "concept", label: "核心概念", englishName: "Core concept" },
      { key: "principle", label: "核心原理", englishName: "Principle" },
      { key: "method", label: "方法步骤", englishName: "Method" },
      { key: "example", label: "示例", englishName: "Example" },
      { key: "checklist", label: "检查清单", englishName: "Checklist" },
    ],
  },
  {
    key: "assessment_type",
    name: "评估区块类型",
    description: "将评估明确区分为前测、课中练习、后测和真实任务。",
    fieldPath: "v2_assessment_blocks.assessment_type_id",
    items: [
      { key: "pretest", label: "前测", englishName: "Pre-assessment" },
      { key: "practice", label: "课中练习", englishName: "Practice" },
      { key: "posttest", label: "后测", englishName: "Post-assessment" },
      { key: "authentic_task", label: "真实任务", englishName: "Authentic task" },
    ],
  },
  {
    key: "item_type",
    name: "试题类型",
    description: "标准化试题和开放性真实任务的题型。",
    fieldPath: "v2_assessment_items.item_type_id",
    items: [
      { key: "single_choice", label: "单选题", englishName: "Single choice" },
      { key: "multiple_choice", label: "多选题", englishName: "Multiple choice" },
      { key: "true_false", label: "判断题", englishName: "True or false" },
      { key: "short_answer", label: "简答题", englishName: "Short answer" },
      { key: "open_task", label: "开放性真实任务", englishName: "Open authentic task" },
    ],
  },
  {
    key: "grading_mode",
    name: "评分方式",
    description: "选择自动评分、教师批阅或混合评分。",
    fieldPath: "v2_assessment_items.grading_mode_id",
    items: [
      { key: "auto", label: "自动评分", englishName: "Automatic grading" },
      { key: "manual", label: "教师批阅", englishName: "Manual review" },
      { key: "hybrid", label: "自动与教师混合", englishName: "Hybrid grading" },
    ],
  },
];

export function getV2DictionaryField(key: string): V2DictionaryFieldDefinition | undefined {
  return V2_DICTIONARY_FIELD_CATALOG.find((field) => field.key === key);
}
