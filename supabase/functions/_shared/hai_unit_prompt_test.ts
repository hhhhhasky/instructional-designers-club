import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { compactUnitPromptInput, unitWorkflowPrompt, unitLessonBaseUser } from "./hai_unit_prompt.ts";
import { buildWorkPrompt, type WorkSkillCandidate } from "./hai_work.ts";

Deno.test("unit removes duplicate request fields and excerpts only when their originals remain", () => {
  const input = { constraints: "重构国家机构单元\n\n每课40分钟", desired_outcome: "重构国家机构单元", desired_outcomes: "重构国家机构单元", learner_context: "学生容易混淆机关职权", curriculum_sources: [{ id: "standard", title: "课程标准", excerpt: "了解国家机关的主要职权。" }] };
  const compact = compactUnitPromptInput(input, "## 课标\n了解国家机关的主要职权。");
  assertEquals(compact.desired_outcome, undefined);
  assertEquals(compact.desired_outcomes, undefined);
  assertEquals(compact.learner_context, input.learner_context);
  assertEquals(compact.curriculum_sources, [{ id: "standard", title: "课程标准" }]);
  assertEquals(input.curriculum_sources[0].excerpt, "了解国家机关的主要职权。");
  assertEquals(compactUnitPromptInput(input).curriculum_sources, input.curriculum_sources);
  assertEquals(compactUnitPromptInput({ constraints: "重构单元", desired_outcome: "保留独立表达", desired_outcomes: "增加迁移练习" }).desired_outcomes, "增加迁移练习");
});

Deno.test("unit has one stage output protocol and retains the full Skill and source boundaries", () => {
  const skill = { slug: "design-learning-units", is_fallback: false, version: { prompt_template: "完整Skill主文不可删。", references: [] } } as unknown as WorkSkillCandidate;
  const base = buildWorkPrompt({ toolSlug: "unit-learning-design", unitWorkflow: true, input: {}, skill, materialContext: "上传材料", textbookContext: "完整教材与课标" });
  assertStringIncludes(base.system, "完整Skill主文不可删。");
  assertStringIncludes(base.system, "以用户补充内容为准");
  assertStringIncludes(base.user, "完整教材与课标");
  assertStringIncludes(base.user, "上传材料");
  assertEquals(base.system.includes("只生成一份完整单元整体设计"), false);
  assertEquals(base.system.includes("没有可加载的学科 Reference"), false);
  for (const stage of ["mode", "plan", "result"] as const) {
    const prompt = unitWorkflowPrompt(base, { version: 1, revision: 1, stage });
    assertEquals(prompt.user.includes("教学重点"), false);
    assertEquals(prompt.user.includes("null"), false);
    if (stage === "mode") assertStringIncludes(prompt.system, '"options"');
    if (stage === "plan") assertStringIncludes(prompt.system, '"source_paths"');
    if (stage === "result") {
      assertStringIncludes(prompt.system, "本课完整Markdown，不要JSON");
      assertEquals(prompt.system.includes('"markdown"'), false);
      assertEquals(prompt.system.includes('"options"'), false);
    }
  }
  const legacy = buildWorkPrompt({ toolSlug: "unit-learning-design", input: {}, skill, materialContext: "" });
  assertStringIncludes(legacy.system, "只生成一份完整单元整体设计");
});

Deno.test("current feedback is sent once without dropping distinct chronological edits or old plans", () => {
  const prompt = unitWorkflowPrompt({ system: "Skill", user: "任务" }, { version: 1, revision: 4, stage: "plan", markdown: "上一版完整整体设计", history: [{ action: "revise", feedback: "保留独立表达" }, { action: "revise", feedback: "减少一课时" }], feedback: "减少一课时" });
  assertEquals(prompt.user.split("减少一课时").length - 1, 1);
  assertStringIncludes(prompt.user, "保留独立表达");
  assertStringIncludes(prompt.user, "上一版完整整体设计");
});

Deno.test("lesson calls omit textbook/curriculum blocks and workflow feedback but retain teaching needs", () => {
  const user = '## 任务输入\n' + JSON.stringify({ stage: "初中", constraints: "每课40分钟", learner_context: "混淆机关职权", curriculum_sources: [{ excerpt: "课标节选" }], textbook_identity: [{ title: "八下" }], textbook_selections: [{ collection_slug: "book" }] }) + '\n\n## 内置教材知识库（精确命中）\n教材正文和课标正文\n\n## 用户粘贴的教材内容\n补充教材正文\n\n## 用户指定材料\n教师提供的学习单';
  const trimmed = unitLessonBaseUser(user);
  for (const omitted of ["课标节选", "教材正文", "curriculum_sources", "textbook_selections", "textbook_identity"]) assertEquals(trimmed.includes(omitted), false);
  for (const retained of ["每课40分钟", "混淆机关职权", "教师提供的学习单"]) assertStringIncludes(trimmed, retained);
  const prompt = unitWorkflowPrompt({ system: "完整Skill", user: trimmed }, { version: 1, revision: 4, stage: "result", selected_mode: { id: "task-driven", title: "大任务驱动型", reason: "匹配理由", approach: "组织思路" }, history: [{ action: "revise", feedback: "旧修改意见" }], feedback: "当前反馈" });
  for (const omitted of ["教师已确认的教学模式", "匹配理由", "旧修改意见", "当前反馈"]) assertEquals(prompt.user.includes(omitted), false);
  assertStringIncludes(prompt.system, "完整Skill");
});
