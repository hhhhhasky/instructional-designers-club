export type HaiWorkToolSlug =
  | "lesson-diagnosis"
  | "segment-optimization"
  | "subject-lesson-design";

export type WorkSkillCandidate = {
  id: string;
  slug: string;
  name: string;
  description: string;
  match_criteria: Record<string, unknown>;
  priority: number;
  is_fallback: boolean;
  version: {
    id: string;
    version_label: string;
    prompt_template: string;
    input_contract: Record<string, unknown>;
    output_contract: Record<string, unknown>;
  };
};

const toolSlugs = new Set<HaiWorkToolSlug>([
  "lesson-diagnosis",
  "segment-optimization",
  "subject-lesson-design",
]);

export function isHaiWorkToolSlug(value: string): value is HaiWorkToolSlug {
  return toolSlugs.has(value as HaiWorkToolSlug);
}

export function validateWorkInput(
  toolSlug: HaiWorkToolSlug,
  input: Record<string, unknown>,
  materialCount: number,
) {
  const requiredByTool: Record<HaiWorkToolSlug, string[]> = {
    "lesson-diagnosis": ["stage", "subject", "topic"],
    "segment-optimization": [
      "stage",
      "subject",
      "topic",
      "segment_type",
      "current_design",
      "desired_outcome",
    ],
    "subject-lesson-design": [
      "stage",
      "subject",
      "grade",
      "volume",
      "unit",
      "topic",
      "lesson_type",
    ],
  };

  for (const key of requiredByTool[toolSlug]) {
    if (!String(input[key] ?? "").trim()) {
      throw new Error(`请填写${fieldLabel(key)}。`);
    }
  }

  if (
    toolSlug === "lesson-diagnosis" &&
    !String(input.lesson_plan ?? "").trim() &&
    materialCount === 0
  ) {
    throw new Error("请粘贴教案正文或上传教案文件。");
  }

}

export function selectWorkSkill(
  candidates: WorkSkillCandidate[],
  input: Record<string, unknown>,
): WorkSkillCandidate | null {
  const matching = candidates
    .filter((candidate) => !candidate.is_fallback && matchesCriteria(candidate.match_criteria, input))
    .sort((a, b) => {
      const specificity = criteriaSpecificity(b.match_criteria) - criteriaSpecificity(a.match_criteria);
      if (specificity !== 0) return specificity;
      return b.priority - a.priority;
    });
  return matching[0] ?? candidates
    .filter((candidate) => candidate.is_fallback)
    .sort((a, b) => b.priority - a.priority)[0] ?? null;
}

export function parseWorkJson(text: string): Record<string, unknown> | null {
  const source = text.trim();
  if (!source) return null;
  for (const candidate of [source, source.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")]) {
    try {
      const parsed = JSON.parse(candidate);
      if (isRecord(parsed)) return parsed;
    } catch {
      // Continue to balanced-object extraction.
    }
  }

  const start = source.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      try {
        const parsed = JSON.parse(source.slice(start, index + 1));
        return isRecord(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function validateWorkOutput(
  value: Record<string, unknown>,
  outputContract: Record<string, unknown>,
) {
  const required = Array.isArray(outputContract.required)
    ? outputContract.required.map(String)
    : [];
  const missing = required.filter((key) => value[key] === undefined || value[key] === null);
  if (missing.length > 0) {
    throw new Error(`AI 产物缺少必要字段：${missing.join("、")}。`);
  }

  if (outputContract.format === "lesson_diagnosis_v1") {
    if (!Array.isArray(value.elements) || value.elements.length !== 7) {
      throw new Error("教案诊断必须完整返回七个教学设计要素。");
    }
    const expectedElements = ["教材分析", "学情分析", "教学目标", "教学重难点", "教学环节", "教学评估", "教学反思"];
    const minimumCriteria = [3, 3, 5, 1, 3, 2, 1];
    const elements = value.elements as unknown[];
    elements.forEach((element, index) => {
      if (!isRecord(element) || normalizeElementName(element.name) !== expectedElements[index]) {
        throw new Error(`教案诊断第 ${index + 1} 项必须是“${expectedElements[index]}”。`);
      }
      if (!isScore(element.qualityScore)) {
        throw new Error(`“${expectedElements[index]}”缺少有效的质量评分。`);
      }
      if (!Array.isArray(element.criteria) || element.criteria.length < minimumCriteria[index]) {
        throw new Error(`“${expectedElements[index]}”的评价指标不完整。`);
      }
    });
    const diagnosis = isRecord(value.systemDiagnosis) ? value.systemDiagnosis : {};
    const relations = ["alignment", "objectiveSource", "difficultyCoverage", "studentResponsiveness"];
    if (relations.some((key) => !isRecord(diagnosis[key]))) {
      throw new Error("教案诊断必须完整返回四项系统关系诊断。");
    }
    if (!isScore(value.overallScore)) throw new Error("教案诊断缺少有效的综合评分。");
    if (!Array.isArray(value.suggestions) || value.suggestions.length < 3 || value.suggestions.length > 6) {
      throw new Error("教案诊断必须返回 3-6 条优先修改建议。");
    }
  }
}

function normalizeElementName(value: unknown) {
  return String(value ?? "").replace(/[📖👥🎯🔑📋📊💭\s]/gu, "");
}

function isScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

export function renderWorkMarkdown(
  toolSlug: HaiWorkToolSlug,
  artifact: Record<string, unknown>,
): string {
  if (toolSlug === "lesson-diagnosis") return renderDiagnosis(artifact);
  if (toolSlug === "segment-optimization") return renderSegment(artifact);
  return renderLessonDesign(artifact);
}

export function buildWorkPrompt(params: {
  toolSlug: HaiWorkToolSlug;
  input: Record<string, unknown>;
  skill: WorkSkillCandidate;
  materialContext: string;
  textbookContext?: string;
  previousMarkdown?: string;
  revisionInstruction?: string;
}) {
  const fallbackNotice = params.skill.is_fallback
    ? "当前使用通用 Skill。不得把一般知识伪装成教材中的具体事实。"
    : "当前已匹配专属 Skill。仍须遵守教材事实边界。";
  const system = [
    params.skill.version.prompt_template,
    fallbackNotice,
    params.textbookContext
      ? "内置教材内容是教师整理的知识点梳理，不是教材逐字原文。必须按版本、单元、课题和框题使用；若标注待复核，须在产物中显式提醒。用户补充的教材原文与内置梳理冲突时，以用户补充内容为准。"
      : "没有命中的内置教材内容时，不得依据课名猜测教材事实。",
    `输出契约：${JSON.stringify(params.skill.version.output_contract)}`,
    "只输出一个合法 JSON 对象，不要输出代码围栏或额外说明。",
  ].join("\n\n");

  const user = [
    "## 任务输入",
    JSON.stringify(params.input, null, 2),
    params.textbookContext ? `## 内置教材知识库（精确命中）\n${params.textbookContext}` : "",
    params.materialContext ? `## 用户指定材料\n${params.materialContext}` : "",
    params.previousMarkdown ? `## 上一版产物\n${params.previousMarkdown}` : "",
    params.revisionInstruction ? `## 本轮追改要求\n${params.revisionInstruction}` : "",
  ].filter(Boolean).join("\n\n");
  return { system, user };
}

function matchesCriteria(criteria: Record<string, unknown>, input: Record<string, unknown>) {
  const mappings: Array<[string, string]> = [
    ["stages", "stage"],
    ["subjects", "subject"],
    ["lesson_types", "lesson_type"],
  ];
  return mappings.every(([criteriaKey, inputKey]) => {
    const allowed = Array.isArray(criteria[criteriaKey])
      ? (criteria[criteriaKey] as unknown[]).map(normalizeMatchText).filter(Boolean)
      : [];
    if (allowed.length === 0) return true;
    const actual = normalizeMatchText(input[inputKey]);
    return allowed.some((item) => actual.includes(item) || item.includes(actual));
  });
}

function criteriaSpecificity(criteria: Record<string, unknown>) {
  return ["stages", "subjects", "lesson_types"]
    .filter((key) => Array.isArray(criteria[key]) && (criteria[key] as unknown[]).length > 0)
    .length;
}

function normalizeMatchText(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

function fieldLabel(key: string) {
  return ({
    stage: "学段",
    subject: "学科",
    grade: "年级",
    volume: "册次",
    unit: "单元",
    topic: "课题",
    frame: "框题",
    lesson_type: "课型",
    segment_type: "环节类型",
    current_design: "当前设计",
    desired_outcome: "希望达成的效果",
  } as Record<string, string>)[key] ?? key;
}

function renderDiagnosis(value: Record<string, unknown>) {
  const lines = [
    `# ${stringValue(value.overallGrade, "教案诊断报告")} · ${numberValue(value.overallScore)}/100`,
    "",
    stringValue(value.overallSummary),
    "",
    "## 七要素诊断",
  ];
  for (const element of arrayRecords(value.elements)) {
    lines.push(
      "",
      `### ${stringValue(element.icon)} ${stringValue(element.name)} · ${numberValue(element.qualityScore)} 分`,
      stringValue(element.improvement),
    );
    for (const criterion of arrayRecords(element.criteria)) {
      lines.push(`- **${stringValue(criterion.name)}（${numberValue(criterion.score)}）**：${stringValue(criterion.comment)}`);
    }
  }
  const system = isRecord(value.systemDiagnosis) ? value.systemDiagnosis : {};
  lines.push("", "## 系统关系诊断");
  for (const [key, label] of [
    ["alignment", "教学评一致性"],
    ["objectiveSource", "教学目标来源"],
    ["difficultyCoverage", "重难点与环节对应"],
    ["studentResponsiveness", "学情回应度"],
  ]) {
    const item = isRecord(system[key]) ? system[key] as Record<string, unknown> : {};
    lines.push("", `### ${label} · ${numberValue(item.score)} 分`, stringValue(item.finding), stringValue(item.evidence));
  }
  lines.push("", "## 优先修改建议");
  arrayRecords(value.suggestions).forEach((item, index) => {
    const rewrite = isRecord(item.rewrite) ? item.rewrite : {};
    lines.push(
      "",
      `### ${index + 1}. ${stringValue(item.title)}`,
      stringValue(item.rationale),
      `**第一步：** ${stringValue(item.action)}`,
      stringValue(rewrite.improved) ? `**改写示范：** ${stringValue(rewrite.improved)}` : "",
    );
  });
  return lines.filter((line, index, all) => line !== "" || all[index - 1] !== "").join("\n").trim();
}

function renderSegment(value: Record<string, unknown>) {
  return [
    `# ${stringValue(value.summary, "教学环节优化方案")}`,
    "",
    "## 核心问题",
    stringValue(value.core_problem),
    "",
    "## 优化原则",
    bulletList(value.principles),
    "",
    "## 优化后的环节",
    stringValue(value.optimized_segment),
    "",
    "## 教师行动",
    bulletList(value.teacher_actions),
    "",
    "## 学生行动",
    bulletList(value.student_actions),
    "",
    "## 时间安排",
    stringValue(value.time_plan),
    "",
    "## 学习证据",
    bulletList(value.learning_evidence),
    "",
    "## 为什么这样改",
    stringValue(value.rationale),
    "",
    "## 使用提醒",
    bulletList(value.cautions),
  ].join("\n").trim();
}

function renderLessonDesign(value: Record<string, unknown>) {
  const lines = [
    `# ${stringValue(value.title, "思政公开课教案")}`,
    "",
    "## 设计理念",
    stringValue(value.design_rationale),
    "",
    "## 教材分析",
    stringValue(value.textbook_analysis),
    "",
    "## 学情分析",
    stringValue(value.learner_analysis),
    "",
    "## 教学目标",
    bulletList(value.objectives),
    "",
    "## 教学重点",
    bulletList(value.key_points),
    "",
    "## 教学难点",
    bulletList(value.difficult_points),
    "",
    "## 达标证据",
    bulletList(value.learning_evidence),
    "",
    "## 教学流程",
  ];
  arrayRecords(value.lesson_flow).forEach((item, index) => {
    lines.push(
      "",
      `### ${index + 1}. ${stringValue(item.stage)} · ${stringValue(item.minutes)} 分钟`,
      `**教师行动：** ${listInline(item.teacher_actions)}`,
      `**学生行动：** ${listInline(item.student_actions)}`,
      `**学习证据：** ${stringValue(item.evidence)}`,
    );
  });
  lines.push(
    "",
    "## 评价设计",
    valueToText(value.assessment),
    "",
    "## 差异化支持",
    valueToText(value.differentiation),
    "",
    "## 教学资源",
    bulletList(value.resources),
    "",
    "## 作业设计",
    valueToText(value.homework),
    "",
    "## 课后反思问题",
    bulletList(value.reflection_prompts),
    "",
    "## 材料边界",
    bulletList(value.limitations),
  );
  return lines.join("\n").trim();
}

function bulletList(value: unknown) {
  const items = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  return items.map((item) => `- ${valueToText(item)}`).join("\n") || "- 暂无";
}

function listInline(value: unknown) {
  const items = Array.isArray(value) ? value : [value];
  return items.map(valueToText).filter(Boolean).join("；");
}

function valueToText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(valueToText).join("；");
  if (isRecord(value)) {
    return Object.entries(value).map(([key, item]) => `${key}：${valueToText(item)}`).join("；");
  }
  return "";
}

function stringValue(value: unknown, fallback = "") {
  const result = valueToText(value).trim();
  return result || fallback;
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function arrayRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
