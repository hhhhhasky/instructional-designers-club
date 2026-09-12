import * as XLSX from "xlsx";

export const V2_IMPORT_SHEET_NAMES = {
  instructions: "使用说明",
  fieldGuide: "字段说明",
  lessons: "课程",
  resources: "资源",
  cards: "知识卡",
  assessments: "评估区块",
  items: "评估题",
} as const;

type ColumnDefinition = {
  key: string;
  header: string;
  description: string;
  required?: boolean;
  example?: string;
  aliases?: string[];
};

const LESSON_COLUMNS: readonly ColumnDefinition[] = [
  { key: "unit_title", header: "单元名称", description: "课程所属的单元名称；相同单元可在多行重复。", required: true, example: "学习目标", aliases: ["unit_title"] },
  { key: "unit_description", header: "单元介绍", description: "单元的简短介绍，供课程目录使用。", example: "理解目标、任务和证据的关系。", aliases: ["unit_description"] },
  { key: "lesson_title", header: "课程标题", description: "一节课在前台显示的标题，也是其他工作表关联课程的依据。", required: true, example: "把目标写成学生能完成的事", aliases: ["lesson_title"] },
  { key: "subtitle", header: "课程副标题", description: "课程标题下的补充说明。", example: "从抽象要求到可观察表现", aliases: ["subtitle"] },
  { key: "description", header: "课程描述", description: "课程简介。", example: "本课帮助你把目标改写为可观察的学习表现。", aliases: ["description"] },
  { key: "lesson_type", header: "课程类型", description: "从数据字典选择中文名称，例如“概念课”“方法课”。可留空。", example: "方法课", aliases: ["lesson_type_key"] },
  { key: "duration_minutes", header: "时长（分钟）", description: "预计完成本课所需分钟数。", example: "30", aliases: ["duration_minutes"] },
  { key: "credits", header: "学分", description: "完成本课后计入学员总学分的数值。", example: "1", aliases: ["credits"] },
  { key: "is_trial", header: "允许试看", description: "填写“是”或“否”；留空默认为“否”。", example: "否", aliases: ["is_trial"] },
  { key: "challenge_title", header: "挑战标题", description: "今天的挑战标题。", example: "把一个模糊目标改清楚", aliases: ["challenge_title"] },
  { key: "challenge_markdown", header: "挑战说明 Markdown", description: "挑战任务的详细说明，可使用 Markdown。", example: "请把\n“理解合作”\n改写成可观察表现。", aliases: ["challenge_markdown"] },
  { key: "objectives", header: "学习目标", description: "每行一个目标，格式为“目标类型｜目标文本”，例如“知识理解｜能解释核心概念”。", example: "知识理解｜能解释核心概念\n技能应用｜能完成目标改写", aliases: ["objectives"] },
  { key: "success_criteria_markdown", header: "达标标准 Markdown", description: "学员完成本课后，什么表现可以算达标。", example: "能写出包含行为、条件和标准的目标。", aliases: ["success_criteria_markdown"] },
  { key: "takeaway_markdown", header: "核心带走内容 Markdown", description: "学员完成课程后需要带走的核心方法或结论。", example: "好目标要能指导任务和评价。", aliases: ["takeaway_markdown"] },
  { key: "body_markdown", header: "正文 Markdown", description: "课程正文内容，可使用标题、列表、引用等 Markdown。", example: "## 为什么要改写目标\n\n正文内容……", aliases: ["body_markdown"] },
];

const RESOURCE_COLUMNS: readonly ColumnDefinition[] = [
  { key: "unit_title", header: "单元名称", description: "填写要关联的单元名称。", required: true, aliases: ["unit_title"] },
  { key: "lesson_title", header: "课程标题", description: "填写要关联的课程标题，必须与“课程”表一致。", required: true, aliases: ["lesson_title"] },
  { key: "title", header: "资源标题", description: "资源在课程中的显示名称。", example: "目标改写示例", aliases: ["title"] },
  { key: "description", header: "资源说明", description: "资源用途或补充说明。", aliases: ["description"] },
  { key: "external_url", header: "资源链接", description: "可访问的 http 或 https 链接；需要上传本地文件时，导入后在课程编辑器中上传。", required: true, example: "https://example.com/resource.pdf", aliases: ["external_url"] },
];

const CARD_COLUMNS: readonly ColumnDefinition[] = [
  { key: "unit_title", header: "单元名称", description: "填写要关联的单元名称。", required: true, aliases: ["unit_title"] },
  { key: "lesson_title", header: "课程标题", description: "填写要关联的课程标题，必须与“课程”表一致。", required: true, aliases: ["lesson_title"] },
  { key: "card_type", header: "知识卡类型", description: "从数据字典填写中文名称，例如“核心概念”“方法步骤”。可留空。", example: "核心概念", aliases: ["card_type_key"] },
  { key: "title", header: "知识卡标题", description: "知识卡的显示标题。", required: true, example: "目标的三个组成部分", aliases: ["title"] },
  { key: "content_markdown", header: "知识卡内容 Markdown", description: "知识卡正文，可使用 Markdown。", required: true, example: "行为 + 条件 + 标准", aliases: ["content_markdown"] },
];

const ASSESSMENT_COLUMNS: readonly ColumnDefinition[] = [
  { key: "unit_title", header: "单元名称", description: "填写要关联的单元名称。", required: true, aliases: ["unit_title"] },
  { key: "lesson_title", header: "课程标题", description: "填写要关联的课程标题，必须与“课程”表一致。", required: true, aliases: ["lesson_title"] },
  { key: "title", header: "评估区块名称", description: "例如前测、课中练习、后测或真实任务的名称，也是“评估题”表的关联依据。", required: true, example: "课后达标测试", aliases: ["title"] },
  { key: "assessment_type", header: "评估类型", description: "从数据字典填写中文名称，例如“前测”“后测”“真实任务”。可留空。", example: "后测", aliases: ["assessment_type_key"] },
  { key: "instructions_markdown", header: "作答说明 Markdown", description: "向学员说明如何完成本评估。", example: "请先独立完成，再提交答案。", aliases: ["instructions_markdown"] },
  { key: "required", header: "是否必做", description: "填写“是”或“否”；留空默认为“否”。", example: "是", aliases: ["required"] },
  { key: "estimated_minutes", header: "预计用时（分钟）", description: "完成该评估区块预计需要的分钟数。", example: "10", aliases: ["estimated_minutes"] },
];

const ITEM_COLUMNS: readonly ColumnDefinition[] = [
  { key: "unit_title", header: "单元名称", description: "填写要关联的单元名称。", required: true, aliases: ["unit_title"] },
  { key: "lesson_title", header: "课程标题", description: "填写要关联的课程标题，必须与“课程”表一致。", required: true, aliases: ["lesson_title"] },
  { key: "assessment_title", header: "评估区块名称", description: "填写要关联的评估区块名称，必须与“评估区块”表一致。", required: true, aliases: ["assessment_key"] },
  { key: "item_type", header: "题型", description: "从数据字典填写中文名称，例如“单选题”“多选题”“判断题”“简答题”。", required: true, example: "单选题", aliases: ["item_type_key"] },
  { key: "grading_mode", header: "评分方式", description: "从数据字典填写中文名称，例如“自动评分”“教师批阅”。", example: "自动评分", aliases: ["grading_mode_key"] },
  { key: "prompt_markdown", header: "题目 Markdown", description: "题干和问题描述，可使用 Markdown。", required: true, example: "下列哪项最符合本课目标？", aliases: ["prompt_markdown"] },
  { key: "case_markdown", header: "情境材料 Markdown", description: "题目前置的案例或真实情境；简答题、真实任务可填写。", aliases: ["case_markdown"] },
  { key: "max_score", header: "最高分", description: "该题最高得分。可留空。", example: "10", aliases: ["max_score"] },
  { key: "rubric", header: "批阅标准", description: "每行写一条批阅标准；主要用于简答题和真实任务。", example: "是否包含关键概念\n是否能结合情境", aliases: ["rubric_json"] },
  { key: "options", header: "选项", description: "选择题填写“A｜选项一；B｜选项二”；非选择题留空。", example: "A｜行为\nB｜态度", aliases: ["options"] },
  { key: "answer_key", header: "正确答案", description: "选择题填写选项字母，例如 A；多选题填写 A,C；非选择题留空。", example: "A", aliases: ["answer_key"] },
];

const ALL_COLUMN_GROUPS = [
  [V2_IMPORT_SHEET_NAMES.lessons, LESSON_COLUMNS],
  [V2_IMPORT_SHEET_NAMES.resources, RESOURCE_COLUMNS],
  [V2_IMPORT_SHEET_NAMES.cards, CARD_COLUMNS],
  [V2_IMPORT_SHEET_NAMES.assessments, ASSESSMENT_COLUMNS],
  [V2_IMPORT_SHEET_NAMES.items, ITEM_COLUMNS],
] as const;

export type V2ImportDictionary = { [groupKey: string]: { keys: Set<string>; labels: Map<string, string> } };
export type V2ImportLessonRow = {
  unit_title: string; unit_description: string | null; lesson_key: string; lesson_title: string; subtitle: string | null; description: string | null; lesson_type_key: string | null; duration_minutes: number | null; credits: number; is_trial: boolean; challenge_title: string | null; challenge_markdown: string | null; objectives: Array<{ type_key: string | null; text: string }>; success_criteria_markdown: string | null; takeaway_markdown: string | null; body_markdown: string | null;
};

export type V2ImportPayload = {
  units: Array<{
      slug: string; title: string; description_markdown: string | null; sort_order: number; lessons: Array<V2ImportLessonRow & {
        resources: Array<{ title: string | null; description: string | null; external_url: string; sort_order: number }>;
        cards: Array<{ card_type_key: string | null; title: string; content_markdown: string; sort_order: number }>;
        assessments: Array<{ key: string; assessment_type_key: string | null; title: string; instructions_markdown: string | null; required: boolean; estimated_minutes: number | null; sort_order: number; items: Array<{ item_type_key: string | null; grading_mode_key: string | null; prompt_markdown: string; case_markdown: string | null; max_score: number | null; rubric: Record<string, unknown> | null; is_required: boolean; sort_order: number; options: Array<{ key: string; text: string; sort_order: number }>; answer_key: { correct: string[] } | null }> }>;
      }>;
  }>;
};

export type V2ImportIssue = { sheet: string; row: number; message: string };
export type V2ImportParseResult = { payload: V2ImportPayload | null; lessonCount: number; resourceCount: number; cardCount: number; assessmentCount: number; itemCount: number; issues: V2ImportIssue[] };
type RawRow = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function nullableText(value: unknown): string | null {
  const result = text(value);
  return result || null;
}

function linkKey(unitTitle: string, lessonTitle: string): string {
  return [unitTitle, lessonTitle].map((value) => text(value)).join("\u0001");
}

function numberValue(value: unknown, sheet: string, row: number, label: string, issues: V2ImportIssue[], options: { integer?: boolean; defaultValue?: number } = {}): number | null {
  const raw = text(value);
  if (!raw) return options.defaultValue ?? null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || (options.integer && !Number.isInteger(parsed))) {
    issues.push({ sheet, row, message: `${label}必须是${options.integer ? "整数" : "数字"}` });
    return null;
  }
  return parsed;
}

function booleanValue(value: unknown, defaultValue: boolean): boolean {
  const raw = text(value).toLowerCase();
  if (!raw) return defaultValue;
  return ["true", "1", "yes", "y", "是", "允许", "必做"].includes(raw);
}

function dictionaryValue(dictionary: V2ImportDictionary, groupKey: string, value: unknown, sheet: string, row: number, label: string, issues: V2ImportIssue[]): string | null {
  const raw = text(value);
  if (!raw) return null;
  const group = dictionary[groupKey];
  const key = group?.keys.has(raw) ? raw : group?.labels.get(raw);
  if (!key) issues.push({ sheet, row, message: `${label}“${raw}”不在数据字典中，请填写中文名称` });
  return key ?? null;
}

function rows(workbook: XLSX.WorkBook, sheetName: string, columns: readonly ColumnDefinition[], issues: V2ImportIssue[]): RawRow[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    issues.push({ sheet: sheetName, row: 1, message: "缺少工作表，请使用最新模板" });
    return [];
  }
  const headerRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false });
  const header = (headerRows[0] ?? []).map((value) => text(value));
  const headerMap = new Map<string, string>();
  columns.forEach((column) => [column.header, column.key, ...(column.aliases ?? [])].forEach((alias) => headerMap.set(alias, column.key)));
  const missing = columns.filter((column) => column.required && !header.includes(column.header) && !(column.aliases ?? []).some((alias) => header.includes(alias)));
  if (missing.length) {
    issues.push({ sheet: sheetName, row: 1, message: `缺少必填列：${missing.map((column) => column.header).join("、")}` });
    return [];
  }
  return XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "", raw: false, blankrows: false }).map((row) => {
    const normalized: RawRow = {};
    Object.entries(row).forEach(([column, value]) => {
      const key = headerMap.get(column);
      if (key) normalized[key] = value;
    });
    return normalized;
  }).filter((row) => Object.values(row).some((value) => text(value)));
}

function parseObjectives(value: unknown, dictionary: V2ImportDictionary, sheet: string, row: number, issues: V2ImportIssue[]): Array<{ type_key: string | null; text: string }> {
  return text(value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const match = line.match(/^([^|｜]+)[|｜](.*)$/);
    if (!match) {
      issues.push({ sheet, row, message: "学习目标每行需要使用“目标类型｜目标文本”格式" });
      return { type_key: null, text: line };
    }
    const typeKey = dictionaryValue(dictionary, "objective_type", match[1], sheet, row, "目标类型", issues);
    const objectiveText = match[2].trim();
    if (!objectiveText) issues.push({ sheet, row, message: "学习目标文本不能为空" });
    return { type_key: typeKey, text: objectiveText };
  });
}

function parseOptions(value: unknown, sheet: string, row: number, issues: V2ImportIssue[]): Array<{ key: string; text: string; sort_order: number }> {
  return text(value).split(/\r?\n|[;；]/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const match = line.match(/^([^|｜]+)[|｜](.*)$/);
    if (!match) {
      issues.push({ sheet, row, message: "选项需要使用“A｜选项文本；B｜选项文本”格式" });
      return { key: line, text: line, sort_order: index };
    }
    return { key: match[1].trim(), text: match[2].trim(), sort_order: index };
  });
}

function parseRubric(value: unknown): Record<string, unknown> | null {
  const raw = text(value);
  if (!raw) return null;
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      // Plain text remains the normal authoring path.
    }
  }
  return { criteria: raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) };
}

export async function parseV2CourseWorkbook(arrayBuffer: ArrayBuffer, dictionary: V2ImportDictionary = {}): Promise<V2ImportParseResult> {
  const issues: V2ImportIssue[] = [];
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: false });
  } catch {
    return { payload: null, lessonCount: 0, resourceCount: 0, cardCount: 0, assessmentCount: 0, itemCount: 0, issues: [{ sheet: "文件", row: 1, message: "无法读取 Excel 文件，请使用 .xlsx 或 .xls 模板" }] };
  }
  const lessonRows = rows(workbook, V2_IMPORT_SHEET_NAMES.lessons, LESSON_COLUMNS, issues);
  const resourceRows = rows(workbook, V2_IMPORT_SHEET_NAMES.resources, RESOURCE_COLUMNS, issues);
  const cardRows = rows(workbook, V2_IMPORT_SHEET_NAMES.cards, CARD_COLUMNS, issues);
  const assessmentRows = rows(workbook, V2_IMPORT_SHEET_NAMES.assessments, ASSESSMENT_COLUMNS, issues);
  const itemRows = rows(workbook, V2_IMPORT_SHEET_NAMES.items, ITEM_COLUMNS, issues);
  if (lessonRows.length === 0) issues.push({ sheet: V2_IMPORT_SHEET_NAMES.lessons, row: 2, message: "至少填写一节课程" });

  const units = new Map<string, V2ImportPayload["units"][number]>();
  const lessons = new Map<string, V2ImportPayload["units"][number]["lessons"][number]>();
  const assessments = new Map<string, V2ImportPayload["units"][number]["lessons"][number]["assessments"][number]>();

  lessonRows.forEach((row, index) => {
    const sheetRow = index + 2;
    const unitTitle = text(row.unit_title);
    const lessonTitle = text(row.lesson_title);
    if (!unitTitle || !lessonTitle) {
      issues.push({ sheet: V2_IMPORT_SHEET_NAMES.lessons, row: sheetRow, message: "单元名称、课程标题均不能为空" });
      return;
    }
    const reference = linkKey(unitTitle, lessonTitle);
    if (lessons.has(reference)) {
      issues.push({ sheet: V2_IMPORT_SHEET_NAMES.lessons, row: sheetRow, message: `“${unitTitle} / ${lessonTitle}”重复，课程关联名称必须唯一` });
      return;
    }
    const lessonTypeKey = dictionaryValue(dictionary, "lesson_type", row.lesson_type, V2_IMPORT_SHEET_NAMES.lessons, sheetRow, "课程类型", issues);
    const duration = numberValue(row.duration_minutes, V2_IMPORT_SHEET_NAMES.lessons, sheetRow, "时长", issues, { integer: true });
    const credits = numberValue(row.credits, V2_IMPORT_SHEET_NAMES.lessons, sheetRow, "学分", issues, { defaultValue: 0 });
    if (duration != null && duration < 0) issues.push({ sheet: V2_IMPORT_SHEET_NAMES.lessons, row: sheetRow, message: "时长不能小于 0" });
    if (credits != null && credits < 0) issues.push({ sheet: V2_IMPORT_SHEET_NAMES.lessons, row: sheetRow, message: "学分不能小于 0" });
    const objectives = parseObjectives(row.objectives, dictionary, V2_IMPORT_SHEET_NAMES.lessons, sheetRow, issues);
    let unit = units.get(unitTitle);
    if (!unit) unit = { slug: `unit-${units.size + 1}`, title: unitTitle, description_markdown: nullableText(row.unit_description), sort_order: units.size, lessons: [] };
    else if (unit.description_markdown !== nullableText(row.unit_description) && nullableText(row.unit_description)) issues.push({ sheet: V2_IMPORT_SHEET_NAMES.lessons, row: sheetRow, message: `单元“${unitTitle}”的单元介绍不一致，请统一填写` });
    const lesson = {
      unit_title: unitTitle, unit_description: nullableText(row.unit_description), lesson_key: `lesson-${lessons.size + 1}`, lesson_title: lessonTitle, subtitle: nullableText(row.subtitle), description: nullableText(row.description), lesson_type_key: lessonTypeKey, duration_minutes: duration, credits: credits ?? 0, is_trial: booleanValue(row.is_trial, false), challenge_title: nullableText(row.challenge_title), challenge_markdown: nullableText(row.challenge_markdown), objectives, success_criteria_markdown: nullableText(row.success_criteria_markdown), takeaway_markdown: nullableText(row.takeaway_markdown), body_markdown: nullableText(row.body_markdown), resources: [], cards: [], assessments: [],
    } satisfies V2ImportPayload["units"][number]["lessons"][number];
    unit.lessons.push(lesson);
    lessons.set(reference, lesson);
    units.set(unitTitle, unit);
  });

  resourceRows.forEach((row, index) => {
    const sheetRow = index + 2;
    const lesson = lessons.get(linkKey(text(row.unit_title), text(row.lesson_title)));
    const url = text(row.external_url);
    if (!lesson) issues.push({ sheet: V2_IMPORT_SHEET_NAMES.resources, row: sheetRow, message: "找不到对应课程，请检查单元名称和课程标题" });
    if (!url) issues.push({ sheet: V2_IMPORT_SHEET_NAMES.resources, row: sheetRow, message: "资源链接不能为空" });
    if (url) {
      try {
        const parsedUrl = new URL(url);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("protocol");
      } catch {
        issues.push({ sheet: V2_IMPORT_SHEET_NAMES.resources, row: sheetRow, message: "资源链接只支持 http 或 https" });
      }
    }
    if (lesson && url) lesson.resources.push({ title: nullableText(row.title), description: nullableText(row.description), external_url: url, sort_order: lesson.resources.length });
  });

  cardRows.forEach((row, index) => {
    const sheetRow = index + 2;
    const lesson = lessons.get(linkKey(text(row.unit_title), text(row.lesson_title)));
    const title = text(row.title);
    const content = text(row.content_markdown);
    if (!lesson) issues.push({ sheet: V2_IMPORT_SHEET_NAMES.cards, row: sheetRow, message: "找不到对应课程，请检查单元名称和课程标题" });
    if (!title || !content) issues.push({ sheet: V2_IMPORT_SHEET_NAMES.cards, row: sheetRow, message: "知识卡标题和内容不能为空" });
    const cardTypeKey = dictionaryValue(dictionary, "knowledge_card_type", row.card_type, V2_IMPORT_SHEET_NAMES.cards, sheetRow, "知识卡类型", issues);
    if (lesson && title && content) lesson.cards.push({ card_type_key: cardTypeKey, title, content_markdown: content, sort_order: lesson.cards.length });
  });

  assessmentRows.forEach((row, index) => {
    const sheetRow = index + 2;
    const lesson = lessons.get(linkKey(text(row.unit_title), text(row.lesson_title)));
    const title = text(row.title);
    if (!lesson) issues.push({ sheet: V2_IMPORT_SHEET_NAMES.assessments, row: sheetRow, message: "找不到对应课程，请检查单元名称和课程标题" });
    if (!title) issues.push({ sheet: V2_IMPORT_SHEET_NAMES.assessments, row: sheetRow, message: "评估区块名称不能为空" });
    const assessmentReference = `${linkKey(text(row.unit_title), text(row.lesson_title))}\u0001${title}`;
    if (assessments.has(assessmentReference)) issues.push({ sheet: V2_IMPORT_SHEET_NAMES.assessments, row: sheetRow, message: `评估区块“${title}”重复，请使用不同名称` });
    const assessmentTypeKey = dictionaryValue(dictionary, "assessment_type", row.assessment_type, V2_IMPORT_SHEET_NAMES.assessments, sheetRow, "评估类型", issues);
    const estimatedMinutes = numberValue(row.estimated_minutes, V2_IMPORT_SHEET_NAMES.assessments, sheetRow, "评估用时", issues, { integer: true });
    if (lesson && title) {
      const assessment = { key: `assessment-${assessments.size + 1}`, assessment_type_key: assessmentTypeKey, title, instructions_markdown: nullableText(row.instructions_markdown), required: booleanValue(row.required, false), estimated_minutes: estimatedMinutes, sort_order: lesson.assessments.length, items: [] } satisfies V2ImportPayload["units"][number]["lessons"][number]["assessments"][number];
      lesson.assessments.push(assessment);
      assessments.set(assessmentReference, assessment);
    }
  });

  itemRows.forEach((row, index) => {
    const sheetRow = index + 2;
    const assessment = assessments.get(`${linkKey(text(row.unit_title), text(row.lesson_title))}\u0001${text(row.assessment_title)}`);
    if (!assessment) issues.push({ sheet: V2_IMPORT_SHEET_NAMES.items, row: sheetRow, message: "找不到对应评估区块，请检查四个关联名称" });
    const prompt = text(row.prompt_markdown);
    if (!prompt) issues.push({ sheet: V2_IMPORT_SHEET_NAMES.items, row: sheetRow, message: "题目不能为空" });
    const itemTypeKey = dictionaryValue(dictionary, "item_type", row.item_type, V2_IMPORT_SHEET_NAMES.items, sheetRow, "题型", issues);
    const gradingModeKey = dictionaryValue(dictionary, "grading_mode", row.grading_mode, V2_IMPORT_SHEET_NAMES.items, sheetRow, "评分方式", issues);
    const maxScore = numberValue(row.max_score, V2_IMPORT_SHEET_NAMES.items, sheetRow, "最高分", issues);
    const options = parseOptions(row.options, V2_IMPORT_SHEET_NAMES.items, sheetRow, issues);
    const answerKeys = text(row.answer_key).split(",").map((value) => value.trim()).filter(Boolean);
    if (assessment && prompt) assessment.items.push({ item_type_key: itemTypeKey, grading_mode_key: gradingModeKey, prompt_markdown: prompt, case_markdown: nullableText(row.case_markdown), max_score: maxScore, rubric: parseRubric(row.rubric), is_required: true, sort_order: assessment.items.length, options, answer_key: answerKeys.length ? { correct: answerKeys } : null });
  });

  return { payload: issues.length ? null : { units: [...units.values()] }, lessonCount: lessons.size, resourceCount: resourceRows.length, cardCount: cardRows.length, assessmentCount: assessments.size, itemCount: itemRows.length, issues };
}

export function buildV2ImportDictionary(groups: Array<{ id: string; key: string }>, items: Array<{ group_id: string; key: string; label: string }>): V2ImportDictionary {
  return Object.fromEntries(groups.map((group) => [group.key, { keys: new Set(items.filter((item) => item.group_id === group.id).map((item) => item.key)), labels: new Map(items.filter((item) => item.group_id === group.id).map((item) => [item.label.trim(), item.key])) }]));
}

export const V2_IMPORT_COLUMNS = Object.fromEntries(ALL_COLUMN_GROUPS) as Record<string, readonly ColumnDefinition[]>;
