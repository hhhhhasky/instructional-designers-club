import { imagePromptValue, renderImagePrompt, type ImagePromptOverrides } from "./hai_image_prompt_catalog.ts";
import { parseCoursewareJson } from "./hai_courseware.ts";
import { normalizeCoursewareSubjectProfile } from "./hai_courseware_skill.ts";

type Raw = Record<string, unknown>;

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

type Options = {
  visualMode: "V1" | "V2" | "V3";
  outputMode?: "ppt" | "interactive";
  length: "compact" | "standard";
  imageStrategy: "minimal" | "smart" | "enhanced";
  colorScheme?: string;
  fontPairing?: string;
  animationPreset?: string;
  flatPattern?: string;
};

export type CoursewareSourcePack = {
  inputSnapshot: Raw;
  textbookSections: Array<{
    id: string;
    title: string;
    content: string;
    contentType: string;
    verification: string;
  }>;
  userMaterials: Array<{
    id: string;
    title: string;
    kind: string;
    content: string;
  }>;
  caseMaterials: Array<{
    id: string;
    title: string;
    content: string;
    sourceUrls: string[];
    verification: string;
  }>;
};

export type CoursewareSupplement = {
  id: string;
  trigger: string;
  sourceSection: string;
  title: string;
  content: string;
  teachingPurpose: string;
  sourceType:
    | "lesson_plan"
    | "textbook"
    | "user_material"
    | "case_library"
    | "generated_adaptation";
  sourceTitle: string;
  fidelity: "verbatim" | "adapted" | "generated";
  verification: "verified" | "needs_review";
};

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

const PHASES = [
  "opening",
  "diagnosis",
  "construction",
  "practice",
  "feedback",
  "transfer",
  "closure",
] as const;

const MATERIAL_KINDS = [
  "title",
  "body",
  "text",
  "question",
  "points",
  "task",
  "exercise",
  "comparison",
  "relation",
  "data",
  "image",
] as const;

const COMPONENT_TYPES = [
  "title",
  "text",
  "question",
  "bullet",
  "emphasis",
  "highlight",
  "material",
  "task",
  "relation",
  "card",
  "data",
  "exercise",
  "image",
  "illustration",
  "icon",
  "divider",
  "shape",
] as const;

const DECORATIVE_TYPES = new Set(["icon", "divider", "shape", "illustration"]);

const DESIGN_COMPONENT_TYPE_ALIASES: Record<string, string> = {
  points: "bullet",
  comparison: "card",
};

const DESIGN_LAYOUTS: Record<string, string[]> = {
  F01_COVER: [
    "C01_COVER_LEFT_VISUAL",
    "C02_COVER_CENTER",
    "C03_COVER_FULL_VISUAL",
    "C04_COVER_BIG_TYPE",
  ],
  F02_SECTION: ["S01_SECTION_NUMBER", "S02_SECTION_NAV", "S03_SECTION_PATH"],
  F03_CONTEXT: [
    "I01_IMAGE_QUESTION",
    "I02_LEFT_IMAGE_RIGHT_CONTEXT",
    "I03_CASE_CARD",
    "I04_MULTI_IMAGE_OBSERVATION",
    "Q01_BIG_QUESTION",
  ],
  F04_CORE_QUESTION: [
    "Q01_BIG_QUESTION",
    "Q02_QUESTION_CHOICES",
    "Q03_QUESTION_CHAIN",
  ],
  F05_CONTENT: [
    "K01_TITLE_BODY",
    "K02_CONCEPT_EXAMPLE",
    "K03_CONCLUSION_POINTS",
    "K04_CENTER_CONCEPT",
  ],
  F06_OBSERVATION: [
    "O01_IMAGE_ANNOTATION",
    "O02_MATERIAL_QUESTION",
    "O03_MATERIAL_EVIDENCE",
  ],
  F07_RELATION: [
    "R01_FLOW",
    "R02_STEP_NODES",
    "R03_CAUSE_EFFECT",
    "R04_HIERARCHY",
    "R05_TIMELINE",
    "R06_CYCLE",
  ],
  F08_COMPARISON: [
    "B01_TWO_COLUMNS",
    "B02_COMMON_DIFFERENCE",
    "B03_TRUE_FALSE",
    "B04_COMPARISON_MATRIX",
  ],
  F09_DATA: ["D01_BIG_NUMBER", "D02_CHART_CONCLUSION", "D03_METRIC_CARDS"],
  F10_ACTIVITY: [
    "A01_TASK_CARD",
    "A02_THREE_STEPS",
    "A03_GROUP_TASK",
    "A04_MATERIAL_TASK",
  ],
  F11_EXERCISE: [
    "E01_SINGLE_QUESTION",
    "E02_MULTIPLE_CHOICE",
    "E03_JUDGEMENT_REASON",
    "E04_TRANSFER_TASK",
  ],
  F12_SUMMARY: [
    "T01_THREE_POINTS",
    "T02_KNOWLEDGE_STRUCTURE",
    "T03_RETURN_QUESTION",
    "T04_NEXT_QUESTION",
  ],
};

function normalizeDesignLayout(value: unknown, pageFunction: string) {
  const requested = optionalText(value, 100);
  const allowed = DESIGN_LAYOUTS[pageFunction] ?? [];
  return requested && allowed.includes(requested) ? requested : allowed[0];
}

const COMPATIBLE_COMPONENTS: Record<string, string[]> = {
  title: ["title"],
  text: ["text", "highlight", "card", "material"],
  question: ["question", "text", "card", "exercise"],
  points: ["bullet", "emphasis", "card", "material"],
  task: ["task", "text", "card", "material"],
  exercise: ["exercise", "question", "text", "card"],
  comparison: ["card"],
  relation: ["relation", "card", "bullet"],
  data: ["data", "card"],
  image: ["image"],
};

function record(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Raw
    : {};
}

function requiredText(value: unknown, label: string, limit = 8000) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) throw new Error(`${label}不能为空。`);
  if (result.length > limit) throw new Error(`${label}过长。`);
  return result;
}

function optionalText(value: unknown, limit = 8000) {
  const result = typeof value === "string" ? value.trim() : "";
  return result ? result.slice(0, limit) : undefined;
}

function stringArray(value: unknown, label: string, max = 20) {
  if (!Array.isArray(value)) return [];
  const items = value.map((item) => requiredText(item, label, 1000));
  if (items.length > max) throw new Error(`${label}数量过多。`);
  return items;
}

export type CoursewareMaterial = {
  id: string;
  kind: typeof MATERIAL_KINDS[number];
  text?: string;
  items?: string[];
  comparison?: Raw;
  relations?: Raw[];
  data?: Raw;
  visual?: Raw;
  supplementRef?: string;
  provenance?: Raw;
};

export type CoursewareManuscriptPage = {
  pageId: string;
  function: typeof FUNCTIONS[number];
  pageFunction: string;
  teachingPhase: typeof PHASES[number];
  eyebrow?: string;
  imageDescription?: string;
  sourceMapping: {
    section: string;
    task: string;
    sourceExcerpt: string;
  };
  teacherNotes: string[];
  materials: CoursewareMaterial[];
};

export type CoursewareManuscript = {
  markdown: string;
  pages: CoursewareManuscriptPage[];
};

export type CoursewareOutline = CoursewareManuscript;

const INTERACTIVE_WEB_COMPONENT_TYPES = [
  "hero",
  "prose",
  "callout",
  "reveal",
  "tabs",
  "steps",
  "comparison",
  "data",
  "quiz",
  "true_false",
  "sort",
  "timeline",
  "media",
] as const;

type InteractiveWebComponentType =
  typeof INTERACTIVE_WEB_COMPONENT_TYPES[number];

type InteractiveWebDesign = {
  schemaVersion: "hai_web_component_design_v1";
  scenes: Array<Record<string, unknown>>;
};

function interactiveMaterialText(material: CoursewareMaterial) {
  return material.text || material.items?.join("\n") ||
    material.relations?.map((item) => {
      const relation = record(item);
      return [
        optionalText(relation.label, 300),
        optionalText(relation.value, 300),
      ]
        .filter(Boolean).join("：");
    }).filter(Boolean).join("\n") || "";
}

function interactiveMaterialItems(material: CoursewareMaterial) {
  if (material.items?.length) return material.items;
  const text = material.text?.trim() || "";
  return text.split(/\n\s*(?:\n|[-•●▪]|\d+[.)、])\s*/u).map((item) =>
    item.trim()
  ).filter(Boolean);
}

function interactiveRefs(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => optionalText(item, 60)).filter(
      Boolean,
    ) as string[];
  }
  const single = optionalText(value, 60);
  return single ? [single] : [];
}

function interactiveDesignComponentType(
  value: unknown,
): InteractiveWebComponentType | undefined {
  const type = optionalText(value, 40) as
    | InteractiveWebComponentType
    | undefined;
  return type && INTERACTIVE_WEB_COMPONENT_TYPES.includes(type)
    ? type
    : undefined;
}

function normalizeMaterial(
  value: unknown,
  pageId: string,
  supplements: Map<string, CoursewareSupplement>,
  preserveSupplementText = false,
): CoursewareMaterial {
  const item = record(value);
  const id = requiredText(item.id, `${pageId} 素材 ID`, 60);
  if (
    !new RegExp(`^${pageId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-M\\d{2}$`)
      .test(id)
  ) {
    throw new Error(`${pageId} 的素材 ID 必须使用 ${pageId}-M01 格式。`);
  }
  const kind = String(item.kind ?? "") as CoursewareMaterial["kind"];
  if (!MATERIAL_KINDS.includes(kind)) {
    throw new Error(`${id} 的素材类型不合法。`);
  }

  const supplementRef = optionalText(item.supplementRef, 40);
  const normalized: CoursewareMaterial = { id, kind };
  if (
    ["title", "body", "text", "question", "task", "exercise", "image"].includes(
      kind,
    ) &&
    !(supplementRef && ["text", "body"].includes(kind))
  ) {
    normalized.text = requiredText(item.text, `${id} 的显示文本`);
  }
  if (["points", "task", "exercise"].includes(kind)) {
    const items = stringArray(item.items, `${id} 的条目`);
    if (kind === "points" && items.length === 0) {
      throw new Error(`${id} 必须包含条目。`);
    }
    if (items.length) normalized.items = items;
  }
  if (kind === "comparison") {
    const comparison = record(item.comparison);
    const normalizedComparison = {
      leftTitle: requiredText(comparison.leftTitle, `${id} 左侧标题`, 200),
      leftItems: stringArray(comparison.leftItems, `${id} 左侧条目`),
      rightTitle: requiredText(comparison.rightTitle, `${id} 右侧标题`, 200),
      rightItems: stringArray(comparison.rightItems, `${id} 右侧条目`),
      common: optionalText(comparison.common, 1000),
    };
    if (
      !normalizedComparison.leftItems.length ||
      !normalizedComparison.rightItems.length
    ) {
      throw new Error(`${id} 的对比两侧都必须有学生可见内容。`);
    }
    normalized.comparison = normalizedComparison;
  }
  if (kind === "relation") {
    if (!Array.isArray(item.relations) || item.relations.length === 0) {
      throw new Error(`${id} 必须包含关系节点。`);
    }
    normalized.relations = item.relations.map((entry, index) => {
      const relation = record(entry);
      return {
        label: requiredText(
          relation.label,
          `${id} 第 ${index + 1} 个关系标签`,
          300,
        ),
        value: optionalText(relation.value, 300),
        kind: optionalText(relation.kind, 40) ?? "flow",
      };
    });
  }
  if (kind === "data") {
    const data = record(item.data);
    const labels = stringArray(data.labels, `${id} 数据标签`, 20);
    const values = Array.isArray(data.values)
      ? data.values.map((entry) => Number(entry)).filter(Number.isFinite)
      : [];
    if (!labels.length || labels.length !== values.length) {
      throw new Error(`${id} 的数据标签和值必须完整对应。`);
    }
    normalized.data = {
      labels,
      values,
      unit: optionalText(data.unit, 80),
      conclusion: optionalText(data.conclusion, 1000),
    };
  }
  if (kind === "image" || kind === "relation") {
    const visual = record(item.visual);
    if (kind === "image" || Object.keys(visual).length > 0) {
      normalized.visual = {
        kind: requiredText(visual.kind, `${id} 配图类型`, 80),
        purpose: requiredText(visual.purpose, `${id} 配图用途`, 1000),
        description: requiredText(visual.description, `${id} 配图内容`, 4000),
        sourceExcerpt: requiredText(
          visual.sourceExcerpt,
          `${id} 配图来源`,
          4000,
        ),
        nodes: Array.isArray(visual.nodes) ? visual.nodes.map(record) : [],
        edges: Array.isArray(visual.edges) ? visual.edges.map(record) : [],
        intersectionItems: stringArray(
          visual.intersectionItems,
          `${id} 交集条目`,
          30,
        ),
      };
    }
  }
  if (supplementRef) {
    if (!["text", "body"].includes(kind)) {
      throw new Error(`${id} 引用补充素材时必须使用 kind=body。`);
    }
    const supplement = supplements.get(supplementRef);
    if (!supplement) {
      throw new Error(`${id} 引用了不存在的补充素材 ${supplementRef}。`);
    }
    normalized.supplementRef = supplementRef;
    normalized.text = preserveSupplementText && optionalText(item.text, 12000)
      ? optionalText(item.text, 12000)
      : supplement.content;
    normalized.provenance = {
      sourceType: supplement.sourceType,
      sourceTitle: supplement.sourceTitle,
      fidelity: supplement.fidelity,
      verification: supplement.verification,
      teachingPurpose: supplement.teachingPurpose,
    };
  }
  return normalized;
}

function inferRenderFunction(
  pageFunction: string,
  index: number,
  total: number,
): CoursewareManuscriptPage["function"] {
  const value = pageFunction.toUpperCase();
  if (index === 0 || /(?:^|_)COVER(?:_|$)/.test(value)) return "F01_COVER";
  if (
    index === total - 1 || /(?:SUMMARY|CLOSURE|REVIEW|REFLECTION)/.test(value)
  ) {
    return "F12_SUMMARY";
  }
  if (/(?:QUESTION|PROBLEM_POSING|INQUIRY)/.test(value)) {
    return "F04_CORE_QUESTION";
  }
  if (
    /(?:OBSERVATION|MATERIAL|READING|CLOSE_READING|SOURCE_ANALYSIS)/.test(value)
  ) return "F06_OBSERVATION";
  if (/(?:COMPARISON|DISCRIMINATION|COMPARATIVE)/.test(value)) {
    return "F08_COMPARISON";
  }
  if (/(?:DATA|STATISTIC|PROBABILITY)/.test(value)) return "F09_DATA";
  if (/(?:EXERCISE|PRACTICE|CHECK|QUIZ|ERROR_DIAGNOSIS)/.test(value)) {
    return "F11_EXERCISE";
  }
  if (
    /(?:TASK|ACTIVITY|CONSTRUCTION|EXPERIMENT|SPEAKING_TASK|INTEGRATED_OUTPUT)/
      .test(value)
  ) return "F10_ACTIVITY";
  if (
    /(?:RELATION|STRUCTURE|PROCESS|DERIVATION|METHOD_SUMMARY|CAUSE|EFFECT|TIMELINE)/
      .test(value)
  ) return "F07_RELATION";
  if (/(?:SECTION|DIVIDER|TRANSITION)/.test(value)) return "F02_SECTION";
  if (
    /(?:CONTEXT|SITUATION|THEME|CULTURE_CONTEXT|AUTHOR_CONTEXT)/.test(value)
  ) return "F03_CONTEXT";
  return "F05_CONTENT";
}

export function parseCoursewareManuscript(
  markdown: string,
  supplementItems: CoursewareSupplement[] = [],
  visualMode: "V1" | "V2" | "V3" = "V1",
  preserveSupplementText = false,
): CoursewareManuscript {
  const supplements = new Map(supplementItems.map((item) => [item.id, item]));
  const blocks = [...markdown.matchAll(/```json\s*([\s\S]*?)```/gi)];
  if (!blocks.length) {
    throw new Error("逐页内容稿缺少页面 JSON 代码块，请重试。 ");
  }
  const pages = blocks.map((match, index) => {
    let rawPage: Raw;
    try {
      rawPage = record(JSON.parse(match[1].trim()));
    } catch {
      throw new Error(`逐页内容稿第 ${index + 1} 个页面块不是有效 JSON。`);
    }
    const pageId = requiredText(rawPage.pageId, `第 ${index + 1} 页 ID`, 20);
    const expectedId = `P${String(index + 1).padStart(2, "0")}`;
    if (pageId !== expectedId) {
      throw new Error(`第 ${index + 1} 页 ID 必须为 ${expectedId}。`);
    }
    const pageFunction = requiredText(
      rawPage.pageFunction,
      `${pageId} 教学功能`,
      100,
    );
    if (
      !/^(U|CN|MATH|EN|SCI|PHY|CHEM|BIO|HIST|GEO|POL|IT|ART|PE|LAB)[0-9]{2}_[A-Z0-9_]+$/
        .test(pageFunction)
    ) {
      throw new Error(`${pageId} 教学功能标识不合法。`);
    }
    const explicitFunction = optionalText(rawPage.function, 40);
    const fn = explicitFunction && FUNCTIONS.includes(
        explicitFunction as CoursewareManuscriptPage["function"],
      )
      ? explicitFunction as CoursewareManuscriptPage["function"]
      : inferRenderFunction(pageFunction, index, blocks.length);
    const teachingPhase = String(
      rawPage.teachingPhase ?? "",
    ) as CoursewareManuscriptPage["teachingPhase"];
    if (!PHASES.includes(teachingPhase)) {
      throw new Error(`${pageId} 教学阶段不合法。`);
    }
    const mapping = record(rawPage.sourceMapping);
    const materialsRaw = Array.isArray(rawPage.materials)
      ? rawPage.materials
      : [];
    if (materialsRaw.length < 1 || materialsRaw.length > 8) {
      throw new Error(`${pageId} 必须包含 1—8 项学生可见素材。`);
    }
    let materials = materialsRaw.map((item) =>
      normalizeMaterial(item, pageId, supplements, preserveSupplementText)
    );
    if (new Set(materials.map((item) => item.id)).size !== materials.length) {
      throw new Error(`${pageId} 存在重复素材 ID。`);
    }
    if (materials.filter((item) => item.kind === "title").length !== 1) {
      throw new Error(`${pageId} 必须且只能有一项 title 素材。`);
    }
    let imageMaterials = materials.filter((item) => item.kind === "image");
    if (
      (visualMode === "V2" || visualMode === "V3") && imageMaterials.length > 1
    ) {
      const primary = imageMaterials[0];
      const descriptions = imageMaterials
        .map((item) => optionalText(record(item.visual).description, 4000))
        .filter(Boolean) as string[];
      const mergedDescription = [...new Set(descriptions)].join(
        "；补充视觉元素：",
      );
      materials = materials.map((item) =>
        item.id === primary.id
          ? {
            ...item,
            visual: {
              ...record(item.visual),
              description: mergedDescription,
            },
          }
          : item.kind === "image"
          ? null
          : item
      ).filter(Boolean) as CoursewareMaterial[];
      imageMaterials = [materials.find((item) => item.id === primary.id)!];
    }
    const imageDescription = optionalText(rawPage.imageDescription, 4000) ||
      imageMaterials
        .map((item) => optionalText(record(item.visual).description, 4000))
        .find(Boolean);
    if ((visualMode === "V2" || visualMode === "V3") && !imageDescription) {
      throw new Error(
        `${pageId} 的 ${
          visualMode === "V3" ? "V3 纯图片" : "V2 "
        }页面必须包含具体的整页背景图描述。`,
      );
    }
    if (!["F01_COVER", "F02_SECTION"].includes(fn) && materials.length < 2) {
      throw new Error(`${pageId} 缺少标题之外的学生可见核心素材。`);
    }
    return {
      pageId,
      function: fn,
      pageFunction,
      teachingPhase,
      eyebrow: optionalText(rawPage.eyebrow, 120),
      imageDescription,
      sourceMapping: {
        section: requiredText(mapping.section, `${pageId} 来源环节`, 1000),
        task: optionalText(mapping.task, 1000) ?? "",
        sourceExcerpt: requiredText(
          mapping.sourceExcerpt,
          `${pageId} 来源摘录`,
          5000,
        ),
      },
      teacherNotes: stringArray(rawPage.teacherNotes, `${pageId} 教师备注`, 20),
      materials,
    };
  });
  if (pages.length < 6 || pages.length > 35) {
    throw new Error("逐页内容稿页数必须在 6—35 页之间。 ");
  }
  const coverIndex = pages.findIndex((page) => page.function === "F01_COVER");
  const summaryIndex = pages.findLastIndex((page) =>
    page.function === "F12_SUMMARY"
  );
  if (coverIndex > 0 && summaryIndex >= 0 && summaryIndex !== coverIndex) {
    // Models occasionally place the required boundary pages in the middle
    // while still returning a complete, valid page set. Move those pages to
    // the contract boundaries without changing their page IDs or content.
    const middle = pages.filter((_, index) =>
      index !== coverIndex && index !== summaryIndex
    );
    pages.splice(
      0,
      pages.length,
      pages[coverIndex],
      ...middle,
      pages[summaryIndex],
    );
  } else if (
    coverIndex === 0 && summaryIndex >= 0 && summaryIndex !== pages.length - 1
  ) {
    const summary = pages[summaryIndex];
    pages.splice(summaryIndex, 1);
    pages.push(summary);
  } else if (coverIndex > 0 && summaryIndex === pages.length - 1) {
    const cover = pages[coverIndex];
    pages.splice(coverIndex, 1);
    pages.unshift(cover);
  }
  if (
    pages[0].function !== "F01_COVER" ||
    pages.at(-1)?.function !== "F12_SUMMARY"
  ) {
    throw new Error("逐页内容稿必须以封面开始、以总结提升结束。 ");
  }
  const usedSupplementRefs = pages.flatMap((page) =>
    page.materials.map((material) => material.supplementRef).filter(Boolean)
  ) as string[];
  if (new Set(usedSupplementRefs).size !== usedSupplementRefs.length) {
    throw new Error("同一补充素材不能在内容稿中重复引用。 ");
  }
  const missingSupplements = supplementItems.filter((item) =>
    !usedSupplementRefs.includes(item.id)
  );
  if (missingSupplements.length) {
    throw new Error(
      `逐页内容稿遗漏补充素材：${
        missingSupplements.map((item) => item.id).join("、")
      }。`,
    );
  }
  return { markdown: markdown.trim(), pages };
}

export function formatCoursewareManuscript(manuscript: CoursewareManuscript) {
  const title =
    manuscript.pages[0].materials.find((item) => item.kind === "title")?.text ??
      "课堂课件";
  return [
    `# ${title}｜逐页内容稿`,
    ...manuscript.pages.flatMap((page) => [
      "",
      `## ${page.pageId}｜${page.eyebrow || page.sourceMapping.section}`,
      "```json",
      JSON.stringify(
        {
          pageId: page.pageId,
          pageFunction: page.pageFunction,
          teachingPhase: page.teachingPhase,
          eyebrow: page.eyebrow,
          imageDescription: page.imageDescription,
          sourceMapping: page.sourceMapping,
          teacherNotes: page.teacherNotes,
          materials: page.materials.flatMap((material) => {
            if (material.kind === "title") {
              return [{ id: material.id, kind: "title", text: material.text }];
            }
            if (material.kind === "image") return [];
            const text = material.text || [
              ...(material.items ?? []),
              ...(material.comparison
                ? [
                  material.comparison.leftTitle,
                  ...(Array.isArray(material.comparison.leftItems)
                    ? material.comparison.leftItems
                    : []),
                  material.comparison.common,
                  material.comparison.rightTitle,
                  ...(Array.isArray(material.comparison.rightItems)
                    ? material.comparison.rightItems
                    : []),
                ]
                : []),
              ...(material.relations ?? []).map((relation) =>
                [relation.label, relation.value].filter(Boolean).join("：")
              ),
              ...(material.data
                ? [
                  ...(Array.isArray(material.data.labels)
                    ? material.data.labels.map((label, index) =>
                      `${label}：${
                        Array.isArray(material.data?.values)
                          ? material.data.values[index]
                          : ""
                      }`
                    )
                    : []),
                  material.data.conclusion,
                ]
                : []),
            ].filter(Boolean).join("\n");
            return [{
              id: material.id,
              kind: "body",
              ...(material.supplementRef
                ? { supplementRef: material.supplementRef }
                : {}),
              text,
            }];
          }),
        },
        null,
        2,
      ),
      "```",
    ]),
  ].join("\n");
}

export const parseCoursewareOutline = parseCoursewareManuscript;
export const formatCoursewareOutline = formatCoursewareManuscript;

export function buildCoursewareVisualDesignPrompt(
  manuscriptMarkdown: string,
  source: Source,
  overrides: ImagePromptOverrides = {},
) {
  return renderImagePrompt("courseware.visual_design", { subject: source.subject, grade: source.grade, topic: source.topic, outline: manuscriptMarkdown.slice(0, 160000) }, overrides);
}

export function parseCoursewareVisualDesign(rawOutput: string) {
  const value = rawOutput
    .replace(/^```(?:markdown|text)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .replace(/^#{1,6}\s*/gmu, "")
    .trim();
  if (!value) throw new Error("整体视觉设计不能为空。");
  if (value.length > 4000) throw new Error("整体视觉设计过长，请重试。");
  return value;
}

function teachingFlowExcerpt(markdown: string) {
  const headings = [...markdown.matchAll(/^(#{1,6})\s+(.+)$/gmu)];
  const start = headings.find((match) => /教学(?:过程|流程)/u.test(match[2]));
  if (!start || start.index == null) return markdown;
  const level = start[1].length;
  const following = headings.find((match) =>
    match.index != null && match.index > start.index! &&
    match[1].length <= level
  );
  return markdown.slice(start.index, following?.index ?? markdown.length);
}

const CHINESE_NUMBER: Record<string, string> = {
  一: "1",
  二: "2",
  三: "3",
  四: "4",
  五: "5",
  六: "6",
  七: "7",
  八: "8",
  九: "9",
  十: "10",
  十一: "11",
  十二: "12",
  十三: "13",
  十四: "14",
  十五: "15",
  十六: "16",
  十七: "17",
  十八: "18",
  十九: "19",
  二十: "20",
};

function flowAnchorKey(value: string) {
  const match = value.replace(/\s+/g, "").match(
    /(环节|任务)([一二三四五六七八九十0-9]+)/u,
  );
  if (!match) return value.replace(/\s+/g, "");
  return `${match[1]}${CHINESE_NUMBER[match[2]] ?? match[2]}`;
}

export function validateCoursewareManuscriptCoverage(
  manuscript: CoursewareManuscript,
  lessonMarkdown: string,
) {
  const excerpt = teachingFlowExcerpt(lessonMarkdown);
  const anchors = [
    ...excerpt.matchAll(/(环节|任务)\s*[一二三四五六七八九十0-9]+/gu),
  ]
    .map((match) => match[0])
    .filter((value, index, values) =>
      values.findIndex((candidate) =>
        flowAnchorKey(candidate) === flowAnchorKey(value)
      ) === index
    );
  const visibleNavigation = manuscript.pages.map((page) => {
    const title = page.materials.find((item) => item.kind === "title")?.text ??
      "";
    return `${page.eyebrow ?? ""}\n${title}`;
  }).join("\n");
  const sourceSections = manuscript.pages.map((page) =>
    page.sourceMapping.section
  ).join("\n");
  const visibleKeys = new Set(
    [...visibleNavigation.matchAll(
      /(环节|任务)\s*[一二三四五六七八九十0-9]+/gu,
    )]
      .map((match) => flowAnchorKey(match[0])),
  );
  const sectionKeys = new Set(
    [...sourceSections.matchAll(/环节\s*[一二三四五六七八九十0-9]+/gu)]
      .map((match) => flowAnchorKey(match[0])),
  );
  const missing = anchors.filter((anchor) => {
    const key = flowAnchorKey(anchor);
    return anchor.replace(/\s+/g, "").startsWith("任务")
      ? !visibleKeys.has(key)
      : !visibleKeys.has(key) && !sectionKeys.has(key);
  });
  if (missing.length) {
    throw new Error(
      `逐页内容稿未覆盖或未显示教案流程标识：${missing.join("、")}。`,
    );
  }
}

export function formatCoursewareSourcePack(sourcePack: CoursewareSourcePack) {
  const sections: string[] = [];
  const inputEntries = Object.entries(sourcePack.inputSnapshot).filter((
    [key],
  ) => !["textbook_sources", "case_sources", "material_ids"].includes(key));
  if (inputEntries.length) {
    sections.push(
      `## 原任务输入\n\n\`\`\`json\n${
        JSON.stringify(Object.fromEntries(inputEntries), null, 2).slice(
          0,
          30000,
        )
      }\n\`\`\``,
    );
  }
  for (const item of sourcePack.textbookSections) {
    sections.push(
      `## 教材来源｜${item.title}\n来源类型：${
        item.contentType || "未标注"
      }；核验状态：${item.verification || "未标注"}\n\n${item.content}`,
    );
  }
  for (const item of sourcePack.userMaterials) {
    sections.push(
      `## 用户材料｜${item.title}\n材料类型：${
        item.kind || "未标注"
      }\n\n${item.content}`,
    );
  }
  for (const item of sourcePack.caseMaterials) {
    sections.push(
      `## 案例库｜${item.title}\n核验状态：${
        item.verification || "未标注"
      }\n来源链接：${
        item.sourceUrls.join("；") || "未提供"
      }\n\n${item.content}`,
    );
  }
  return sections.length
    ? sections.join("\n\n").slice(0, 120000)
    : "（原任务没有保存额外教材、用户材料或案例来源。）";
}

export function buildCoursewareMaterialPrompt(
  lessonMarkdown: string,
  sourcePack: CoursewareSourcePack,
  source: Source,
) {
  return `你是 HAI 课件的课堂素材编辑。教案负责教学流程，但可能只写“呈现一段史料/案例/数据/文本让学生分析”，没有给出学生实际看到的完整素材。请结合教案与来源包，识别并补齐这类缺失素材。

输出 JSON：{"schemaVersion":"courseware_material_supplement_v1","items":[{"id":"S01","trigger":"教案中触发补充的原句","sourceSection":"对应环节/任务","title":"素材标题","content":"可直接投屏的完整素材，包含必要的学生可见出处或‘教学改编/模拟材料’标识","teachingPurpose":"学生用它完成什么分析任务","sourceType":"lesson_plan|textbook|user_material|case_library|generated_adaptation","sourceTitle":"实际来源名称；生成材料写‘教学生成材料’","fidelity":"verbatim|adapted|generated","verification":"verified|needs_review"}]}

只补教案明确需要投屏、但教案正文中没有完整给出的实质材料，例如史料、语篇、案例、实验记录、数据表、长题干或观察对象。教案中已经完整给出的文字不要重复；标题、问题、步骤和知识结论由后续内容稿处理，不放在这里。没有缺口时 items=[]。

来源规则：
1. 来源包中有完整原文时可用 verbatim，content 必须忠实摘录，sourceType/sourceTitle 与实际来源一致。
2. 教材条目标注“知识点梳理/非逐字原文”时不能冒充教材原文，只能据其事实改写，并使用 fidelity=adapted。
3. 来源包没有可逐字引用的史料、名言、法规、统计数据时，禁止凭模型记忆伪造原文、出处或数字。可以只依据来源包已有事实编写明确标注“根据……整理”的教学改编材料，sourceType=generated_adaptation、fidelity=generated、verification=needs_review。
4. 一般生活情境、虚构人物对话、示例数据可按教学目的生成，但必须标注“模拟情境/模拟数据”，不能假装真实事件或真实统计。
5. 如果连安全改编所需的基本事实都不存在，不要编造该项；后续课件只保留教案已有任务。不要输出空内容、待补充占位或给教师的建议。
6. content 以学生一屏可读为目标，通常 80—500 字；必要的完整题干、短文或史料可更长。连续编号 S01、S02……。只输出 JSON，不输出 Markdown 或解释。

课程：${source.subject}，${source.grade}，${source.topic}
教学设计：
${lessonMarkdown.slice(0, 100000)}

原任务来源包：
${formatCoursewareSourcePack(sourcePack)}`;
}

export function parseCoursewareSupplements(rawOutput: string) {
  const value = parseCoursewareJson(rawOutput);
  if (value.schemaVersion !== "courseware_material_supplement_v1") {
    throw new Error("素材补全稿 schemaVersion 不正确。 ");
  }
  const rawItems = Array.isArray(value.items) ? value.items : [];
  if (rawItems.length > 20) throw new Error("素材补全项不能超过 20 项。 ");
  const sourceTypes = [
    "lesson_plan",
    "textbook",
    "user_material",
    "case_library",
    "generated_adaptation",
  ];
  const fidelities = ["verbatim", "adapted", "generated"];
  const verifications = ["verified", "needs_review"];
  const items = rawItems.map((candidate, index): CoursewareSupplement => {
    const item = record(candidate);
    const id = requiredText(item.id, `第 ${index + 1} 项补充素材 ID`, 20);
    const expected = `S${String(index + 1).padStart(2, "0")}`;
    if (id !== expected) {
      throw new Error(`第 ${index + 1} 项补充素材 ID 必须为 ${expected}。`);
    }
    const sourceType = String(item.sourceType ?? "");
    const fidelity = String(item.fidelity ?? "");
    const verification = String(item.verification ?? "");
    if (!sourceTypes.includes(sourceType)) {
      throw new Error(`${id} 的来源类型不合法。`);
    }
    if (!fidelities.includes(fidelity)) {
      throw new Error(`${id} 的忠实度标识不合法。`);
    }
    if (!verifications.includes(verification)) {
      throw new Error(`${id} 的核验状态不合法。`);
    }
    if (
      sourceType === "generated_adaptation" && verification !== "needs_review"
    ) {
      throw new Error(`${id} 的生成性材料必须标记为 needs_review。`);
    }
    if (fidelity === "verbatim" && sourceType === "generated_adaptation") {
      throw new Error(`${id} 的生成性材料不能标记为原文。`);
    }
    return {
      id,
      trigger: requiredText(item.trigger, `${id} 触发原句`, 4000),
      sourceSection: requiredText(item.sourceSection, `${id} 来源环节`, 1000),
      title: requiredText(item.title, `${id} 标题`, 500),
      content: requiredText(item.content, `${id} 正文`, 12000),
      teachingPurpose: requiredText(
        item.teachingPurpose,
        `${id} 教学用途`,
        2000,
      ),
      sourceType: sourceType as CoursewareSupplement["sourceType"],
      sourceTitle: requiredText(item.sourceTitle, `${id} 来源名称`, 1000),
      fidelity: fidelity as CoursewareSupplement["fidelity"],
      verification: verification as CoursewareSupplement["verification"],
    };
  });
  return items;
}

export function formatCoursewareSupplements(items: CoursewareSupplement[]) {
  return JSON.stringify(
    {
      schemaVersion: "courseware_material_supplement_v1",
      items,
    },
    null,
    2,
  );
}

export function buildCoursewareOutlinePrompt(
  lessonMarkdown: string,
  source: Source,
  options: Options,
  supplementItems: CoursewareSupplement[] = [],
  overrides: ImagePromptOverrides = {},
) {
  const target = options.length === "compact" ? "11—20" : "21—35";
  const pureImageRule = options.visualMode === "V3"
    ? imagePromptValue("courseware.outline_rule", overrides)
    : "";
  return `你是 HAI 课件的第一轮 PPT 大纲编辑。第一轮只确定“这一页的教学功能、要显示的标题和正文、需要生成什么背景图”，不选择 layout，不选择组件类型，不拆分正文，不输出视觉原型，也不输出最终 DeckSpec。第二轮 AI 会根据本大纲和功能页注册表选择 layout，并把正文拆入具体组件，因此本轮必须保持材料中性。

把教案，尤其是“教学活动/教学流程”部分，整理成一份 Markdown PPT 大纲。教学活动必须完整作为页面规划主线：不要把多个任务压成一句泛化总结，不要跳过任务编号、核心问题、学生动作和产出。硬性页序是：第一个页面代码块必须是 pageId=P01 且 pageFunction 表示封面，最后一个页面代码块必须是 pageFunction 表示总结提升；不要输出 function 字段。页数目标为 ${target} 页；完整保留教案的核心问题、任务、题目、必要材料、结论和总结时可超过目标，但总页数必须在 6—35 页。保持教学流程、环节顺序和任务编号；教师巡视、预期回答、错误处理和“若……则……”只写进 teacherNotes，不得写入学生正文。

每页使用“## P01｜页面标题”标题，紧跟一个且仅一个 json 代码块。代码块对象格式（第一轮只允许 pageId、pageFunction、teachingPhase、eyebrow、imageDescription、sourceMapping、teacherNotes、materials）：
{"pageId":"P01","pageFunction":"已加载 Skill 中合法的共有或学科专属功能页 ID","teachingPhase":"opening|diagnosis|construction|practice|feedback|transfer|closure","eyebrow":"学生可见的原环节/任务导航","imageDescription":"本页整页背景图应出现的主体、场景、人物或物体、动作或关系、构图版式和文字安全区，必须具体；V1 也可填写，V2 必须填写","sourceMapping":{"section":"教案原环节标题","task":"原任务编号名称或空字符串","sourceExcerpt":"对应教案原文摘录"},"teacherNotes":["仅供教师看的说明"],"materials":[{"id":"P01-M01","kind":"title|body","supplementRef":"引用补充素材时填写 S01，否则省略","text":"页面要显示的完整标题或正文"}]}

材料规则：每页 1—8 项，且必须且只能有一项 kind=title；其余全部使用 kind=body。body 只承载学生屏幕上要显示的原始内容，可以是一段完整正文，也可以包含题干、条件、选项、步骤、案例、结论、关系说明或数据说明，但不要拆成 bullet/card/question 等组件，不要填写 items、comparison、relations、data、visual 等 layout 字段。一个 body 可以包含第二轮需要拆分成多个组件的全部内容，不能用“略”“同上”或元说明代替。

补充素材规则：下面每个 Sxx 都是前一步确认需要投屏的完整材料，必须在最匹配的页面恰好引用一次。引用时新增一项 kind=body 并填写 supplementRef=Sxx；text 可以原样抄写，也可以留空，服务端最终会用补充稿正文覆盖，防止缩写或改写。不要把补充素材塞入 title 或 teacherNotes，也不要遗漏。补充稿中的 provenance 由服务端保留。

功能页只表达教学意图：请使用已加载 Skill 中合法、足够具体的 pageFunction，例如封面、任务、素材呈现、核心提问、概念讲解、比较辨析、关系结构、数据解读、练习检测、总结提升，以及学科专属的观察、实验、史料研读、语篇分析等功能。pageFunction 只回答“这一页要完成什么教学功能”，不要在其中编码 layout 或组件。总结页覆盖本课应收束的全部核心概念、定义、原理、方法、结论和观念；练习页保留完整题干、条件、选项与作答要求；任务页保留材料、动作、步骤和产出。内容较多就拆成连续页面。只使用来源教案及已解析素材补全稿中的内容，不另行补造教材事实或答案。

配图规则：V1 不使用 AI 整页背景图，页面依靠背景色和克制几何图案组织；必要的教学图片不在第一轮写成 image 素材，而只在正文中说明其教学需要。V2 每一页必须填写一段具体的 imageDescription，作为唯一整页 16:9 背景图的生图提示词基础；描述本页自己的主体、景物、人物/物体、动作或关系、视角、主体位于左/右/中心或环绕，以及给原生文字保留的安全区。图片内不承载文字，不同页面的具体意象必须依据本页教学内容分别确定。${pureImageRule}

必须以封面功能页开始，以总结提升功能页结束。不要输出 function 字段。只输出上述 Markdown，不输出说明。

来源：${source.subject}，${source.grade}，${source.topic}
视觉模式：${options.visualMode}；图片策略：${options.imageStrategy}
教学设计：
${lessonMarkdown.slice(0, 100000)}

已解析的素材补全稿：
${formatCoursewareSupplements(supplementItems)}`;
}

export const buildCoursewareContentPrompt = buildCoursewareOutlinePrompt;

export type CoursewareImagePromptPage = {
  pageId: string;
  prompt: string;
  negativePrompt?: string;
  visibleText: string[];
};

export type CoursewareImagePrompts = {
  schemaVersion: "hai_courseware_image_prompts_v1";
  visualProfile: Record<string, unknown>;
  pages: CoursewareImagePromptPage[];
};

export function buildCoursewareImagePromptPrompt(
  manuscriptMarkdown: string,
  source: Source,
  options: Options,
  visualDesign = "",
  overrides: ImagePromptOverrides = {},
) {
  return renderImagePrompt("courseware.image_planning", { subject: source.subject, grade: source.grade, topic: source.topic, outline: manuscriptMarkdown.slice(0, 180000), length: options.length, visual_design: visualDesign.trim() || imagePromptValue("courseware.default_visual", overrides) }, overrides);
}

export function parseCoursewareImagePrompts(
  rawOutput: string,
  manuscript: CoursewareManuscript,
): CoursewareImagePrompts {
  const value = parseCoursewareJson(rawOutput);
  if (value.schemaVersion !== "hai_courseware_image_prompts_v1") {
    throw new Error("纯图片PPT生图提示词 schemaVersion 不正确。");
  }
  const rawPages = Array.isArray(value.pages) ? value.pages : [];
  if (rawPages.length !== manuscript.pages.length) {
    throw new Error("纯图片PPT生图提示词必须逐页对应 PPT 大纲。");
  }
  const pages = rawPages.map((candidate, index) => {
    const item = record(candidate);
    const expected = manuscript.pages[index].pageId;
    const pageId = requiredText(
      item.pageId,
      `第 ${index + 1} 页生图提示词 ID`,
      20,
    );
    if (pageId !== expected) {
      throw new Error(`${expected} 的生图提示词顺序不正确。`);
    }
    const prompt = requiredText(item.prompt, `${pageId} 生图提示词`, 16000);
    if (prompt.length < 80 || !/16:9/.test(prompt) || !/1K/i.test(prompt)) {
      throw new Error(`${pageId} 生图提示词缺少比例、分辨率或具体构图要求。`);
    }
    const visibleText = stringArray(
      item.visibleText,
      `${pageId} 图片内文字`,
      40,
    );
    if (!visibleText.length) {
      throw new Error(`${pageId} 必须列出图片内需要原样排版的学生可见文字。`);
    }
    return {
      pageId,
      prompt,
      negativePrompt: optionalText(item.negativePrompt, 4000),
      visibleText,
    };
  });
  return {
    schemaVersion: "hai_courseware_image_prompts_v1",
    visualProfile: record(value.visualProfile),
    pages,
  };
}

export function formatCoursewareImagePrompts(value: CoursewareImagePrompts) {
  return JSON.stringify(value, null, 2);
}

export function buildCoursewareImageOnlyDeck(
  manuscript: CoursewareManuscript,
  source: Source,
  options: Options,
  imagePrompts: CoursewareImagePrompts,
) {
  const layoutByFunction: Record<string, string> = {
    F01_COVER: "C03_COVER_FULL_VISUAL",
    F02_SECTION: "S01_SECTION_NUMBER",
    F03_CONTEXT: "I01_IMAGE_QUESTION",
    F04_CORE_QUESTION: "Q01_BIG_QUESTION",
    F05_CONTENT: "K01_TITLE_BODY",
    F06_OBSERVATION: "O02_MATERIAL_QUESTION",
    F07_RELATION: "R01_FLOW",
    F08_COMPARISON: "B01_TWO_COLUMNS",
    F09_DATA: "D02_CHART_CONCLUSION",
    F10_ACTIVITY: "A01_TASK_CARD",
    F11_EXERCISE: "E01_SINGLE_QUESTION",
    F12_SUMMARY: "T01_THREE_POINTS",
  };
  const title =
    manuscript.pages[0].materials.find((item) => item.kind === "title")?.text ||
    source.topic || "HAI 课堂课件";
  return {
    schemaVersion: "hai_courseware_deck_v4",
    subjectProfile: source.subjectProfile || "general",
    lessonGenre: source.lessonGenre || "general",
    visualMode: "V3",
    length: options.length,
    imageStrategy: "enhanced",
    title,
    subtitle: `${source.grade || "课堂"} · ${source.subject || "教学设计"}`,
    visualProfile: imagePrompts.visualProfile,
    source,
    slides: manuscript.pages.map((page, index) => {
      const prompt = imagePrompts.pages[index];
      const titleMaterial = page.materials.find((item) =>
        item.kind === "title"
      );
      return {
        slideId: page.pageId,
        index,
        function: page.function,
        pageFunction: page.pageFunction,
        teachingPhase: page.teachingPhase,
        visualMode: "V3",
        layout: layoutByFunction[page.function] || "K01_TITLE_BODY",
        title: titleMaterial?.text || `第 ${index + 1} 页`,
        eyebrow: page.eyebrow,
        imageDescription: page.imageDescription,
        imagePrompt: [
          prompt.prompt,
          prompt.negativePrompt ? `负面约束：${prompt.negativePrompt}` : "",
        ].filter(Boolean).join("\n"),
        sourceMapping: page.sourceMapping,
        teacherNotes: page.teacherNotes,
        components: [
          {
            id: `${page.pageId}-C01`,
            type: "title",
            text: titleMaterial?.text || `第 ${index + 1} 页`,
            importance: "primary",
            flexibility: "fixed",
            editability: "image",
          },
          {
            id: `${page.pageId}-C02`,
            type: "image",
            role: "background",
            variant: "full-bleed",
            text: "纯图片PPT整页画面",
            importance: "primary",
            flexibility: "fixed",
            editability: "image",
          },
        ],
        image: {
          type: "background",
          status: "placeholder",
          alt: titleMaterial?.text || `第 ${index + 1} 页`,
          fit: "cover",
          safeZone: "none",
          imagePrompt: [
            prompt.prompt,
            prompt.negativePrompt ? `负面约束：${prompt.negativePrompt}` : "",
          ].filter(Boolean).join("\n"),
        },
      };
    }),
  };
}

export function buildCoursewareDesignPrompt(
  manuscriptMarkdown: string,
  source: Source,
  options: Options,
) {
  const visualDirection = options.visualMode === "V2"
    ? "V2 的统一配色、插画媒介、光线、质感和写实程度必须由你根据课程内容确定并写入 visualProfile；visualKeywords 只能描述风格、媒介、构图或质感，不得填写某一页的具体景物、人物或物体；不要使用用户预设配色，也不要添加代码扁平背景图案。每页 image 都是整页背景。"
    : "V1 使用背景色、克制的几何图案和原生排版，不使用 AI 背景配图；若大纲中有必要的教学图片，只保留为原生图片素材。";
  const runtimeDirection = options.outputMode === "interactive"
    ? "互动式课件模式：页面最终由安全的 WebDeckSpec/React Renderer 渲染，不生成 HTML、CSS 或 JavaScript。请优先保留可被点击揭晓、步骤展开、标签切换和选择题承载的清晰内容结构；不要把交互逻辑写成代码。"
    : "PPT 模式：页面最终由现有 PPT Renderer 渲染。";
  return `你是 HAI 课件的第二轮页面设计器。逐页 PPT 大纲已经确定每页教学功能、标题、正文和背景图描述；你现在只根据“pageFunction + 正文内容”选择一个合适的 layout，并把正文拆入该 layout 的具体组件。不要再选择视觉原型；不能增删、改写或复制任何素材文字。${runtimeDirection}

输出 hai_courseware_design_v1 JSON：
{"schemaVersion":"hai_courseware_design_v1","visualProfile":{"illustrationStyle":string,"palette":string[],"lighting":string,"texture":string,"realismLevel":string,"visualKeywords":string[]},"slides":[{"pageRef":"P01","layout":"合法 Layout ID","visualIntensity":"L1|L2|L3","components":[{"id":"P01-C01","sourceMaterialRef":"P01-M01","type":"title|text|question|bullet|emphasis|highlight|material|task|relation|card|data|exercise","text":"从 body 拆出的本组件显示文字","items":[],"relations":[],"comparison":{},"data":{},"visual":{},"variant":string,"role":string},{"id":"P01-C02","type":"image","role":"background"},{"id":"P01-C03","type":"icon|divider|shape|illustration","variant":string,"role":"decorative"}]}]}

每页必须按原顺序出现一次，pageRef 与大纲页面一致。先读取 pageFunction 和正文，再从对应功能页允许的 Layout ID 中选择一个；功能页本身就是教学与视觉决策的入口，不再增加 visualPrototype 层。每个 title 素材必须引用一次；一个 body 素材可以被重复引用多次，以便拆成多个组件，但不得跨页引用。body 组件必须输出其实际显示的 text/items/relations/comparison/data/visual 等内容，且只能来自对应 body；服务端会保留并校验标题及素材引用。每页总组件 1—8 个，素材较多时省略装饰组件。V2 每页必须有一个 type=image、role=background 的无 sourceMaterialRef 组件，它代表唯一整页 16:9 背景图；不要生成窄幅插图、边框素材或独立小图。图片主体须依据大纲中的 imageDescription 和本页文字安全区安排，文字由 PPT 原生组件独立叠放。

组件类型由第二轮根据正文决定：title 只能承载 title；body 可以选择 text、question、bullet、emphasis、highlight、material、task、relation、card、data、exercise 等类型。需要知识图示时，relation 组件必须明确输出 nodes 与 edges，不能只给抽象描述；数据组件必须输出 labels、values 和结论；比较组件必须输出两侧内容。不要把 body 强行压成一个组件，也不要截断题干、选项、步骤或结论。

Layout 必须逐字使用：F01_COVER=C01_COVER_LEFT_VISUAL|C02_COVER_CENTER|C03_COVER_FULL_VISUAL|C04_COVER_BIG_TYPE；F02_SECTION=S01_SECTION_NUMBER|S02_SECTION_NAV|S03_SECTION_PATH；F03_CONTEXT=I01_IMAGE_QUESTION|I02_LEFT_IMAGE_RIGHT_CONTEXT|I03_CASE_CARD|I04_MULTI_IMAGE_OBSERVATION|Q01_BIG_QUESTION；F04_CORE_QUESTION=Q01_BIG_QUESTION|Q02_QUESTION_CHOICES|Q03_QUESTION_CHAIN；F05_CONTENT=K01_TITLE_BODY|K02_CONCEPT_EXAMPLE|K03_CONCLUSION_POINTS|K04_CENTER_CONCEPT；F06_OBSERVATION=O01_IMAGE_ANNOTATION|O02_MATERIAL_QUESTION|O03_MATERIAL_EVIDENCE；F07_RELATION=R01_FLOW|R02_STEP_NODES|R03_CAUSE_EFFECT|R04_HIERARCHY|R05_TIMELINE|R06_CYCLE；F08_COMPARISON=B01_TWO_COLUMNS|B02_COMMON_DIFFERENCE|B03_TRUE_FALSE|B04_COMPARISON_MATRIX；F09_DATA=D01_BIG_NUMBER|D02_CHART_CONCLUSION|D03_METRIC_CARDS；F10_ACTIVITY=A01_TASK_CARD|A02_THREE_STEPS|A03_GROUP_TASK|A04_MATERIAL_TASK；F11_EXERCISE=E01_SINGLE_QUESTION|E02_MULTIPLE_CHOICE|E03_JUDGEMENT_REASON|E04_TRANSFER_TASK；F12_SUMMARY=T01_THREE_POINTS|T02_KNOWLEDGE_STRUCTURE|T03_RETURN_QUESTION|T04_NEXT_QUESTION。

视觉模式：${options.visualMode}；图片策略：${options.imageStrategy}；字体组合：${
    options.fontPairing || "yahei-clear"
  }；动画：${
    options.animationPreset || "reveal-content"
  }。${visualDirection} 这些视觉选项会由渲染器确定，你只需让组件层级与视觉强度适配该风格，不得改写教学素材。V2 可提高关键页视觉强度。visualProfile 必须把整套生成图片约束成一个可复用的统一美术档案：同一插画媒介、同一主色板、同一光线、质感和写实程度；visualKeywords 只写风格属性，不写某个案例的具体对象；每张图片的具体内容由对应页面的 image 描述决定，不能逐页切换风格，也不能把封面案例复制到其他页面。只输出 JSON，不输出 Markdown、代码围栏或解释。

来源：${source.subject}，${source.grade}，${source.topic}
逐页内容稿：
${manuscriptMarkdown.slice(0, 140000)}`;
}

export function buildInteractiveDesignPrompt(
  manuscriptMarkdown: string,
  source: Source,
  options: Options,
) {
  return `你是 HAI 互动式网页课件的交互编排器。逐页教学大纲已经确定教学顺序、标题、学生可见素材和教师备注。你现在不生成 PPT 组件、PPT Layout、HTML、CSS、JavaScript 或任意代码，而是为一个连续的课堂网页选择安全的 Web Component。

输出且只能输出 hai_web_component_design_v1 JSON：
{"schemaVersion":"hai_web_component_design_v1","scenes":[{"sceneRef":"P01","components":[{"id":"P01-C01","type":"hero|prose|callout|reveal|tabs|steps|comparison|data|quiz|true_false|sort|timeline|media","sourceMaterialRefs":["P01-M01"],"tabs":[{"id":"tab-1","label":"来自素材的短标签","sourceMaterialRefs":["P01-M02"]}]}]}]}

规则：
1. scenes 必须与大纲页面数量完全一致，按 P01、P02……顺序输出；每个 sceneRef 只出现一次。这里的 scene 只是课堂网页中的连续教学场景，不是 PPT 页面，不输出 page、layout、function、visualPrototype 或坐标。
2. 每个组件必须从上面的 Web Component Catalog 选择，并至少引用一个 sourceMaterialRefs。sourceMaterialRefs 只能引用当前 scene 的素材 ID；素材已经包含最终学生可见文字，组件设计阶段不得改写、缩写、补造或提前给出答案。
3. hero 适合封面或场景引导；prose 适合连续正文；callout 适合重点提示；reveal 适合点击后揭晓的要点；tabs 适合并列内容（每个 tab 在 tabs 中写自己的 sourceMaterialRefs）；steps 适合流程/方法；comparison 只用于对比素材；data 只用于完整数据素材；quiz/true_false/sort 只用于原大纲明确提供的练习材料；timeline 只用于有时间顺序的素材；media 只用于真实教学图片/视频素材。
4. 一个 body 素材可以被拆到多个组件；title、comparison、relation、data、image 等非 body 素材不可重复引用。每项素材都必须至少被一个组件承载，不能为了丰富页面添加没有来源的组件。
5. 互动只通过组件本身完成：点击揭晓、Tabs、步骤聚焦、选择反馈和排序反馈。不要把交互写成代码，不要设计 PPT 动画或翻页按钮。

来源：${source.subject}，${source.grade}，${source.topic}；输出模式：interactive；视觉模式：${options.visualMode}
逐页教学大纲：
${manuscriptMarkdown.slice(0, 160000)}`;
}

function interactiveComponentText(materials: CoursewareMaterial[]) {
  return materials.map(interactiveMaterialText).filter(Boolean).join("\n\n");
}

function interactiveComponentItems(materials: CoursewareMaterial[]) {
  return materials.flatMap(interactiveMaterialItems).filter(Boolean);
}

export function hydrateInteractiveDesign(
  designOutput: string,
  manuscript: CoursewareManuscript,
  source: Source,
) {
  const design = parseCoursewareJson(designOutput) as InteractiveWebDesign;
  if (design.schemaVersion !== "hai_web_component_design_v1") {
    throw new Error("互动网页组件设计稿 schemaVersion 不正确。");
  }
  if (
    !Array.isArray(design.scenes) ||
    design.scenes.length !== manuscript.pages.length
  ) {
    throw new Error("互动网页组件设计稿场景数量与教学大纲不一致。");
  }
  const scenes = manuscript.pages.map((page, index) => {
    const rawScene = record(design.scenes[index]);
    if (rawScene.sceneRef !== page.pageId) {
      throw new Error(
        `互动网页组件设计稿第 ${index + 1} 个场景必须引用 ${page.pageId}。`,
      );
    }
    const rawComponents = Array.isArray(rawScene.components)
      ? rawScene.components
      : [];
    if (rawComponents.length < 1 || rawComponents.length > 8) {
      throw new Error(`${page.pageId} 的网页组件数量必须在 1—8 个之间。`);
    }
    const materials = new Map(page.materials.map((item) => [item.id, item]));
    const used = new Set<string>();
    const remainingMaterials = () =>
      page.materials.filter((item) => !used.has(item.id));
    const resolveMaterials = (refs: string[], type: string) => {
      const selected = refs.map((ref) => {
        const material = materials.get(ref);
        if (!material) {
          throw new Error(
            `${page.pageId} 的网页组件引用了不存在的素材 ${ref}。`,
          );
        }
        if (material.kind !== "body" && used.has(ref)) {
          throw new Error(`${ref} 被重复引用。`);
        }
        used.add(ref);
        return material;
      });
      if (!selected.length) {
        throw new Error(`${page.pageId} 的 ${type} 组件缺少素材引用。`);
      }
      return selected;
    };
    const fallbackRefs = (type: InteractiveWebComponentType) => {
      const rest = remainingMaterials();
      const title = rest.find((item) => item.kind === "title");
      if (type === "hero" && title) return [title.id];
      return [rest.find((item) => item.kind !== "title")?.id || title?.id]
        .filter(Boolean) as string[];
    };
    const components = rawComponents.map((value, componentIndex) => {
      const input = record(value);
      const type = interactiveDesignComponentType(input.type);
      if (!type) {
        throw new Error(
          `${page.pageId} 第 ${componentIndex + 1} 个网页组件类型不合法。`,
        );
      }
      const directRefs = interactiveRefs(
        input.sourceMaterialRefs ?? input.sourceMaterialRef,
      );
      if (type === "tabs") {
        const rawTabs = Array.isArray(input.tabs) ? input.tabs : [];
        const tabs = rawTabs.map((tabValue, tabIndex) => {
          const tab = record(tabValue);
          const refs = interactiveRefs(
            tab.sourceMaterialRefs ?? tab.sourceMaterialRef,
          );
          const selected = resolveMaterials(
            refs.length ? refs : fallbackRefs(type),
            `${type} 第 ${tabIndex + 1} 个标签`,
          );
          return {
            id: optionalText(tab.id, 60) || `tab-${tabIndex + 1}`,
            label: optionalText(tab.label, 80) || `内容 ${tabIndex + 1}`,
            text: interactiveComponentText(selected),
            items: interactiveComponentItems(selected),
            sourceMaterialRefs: selected.map((material) => material.id),
          };
        });
        if (!tabs.length) {
          const selected = resolveMaterials(
            directRefs.length ? directRefs : fallbackRefs(type),
            type,
          );
          tabs.push({
            id: "tab-1",
            label: "内容",
            text: interactiveComponentText(selected),
            items: interactiveComponentItems(selected),
            sourceMaterialRefs: selected.map((material) => material.id),
          });
        }
        return {
          id: optionalText(input.id, 80) ||
            `${page.pageId}-C${String(componentIndex + 1).padStart(2, "0")}`,
          type,
          tabs,
          sourceMaterialRefs: tabs.flatMap((tab) =>
            tab.sourceMaterialRefs ?? []
          ),
        };
      }
      const selected = resolveMaterials(
        directRefs.length ? directRefs : fallbackRefs(type),
        type,
      );
      const refs = selected.map((material) => material.id);
      const id = optionalText(input.id, 80) ||
        `${page.pageId}-C${String(componentIndex + 1).padStart(2, "0")}`;
      if (type === "hero") {
        return {
          id,
          type,
          title: selected.find((item) => item.kind === "title")?.text ||
            page.eyebrow || page.pageId,
          text: interactiveComponentText(
            selected.filter((item) => item.kind !== "title"),
          ),
          sourceMaterialRefs: refs,
        };
      }
      if (type === "prose") {
        return {
          id,
          type,
          text: interactiveComponentText(selected),
          sourceMaterialRefs: refs,
        };
      }
      if (type === "callout") {
        return {
          id,
          type,
          title: optionalText(input.label, 80) || "重点提示",
          text: interactiveComponentText(selected),
          items: interactiveComponentItems(selected),
          sourceMaterialRefs: refs,
        };
      }
      if (type === "reveal") {
        return {
          id,
          type,
          title: optionalText(input.label, 80) || "点击揭晓",
          items: interactiveComponentItems(selected),
          sourceMaterialRefs: refs,
        };
      }
      if (type === "steps") {
        return {
          id,
          type,
          title: optionalText(input.label, 80) || "逐步展开",
          steps: interactiveComponentItems(selected),
          sourceMaterialRefs: refs,
        };
      }
      if (type === "comparison") {
        const comparison = selected.find((item) => item.comparison)?.comparison;
        if (!comparison) {
          throw new Error(
            `${page.pageId} 的 comparison 组件必须引用对比素材。`,
          );
        }
        return { id, type, ...comparison, sourceMaterialRefs: refs };
      }
      if (type === "data") {
        const data = selected.find((item) => item.data)?.data;
        if (!data) {
          throw new Error(`${page.pageId} 的 data 组件必须引用数据素材。`);
        }
        return { id, type, ...data, sourceMaterialRefs: refs };
      }
      if (type === "quiz") {
        const question = interactiveComponentText(selected);
        const options = interactiveComponentItems(selected);
        if (!options.length) {
          throw new Error(`${page.pageId} 的 quiz 组件缺少练习选项。`);
        }
        return { id, type, question, options, sourceMaterialRefs: refs };
      }
      if (type === "true_false") {
        return {
          id,
          type,
          question: interactiveComponentText(selected),
          sourceMaterialRefs: refs,
        };
      }
      if (type === "sort") {
        return {
          id,
          type,
          prompt: interactiveComponentText(selected),
          items: interactiveComponentItems(selected),
          sourceMaterialRefs: refs,
        };
      }
      if (type === "timeline") {
        const items = selected.flatMap((material) =>
          material.relations?.map((entry) => {
            const relation = record(entry);
            return {
              label: optionalText(relation.label, 200) || "阶段",
              text: optionalText(relation.value, 500) || "",
            };
          }) || []
        );
        return {
          id,
          type,
          items: items.length
            ? items
            : interactiveComponentItems(selected).map((item, itemIndex) => ({
              label: `阶段 ${itemIndex + 1}`,
              text: item,
            })),
          sourceMaterialRefs: refs,
        };
      }
      return {
        id,
        type,
        title: optionalText(input.label, 80) || "教学材料",
        text: interactiveComponentText(selected),
        description: selected.map((item) =>
          optionalText(record(item.visual).description, 1000)
        ).filter(Boolean).join("\n"),
        sourceMaterialRefs: refs,
      };
    });
    const missing = remainingMaterials();
    if (missing.length) {
      const selected = resolveMaterials(
        missing.map((item) => item.id),
        "prose",
      );
      components.push({
        id: `${page.pageId}-fallback`,
        type: "prose",
        text: interactiveComponentText(selected),
        sourceMaterialRefs: selected.map((item) => item.id),
      });
    }
    return {
      id: `scene-${String(index + 1).padStart(2, "0")}`,
      index,
      title: page.materials.find((item) => item.kind === "title")?.text ||
        page.pageId,
      eyebrow: page.eyebrow,
      teachingPhase: page.teachingPhase,
      sourceMapping: page.sourceMapping,
      teacherNotes: page.teacherNotes,
      components,
    };
  });
  return {
    schemaVersion: "hai_web_deck_v2",
    outputMode: "interactive",
    title: manuscript.pages[0].materials.find((item) => item.kind === "title")
      ?.text || source.topic,
    subtitle: `${source.grade || "课堂"} · ${source.subject || "教学设计"}`,
    source,
    scenes,
  };
}

const INTERACTIVE_HTML_CSP =
  "default-src 'none'; img-src data: blob:; media-src data: blob:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'";

function extractInteractiveHtml(rawOutput: string) {
  const withoutFence = rawOutput.trim()
    .replace(/^```(?:html)?\s*/iu, "")
    .replace(/```\s*$/u, "")
    .trim();
  const start = withoutFence.search(/<!doctype\s+html|<html\b/iu);
  const end = withoutFence.toLowerCase().lastIndexOf("</html>");
  if (start < 0) {
    throw new Error("互动网页必须输出完整 HTML 文档。");
  }
  if (end < start) {
    const sceneCount = [...withoutFence.matchAll(/data-hai-scene\s*=/giu)]
      .length;
    throw new Error(
      `互动网页输出被截断（仅生成 ${sceneCount} 个场景，且缺少 </html>）。`,
    );
  }
  const html = withoutFence.slice(start, end + 7).trim();
  if (html.length > 240000) {
    throw new Error("互动网页 HTML 过长，请减少单页内容后重试。");
  }
  return /^<!doctype\s+html/iu.test(html) ? html : `<!doctype html>\n${html}`;
}

function validateInteractiveHtmlSafety(html: string) {
  const blocked: Array<[RegExp, string]> = [
    [
      /<\s*(?:iframe|object|embed|form|base|link)\b/iu,
      "嵌套页面、对象、表单或外链标签",
    ],
    [/<meta\b[^>]*http-equiv/iu, "自定义安全策略"],
    [/<script\b[^>]*\bsrc\s*=/iu, "外部脚本"],
    [
      /(?:src|href)\s*=\s*(?:"(?!\s*(?:#|data:|blob:))[^"]*"|'(?!\s*(?:#|data:|blob:))[^']*')/iu,
      "外部资源地址",
    ],
    [/(?:@import|url\s*\(\s*["']?(?!\s*(?:data:|#)))/iu, "外部样式资源"],
    [
      /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/u,
      "网络请求 API",
    ],
    [
      /\b(?:localStorage|sessionStorage|indexedDB|document\.cookie)\b/u,
      "浏览器持久化数据",
    ],
    [
      /(?:window\s*\.\s*(?:parent|top|opener)|\b(?:parent|top|opener)\s*\.)/u,
      "父页面访问",
    ],
    [/\bpostMessage\s*\(/u, "跨窗口消息"],
    [
      /(?:(?:window|document)\s*\.\s*location\b|\blocation\s*\.\s*(?:href|assign|replace)\b)/u,
      "页面跳转",
    ],
    [/\b(?:eval|Function)\s*\(/u, "动态代码执行"],
    [/\bdocument\.(?:write|writeln)\s*\(/u, "文档重写"],
  ];
  for (const [pattern, label] of blocked) {
    if (pattern.test(html)) throw new Error(`互动网页包含不允许的${label}。`);
  }
}

function injectInteractiveHtmlRuntime(html: string) {
  const headPayload =
    `<meta http-equiv="Content-Security-Policy" content="${INTERACTIVE_HTML_CSP}"><style>[data-hai-scene]{position:absolute!important;inset:0!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}[data-hai-scene][data-hai-active="true"]{visibility:visible!important;opacity:1!important;pointer-events:auto!important}</style>`;
  const runtime =
    `<script>(function(){const scenes=Array.from(document.querySelectorAll('[data-hai-scene]'));let current=0;function show(index,notify){current=Math.max(0,Math.min(scenes.length-1,Number(index)||0));scenes.forEach(function(scene,i){scene.setAttribute('data-hai-active',i===current?'true':'false');scene.setAttribute('aria-hidden',i===current?'false':'true')});if(notify!==false){parent.postMessage({type:'HAI_SCENE_CHANGE',index:current},'*')}}window.addEventListener('message',function(event){const data=event.data||{};if(data.type==='HAI_GOTO_SCENE')show(data.index,false)});document.addEventListener('keydown',function(event){if(event.key==='ArrowLeft'){event.preventDefault();show(current-1,true)}if(event.key==='ArrowRight'){event.preventDefault();show(current+1,true)}});show(0,false)})();</script>`;
  const withHead = /<head\b[^>]*>/iu.test(html)
    ? html.replace(/<head\b[^>]*>/iu, (match) => `${match}${headPayload}`)
    : html.replace(
      /<html\b[^>]*>/iu,
      (match) => `${match}<head>${headPayload}</head>`,
    );
  return /<\/body>/iu.test(withHead)
    ? withHead.replace(/<\/body>/iu, `${runtime}</body>`)
    : withHead.replace(/<\/html>/iu, `<body>${runtime}</body></html>`);
}

export function buildInteractiveHtmlPrompt(
  manuscriptMarkdown: string,
  source: Source,
) {
  return `你是一位擅长设计互动式课件、尤其理解幼童与青少年认知特点的前端网页设计师。请根据下面已经完成的逐页教学大纲，直接生成一份完整、可运行的前端 HTML 课件。只输出 HTML，不输出解释、Markdown 或代码围栏；不需要后端。

硬性结构：
1. 输出从 <!doctype html> 开始的完整文档，CSS 和 JavaScript 只能内联；不得引用框架、CDN、字体、图片、音视频或任何外部资源，不得发起网络请求、读取浏览器存储、提交表单或访问父页面。
2. 大纲中的每一页对应且只对应一个 <section data-hai-scene="P01">，按 P01、P02……原顺序排列；不要编写整套课件的上一页/下一页按钮或左右键代码，宿主播放器会统一接管场景切换。
3. 每个场景适配单屏课堂投影，信息少而聚焦。每场景只保留一个主要学习动作和 2—4 个必要视觉区块；长材料使用点击展开、逐步揭晓、Tabs、卡片翻转、拖拽排序、选择反馈等方式分层呈现，不能把大纲内容全部平铺。
4. 允许丰富的 CSS 动画、SVG 图形与原生 JavaScript 互动。不同教学功能要有明显不同的构图和互动方式，避免所有页面都是标题加几张相同卡片；按钮需有清晰 hover/focus/active 状态，并兼顾触屏和键盘。
5. 视觉风格要适龄：低龄课程可使用明快配色、圆润形状、拟物小道具和鼓励性反馈；高年级课程降低卡通感并强化信息层级。始终保持大字号、高对比、足够留白和 16:9 投影可读性。
6. 忠实使用大纲中的学生可见文字、问题、材料、条件、选项、步骤、数据和结论，不改写、不杜撰、不提前泄露答案；教师备注不得显示在 HTML 正文中。
7. 不使用 iframe、object、embed、form、link、base、外部 href/src、@import、fetch、XMLHttpRequest、WebSocket、localStorage、document.cookie、eval 或 document.write。元素 ID 必须唯一。
8. 使用固定 1920×1080 的 .deck-stage，将整个舞台等比缩放并居中适配视口；每个 data-hai-scene 场景绝对铺满舞台，不能按设备宽度重排内容。场景自身可以使用 grid/flex，但不要用 display 控制整页显隐。
9. 不自行监听 ArrowLeft/ArrowRight，不生成可见翻页控件、缩略图栏或页码导航；服务端会注入唯一的整页切换运行时。必须提供 prefers-reduced-motion 降级。

输出预算（必须遵守，防止文档被截断）：
1. 整份 HTML 控制在 50,000 个字符以内；<style> 不超过 5,000 字符，<script> 不超过 7,000 字符。不要输出注释、设计说明、备用样式或未使用的代码。
2. 先写一个短小的共享样式表，再立即输出 <body> 中的全部场景，最后写一段共享脚本。不要为每一页复制 CSS 或 JavaScript。
3. CSS 只使用 8—16 个可复用的语义类和少量 CSS 变量；类名不超过 24 个字符。禁止原子类/工具类堆叠、页面专属样式、同一选择器重复定义，以及在类名中反复追加 strong、soft、light、dark、hover 等词。
4. JavaScript 使用事件委托和 data-* 属性复用互动逻辑；同类互动只实现一次。SVG 仅使用少量基础图形，不输出冗长 path 数据。
5. 在开始扩展动画或装饰前，优先确保 P01 到最后一页的全部 section、</body> 和 </html> 已完整输出。若预算紧张，减少装饰和动画，绝不能省略场景或闭合标签。

课程：${source.subject}，${source.grade}，${source.topic}
逐页教学大纲：
${manuscriptMarkdown.slice(0, 160000)}`;
}

export function buildInteractiveHtmlRetryPrompt(
  manuscriptMarkdown: string,
  source: Source,
  failureReason: string,
) {
  return `${buildInteractiveHtmlPrompt(manuscriptMarkdown, source)}

上一次生成未通过完整性或安全校验，原因是：${failureReason.slice(0, 300)}
请从头重新生成，不要续写上一次内容。此次使用极简共享 CSS 和共享事件委托脚本；先保证全部场景与完整 HTML 闭合，再添加少量必要动画。只输出新的完整 HTML。`;
}

export function hydrateInteractiveHtml(
  rawOutput: string,
  manuscript: CoursewareManuscript,
  source: Source,
) {
  const html = extractInteractiveHtml(rawOutput);
  validateInteractiveHtmlSafety(html);
  const refs = [...html.matchAll(/data-hai-scene\s*=\s*["'](P\d{2})["']/giu)]
    .map((match) => match[1].toUpperCase());
  const expected = manuscript.pages.map((page) => page.pageId);
  if (
    refs.length !== expected.length ||
    refs.some((ref, index) => ref !== expected[index])
  ) {
    throw new Error(`互动网页场景必须按顺序完整覆盖 ${expected.join("、")}。`);
  }
  const scenes = manuscript.pages.map((page, index) => ({
    id: page.pageId,
    index,
    title: page.materials.find((item) => item.kind === "title")?.text ||
      page.pageId,
    eyebrow: page.eyebrow,
    teachingPhase: page.teachingPhase,
    sourceMapping: page.sourceMapping,
    teacherNotes: page.teacherNotes,
  }));
  return {
    schemaVersion: "hai_web_deck_v3",
    outputMode: "interactive",
    title: scenes[0]?.title || source.topic,
    subtitle: `${source.grade || "课堂"} · ${source.subject || "教学设计"}`,
    source,
    scenes,
    html: injectInteractiveHtmlRuntime(html),
  };
}

function componentContent(material: CoursewareMaterial, type: string): Raw {
  if (material.kind === "comparison") {
    return { comparison: material.comparison };
  }
  if (material.kind === "relation") {
    return type === "bullet" || type === "card"
      ? {
        items: material.relations?.map((item) =>
          optionalText(item.value, 300)
            ? `${requiredText(item.label, "关系标签")}：${
              optionalText(item.value, 300)
            }`
            : requiredText(item.label, "关系标签")
        ),
        ...(type === "card" && material.visual
          ? { visual: material.visual }
          : {}),
      }
      : { relations: material.relations, visual: material.visual };
  }
  if (material.kind === "data") {
    if (type === "card") {
      const data = record(material.data);
      const labels = Array.isArray(data.labels) ? data.labels : [];
      const values = Array.isArray(data.values) ? data.values : [];
      return {
        text: optionalText(data.conclusion, 1000),
        items: labels.map((label, index) =>
          `${requiredText(label, "数据标签")}: ${values[index]}${
            optionalText(data.unit, 80) ?? ""
          }`
        ),
      };
    }
    return { data: material.data };
  }
  if (material.kind === "points") return { items: material.items };
  if (material.kind === "image") {
    return { text: material.text, visual: material.visual };
  }
  return {
    text: material.text,
    ...(material.items?.length ? { items: material.items } : {}),
  };
}

function bodyComponentContent(
  material: CoursewareMaterial,
  input: Raw,
): Raw {
  const content: Raw = {};
  const text = optionalText(input.text, 12000);
  if (text) content.text = text;
  for (const key of ["items", "relations", "comparison", "data", "visual"]) {
    const value = input[key];
    if (Array.isArray(value) && value.length) content[key] = value;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      content[key] = value;
    }
  }
  return Object.keys(content).length ? content : { text: material.text };
}

export function hydrateCoursewareDesign(
  designOutput: string,
  manuscript: CoursewareManuscript,
  source: Source,
  options: Options,
) {
  const design = parseCoursewareJson(designOutput);
  if (design.schemaVersion !== "hai_courseware_design_v1") {
    throw new Error("组件设计稿 schemaVersion 不正确。 ");
  }
  const rawSlides = Array.isArray(design.slides) ? design.slides : [];
  if (rawSlides.length !== manuscript.pages.length) {
    throw new Error("组件设计稿页数与逐页内容稿不一致。 ");
  }
  const slides = manuscript.pages.map((page, index) => {
    const rawSlide = record(rawSlides[index]);
    if (rawSlide.pageRef !== page.pageId) {
      throw new Error(`组件设计稿第 ${index + 1} 页必须引用 ${page.pageId}。`);
    }
    const rawComponents = Array.isArray(rawSlide.components)
      ? rawSlide.components
      : [];
    if (rawComponents.length < 1 || rawComponents.length > 8) {
      throw new Error(`${page.pageId} 的设计组件数量必须在 1—8 个之间。`);
    }
    const materials = new Map(page.materials.map((item) => [item.id, item]));
    const used = new Set<string>();
    let backgroundImageCount = 0;
    const components = rawComponents.map((value, componentIndex) => {
      const input = record(value);
      const rawType = String(input.type ?? "");
      const type = DESIGN_COMPONENT_TYPE_ALIASES[rawType] ?? rawType;
      if (!COMPONENT_TYPES.includes(type as typeof COMPONENT_TYPES[number])) {
        throw new Error(
          `${page.pageId} 第 ${componentIndex + 1} 个组件类型不合法。`,
        );
      }
      const explicitMaterialRef = optionalText(
        input.sourceMaterialRef ?? input.materialRef,
        60,
      );
      const materialRef = explicitMaterialRef || (
        type === "title"
          ? page.materials.find((item) =>
            item.kind === "title" && !used.has(item.id)
          )?.id
          : undefined
      );
      const metadata: Raw = {
        id: optionalText(input.id, 80) ||
          `${page.pageId}-C${String(componentIndex + 1).padStart(2, "0")}`,
        type,
        ...([
          "variant",
          "role",
          "icon",
          "tone",
          "textStyle",
          "importance",
          "flexibility",
          "editability",
        ].reduce((result, key) => {
          const value = optionalText(input[key], 100);
          if (value) result[key] = value;
          return result;
        }, {} as Raw)),
      };
      if (!materialRef) {
        if (type === "image" && options.visualMode === "V2") {
          backgroundImageCount += 1;
          if (backgroundImageCount > 1) {
            throw new Error(`${page.pageId} 只能有一项整页背景图组件。`);
          }
          return {
            ...metadata,
            role: optionalText(input.role, 100) ?? "background",
            imageDescription: page.imageDescription,
          };
        }
        if (
          type === "image" &&
          options.visualMode === "V1" &&
          !page.materials.some((item) => item.kind === "image")
        ) {
          return null;
        }
        if (!DECORATIVE_TYPES.has(type)) {
          throw new Error(`${page.pageId} 的非装饰组件必须引用素材。`);
        }
        return metadata;
      }
      const material = materials.get(materialRef);
      if (!material) {
        throw new Error(`${page.pageId} 引用了不存在的素材 ${materialRef}。`);
      }
      if (material.kind !== "body" && used.has(materialRef)) {
        throw new Error(`${materialRef} 被重复引用。`);
      }
      if (
        material.kind !== "body" &&
        !COMPATIBLE_COMPONENTS[material.kind]?.includes(type)
      ) {
        throw new Error(`${materialRef} 不能使用 ${type} 组件。`);
      }
      used.add(materialRef);
      if (type === "image" && material.kind === "image") {
        backgroundImageCount += 1;
        if (backgroundImageCount > 1) {
          throw new Error(`${page.pageId} 只能有一项整页背景图组件。`);
        }
      }
      return {
        ...metadata,
        ...(material.kind === "body"
          ? bodyComponentContent(material, input)
          : componentContent(material, type)),
        ...(material.provenance ? { provenance: material.provenance } : {}),
      };
    }).filter((component): component is Raw => component !== null);
    const missing = page.materials.filter((item) => !used.has(item.id));
    if (missing.length) {
      throw new Error(
        `${page.pageId} 遗漏素材：${
          missing.map((item) => item.id).join("、")
        }。`,
      );
    }
    if (options.visualMode === "V2" && backgroundImageCount !== 1) {
      throw new Error(
        `${page.pageId} 在 V2 中必须且只能有一项整页背景图组件。`,
      );
    }
    const normalizedLayout = normalizeDesignLayout(
      rawSlide.layout,
      page.function,
    );
    return {
      function: page.function,
      pageFunction: page.pageFunction,
      teachingPhase: page.teachingPhase,
      layout: normalizedLayout,
      visualIntensity: optionalText(rawSlide.visualIntensity, 10) ?? "L1",
      eyebrow: page.eyebrow,
      imageDescription: page.imageDescription,
      sourceMapping: page.sourceMapping,
      teacherNotes: page.teacherNotes,
      components,
    };
  });
  return {
    schemaVersion: "hai_courseware_deck_v4",
    subjectProfile: source.subjectProfile ||
      normalizeCoursewareSubjectProfile(source.subject),
    lessonGenre: source.lessonGenre || "general",
    animationPreset: options.animationPreset || "reveal-content",
    flatPattern: options.flatPattern || "none",
    title: source.topic || source.artifactTitle || "HAI 课堂课件",
    subtitle: `${source.grade || "课堂"} · ${source.subject || "教学设计"}`,
    visualProfile: record(design.visualProfile),
    slides,
  };
}
