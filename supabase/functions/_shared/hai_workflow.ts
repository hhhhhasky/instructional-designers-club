import { unitWorkflowPrompt } from "./hai_unit_prompt.ts";
import { UNIT_MODES } from "./hai_unit_skill.ts";
import { parseUnitPlan } from "./hai_unit_design.ts";

export type WorkflowStage = "focus" | "mode" | "plan" | "result";
export type WorkflowOption = { id: string; title: string; reason: string; approach: string };
export type WorkWorkflow = {
  version: 1 | 2; selected_focus?: WorkflowOption; revision: number; stage: WorkflowStage; selected_mode?: WorkflowOption;
  selection_source?: "form"; feedback?: string; options?: WorkflowOption[]; markdown?: string;
  history?: Record<string, unknown>[]; attempts?: Record<string, unknown>[];
};
export function initialWorkflow(slug: string, input: Record<string, unknown>, revision: boolean, version: 1 | 2 = 1): WorkWorkflow | null {
  // Historical artifact revisions retain their existing path.
  if (revision || !["subject-lesson-design", "unit-learning-design", "teaching-design"].includes(slug)) return null;
  if (slug === "subject-lesson-design" && version === 2) return { version: 2, revision: 1, stage: "focus" };
  const chosen = String(input.teaching_mode ?? "");
  const politics = ["道德与法治", "思想政治"].includes(String(input.subject));
  if (slug === "subject-lesson-design" && politics && ["案例式", "任务式", "议题式"].includes(chosen)) {
    return { version: 1, revision: 1, stage: "result", selection_source: "form", selected_mode: { id: chosen, title: chosen, reason: "教师已在需求表单中选择", approach: "沿用对应模式模板" } };
  }
  return { version: 1, revision: 1, stage: "mode" };
}
export function workflowPrompt(base: { system: string; user: string }, flow: WorkWorkflow, slug: string, unitWorkflow = false) {
  if (slug === "unit-learning-design" && unitWorkflow) return unitWorkflowPrompt(base, flow);
  const isUnit = slug === "unit-learning-design";
  const isResearch = slug === "teaching-design";
  const instruction = flow.stage === "focus"
    ? "本阶段只确定教什么：结合实际课标、教材与学情，提供2—3个本课最值得促成的学生转变。title写核心内容与从哪里到哪里的变化，reason写具体知识对象、课标教材依据和学习困难，approach写可观察的学习表现。学情无证据时标为一般性预判，课标缺失时写待核验，不编造。教师已明确唯一重点时允许1项供确认。不推荐教学模式，不生成教案。"
    : flow.stage === "mode"
    ? isResearch
      ? '本阶段只明确研发目标与交付范围，提供2—3个有实质区别的方案供教师选择。不要生成最终方案。'
      : `本阶段只${isUnit ? "推荐单元教学模式与组织思路" : "筛选教学模式"}。根据知识点、素养目标和学情，从所提供的学科 Skill 及模式资料中筛选2—3个候选，不虚构专业模式。不要生成完整教案或要求确认课堂流程。`
    : flow.stage === "plan"
      ? isUnit
        ? '只生成完整单元整体设计与课时清单，等待教师确认，不生成课时教案。返回JSON，顶层markdown为整体设计正文，lessons为每课title、lesson_type、objectives、subtask、subquestion、connection、source_paths。'
        : '只生成可供确认的方案结构、实施阶段和配套材料目录。返回JSON，顶层markdown为完整结构正文，不展开最终方案。'
      : '根据教师已确认的模式及要求直接生成完整成果。自动编排课堂流程和检查质量，不增加课堂流程确认，不更换已选模式。';
  if (slug === "subject-lesson-design" && flow.version === 2 && flow.stage !== "focus" && !flow.selected_focus) throw new Error("请先确认本课教学重点。");
  if (slug === "subject-lesson-design" && flow.version === 2 && flow.stage === "result" && !flow.selected_mode) throw new Error("请先确认本课教学模式。");
  const lessonInstruction = slug === "subject-lesson-design" && flow.version === 2
    ? flow.stage === "mode" ? "围绕已经确认的学生转变，优先推荐3种有实质差别的教学模式；适用依据不足可只推荐2种。说明匹配理由、核心情境/问题/任务、简要学习路径、学习表现和实施条件。使用本阶段教学模式知识，不强制专属策略。"
    : flow.stage === "result" ? "严格沿用教师确认的教学重点和模式，按本阶段原有输出模板生成完整Markdown教案，不再要求确认。学科味只判断教学内容，不强制专属策略。" : ""
    : "";
  const unitInstruction = isUnit && flow.stage === "mode"
    ? `从六种模式中推荐2—3项：${JSON.stringify(UNIT_MODES)}。options的id必须使用对应英文键，title使用对应中文名。reason说明内容联系、学生起点和实施条件，approach说明学生具体学什么、怎样进阶，以及主要实施要求或局限。不得只凭学科名称选择。`
    : "";
  return {
    system: `${base.system}\n\n## 当前工作流阶段（决定本次输出范围）\n${instruction}\n${unitInstruction}\n${lessonInstruction}${flow.stage === "mode" || flow.stage === "focus" ? '\n只返回JSON对象：{"options":[{"id":"稳定标识","title":"模式/方案名称","reason":"与本课知识点、素养目标的关系","approach":"学生怎样学习或实施范围"}]}。mode候选2—3项，focus候选1—3项，id不重复。' : ""}`,
    user: `${base.user}\n\n## 教师已经确认的教学重点\n${JSON.stringify(flow.selected_focus ?? null)}\n\n## 教师已经确认的模式\n${JSON.stringify(flow.selected_mode ?? null)}\n\n## 历次教师修改要求\n${(flow.history ?? []).filter((h) => h.action === "revise").map((h) => String(h.feedback ?? "")).join("\n") || "无"}\n\n## 当前阶段修改要求\n${flow.feedback || "无新增要求"}\n${flow.markdown && !(isUnit && flow.stage === "result") ? `\n## ${flow.stage === "result" ? "已确认的整体设计" : "上一版阶段方案（按修改意见调整）"}\n${flow.markdown}` : ""}`,
  };
}
export function parseWorkflowOutput(output: string, stage: WorkflowStage, slug: string) {
  const raw = output.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(raw);
  if (stage === "mode" || stage === "focus") {
    const options = parsed.options;
    if (!Array.isArray(options) || options.length < (stage === "focus" ? 1 : 2) || options.length > 3) throw new Error("教学模式候选应有2—3项，请重试这一阶段。");
    for (const option of options) {
      for (const field of ["id", "title", "reason", "approach"]) {
        if (!option || typeof option[field] !== "string" || !option[field].trim() || option[field].length > 4000) throw new Error("候选模式缺少名称或具体说明。");
      }
    }
    if (new Set(options.map((o) => o.id)).size !== options.length) throw new Error("候选模式标识重复。");
    return { options: options as WorkflowOption[] };
  }
  if (slug === "unit-learning-design") return { ...parseUnitPlan(output) };
  if (typeof parsed.markdown !== "string" || parsed.markdown.trim().length < 80) throw new Error("整体方案内容不完整。");
  return { markdown: parsed.markdown as string };
}
