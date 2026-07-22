import {
  buildWorkPrompt,
  parseWorkJson,
  renderWorkMarkdown,
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
      match_criteria: { subjects: ["思想政治"], lesson_types: ["公开课"] },
    }),
  ], { subject: "高中思想政治", lesson_type: "公开课" });
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
    lesson_type: "公开课",
  }, 0);
});

Deno.test("work prompt separates built-in textbook knowledge from user materials", () => {
  const prompt = buildWorkPrompt({
    toolSlug: "subject-lesson-design",
    input: { topic: "开启初中生活" },
    skill: candidate({}),
    textbookContext: "第一框 奏响中学序曲",
    materialContext: "教师补充教材原文",
  });
  assertEquals(prompt.user.includes("## 内置教材知识库（精确命中）"), true);
  assertEquals(prompt.user.includes("## 用户指定材料"), true);
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
