import {
  applyWorkOutputRuntimeTrace,
  assertWorkSkillRuntimeReady,
  buildWorkPrompt,
  parseWorkJson,
  renderWorkMarkdown,
  selectWorkSkillReferences,
  selectWorkSkill,
  validateWorkInput,
  validateWorkOutput,
  type WorkSkillCandidate,
} from "./hai_work.ts";

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
      lesson_type: "公开课",
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
    lesson_type: "公开课",
  }, 0);
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
  skill.version.output_contract = { format: "sizheng_public_lesson_v2" };
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
    input: { topic: "开启初中生活", teaching_mode: "案例式" },
    skill,
    textbookContext: "第一框 奏响中学序曲",
    materialContext: "教师补充教材原文",
  });
  assertEquals(prompt.user.includes("## 内置教材知识库（精确命中）"), true);
  assertEquals(prompt.user.includes("## 用户指定材料"), true);
  assertEquals(prompt.user.includes("### references/case-mode-v3.md"), true);
  assertEquals(prompt.user.includes("材料—问题—分析—归纳"), true);
  assertEquals(prompt.system.includes("不是教材逐字原文"), true);
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
