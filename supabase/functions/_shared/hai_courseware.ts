import {
  displayItems,
  displayText,
  readCoursewareMaterialProvenance,
  readCoursewareVisual,
  readSourceMapping,
  separateCoursewareAudience,
} from "./hai_courseware_content.ts";
import { normalizeCoursewareSubjectProfile } from "./hai_courseware_skill.ts";
import {
  type CoursewareAnimationPreset,
  type CoursewareColorSchemeId,
  type CoursewareFlatPattern,
  type CoursewareFontPairingId,
  DEFAULT_COURSEWARE_ANIMATION_PRESET,
  DEFAULT_COURSEWARE_FONT_PAIRING,
  getCoursewareColorScheme,
  getCoursewareFontPairing,
  normalizeCoursewareAnimationPreset,
  normalizeCoursewareColorScheme,
  normalizeCoursewareFlatPattern,
  normalizeCoursewareFontPairing,
} from "./hai_courseware_style.ts";

const COURSEWARE_SCHEMA_VERSION = "hai_courseware_deck_v4";
const PREVIOUS_DIRECT_SCHEMA_VERSION = "hai_courseware_deck_v3";
const FUNCTIONS = [
  "F01_COVER",
  "F02_SECTION",
  "F03_CONTEXT",
  "F04_CORE_QUESTION",
  "F05_CONTENT",
  "F06_OBSERVATION",
  "F07_RELATION",
  "F08_COMPARISON",
  "F09_DATA",
  "F10_ACTIVITY",
  "F11_EXERCISE",
  "F12_SUMMARY",
] as const;
const LEGACY_FUNCTIONS = [
  "F01_COVER",
  "F03_CONTEXT",
  "F05_CONTENT",
  "F10_ACTIVITY",
  "F11_EXERCISE",
  "F12_SUMMARY",
] as const;
const RANGES = {
  compact: { min: 11, max: 20 },
  standard: { min: 21, max: 35 },
} as const;
type Mode = "V1" | "V2" | "V3";
type Length = "compact" | "standard";
type ImageStrategy = "minimal" | "smart" | "enhanced";
type OutputMode = "ppt" | "interactive";
export type CoursewareGenerationOptions = {
  visualMode: Mode;
  outputMode?: OutputMode;
  length: Length;
  imageStrategy: ImageStrategy;
  colorScheme?: CoursewareColorSchemeId;
  fontPairing?: CoursewareFontPairingId;
  animationPreset?: CoursewareAnimationPreset;
  flatPattern?: CoursewareFlatPattern;
};

type Source = {
  taskId: string;
  artifactId: string;
  artifactVersion: number;
  taskTitle: string;
  artifactTitle: string;
  subject: string;
  grade: string;
  topic: string;
  subjectProfile?: string;
  lessonGenre?: string;
};
type Raw = Record<string, unknown>;
function record(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Raw
    : {};
}
function text(value: unknown, fallback = "", limit = 1000) {
  return typeof value === "string" ? value.trim().slice(0, limit) : fallback;
}
function strings(value: unknown, limit: number, itemLimit = 120) {
  return Array.isArray(value)
    ? value.map((item) => text(item, "", itemLimit)).filter(Boolean).slice(
      0,
      limit,
    )
    : [];
}
function mode(value: unknown, fallback: Mode): Mode {
  return value === "V3" ? "V3" : value === "V2" ? "V2" : value === "V1" ? "V1" : fallback;
}
function length(value: unknown, fallback: Length): Length {
  return value === "standard"
    ? "standard"
    : value === "compact"
    ? "compact"
    : fallback;
}
function strategy(value: unknown, fallback: ImageStrategy): ImageStrategy {
  return value === "minimal" || value === "smart" || value === "enhanced"
    ? value
    : fallback;
}
function outputMode(value: unknown): OutputMode {
  return value === "interactive" ? "interactive" : "ppt";
}
function coursewareTheme(colorSchemeValue: unknown, fontPairingValue: unknown) {
  const colors = getCoursewareColorScheme(colorSchemeValue);
  const fonts = getCoursewareFontPairing(fontPairingValue);
  return {
    background: colors.background,
    foreground: colors.foreground,
    muted: colors.muted,
    accent: colors.accent,
    secondary: colors.secondary,
    fontFace: fonts.bodyFontFace,
    titleFontFace: fonts.titleFontFace,
    bodyFontFace: fonts.bodyFontFace,
    colorScheme: colors.id,
    fontPairing: fonts.id,
    spacing: { xs: 0.12, s: 0.24, m: 0.42, l: 0.68, xl: 1.04 },
  };
}
function coursewareVisualProfile(value: unknown, colorSchemeValue?: unknown) {
  const visualProfile = record(value);
  const colors = colorSchemeValue === undefined
    ? null
    : getCoursewareColorScheme(colorSchemeValue);
  return {
    illustrationStyle: text(
      visualProfile.illustrationStyle,
      "minimal editorial educational illustration",
    ),
    palette: colors
      ? [colors.accent, colors.background, colors.foreground, colors.secondary]
      : strings(visualProfile.palette, 4, 30),
    lighting: text(visualProfile.lighting, "soft"),
    texture: text(visualProfile.texture, "subtle"),
    realismLevel: text(visualProfile.realismLevel, "semi-realistic"),
    visualKeywords: strings(visualProfile.visualKeywords, 8, 30),
  };
}
export function parseCoursewareJson(raw: string): Raw {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")
    .trim();
  try {
    return record(JSON.parse(cleaned));
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return record(JSON.parse(cleaned.slice(start, end + 1)));
    }
    throw new Error("AI 未返回有效的课件 JSON 结构，请重试。");
  }
}
function label(fn: string) {
  return ({
    F01_COVER: "封面",
    F02_SECTION: "章节 / 过渡",
    F03_CONTEXT: "情境导入",
    F04_CORE_QUESTION: "核心问题",
    F05_CONTENT: "内容讲解",
    F06_OBSERVATION: "图文观察",
    F07_RELATION: "关系结构",
    F08_COMPARISON: "比较辨析",
    F09_DATA: "数据证据",
    F10_ACTIVITY: "学习活动",
    F11_EXERCISE: "练习反馈",
    F12_SUMMARY: "总结提升",
  } as Record<string, string>)[fn] ?? "课堂页面";
}
const TEACHING_PHASES = [
  "opening",
  "diagnosis",
  "construction",
  "practice",
  "feedback",
  "transfer",
  "closure",
] as const;
const DEFAULT_PAGE_FUNCTION: Record<string, string> = {
  F01_COVER: "U01_COVER",
  F02_SECTION: "U15_SECTION_DIVIDER",
  F03_CONTEXT: "U02_CONTEXT",
  F04_CORE_QUESTION: "U05_CORE_QUESTION",
  F05_CONTENT: "U07_CONCEPT_EXPLANATION",
  F06_OBSERVATION: "U08_DEMONSTRATION",
  F07_RELATION: "U06_LEARNING_PATH",
  F08_COMPARISON: "U07_CONCEPT_EXPLANATION",
  F09_DATA: "U07_CONCEPT_EXPLANATION",
  F10_ACTIVITY: "U09_STUDENT_TASK",
  F11_EXERCISE: "U10_PRACTICE",
  F12_SUMMARY: "U12_SUMMARY",
};
const DEFAULT_TEACHING_PHASE: Record<string, string> = {
  F01_COVER: "opening",
  F02_SECTION: "construction",
  F03_CONTEXT: "opening",
  F04_CORE_QUESTION: "opening",
  F05_CONTENT: "construction",
  F06_OBSERVATION: "construction",
  F07_RELATION: "construction",
  F08_COMPARISON: "construction",
  F09_DATA: "construction",
  F10_ACTIVITY: "practice",
  F11_EXERCISE: "feedback",
  F12_SUMMARY: "closure",
};
function pageFunction(value: unknown, fn: string, required: boolean) {
  const candidate = text(value, "", 80) || DEFAULT_PAGE_FUNCTION[fn] ||
    "U07_CONCEPT_EXPLANATION";
  if (
    required &&
    !/^(U|CN|MATH|EN|SCI|PHY|CHEM|BIO|HIST|GEO|POL|IT|ART|PE|LAB)[0-9]{2}_[A-Z0-9_]+$/
      .test(candidate)
  ) {
    throw new Error(`页面功能标识不合法：${candidate}。`);
  }
  return candidate;
}
function teachingPhase(value: unknown, fn: string) {
  return TEACHING_PHASES.includes(
      String(value) as typeof TEACHING_PHASES[number],
    )
    ? String(value)
    : DEFAULT_TEACHING_PHASE[fn] || "construction";
}
function defaultIntensity(fn: string, visualMode: Mode) {
  return (fn === "F01_COVER" || fn === "F03_CONTEXT")
    ? visualMode === "V2" ? "L3" : "L2"
    : (fn === "F04_CORE_QUESTION" || fn === "F06_OBSERVATION")
    ? visualMode === "V2" ? "L2" : "L1"
    : fn === "F12_SUMMARY"
    ? "L2"
    : "L1";
}
function layout(fn: string, visualMode: Mode, item: Raw): string {
  const hasImage = Boolean(record(item.image).type);
  const bullets = strings(item.bullets, 6);
  const steps = strings(item.steps, 6);
  const relations = Array.isArray(item.relations) ? item.relations : [];
  if (fn === "F01_COVER") {
    return visualMode === "V2"
      ? "C03_COVER_FULL_VISUAL"
      : hasImage
      ? "C01_COVER_LEFT_VISUAL"
      : "C02_COVER_CENTER";
  }
  if (fn === "F02_SECTION") {
    return bullets.length >= 2 ? "S03_SECTION_PATH" : "S01_SECTION_NUMBER";
  }
  if (fn === "F03_CONTEXT") {
    return visualMode === "V2" || hasImage
      ? "I01_IMAGE_QUESTION"
      : "Q01_BIG_QUESTION";
  }
  if (fn === "F04_CORE_QUESTION") {
    return bullets.length >= 2 ? "Q02_QUESTION_CHOICES" : "Q01_BIG_QUESTION";
  }
  if (fn === "F05_CONTENT") {
    return text(item.body).length > 70
      ? "K01_TITLE_BODY"
      : bullets.length >= 3
      ? "K03_CONCLUSION_POINTS"
      : "K04_CENTER_CONCEPT";
  }
  if (fn === "F06_OBSERVATION") {
    return hasImage ? "O01_IMAGE_ANNOTATION" : "O02_MATERIAL_QUESTION";
  }
  if (fn === "F07_RELATION") {
    return relations.length >= 3
      ? "R01_FLOW"
      : steps.length >= 3
      ? "R02_STEP_NODES"
      : "R03_CAUSE_EFFECT";
  }
  if (fn === "F08_COMPARISON") {
    return record(item.comparison).common
      ? "B02_COMMON_DIFFERENCE"
      : "B01_TWO_COLUMNS";
  }
  if (fn === "F09_DATA") {
    return strings(record(item.data).labels, 5).length === 1
      ? "D01_BIG_NUMBER"
      : "D02_CHART_CONCLUSION";
  }
  if (fn === "F10_ACTIVITY") {
    return steps.length >= 3 ? "A02_THREE_STEPS" : "A01_TASK_CARD";
  }
  if (fn === "F11_EXERCISE") {
    return strings(record(item.exercise).options, 4).length
      ? "E02_MULTIPLE_CHOICE"
      : "E01_SINGLE_QUESTION";
  }
  return bullets.length >= 3 ? "T01_THREE_POINTS" : "T03_RETURN_QUESTION";
}
function hasContent(fn: string, value: Raw) {
  const body = text(value.body);
  const question = text(value.question);
  const task = text(value.task);
  const bullets = strings(value.bullets, 6);
  const summary = strings(value.summary, 6);
  const materials = strings(value.materials, 6);
  const steps = strings(value.steps, 6);
  const exercise = text(record(value.exercise).question);
  const image = record(value.image).type;
  const data = record(value.data);
  const hasData = strings(data.labels, 5, 30).length > 0 &&
    Array.isArray(data.values) && data.values.length > 0;
  return fn === "F01_COVER" || fn === "F02_SECTION"
    ? Boolean(value.title || body || bullets.length)
    : fn === "F03_CONTEXT"
    ? Boolean(question || body || image)
    : fn === "F04_CORE_QUESTION"
    ? Boolean(question || body || bullets.length)
    : fn === "F05_CONTENT"
    ? Boolean(body || bullets.length)
    : fn === "F06_OBSERVATION"
    ? Boolean(materials.length || body || question || image)
    : fn === "F07_RELATION"
    ? Boolean(
      Array.isArray(value.relations) && value.relations.length ||
        steps.length || body || bullets.length,
    )
    : fn === "F08_COMPARISON"
    ? Boolean(record(value.comparison).leftTitle || body || bullets.length)
    : fn === "F09_DATA"
    ? Boolean(hasData || body || bullets.length)
    : fn === "F10_ACTIVITY"
    ? Boolean(task || body || steps.length || bullets.length)
    : fn === "F11_EXERCISE"
    ? Boolean(exercise || question || body)
    : Boolean(summary.length || body || bullets.length || question);
}

type NormalizedComponentInput = {
  functionName: string;
  visualMode: Mode;
  title: string;
  body: string;
  question: string;
  task: string;
  bullets: string[];
  summary: string[];
  materials: string[];
  steps: string[];
  relations: Array<{ label: string; value?: string }>;
  comparison?: { leftTitle: string; rightTitle: string };
  data?: { labels: string[] };
  exerciseQuestion: string;
  exerciseOptions: string[];
  image?: { type: string; url?: string };
};

function component(type: string, options: Raw = {}): Raw {
  return {
    type,
    importance: "supporting",
    flexibility: "flexible",
    editability: "native",
    ...options,
  };
}

const ICON_NAMES = [
  "idea",
  "question",
  "target",
  "evidence",
  "compare",
  "data",
  "activity",
  "summary",
  "people",
  "book",
  "warning",
  "quote",
  "spark",
  "process",
];
const DEFAULT_COMPONENT_ICON: Record<string, string> = {
  F01_COVER: "spark",
  F02_SECTION: "book",
  F03_CONTEXT: "idea",
  F04_CORE_QUESTION: "question",
  F05_CONTENT: "book",
  F06_OBSERVATION: "evidence",
  F07_RELATION: "process",
  F08_COMPARISON: "compare",
  F09_DATA: "data",
  F10_ACTIVITY: "activity",
  F11_EXERCISE: "target",
  F12_SUMMARY: "summary",
};
function enrichVisualComponents(
  input: Raw[],
  fn: string,
  visualMode: Mode,
): Raw[] {
  const components = [...input];
  if (
    !components.some((entry) =>
      ["image", "illustration", "icon"].includes(String(entry.type))
    ) && components.length < 8
  ) {
    const illustration = ["F01_COVER", "F02_SECTION", "F03_CONTEXT"].includes(
      fn,
    );
    components.push(component(illustration ? "illustration" : "icon", {
      variant: illustration
        ? visualMode === "V2" ? "layered-orbit" : "geometric-spot"
        : visualMode === "V2"
        ? "solid"
        : "outline",
      role: illustration ? "decorative" : "section-mark",
      icon: DEFAULT_COMPONENT_ICON[fn] ?? "spark",
      tone: "accent",
      importance: "decorative",
      flexibility: "fixed",
    }));
  }
  if (
    fn !== "F01_COVER" &&
    !components.some((entry) => entry.type === "divider") &&
    components.length < 8
  ) {
    components.push(
      component("divider", {
        variant: visualMode === "V2" ? "bold" : "thin",
        role: "title-separator",
        tone: "accent",
        importance: "decorative",
        flexibility: "fixed",
      }),
    );
  }
  if (
    !components.some((entry) => entry.type === "shape") && components.length < 8
  ) {
    components.push(
      component("shape", {
        variant: visualMode === "V2" ? "soft-field" : "accent-corner",
        importance: "decorative",
        flexibility: "fixed",
      }),
    );
  }
  return components.slice(0, 8);
}

function buildComponents(input: NormalizedComponentInput) {
  const components = [component("title", {
    role: "title",
    text: input.title,
    importance: "primary",
    flexibility: "fixed",
    preferredFontSize: input.functionName === "F01_COVER" ? 56 : 40,
    minFontSize: 30,
    maxLines: 2,
  })];
  if (input.image) {
    components.push(
      component("image", {
        role: input.image.type,
        editability: input.image.url ? "image" : "mixed",
      }),
    );
  }
  if (input.question) {
    components.push(
      component("question", {
        role: "prompt",
        text: input.question,
        importance: "primary",
        preferredFontSize: 36,
        minFontSize: 30,
        maxLines: 2,
      }),
    );
  }
  if (input.body) {
    components.push(
      component("text", {
        role: "body",
        text: input.body,
        preferredFontSize: 24,
        minFontSize: 20,
        maxLines: 8,
      }),
    );
  }
  if (input.bullets.length) {
    components.push(
      component("bullet", { items: input.bullets, flexibility: "expandable" }),
    );
  }
  if (input.summary.length) {
    components.push(
      component("emphasis", {
        items: input.summary,
        importance: "primary",
        flexibility: "expandable",
      }),
    );
  }
  if (input.materials.length) {
    components.push(
      component("material", {
        items: input.materials,
        importance: "secondary",
        flexibility: "expandable",
      }),
    );
  }
  if (input.task || input.steps.length) {
    components.push(
      component("task", {
        role: "task",
        text: input.task,
        items: input.steps,
        importance: "primary",
        flexibility: "expandable",
      }),
    );
  }
  if (input.relations.length) {
    components.push(
      component("relation", {
        items: input.relations.map((entry) =>
          entry.value ? `${entry.label}：${entry.value}` : entry.label
        ),
        importance: "primary",
        flexibility: "expandable",
      }),
    );
  }
  if (input.comparison) {
    components.push(
      component("card", {
        variant: "comparison",
        items: [input.comparison.leftTitle, input.comparison.rightTitle],
        importance: "primary",
        flexibility: "fixed",
      }),
    );
  }
  if (input.data) {
    components.push(
      component("data", {
        variant: "chart",
        items: input.data.labels,
        importance: "primary",
        flexibility: "fixed",
      }),
    );
  }
  if (input.exerciseQuestion) {
    components.push(
      component("exercise", {
        text: input.exerciseQuestion,
        items: input.exerciseOptions,
        importance: "primary",
        flexibility: "expandable",
      }),
    );
  }
  return enrichVisualComponents(
    components,
    input.functionName,
    input.visualMode,
  );
}

const DIRECT_COMPONENT_TYPES = [
  "title",
  "text",
  "bullet",
  "question",
  "image",
  "illustration",
  "icon",
  "card",
  "emphasis",
  "highlight",
  "relation",
  "data",
  "material",
  "task",
  "exercise",
  "media",
  "divider",
  "shape",
];
const DIRECT_LAYOUT_PREFIXES: Record<string, string[]> = {
  F01_COVER: ["C"],
  F02_SECTION: ["S"],
  F03_CONTEXT: ["I", "Q"],
  F04_CORE_QUESTION: ["Q"],
  F05_CONTENT: ["K"],
  F06_OBSERVATION: ["O"],
  F07_RELATION: ["R"],
  F08_COMPARISON: ["B"],
  F09_DATA: ["D"],
  F10_ACTIVITY: ["A"],
  F11_EXERCISE: ["E"],
  F12_SUMMARY: ["T"],
};
const DIRECT_LAYOUT_ALIASES: Record<string, Record<string, string>> = {
  F01_COVER: { cover: "C02_COVER_CENTER" },
  F02_SECTION: { section: "S01_SECTION_NUMBER" },
  F03_CONTEXT: { context: "Q01_BIG_QUESTION" },
  F04_CORE_QUESTION: {
    corequestion: "Q01_BIG_QUESTION",
    "core-question": "Q01_BIG_QUESTION",
  },
  F05_CONTENT: { content: "K01_TITLE_BODY" },
  F06_OBSERVATION: { observation: "O02_MATERIAL_QUESTION" },
  F07_RELATION: { relation: "R01_FLOW" },
  F08_COMPARISON: { comparison: "B01_TWO_COLUMNS" },
  F09_DATA: { data: "D02_CHART_CONCLUSION" },
  F10_ACTIVITY: { activity: "A01_TASK_CARD" },
  F11_EXERCISE: { exercise: "E01_SINGLE_QUESTION" },
  F12_SUMMARY: { summary: "T01_THREE_POINTS" },
};

function canonicalDirectLayout(
  fn: string,
  value: string,
  visualMode: Mode,
): string {
  if (
    DIRECT_LAYOUT_PREFIXES[fn]?.some((prefix) => value.startsWith(prefix)) &&
    value.includes("_")
  ) return value;
  const alias = DIRECT_LAYOUT_ALIASES[fn]?.[value.trim().toLowerCase()];
  if (!alias) return value;
  if (fn === "F03_CONTEXT" && visualMode === "V2") return "I01_IMAGE_QUESTION";
  if (fn === "F01_COVER" && visualMode === "V2") return "C03_COVER_FULL_VISUAL";
  return alias;
}

type DirectComparison = {
  leftTitle: string;
  leftItems: string[];
  rightTitle: string;
  rightItems: string[];
  common?: string;
};
type DirectData = {
  labels: string[];
  values: number[];
  unit?: string;
  conclusion?: string;
};
type DirectRelation = { label: string; value?: string; kind?: string };

function parseComparison(value: unknown): DirectComparison | undefined {
  const outer = record(value);
  const nested = record(outer.comparison);
  const columns = Array.isArray(outer.columns) ? outer.columns : [];
  const leftColumn = record(columns[0]);
  const rightColumn = record(columns[1]);
  const raw = Object.keys(nested).length ? nested : outer;
  const leftTitle = text(raw.leftTitle || raw.left_title, "", 80);
  const rightTitle = text(raw.rightTitle || raw.right_title, "", 80);
  const resolvedLeftTitle = leftTitle ||
    text(leftColumn.title || leftColumn.name, "", 80);
  const resolvedRightTitle = rightTitle ||
    text(rightColumn.title || rightColumn.name, "", 80);
  if (!resolvedLeftTitle && !resolvedRightTitle) return undefined;
  return {
    leftTitle: resolvedLeftTitle,
    leftItems: strings(
      raw.leftItems || raw.left_items || leftColumn.items ||
        leftColumn.points || leftColumn.bullets,
      6,
    ),
    rightTitle: resolvedRightTitle,
    rightItems: strings(
      raw.rightItems || raw.right_items || rightColumn.items ||
        rightColumn.points || rightColumn.bullets,
      6,
    ),
    common: text(raw.common, "", 120) || undefined,
  };
}

function parseData(value: unknown): DirectData | undefined {
  const raw = record(value);
  const labels = strings(raw.labels, 5, 30);
  const values = Array.isArray(raw.values)
    ? raw.values.map((entry) => Number(entry)).filter((entry) =>
      Number.isFinite(entry)
    ).slice(0, 5)
    : [];
  if (!labels.length || !values.length || labels.length !== values.length) {
    return undefined;
  }
  return {
    labels,
    values,
    unit: text(raw.unit, "", 30) || undefined,
    conclusion: text(raw.conclusion) || undefined,
  };
}

function normalizeDirectComponent(value: unknown, slideIndex: number): Raw {
  const raw = record(value);
  const type = String(raw.type ?? "");
  if (!DIRECT_COMPONENT_TYPES.includes(type)) {
    throw new Error(
      `第 ${slideIndex + 1} 页包含不支持的组件类型：${type || "未命名"}。`,
    );
  }
  const componentText = displayText(raw.text) || undefined;
  const items = displayItems(raw.items);
  // Exercise is rendered as a compact multiple-choice block and therefore
  // has a four-option contract. Keep every model-provided option when the
  // model exceeds that limit by falling back to a native text component;
  // truncating an option would silently change the exercise.
  const exerciseOverflow = type === "exercise" && items.length > 4;
  const normalizedType = exerciseOverflow ? "text" : type;
  if (
    !items.length && componentText && ["emphasis", "material"].includes(type)
  ) items.push(componentText);
  const result = component(normalizedType, {
    variant: text(raw.variant, "", 40) || undefined,
    role: exerciseOverflow
      ? "exercise-options-overflow"
      : text(raw.role, "", 40) || undefined,
    text: componentText,
    visual: readCoursewareVisual(
      raw.visual,
      Array.isArray(raw.relations) ? raw.relations : [],
    ),
    provenance: readCoursewareMaterialProvenance(raw.provenance),
    items,
    icon: ICON_NAMES.includes(String(raw.icon)) ? raw.icon : undefined,
    tone: ["accent", "secondary", "success", "warning", "neutral"].includes(
        String(raw.tone),
      )
      ? raw.tone
      : undefined,
    textStyle:
      ["bold", "underline", "marker", "accent"].includes(String(raw.textStyle))
        ? raw.textStyle
        : undefined,
  });
  if (
    ["title", "text", "question", "task", "exercise", "highlight"].includes(
      type,
    ) && !result.text
  ) throw new Error(`第 ${slideIndex + 1} 页的 ${type} 组件缺少 text。`);
  if (["bullet", "emphasis", "material"].includes(type) && !items.length) {
    throw new Error(`第 ${slideIndex + 1} 页的 ${type} 组件缺少 items。`);
  }
  if (type === "relation") {
    const relations: DirectRelation[] = Array.isArray(raw.relations)
      ? raw.relations.map((entry) => {
        const item = record(entry);
        return {
          label: text(item.label || item.title),
          value: text(item.value || item.description) || undefined,
          kind: text(item.kind, "flow"),
        };
      }).filter((item) => item.label).slice(0, 7)
      : items.map((item) => ({ label: item, kind: "flow" }));
    if (!relations.length && !result.visual) {
      throw new Error(`第 ${slideIndex + 1} 页的 relation 组件缺少关系节点。`);
    }
    result.relations = relations;
    result.items = relations.map((item) =>
      item.value ? `${item.label}：${item.value}` : item.label
    );
  }
  if (type === "card") {
    const comparison = parseComparison(raw);
    if (comparison) {
      result.comparison = comparison;
      result.items = [comparison.leftTitle, comparison.rightTitle];
      result.variant = "comparison";
    } else if (
      !result.text &&
      !(Array.isArray(result.items) && result.items.length > 0)
    ) {
      throw new Error(
        `第 ${slideIndex + 1} 页的 card 组件缺少 comparison 或卡片内容。`,
      );
    }
  }
  if (type === "data") {
    const data = parseData(raw.data);
    if (!data) {
      throw new Error(`第 ${slideIndex + 1} 页的 data 组件缺少完整数据。`);
    }
    result.data = data;
    result.items = data.labels;
    result.variant = "chart";
  }
  result.importance = type === "title" ||
      ["question", "card", "data", "task", "exercise", "highlight"].includes(
        type,
      )
    ? "primary"
    : ["shape", "illustration", "icon", "divider"].includes(type)
    ? "decorative"
    : result.importance;
  result.flexibility =
    ["bullet", "emphasis", "material", "relation", "task", "exercise"].includes(
        type,
      )
      ? "expandable"
      : ["title", "card", "data", "shape", "illustration", "icon", "divider"]
          .includes(type)
      ? "fixed"
      : result.flexibility;
  return result;
}

function directSlideContent(components: Raw[], savedImageValue?: unknown) {
  const find = (type: string, variant?: string) =>
    components.find((item) =>
      item.type === type && (variant === undefined || item.variant === variant)
    );
  const title = displayText(find("title")?.text);
  const textComponent = find("text");
  const questionComponent = find("question");
  const taskComponent = find("task");
  const exerciseComponent = find("exercise");
  const relationComponent = find("relation");
  const cardComponent = find("card", "comparison") || find("card");
  const dataComponent = find("data", "chart") || find("data");
  const imageComponent = find("image");
  const relations = Array.isArray(relationComponent?.relations)
    ? relationComponent.relations as DirectRelation[]
    : [];
  const comparison = parseComparison(cardComponent);
  const data = parseData(dataComponent?.data);
  const genericCards = components.filter((item) =>
    item.type === "card" && item.variant !== "comparison" && !item.comparison
  );
  const savedImage = record(savedImageValue);
  const hasSavedImage = Boolean(
    savedImage.url || savedImage.status || savedImage.error || savedImage.imagePrompt,
  );
  const imageComponentRole = String(
    savedImage.type || imageComponent?.role || "",
  ).toLowerCase();
  const imageComponentVariant = String(imageComponent?.variant || "")
    .toLowerCase();
  const inferredImageType =
    ["full-bleed", "full_bleed", "hero", "panoramic", "cover"].includes(
        imageComponentVariant,
      )
      ? "background"
      : imageComponentRole;
  const explicitCover = inferredImageType === "background" ||
    imageComponentVariant === "cover";
  return {
    hasDiagram: components.some((entry) =>
      entry.type === "relation" && entry.visual
    ),
    title,
    body: text(textComponent?.text, "", 300),
    question: text(questionComponent?.text, "", 300),
    task: text(taskComponent?.text, "", 300),
    bullets: strings(find("bullet")?.items, 6),
    summary: strings(find("emphasis")?.items, 6),
    highlights: components.filter((item) =>
      item.type === "highlight" && typeof item.text === "string" && item.text
    ),
    materials: strings(find("material")?.items, 6),
    steps: strings(taskComponent?.items, 6),
    relations,
    comparison,
    genericCards,
    data,
    exercise: exerciseComponent?.text
      ? {
        question: text(exerciseComponent.text, "", 300),
        options: strings(exerciseComponent.items, 4),
      }
      : undefined,
    image: imageComponent || hasSavedImage
      ? {
        ...savedImage,
        type:
          ["background", "illustration", "material"].includes(inferredImageType)
            ? inferredImageType
            : "illustration",
        status:
          ["placeholder", "ready", "failed"].includes(String(savedImage.status))
            ? String(savedImage.status)
            : "placeholder",
        url: text(savedImage.url, "", 2000) || undefined,
        alt: text(savedImage.alt || imageComponent?.text, "", 120) || undefined,
        fit: savedImage.fit === "contain" || !explicitCover
          ? "contain"
          : "cover",
        safeZone: ["left", "right", "top", "bottom", "center", "none"].includes(
            String(savedImage.safeZone),
          )
          ? String(savedImage.safeZone)
          : "left",
        imagePrompt: text(savedImage.imagePrompt || imageComponent?.text, "", 12000) || undefined,
      }
      : undefined,
  };
}

function assertDirectFunctionContent(
  fn: string,
  content: ReturnType<typeof directSlideContent>,
  index: number,
) {
  const hasInstructionalMaterial = Boolean(
    content.body || content.question || content.task ||
      content.bullets.length ||
      content.summary.length || content.highlights.length ||
      content.materials.length || content.steps.length ||
      content.relations.length || content.comparison || content.data ||
      content.exercise || content.image || content.hasDiagram ||
      content.genericCards.length,
  );
  const valid = fn === "F01_COVER"
    ? Boolean(content.title)
    : fn === "F02_SECTION"
    ? Boolean(content.title)
    : hasInstructionalMaterial;
  if (!valid) {
    throw new Error(
      `第 ${index + 1} 页（${fn}）缺少学生可见的核心教学素材。`,
    );
  }
}

function normalizeDirectCoursewareDeck(
  value: Raw,
  source: Source,
  options: CoursewareGenerationOptions,
  allowFixedSix = false,
) {
  const rawSlides = Array.isArray(value.slides) ? value.slides : [];
  const range = allowFixedSix ? { min: 6, max: 6 } : { min: 6, max: 35 };
  const isV4 = value.schemaVersion === COURSEWARE_SCHEMA_VERSION;
  if (rawSlides.length < range.min || rawSlides.length > range.max) {
    throw new Error(`课件规划页数必须在 ${range.min}—${range.max} 页之间。`);
  }
  if (
    record(rawSlides[0]).function !== "F01_COVER" ||
    record(rawSlides[rawSlides.length - 1]).function !== "F12_SUMMARY"
  ) throw new Error("课件必须以封面开始、以总结提升结束。");
  const slides = rawSlides.map((candidate, index) => {
    const item = record(candidate);
    const fn = String(item.function ?? "");
    if (!FUNCTIONS.includes(fn as typeof FUNCTIONS[number])) {
      throw new Error(`第 ${index + 1} 页页面功能不符合课件功能枚举。`);
    }
    const mode = item.visualMode === "V3" ? "V3" : item.visualMode === "V2" ? "V2" : options.visualMode;
    const layoutValue = canonicalDirectLayout(
      fn,
      String(item.layout ?? ""),
      mode,
    );
    if (
      !DIRECT_LAYOUT_PREFIXES[fn]?.some((prefix) =>
        layoutValue.startsWith(prefix)
      ) || !layoutValue.includes("_")
    ) throw new Error(`第 ${index + 1} 页布局不符合 ${fn} 的命名规范。`);
    const rawComponents = Array.isArray(item.components) ? item.components : [];
    if (rawComponents.length < 1 || rawComponents.length > 8) {
      throw new Error(`第 ${index + 1} 页组件数量必须在 1—8 个之间。`);
    }
    const { studentComponents, teacherNotes } = separateCoursewareAudience(
      rawComponents,
      item.teacherNotes,
    );
    const parsedComponents = studentComponents.map((componentValue) =>
      normalizeDirectComponent(componentValue, index)
    );
    if (
      parsedComponents.filter((componentValue) =>
        componentValue.type === "title"
      ).length !== 1
    ) throw new Error(`第 ${index + 1} 页必须且只能有一个 title 组件。`);
    const components = enrichVisualComponents(parsedComponents, fn, mode);
    const content = directSlideContent(components, item.image);
    assertDirectFunctionContent(fn, content, index);
    const intensity = ["L1", "L2", "L3"].includes(String(item.visualIntensity))
      ? String(item.visualIntensity)
      : defaultIntensity(fn, mode);
    const bodyLength = [
      content.body,
      content.question,
      content.task,
      content.exercise?.question,
      content.comparison?.common,
      content.data?.conclusion,
    ].filter(Boolean).join("").length;
    const allItems = [
      ...content.bullets,
      ...content.summary,
      ...content.materials,
      ...content.steps,
      ...(content.exercise?.options ?? []),
    ];
    const exerciseOverflow = components.some((componentValue) =>
      componentValue.role === "exercise-options-overflow"
    );
    const warnings = [
      ...(content.title.length > 28
        ? ["页面标题较长，可能需要人工调整。"]
        : []),
      ...(bodyLength > 140 ? ["页面正文超过 140 字，建议拆分或精简。"] : []),
      ...(allItems.length > 6 ? ["页面列表超过 6 条。"] : []),
      ...(allItems.some((entry) => entry.length > 25)
        ? ["存在单条文字超过 25 字的列表项。"]
        : []),
      ...(exerciseOverflow
        ? ["练习选项超过 4 个，已改用原生正文组件完整保留。"]
        : []),
    ];
    return {
      slideId: `s${String(index + 1).padStart(2, "0")}`,
      index,
      function: fn,
      pageFunction: pageFunction(item.pageFunction, fn, isV4),
      teachingPhase: teachingPhase(item.teachingPhase, fn),
      sourceMapping: readSourceMapping(item.sourceMapping),
      teacherNotes,
      visualMode: mode,
      visualIntensity: intensity,
      visualPrototype: text(item.visualPrototype, "", 60) || undefined,
      layout: layoutValue,
      title: content.title,
      eyebrow: text(item.eyebrow, "", 80) || undefined,
      imageDescription: text(item.imageDescription, "", 4000) || undefined,
      body: content.body || undefined,
      question: content.question || undefined,
      task: content.task || undefined,
      bullets: content.bullets,
      summary: content.summary,
      materials: content.materials,
      steps: content.steps,
      relations: content.relations,
      comparison: content.comparison,
      data: content.data,
      image: content.image,
      imagePrompt: text(item.imagePrompt || record(content.image).imagePrompt, "", 12000) || undefined,
      exercise: content.exercise,
      components,
      qa: {
        passed: warnings.length === 0,
        warnings,
        density: bodyLength > 140 || allItems.length > 6
          ? "D3"
          : bodyLength > 80 || allItems.length > 4
          ? "D2"
          : "D1",
        visualComplexity: components.some((entry) =>
            ["image", "illustration", "icon"].includes(String(entry.type))
          )
          ? "VC2"
          : "VC1",
      },
    };
  });
  const subjectProfile = text(
    value.subjectProfile,
    source.subjectProfile || normalizeCoursewareSubjectProfile(source.subject),
    50,
  );
  const lessonGenre = text(
    value.lessonGenre,
    source.lessonGenre || "general",
    50,
  );
  const colorScheme =
    value.colorScheme === undefined && options.colorScheme === undefined
      ? undefined
      : normalizeCoursewareColorScheme(
        options.colorScheme ?? value.colorScheme,
      );
  const fontPairing =
    value.fontPairing === undefined && options.fontPairing === undefined
      ? undefined
      : normalizeCoursewareFontPairing(
        options.fontPairing ?? value.fontPairing,
      );
  const animationPreset = normalizeCoursewareAnimationPreset(
    options.animationPreset ?? value.animationPreset,
  );
  const flatPattern = normalizeCoursewareFlatPattern(
    options.flatPattern ?? value.flatPattern,
  );
  return {
    schemaVersion: isV4
      ? COURSEWARE_SCHEMA_VERSION
      : PREVIOUS_DIRECT_SCHEMA_VERSION,
    subjectProfile,
    lessonGenre,
    visualMode: options.visualMode,
    outputMode: options.outputMode,
    length: options.length,
    imageStrategy: options.imageStrategy,
    colorScheme,
    fontPairing,
    animationPreset,
    flatPattern,
    title: text(value.title, source.topic || "HAI 课堂课件", 120),
    subtitle: text(
      value.subtitle,
      `${source.grade || "课堂"} · ${source.subject || "教学设计"}`,
      240,
    ),
    source: { ...source, subjectProfile, lessonGenre },
    theme: coursewareTheme(colorScheme, fontPairing),
    visualProfile: coursewareVisualProfile(value.visualProfile, colorScheme),
    slides,
  };
}

export function normalizeCoursewareDeck(
  rawOutput: string,
  source: Source,
  requestedOptions?: Partial<CoursewareGenerationOptions>,
) {
  const value = parseCoursewareJson(rawOutput);
  const rawSlides = Array.isArray(value.slides) ? value.slides : [];
  if (
    value.schemaVersion === COURSEWARE_SCHEMA_VERSION ||
    value.schemaVersion === PREVIOUS_DIRECT_SCHEMA_VERSION
  ) {
  const options: CoursewareGenerationOptions = {
      visualMode: mode(requestedOptions?.visualMode ?? value.visualMode, "V1"),
      outputMode: outputMode(requestedOptions?.outputMode ?? value.outputMode),
      length: length(
        requestedOptions?.length ?? value.length,
        rawSlides.length > RANGES.compact.max ? "standard" : "compact",
      ),
      imageStrategy: strategy(
        requestedOptions?.imageStrategy ?? value.imageStrategy,
        "smart",
      ),
      colorScheme: requestedOptions?.colorScheme ??
        value.colorScheme as CoursewareColorSchemeId | undefined,
      fontPairing: requestedOptions?.fontPairing ??
        value.fontPairing as CoursewareFontPairingId | undefined,
      animationPreset: requestedOptions?.animationPreset ??
        value.animationPreset as CoursewareAnimationPreset | undefined,
      flatPattern:
        mode(requestedOptions?.visualMode ?? value.visualMode, "V1") === "V2"
          ? "none"
          : requestedOptions?.flatPattern ??
            value.flatPattern as CoursewareFlatPattern | undefined,
    };
    return normalizeDirectCoursewareDeck(
      value,
      source,
      options,
      requestedOptions === undefined && rawSlides.length === 6,
    );
  }
  const legacy = value.schemaVersion === "hai_courseware_deck_v1" ||
    (requestedOptions === undefined && rawSlides.length === 6);
  const visualMode = mode(
    requestedOptions?.visualMode ?? value.visualMode,
    "V1",
  );
  const selectedOutputMode = outputMode(requestedOptions?.outputMode ?? value.outputMode);
  const selectedLength = length(
    requestedOptions?.length ?? value.length,
    "compact",
  );
  const imageStrategy = strategy(
    requestedOptions?.imageStrategy ?? value.imageStrategy,
    visualMode === "V2" ? "enhanced" : "smart",
  );
  const colorScheme = value.colorScheme === undefined &&
      requestedOptions?.colorScheme === undefined
    ? undefined
    : normalizeCoursewareColorScheme(
      requestedOptions?.colorScheme ?? value.colorScheme,
    );
  const fontPairing = value.fontPairing === undefined &&
      requestedOptions?.fontPairing === undefined
    ? undefined
    : normalizeCoursewareFontPairing(
      requestedOptions?.fontPairing ?? value.fontPairing,
    );
  const animationPreset = normalizeCoursewareAnimationPreset(
    requestedOptions?.animationPreset ?? value.animationPreset,
  );
  const flatPattern = visualMode === "V2"
    ? "none"
    : normalizeCoursewareFlatPattern(
      requestedOptions?.flatPattern ?? value.flatPattern,
    );
  if (legacy) {
    if (
      rawSlides.some((item, index) =>
        record(item).function !== LEGACY_FUNCTIONS[index]
      )
    ) throw new Error("页面功能不符合固定课件顺序。");
  } else {
    const range = RANGES[selectedLength];
    if (rawSlides.length < range.min || rawSlides.length > range.max) {
      throw new Error(`课件规划页数必须在 ${range.min}—${range.max} 页之间。`);
    }
    if (
      record(rawSlides[0]).function !== "F01_COVER" ||
      record(rawSlides[rawSlides.length - 1]).function !== "F12_SUMMARY"
    ) throw new Error("课件必须以封面开始、以总结提升结束。");
  }
  const slides = rawSlides.map((candidate, index) => {
    const item = record(candidate);
    const fn = FUNCTIONS.includes(item.function as typeof FUNCTIONS[number])
      ? item.function as string
      : "";
    if (!fn || legacy && fn !== LEGACY_FUNCTIONS[index]) {
      throw new Error(`第 ${index + 1} 页页面功能不符合课件功能枚举。`);
    }
    const slideMode = mode(item.visualMode, visualMode);
    const slideLayout = legacy
      ? ({
        F01_COVER: "C01_COVER_CENTER",
        F03_CONTEXT: "C02_CONTEXT_QUESTION",
        F05_CONTENT: "C03_CONTENT_BULLETS",
        F10_ACTIVITY: "C04_CARD",
        F11_EXERCISE: "C04_CARD",
        F12_SUMMARY: "C03_CONTENT_BULLETS",
      } as Record<string, string>)[fn]
      : layout(fn, slideMode, item);
    const title = text(item.title, index === 0 ? source.topic : label(fn), 120);
    const body = text(item.body);
    const question = text(item.question, "", 300);
    const task = text(item.task, "", 300);
    const bullets = strings(item.bullets, 6);
    const summary = strings(item.summary, 6);
    const materials = strings(item.materials, 6);
    const steps = strings(item.steps, 6);
    const exerciseValue = record(item.exercise);
    const exerciseQuestion = text(exerciseValue.question, "", 300);
    const exerciseOptions = strings(exerciseValue.options, 4);
    const rawImage = record(item.image);
    const wantsImage = slideMode === "V2" && imageStrategy !== "minimal" ||
      Boolean(rawImage.type);
    const image = wantsImage
      ? {
        type: text(
          rawImage.type,
          fn === "F06_OBSERVATION" ? "material" : "illustration",
        ),
        status: rawImage.url ? "ready" : "placeholder",
        url: text(rawImage.url) || undefined,
        alt: text(rawImage.alt, title, 120),
        fit: rawImage.fit === "contain" ? "contain" : "cover",
        safeZone: text(rawImage.safeZone, "left"),
      }
      : undefined;
    const relations = Array.isArray(item.relations)
      ? item.relations.map((entry) => {
        const raw = record(entry);
        return {
          label: text(raw.label || raw.title),
          value: text(raw.value || raw.description),
          kind: text(raw.kind, "flow"),
        };
      }).filter((entry) => entry.label).slice(0, 7)
      : [];
    const comparisonValue = record(item.comparison);
    const comparison = comparisonValue.leftTitle || comparisonValue.rightTitle
      ? {
        leftTitle: text(comparisonValue.leftTitle),
        leftItems: strings(comparisonValue.leftItems, 6),
        rightTitle: text(comparisonValue.rightTitle),
        rightItems: strings(comparisonValue.rightItems, 6),
        common: text(comparisonValue.common) || undefined,
      }
      : undefined;
    const dataValue = record(item.data);
    const dataLabels = strings(dataValue.labels, 5, 30);
    const dataValues = Array.isArray(dataValue.values)
      ? dataValue.values.map((entry) => Number(entry)).filter((entry) =>
        Number.isFinite(entry)
      ).slice(0, 5)
      : [];
    const data = dataLabels.length && dataValues.length
      ? {
        labels: dataLabels,
        values: dataValues,
        unit: text(dataValue.unit, "", 30) || undefined,
        conclusion: text(dataValue.conclusion) || undefined,
      }
      : undefined;
    const allItems = [
      ...bullets,
      ...summary,
      ...materials,
      ...steps,
      ...exerciseOptions,
    ];
    const bodyLength = [
      body,
      question,
      task,
      exerciseQuestion,
      comparison?.common,
      data?.conclusion,
    ].filter(Boolean).join("").length;
    const warnings = [
      ...(title.length > 28 ? ["页面标题较长，可能需要人工调整。"] : []),
      ...(bodyLength > 140 ? ["页面正文超过 140 字，建议拆分或精简。"] : []),
      ...(allItems.length > 6 ? ["页面列表超过 6 条。"] : []),
      ...(allItems.some((entry) => entry.length > 25)
        ? ["存在单条文字超过 25 字的列表项。"]
        : []),
      ...(relations.length > 7 ? ["关系节点超过 7 个，建议拆解为多页。"] : []),
      ...(image?.status === "placeholder"
        ? ["视觉素材尚未配置，当前使用图片占位。"]
        : []),
    ];
    const components = buildComponents({
      functionName: fn,
      visualMode: slideMode,
      title,
      body,
      question,
      task,
      bullets,
      summary,
      materials,
      steps,
      relations,
      comparison,
      data,
      exerciseQuestion,
      exerciseOptions,
      image,
    });
    const slide = {
      slideId: `s${String(index + 1).padStart(2, "0")}`,
      index,
      function: fn,
      pageFunction: pageFunction(item.pageFunction, fn, false),
      teachingPhase: teachingPhase(item.teachingPhase, fn),
      visualMode: slideMode,
      visualIntensity: ["L1", "L2", "L3"].includes(String(item.visualIntensity))
        ? item.visualIntensity
        : defaultIntensity(fn, slideMode),
      visualPrototype: text(item.visualPrototype, "", 60) || undefined,
      layout: slideLayout,
      title,
      eyebrow: text(item.eyebrow, "", 80) || undefined,
      imageDescription: text(item.imageDescription, "", 4000) || undefined,
      body,
      question,
      task,
      bullets,
      summary,
      materials,
      steps,
      relations,
      comparison,
      data,
      image,
      exercise: exerciseQuestion
        ? { question: exerciseQuestion, options: exerciseOptions }
        : undefined,
      components,
      qa: {
        passed: warnings.length === 0,
        warnings,
        density: bodyLength > 140 || allItems.length > 6
          ? "D3"
          : bodyLength > 80 || allItems.length > 4
          ? "D2"
          : "D1",
        visualComplexity: image ? "VC2" : "VC1",
      },
    };
    if (!hasContent(fn, item)) {
      throw new Error(
        `第 ${index + 1} 页（${fn}）内容不足，无法生成课件；请先补全教学设计。`,
      );
    }
    return slide;
  });
  const subjectProfile = source.subjectProfile ||
    normalizeCoursewareSubjectProfile(source.subject);
  const lessonGenre = source.lessonGenre || "general";
  return {
    schemaVersion: legacy ? "hai_courseware_deck_v1" : "hai_courseware_deck_v2",
    subjectProfile,
    lessonGenre,
    visualMode,
    outputMode: selectedOutputMode,
    length: selectedLength,
    imageStrategy,
    colorScheme,
    fontPairing,
    animationPreset,
    flatPattern,
    title: text(value.title, source.topic || "HAI 课堂课件", 120),
    subtitle: text(
      value.subtitle,
      `${source.grade || "课堂"} · ${source.subject || "教学设计"}`,
      240,
    ),
    source: { ...source, subjectProfile, lessonGenre },
    theme: coursewareTheme(colorScheme, fontPairing),
    visualProfile: coursewareVisualProfile(value.visualProfile, colorScheme),
    slides,
  };
}

export function buildCoursewarePrompt(
  markdown: string,
  source: Source,
  options?: CoursewareGenerationOptions,
) {
  if (!options) {
    return `你是课堂课件规划器。只依据下面已完成的教学设计生成 hai_courseware_deck_v3 JSON，必须生成恰好 6 页，顺序为 F01_COVER、F03_CONTEXT、F05_CONTENT、F10_ACTIVITY、F11_EXERCISE、F12_SUMMARY；每页必须使用 components 数组且只能使用已定义的组件类型；不要编造教学设计中没有的事实、数据、教材内容或答案。\n来源：${source.subject}，${source.grade}，${source.topic}\n教学设计：\n${
      markdown.slice(0, 100000)
    }`;
  }
  const visualDirection = options.visualMode === "V2"
    ? "V2 的统一配色、插画媒介、光线、质感和写实程度由大模型根据课程内容确定并写入 visualProfile；visualKeywords 只描述风格属性，不写某一页的具体景物、人物或物体；不使用预设配色，不添加代码扁平背景图案；每页都必须有独立的 16:9 整页背景图描述。"
      : options.visualMode === "V3"
      ? "V3 纯图片PPT：每页最终只保留一张 16:9、1K 图片，图片本身必须承载全部学生可见文字；大纲必须为后续逐页生图提示词转换保留完整文字和具体画面需求。"
      : "V1 使用背景色、克制的几何图案和原生排版，不启用 AI 背景配图。";
  const subjectProfile = source.subjectProfile ||
    normalizeCoursewareSubjectProfile(source.subject);
  const lessonGenre = source.lessonGenre || "general";
  return `你是 HAI 课堂课件的 Deck Plan 规划器。只依据下面已完成的教学设计输出 JSON，不要输出 Markdown、解释、代码围栏或图片二进制。${
    options.length === "compact"
      ? "精简版页数目标为 11—20 页"
      : "标准版页数目标为 21—35 页"
  }，建议页数为 ${
    options.length === "compact" ? 10 : 14
  }；页数是组织偏好，教案中的核心问题、任务、练习和总结素材无法在目标页数内完整呈现时可以超出，不得为适配页数删项。必须以 F01_COVER 开始、F12_SUMMARY 结束；中间只选择教学设计确实需要的功能，不得为了凑页数编造内容。每页只承担一个主要教学动作。

内容优先级：以来源教案的教学流程/教学过程为主线，保持环节和任务的原顺序、原编号。封面后第一张教学页对应首个教学环节，不用学情分析中的课前诊断替代该环节。每个核心问题、题目条件、学生操作和产出要求必须完整保留；长内容拆页，不能变成结论摘要。先呈现任务，后呈现来源已有的答案/反馈，不提前公开预期回答或证明。
每页填写 sourceMapping={section:原环节标题,task:原任务编号名称或空字符串,sourceExcerpt:对应任务原文摘录} 和 teacherNotes:string[]。eyebrow 或 title.text 显示原环节/任务编号。components 全部面向学生，教师巡视、分支处理、错误预判等仅放 teacherNotes，不放 highlight/text/card 等投屏组件。
pageFunction 先确定本页学生屏幕上的必显素材：总结页完整呈现教案要求收束的概念、定义、原理、方法、结论和观念；练习页完整呈现每道题的题干、条件、选项及作答要求；任务页完整呈现情境、材料、学生动作、步骤和产出。内容过多时拆成连续的同功能页，不能为适配字数或布局删项。pageFunction 同时判断是否存在教学性配图需求，并确定图中必须表达的对象、标签和关系。
先在内部逐项核对必显素材，再把每项素材一次性写进 components，不另行输出 contentPlan 或 requiredContent。组件只决定用 text、question、exercise、task、card、comparison、data、image 或 relation 等何种形式承载；不得建立 pageFunction 与组件类型的一一绑定，也不得用某个组件类型是否出现判断功能完成。function/layout 只决定渲染能力和空间安排，不能反向删改素材。
组件 title.text 是最终标题，text.text 是最终正文或完整材料；question/task/exercise.text 是最终题目/任务，items 是实际步骤/选项；comparison、data 和 relation 的学生可见字段也填写最终文字。不要写“这里显示核心问题”等元说明，不根据 role 让渲染器重新写作。没有正文需要时可不放 text。同页多个同类型组件按数组顺序显示，不把长题干塞进装饰组件。
配图需要明确 visual={kind,purpose,description,sourceExcerpt,nodes,edges,intersectionItems}：普通图片 type=image，kind=photo|illustration，description 写实际主体、动作/状态、场景与观察重点，组件 text 只写学生可见图注；知识图示 type=relation，kind=mind_map|concept_map|structure_diagram|flowchart|venn。nodes=[{id,label,items}] 写实际节点/分区文字，edges=[{from,to,relation,label}] 写具体连接；relation=link|contains|subset|proper_subset|equal|overlap|disjoint。维恩图每张两个集合，明确包含方向/相等/相交/不交及各区域元素；intersectionItems 写交集元素；一般 subset 不能默认画成真包含。知识结构图不受V1禁用装饰图片限制。图示内容必须来源可靠且不提前揭示待探究答案；无配图需求不输出 visual。description/purpose/sourceExcerpt 属于制作说明，不是投屏正文。V2 每页 image 都是 16:9 的整页 background，图片主体须依据本页配图描述和文字安全区安排，文字由PPT原生组件独立叠放。

输出 schemaVersion=hai_courseware_deck_v4，顶层填写 subjectProfile=${subjectProfile}、lessonGenre=${lessonGenre}。每页除 function、layout、components 外，必须填写 pageFunction 和 teachingPhase。pageFunction 使用已加载 Skill 中的公共或当前学科功能页 ID；teachingPhase 只能是 opening|diagnosis|construction|practice|feedback|transfer|closure。pageFunction 是整页教学职责，function 只是渲染布局族。

可用页面功能：${
    FUNCTIONS.join(", ")
  }。视觉模式：${options.visualMode}。图片策略：${options.imageStrategy}。字体组合：${
    normalizeCoursewareFontPairing(
      options.fontPairing ?? DEFAULT_COURSEWARE_FONT_PAIRING,
    )
  }。动画：${
    normalizeCoursewareAnimationPreset(
      options.animationPreset ?? DEFAULT_COURSEWARE_ANIMATION_PRESET,
    )
  }。${visualDirection} 视觉选项由渲染器确定，不得因样式选择删改教学内容。
视觉一致性只约束整套课件的色调、字体、插画媒介、光线、质感、写实程度和构图语言；每页 image 的具体景物、人物、物体和场景必须只依据本页教学素材决定，不得把封面或某个案例的视觉对象复制到其他页面。visualProfile.visualKeywords 只写风格属性，不写具体案例对象。
Layout 必须逐字使用以下 ID，不得输出 cover、section、context、content 等泛化名称：F01_COVER=C01_COVER_LEFT_VISUAL|C02_COVER_CENTER|C03_COVER_FULL_VISUAL|C04_COVER_BIG_TYPE；F02_SECTION=S01_SECTION_NUMBER|S02_SECTION_NAV|S03_SECTION_PATH；F03_CONTEXT=I01_IMAGE_QUESTION|I02_LEFT_IMAGE_RIGHT_CONTEXT|I03_CASE_CARD|I04_MULTI_IMAGE_OBSERVATION|Q01_BIG_QUESTION；F04_CORE_QUESTION=Q01_BIG_QUESTION|Q02_QUESTION_CHOICES|Q03_QUESTION_CHAIN；F05_CONTENT=K01_TITLE_BODY|K02_CONCEPT_EXAMPLE|K03_CONCLUSION_POINTS|K04_CENTER_CONCEPT；F06_OBSERVATION=O01_IMAGE_ANNOTATION|O02_MATERIAL_QUESTION|O03_MATERIAL_EVIDENCE；F07_RELATION=R01_FLOW|R02_STEP_NODES|R03_CAUSE_EFFECT|R04_HIERARCHY|R05_TIMELINE|R06_CYCLE；F08_COMPARISON=B01_TWO_COLUMNS|B02_COMMON_DIFFERENCE|B03_TRUE_FALSE|B04_COMPARISON_MATRIX；F09_DATA=D01_BIG_NUMBER|D02_CHART_CONCLUSION|D03_METRIC_CARDS；F10_ACTIVITY=A01_TASK_CARD|A02_THREE_STEPS|A03_GROUP_TASK|A04_MATERIAL_TASK；F11_EXERCISE=E01_SINGLE_QUESTION|E02_MULTIPLE_CHOICE|E03_JUDGEMENT_REASON|E04_TRANSFER_TASK；F12_SUMMARY=T01_THREE_POINTS|T02_KNOWLEDGE_STRUCTURE|T03_RETURN_QUESTION|T04_NEXT_QUESTION。

输出结构：{"schemaVersion":"hai_courseware_deck_v4","subjectProfile":string,"lessonGenre":string,"title":string,"subtitle":string,"visualProfile":{"illustrationStyle":string,"palette":string[],"lighting":string,"texture":string,"realismLevel":string,"visualKeywords":string[]},"slides":[{"pageFunction":string,"teachingPhase":"opening|diagnosis|construction|practice|feedback|transfer|closure","function":string,"visualPrototype":"hero_image|statement|two_column|concept_centered|comparison|flow|timeline|card_grid|question|material_observation|data_story|task_steps|summary_map","layout":string,"visualIntensity":"L1|L2|L3","eyebrow":string,"sourceMapping":{"section":string,"task":string,"sourceExcerpt":string},"teacherNotes":string[],"components":[{"type":"title|text|question|bullet|emphasis|highlight|material|task|relation|card|data|exercise|image|illustration|icon|media|divider|shape","variant":string,"role":string,"text":string,"items":string[],"icon":"idea|question|target|evidence|compare|data|activity|summary|people|book|warning|quote|spark|process","tone":"accent|secondary|success|warning|neutral","textStyle":"bold|underline|marker|accent","visual":{"kind":"photo|illustration|mind_map|concept_map|structure_diagram|flowchart|venn","purpose":string,"description":string,"sourceExcerpt":string,"nodes":[{"id":string,"label":string,"items":string[]}],"edges":[{"from":string,"to":string,"relation":"link|contains|subset|proper_subset|equal|overlap|disjoint","label":string}],"intersectionItems":string[]},"relations":[{"label":string,"value":string,"kind":"flow|cause|level|time|cycle"}],"comparison":{"leftTitle":string,"leftItems":string[],"rightTitle":string,"rightItems":string[],"common":string},"data":{"labels":string[],"values":number[],"unit":string,"conclusion":string}}]}]}

约束：任何页面最多 8 个组件，必须且只能有一个 title；其余组件数量只由必显素材决定。每页可使用 0—2 个 icon、divider 或 shape 增强层次，先保证核心任务完整；这些装饰组件不得引入新的教材事实。highlight 的 text 必须截取或改写自本页已有内容，并通过 textStyle 指定 bold、underline、marker 或 accent。所有组件必须来自上面的类型枚举。不要输出坐标、宽高或任意 CSS，layout 只使用已有 Layout 名称。核心文字、流程、关系图和基础数据图保持原生 PPT 可编辑；不要编造教学设计没有的事实、数据、教材内容或答案；正文单页目标不超过 100 字，超过 140 字优先拆页；完整题干/材料不受25字截断，不为了字数删条件；列表优先不超过6条。exercise 组件的 items 是选择题选项或分项要求，最多 4 项；来源题目超过 4 个选项时，不要硬塞进 exercise，应拆成连续练习页，或使用 text/material 组件完整保留全部选项。除封面和纯过渡页外，每页至少有一项学生可见的核心教学素材；它可以落在任一种适合的内容组件中。总结页可以用 text、bullet、emphasis、card/comparison 或 relation；练习页可以用 question、exercise、text 或 material；任务页可以用 task、question、text、material 或其他能完整呈现任务的内容组件。没有真实数据、材料或练习时，不得添加对应内容，也不得为了达到数量而重复或编造内容。图片仅输出需求描述，不生成图片，不在图片中写字、logo 或水印。${
    options.visualMode === "V2"
      ? "V2 关键页可输出 image 描述，并优先使用 solid icon、layered-orbit illustration 与 bold divider；没有图片 Provider 时必须允许纯色/占位回退。"
      : "V1 默认不使用装饰图片；可以使用必要的教学材料图片、知识图示、原生 outline icon 和 thin divider。"
  }

来源：${source.subject}，${source.grade}，${source.topic}
教学设计：
${markdown.slice(0, 100000)}`;
}
