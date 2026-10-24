import {
  buildCoursewareContentPrompt,
  buildCoursewareDesignPrompt,
  buildCoursewareImagePromptPrompt,
  buildCoursewareMaterialPrompt,
  buildCoursewareVisualDesignPrompt,
  buildInteractiveDesignPrompt,
  buildInteractiveHtmlPrompt,
  buildInteractiveHtmlRetryPrompt,
  formatCoursewareManuscript,
  hydrateCoursewareDesign,
  hydrateInteractiveDesign,
  hydrateInteractiveHtml,
  parseCoursewareManuscript,
  parseCoursewareSupplements,
  parseCoursewareVisualDesign,
  validateCoursewareManuscriptCoverage,
} from "./hai_courseware_pipeline.ts";
import { normalizeCoursewareDeck } from "./hai_courseware.ts";

const source = {
  taskId: "task-1",
  artifactId: "artifact-1",
  artifactVersion: 1,
  taskTitle: "集合教学设计",
  artifactTitle: "集合",
  subject: "数学",
  grade: "高中一年级",
  topic: "集合",
  subjectProfile: "mathematics",
  lessonGenre: "concept",
};

const options = {
  visualMode: "V1",
  length: "compact",
  imageStrategy: "smart",
} as const;

const pageFunctions = [
  ["F01_COVER", "U01_COVER", "opening"],
  ["F04_CORE_QUESTION", "U05_CORE_QUESTION", "diagnosis"],
  ["F10_ACTIVITY", "MATH03_CONCEPT_FORMATION", "construction"],
  ["F05_CONTENT", "MATH07_PROPERTY_THEOREM", "construction"],
  ["F11_EXERCISE", "U10_PRACTICE", "practice"],
  ["F12_SUMMARY", "U12_SUMMARY", "closure"],
] as const;

function manuscriptMarkdown() {
  return [
    "# 集合｜逐页内容稿",
    ...pageFunctions.flatMap(([fn, pageFunction, phase], index) => {
      const pageId = `P${String(index + 1).padStart(2, "0")}`;
      const materials = [{
        id: `${pageId}-M01`,
        kind: "title",
        text: index === 0 ? "集合" : `任务${index}`,
      }];
      if (index > 0) {
        materials.push({
          id: `${pageId}-M02`,
          kind: index === 4 ? "exercise" : index === 5 ? "points" : "text",
          ...(index === 4
            ? { text: "判断 A⊆B 是否成立，并说明理由。" }
            : index === 5
            ? {
              items: [
                "子集：A 中任意元素都属于 B，则 A⊆B。",
                "集合相等：A⊆B 且 B⊆A。",
              ],
            }
            : { text: `教案中第 ${index} 项需要完整投屏的内容。` }),
        } as never);
      }
      const page = {
        pageId,
        function: fn,
        pageFunction,
        teachingPhase: phase,
        eyebrow: index > 0 ? `环节${index} · 任务${index}` : "",
        sourceMapping: {
          section: index === 0 ? "课题" : `环节${index}`,
          task: index === 0 ? "" : `任务${index}`,
          sourceExcerpt: index === 0 ? "集合" : `教案原文${index}`,
        },
        teacherNotes: index === 1
          ? ["若多数学生判断有误，则回到元素归属。"]
          : [],
        materials,
      };
      return [
        "",
        `## ${pageId}｜${materials[0].text}`,
        "```json",
        JSON.stringify(page),
        "```",
      ];
    }),
  ].join("\n");
}

function designOutput() {
  const layouts = [
    "C02_COVER_CENTER",
    "Q01_BIG_QUESTION",
    "A01_TASK_CARD",
    "K01_TITLE_BODY",
    "E01_SINGLE_QUESTION",
    "T01_THREE_POINTS",
  ];
  return JSON.stringify({
    schemaVersion: "hai_courseware_design_v1",
    visualProfile: { palette: ["2E6BFF"] },
    slides: pageFunctions.map((_, index) => {
      const pageId = `P${String(index + 1).padStart(2, "0")}`;
      return {
        pageRef: pageId,
        layout: layouts[index],
        visualIntensity: "L1",
        components: [
          { materialRef: `${pageId}-M01`, type: "title" },
          ...(index === 0 ? [] : [{
            materialRef: `${pageId}-M02`,
            type: index === 4 ? "exercise" : index === 5 ? "emphasis" : "text",
          }]),
        ],
      };
    }),
  });
}

function assertThrows(fn: () => unknown, message: string) {
  try {
    fn();
  } catch (error) {
    if (error instanceof Error && error.message.includes(message)) return;
    throw error;
  }
  throw new Error(`expected error containing ${message}`);
}

Deno.test("two-stage courseware pipeline preserves manuscript text in final components", () => {
  const manuscript = parseCoursewareManuscript(manuscriptMarkdown());
  const normalizedMarkdown = formatCoursewareManuscript(manuscript);
  const hydrated = hydrateCoursewareDesign(
    designOutput(),
    manuscript,
    source,
    options,
  );
  const deck = normalizeCoursewareDeck(
    JSON.stringify(hydrated),
    source,
    options,
  );
  const summary = deck.slides.at(-1);
  const summaryItems = summary?.components.find((item) =>
    item.type === "emphasis"
  )?.items as string[] | undefined;
  if (summaryItems?.[0] !== "子集：A 中任意元素都属于 B，则 A⊆B。") {
    throw new Error("summary text drifted during component hydration");
  }
  if (!normalizedMarkdown.includes("若多数学生判断有误")) {
    throw new Error("teacher notes were lost from normalized manuscript");
  }
  if (
    deck.slides[1].components.some((item) =>
      String(item.text).includes("多数学生")
    )
  ) {
    throw new Error("teacher-only text leaked into student components");
  }
});

Deno.test("design hydration maps manuscript-only points type to bullet", () => {
  const manuscript = parseCoursewareManuscript(manuscriptMarkdown());
  const design = JSON.parse(designOutput());
  design.slides[5].components[1].type = "points";
  const hydrated = hydrateCoursewareDesign(
    JSON.stringify(design),
    manuscript,
    source,
    options,
  );
  const component = hydrated.slides[5].components[1];
  if (component.type !== "bullet") {
    throw new Error("points alias was not normalized to bullet");
  }
  if (!Array.isArray(component.items) || component.items.length !== 2) {
    throw new Error("points content was lost while normalizing its component");
  }
});

Deno.test("design hydration repairs a layout from the wrong function family", () => {
  const manuscript = parseCoursewareManuscript(manuscriptMarkdown());
  const design = JSON.parse(designOutput());
  design.slides[1].layout = "A04_MATERIAL_TASK";
  const hydrated = hydrateCoursewareDesign(
    JSON.stringify(design),
    manuscript,
    source,
    options,
  );
  if (hydrated.slides[1].layout !== "Q01_BIG_QUESTION") {
    throw new Error("invalid layout did not fall back to its function family");
  }
});

Deno.test("design hydration binds an unreferenced unique title material", () => {
  const manuscript = parseCoursewareManuscript(manuscriptMarkdown());
  const design = JSON.parse(designOutput());
  delete design.slides[0].components[0].materialRef;
  const hydrated = hydrateCoursewareDesign(
    JSON.stringify(design),
    manuscript,
    source,
    options,
  );
  if (hydrated.slides[0].components[0].text !== "集合") {
    throw new Error("the unique cover title material was not recovered");
  }
});

Deno.test("design hydration drops an unreferenced V1 background image", () => {
  const manuscript = parseCoursewareManuscript(manuscriptMarkdown());
  const design = JSON.parse(designOutput());
  design.slides[0].components.push({ type: "image", role: "background" });
  const hydrated = hydrateCoursewareDesign(
    JSON.stringify(design),
    manuscript,
    source,
    options,
  );
  if (
    hydrated.slides[0].components.some((component) =>
      component.type === "image"
    )
  ) {
    throw new Error("the empty V1 background image was not dropped");
  }
});

Deno.test("two-stage courseware pipeline rejects omitted or rewritten material refs", () => {
  const manuscript = parseCoursewareManuscript(manuscriptMarkdown());
  const design = JSON.parse(designOutput());
  design.slides[5].components.pop();
  assertThrows(
    () =>
      hydrateCoursewareDesign(
        JSON.stringify(design),
        manuscript,
        source,
        options,
      ),
    "遗漏素材：P06-M02",
  );
  design.slides[5].components.push({
    materialRef: "P06-M02",
    type: "emphasis",
    items: ["被设计阶段擅自改写"],
  });
  const hydrated = hydrateCoursewareDesign(
    JSON.stringify(design),
    manuscript,
    source,
    options,
  );
  const component = hydrated.slides[5].components[1] as { items?: string[] };
  if (component.items?.includes("被设计阶段擅自改写")) {
    throw new Error("design-stage text overrode the manuscript");
  }
});

Deno.test("two-stage prompts separate content writing from component design", () => {
  const contentPrompt = buildCoursewareContentPrompt(
    "# 集合教案",
    source,
    options,
  );
  const designPrompt = buildCoursewareDesignPrompt(
    manuscriptMarkdown(),
    source,
    options,
  );
  if (
    !contentPrompt.includes("不选择 layout") ||
    !contentPrompt.includes("材料中性") ||
    !contentPrompt.includes("kind=title；其余全部使用 kind=body")
  ) {
    throw new Error("content prompt does not isolate content authoring");
  }
  if (
    !designPrompt.includes("不能增删、改写或复制") ||
    !designPrompt.includes("sourceMaterialRef") ||
    !designPrompt.includes("不再增加 visualPrototype 层")
  ) {
    throw new Error("design prompt does not protect manuscript content");
  }
});

Deno.test("content parser restores misplaced cover and summary boundaries", () => {
  const blocks = [
    ...manuscriptMarkdown().matchAll(/```json\s*([\s\S]*?)```/gi),
  ];
  const pages = blocks.map((match) =>
    JSON.parse(match[1].trim()) as Record<string, unknown>
  );
  pages[0].function = "F02_SECTION";
  pages[1].function = "F01_COVER";
  pages.at(-2)!.function = "F12_SUMMARY";
  pages.at(-1)!.function = "F02_SECTION";
  const markdown = pages.map((page) =>
    `## ${page.pageId}\n\n\`\`\`json\n${JSON.stringify(page)}\n\`\`\``
  ).join("\n\n");
  const parsed = parseCoursewareManuscript(markdown).pages;
  if (
    parsed[0].function !== "F01_COVER" ||
    parsed.at(-1)?.function !== "F12_SUMMARY" ||
    parsed[0].pageId !== "P02" ||
    parsed.at(-1)?.pageId !== "P05"
  ) throw new Error("misplaced boundary pages were not restored");
});

Deno.test("V2 outline requires one concrete background description on every page", () => {
  const blocks = [
    ...manuscriptMarkdown().matchAll(/```json\s*([\s\S]*?)```/gi),
  ];
  const pages = blocks.map((match) => {
    const page = JSON.parse(match[1].trim()) as {
      pageId: string;
      materials: Array<Record<string, unknown>>;
    };
    page.materials.push({
      id: `${page.pageId}-M03`,
      kind: "image",
      text: `${page.pageId} 图注`,
      visual: {
        kind: "illustration",
        purpose: "建立本页视觉入口",
        description: `${page.pageId} 的具体主体位于右侧，左侧保留正文安全区。`,
        sourceExcerpt: "教案中的本页教学内容",
      },
    });
    return page;
  });
  const markdown = pages.map((page) =>
    `## ${page.pageId}\n\n\`\`\`json\n${JSON.stringify(page)}\n\`\`\``
  ).join("\n\n");
  const parsed = parseCoursewareManuscript(markdown, [], "V2");
  if (
    !parsed.pages.every((page) => page.imageDescription?.includes("正文安全区"))
  ) {
    throw new Error(
      "V2 background descriptions were not preserved in the outline",
    );
  }
  const duplicatedPages = structuredClone(pages);
  duplicatedPages[0].materials.push({
    id: "P01-M04",
    kind: "image",
    text: "封面补充图",
    visual: {
      kind: "illustration",
      purpose: "补充封面视觉元素",
      description: "右侧出现抽象的集合关系线条，左侧保留正文安全区。",
      sourceExcerpt: "教案中的封面视觉要求",
    },
  });
  const duplicatedMarkdown = duplicatedPages.map((page) =>
    `## ${page.pageId}\n\n\`\`\`json\n${JSON.stringify(page)}\n\`\`\``
  ).join("\n\n");
  const merged = parseCoursewareManuscript(duplicatedMarkdown, [], "V2");
  const mergedImages = merged.pages[0].materials.filter((item) =>
    item.kind === "image"
  );
  if (
    mergedImages.length !== 1 ||
    !merged.pages[0].imageDescription?.includes("抽象的集合关系线条")
  ) {
    throw new Error("duplicate V2 background materials were not merged");
  }
  const invalidPages = structuredClone(pages);
  invalidPages[0].materials.pop();
  const withoutImage = invalidPages.map((page) =>
    `## ${page.pageId}\n\n\`\`\`json\n${JSON.stringify(page)}\n\`\`\``
  ).join("\n\n");
  assertThrows(
    () => parseCoursewareManuscript(withoutImage, [], "V2"),
    "V2 页面必须包含具体的整页背景图描述",
  );
});

Deno.test("neutral outline lets the second round split body content and add page background", () => {
  const blocks = [
    ...manuscriptMarkdown().matchAll(/```json\s*([\s\S]*?)```/gi),
  ];
  const pages = blocks.map((match) => {
    const page = JSON.parse(match[1].trim()) as Record<string, unknown>;
    const pageId = String(page.pageId);
    const originalMaterials = page.materials as Array<Record<string, unknown>>;
    page.function = undefined;
    page.imageDescription =
      `${pageId} 的教学场景，主体位于右侧，左侧保留正文安全区。`;
    page.materials = [
      originalMaterials[0],
      ...(originalMaterials[1]
        ? [{
          id: `${pageId}-M02`,
          kind: "body",
          text: String(
            originalMaterials[1].text ?? originalMaterials[1].items ??
              "完整正文",
          ),
        }]
        : []),
    ];
    delete page.function;
    return page;
  });
  const markdown = pages.map((page) =>
    `## ${page.pageId}\n\n\`\`\`json\n${JSON.stringify(page)}\n\`\`\``
  ).join("\n\n");
  const manuscript = parseCoursewareManuscript(markdown, [], "V2");
  const layouts = [
    "C02_COVER_CENTER",
    "Q01_BIG_QUESTION",
    "K01_TITLE_BODY",
    "K02_CONCEPT_EXAMPLE",
    "E01_SINGLE_QUESTION",
    "T01_THREE_POINTS",
  ];
  const design = {
    schemaVersion: "hai_courseware_design_v1",
    visualProfile: { palette: ["2E6BFF"] },
    slides: manuscript.pages.map((page, index) => ({
      pageRef: page.pageId,
      layout: layouts[index],
      components: [
        { sourceMaterialRef: `${page.pageId}-M01`, type: "title" },
        ...(index === 0 ? [] : [
          {
            sourceMaterialRef: `${page.pageId}-M02`,
            type: "text",
            text: "正文第一部分",
          },
          {
            sourceMaterialRef: `${page.pageId}-M02`,
            type: "emphasis",
            text: "正文第二部分",
          },
        ]),
        { type: "image", role: "background" },
      ],
    })),
  };
  const hydrated = hydrateCoursewareDesign(
    JSON.stringify(design),
    manuscript,
    source,
    { ...options, visualMode: "V2" },
  );
  const contentComponents = hydrated.slides[2].components.filter((item) =>
    item.type !== "title" && item.type !== "image"
  );
  if (contentComponents.length !== 2) {
    throw new Error(
      "body material was not split into two second-round components",
    );
  }
  const componentIds = hydrated.slides.flatMap((slide) =>
    slide.components.map((component) => String(component.id))
  );
  if (
    componentIds.some((id) => !id.match(/^P\d{2}-C\d{2}$/)) ||
    new Set(componentIds).size !== componentIds.length
  ) {
    throw new Error(
      "component ids were not normalized to stable page-local ids",
    );
  }
  if (
    hydrated.slides.some((slide) =>
      (slide as Record<string, unknown>).visualPrototype
    )
  ) {
    throw new Error(
      "visualPrototype should not be part of the new slide contract",
    );
  }
  if (hydrated.slides.some((slide) => !slide.imageDescription)) {
    throw new Error(
      "page background descriptions were not carried into the deck",
    );
  }
  const deck = normalizeCoursewareDeck(
    JSON.stringify(hydrated),
    source,
    { ...options, visualMode: "V2" },
  );
  if (
    deck.slides.some((slide) =>
      !(slide as Record<string, unknown>).imageDescription
    )
  ) {
    throw new Error(
      "page background descriptions were dropped by deck normalization",
    );
  }
});

Deno.test("content-stage validation requires lesson-plan tasks to remain visible", () => {
  const manuscript = parseCoursewareManuscript(manuscriptMarkdown());
  validateCoursewareManuscriptCoverage(
    manuscript,
    "# 教案\n## 教学过程\n### 环节一\n#### 任务一\n提问。\n### 环节二\n#### 任务二\n归纳。\n## 板书设计\n",
  );
  const hiddenTask = structuredClone(manuscript);
  hiddenTask.pages = hiddenTask.pages.map((page) => ({
    ...page,
    eyebrow: page.eyebrow?.replace("任务2", "归纳活动"),
    materials: page.materials.map((material) =>
      material.kind === "title"
        ? { ...material, text: material.text?.replace("任务2", "归纳活动") }
        : material
    ),
  }));
  assertThrows(
    () =>
      validateCoursewareManuscriptCoverage(
        hiddenTask,
        "# 教案\n## 教学过程\n### 环节一\n#### 任务一\n提问。\n### 环节二\n#### 任务二\n归纳。\n",
      ),
    "任务二",
  );
});

Deno.test("material supplement stage preserves provenance and exact display text", () => {
  const supplements = parseCoursewareSupplements(JSON.stringify({
    schemaVersion: "courseware_material_supplement_v1",
    items: [{
      id: "S01",
      trigger: "呈现一段史料，让学生分析",
      sourceSection: "环节一 · 任务1",
      title: "商鞅变法材料",
      content: "【教学改编材料】根据所给教材知识整理的完整分析材料。",
      teachingPurpose: "分析变法措施与作用",
      sourceType: "generated_adaptation",
      sourceTitle: "教学生成材料",
      fidelity: "generated",
      verification: "needs_review",
    }],
  }));
  const raw = manuscriptMarkdown().replace(
    '"kind":"text","text":"教案中第 1 项需要完整投屏的内容。"',
    '"kind":"text","supplementRef":"S01","text":"被第二阶段缩写的文字"',
  );
  const manuscript = parseCoursewareManuscript(raw, supplements);
  const material = manuscript.pages[1].materials[1];
  if (
    material.text !== "【教学改编材料】根据所给教材知识整理的完整分析材料。" ||
    material.provenance?.verification !== "needs_review"
  ) throw new Error("supplement content or provenance drifted");
  const hydrated = hydrateCoursewareDesign(
    designOutput(),
    manuscript,
    source,
    options,
  );
  const deck = normalizeCoursewareDeck(
    JSON.stringify(hydrated),
    source,
    options,
  );
  const provenance = deck.slides[1].components[1].provenance as
    | { sourceType?: string }
    | undefined;
  if (provenance?.sourceType !== "generated_adaptation") {
    throw new Error("final DeckSpec lost material provenance");
  }
  assertThrows(
    () => parseCoursewareManuscript(manuscriptMarkdown(), supplements),
    "遗漏补充素材：S01",
  );
});

Deno.test("material supplement prompt receives the original work source pack", () => {
  const prompt = buildCoursewareMaterialPrompt("# 教案\n呈现一段史料。", {
    inputSnapshot: { topic: "商鞅变法", textbook_content: "用户粘贴正文" },
    textbookSections: [{
      id: "section-1",
      title: "第二课",
      content: "教材知识点梳理（非逐字原文）",
      contentType: "knowledge_summary",
      verification: "verified",
    }],
    userMaterials: [{
      id: "material-1",
      title: "课堂史料",
      kind: "lesson_material",
      content: "用户上传的完整史料正文",
    }],
    caseMaterials: [],
  }, source);
  if (
    !prompt.includes("用户上传的完整史料正文") ||
    !prompt.includes("不能冒充教材原文") ||
    !prompt.includes("generated_adaptation")
  ) throw new Error("material prompt lost source or provenance rules");
});

Deno.test("generated supplements cannot pretend to be verified quotations", () => {
  assertThrows(
    () =>
      parseCoursewareSupplements(JSON.stringify({
        schemaVersion: "courseware_material_supplement_v1",
        items: [{
          id: "S01",
          trigger: "史料",
          sourceSection: "环节一",
          title: "史料",
          content: "伪造原文",
          teachingPurpose: "分析",
          sourceType: "generated_adaptation",
          sourceTitle: "教学生成材料",
          fidelity: "verbatim",
          verification: "verified",
        }],
      })),
    "生成性材料必须标记为 needs_review",
  );
});

Deno.test("pure-image workflow exposes one editable visual brief before internal page prompts", () => {
  const outline = manuscriptMarkdown();
  const prompt = buildCoursewareVisualDesignPrompt(outline, source);
  if (
    !prompt.includes("只输出一段") || !prompt.includes("不要生成逐页提示词")
  ) {
    throw new Error(
      "visual confirmation prompt leaked into per-page generation",
    );
  }
  const visualDesign = parseCoursewareVisualDesign(
    "整套课件使用清爽的现代教育插画风格，主色为深蓝，辅助色为明黄与白色，保持高对比。画面使用柔和自然光、细腻纸张质感和统一的人物造型，中文使用清晰无衬线字体，标题与正文分层明确，16:9 投影下保持足够留白和可读性。",
  );
  const imagePrompt = buildCoursewareImagePromptPrompt(outline, source, {
    ...options,
    visualMode: "V3",
    imageStrategy: "enhanced",
  }, visualDesign);
  if (
    !imagePrompt.includes(visualDesign) ||
    !imagePrompt.includes("用户已确认的整体视觉设计")
  ) {
    throw new Error(
      "confirmed visual design did not reach image prompt generation",
    );
  }
});

Deno.test("interactive design selects Web Components and hydrates a continuous scene deck", () => {
  const manuscript = parseCoursewareManuscript(manuscriptMarkdown());
  const design = {
    schemaVersion: "hai_web_component_design_v1",
    scenes: manuscript.pages.map((page, index) => ({
      sceneRef: page.pageId,
      components: [{
        id: `${page.pageId}-C01`,
        type: index === 0
          ? "hero"
          : index === 4
          ? "quiz"
          : index === 5
          ? "reveal"
          : "prose",
        sourceMaterialRefs: page.materials.map((material) => material.id),
      }],
    })),
  };
  const prompt = buildInteractiveDesignPrompt(manuscript.markdown, source, {
    ...options,
    outputMode: "interactive",
  });
  if (
    !prompt.includes("Web Component Catalog") ||
    !prompt.includes("不生成 PPT 组件") ||
    !prompt.includes("不输出 page、layout")
  ) {
    throw new Error(
      "interactive design prompt did not define the Web Component contract",
    );
  }
  const hydrated = hydrateInteractiveDesign(
    JSON.stringify(design),
    manuscript,
    source,
  );
  if (
    hydrated.schemaVersion !== "hai_web_deck_v2" || hydrated.scenes.length !== 6
  ) {
    throw new Error("interactive design did not become a six-scene web deck");
  }
  if (hydrated.scenes[0].components[0].type !== "hero") {
    throw new Error("cover scene did not use the hero Web Component");
  }
  if (hydrated.scenes[4].components[0].type !== "quiz") {
    throw new Error("exercise scene did not use the quiz Web Component");
  }
  if (
    !hydrated.scenes[1].components.some((component) =>
      component.type === "prose"
    )
  ) {
    throw new Error(
      "unreferenced title material was not preserved as a scene component",
    );
  }
});

Deno.test("interactive design recovers a missing source reference without inventing content", () => {
  const manuscript = parseCoursewareManuscript(manuscriptMarkdown());
  const design = {
    schemaVersion: "hai_web_component_design_v1",
    scenes: manuscript.pages.map((page, index) => ({
      sceneRef: page.pageId,
      components: [{
        id: `${page.pageId}-C01`,
        type: index === 0 ? "hero" : "prose",
        ...(index === 0 ? {} : { sourceMaterialRefs: [page.materials[1].id] }),
      }],
    })),
  };
  const hydrated = hydrateInteractiveDesign(
    JSON.stringify(design),
    manuscript,
    source,
  );
  const cover = hydrated.scenes[0].components[0];
  if (
    cover.type !== "hero" || cover.title !== "集合" ||
    !cover.sourceMaterialRefs?.includes("P01-M01")
  ) {
    throw new Error(
      "missing cover source reference was not deterministically recovered",
    );
  }
  if (hydrated.scenes[1].components.length < 2) {
    throw new Error("unreferenced title material was dropped from the scene");
  }
});

Deno.test("interactive HTML mode sends the outline directly to a frontend designer", () => {
  const manuscript = parseCoursewareManuscript(manuscriptMarkdown());
  const prompt = buildInteractiveHtmlPrompt(manuscript.markdown, source);
  if (
    !prompt.includes("直接生成一份完整、可运行的前端 HTML 课件") ||
    !prompt.includes('<section data-hai-scene="P01">') ||
    !prompt.includes("每场景只保留一个主要学习动作")
  ) {
    throw new Error(
      "interactive HTML prompt lost the direct-generation requirements",
    );
  }
  if (prompt.includes("Web Component Catalog")) {
    throw new Error(
      "interactive HTML prompt still requires the component layer",
    );
  }
  if (
    !prompt.includes("<style> 不超过 5,000 字符") ||
    !prompt.includes("禁止原子类/工具类堆叠") ||
    !prompt.includes("优先确保 P01 到最后一页") ||
    !prompt.includes("固定 1920×1080") ||
    !prompt.includes("prefers-reduced-motion")
  ) throw new Error("interactive HTML prompt lost its truncation controls");

  const retryPrompt = buildInteractiveHtmlRetryPrompt(
    manuscript.markdown,
    source,
    "互动网页输出被截断",
  );
  if (
    !retryPrompt.includes("请从头重新生成") ||
    !retryPrompt.includes("互动网页输出被截断")
  ) throw new Error("interactive HTML retry prompt lost the failure context");
});

Deno.test("interactive HTML hydration isolates model code and preserves scene navigation", () => {
  const manuscript = parseCoursewareManuscript(manuscriptMarkdown());
  const html =
    `<!doctype html><html><head><style>body{margin:0}.card{transition:transform .2s}.card:hover{transform:scale(1.02)}</style></head><body>${
      manuscript.pages.map((page) =>
        `<section data-hai-scene="${page.pageId}"><h1>${page.pageId}</h1><button class="card" onclick="this.classList.toggle('active')">互动</button></section>`
      ).join("")
    }<script>document.querySelectorAll('.card').forEach(function(card){card.setAttribute('tabindex','0')})</script></body></html>`;
  const deck = hydrateInteractiveHtml(html, manuscript, source);
  if (deck.schemaVersion !== "hai_web_deck_v3" || deck.scenes.length !== 6) {
    throw new Error("interactive HTML did not become a scene deck");
  }
  if (
    !deck.html.includes("Content-Security-Policy") ||
    !deck.html.includes("HAI_GOTO_SCENE")
  ) {
    throw new Error("sandbox CSP or host navigation bridge was not injected");
  }
  if (
    deck.html.includes("display:none!important") ||
    !deck.html.includes("visibility:hidden!important")
  ) {
    throw new Error(
      "host navigation bridge can override scene grid/flex layout",
    );
  }
  assertThrows(
    () =>
      hydrateInteractiveHtml(
        html.replace(
          "document.querySelectorAll",
          "fetch('/leak');document.querySelectorAll",
        ),
        manuscript,
        source,
      ),
    "网络请求 API",
  );
  assertThrows(
    () =>
      hydrateInteractiveHtml(html.replace("</html>", ""), manuscript, source),
    "输出被截断",
  );
});
