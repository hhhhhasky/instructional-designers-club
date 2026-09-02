export type HaiWorkToolSlug =
  | "lesson-diagnosis"
  | "segment-optimization"
  | "subject-lesson-design"
  | "teaching-design";

export const HAI_WORK_PROVIDER_TIMEOUT_MS = 140_000;

/**
 * HAI Work 会生成长文档，生产环境的实际 Edge Function 墙钟约为 150 秒。
 * Work 不启用 reasoning，避免推理 Token 挤占正文与执行时间；公开课再设置
 * 6k 输出上限，保留八要素教案的最小可用内容，同时阻止异常长输出拖垮运行。
 */
export function applyWorkCompletionPolicy<T extends { maxTokens: number; thinkingEnabled: boolean }>(
  toolSlug: HaiWorkToolSlug,
  options: T,
): T {
  return {
    ...options,
    thinkingEnabled: false,
    maxTokens: toolSlug === "subject-lesson-design"
      ? Math.min(options.maxTokens, 6_000)
      : options.maxTokens,
  };
}

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

/**
 * Skill 配置允许在开发期暂时不完整。持久化空壳优先，运行时空 Skill
 * 是最后一道兜底，避免没有 published Skill 时把整个 Work 请求打成 503。
 */
export function createEmptyWorkSkill(moduleSlug: string): WorkSkillCandidate {
  return {
    id: `runtime-empty-${moduleSlug}`,
    slug: `${moduleSlug}-empty-runtime`,
    name: `${moduleSlug} 空 Skill`,
    description: "当前没有可用的专属 Skill 提示词，使用通用生成约束继续执行。",
    match_criteria: {},
    priority: -10000,
    is_fallback: true,
    version: {
      id: "",
      version_label: "empty-runtime-v1",
      prompt_template: "",
      input_contract: {},
      output_contract: {},
    },
  };
}

type TextbookRouteSource = {
  section_path: string;
  content_type: string;
  section_level?: string | null;
  unit_label?: string | null;
  unit_title?: string | null;
  lesson_label?: string | null;
  lesson_title?: string | null;
  frame_label?: string | null;
  frame_title?: string | null;
};

export type TextbookSnapshotRoute = {
  section_id: string;
  collection_slug?: string | null;
};

export type TextbookRouteRow = {
  id: string;
  collection_id: string;
  collection_slug: string;
  stage: string;
  subject: string;
  section_level: string;
  unit_number: number;
  lesson_number: number;
  frame_number?: number | null;
};

/**
 * Older Work runs stored the resolved textbook section ids but predated the
 * fixed route fields in input_snapshot. Recover the route from those ids so
 * an existing task can still be revised after the deterministic catalog was
 * introduced.
 */
export function resolveTextbookRouteFromSnapshots(
  snapshots: TextbookSnapshotRoute[],
  rows: TextbookRouteRow[],
  input: Record<string, unknown>,
) {
  const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.section_id, snapshot]));
  const subject = String(input.subject ?? "").trim();
  const politicsSubjects = new Set(["思政", "思想政治", "道德与法治"]);
  const matchingRows = rows
    .filter((row) => snapshotById.has(row.id))
    .filter((row) => row.stage === String(input.stage ?? "").trim())
    .filter((row) => row.subject === subject || (politicsSubjects.has(subject) && politicsSubjects.has(row.subject)))
    .filter((row) => row.section_level === "lesson" || row.section_level === "frame");
  if (matchingRows.length === 0) return null;

  const collectionIds = new Set(matchingRows.map((row) => row.collection_id));
  if (collectionIds.size !== 1) return null;
  const collectionSlug = matchingRows[0].collection_slug;
  const selected = [...matchingRows].sort((a, b) => {
    const levelWeight = { frame: 3, lesson: 2, unit: 1 } as Record<string, number>;
    return (levelWeight[b.section_level] ?? 0) - (levelWeight[a.section_level] ?? 0);
  })[0];
  if (!selected || !collectionSlug) return null;
  if (selected.section_level === "frame" && !selected.frame_number) return null;
  return {
    collectionSlug,
    unitNumber: selected.unit_number,
    lessonNumber: selected.lesson_number,
    frameNumber: selected.section_level === "frame" ? selected.frame_number ?? null : null,
  };
}

/**
 * The catalog sends exact labels, while the legacy match RPC also supports
 * fuzzy search. Work must not let a fuzzy neighbor become textbook evidence;
 * retain only the selected unit/lesson and its linked parent context.
 */
export function filterExactTextbookSources<T extends TextbookRouteSource>(
  sources: T[],
  input: Record<string, unknown>,
): T[] {
  const unitNeedle = textbookRouteNeedle(input.unit, "unit");
  const lessonNeedle = textbookRouteNeedle(input.topic, "lesson");
  const frameNeedle = textbookRouteNeedle(input.frame, "frame");
  return sources.filter((source) => {
    if (unitNeedle && !matchesTextbookRoute(source, unitNeedle, "unit")) return false;
    const hasLessonRoute = Boolean(source.lesson_label || source.lesson_title);
    const hasFrameRoute = Boolean(source.frame_label || source.frame_title);
    const isUnitContext = source.content_type === "unit_context" || source.section_level === "unit" || (!hasLessonRoute && !hasFrameRoute);
    const isLessonContext = source.content_type === "lesson_summary" || source.section_level === "lesson" || (hasLessonRoute && !hasFrameRoute);
    if (lessonNeedle && !isUnitContext && !matchesTextbookRoute(source, lessonNeedle, "lesson")) return false;
    if (frameNeedle && !isUnitContext && !isLessonContext && !matchesTextbookRoute(source, frameNeedle, "frame")) return false;
    return true;
  });
}

function matchesTextbookRoute(source: TextbookRouteSource, needle: string, level: "unit" | "lesson" | "frame") {
  const structuredValue = textbookRouteNeedle(
    [
      source[`${level}_label`],
      source[`${level}_title`],
    ].filter(Boolean).join(" "),
    level,
  );
  if (structuredValue) return routeTextsMatch(structuredValue, needle);

  const segments = source.section_path.split(/[\\/|]/u).map((segment) => segment.trim()).filter(Boolean);
  const levelSegments = segments.filter((segment) => routeSegmentHasLevel(segment, level));
  const fallbackIndex = level === "unit" ? 0 : level === "lesson" ? 1 : 2;
  const fallbackSegments = levelSegments.length === 0 && segments[fallbackIndex]
    ? [segments[fallbackIndex]]
    : levelSegments;
  return fallbackSegments
    .some((segment) => routeTextsMatch(textbookRouteNeedle(segment, level), needle));
}

function routeTextsMatch(sourceValue: string, selectedValue: string) {
  return sourceValue === selectedValue;
}

function routeSegmentHasLevel(segment: string, level: "unit" | "lesson" | "frame") {
  const number = "[一二三四五六七八九十百千万零〇\\d]+";
  if (level === "unit") return new RegExp(`(?:第\\s*${number}|${number})\\s*(?:单元|章)`, "u").test(segment);
  if (level === "lesson") return new RegExp(`(?:第\\s*${number}|${number})\\s*课`, "u").test(segment);
  return new RegExp(`(?:第\\s*${number}|${number})\\s*(?:框|节)`, "u").test(segment);
}

function textbookRouteNeedle(value: unknown, level: "unit" | "lesson" | "frame") {
  let text = String(value ?? "").trim();
  if (!text) return "";
  const numberPattern = "[一二三四五六七八九十百千万零〇\\d]+";
  const labelPattern = level === "unit" ? "(?:单元|章)" : level === "lesson" ? "课" : "(?:框|节)";
  const hadExplicitLevel = new RegExp(`^(?:第\\s*${numberPattern}\\s*${labelPattern}|${labelPattern}\\s*${numberPattern})`, "u").test(text);
  text = text
    .replace(new RegExp(`^第\\s*${numberPattern}\\s*${labelPattern}\\s*`, "u"), "")
    .replace(new RegExp(`^${labelPattern}\\s*${numberPattern}\\s*[、.．：:\\s]*`, "u"), "")
    .replace(/[（(]\s*第?\s*\d+\s*(?:[-—~～至到]\s*\d+\s*)?页\s*[）)]/gu, "");
  if (!hadExplicitLevel) {
    text = text.replace(/^[一二三四五六七八九十百千万零〇\d]+[、.．：:\s]+/u, "");
  }
  return normalizeTextbookRoute(text);
}

function normalizeTextbookRoute(value: string) {
  return value.toLocaleLowerCase().replace(/[\s·/|：:，,。、“”"'《》()（）—–-]/gu, "");
}

const toolSlugs = new Set<HaiWorkToolSlug>([
  "lesson-diagnosis",
  "segment-optimization",
  "subject-lesson-design",
  "teaching-design",
]);

export function isHaiWorkToolSlug(value: string): value is HaiWorkToolSlug {
  return toolSlugs.has(value as HaiWorkToolSlug);
}

export function buildWorkTaskTitle(
  moduleSlug: HaiWorkToolSlug,
  moduleName: string,
  input: Record<string, unknown>,
) {
  const prefix = moduleSlug === "subject-lesson-design"
    ? "公开课设计"
    : moduleName.trim() || "HAI Work";
  const topic = String(input.topic ?? "").trim();
  return `${prefix}｜${topic || "未命名任务"}`.slice(0, 80);
}

export function validateWorkInput(
  toolSlug: HaiWorkToolSlug,
  input: Record<string, unknown>,
  materialCount: number,
) {
  const textbookRouteFields = ["stage", "subject", "grade", "volume", "unit", "topic"];
  const requiredByTool: Record<HaiWorkToolSlug, string[]> = {
    "lesson-diagnosis": textbookRouteFields,
    "segment-optimization": [
      ...textbookRouteFields,
      "segment_type",
      "desired_outcome",
    ],
    "subject-lesson-design": [
      ...textbookRouteFields,
      "lesson_type",
    ],
    "teaching-design": [
      ...textbookRouteFields,
      "design_type",
      "desired_outcomes",
      "unit_duration",
    ],
  };

  if (toolSlug === "subject-lesson-design") {
    const subject = String(input.subject ?? "").trim();
    const isPoliticsSubject = subject === "道德与法治" || subject === "思想政治";
    input.teaching_mode = isPoliticsSubject ? String(input.teaching_mode ?? "").trim() : "";
    input.lesson_type = "公开课";
  }

  for (const key of requiredByTool[toolSlug]) {
    if (!String(input[key] ?? "").trim()) {
      throw new Error(`请填写${fieldLabel(key)}。`);
    }
  }

  const fixedRouteFields = ["collection_slug", "unit_route_number", "lesson_route_number"];
  const hasFixedRoute = fixedRouteFields.some((key) => String(input[key] ?? "").trim());
  if (hasFixedRoute) {
    for (const key of fixedRouteFields) {
      if (!String(input[key] ?? "").trim()) {
        throw new Error("内置教材编号不完整，请重新选择教材、单元和课题。");
      }
    }
    if (String(input.frame ?? "").trim() && !String(input.frame_route_number ?? "").trim()) {
      throw new Error("框题编号缺失，请重新选择框题。");
    }
  }

  if (
    toolSlug === "lesson-diagnosis" &&
    !String(input.lesson_plan ?? "").trim() &&
    materialCount === 0
  ) {
    throw new Error("请粘贴教案正文或上传教案文件。");
  }

  if (
    toolSlug === "segment-optimization" &&
    !String(input.current_design ?? "").trim() &&
    materialCount === 0
  ) {
    throw new Error("请粘贴当前环节设计，或上传环节设计文件。");
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

/** 每个工具的 Markdown 直出指令。替代旧的「统一输出教案」硬编码，使诊断、环节优化等非教案工具的输出结构也对题。 */
const MARKDOWN_DIRECTIVE: Record<HaiWorkToolSlug, string> = {
  "lesson-diagnosis":
    "请直接输出 Markdown 诊断报告，不要输出 JSON。结构：先给综合评分（XX/100）与一句话总评；再按七要素（教材分析、学情分析、教学目标、教学重难点、教学环节、教学评估、教学反思）逐项给出评分、问题与改进；接着给四组系统关系诊断（教学评一致性、教学目标来源、重难点与环节对应、学情回应度）；最后给 3-6 条优先修改建议，每条含理由、第一步动作与改写示范。每个评分都要有证据支撑。",
  "segment-optimization":
    "请直接输出 Markdown 环节优化方案，不要输出 JSON。结构依次为：核心问题、优化原则（要点列表）、优化后的环节（可直接替换使用的完整改写稿）、教师行动（列表）、学生行动（列表）、时间安排、学习证据（列表）、为什么这样改（理由）、使用提醒（列表）。优化后的环节必须让教学目标、学生行动与学习证据三者一致。",
  "subject-lesson-design":
    "请直接输出 Markdown 教案，不要输出 JSON。若已加载学科输出模板，严格遵守其章节、字段和篇幅要求，不要额外扩展；没有学科模板时按教学设计的自然结构组织。",
  "teaching-design":
    "请直接输出 Markdown 单元/课程设计方案，不要输出 JSON。按所选设计方法的自然结构组织：先确定预期结果（学生应理解/知道/能做什么）与评估证据，再排列学习活动，确保教-学-评一致并对齐核心素养。",
};

const MATHEMATICS_MARKDOWN_DIRECTIVE =
  "数学公开课只输出八个二级标题：课标分析、教材分析、学情分析、教学目标、教学重难点、教学流程、教学评估、板书。教学流程最多 4 个环节，每个环节只写四个字段：环节功能/目标、核心问题/任务、学生行动与产出、教师反馈与评价。删除课后延伸、复盘和单独的差异化章节；需要时各用一句话并入教学评估。全文控制在约 6,000 tokens 内。";

/** 环节优化的开放环节方法论。前端当前开放课程导入、问题链、任务活动、评价反馈；其余旧类型保留兼容。 */
const SEGMENT_METHODOLOGY: Record<string, string> = {
  "课程导入":
    "核心目的：在3—5分钟内让学生知道本节课要发生什么学习增长，并产生进入主线的真实需要。先在目标锚定型、经验情境型、现象/证据型三大模式中选择一个主模式：目标锚定型直接说明可观察目标、成果和成功标准；经验情境型把生活、文本、社会经验转为问题，其中可使用问题冲突、故事案例或任务使命子型；现象/证据型用学生未见过或无法立即解释的自然现象、数学反常、数据、实物或实验启动观察和解释。必须写清教师动作、学生猜想/判断/预测、核心问题、学习证据、时间和转入主线。不要把图片、视频、故事、游戏当成模式本身；它们只有在产生学科问题和学生证据时才有价值。常见断点：目标空泛、情境与教材目标脱节、现象只为新奇、故事没有学科行动、任务过大、导入过长。",
  "问题链":
    "核心目的：用有认知依赖的问题链推动学生从输入走向加工，再走向判断或输出，不能把不同学科都套成同一组识别—理解—分析问题。先根据学科和材料选择主模式：科学/数学可用‘现象—问题/假设—验证—证据—解释/模型—迁移’；道法、历史和社会议题可用黄金圈‘是什么—为什么—怎么办’，并以材料证据、条件和代价支撑判断；语文/英语语篇可用‘作者/文本说了什么—作者怎么写、为何这样写—我如何模仿或迁移表达’，形成浅读/粗读—深读/加工—输出。也可使用漏斗递进、证据论证、比较辨析或选择决策型。每一问只承担一个主要思维动作，写清预期学生证据、等待时间、追问和下一问如何使用前一问的结果。常见断点：问题碎片化、文理错配、语文只问大意不问写法、科学只问为什么不要求证据、道法历史只要态度不看依据、一问即答。",
  "任务活动":
    "核心目的：让学生完成有对象、有目的、有标准的学科行动，而不是完成活动流程。先在真实性表现、问题解决、项目/产品、案例分析、模拟/角色、设计挑战、分站/菜单七类中选择主模式，并说明理由。无论哪类任务，都必须写清：对象/目的、学生角色、资源、规则/约束、核心步骤、个人产出、共同产出（如有）、成功标准、时间、检查点、反馈与修订。问题解决型必须有理解问题—表征—策略—尝试—验证；案例分析型必须有事实—关键变量—概念工具—证据判断—结论边界；设计挑战型必须有需求—约束—方案—原型—测试—迭代；项目型必须有阶段产出和里程碑。任务指令要能被学生复述，产出必须证明目标学习。常见断点：无真实对象、无产出、无标准、规则喧宾夺主、项目规模超出课时、展示结束没有反馈和修订。",
  "教师讲解":
    "核心目的：在学生需要系统化或卡住时精讲，而非满堂灌。优化要点：采用讲解—停顿—提问—反馈的节奏；只在关键处讲；用板书、图示等双通道降低认知负荷；讲后立即用一个检测确认理解。常见断点：连续讲授超过 5-8 分钟、单通道口述、讲完不检测。学习证据：学生能复述关键结构、用自己的话解释概念。",
  "合作探究":
    "核心目的：让每个学生都承担学习责任，而非小组名义下的个别人代劳。优化要点：先独立思考再合作；组内角色分工（记录、汇报、计时、质疑）；明确合作产物；组间汇报交流而非只对老师。常见断点：伪合作搭便车、没有独立思考前置、汇报只复述答案。学习证据：每个学生都有自己的产出，汇报能展示不同观点的碰撞。",
  "练习迁移":
    "核心目的：通过变式与迁移巩固理解，而非机械重复。优化要点：安排同结构异情境的变式题与新情境的迁移题；错例即时反馈并追问思路；让学生说明为什么这样解。常见断点：机械刷题、只做同情境重复、对错只订正不归因。学习证据：学生能在新情境中正确迁移，并解释解题依据。",
  "评价反馈":
    "核心目的：用证据判断目标达成度，并让教师或学生采取下一步行动。先在前测/诊断、检查理解、铰链问题、量规/标准、同伴/自我评价、反馈—修订、掌握/分支七类中选择主模式。每个目标都要对应可收集的全体学生证据；反馈必须说明做得怎样、差距在哪里、下一步做什么、如何做，并安排学生修改、重述、重演或再测。根据证据设置分支：多数误解则暂停重教或换表征，部分不稳则加支架，已掌握则比较、解释或迁移。不要用表扬、分数或‘再想想’代替反馈。常见断点：评价与目标脱节、只听举手者、只收集不调整、反馈不可行动、没有二次证据。",
  "课堂总结":
    "核心目的：让学生自主结构化本节所学，而非教师单方复述知识点。优化要点：让学生用思维导图、一句话或结构图自主总结；提炼方法而非罗列事实；埋下一节课的认知钩子。常见断点：教师一人总结、只罗列知识点不提炼方法、总结与目标不呼应。学习证据：学生输出的结构化认知，以及能否说出「我今天学会了怎样……」。",
  "其他":
    "通用优化框架：检查教学目标、学生行动、学习证据三者是否一致，找到最早断裂的位置先修。优化要点：确保每个活动都服务目标，每个目标都有可观察的学习证据；删掉只服务流程而不服务学习的环节。常见断点：目标与活动脱节、活动热闹但学习证据弱、时间分配与重点错位。学习证据：与目标对应的、可观察可收集的学生学习表现。",
};

export function buildWorkPrompt(params: {
  toolSlug: HaiWorkToolSlug;
  input: Record<string, unknown>;
  skill: WorkSkillCandidate;
  materialContext: string;
  textbookContext?: string;
  caseContext?: string;
  previousMarkdown?: string;
  revisionInstruction?: string;
}) {
  const revisionMode = Boolean(params.previousMarkdown);
  const selectedReferences = selectWorkSkillReferences(params.skill, params.input);
  const referenceContext = selectedReferences.map((reference) =>
    `### ${reference.path}\n${reference.content.slice(0, reference.max_chars)}`
  ).join("\n\n");
  // A revision is scoped to the prior artifact and the new instruction. The
  // initial run already established the evidence boundary, so repeating every
  // source here only inflates the request and gives the model duplicate context.
  const promptInput = { ...params.input };
  delete promptInput.textbook_content;
  if (revisionMode) {
    delete promptInput.lesson_plan;
    delete promptInput.current_design;
    delete promptInput.desired_outcomes;
  }
  const skillInstructions = params.skill.version.prompt_template.trim();
  const fallbackNotice = !skillInstructions
    ? "当前使用的是空 Skill 壳，具体学科/功能提示词尚未补充。请依据任务输入、教材证据和通用输出要求继续生成，不要因为 Skill 为空而报错，也不要声称使用了尚未提供的方法。"
    : params.skill.is_fallback
    ? "当前使用通用 Skill。不得把一般知识伪装成教材中的具体事实。"
    : skillInstructions
    ? "当前已匹配专属 Skill。仍须遵守教材事实边界。"
    : "";
  const segmentType = String(params.input.segment_type ?? "").trim();
  const system = [
    params.skill.version.prompt_template,
    fallbackNotice,
    !revisionMode && params.textbookContext
      ? "精确命中的内置教材知识点梳理可作为本次设计的教材事实依据，无需再要求用户上传教材；它不是教材逐字原文。必须按版本、单元、课题和框题使用；若标注待复核，须在产物中显式提醒。用户补充的教材原文与内置梳理冲突时，以用户补充内容为准。"
      : "没有命中的内置教材内容时，不得依据课名猜测教材事实。",
    !revisionMode && params.caseContext
      ? "以下案例库候选由后端按本课教材层级检索，仅用于帮助选择教学载体和问题化方向，不是可直接宣读的事实定稿。必须保留案例的核验状态；涉及时间、数据、人物或政策细节时，先要求教师核验或在产物中标注待核实，不得把案例库的候选描述当作教材结论。"
      : "本次没有命中案例库候选，不得凭空补写案例事实。",
    revisionMode
      ? "当前是上一版续改：上一版产物是本轮的主要工作对象，只按本轮追改要求做必要修改，并保留未被要求修改的内容。原始教材、案例、用户材料和 Skill reference 不在本轮重复展开；不得借此凭空补充上一版没有的事实。"
      : "当前是首次生成：使用本轮提供的教材、案例、用户材料和版本化 Skill reference 建立产物。",
    params.skill.version.output_contract.format === "sizheng_public_lesson_v2"
      ? revisionMode
        ? `本轮续改继续保持用户选择的“${String(params.input.teaching_mode ?? "")}”主导模式，不混用另外两套主流程。`
        : selectedReferences.length > 0
        ? `用户已选择“${String(params.input.teaching_mode ?? "")}”作为唯一主导模式。只执行对应 V3 模板，不得混用另外两套主流程。`
        : "当前思政 Skill 没有加载模式 reference，不得声称使用了对应 V3 模板。"
      : revisionMode
      ? "本轮续改不重复注入 Skill reference 正文，沿用上一版已经建立的结构和方法边界。"
      : selectedReferences.length > 0
      ? "当前已加载与本学科、学段匹配的版本化 Reference。按主 Skill 的选择规则使用模板、模式和对应学段样例；样例只作结构参照，不得冒充本课教材事实。"
      : skillInstructions
      ? "当前专属 Skill 没有可加载的学科 Reference；只执行主 Skill，并保持教材事实边界。"
      : "当前学科 Skill 壳没有 reference；后续补充 Skill 内容后才会增加学科专属方法。",
    params.toolSlug === "segment-optimization" && segmentType
      ? `本次要优化的环节类型是「${segmentType}」。该类型的优化要点：\n${SEGMENT_METHODOLOGY[segmentType] ?? SEGMENT_METHODOLOGY["其他"]}`
      : "",
    params.toolSlug === "subject-lesson-design" &&
      String(params.skill.slug).includes("mathematics")
      ? MATHEMATICS_MARKDOWN_DIRECTIVE
      : "",
    `${MARKDOWN_DIRECTIVE[params.toolSlug]}\n不要用代码围栏（\`\`\`）包裹整个输出。`,
  ].filter(Boolean).join("\n\n");

  const user = [
    "## 任务输入",
    JSON.stringify(promptInput, null, 2),
    !revisionMode && referenceContext ? `## Skill 版本化参考资料\n${referenceContext}` : "",
    !revisionMode && params.textbookContext ? `## 内置教材知识库（精确命中）\n${params.textbookContext}` : "",
    !revisionMode && String(params.input.textbook_content ?? "").trim()
      ? `## 用户粘贴的教材内容\n${String(params.input.textbook_content).trim()}`
      : "",
    !revisionMode && params.caseContext ? `## 思政公开课案例库候选（后端检索）\n${params.caseContext}` : "",
    !revisionMode && params.materialContext ? `## 用户指定材料\n${params.materialContext}` : "",
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
      referenceMatchesInput(reference, input) &&
      (reference.load_mode === "always" || (mode && reference.load_mode === mode))
    )
    .sort((a, b) => a.sort_order - b.sort_order);
}

function referenceMatchesInput(
  reference: WorkSkillReference,
  input: Record<string, unknown>,
) {
  const mappings: Array<[string, string]> = [
    ["stages", "stage"],
    ["subjects", "subject"],
  ];
  return mappings.every(([metadataKey, inputKey]) => {
    const configured = Array.isArray(reference.metadata?.[metadataKey])
      ? (reference.metadata[metadataKey] as unknown[]).map(normalizeMatchText).filter(Boolean)
      : [];
    if (configured.length === 0) return true;
    const actual = normalizeMatchText(input[inputKey]);
    return Boolean(actual) && configured.some((item) => actual.includes(item) || item.includes(actual));
  });
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
    ["design_types", "design_type"],
    ["segment_types", "segment_type"],
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
  return ["stages", "subjects", "lesson_types", "teaching_modes", "design_types", "segment_types"]
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
    design_type: "设计类型",
    desired_outcomes: "预期成果",
    unit_duration: "课时数",
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

/**
 * 自动补齐产物中缺失的必填字符串字段，避免因 LLM 遗漏个别字段（如 transition）
 * 而导致整个产物被拒绝。只补字符串类型字段，不覆盖已有有效值。
 */
const PATCH_DEFAULTS: Record<string, string> = {
  transition: "（承上启下，自然过渡至下一环节）",
  purpose: "（巩固学习效果，深化理解）",
  materials: "教材、课件与补充材料",
  key_question_or_task: "完成本环节核心学习任务",
  knowledge_landing: "（结合教材知识进行归纳总结）",
  step: "教学活动步骤",
  teacher_behavior: "教师引导讲解与组织互动",
  student_behavior: "学生独立思考、小组合作与展示交流",
  expected_output: "学生能够达成该步骤的学习目标",
  evaluation: "课堂观察、提问反馈与当堂检测",
};

export function patchWorkOutput(
  parsed: Record<string, unknown>,
  outputContract: Record<string, unknown>,
): Record<string, unknown> {
  if (outputContract.format !== "sizheng_public_lesson_v2") return parsed;
  const flowFields = contractFields(outputContract.lesson_flow_required);
  const stepFields = contractFields(outputContract.lesson_step_required);

  const flows = Array.isArray(parsed.lesson_flow) ? parsed.lesson_flow : [];
  let patched = 0;

  const patchedFlows = flows.map((flow) => {
    if (!isRecord(flow)) return flow;
    const item = { ...flow };
    for (const field of flowFields) {
      if (_isMissing(item[field]) && PATCH_DEFAULTS[field]) {
        item[field] = PATCH_DEFAULTS[field];
        patched++;
      }
    }
    const steps = Array.isArray(item.steps) ? item.steps : [];
    item.steps = steps.map((step) => {
      if (!isRecord(step)) return step;
      const s = { ...step };
      for (const field of stepFields) {
        if (_isMissing(s[field]) && PATCH_DEFAULTS[field]) {
          s[field] = PATCH_DEFAULTS[field];
          patched++;
        }
      }
      return s;
    });
    return item;
  });

  if (patched > 0) {
    console.log("[hai_work] auto-patched", patched, "missing fields in work output");
  }
  return { ...parsed, lesson_flow: patchedFlows };
}

function _isMissing(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && !value.trim());
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
