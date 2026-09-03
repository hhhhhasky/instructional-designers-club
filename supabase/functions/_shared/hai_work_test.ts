import {
  applyWorkCompletionPolicy,
  applyWorkOutputRuntimeTrace,
  assertWorkSkillRuntimeReady,
  buildWorkPrompt,
  buildWorkTaskTitle,
  createEmptyWorkSkill,
  filterExactTextbookSources,
  parseWorkJson,
  renderWorkMarkdown,
  selectWorkSkillReferences,
  selectWorkSkill,
  resolveTextbookRouteFromSnapshots,
  validateWorkInput,
  validateWorkOutput,
  type WorkSkillCandidate,
} from "./hai_work.ts";

Deno.test("Work completion policy disables thinking and caps public lesson output", () => {
  assertEquals(applyWorkCompletionPolicy("subject-lesson-design", {
    model: "deepseek-v4-pro",
    maxTokens: 30_000,
    thinkingEnabled: true,
  }), {
    model: "deepseek-v4-pro",
    maxTokens: 6_000,
    thinkingEnabled: false,
  });
  assertEquals(applyWorkCompletionPolicy("lesson-diagnosis", {
    maxTokens: 8_000,
    thinkingEnabled: true,
  }), {
    maxTokens: 8_000,
    thinkingEnabled: false,
  });
});

Deno.test("buildWorkTaskTitle uses the canonical public lesson prefix", () => {
  assertEquals(
    buildWorkTaskTitle("subject-lesson-design", "旧数据库模块名", { topic: "平行四边形的面积" }),
    "公开课设计｜平行四边形的面积",
  );
  assertEquals(
    buildWorkTaskTitle("lesson-diagnosis", "教案诊断", { topic: "背影" }),
    "教案诊断｜背影",
  );
});

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertThrows(fn: () => void, expectedMessage: string) {
  try {
    fn();
  } catch (error) {
    if (error instanceof Error && error.message.includes(expectedMessage)) return;
    throw error;
  }
  throw new Error(`expected function to throw: ${expectedMessage}`);
}

function candidate(overrides: Partial<WorkSkillCandidate>): WorkSkillCandidate {
  return {
    id: "skill",
    slug: "general",
    name: "通用",
    description: "",
    match_criteria: {},
    priority: 0,
    is_fallback: true,
    version: {
      id: "version",
      version_label: "v1",
      prompt_template: "prompt",
      input_contract: {},
      output_contract: {},
    },
    ...overrides,
  };
}

Deno.test("selectWorkSkill prefers the most specific published skill", () => {
  const selected = selectWorkSkill([
    candidate({ slug: "fallback" }),
    candidate({
      slug: "politics",
      is_fallback: false,
      priority: 100,
      match_criteria: { subjects: ["思想政治"], lesson_types: ["公开课"], teaching_modes: ["案例式"] },
    }),
  ], { subject: "高中思想政治", lesson_type: "公开课", teaching_mode: "案例式" });
  assertEquals(selected?.slug, "politics");
});

Deno.test("filterExactTextbookSources keeps the selected lesson and its unit context", () => {
  const sources = [
    { section_path: "1 有理数 / 单元背景", content_type: "unit_context" },
    { section_path: "1 有理数 / 1 1 正数和负数", content_type: "lesson_summary" },
    { section_path: "2 有理数的运算 / 单元背景", content_type: "unit_context" },
    { section_path: "2 有理数的运算 / 1 1 有理数的加法与减法", content_type: "lesson_summary" },
  ];
  const selected = filterExactTextbookSources(sources, {
    unit: "第1单元 有理数",
    topic: "第1课 1 正数和负数",
  });
  assertEquals(selected.map((item) => item.section_path), [
    "1 有理数 / 单元背景",
    "1 有理数 / 1 1 正数和负数",
  ]);
});

Deno.test("recovers a fixed textbook route from an older run snapshot", () => {
  const rows = [
    {
      id: "unit-id",
      collection_id: "collection-id",
      collection_slug: "junior-chinese-v1",
      stage: "初中",
      subject: "语文",
      section_level: "unit",
      unit_number: 2,
      lesson_number: 0,
      frame_number: null,
    },
    {
      id: "lesson-id",
      collection_id: "collection-id",
      collection_slug: "junior-chinese-v1",
      stage: "初中",
      subject: "语文",
      section_level: "lesson",
      unit_number: 2,
      lesson_number: 5,
      frame_number: null,
    },
  ];
  const route = resolveTextbookRouteFromSnapshots([
    { section_id: "unit-id", collection_slug: "junior-chinese-v1" },
    { section_id: "lesson-id", collection_slug: "junior-chinese-v1" },
  ], rows, { stage: "初中", subject: "语文" });
  assertEquals(route, {
    collectionSlug: "junior-chinese-v1",
    unitNumber: 2,
    lessonNumber: 5,
    frameNumber: null,
  });
});

Deno.test("filterExactTextbookSources matches structured fields when the path starts with a textbook volume", () => {
  const pathPrefix = "小学道德与法治 四年级下册 / ";
  const sources = [
    {
      section_path: `${pathPrefix}第2单元 做聪明的消费者 / 单元背景`,
      content_type: "unit_context",
      section_level: "unit",
      unit_label: "第2单元",
      unit_title: "做聪明的消费者",
    },
    {
      section_path: `${pathPrefix}第2单元 做聪明的消费者 / 第5课 合理消费（第36-43页） / 第1框 那些我想要的东西（第36-38页）`,
      content_type: "knowledge_summary",
      unit_label: "第2单元",
      unit_title: "做聪明的消费者",
      lesson_label: "第5课",
      lesson_title: "合理消费（第36-43页）",
      frame_label: "第1框",
      frame_title: "那些我想要的东西（第36-38页）",
    },
    {
      section_path: `${pathPrefix}第2单元 做聪明的消费者 / 第6课 有多少浪费本可避免 / 第1框 餐桌上的浪费`,
      content_type: "knowledge_summary",
      unit_label: "第2单元",
      unit_title: "做聪明的消费者",
      lesson_label: "第6课",
      lesson_title: "有多少浪费本可避免",
      frame_label: "第1框",
      frame_title: "餐桌上的浪费",
    },
  ];
  const selected = filterExactTextbookSources(sources, {
    unit: "第2单元 做聪明的消费者",
    topic: "第5课 合理消费（第36-43页）",
    frame: "第1框 那些我想要的东西（第36-38页）",
  });
  assertEquals(selected.map((item) => item.frame_title ?? item.content_type), [
    "unit_context",
    "那些我想要的东西（第36-38页）",
  ]);
});

Deno.test("filterExactTextbookSources treats a structured unit-only summary as parent context", () => {
  const selected = filterExactTextbookSources([
    {
      section_path: "四年级下册 / 第2单元 做聪明的消费者 / 单元背景",
      content_type: "knowledge_summary",
      unit_label: "第2单元",
      unit_title: "做聪明的消费者",
    },
    {
      section_path: "四年级下册 / 第2单元 做聪明的消费者 / 第5课 合理消费",
      content_type: "knowledge_summary",
      unit_label: "第2单元",
      unit_title: "做聪明的消费者",
      lesson_label: "第5课",
      lesson_title: "合理消费",
    },
  ], {
    unit: "第2单元 做聪明的消费者",
    topic: "第5课 合理消费",
  });
  assertEquals(selected.map((item) => item.section_path), [
    "四年级下册 / 第2单元 做聪明的消费者 / 单元背景",
    "四年级下册 / 第2单元 做聪明的消费者 / 第5课 合理消费",
  ]);
});

Deno.test("filterExactTextbookSources parses the unit segment instead of the volume segment for legacy records", () => {
  const selected = filterExactTextbookSources([
    {
      section_path: "小学道德与法治 四年级下册 / 第2单元 做聪明的消费者 / 第5课 合理消费",
      content_type: "knowledge_summary",
    },
    {
      section_path: "小学道德与法治 四年级下册 / 第3单元 美好生活哪里来 / 第7课 我们的衣食之源",
      content_type: "knowledge_summary",
    },
  ], {
    unit: "第2单元 做聪明的消费者",
    topic: "第5课 合理消费",
  });
  assertEquals(selected.map((item) => item.section_path), [
    "小学道德与法治 四年级下册 / 第2单元 做聪明的消费者 / 第5课 合理消费",
  ]);
});

Deno.test("selectWorkSkill falls back when no specialist matches", () => {
  const selected = selectWorkSkill([
    candidate({ slug: "fallback" }),
    candidate({
      slug: "math",
      is_fallback: false,
      match_criteria: { subjects: ["数学"] },
    }),
  ], { subject: "语文" });
  assertEquals(selected?.slug, "fallback");
});

Deno.test("selectWorkSkill still prefers explicit criteria when fallback metadata is inverted", () => {
  const selected = selectWorkSkill([
    candidate({ slug: "legacy-general", is_fallback: false, match_criteria: {}, priority: 0 }),
    candidate({
      slug: "politics-public-lesson",
      is_fallback: true,
      priority: 100,
      match_criteria: {
        subjects: ["道德与法治"],
        lesson_types: ["公开课"],
        teaching_modes: ["案例式", "议题式", "任务式"],
      },
    }),
  ], { subject: "道德与法治", lesson_type: "公开课", teaching_mode: "案例式" });
  assertEquals(selected?.slug, "politics-public-lesson");
});

Deno.test("subject lesson design requires structured textbook routing fields", () => {
  assertThrows(() => validateWorkInput("subject-lesson-design", {
      stage: "初中",
      subject: "道德与法治",
      unit: "第一单元",
      topic: "课题",
    }, 0),
    "年级",
  );
  validateWorkInput("subject-lesson-design", {
    stage: "初中",
    subject: "道德与法治",
    grade: "7年级",
    volume: "上册",
    unit: "第一单元 少年有梦",
    topic: "第一课 开启初中生活",
    teaching_mode: "案例式",
  }, 0);
});

Deno.test("subject lesson design keeps lesson type internal and clears modes for other subjects", () => {
  const politicsInput = {
    stage: "初中",
    subject: "道德与法治",
    grade: "7年级",
    volume: "上册",
    unit: "第一单元 少年有梦",
    topic: "第一课 开启初中生活",
    teaching_mode: "任务式",
    lesson_type: "",
  };
  validateWorkInput("subject-lesson-design", politicsInput, 0);
  assertEquals(politicsInput.lesson_type, "公开课");

  const generalInput = {
    ...politicsInput,
    subject: "数学",
    teaching_mode: "议题式",
  };
  validateWorkInput("subject-lesson-design", generalInput, 0);
  assertEquals(generalInput.teaching_mode, "");
  assertEquals(generalInput.lesson_type, "公开课");
});

Deno.test("every Work tool requires the structured textbook route", () => {
  const textbookRoute = {
    stage: "初中",
    subject: "语文",
    grade: "7年级",
    volume: "上册",
    unit: "第一单元",
    topic: "第一课",
  };
  assertThrows(() => validateWorkInput("lesson-diagnosis", {
    stage: "初中",
    subject: "语文",
    topic: "第一课",
    lesson_plan: "教案正文",
  }, 0), "年级");
  validateWorkInput("lesson-diagnosis", { ...textbookRoute, lesson_plan: "教案正文" }, 0);
  validateWorkInput("teaching-design", {
    ...textbookRoute,
    design_type: "backwards-design",
    desired_outcomes: "形成单元理解",
    unit_duration: "6课时",
  }, 0);
});

Deno.test("fixed textbook route IDs are required as a complete set when present", () => {
  const route = {
    stage: "小学",
    subject: "道德与法治",
    grade: "四年级",
    volume: "下册",
    unit: "第2单元 做聪明的消费者",
    topic: "第5课 合理消费",
    lesson_plan: "教案正文",
    collection_slug: "primary-daode-fazhi-4-lower",
    unit_route_number: "2",
    lesson_route_number: "5",
    frame: "第1框 那些我想要的东西",
  };
  assertThrows(() => validateWorkInput("lesson-diagnosis", route, 0), "框题编号缺失");
  validateWorkInput("lesson-diagnosis", {
    ...route,
    frame_route_number: "1",
  }, 0);
});

Deno.test("subject lesson design accepts the implicit public lesson type", () => {
  const input = {
    stage: "初中",
    subject: "数学",
    grade: "七年级",
    volume: "上册",
    unit: "第1单元",
    topic: "第1课",
    collection_slug: "junior-math-grade-7-volume-1",
    unit_route_number: "1",
    lesson_route_number: "1",
    teaching_mode: "任务式",
  };
  validateWorkInput("subject-lesson-design", input, 0);
});

Deno.test("segment-optimization allows current_design or material upload (either-or)", () => {
  const base = {
    stage: "初中",
    subject: "语文",
    grade: "7年级",
    volume: "上册",
    unit: "第一单元",
    topic: "第一课 春",
    segment_type: "课程导入",
    desired_outcome: "让学生暴露前概念",
  };
  // 既无当前环节设计、也无材料 → 拦截（与前端二选一一致）
  assertThrows(() => validateWorkInput("segment-optimization", { ...base }, 0), "当前环节设计");
  // 有材料、未填当前环节设计 → 放行（修复点：上传材料后不再强制要求 current_design）
  validateWorkInput("segment-optimization", { ...base }, 1);
  // 填了当前环节设计、无材料 → 放行
  validateWorkInput("segment-optimization", { ...base, current_design: "教师问：你们见过春天吗？" }, 0);
});

Deno.test("work skill loads common references plus only the selected mode template", () => {
  const reference = (path: string, loadMode: "always" | "case" | "issue" | "task") => ({
    id: path,
    path,
    name: path,
    description: "",
    media_type: "text/markdown",
    content: path,
    content_hash: path,
    load_mode: loadMode,
    max_chars: 1000,
    sort_order: loadMode === "always" ? 1 : 2,
    metadata: {},
  });
  const skill = candidate({});
  skill.version.references = [
    reference("common.md", "always"),
    reference("case.md", "case"),
    reference("issue.md", "issue"),
    reference("task.md", "task"),
  ];
  assertEquals(
    selectWorkSkillReferences(skill, { teaching_mode: "任务式" }).map((item) => item.path),
    ["common.md", "task.md"],
  );
});

Deno.test("politics work skill refuses generation when the selected mode reference is missing", () => {
  const reference = (path: string, loadMode: "always" | "case" | "issue" | "task") => ({
    id: path,
    path,
    name: path,
    description: "",
    media_type: "text/markdown",
    content: path,
    content_hash: path,
    load_mode: loadMode,
    max_chars: 1000,
    sort_order: 1,
    metadata: {},
  });
  const skill = candidate({ slug: "politics-public-lesson" });
  skill.version.output_contract = { format: "public_lesson_markdown_v2" };
  skill.version.references = [
    reference("references/mode-selection.md", "always"),
    reference("references/carrier-selection.md", "always"),
    reference("references/output-template.md", "always"),
    reference("references/issue-mode-v3.md", "issue"),
  ];
  assertThrows(
    () => assertWorkSkillRuntimeReady(skill, { teaching_mode: "案例式" }),
    "所选教学模式模板未加载",
  );
  skill.version.references.push(reference("references/case-mode-v3.md", "case"));
  assertWorkSkillRuntimeReady(skill, { teaching_mode: "案例式" });
});

Deno.test("politics output trace is derived from the actual textbook and selected reference", () => {
  const reference = (path: string, loadMode: "always" | "case") => ({
    id: path,
    path,
    name: path,
    description: "",
    media_type: "text/markdown",
    content: path,
    content_hash: path,
    load_mode: loadMode,
    max_chars: 1000,
    sort_order: 1,
    metadata: {},
  });
  const skill = candidate({ slug: "politics-public-lesson" });
  skill.version.output_contract = { format: "sizheng_public_lesson_v2" };
  skill.version.references = [
    reference("references/output-template.md", "always"),
    reference("references/case-mode-v3.md", "case"),
  ];
  const output = applyWorkOutputRuntimeTrace({
    basic_info: {
      teaching_mode: "议题式",
      textbook_source_path: "模型猜测的路径",
      mode_template_path: "references/issue-mode-v3.md",
    },
  }, skill, { teaching_mode: "案例式" }, ["8年级上册/第三单元/第七课/第一框 珍视自由"]);
  assertEquals(output.basic_info, {
    teaching_mode: "案例式",
    textbook_source_path: "8年级上册/第三单元/第七课/第一框 珍视自由",
    mode_template_path: "references/case-mode-v3.md",
  });
});

Deno.test("work prompt separates built-in textbook knowledge from user materials", () => {
  const skill = candidate({});
  skill.version.references = [{
    id: "case",
    path: "references/case-mode-v3.md",
    name: "案例式教学 V3",
    description: "",
    media_type: "text/markdown",
    content: "材料—问题—分析—归纳",
    content_hash: "case-hash",
    load_mode: "case",
    max_chars: 1000,
    sort_order: 30,
    metadata: {},
  }];
  const prompt = buildWorkPrompt({
    toolSlug: "subject-lesson-design",
    input: { topic: "开启初中生活", teaching_mode: "案例式", textbook_content: "用户粘贴的教材原文" },
    skill,
    textbookContext: "第一框 奏响中学序曲",
    materialContext: "教师补充教材原文",
  });
  assertEquals(prompt.user.includes("## 内置教材知识库（精确命中）"), true);
  assertEquals(prompt.user.includes("## 用户粘贴的教材内容"), true);
  assertEquals(prompt.user.includes("用户粘贴的教材原文"), true);
  assertEquals(prompt.user.includes("## 用户指定材料"), true);
  assertEquals(prompt.user.includes("### references/case-mode-v3.md"), true);
  assertEquals(prompt.user.includes("材料—问题—分析—归纳"), true);
  assertEquals(prompt.user.split("用户粘贴的教材原文").length - 1, 1);
  assertEquals(prompt.system.includes("不是教材逐字原文"), true);
});

Deno.test("revision prompt keeps the prior artifact but omits duplicated source context", () => {
  const revisionReference = {
    id: "references/mainstream-models.md",
    path: "references/mainstream-models.md",
    name: "模式",
    description: "",
    media_type: "text/markdown",
    content: "版本化模式全文，不应在续改请求中重复发送",
    content_hash: "models",
    load_mode: "always" as const,
    max_chars: 1000,
    sort_order: 1,
    metadata: {},
  };
  const skill = candidate({
    version: {
      ...candidate({}).version,
      prompt_template: "专属 Skill",
      references: [revisionReference],
    },
  });
  const prompt = buildWorkPrompt({
    toolSlug: "subject-lesson-design",
    input: {
      stage: "初中",
      subject: "语文",
      topic: "背影",
      lesson_plan: "原始教案全文，不应在续改请求中重复发送",
      current_design: "原始环节全文，不应在续改请求中重复发送",
      desired_outcomes: "原始预期成果，不应在续改请求中重复发送",
      textbook_content: "用户粘贴的教材正文，不应在续改请求中重复发送",
    },
    skill,
    materialContext: "用户材料全文，不应在续改请求中重复发送",
    textbookContext: "内置教材全文，不应在续改请求中重复发送",
    caseContext: "案例库全文，不应在续改请求中重复发送",
    previousMarkdown: "# 上一版产物\n保留这一版没有被要求修改的内容。",
    revisionInstruction: "只把导入压缩到 3 分钟。",
  });

  assertEquals(prompt.user.includes("## 上一版产物"), true);
  assertEquals(prompt.user.includes("## 本轮追改要求\n只把导入压缩到 3 分钟。"), true);
  assertEquals(prompt.user.includes("原始教案全文"), false);
  assertEquals(prompt.user.includes("用户粘贴的教材正文"), false);
  assertEquals(prompt.user.includes("用户材料全文"), false);
  assertEquals(prompt.user.includes("内置教材全文"), false);
  assertEquals(prompt.user.includes("案例库全文"), false);
  assertEquals(prompt.user.includes("references/mainstream-models.md"), false);
  assertEquals(prompt.user.includes("lesson_plan"), false);
  assertEquals(prompt.user.includes("current_design"), false);
  assertEquals(prompt.user.includes("desired_outcomes"), false);
  assertEquals(prompt.user.includes("textbook_content"), false);
  assertEquals(prompt.system.includes("当前是上一版续改"), true);
});

Deno.test("empty subject skill shell remains usable and explains the pending specialization", () => {
  const prompt = buildWorkPrompt({
    toolSlug: "subject-lesson-design",
    input: { stage: "初中", subject: "英语", topic: "My school", teaching_mode: "" },
    skill: candidate({
      slug: "subject-lesson-design-english",
      is_fallback: false,
      match_criteria: { subjects: ["英语"], lesson_types: ["公开课"] },
      version: { ...candidate({}).version, prompt_template: "" },
    }),
    materialContext: "教材内容",
  });
  assertEquals(prompt.system.includes("Skill 壳"), true);
  assertEquals(prompt.system.includes("不要因为 Skill 为空而报错"), true);
  assertEquals(prompt.system.includes("Markdown 教案"), true);
});

Deno.test("mathematics references load the shared method and only the matching stage example", () => {
  const skill = candidate({
    slug: "subject-lesson-design-mathematics",
    is_fallback: false,
    version: {
      ...candidate({}).version,
      prompt_template: "数学公开课专属 Skill",
      references: [
        {
          id: "models", path: "references/mainstream-models.md", name: "模式", description: "",
          media_type: "text/markdown", content: "六类数学模式", content_hash: "models",
          load_mode: "always", max_chars: 1000, sort_order: 10, metadata: {},
        },
        {
          id: "primary", path: "references/excellent-example-primary.md", name: "小学样例", description: "",
          media_type: "text/markdown", content: "小学面积样例", content_hash: "primary",
          load_mode: "always", max_chars: 1000, sort_order: 30, metadata: { stages: ["小学"] },
        },
        {
          id: "junior", path: "references/excellent-example-junior.md", name: "初中样例", description: "",
          media_type: "text/markdown", content: "初中全等样例", content_hash: "junior",
          load_mode: "always", max_chars: 1000, sort_order: 40, metadata: { stages: ["初中"] },
        },
      ],
    },
  });
  const selected = selectWorkSkillReferences(skill, { stage: "小学", subject: "数学" });
  assertEquals(selected.map((item) => item.path), [
    "references/mainstream-models.md",
    "references/excellent-example-primary.md",
  ]);
  const seniorSelected = selectWorkSkillReferences(skill, { stage: "高中", subject: "高中数学 A版" });
  assertEquals(seniorSelected.map((item) => item.path), [
    "references/mainstream-models.md",
  ]);
  const prompt = buildWorkPrompt({
    toolSlug: "subject-lesson-design",
    input: { stage: "小学", subject: "数学", topic: "平行四边形的面积" },
    skill,
    materialContext: "",
    textbookContext: "精确命中的教材梳理",
  });
  assertEquals(prompt.user.includes("小学面积样例"), true);
  assertEquals(prompt.user.includes("初中全等样例"), false);
  assertEquals(prompt.system.includes("学科、学段匹配"), true);
  assertEquals(prompt.system.includes("对应 V3 模板"), false);
});

Deno.test("all public lesson prompts use the unified nine-section flow directive", () => {
  const skill = candidate({
    slug: "subject-lesson-design-mathematics",
    version: {
      ...candidate({}).version,
      prompt_template: "数学公开课 Skill",
      references: [],
    },
  });
  const prompt = buildWorkPrompt({
    toolSlug: "subject-lesson-design",
    input: { stage: "高中", subject: "高中数学 A版", topic: "函数" },
    skill,
    materialContext: "",
    textbookContext: "教材知识点",
  });
  assertEquals(prompt.system.includes("九个二级标题"), true);
  assertEquals(prompt.system.includes("课程基本信息、课标分析、教材分析"), true);
  assertEquals(prompt.system.includes("教学流程设 5—6 个环节"), true);
  assertEquals(prompt.system.includes("评估方式组成的五列表格"), true);
  assertEquals(prompt.system.includes("最多 4 个环节"), false);
});

Deno.test("chinese references load only the matching stage example and retain language-practice guidance", () => {
  const skill = candidate({
    slug: "subject-lesson-design-chinese",
    is_fallback: false,
    version: {
      ...candidate({}).version,
      prompt_template: "语文公开课专属 Skill：让学生读、说、写、评、改。",
      output_contract: { format: "chinese_public_lesson_markdown_v1" },
      references: [
        {
          id: "models", path: "references/mainstream-models.md", name: "模式", description: "",
          media_type: "text/markdown", content: "八类语文实践模式", content_hash: "models",
          load_mode: "always", max_chars: 1000, sort_order: 10, metadata: {},
        },
        {
          id: "primary", path: "references/excellent-example-primary.md", name: "小学样例", description: "",
          media_type: "text/markdown", content: "荷叶圆圆朗读与仿说样例", content_hash: "primary",
          load_mode: "always", max_chars: 1000, sort_order: 30, metadata: { stages: ["小学"] },
        },
        {
          id: "junior", path: "references/excellent-example-junior.md", name: "初中样例", description: "",
          media_type: "text/markdown", content: "故乡叙述视角样例", content_hash: "junior",
          load_mode: "always", max_chars: 1000, sort_order: 40, metadata: { stages: ["初中"] },
        },
      ],
    },
  });
  const primary = selectWorkSkillReferences(skill, { stage: "小学", subject: "语文" });
  const junior = selectWorkSkillReferences(skill, { stage: "初中", subject: "语文" });
  assertEquals(primary.map((item) => item.path), [
    "references/mainstream-models.md",
    "references/excellent-example-primary.md",
  ]);
  assertEquals(junior.map((item) => item.path), [
    "references/mainstream-models.md",
    "references/excellent-example-junior.md",
  ]);
  const prompt = buildWorkPrompt({
    toolSlug: "subject-lesson-design",
    input: { stage: "初中", subject: "语文", topic: "故乡" },
    skill,
    materialContext: "",
    textbookContext: "精确命中的课文与单元梳理",
  });
  assertEquals(prompt.user.includes("故乡叙述视角样例"), true);
  assertEquals(prompt.user.includes("荷叶圆圆朗读与仿说样例"), false);
  assertEquals(prompt.system.includes("读、说、写、评、改"), true);
  assertEquals(prompt.system.includes("样例只作结构参照"), true);
});

Deno.test("science references load for primary school and preserve evidence and safety guidance", () => {
  const skill = candidate({
    slug: "subject-lesson-design-science",
    is_fallback: false,
    version: {
      ...candidate({}).version,
      prompt_template: "小学科学公开课 Skill：保留原始证据、安全与异常结果。",
      output_contract: { format: "science_public_lesson_markdown_v1" },
      references: [
        {
          id: "models", path: "references/mainstream-models.md", name: "模式", description: "",
          media_type: "text/markdown", content: "六类科学实践模式", content_hash: "models",
          load_mode: "always", max_chars: 1000, sort_order: 10, metadata: {},
        },
        {
          id: "primary", path: "references/excellent-example-primary.md", name: "小学样例", description: "",
          media_type: "text/markdown", content: "显微镜下的细胞样例", content_hash: "primary",
          load_mode: "always", max_chars: 1000, sort_order: 30, metadata: { stages: ["小学"] },
        },
      ],
    },
  });
  assertEquals(
    selectWorkSkillReferences(skill, { stage: "小学", subject: "科学" }).map((item) => item.path),
    ["references/mainstream-models.md", "references/excellent-example-primary.md"],
  );
  assertEquals(
    selectWorkSkillReferences(skill, { stage: "初中", subject: "科学" }).map((item) => item.path),
    ["references/mainstream-models.md"],
  );
  const prompt = buildWorkPrompt({
    toolSlug: "subject-lesson-design",
    input: { stage: "小学", subject: "科学", topic: "显微镜下的细胞" },
    skill,
    materialContext: "",
    textbookContext: "精确命中的小学科学教材梳理",
  });
  assertEquals(prompt.user.includes("显微镜下的细胞样例"), true);
  assertEquals(prompt.system.includes("原始证据、安全与异常结果"), true);
  assertEquals(prompt.system.includes("对应 V3 模板"), false);
});

Deno.test("english references load only the matching stage example and retain discourse activity guidance", () => {
  const skill = candidate({
    slug: "subject-lesson-design-english",
    is_fallback: false,
    version: {
      ...candidate({}).version,
      prompt_template: "英语公开课 Skill：围绕主题和语篇组织学习理解、应用实践、迁移创新。",
      output_contract: { format: "english_public_lesson_markdown_v1" },
      references: [
        {
          id: "models", path: "references/mainstream-models.md", name: "模式", description: "",
          media_type: "text/markdown", content: "七类英语课型模式", content_hash: "models",
          load_mode: "always", max_chars: 1000, sort_order: 10, metadata: {},
        },
        {
          id: "primary", path: "references/excellent-example-primary.md", name: "小学样例", description: "",
          media_type: "text/markdown", content: "My feelings 信息差协商样例", content_hash: "primary",
          load_mode: "always", max_chars: 1000, sort_order: 30, metadata: { stages: ["小学"] },
        },
        {
          id: "junior", path: "references/excellent-example-junior.md", name: "初中样例", description: "",
          media_type: "text/markdown", content: "新闻语篇证据阅读样例", content_hash: "junior",
          load_mode: "always", max_chars: 1000, sort_order: 40, metadata: { stages: ["初中"] },
        },
      ],
    },
  });
  assertEquals(
    selectWorkSkillReferences(skill, { stage: "小学", subject: "英语" }).map((item) => item.path),
    ["references/mainstream-models.md", "references/excellent-example-primary.md"],
  );
  assertEquals(
    selectWorkSkillReferences(skill, { stage: "初中", subject: "英语" }).map((item) => item.path),
    ["references/mainstream-models.md", "references/excellent-example-junior.md"],
  );
  const prompt = buildWorkPrompt({
    toolSlug: "subject-lesson-design",
    input: { stage: "小学", subject: "英语", topic: "My feelings" },
    skill,
    materialContext: "",
    textbookContext: "精确命中的英语 Unit 与 Session 教材梳理",
  });
  assertEquals(prompt.user.includes("My feelings 信息差协商样例"), true);
  assertEquals(prompt.user.includes("新闻语篇证据阅读样例"), false);
  assertEquals(prompt.system.includes("学习理解、应用实践、迁移创新"), true);
  assertEquals(prompt.system.includes("样例只作结构参照"), true);
});

Deno.test("physics references load only for junior school and retain evidence and safety guidance", () => {
  const skill = candidate({
    slug: "subject-lesson-design-physics",
    is_fallback: false,
    version: {
      ...candidate({}).version,
      prompt_template: "物理公开课 Skill：保留变量、原始数据、异常、安全与规律条件。",
      output_contract: { format: "physics_public_lesson_markdown_v1" },
      references: [
        {
          id: "models", path: "references/mainstream-models.md", name: "模式", description: "",
          media_type: "text/markdown", content: "六类物理模式", content_hash: "models",
          load_mode: "always", max_chars: 1000, sort_order: 10, metadata: {},
        },
        {
          id: "junior", path: "references/excellent-example-junior.md", name: "初中样例", description: "",
          media_type: "text/markdown", content: "电流与电压关系实验样例", content_hash: "junior",
          load_mode: "always", max_chars: 1000, sort_order: 30, metadata: { stages: ["初中"] },
        },
      ],
    },
  });
  assertEquals(
    selectWorkSkillReferences(skill, { stage: "初中", subject: "物理" }).map((item) => item.path),
    ["references/mainstream-models.md", "references/excellent-example-junior.md"],
  );
  assertEquals(
    selectWorkSkillReferences(skill, { stage: "小学", subject: "物理" }).map((item) => item.path),
    ["references/mainstream-models.md"],
  );
  const prompt = buildWorkPrompt({
    toolSlug: "subject-lesson-design",
    input: { stage: "初中", subject: "物理", topic: "电流与电压的关系" },
    skill,
    materialContext: "",
    textbookContext: "精确命中的物理教材和实验资料",
  });
  assertEquals(prompt.user.includes("电流与电压关系实验样例"), true);
  assertEquals(prompt.system.includes("原始数据、异常、安全与规律条件"), true);
  assertEquals(prompt.system.includes("样例只作结构参照"), true);
});

Deno.test("chemistry references load only for junior school and retain macroscopic microscopic symbolic guidance", () => {
  const skill = candidate({
    slug: "subject-lesson-design-chemistry",
    is_fallback: false,
    version: {
      ...candidate({}).version,
      prompt_template: "化学公开课 Skill：保留宏观—微观—符号、原始证据、安全绿色与体系边界。",
      output_contract: { format: "chemistry_public_lesson_markdown_v1" },
      references: [
        {
          id: "models", path: "references/mainstream-models.md", name: "模式", description: "",
          media_type: "text/markdown", content: "六类化学模式", content_hash: "models",
          load_mode: "always", max_chars: 1000, sort_order: 10, metadata: {},
        },
        {
          id: "junior", path: "references/excellent-example-junior.md", name: "初中样例", description: "",
          media_type: "text/markdown", content: "质量守恒体系边界样例", content_hash: "junior",
          load_mode: "always", max_chars: 1000, sort_order: 30, metadata: { stages: ["初中"] },
        },
      ],
    },
  });
  assertEquals(
    selectWorkSkillReferences(skill, { stage: "初中", subject: "化学" }).map((item) => item.path),
    ["references/mainstream-models.md", "references/excellent-example-junior.md"],
  );
  assertEquals(
    selectWorkSkillReferences(skill, { stage: "小学", subject: "化学" }).map((item) => item.path),
    ["references/mainstream-models.md"],
  );
  const prompt = buildWorkPrompt({
    toolSlug: "subject-lesson-design",
    input: { stage: "初中", subject: "化学", topic: "质量守恒定律" },
    skill,
    materialContext: "",
    textbookContext: "精确命中的化学教材实验与微观解释资料",
  });
  assertEquals(prompt.user.includes("质量守恒体系边界样例"), true);
  assertEquals(prompt.system.includes("宏观—微观—符号"), true);
  assertEquals(prompt.system.includes("样例只作结构参照"), true);
});

Deno.test("biology references load only for junior school and retain model and evidence gate guidance", () => {
  const skill = candidate({
    slug: "subject-lesson-design-biology",
    is_fallback: false,
    version: {
      ...candidate({}).version,
      prompt_template: "生物学公开课 Skill：目录摘要不替代正文，保留生命观念、模型修订、伦理和外推边界。",
      output_contract: { format: "biology_public_lesson_markdown_v1" },
      references: [
        {
          id: "models", path: "references/mainstream-models.md", name: "模式", description: "",
          media_type: "text/markdown", content: "七类生物学模式", content_hash: "models",
          load_mode: "always", max_chars: 1000, sort_order: 10, metadata: {},
        },
        {
          id: "junior", path: "references/excellent-example-junior.md", name: "初中样例", description: "",
          media_type: "text/markdown", content: "尿液形成模型修订样例", content_hash: "junior",
          load_mode: "always", max_chars: 1000, sort_order: 30, metadata: { stages: ["初中"] },
        },
      ],
    },
  });
  assertEquals(
    selectWorkSkillReferences(skill, { stage: "初中", subject: "生物" }).map((item) => item.path),
    ["references/mainstream-models.md", "references/excellent-example-junior.md"],
  );
  assertEquals(
    selectWorkSkillReferences(skill, { stage: "小学", subject: "生物" }).map((item) => item.path),
    ["references/mainstream-models.md"],
  );
  const prompt = buildWorkPrompt({
    toolSlug: "subject-lesson-design",
    input: { stage: "初中", subject: "生物", topic: "尿液的形成过程" },
    skill,
    materialContext: "用户补充的教材正文与数据",
    textbookContext: "官方目录摘要",
  });
  assertEquals(prompt.user.includes("尿液形成模型修订样例"), true);
  assertEquals(prompt.system.includes("目录摘要不替代正文"), true);
  assertEquals(prompt.system.includes("样例只作结构参照"), true);
});

Deno.test("geography references load only for junior school and retain map and scale evidence gate", () => {
  const skill = candidate({
    slug: "subject-lesson-design-geography",
    is_fallback: false,
    version: {
      ...candidate({}).version,
      prompt_template: "地理公开课 Skill：目录不替代地图，保留尺度、来源、区域综合与标准地图边界。",
      output_contract: { format: "geography_public_lesson_markdown_v1" },
      references: [
        { id: "models", path: "references/mainstream-models.md", name: "模式", description: "", media_type: "text/markdown", content: "六类地理模式", content_hash: "models", load_mode: "always", max_chars: 1000, sort_order: 10, metadata: {} },
        { id: "junior", path: "references/excellent-example-junior.md", name: "初中样例", description: "", media_type: "text/markdown", content: "山区铁路选线样例", content_hash: "junior", load_mode: "always", max_chars: 1000, sort_order: 30, metadata: { stages: ["初中"] } },
      ],
    },
  });
  assertEquals(selectWorkSkillReferences(skill, { stage: "初中", subject: "地理" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-junior.md"]);
  assertEquals(selectWorkSkillReferences(skill, { stage: "小学", subject: "地理" }).map((item) => item.path), ["references/mainstream-models.md"]);
  const prompt = buildWorkPrompt({ toolSlug: "subject-lesson-design", input: { stage: "初中", subject: "地理", topic: "山区铁路选线" }, skill, materialContext: "经核地图数据", textbookContext: "官方目录摘要" });
  assertEquals(prompt.user.includes("山区铁路选线样例"), true);
  assertEquals(prompt.system.includes("目录不替代地图"), true);
  assertEquals(prompt.system.includes("样例只作结构参照"), true);
});

Deno.test("history references load only for junior school and retain source provenance evidence gate", () => {
  const skill = candidate({
    slug: "subject-lesson-design-history",
    is_fallback: false,
    version: {
      ...candidate({}).version,
      prompt_template: "历史公开课 Skill：目录不替代教材与史料，保留时空、来源语境、互证和解释边界。",
      output_contract: { format: "history_public_lesson_markdown_v1" },
      references: [
        { id: "models", path: "references/mainstream-models.md", name: "模式", description: "", media_type: "text/markdown", content: "七类历史模式", content_hash: "models", load_mode: "always", max_chars: 1000, sort_order: 10, metadata: {} },
        { id: "junior", path: "references/excellent-example-junior.md", name: "初中样例", description: "", media_type: "text/markdown", content: "考古史料互证样例", content_hash: "junior", load_mode: "always", max_chars: 1000, sort_order: 30, metadata: { stages: ["初中"] } },
      ],
    },
  });
  assertEquals(selectWorkSkillReferences(skill, { stage: "初中", subject: "历史" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-junior.md"]);
  assertEquals(selectWorkSkillReferences(skill, { stage: "小学", subject: "历史" }).map((item) => item.path), ["references/mainstream-models.md"]);
  const prompt = buildWorkPrompt({ toolSlug: "subject-lesson-design", input: { stage: "初中", subject: "历史", topic: "从考古发现看中华文明的起源" }, skill, materialContext: "经核史料包", textbookContext: "官方目录摘要" });
  assertEquals(prompt.user.includes("考古史料互证样例"), true);
  assertEquals(prompt.system.includes("目录不替代教材与史料"), true);
  assertEquals(prompt.system.includes("样例只作结构参照"), true);
});

Deno.test("information technology references load only the matching stage example and retain testing and safety guidance", () => {
  const skill = candidate({
    slug: "subject-lesson-design-information-technology",
    is_fallback: false,
    version: {
      ...candidate({}).version,
      prompt_template: "信息科技公开课 Skill：教材和技术资料不足时停止完整生成，保留原理、测试调试、设备公平和隐私安全。",
      output_contract: { format: "information_technology_public_lesson_markdown_v1" },
      references: [
        { id: "models", path: "references/mainstream-models.md", name: "模式", description: "", media_type: "text/markdown", content: "七类信息科技模式", content_hash: "models", load_mode: "always", max_chars: 1000, sort_order: 10, metadata: {} },
        { id: "primary", path: "references/excellent-example-primary.md", name: "小学样例", description: "", media_type: "text/markdown", content: "分类算法多例测试样例", content_hash: "primary", load_mode: "always", max_chars: 1000, sort_order: 30, metadata: { stages: ["小学"] } },
        { id: "junior", path: "references/excellent-example-junior.md", name: "初中样例", description: "", media_type: "text/markdown", content: "物联系统故障诊断样例", content_hash: "junior", load_mode: "always", max_chars: 1000, sort_order: 40, metadata: { stages: ["初中"] } },
        { id: "senior", path: "references/excellent-example-senior.md", name: "高中样例", description: "", media_type: "text/markdown", content: "查找算法公平效率比较样例", content_hash: "senior", load_mode: "always", max_chars: 1000, sort_order: 50, metadata: { stages: ["高中"] } },
      ],
    },
  });
  assertEquals(selectWorkSkillReferences(skill, { stage: "小学", subject: "信息科技" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-primary.md"]);
  assertEquals(selectWorkSkillReferences(skill, { stage: "初中", subject: "信息科技" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-junior.md"]);
  assertEquals(selectWorkSkillReferences(skill, { stage: "高中", subject: "信息科技" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-senior.md"]);
  const prompt = buildWorkPrompt({ toolSlug: "subject-lesson-design", input: { stage: "高中", subject: "信息科技", topic: "顺序查找与二分查找" }, skill, materialContext: "经核教材和代码", textbookContext: "" });
  assertEquals(prompt.user.includes("查找算法公平效率比较样例"), true);
  assertEquals(prompt.user.includes("物联系统故障诊断样例"), false);
  assertEquals(prompt.system.includes("测试调试、设备公平和隐私安全"), true);
  assertEquals(prompt.system.includes("样例只作结构参照"), true);
});

Deno.test("psychology references load only the matching stage example and retain non-diagnostic safeguarding guidance", () => {
  const skill = candidate({
    slug: "subject-lesson-design-psychology",
    is_fallback: false,
    version: {
      ...candidate({}).version,
      prompt_template: "心理健康公开课 Skill：必须非诊断、自愿可退出、最少披露，并使用学校核准的危机转介路径。",
      output_contract: { format: "psychology_public_lesson_markdown_v1" },
      references: [
        { id: "models", path: "references/mainstream-models.md", name: "模式", description: "", media_type: "text/markdown", content: "七类心理健康模式", content_hash: "models", load_mode: "always", max_chars: 1000, sort_order: 10, metadata: {} },
        { id: "primary", path: "references/excellent-example-primary.md", name: "小学样例", description: "", media_type: "text/markdown", content: "情绪识别和求助样例", content_hash: "primary", load_mode: "always", max_chars: 1000, sort_order: 30, metadata: { stages: ["小学"] } },
        { id: "junior", path: "references/excellent-example-junior.md", name: "初中样例", description: "", media_type: "text/markdown", content: "边界与反欺凌求助样例", content_hash: "junior", load_mode: "always", max_chars: 1000, sort_order: 40, metadata: { stages: ["初中"] } },
        { id: "senior", path: "references/excellent-example-senior.md", name: "高中样例", description: "", media_type: "text/markdown", content: "压力行动与求助阈值样例", content_hash: "senior", load_mode: "always", max_chars: 1000, sort_order: 50, metadata: { stages: ["高中"] } },
      ],
    },
  });
  assertEquals(selectWorkSkillReferences(skill, { stage: "小学", subject: "心理健康" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-primary.md"]);
  assertEquals(selectWorkSkillReferences(skill, { stage: "初中", subject: "心理健康" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-junior.md"]);
  assertEquals(selectWorkSkillReferences(skill, { stage: "高中", subject: "心理健康" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-senior.md"]);
  const prompt = buildWorkPrompt({ toolSlug: "subject-lesson-design", input: { stage: "初中", subject: "心理健康", topic: "边界与求助" }, skill, materialContext: "经核教材和学校转介流程", textbookContext: "" });
  assertEquals(prompt.user.includes("边界与反欺凌求助样例"), true);
  assertEquals(prompt.user.includes("压力行动与求助阈值样例"), false);
  assertEquals(prompt.system.includes("非诊断、自愿可退出、最少披露"), true);
  assertEquals(prompt.system.includes("样例只作结构参照"), true);
});

Deno.test("music references load only the matching stage example and retain listening rehearsal and copyright guidance", () => {
  const skill = candidate({
    slug: "subject-lesson-design-music",
    is_fallback: false,
    version: {
      ...candidate({}).version,
      prompt_template: "音乐公开课 Skill：从音响出发，保留个体听辨、音乐表现/创造、反馈复演、文化来源和版权安全。",
      output_contract: { format: "music_public_lesson_markdown_v1" },
      references: [
        { id: "models", path: "references/mainstream-models.md", name: "模式", description: "", media_type: "text/markdown", content: "七类音乐模式", content_hash: "models", load_mode: "always", max_chars: 1000, sort_order: 10, metadata: {} },
        { id: "primary", path: "references/excellent-example-primary.md", name: "小学样例", description: "", media_type: "text/markdown", content: "速度听辨与复演样例", content_hash: "primary", load_mode: "always", max_chars: 1000, sort_order: 30, metadata: { stages: ["小学"] } },
        { id: "junior", path: "references/excellent-example-junior.md", name: "初中样例", description: "", media_type: "text/markdown", content: "期待变化与音响证据样例", content_hash: "junior", load_mode: "always", max_chars: 1000, sort_order: 40, metadata: { stages: ["初中"] } },
        { id: "senior", path: "references/excellent-example-senior.md", name: "高中样例", description: "", media_type: "text/markdown", content: "调式调性听觉探究样例", content_hash: "senior", load_mode: "always", max_chars: 1000, sort_order: 50, metadata: { stages: ["高中"] } },
      ],
    },
  });
  assertEquals(selectWorkSkillReferences(skill, { stage: "小学", subject: "音乐" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-primary.md"]);
  assertEquals(selectWorkSkillReferences(skill, { stage: "初中", subject: "音乐" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-junior.md"]);
  assertEquals(selectWorkSkillReferences(skill, { stage: "高中", subject: "音乐" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-senior.md"]);
  const prompt = buildWorkPrompt({ toolSlug: "subject-lesson-design", input: { stage: "小学", subject: "音乐", topic: "感知音乐中的速度" }, skill, materialContext: "经核教材、谱例和音源", textbookContext: "" });
  assertEquals(prompt.user.includes("速度听辨与复演样例"), true);
  assertEquals(prompt.user.includes("调式调性听觉探究样例"), false);
  assertEquals(prompt.system.includes("个体听辨、音乐表现/创造、反馈复演"), true);
  assertEquals(prompt.system.includes("样例只作结构参照"), true);
});

Deno.test("art references load only the matching stage example and retain visual evidence material trial and revision guidance", () => {
  const skill = candidate({
    slug: "subject-lesson-design-art",
    is_fallback: false,
    version: {
      ...candidate({}).version,
      prompt_template: "美术公开课 Skill：先慢看与视觉指证，再材料试验、多构想、制作、观看反馈和作品修订，保留文化版权安全边界。",
      output_contract: { format: "art_public_lesson_markdown_v1" },
      references: [
        { id: "models", path: "references/mainstream-models.md", name: "模式", description: "", media_type: "text/markdown", content: "七类美术模式", content_hash: "models", load_mode: "always", max_chars: 1000, sort_order: 10, metadata: {} },
        { id: "primary", path: "references/excellent-example-primary.md", name: "小学样例", description: "", media_type: "text/markdown", content: "标识用户测试样例", content_hash: "primary", load_mode: "always", max_chars: 1000, sort_order: 30, metadata: { stages: ["小学"] } },
        { id: "junior", path: "references/excellent-example-junior.md", name: "初中样例", description: "", media_type: "text/markdown", content: "剪纸材料文化样例", content_hash: "junior", load_mode: "always", max_chars: 1000, sort_order: 40, metadata: { stages: ["初中"] } },
        { id: "senior", path: "references/excellent-example-senior.md", name: "高中样例", description: "", media_type: "text/markdown", content: "城市图像证据评述样例", content_hash: "senior", load_mode: "always", max_chars: 1000, sort_order: 50, metadata: { stages: ["高中"] } },
      ],
    },
  });
  assertEquals(selectWorkSkillReferences(skill, { stage: "小学", subject: "美术" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-primary.md"]);
  assertEquals(selectWorkSkillReferences(skill, { stage: "初中", subject: "美术" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-junior.md"]);
  assertEquals(selectWorkSkillReferences(skill, { stage: "高中", subject: "美术" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-senior.md"]);
  const prompt = buildWorkPrompt({ toolSlug: "subject-lesson-design", input: { stage: "高中", subject: "美术", topic: "城市图像的观看与解释" }, skill, materialContext: "经核教材、高清图像和元数据", textbookContext: "" });
  assertEquals(prompt.user.includes("城市图像证据评述样例"), true);
  assertEquals(prompt.user.includes("标识用户测试样例"), false);
  assertEquals(prompt.system.includes("材料试验、多构想、制作、观看反馈和作品修订"), true);
  assertEquals(prompt.system.includes("样例只作结构参照"), true);
});

Deno.test("physical education references load only the matching stage example and retain structured practice load and emergency guidance", () => {
  const skill = candidate({
    slug: "subject-lesson-design-physical-education",
    is_fallback: false,
    version: {
      ...candidate({}).version,
      prompt_template: "体育与健康公开课 Skill：必须结构化技能、学练赛评、全员练习、个体负荷、相对进步，并核验健康场地器材天气和急救SOP。",
      output_contract: { format: "physical_education_public_lesson_markdown_v1" },
      references: [
        { id: "models", path: "references/mainstream-models.md", name: "模式", description: "", media_type: "text/markdown", content: "七类体育健康模式", content_hash: "models", load_mode: "always", max_chars: 1000, sort_order: 10, metadata: {} },
        { id: "primary", path: "references/excellent-example-primary.md", name: "小学样例", description: "", media_type: "text/markdown", content: "直线运球游戏样例", content_hash: "primary", load_mode: "always", max_chars: 1000, sort_order: 30, metadata: { stages: ["小学"] } },
        { id: "junior", path: "references/excellent-example-junior.md", name: "初中样例", description: "", media_type: "text/markdown", content: "篮球传切小场比赛样例", content_hash: "junior", load_mode: "always", max_chars: 1000, sort_order: 40, metadata: { stages: ["初中"] } },
        { id: "senior", path: "references/excellent-example-senior.md", name: "高中样例", description: "", media_type: "text/markdown", content: "间歇跑个体负荷样例", content_hash: "senior", load_mode: "always", max_chars: 1000, sort_order: 50, metadata: { stages: ["高中"] } },
      ],
    },
  });
  assertEquals(selectWorkSkillReferences(skill, { stage: "小学", subject: "体育" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-primary.md"]);
  assertEquals(selectWorkSkillReferences(skill, { stage: "初中", subject: "体育" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-junior.md"]);
  assertEquals(selectWorkSkillReferences(skill, { stage: "高中", subject: "体育" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-senior.md"]);
  const prompt = buildWorkPrompt({ toolSlug: "subject-lesson-design", input: { stage: "初中", subject: "体育", topic: "篮球传切配合" }, skill, materialContext: "经核教材、班情、场地器材和SOP", textbookContext: "" });
  assertEquals(prompt.user.includes("篮球传切小场比赛样例"), true);
  assertEquals(prompt.user.includes("间歇跑个体负荷样例"), false);
  assertEquals(prompt.system.includes("健康场地器材天气和急救SOP"), true);
  assertEquals(prompt.system.includes("样例只作结构参照"), true);
});

Deno.test("integrated practice references load only the matching stage example and retain long-cycle evidence ethics and stakeholder guidance", () => {
  const skill = candidate({
    slug: "subject-lesson-design-integrated-practice",
    is_fallback: false,
    version: {
      ...candidate({}).version,
      prompt_template: "综合实践活动公开课 Skill：必须定位长周期关键课时，保留真实前序证据、亲历实践、个人贡献、利益相关者反馈、伦理审批和安全。",
      output_contract: { format: "integrated_practice_public_lesson_markdown_v1" },
      references: [
        { id: "models", path: "references/mainstream-models.md", name: "模式", description: "", media_type: "text/markdown", content: "五类综合实践模式", content_hash: "models", load_mode: "always", max_chars: 1000, sort_order: 10, metadata: {} },
        { id: "primary", path: "references/excellent-example-primary.md", name: "小学样例", description: "", media_type: "text/markdown", content: "观察工具试测样例", content_hash: "primary", load_mode: "always", max_chars: 1000, sort_order: 30, metadata: { stages: ["小学"] } },
        { id: "junior", path: "references/excellent-example-junior.md", name: "初中样例", description: "", media_type: "text/markdown", content: "社会服务需求核验样例", content_hash: "junior", load_mode: "always", max_chars: 1000, sort_order: 40, metadata: { stages: ["初中"] } },
        { id: "senior", path: "references/excellent-example-senior.md", name: "高中样例", description: "", media_type: "text/markdown", content: "职业体验互证样例", content_hash: "senior", load_mode: "always", max_chars: 1000, sort_order: 50, metadata: { stages: ["高中"] } },
      ],
    },
  });
  assertEquals(selectWorkSkillReferences(skill, { stage: "小学", subject: "综合实践" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-primary.md"]);
  assertEquals(selectWorkSkillReferences(skill, { stage: "初中", subject: "综合实践" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-junior.md"]);
  assertEquals(selectWorkSkillReferences(skill, { stage: "高中", subject: "综合实践" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-senior.md"]);
  const prompt = buildWorkPrompt({ toolSlug: "subject-lesson-design", input: { stage: "小学", subject: "综合实践", topic: "校园饮水观察" }, skill, materialContext: "经核学校方案、学生前序档案和审批", textbookContext: "" });
  assertEquals(prompt.user.includes("观察工具试测样例"), true);
  assertEquals(prompt.user.includes("职业体验互证样例"), false);
  assertEquals(prompt.system.includes("定位长周期关键课时"), true);
  assertEquals(prompt.system.includes("样例只作结构参照"), true);
});

Deno.test("general technology loads the senior example only for senior stage and retains authentic testing iteration and safety guidance", () => {
  const skill = candidate({
    slug: "subject-lesson-design-general-technology",
    is_fallback: false,
    version: {
      ...candidate({}).version,
      prompt_template: "通用技术公开课 Skill：从真实需求与约束出发，保留多方案、规范表达、事前试验、原始失败、单变量优化、同条件复测、安全标准与生命周期权衡。",
      output_contract: { format: "general_technology_public_lesson_markdown_v1" },
      references: [
        { id: "models", path: "references/mainstream-models.md", name: "模式", description: "", media_type: "text/markdown", content: "七类通用技术模式", content_hash: "models", load_mode: "always", max_chars: 1000, sort_order: 10, metadata: {} },
        { id: "senior", path: "references/excellent-example-senior.md", name: "高中样例", description: "", media_type: "text/markdown", content: "承重纸桥公平试验与优化样例", content_hash: "senior", load_mode: "always", max_chars: 1000, sort_order: 30, metadata: { stages: ["高中"] } },
      ],
    },
  });
  assertEquals(selectWorkSkillReferences(skill, { stage: "高中", subject: "通用技术" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-senior.md"]);
  assertEquals(selectWorkSkillReferences(skill, { stage: "其他（中职/高职/高校等）", subject: "通用技术" }).map((item) => item.path), ["references/mainstream-models.md"]);
  const prompt = buildWorkPrompt({ toolSlug: "subject-lesson-design", input: { stage: "高中", subject: "通用技术", topic: "技术标准及试验" }, skill, materialContext: "经核教材、设施、材料参数、设备说明和SOP", textbookContext: "" });
  assertEquals(prompt.user.includes("承重纸桥公平试验与优化样例"), true);
  assertEquals(prompt.system.includes("事前试验、原始失败、单变量优化、同条件复测"), true);
  assertEquals(prompt.system.includes("样例只作结构参照"), true);
});

Deno.test("professional umbrella skill loads the other-stage example and retains exact-course gate and non-generic evidence guidance", () => {
  const skill = candidate({
    slug: "subject-lesson-design-professional",
    is_fallback: false,
    version: {
      ...candidate({}).version,
      prompt_template: "其他 / 专业课元 Skill：先识别办学层次、专业课程和标准，不把所有专业课写成通用小组讨论；保留个体V1、外部标准、错误异常、反馈重做、模拟边界、安全伦理。",
      output_contract: { format: "professional_public_lesson_markdown_v1" },
      references: [
        { id: "models", path: "references/mainstream-models.md", name: "模式", description: "", media_type: "text/markdown", content: "八类非同构专业课模式", content_hash: "models", load_mode: "always", max_chars: 1000, sort_order: 10, metadata: {} },
        { id: "other", path: "references/excellent-example-other.md", name: "其他样例", description: "", media_type: "text/markdown", content: "高职物流合成数据约束审计样例", content_hash: "other", load_mode: "always", max_chars: 1000, sort_order: 30, metadata: { stages: ["其他（中职/高职/高校等）"] } },
      ],
    },
  });
  assertEquals(selectWorkSkillReferences(skill, { stage: "其他（中职/高职/高校等）", subject: "其他 / 专业课" }).map((item) => item.path), ["references/mainstream-models.md", "references/excellent-example-other.md"]);
  assertEquals(selectWorkSkillReferences(skill, { stage: "高中", subject: "其他 / 专业课" }).map((item) => item.path), ["references/mainstream-models.md"]);
  const prompt = buildWorkPrompt({ toolSlug: "subject-lesson-design", input: { stage: "其他（中职/高职/高校等）", subject: "其他 / 专业课", topic: "多约束配送线路优化" }, skill, materialContext: "经核高职专业、课程标准、教材、合成数据和软件条件", textbookContext: "" });
  assertEquals(prompt.user.includes("高职物流合成数据约束审计样例"), true);
  assertEquals(prompt.system.includes("先识别办学层次、专业课程和标准"), true);
  assertEquals(prompt.system.includes("个体V1、外部标准、错误异常、反馈重做"), true);
  assertEquals(prompt.system.includes("样例只作结构参照"), true);
});

Deno.test("runtime empty skill has no published-version dependency", () => {
  const skill = createEmptyWorkSkill("teaching-design");
  assertEquals(skill.is_fallback, true);
  assertEquals(skill.version.prompt_template, "");
  assertEquals(skill.version.output_contract, {});
});

Deno.test("skill selection returns no candidate only before the runtime empty fallback is applied", () => {
  assertEquals(selectWorkSkill([], { subject: "英语", lesson_type: "公开课" }), null);
  const fallback = createEmptyWorkSkill("subject-lesson-design");
  assertEquals(fallback.version.version_label, "empty-runtime-v1");
});

Deno.test("politics work prompt injects retrieved case candidates with verification boundary", () => {
  const skill = candidate({ slug: "politics-public-lesson" });
  skill.version.references = [];
  const prompt = buildWorkPrompt({
    toolSlug: "subject-lesson-design",
    input: { topic: "高质量发展", teaching_mode: "案例式" },
    skill,
    materialContext: "",
    textbookContext: "教材知识点",
    caseContext: "### 雄安新区从一张图到一座城\n核验状态：source_declared_requires_fact_check",
  });
  assertEquals(prompt.user.includes("## 思政公开课案例库候选（后端检索）"), true);
  assertEquals(prompt.user.includes("雄安新区从一张图到一座城"), true);
  assertEquals(prompt.system.includes("不是可直接宣读的事实定稿"), true);
});

Deno.test("segment-optimization prompt injects segment methodology and markdown directive", () => {
  const prompt = buildWorkPrompt({
    toolSlug: "segment-optimization",
    input: {
      stage: "初中",
      subject: "语文",
      topic: "背影",
      segment_type: "课程导入",
      current_design: "教师问：你们和父亲关系怎样？",
      desired_outcome: "让学生暴露对父爱的前概念。",
    },
    skill: candidate({}),
    materialContext: "",
  });
  // 环节专属方法论按 segment_type 注入
  assertEquals(prompt.system.includes("课程导入"), true);
  assertEquals(prompt.system.includes("核心目的"), true);
  // Markdown 直出指令（替代旧的「输出 JSON」与「输出教案」）
  assertEquals(prompt.system.includes("Markdown 环节优化方案"), true);
  assertEquals(prompt.system.includes("不要输出 JSON"), true);
  assertEquals(prompt.system.includes("教案"), false);
});

Deno.test("segment-optimization prompt falls back to 其他 methodology for unknown segment type", () => {
  const prompt = buildWorkPrompt({
    toolSlug: "segment-optimization",
    input: {
      segment_type: "未知环节",
      stage: "初中",
      subject: "语文",
      topic: "x",
      current_design: "y",
      desired_outcome: "z",
    },
    skill: candidate({}),
    materialContext: "",
  });
  assertEquals(prompt.system.includes("通用优化框架"), true);
});

Deno.test("parseWorkJson extracts a fenced object", () => {
  assertEquals(parseWorkJson('```json\n{"summary":"ok"}\n```'), { summary: "ok" });
});

Deno.test("diagnosis validation requires seven elements and four relations", () => {
  assertThrows(() => validateWorkOutput({ elements: [] }, {
      format: "lesson_diagnosis_v1",
      required: ["elements"],
    }),
    "七个",
  );
});

Deno.test("diagnosis validation enforces the seven-element order", () => {
  const element = (name: string, criteriaCount: number) => ({
    name,
    qualityScore: 80,
    criteria: Array.from({ length: criteriaCount }, () => ({ name: "指标", met: true, score: 80, comment: "有证据和改法" })),
  });
  const output = {
    overallScore: 80,
    elements: [
      element("学情分析", 3),
      element("教材分析", 3),
      element("教学目标", 5),
      element("教学重难点", 1),
      element("教学环节", 3),
      element("教学评估", 2),
      element("教学反思", 1),
    ],
    systemDiagnosis: {
      alignment: {}, objectiveSource: {}, difficultyCoverage: {}, studentResponsiveness: {},
    },
    suggestions: [{}, {}, {}],
  };
  assertThrows(() => validateWorkOutput(output, {
    format: "lesson_diagnosis_v1",
    required: ["elements"],
  }), "第 1 项");
});

Deno.test("segment output renders as markdown", () => {
  const markdown = renderWorkMarkdown("segment-optimization", {
    summary: "导入优化",
    core_problem: "问题太大",
    principles: ["制造认知冲突"],
    optimized_segment: "展示两份相反材料。",
  });
  assertEquals(markdown.includes("# 导入优化"), true);
  assertEquals(markdown.includes("制造认知冲突"), true);
});

Deno.test("politics lesson v2 validates nested steps and renders the fixed section order", () => {
  const output = politicsLessonOutput();
  validateWorkOutput(output, politicsOutputContract());
  const markdown = renderWorkMarkdown("subject-lesson-design", output);
  const headings = [
    "## 1. 课程基本信息",
    "## 2. 教材分析",
    "## 3. 学情分析",
    "## 4. 教学目标",
    "## 5. 教学重难点",
    "## 6. 教学流程",
    "## 7. 板书设计",
    "## 8. 教学反思",
  ];
  assertEquals(headings.every((heading, index) => {
    const position = markdown.indexOf(heading);
    return position >= 0 && (index === 0 || position > markdown.indexOf(headings[index - 1]));
  }), true);
  assertEquals(markdown.includes("| 步骤 | 教师行为 | 学生行为 | 预期产出 | 评价与反馈 |"), true);
  assertEquals(markdown.includes("references/case-mode-v3.md"), true);
});

Deno.test("politics lesson v2 rejects flow steps without student behavior", () => {
  const output = politicsLessonOutput();
  const firstFlow = (output.lesson_flow as Array<Record<string, unknown>>)[0];
  delete (firstFlow.steps as Array<Record<string, unknown>>)[0].student_behavior;
  assertThrows(() => validateWorkOutput(output, politicsOutputContract()), "student_behavior");
});

function politicsOutputContract() {
  return {
    format: "sizheng_public_lesson_v2",
    required: [
      "title", "basic_info", "textbook_analysis", "learner_analysis", "objectives",
      "key_points", "difficult_points", "lesson_flow", "board_design", "teaching_reflection",
    ],
    basic_info_required: [
      "subject", "stage", "grade", "textbook_edition", "unit", "lesson", "frame",
      "class_size", "duration", "lesson_type", "teaching_mode", "topic",
      "textbook_source_path", "mode_template_path",
    ],
    textbook_analysis_required: ["unit_analysis", "lesson_analysis", "curriculum_standard_analysis"],
    lesson_flow_required: [
      "phase", "title", "minutes", "purpose", "materials", "key_question_or_task",
      "steps", "knowledge_landing", "transition",
    ],
    lesson_step_required: ["step", "teacher_behavior", "student_behavior", "expected_output", "evaluation"],
    minimum_flow_items: 5,
    minimum_steps_per_flow: 2,
  };
}

function politicsLessonOutput(): Record<string, unknown> {
  const flow = (phase: string, minutes: number) => ({
    phase,
    title: `${phase}标题`,
    minutes,
    purpose: "推进教材理解",
    materials: ["教材材料"],
    key_question_or_task: "从材料中能得出什么结论？",
    steps: [1, 2].map((step) => ({
      step,
      teacher_behavior: "呈现材料并追问依据。",
      student_behavior: "阅读、圈画并用证据表达。",
      expected_output: "形成有依据的解释。",
      evaluation: "依据准确、概念清楚。",
    })),
    knowledge_landing: "归纳教材核心知识。",
    transition: "带着新问题进入下一环节。",
  });
  return {
    title: "珍视自由",
    basic_info: {
      subject: "道德与法治", stage: "初中", grade: "八年级", textbook_edition: "统编版",
      unit: "第三单元", lesson: "第七课 追求自由平等", frame: "第一框 珍视自由",
      class_size: "未提供（请教师补充）", duration: "40分钟", lesson_type: "公开课",
      teaching_mode: "案例式", topic: "珍视自由",
      textbook_source_path: "8年级上册/第三单元/第七课/第一框 珍视自由",
      mode_template_path: "references/case-mode-v3.md",
    },
    textbook_analysis: {
      unit_analysis: "说明单元结构。", lesson_analysis: "说明框题知识关系。",
      curriculum_standard_analysis: "待依据课程标准原文复核。",
    },
    learner_analysis: {
      known: "学生知道自由。", misconceptions: ["把自由理解为随心所欲"],
      learning_needs: "用案例辨析边界。", evidence_basis: "一般性预判。",
    },
    objectives: [1, 2, 3].map((index) => ({ objective: `目标${index}`, learning_evidence: `证据${index}` })),
    key_points: ["自由与法治的关系"],
    difficult_points: ["理解自由边界及突破方式"],
    lesson_flow: [flow("导入", 5), flow("案例1", 10), flow("案例2", 10), flow("案例3", 10), flow("总结迁移", 5)],
    board_design: { layout_text: "自由—边界—法治", logic_explanation: "呈现递进关系。" },
    teaching_reflection: {
      observation_focus: ["学生是否引用材料"], possible_risks: ["活动超时"], adjustment_plan: ["压缩展示"],
    },
  };
}
