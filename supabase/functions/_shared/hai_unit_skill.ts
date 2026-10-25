import type { WorkSkillReference } from "./hai_work.ts";
import type { WorkflowOption } from "./hai_workflow.ts";

// These IDs also identify the paired templates in the Skill source package.
export const UNIT_MODES = {
  "task-driven": "大任务驱动型",
  "concept-led": "大概念统领型",
  "question-led": "核心问题／议题型",
  "theme-led": "主题意义型",
  "method-progression": "方法策略进阶型",
  "inquiry-practice": "探究实践型",
} as const;
export type UnitReferences = Array<Pick<WorkSkillReference, "path" | "content" | "max_chars">>;

export function appendUnitReferences(prompt: { system: string; user: string }, refs: UnitReferences, phase: "mode" | "plan" | "lesson", selected?: WorkflowOption) {
  const mode = Object.entries(UNIT_MODES).find(([id, title]) => selected?.id === id || selected?.title === title)?.[0];
  if (phase !== "mode" && !mode) throw new Error("请先确认六种教学模式中的一种，再继续设计。");
  const paths = phase === "mode" ? ["references/mode-selection.md"]
    : [`assets/${phase === "plan" ? "unit" : "lesson"}-${mode}.md`];
  const selectedRefs = paths.map(path => {
    const ref = refs.find(ref => ref.path === path);
    if (!ref?.content.trim()) throw new Error(`大单元参考资料未加载：${path}`);
    return ref;
  });
  return { ...prompt, user: `${prompt.user}\n\n## ${phase === "mode" ? "本阶段参考资料" : "本阶段模板"}\n${selectedRefs.map(ref => `### ${ref.path}\n${ref.content.slice(0, ref.max_chars)}`).join("\n\n")}` };
}
