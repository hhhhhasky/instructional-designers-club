import { UNIT_MODES } from "./hai_unit_skill.ts";
import type { WorkWorkflow } from "./hai_workflow.ts";

// Remove copies only when the same content remains in the current request.
// Keep the saved input/source snapshots unchanged for provenance and replay.
export function compactUnitPromptInput(input: Record<string, unknown>, textbookContext = "") {
  const result = { ...input };
  const constraints = String(result.constraints ?? "").trim();
  for (const key of ["desired_outcome", "desired_outcomes"]) {
    const value = typeof result[key] === "string" ? String(result[key]).trim() : "";
    if (value && (constraints === value || constraints.startsWith(value + "\n\n") || constraints.endsWith("\n\n" + value))) delete result[key];
  }
  if (typeof result.desired_outcome === "string" && result.desired_outcome === result.desired_outcomes) delete result.desired_outcomes;
  if (Array.isArray(result.curriculum_sources)) {
    result.curriculum_sources = result.curriculum_sources.map(source => {
      if (!source || typeof source !== "object") return source;
      const copy = { ...source } as Record<string, unknown>;
      if (typeof copy.excerpt === "string" && copy.excerpt.trim() && textbookContext.includes(copy.excerpt)) delete copy.excerpt;
      return copy;
    });
  }
  return result;
}

export function unitWorkflowPrompt(base: { system: string; user: string }, flow: WorkWorkflow) {
  const protocol = flow.stage === "mode"
    ? `当前阶段：确定教学模式。只返回JSON {"options":[{"id":"模式标识","title":"模式名称","reason":"匹配理由","approach":"组织思路与实施要求"}]}，id不重复。id与title按以下映射使用：${JSON.stringify(UNIT_MODES)}。`
    : flow.stage === "plan"
    ? '当前阶段：生成单元整体设计，完成后等待教师确认。只返回JSON {"markdown":"完整整体设计正文","lessons":[{"title":"课题","lesson_type":"课型","objectives":"目标","subtask":"子任务","subquestion":"子问题","connection":"前后承接","source_paths":["教材位置"]}]}。清单与正文的课时数量、顺序一致，本次不展开课时详案。'
    : '当前阶段：按已确认的整体设计逐课生成。每次只输出本课完整Markdown，不要JSON，不重新生成整体设计。';
  if (flow.stage === "result") return {
    system: `${base.system}\n\n## 本次阶段输出要求\n${protocol}`,
    user: base.user,
  };
  const feedback = flow.feedback?.trim() ?? "";
  const edits = (flow.history ?? []).filter(item => item.action === "revise").map(item => String(item.feedback ?? ""));
  // The action RPC records this feedback in history and in flow.feedback.
  // Retain earlier chronological edits, including repeated but non-adjacent edits.
  if (feedback && edits.at(-1)?.trim() === feedback) edits.pop();
  return {
    system: `${base.system}\n\n## 本次阶段输出要求\n${protocol}`,
    user: [base.user,
      flow.selected_mode ? `## 教师已确认的教学模式\n${JSON.stringify(flow.selected_mode)}` : "",
      edits.length ? `## 历次教师修改要求\n${edits.join("\n")}` : "",
      feedback ? `## 当前阶段修改要求\n${feedback}` : "",
      flow.markdown ? `## 上一版阶段方案（按修改意见调整）\n${flow.markdown}` : "",
    ].filter(Boolean).join("\n\n"),
  };
}

// Lesson calls retain teaching needs and optional uploaded teaching materials,
// but omit the textbook/curriculum blocks already resolved in the confirmed plan.
export function unitLessonBaseUser(user: string): string {
  const title = "## 任务输入\n";
  if (!user.startsWith(title)) return user;
  const end = user.indexOf("\n\n## ", title.length);
  const input = compactUnitPromptInput(JSON.parse(user.slice(title.length, end < 0 ? undefined : end)));
  for (const key of ["textbook_content", "textbook_identity", "textbook_selections", "textbook_sources", "curriculum_sources", "curriculum_status"]) delete input[key];
  const materialTitle = "\n\n## 用户指定材料\n";
  const materialStart = user.indexOf(materialTitle);
  const materialEnd = materialStart < 0 ? -1 : user.indexOf("\n\n## 本轮追改要求\n", materialStart + materialTitle.length);
  return title + JSON.stringify(input, null, 2) + (materialStart < 0 ? "" : user.slice(materialStart, materialEnd < 0 ? undefined : materialEnd));
}
