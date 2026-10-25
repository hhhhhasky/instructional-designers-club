import { assertEquals, assertRejects, assertThrows, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseUnitPlan, validateUnitDocument, validateUnitSelection, unitFile, UNIT_SECTION_NAMES, LESSON_SECTION_NAMES } from "./hai_unit_design.ts";
import { loadUnitTextbookContext, loadUnitCurriculumContext, selectCurriculumExcerpts } from "./hai_unit_context.ts";

const book = { collection_slug: "book-1", units: [{ unit_number: 1 }] };
Deno.test("unit scopes enforce one full unit, multiple same-book units, and multiple distinct books", () => {
  assertEquals(validateUnitSelection("", [book]), "请选择重构范围。");
  assertEquals(validateUnitSelection("within-unit", [book]), "");
  assertStringIncludes(validateUnitSelection("within-book", [book]), "至少选择两个单元");
  assertEquals(validateUnitSelection("within-book", [{ ...book, units: [{ unit_number: 1 }, { unit_number: 2, lessons: [{ lesson_number: 3, frame_numbers: [2] }] }] }]), "");
  assertStringIncludes(validateUnitSelection("across-books", [book]), "至少选择两本教材");
  assertStringIncludes(validateUnitSelection("across-books", [book, book]), "不能重复");
  assertEquals(validateUnitSelection("across-books", [book, { ...book, collection_slug: "book-2" }]), "");
  assertStringIncludes(validateUnitSelection("within-unit", [{ ...book, units: [{ unit_number: 1, lessons: [{ lesson_number: 1 }] }] }]), "完整单元");
  assertStringIncludes(validateUnitSelection("within-book", [{ ...book, units: [{ unit_number: 1, lessons: [] }, { unit_number: 2 }] }]), "至少一课");
  assertStringIncludes(validateUnitSelection("within-book", [{ ...book, units: [{ unit_number: 1 }, { unit_number: 2, lessons: [{ lesson_number: 1, frame_numbers: [] }] }] }]), "有效的框题");
});

export const document = (sections: string[]) => ["# 测试设计", ...["基本信息", ...sections].map((name) => `## ${name}\n这是包含具体学生表现与教学材料的实质内容，提供学习要求与判断证据。`)].join("\n\n");
Deno.test("unit plan must contain a complete document and an ordered lesson manifest", () => {
  const plan = parseUnitPlan(JSON.stringify({ markdown: document(UNIT_SECTION_NAMES), lessons: [{ title: "课题A", lesson_type: "新授课", subtask: "比较实例", subquestion: "如何解释", connection: "承接起点诊断", objectives: "能够解释现象", source_paths: ["第一单元/第一课"] }] }));
  assertEquals(plan.lessons.length, 1);
  assertStringIncludes(plan.markdown, "共 1 课时");
  assertThrows(() => parseUnitPlan('{"markdown":"# 提纲","lessons":[]}'));
  assertThrows(() => parseUnitPlan(JSON.stringify({ markdown: "## 单元主题\n同上", lessons: [{ title: "课", objectives: "目标", source_paths: [] }] })));
  assertEquals(unitFile("lesson", 2, "课/题", document(LESSON_SECTION_NAMES)).filename, "02_第02课时_课-题.md");
});

function client(catalog: any[], sections: any[], standards: any[] = []) {
  return { rpc: () => Promise.resolve({ data: catalog, error: null }), from: (table: string) => {
    const chain: any = {};
    let start = 0; let end = Number.POSITIVE_INFINITY;
    for (const name of ["select", "eq", "in", "order", "limit", "range"]) chain[name] = () => chain;
    chain.range = (from: number, to: number) => { start = from; end = to; return chain; };
    chain.single = () => Promise.resolve({ data: { id: "c1", slug: "book-1", title: "七上", edition_label: "2026版" }, error: null });
    chain.then = (done: any) => Promise.resolve({ data: table === "hai_knowledge_sources" ? standards : sections.slice(start, end + 1), error: null }).then(done);
    return chain;
  } };
}
const rows = [{ collection_slug: "book-1", unit_route_number: 1, lesson_route_number: 1, frame_route_number: 1, unit_label: "第一单元", unit_title: "成长" }, { collection_slug: "book-1", unit_route_number: 2, lesson_route_number: 2, frame_route_number: 1 }];
const sections = [
  { id: "unit1", section_level: "unit", unit_number: 1, section_path: "单元1", content_markdown: "单元导语", unit_title: "成长" },
  { id: "lesson1", section_level: "lesson", unit_number: 1, lesson_number: 1, section_path: "课1", content_markdown: "课题概述" },
  { id: "frame1", section_level: "frame", unit_number: 1, lesson_number: 1, frame_number: 1, section_path: "框1", content_markdown: "入选知识点" },
  { id: "wrong", section_level: "frame", unit_number: 1, lesson_number: 9, frame_number: 1, content_markdown: "不该进入的课" },
  { id: "lesson2", section_level: "lesson", unit_number: 2, lesson_number: 2, section_path: "课2", content_markdown: "第二单元知识" },
];
Deno.test("database retrieval includes selected frames and parent context but excludes unrelated lessons", async () => {
  const result = await loadUnitTextbookContext(client(rows, sections), { stage: "初中", subject: "道德与法治", reconstruction_scope: "within-book", textbook_selections: [{ ...book, units: [{ unit_number: 1, lessons: [{ lesson_number: 1, frame_numbers: [1] }] }, { unit_number: 2 }] }] });
  assertEquals(result.sources.map((s: any) => s.section_id), ["unit1", "lesson1", "frame1", "lesson2"]);
  assertStringIncludes(result.context, "入选知识点");
  await assertRejects(() => loadUnitTextbookContext(client([], []), { stage: "小学", subject: "数学", reconstruction_scope: "within-unit", textbook_selections: [book] }), Error, "不匹配");
  await assertRejects(() => loadUnitTextbookContext(client(rows, []), { stage: "初中", subject: "道德与法治", reconstruction_scope: "within-unit", textbook_selections: [book] }), Error, "缺少教材正文");
});
Deno.test("curriculum reads actual shared text, skips missing/ambiguous versions, and scopes by stage", async () => {
  const input = { stage: "初中", subject: "道德与法治" };
  const standard = { id: "s1", title: "义务教育道德与法治课程标准（2022年版）", metadata: { grade_band: "义务教育" }, content: "## 内容要求\n\n认识成长的意义，建立正确认识。" };
  const match = await loadUnitCurriculumContext(client([], [], [standard]), input, sections);
  assertStringIncludes(match.context, "认识成长的意义");
  assertEquals(match.status, "matched");
  assertEquals((await loadUnitCurriculumContext(client([], [], []), input, [])).context, "");
  assertEquals((await loadUnitCurriculumContext(client([], [], [standard, { ...standard, id: "s2" }]), input, [])).status, "ambiguous");
  assertEquals((await loadUnitCurriculumContext(client([], [], [standard]), { stage: "高中", subject: "思想政治" }, [])).status, "missing");
  assertStringIncludes(selectCurriculumExcerpts("无关资料\n\n内容要求：解释光合作用。", ["光合作用"]), "解释光合作用");
});

Deno.test("whole-unit retrieval reads every page beyond the API page size", async () => {
  const many = Array.from({ length: 501 }, (_, index) => ({ id: `section-${index}`, section_level: "lesson", unit_number: 1, lesson_number: index + 1, section_path: `课${index + 1}`, content_markdown: "实际知识内容" }));
  const result = await loadUnitTextbookContext(client(rows, many), { stage: "初中", subject: "道德与法治", reconstruction_scope: "within-unit", textbook_selections: [book] });
  assertEquals(result.sources.length, 501);
  assertEquals(result.sources[500].section_id, "section-500");
});

Deno.test("substantive cross references pass but standalone placeholders still fail", () => {
  const valid = document(UNIT_SECTION_NAMES).replace("## 单元内容分析\n", "## 单元内容分析\n| 原课题 | 本单元安排 |\n| --- | --- |\n| 国家监察机关 | 同上，第5课时。监察机关与司法机关有配合制约关系，安排具体案例辨析。 |\n");
  validateUnitDocument(valid, "unit");
  for (const placeholder of ["同上", "同上。", "| 重点内容 | 同上 |", "| 重点内容 | 【填写】 |"] ) {
    const invalid = document(UNIT_SECTION_NAMES).replace(/(## 单元内容分析\n)[^\n]+/, `$1${placeholder}`);
    assertThrows(() => validateUnitDocument(invalid, "unit"), Error, "单元内容分析");
  }
});
