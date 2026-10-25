import { assertEquals, assertStringIncludes, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { appendUnitReferences, UNIT_MODES } from "./hai_unit_skill.ts";
import { parseUnitPlan, validateUnitDocument } from "./hai_unit_design.ts";

const source = new URL("../../skill-sources/design-learning-units/v2.1.0-lean-prompts/", import.meta.url);
const paths = ["references/mode-selection.md", ...Object.keys(UNIT_MODES).flatMap(id => [`assets/unit-${id}.md`, `assets/lesson-${id}.md`])];
const refs = paths.map(path => { const content = Deno.readTextFileSync(new URL(path, source)); return { path, content, max_chars: content.length }; });
const base = { system: "阶段约束", user: "备课需求" };

Deno.test("unit references load mode selection first and only the confirmed template in later phases", () => {
  const mode = appendUnitReferences(base, refs, "mode");
  assertStringIncludes(mode.user, "references/mode-selection.md");
  assertEquals(mode.user.includes("assets/unit-"), false);
  assertEquals(mode.user.includes("references/input-and-evidence.md"), false);
  for (const [id, title] of Object.entries(UNIT_MODES)) {
    const selected = { id, title, reason: "内容联系", approach: "学习进阶" };
    const plan = appendUnitReferences(base, refs, "plan", selected);
    assertStringIncludes(plan.user, `assets/unit-${id}.md`);
    assertEquals(plan.user.includes("quality-criteria.md"), false);
    assertEquals(plan.user.includes(`assets/lesson-${id}.md`), false);
    const lesson = appendUnitReferences(base, refs, "lesson", selected);
    assertStringIncludes(lesson.user, `assets/lesson-${id}.md`);
    assertEquals(lesson.user.includes(`assets/unit-${id}.md`), false);
  }
  assertThrows(() => appendUnitReferences(base, refs, "plan"), Error, "先确认");
  assertThrows(() => appendUnitReferences(base, [], "mode"), Error, "未加载");
});

Deno.test("all six current template structures are accepted and missing core content fails", () => {
  // Use the real template headings with non-placeholder content, not the template
  // prompts themselves. This catches drift between the imported templates and parser.
  for (const [id] of Object.entries(UNIT_MODES)) {
    const doc = (path: string) => [...refs.find(ref => ref.path === path)!.content.matchAll(/^## (.+)$/gm)]
      .map(match => `## ${match[1]}\n学生比较两种材料中的关系，解释判断依据；教师依据学生表现提供补充材料和反馈。`).join("\n\n");
    const markdown = doc(`assets/unit-${id}.md`);
    const plan = parseUnitPlan(JSON.stringify({ markdown, lessons: [{ title: "关系比较", lesson_type: "新授课", objectives: "解释材料关系", subtask: "比较实例", subquestion: "为什么不同", connection: "从观察到解释", source_paths: ["第一单元"] }] }));
    assertStringIncludes(plan.markdown, "共 1 课时");
    assertStringIncludes(plan.markdown, "## 六、课时安排与实施统筹\n学生比较两种材料");
    validateUnitDocument(doc(`assets/lesson-${id}.md`), "lesson");
    assertThrows(() => validateUnitDocument(markdown.replace(/## 三、学生起点与学习目标[\s\S]*?(?=## 四)/, ""), "unit"), Error, "学生起点");
  }
});
