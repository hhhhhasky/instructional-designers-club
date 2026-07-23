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
    snapshot_hash?: string;
    source_metadata?: Record<string, unknown>;
    references?: WorkSkillReference[];
  };
};

export type WorkSkillReference = {
  id: string;
  path: string;
  name: string;
  description: string;
  media_type: string;
  content: string;
  content_hash: string;
  load_mode: "always" | "case" | "issue" | "task" | "evaluation_only";
  max_chars: number;
  sort_order: number;
  metadata: Record<string, unknown>;
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
      "teaching_mode",
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
    .filter((candidate) => matchesCriteria(candidate.match_criteria, input))
    .sort((a, b) => {
      const specificity = criteriaSpecificity(b.match_criteria) - criteriaSpecificity(a.match_criteria);
      if (specificity !== 0) return specificity;
      if (a.is_fallback !== b.is_fallback) return a.is_fallback ? 1 : -1;
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

  if (outputContract.format === "sizheng_public_lesson_v2") {
    validatePoliticsLessonOutput(value, outputContract);
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
  const selectedReferences = selectWorkSkillReferences(params.skill, params.input);
  const referenceContext = selectedReferences.map((reference) =>
    `### ${reference.path}\n${reference.content.slice(0, reference.max_chars)}`
  ).join("\n\n");
  const fallbackNotice = params.skill.is_fallback
    ? "当前使用通用 Skill。不得把一般知识伪装成教材中的具体事实。"
    : "当前已匹配专属 Skill。仍须遵守教材事实边界。";
  const system = [
    params.skill.version.prompt_template,
    fallbackNotice,
    params.textbookContext
      ? "精确命中的内置教材知识点梳理可作为本次设计的教材事实依据，无需再要求用户上传教材；它不是教材逐字原文。必须按版本、单元、课题和框题使用；若标注待复核，须在产物中显式提醒。用户补充的教材原文与内置梳理冲突时，以用户补充内容为准。"
      : "没有命中的内置教材内容时，不得依据课名猜测教材事实。",
    selectedReferences.length > 0
      ? `用户已选择“${String(params.input.teaching_mode ?? "")}”作为唯一主导模式。只执行对应 V3 模板，不得混用另外两套主流程。`
      : "当前 Skill 没有加载模式 reference，不得声称使用了对应 V3 模板。",
    `输出契约：${JSON.stringify(params.skill.version.output_contract)}`,
    "只输出一个合法 JSON 对象，不要输出代码围栏或额外说明。",
  ].join("\n\n");

  const user = [
    "## 任务输入",
    JSON.stringify(params.input, null, 2),
    referenceContext ? `## Skill 版本化参考资料\n${referenceContext}` : "",
    params.textbookContext ? `## 内置教材知识库（精确命中）\n${params.textbookContext}` : "",
    params.materialContext ? `## 用户指定材料\n${params.materialContext}` : "",
    params.previousMarkdown ? `## 上一版产物\n${params.previousMarkdown}` : "",
    params.revisionInstruction ? `## 本轮追改要求\n${params.revisionInstruction}` : "",
  ].filter(Boolean).join("\n\n");
  return { system, user };
}

export function selectWorkSkillReferences(
  skill: WorkSkillCandidate,
  input: Record<string, unknown>,
) {
  const mode = ({
    "案例式": "case",
    "议题式": "issue",
    "任务式": "task",
  } as Record<string, WorkSkillReference["load_mode"]>)[String(input.teaching_mode ?? "").trim()];
  return [...(skill.version.references ?? [])]
    .filter((reference) =>
      reference.load_mode === "always" || (mode && reference.load_mode === mode)
    )
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function assertWorkSkillRuntimeReady(
  skill: WorkSkillCandidate,
  input: Record<string, unknown>,
) {
  if (skill.version.output_contract.format !== "sizheng_public_lesson_v2") return;
  const selected = selectWorkSkillReferences(skill, input);
  const selectedPaths = new Set(selected.map((item) => item.path));
  const commonPaths = [
    "references/mode-selection.md",
    "references/carrier-selection.md",
    "references/output-template.md",
  ];
  const missingCommon = commonPaths.filter((path) => !selectedPaths.has(path));
  if (missingCommon.length > 0) {
    throw new Error(`思政公开课 Skill 缺少必需 reference：${missingCommon.join("、")}。`);
  }
  const modePath = ({
    "案例式": "references/case-mode-v3.md",
    "议题式": "references/issue-mode-v3.md",
    "任务式": "references/task-mode-v3.md",
  } as Record<string, string>)[String(input.teaching_mode ?? "").trim()];
  if (!modePath || !selectedPaths.has(modePath)) {
    throw new Error("所选教学模式模板未加载，已停止生成。");
  }
  const loadedModeReferences = selected.filter((item) =>
    item.load_mode === "case" || item.load_mode === "issue" || item.load_mode === "task"
  );
  if (loadedModeReferences.length !== 1 || loadedModeReferences[0].path !== modePath) {
    throw new Error("教学模式 reference 加载不唯一，已停止生成。");
  }
}

export function applyWorkOutputRuntimeTrace(
  value: Record<string, unknown>,
  skill: WorkSkillCandidate,
  input: Record<string, unknown>,
  textbookSourcePaths: string[],
) {
  if (skill.version.output_contract.format !== "sizheng_public_lesson_v2") return value;
  const basicInfo = isRecord(value.basic_info) ? value.basic_info : {};
  const modeReference = selectWorkSkillReferences(skill, input).find((reference) =>
    reference.load_mode === "case" || reference.load_mode === "issue" || reference.load_mode === "task"
  );
  return {
    ...value,
    basic_info: {
      ...basicInfo,
      teaching_mode: String(input.teaching_mode ?? "").trim(),
      textbook_source_path: textbookSourcePaths.filter(Boolean).join("；"),
      mode_template_path: modeReference?.path ?? "",
    },
  };
}

function matchesCriteria(criteria: Record<string, unknown>, input: Record<string, unknown>) {
  const mappings: Array<[string, string]> = [
    ["stages", "stage"],
    ["subjects", "subject"],
    ["lesson_types", "lesson_type"],
    ["teaching_modes", "teaching_mode"],
  ];
  return mappings.every(([criteriaKey, inputKey]) => {
    const allowed = Array.isArray(criteria[criteriaKey])
      ? (criteria[criteriaKey] as unknown[]).map(normalizeMatchText).filter(Boolean)
      : [];
    if (allowed.length === 0) return true;
    const actual = normalizeMatchText(input[inputKey]);
    if (!actual) return false;
    return allowed.some((item) => actual.includes(item) || item.includes(actual));
  });
}

function criteriaSpecificity(criteria: Record<string, unknown>) {
  return ["stages", "subjects", "lesson_types", "teaching_modes"]
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
    teaching_mode: "教学模式",
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
  if (isRecord(value.basic_info)) return renderPoliticsLessonV2(value);
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

function renderPoliticsLessonV2(value: Record<string, unknown>) {
  const basic = isRecord(value.basic_info) ? value.basic_info : {};
  const textbook = isRecord(value.textbook_analysis) ? value.textbook_analysis : {};
  const learner = isRecord(value.learner_analysis) ? value.learner_analysis : {};
  const board = isRecord(value.board_design) ? value.board_design : {};
  const reflection = isRecord(value.teaching_reflection) ? value.teaching_reflection : {};
  const basicRows: Array<[string, unknown]> = [
    ["学科", basic.subject], ["学段", basic.stage], ["年级", basic.grade],
    ["教材版本", basic.textbook_edition], ["单元", basic.unit], ["单课", basic.lesson],
    ["框题", basic.frame], ["人数", basic.class_size], ["课时", basic.duration],
    ["课型", basic.lesson_type], ["教学模式", basic.teaching_mode], ["课题", basic.topic],
    ["教材依据", basic.textbook_source_path], ["模式模板", basic.mode_template_path],
  ];
  const lines = [
    `# ${stringValue(value.title, "思政公开课教案")}`,
    "",
    "## 1. 课程基本信息",
    "",
    "| 项目 | 内容 | 项目 | 内容 |",
    "|---|---|---|---|",
  ];
  for (let index = 0; index < basicRows.length; index += 2) {
    const left = basicRows[index];
    const right = basicRows[index + 1] ?? ["", ""];
    lines.push(`| ${left[0]} | ${tableCell(left[1])} | ${right[0]} | ${tableCell(right[1])} |`);
  }
  lines.push(
    "",
    "## 2. 教材分析",
    "",
    "### 2.1 单元分析",
    stringValue(textbook.unit_analysis, "待补充"),
    "",
    "### 2.2 单课与框题分析",
    stringValue(textbook.lesson_analysis, "待补充"),
    "",
    "### 2.3 课标分析",
    stringValue(textbook.curriculum_standard_analysis, "待依据课程标准原文复核"),
    "",
    "## 3. 学情分析",
    "",
    `**已有基础：** ${stringValue(learner.known, "待补充")}`,
    "",
    "**可能误解：**",
    bulletList(learner.misconceptions),
    "",
    `**学习需要：** ${stringValue(learner.learning_needs, "待补充")}`,
    "",
    `**判断依据：** ${stringValue(learner.evidence_basis, "一般性预判，需教师结合本班情况复核")}`,
    "",
    "## 4. 教学目标",
    "",
    "| 教学目标 | 达标证据 |",
    "|---|---|",
  );
  for (const objective of arrayRecords(value.objectives)) {
    lines.push(`| ${tableCell(objective.objective)} | ${tableCell(objective.learning_evidence)} |`);
  }
  lines.push(
    "",
    "## 5. 教学重难点",
    "",
    "### 5.1 教学重点",
    bulletList(value.key_points),
    "",
    "### 5.2 教学难点",
    bulletList(value.difficult_points),
    "",
    "## 6. 教学流程",
  );
  arrayRecords(value.lesson_flow).forEach((flow, flowIndex) => {
    lines.push(
      "",
      `### 6.${flowIndex + 1} ${stringValue(flow.phase)}：${stringValue(flow.title)}（${stringValue(flow.minutes)} 分钟）`,
      "",
      `**环节功能：** ${stringValue(flow.purpose)}`,
      "",
      `**材料与呈现：** ${listInline(flow.materials)}`,
      "",
      `**核心问题/任务：** ${stringValue(flow.key_question_or_task)}`,
      "",
      "| 步骤 | 教师行为 | 学生行为 | 预期产出 | 评价与反馈 |",
      "|---:|---|---|---|---|",
    );
    for (const step of arrayRecords(flow.steps)) {
      lines.push(`| ${tableCell(step.step)} | ${tableCell(step.teacher_behavior)} | ${tableCell(step.student_behavior)} | ${tableCell(step.expected_output)} | ${tableCell(step.evaluation)} |`);
    }
    lines.push(
      "",
      `**知识落点：** ${stringValue(flow.knowledge_landing)}`,
      "",
      `**过渡语：** ${stringValue(flow.transition)}`,
    );
  });
  lines.push(
    "",
    "## 7. 板书设计",
    "",
    "```text",
    stringValue(board.layout_text, "待补充"),
    "```",
    "",
    `**设计逻辑：** ${stringValue(board.logic_explanation, "待补充")}`,
    "",
    "## 8. 教学反思",
    "",
    "### 8.1 观察重点",
    bulletList(reflection.observation_focus),
    "",
    "### 8.2 可能风险",
    bulletList(reflection.possible_risks),
    "",
    "### 8.3 调整方案",
    bulletList(reflection.adjustment_plan),
  );
  return lines.join("\n").trim();
}

function validatePoliticsLessonOutput(
  value: Record<string, unknown>,
  outputContract: Record<string, unknown>,
) {
  const basic = requireRecord(value.basic_info, "课程基本信息");
  requireFields(basic, contractFields(outputContract.basic_info_required), "课程基本信息");
  const textbook = requireRecord(value.textbook_analysis, "教材分析");
  requireFields(textbook, contractFields(outputContract.textbook_analysis_required), "教材分析");
  const learner = requireRecord(value.learner_analysis, "学情分析");
  requireFields(learner, ["known", "misconceptions", "learning_needs", "evidence_basis"], "学情分析");

  const objectives = arrayRecords(value.objectives);
  if (objectives.length < 3) throw new Error("教学目标至少需要 3 项，并逐项对应达标证据。");
  objectives.forEach((item, index) => requireFields(item, ["objective", "learning_evidence"], `教学目标 ${index + 1}`));
  if (!Array.isArray(value.key_points) || value.key_points.length === 0) throw new Error("教学重点不能为空。");
  if (!Array.isArray(value.difficult_points) || value.difficult_points.length === 0) throw new Error("教学难点不能为空。");

  const flows = arrayRecords(value.lesson_flow);
  const minimumFlowItems = Number(outputContract.minimum_flow_items ?? 5);
  if (flows.length < minimumFlowItems) throw new Error(`教学流程至少需要 ${minimumFlowItems} 个环节。`);
  const flowFields = contractFields(outputContract.lesson_flow_required);
  const stepFields = contractFields(outputContract.lesson_step_required);
  const minimumSteps = Number(outputContract.minimum_steps_per_flow ?? 2);
  let totalMinutes = 0;
  flows.forEach((flow, flowIndex) => {
    requireFields(flow, flowFields, `教学流程 ${flowIndex + 1}`);
    const minutes = Number(flow.minutes);
    if (!Number.isFinite(minutes) || minutes <= 0) throw new Error(`教学流程 ${flowIndex + 1} 的时间无效。`);
    totalMinutes += minutes;
    const steps = arrayRecords(flow.steps);
    if (steps.length < minimumSteps) throw new Error(`教学流程 ${flowIndex + 1} 至少需要 ${minimumSteps} 个具体步骤。`);
    steps.forEach((step, stepIndex) => requireFields(step, stepFields, `教学流程 ${flowIndex + 1} 步骤 ${stepIndex + 1}`));
  });
  if (!String(flows[0]?.phase ?? "").includes("导入")) throw new Error("教学流程第一项必须是导入。");
  const lastPhase = String(flows[flows.length - 1]?.phase ?? "");
  if (!["总结", "整合", "迁移"].some((label) => lastPhase.includes(label))) {
    throw new Error("教学流程最后一项必须承担总结、整合或迁移功能。");
  }
  const duration = Number(String(basic.duration ?? "").match(/\d+(?:\.\d+)?/)?.[0]);
  if (Number.isFinite(duration) && Math.abs(totalMinutes - duration) > 0.01) {
    throw new Error(`教学流程共 ${totalMinutes} 分钟，与课程时长 ${duration} 分钟不一致。`);
  }
  const expectedModePath = ({
    "案例式": "references/case-mode-v3.md",
    "议题式": "references/issue-mode-v3.md",
    "任务式": "references/task-mode-v3.md",
  } as Record<string, string>)[String(basic.teaching_mode ?? "")];
  if (!expectedModePath || basic.mode_template_path !== expectedModePath) {
    throw new Error("课程基本信息中的教学模式模板路径与实际模式不一致。");
  }
  const board = requireRecord(value.board_design, "板书设计");
  requireFields(board, ["layout_text", "logic_explanation"], "板书设计");
  const reflection = requireRecord(value.teaching_reflection, "教学反思");
  requireFields(reflection, ["observation_focus", "possible_risks", "adjustment_plan"], "教学反思");
}

function bulletList(value: unknown) {
  const items = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  return items.map((item) => `- ${valueToText(item)}`).join("\n") || "- 暂无";
}

function listInline(value: unknown) {
  const items = Array.isArray(value) ? value : [value];
  return items.map(valueToText).filter(Boolean).join("；");
}

function tableCell(value: unknown) {
  return stringValue(value, "未提供").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br />");
}

function contractFields(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function requireRecord(value: unknown, label: string) {
  if (!isRecord(value)) throw new Error(`${label}必须是 JSON 对象。`);
  return value;
}

function requireFields(value: Record<string, unknown>, fields: string[], label: string) {
  const missing = fields.filter((field) => {
    const item = value[field];
    return item === undefined || item === null || (typeof item === "string" && !item.trim());
  });
  if (missing.length > 0) throw new Error(`${label}缺少必要字段：${missing.join("、")}。`);
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
