import UnitDesignProgress from "@/components/hai/UnitDesignProgress";
import { useEffect, useState } from "react";
import MarkdownRenderer from "@/components/common/MarkdownRenderer";
import PublicLessonProgress from "@/components/hai/PublicLessonProgress";
import { Button } from "@/components/ui/button";
import { actOnHaiWorkflow, type HaiWorkRun, type HaiWorkToolSlug, type HaiWorkflowAction } from "@/db/hai-api";

export default function WorkWorkflowCard({ run, tool, disabled, onChanged }: {
  run: HaiWorkRun; tool: HaiWorkToolSlug; disabled?: boolean; onChanged: () => Promise<void>;
}) {
  const flow = run.workflow_state;
  const [selected, setSelected] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setSelected(""); setFeedback(""); setError(""); }, [run.id, flow?.revision, flow?.stage]);
  if (!flow) return null;
  const unit = tool === "unit-learning-design";
  const research = tool === "teaching-design";
  const lesson = tool === "subject-lesson-design";
  const focus = lesson && flow.stage === "focus";
  const choosing = focus || flow.stage === "mode";
  // Old runs have no separately confirmed teaching focus. Do not imply one happened.
  const legacyLesson = lesson && flow.version < 2 && !flow.selected_focus && !focus;
  const waiting = run.status === "waiting_confirmation";
  const active = run.status === "queued" || run.status === "running";
  const title = focus ? "确定教什么" : flow.stage === "mode" ? research ? "确认研发目标与交付范围" : unit ? "确认教学模式 · 单元组织思路" : "确定怎么教"
    : flow.stage === "plan" ? "确认整体设计" : unit ? "完成整套课时教案" : lesson ? "生成教案" : "生成结果";
  const selectionLabel = focus ? "选择本课教学重点" : research ? "选择研发目标与交付范围" : unit ? "选择单元组织思路" : "选择教学模式";
  const confirmLabel = focus ? "按这个重点推荐教学模式" : flow.stage === "mode" && (unit || research) ? "按这个思路生成整体设计" : flow.stage === "plan" ? unit ? "确认整体设计，生成全部课时教案" : "按这份设计生成完整成果" : "按这个模式生成教案";
  const feedbackPlaceholder = focus ? "例如：学生知道结论，但说不清理由，希望重点解决这一困难"
    : lesson ? "例如：选择任务挑战型，但希望材料更贴近学生生活，给独立思考留足时间"
    : "例如：减少一个课时，给独立练习留出更多时间";
  async function act(action: HaiWorkflowAction) {
    if (!flow || busy) return;
    setBusy(true); setError("");
    try {
      await actOnHaiWorkflow(run.id, flow.revision, action, selected, feedback);
      await onChanged(); setSelected(""); setFeedback("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作未完成，请刷新后重试。");
      await onChanged();
    } finally { setBusy(false); }
  }
  return <section aria-label="分步工作流" className="space-y-4 rounded-xl border border-[var(--paper-rule)] bg-[var(--paper-deep)] p-4 sm:p-5">
    {lesson ? <PublicLessonProgress current={focus ? 1 : flow.stage === "mode" ? 2 : 3} focusConfirmed={Boolean(flow.selected_focus)} modeConfirmed={Boolean(flow.selected_mode)} completed={run.status === "completed"} legacy={legacyLesson} />
      : unit ? <UnitDesignProgress current={flow.stage === "mode" ? 1 : flow.stage === "plan" ? 2 : 3} completed={run.status === "completed"} />
      : <p className="text-xs text-txs">提交需求 → 研发目标 → 方案结构 → 完整方案</p>}
    {legacyLesson && <p className="text-xs leading-5 text-txs">本任务沿用原有流程，未单独确认教学重点。</p>}
    <div className="border-t border-[var(--paper-rule)] pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold text-tx">{title}</h3>
        {waiting && <span className="rounded-full bg-[var(--proof-soft)] px-2.5 py-1 text-xs font-bold text-[var(--proof)]">等你确认</span>}
        {active && <span role="status" className="text-xs text-txs">{run.status === "queued" ? "排队中" : "正在整理"}</span>}
        {run.status === "completed" && <span className="text-xs text-txs">已完成</span>}
      </div>
      {waiting && choosing && <p className="mt-2 text-sm leading-6 text-txs">{focus ? "先选定这节课最需要促成的学生转变，再决定怎样组织教学。可以选择一个重点，也可以提出修改意见。" : lesson ? "围绕教学重点比较不同路径，选择最适合本班的方案。确认后将生成完整教案。" : "选择一个适合本次需求的方案，也可以先提出修改意见。"}</p>}
    </div>
    {lesson && flow.selected_focus && <div className="rounded-lg border border-[var(--paper-rule)] bg-[var(--paper)] p-3">
      <p className="text-xs font-bold text-txs">已确定的教学重点</p>
      <p className="mt-1 text-sm font-bold text-tx">{flow.selected_focus.title}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-txs">{flow.selected_focus.reason}</p>
      <p className="whitespace-pre-wrap text-sm leading-6 text-txs">{flow.selected_focus.approach}</p>
    </div>}
    {unit && waiting && flow.stage === "plan" && <p className="text-sm leading-6 text-txs">请重点查看内容主线、学生的学习进阶、评价和课时安排。可以先修改某个部分，也可以返回重选模式；确认后将按这份方案逐课展开。</p>}
    {flow.selected_mode && <p className="text-sm text-txs">{lesson ? "已选教学模式" : "已选"}：{flow.selected_mode.title}</p>}
    {waiting && choosing && <fieldset className="space-y-3"><legend className="sr-only">{selectionLabel}</legend>{flow.options?.map((option, index) => <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors focus-within:ring-2 focus-within:ring-[var(--proof)] ${selected === option.id ? "border-[var(--proof)] bg-[var(--proof-soft)]" : "border-[var(--paper-rule)] bg-[var(--paper)]"}`}>
      <input type="radio" name={`workflow-${run.id}`} value={option.id} checked={selected === option.id} onChange={() => setSelected(option.id)} disabled={busy || disabled} className="mt-1 accent-[var(--proof)]" />
      <span className="min-w-0 flex-1">
        <span className="mb-1 block text-xs text-txs">方案 {index + 1}</span>
        <strong className="block text-sm leading-6 text-tx">{option.title}</strong>
        <span className="mt-2 block whitespace-pre-wrap text-sm leading-6 text-txs"><span className="font-bold">{focus ? "确定依据：" : "匹配理由："}</span>{option.reason}</span>
        <span className="mt-2 block whitespace-pre-wrap text-sm leading-6 text-txs"><span className="font-bold">{focus ? "学生转变与学习表现：" : unit ? "组织思路与实施要求：" : "学习路径："}</span>{option.approach}</span>
      </span>
    </label>)}</fieldset>}
    {waiting && flow.markdown && <div className="max-h-[55vh] overflow-y-auto"><MarkdownRenderer content={flow.markdown} /></div>}
    {waiting && <>
      <label className="block text-sm">修改要求（可选）<textarea value={feedback} onChange={event => setFeedback(event.target.value)} maxLength={12000} rows={3} disabled={busy || disabled} placeholder={feedbackPlaceholder} className="mt-2 w-full rounded-lg border bg-[var(--paper)] p-3" /></label>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || disabled || Boolean(feedback.trim()) || (choosing && !selected)} onClick={() => void act("confirm")}>{confirmLabel}</Button>
        <Button variant="outline" disabled={busy || disabled || !feedback.trim()} onClick={() => void act("revise")}>修改这一步</Button>
        {flow.stage === "plan" && <Button variant="ghost" disabled={busy || disabled} onClick={() => void act("back")}>重新选择模式</Button>}
        {lesson && !legacyLesson && flow.stage === "mode" && <Button variant="ghost" disabled={busy || disabled} onClick={() => void act("back")}>返回确定教什么</Button>}
      </div>
      {feedback.trim() && <p className="text-xs text-txs">先更新这一步，查看修改结果后再确认。</p>}
    </>}
    {run.status === "failed" && <><p className="text-sm text-red-700">{run.error_message}</p><Button disabled={busy || disabled} onClick={() => void act("retry")}>从未完成处重试</Button></>}
    {(active || run.status === "failed") && !choosing && flow.selection_source !== "form" && <Button variant="outline" disabled={busy || disabled} onClick={() => void act("back")}>{lesson ? "返回确定怎么教" : "返回调整教学模式"}</Button>}
    {(waiting || active) && <Button variant="ghost" disabled={busy || disabled} onClick={() => void act("cancel")}>停止本轮</Button>}
    {flow.selection_source === "form" && <p className="text-xs text-txs">本任务沿用提交时选择的模式；如需更换，请停止本轮后从新建入口重新选择。</p>}
    {flow.history && flow.history.length > 0 && <details className="text-sm text-txs"><summary className="cursor-pointer">查看已作出的选择与修改</summary>{flow.history.map((item, index) => <div key={index} className="mt-2 border-t pt-2"><p>{item.selected_focus ? `教学重点：${item.selected_focus.title}` : item.selected_mode ? `教学模式：${item.selected_mode.title}` : "阶段修改"}{item.feedback ? `：${item.feedback}` : ""}</p>{item.markdown && <MarkdownRenderer content={item.markdown} />}</div>)}</details>}
    <p className="text-xs leading-5 text-txs">等待确认时可以关闭页面，下次回来继续。确认操作不单独扣费，完整交付时按本轮实际用量统一结算；失败或停止不扣费。</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
