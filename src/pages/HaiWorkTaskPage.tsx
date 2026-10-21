import {
  Check,
  Copy,
  Download,
  FileText,
  MessageSquare,
  PanelRightOpen,
  PanelRightClose,
  FileDown,
  Loader2,
  Printer,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import MarkdownRenderer from "@/components/common/MarkdownRenderer";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import PageMeta from "@/components/common/PageMeta";
import HaiWorkShell from "@/components/hai/HaiWorkShell";
import UnitArtifactFiles from "@/components/hai/UnitArtifactFiles";
import { readUnitFiles } from "@/lib/hai-unit-design";
import TaskActionMenu from "@/components/hai/TaskActionMenu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  getArchivedHaiWorkTasks,
  getHaiWorkTaskDetail,
  getHaiWorkTasks,
  getHaiWorkTools,
  submitHaiWork,
  type HaiFeatureModule,
  type HaiWorkArtifact,
  type HaiWorkRun,
  type HaiWorkTask,
  type HaiWorkTaskDetail,
} from "@/db/hai-api";
import { WorkSidebar } from "@/pages/HaiWorkPage";
import { cn } from "@/lib/utils";

const HAI_DOC_WATERMARK = "文档来自于教学设计师俱乐部哈老师研发的 HAI 产出";

export default function HaiWorkTaskPage() {
  const { taskId = "" } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const submission = useRef<{ key: string; id: string } | null>(null);
  const observedRun = useRef<string | null>(null);
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HaiWorkTaskDetail | null>(null);
  const [tasks, setTasks] = useState<HaiWorkTask[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<HaiWorkTask[]>([]);
  const [tools, setTools] = useState<HaiFeatureModule[]>([]);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [revision, setRevision] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [optimizeConfirmOpen, setOptimizeConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [conversationShare, setConversationShare] = useState(40);
  const splitContainer = useRef<HTMLDivElement>(null);
  const splitDrag = useRef<{ cursor: string; userSelect: string } | null>(null);
  const [mobilePane, setMobilePane] = useState<"conversation" | "preview">("conversation");
  const [pendingExchange, setPendingExchange] = useState<{ instruction: string; runId: string | null } | null>(null);
  const conversationScroll = useRef<HTMLDivElement>(null);
  const previewScroll = useRef<HTMLDivElement>(null);
  const currentTaskId = useRef(taskId);
  currentTaskId.current = taskId;

  useEffect(() => {
    setDetail(null);
    setSelectedArtifactId(null);
    setSelectedFileName("");
    setRevision("");
    setError("");
    setLoading(true);
    setMobilePane("conversation");
    setPreviewOpen(false);
    setPendingExchange(null);
    setPendingRunId(null);
    setBusy(false);
    setProgress("");
    setOptimizeConfirmOpen(false);
    observedRun.current = null;
    submission.current = null;
  }, [taskId]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login", { state: { from: `/hai/work/tasks/${taskId}` } });
  }, [authLoading, navigate, taskId, user]);

  const loadDetail = useCallback(async (preserveSelection = true) => {
    if (!user || !taskId) return;
    try {
      const nextDetail = await getHaiWorkTaskDetail(taskId);
      const [nextTasks, nextTools, nextArchivedTasks] = await Promise.all([
        getHaiWorkTasks(),
        getHaiWorkTools(),
        getArchivedHaiWorkTasks(),
      ]);
      if (currentTaskId.current !== taskId) return;
      const active = nextDetail.runs.find((run) => run.status === "queued" || run.status === "running");
      const finished = observedRun.current
        ? nextDetail.artifacts.find((artifact) => artifact.run_id === observedRun.current)
        : null;
      if (active) observedRun.current = active.id;
      else if (finished) observedRun.current = null;
      if (finished || !preserveSelection) setSelectedFileName("");
      if (nextDetail.runs.some((run) => run.id === observedRun.current && run.status === "failed")) observedRun.current = null;
      setPendingRunId((current) => current && nextDetail.runs.some((run) => run.id === current && ["completed", "failed"].includes(run.status)) ? null : current);
      setDetail(nextDetail);
      setTasks(nextTasks);
      setTools(nextTools);
      setArchivedTasks(nextArchivedTasks);
      setSelectedArtifactId((current) => finished ? finished.id : preserveSelection && current
        ? current
        : nextDetail.artifacts[0]?.id ?? null);
      setError("");
    } catch (nextError) {
      if (currentTaskId.current === taskId) setError(nextError instanceof Error ? nextError.message : "任务读取失败。");
    } finally {
      if (currentTaskId.current === taskId) setLoading(false);
    }
  }, [taskId, user]);

  const reloadTaskList = useCallback(async () => {
    try {
      const [nextTasks, nextArchivedTasks] = await Promise.all([
        getHaiWorkTasks(),
        getArchivedHaiWorkTasks(),
      ]);
      setTasks(nextTasks);
      setArchivedTasks(nextArchivedTasks);
    } catch {
      // 任务列表刷新失败不阻断,详情页保持可用。
    }
  }, []);
  useEffect(() => { void loadDetail(false); }, [loadDetail]);

  const activeRun = detail?.runs.find((run) => run.status === "queued" || run.status === "running");
  useEffect(() => {
    if (!activeRun && !pendingRunId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await loadDetail();
      if (!cancelled) timer = setTimeout(() => void poll(), 3000);
    };
    timer = setTimeout(() => void poll(), 3000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [activeRun?.id, pendingRunId, loadDetail]);

  const selectedArtifact = useMemo(
    () => detail?.artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? detail?.artifacts[0] ?? null,
    [detail?.artifacts, selectedArtifactId],
  );
  const unitFiles = useMemo(() => readUnitFiles(selectedArtifact?.content_json ?? {}), [selectedArtifact]);
  const selectedFile = unitFiles.find((file) => file.filename === selectedFileName) ?? unitFiles[0];
  const displayedMarkdown = selectedFile?.markdown ?? selectedArtifact?.content_markdown ?? "";
  const displayedTitle = selectedFile?.title ?? selectedArtifact?.title ?? "";
  function openPreview(artifactId: string, filename = "") {
    setSelectedArtifactId(artifactId);
    setSelectedFileName(filename);
    setPreviewOpen(true);
    setMobilePane("preview");
  }

  function closePreview() {
    setPreviewOpen(false);
    setMobilePane("conversation");
  }

  function clampConversationShare(value: number) {
    const width = splitContainer.current?.getBoundingClientRect().width ?? 0;
    const min = width > 0 ? Math.max(20, 240 / width * 100) : 20;
    const max = width > 0 ? Math.min(75, (width - 268) / width * 100) : 75;
    return Math.round(Math.max(min, Math.min(max, value)) * 10) / 10;
  }

  function startSplitDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    splitDrag.current = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function moveSplitDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!splitDrag.current || !splitContainer.current) return;
    const bounds = splitContainer.current.getBoundingClientRect();
    setConversationShare(clampConversationShare((event.clientX - bounds.left) / bounds.width * 100));
  }

  function stopSplitDrag() {
    if (!splitDrag.current) return;
    document.body.style.cursor = splitDrag.current.cursor;
    document.body.style.userSelect = splitDrag.current.userSelect;
    splitDrag.current = null;
  }

  useEffect(() => () => stopSplitDrag(), []);
  useEffect(() => {
    const container = splitContainer.current;
    if (!previewOpen || !container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setConversationShare((current) => clampConversationShare(current)));
    observer.observe(container);
    return () => observer.disconnect();
  }, [previewOpen]);
  const selectedRun = selectedArtifact
    ? detail?.runs.find((run) => run.id === selectedArtifact.run_id) ?? null
    : detail?.runs[0] ?? null;
  const selectedArtifactKind = String(selectedArtifact?.content_json.artifact_kind ?? "");
  const isLessonPlanOptimizationArtifact = selectedArtifactKind === "lesson_plan_optimization"
    || selectedArtifact?.title.startsWith("优化教案｜") === true;
  const isDiagnosisReportArtifact = !isLessonPlanOptimizationArtifact;
  const selectedMaterialIds = Array.isArray(selectedRun?.input_snapshot.material_ids)
    ? selectedRun.input_snapshot.material_ids.map(String).filter(Boolean)
    : [];
  const canOptimizeLessonPlan = Boolean(
    detail?.task.module_slug === "lesson-diagnosis" &&
    selectedArtifact &&
    selectedRun &&
    isDiagnosisReportArtifact &&
    !isLessonPlanOptimizationArtifact &&
    (String(selectedRun.input_snapshot.lesson_plan ?? "").trim() || selectedMaterialIds.length > 0),
  );

  async function revise() {
    if (!detail || !selectedArtifact || !selectedRun || !revision.trim() || busy || activeRun || pendingRunId) return;
    await executeRun({
      run: selectedRun,
      parentArtifact: selectedArtifact,
      revisionInstruction: revision.trim(),
    });
  }

  async function optimizeLessonPlan() {
    if (!detail || !selectedArtifact || !selectedRun || busy || activeRun || pendingRunId) return;
    const lessonPlan = String(selectedRun.input_snapshot.lesson_plan ?? "").trim();
    const materialIds = Array.isArray(selectedRun.input_snapshot.material_ids)
      ? selectedRun.input_snapshot.material_ids.map(String).filter(Boolean)
      : [];
    if (!lessonPlan && materialIds.length === 0) {
      setError("这份诊断任务没有保留原始教案正文，暂时无法生成优化教案。");
      return;
    }
    await executeRun({
      run: selectedRun,
      parentArtifact: selectedArtifact,
      revisionInstruction: "诊断报告已确认无误。请基于原始教案和这份诊断报告，直接生成一份完整、可直接使用的优化后教案。不要输出诊断说明或修改清单，只输出 Markdown 教案。",
      generationMode: "lesson-plan-optimization",
    });
  }

  async function retry(run: HaiWorkRun) {
    if (!detail || busy || activeRun || pendingRunId) return;
    const parentArtifact = run.parent_artifact_id
      ? detail.artifacts.find((artifact) => artifact.id === run.parent_artifact_id) ?? null
      : null;
    await executeRun({
      run,
      parentArtifact,
      revisionInstruction: run.revision_instruction ?? "",
    });
  }

  async function executeRun({ run, parentArtifact, revisionInstruction, generationMode }: {
    run: HaiWorkRun;
    parentArtifact: HaiWorkArtifact | null;
    revisionInstruction: string;
    generationMode?: "lesson-plan-optimization";
  }) {
    if (!detail) return;
    setBusy(true);
    setError("");
    setProgress("正在创建新版本");
    setPendingExchange({ instruction: revisionInstruction || "重新执行这次任务", runId: null });
    const snapshot = { ...run.input_snapshot };
    const materialIds = Array.isArray(snapshot.material_ids) ? snapshot.material_ids.map(String) : [];
    delete snapshot.material_ids;
    // Keep the mode in the immutable run input so the server can distinguish
    // a confirmed diagnosis-to-lesson pass from ordinary version revisions.
    if (generationMode) snapshot.output_mode = generationMode;
    try {
      const payload = {
        toolSlug: detail.task.module_slug,
        input: snapshot,
        materialIds,
        taskId: detail.task.id,
        parentArtifactId: parentArtifact?.id,
        revisionInstruction: revisionInstruction || undefined,
      };
      const requestKey = JSON.stringify(payload);
      if (submission.current?.key !== requestKey) submission.current = { key: requestKey, id: crypto.randomUUID() };
      const result = await submitHaiWork({ ...payload, clientRequestId: submission.current.id });
      submission.current = null;
      if (currentTaskId.current !== detail.task.id) return;
      setPendingExchange({ instruction: revisionInstruction || "重新执行这次任务", runId: result.runId });
      observedRun.current = result.runId;
      if (result.status === "queued" || result.status === "running") setPendingRunId(result.runId);
      if (result.artifactId) setSelectedArtifactId(result.artifactId);
      setRevision("");
      await loadDetail(false);
    } catch (nextError) {
      if (currentTaskId.current !== detail.task.id) return;
      setPendingExchange(null);
      setError(nextError instanceof Error ? nextError.message : "任务执行失败。");
    } finally {
      if (currentTaskId.current === detail.task.id) {
        setBusy(false);
        setProgress("");
      }
    }
  }

  async function copyArtifact() {
    if (!selectedArtifact) return;
    await navigator.clipboard.writeText(displayedMarkdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function downloadArtifact() {
    if (!selectedArtifact) return;
    const blob = new Blob([displayedMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = selectedFile?.filename ?? `${safeFileName(selectedArtifact.title)}-v${selectedArtifact.version_number}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportDocx() {
    if (!selectedArtifact || !detail || exporting) return;
    setExporting(true);
    try {
      // 懒加载 Word 排版器:仅在真正导出时拉取,避免拖慢任务详情页首屏。
      const { renderHaiDocx } = await import("@/lib/hai-docx");
      const blob = await renderHaiDocx({
        title: displayedTitle,
        version: selectedArtifact.version_number,
        markdown: displayedMarkdown,
        watermark: HAI_DOC_WATERMARK,
        metaRight: `${detail.task.title} · v${selectedArtifact.version_number} · ${formatDateTime(detail.task.created_at)}`,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeFileName(displayedTitle)}-v${selectedArtifact.version_number}.docx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Word 已生成。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Word 生成失败,请重试。");
    } finally {
      setExporting(false);
    }
  }

  const executionBusy = busy || Boolean(activeRun) || Boolean(pendingRunId);
  const pendingMessage = pendingExchange && !detail?.runs.some((run) => run.id === pendingExchange.runId)
    ? pendingExchange.instruction : null;
  useEffect(() => {
    const panel = conversationScroll.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [detail?.task.id, detail?.runs.length, detail?.artifacts.length, pendingMessage]);
  useEffect(() => {
    if (previewScroll.current) previewScroll.current.scrollTop = 0;
  }, [selectedArtifact?.id, selectedFile?.filename]);

  return (
    <>
      <PageMeta title={detail?.task.title ?? "HAI 工作任务"} description="HAI 任务对话与作品预览" canonicalPath={`/hai/work/tasks/${taskId}`} />
      <HaiWorkShell
        sidebar={<WorkSidebar tasks={tasks} archivedTasks={archivedTasks} tools={tools} selectedToolSlug={detail?.task.module_slug} onTasksChanged={reloadTaskList} />}
        workspaceMode="proof"
        contentMode="managed"
        compactHeader
        title={detail?.task.title ?? "工作任务"}
        headerActions={detail ? <TaskActionMenu task={detail.task} onArchived={() => navigate("/hai/work")} onDeleted={() => navigate("/hai/work")} onRenamed={(title) => { setDetail((current) => current ? { ...current, task: { ...current.task, title } } : current); void reloadTaskList(); }} /> : undefined}
      >
        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center text-sm text-txs"><Loader2 className="mr-2 h-4 w-4 animate-spin" />正在读取任务档案</div>
        ) : error && !detail ? (
          <div className="mx-auto max-w-lg px-5 py-20 text-center"><h2 className="font-serif text-xl font-black">任务无法打开</h2><p className="mt-3 text-sm text-txs">{error}</p><Button asChild className="mt-6"><Link to="/hai/work">返回工作台</Link></Button></div>
        ) : detail ? (
          <>
            <div className="flex shrink-0 border-b border-[var(--paper-rule)] md:hidden print:hidden" role="tablist" aria-label="任务视图">
              <button type="button" role="tab" id="task-conversation-tab" aria-controls="task-conversation" aria-selected={mobilePane === "conversation"} onClick={() => setMobilePane("conversation")} className={cn("flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-bold", mobilePane === "conversation" ? "border-b-2 border-[var(--annotation)] text-[var(--annotation)]" : "text-txs")}><MessageSquare className="h-4 w-4" />任务对话</button>
              <button type="button" role="tab" id="task-preview-tab" aria-controls="work-preview" aria-selected={mobilePane === "preview"} disabled={!previewOpen} onClick={() => setMobilePane("preview")} className={cn("flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-bold", mobilePane === "preview" ? "border-b-2 border-[var(--annotation)] text-[var(--annotation)]" : "text-txs")}><FileText className="h-4 w-4" />作品预览</button>
            </div>
            <div ref={splitContainer} className={cn("hai-task-split grid min-h-0 flex-1 print:block print:overflow-visible", previewOpen && "hai-task-split--open")} style={{ "--hai-conversation-share": `${conversationShare}%` } as CSSProperties}>
              <section id="task-conversation" aria-label="任务对话" className={cn("min-h-0 min-w-0 flex-col bg-[var(--paper)] md:flex print:hidden", mobilePane === "conversation" ? "flex" : "hidden")}>
                <div ref={conversationScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5" role="log" aria-label="用户与 HAI 的任务记录" aria-live="polite">
                  <div className="space-y-6">
                    {[...detail.runs].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)).map((run) => {
                      const artifacts = detail.artifacts.filter((artifact) => artifact.run_id === run.id).sort((a, b) => a.version_number - b.version_number);
                      return <div key={run.id} className="space-y-4">
                        <UserTaskMessage text={run.revision_instruction || initialTaskRequest(run)} snapshot={run.revision_instruction ? undefined : run.input_snapshot} />
                        <div className="flex items-start gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--annotation-soft)] text-[var(--annotation)]"><Sparkles className="h-4 w-4" /></span>
                          <div className="min-w-0 flex-1 pt-1">
                            <p className="mb-2 text-xs font-black text-[var(--annotation)]">HAI</p>
                            {artifacts.length > 0 ? <>
                              <p className="text-sm leading-6 text-txs">这次的作品已生成，点击文档即可阅读。</p>
                              <div className="mt-3 space-y-2">{artifacts.map((artifact) => {
                                const files = readUnitFiles(artifact.content_json);
                                return <div key={artifact.id}>
                                  <a href="#work-preview" aria-label={`阅读 ${artifact.title} · v${artifact.version_number}`} aria-current={selectedArtifact?.id === artifact.id ? "true" : undefined} onClick={(event) => { event.preventDefault(); openPreview(artifact.id); }} className={cn("group flex items-center gap-3 rounded-xl border p-3 transition hover:border-[var(--annotation)] hover:bg-[var(--annotation-soft)]", selectedArtifact?.id === artifact.id ? "border-[var(--annotation)]/40 bg-[var(--annotation-soft)]/50" : "border-[var(--paper-rule)] bg-[var(--paper-deep)]")}>
                                    <FileText className="h-5 w-5 shrink-0 text-[var(--annotation)]" /><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-tx">{artifact.title}</span><span className="mt-1 block text-[10px] text-txs">版本 v{artifact.version_number} · 点击预览</span></span><PanelRightOpen className="h-4 w-4 shrink-0 text-txt" />
                                  </a>
                                  {files.length > 0 && <div className="mt-2"><UnitArtifactFiles compact files={files} selected={artifact.id === selectedArtifact?.id ? selectedFile : undefined} onSelect={(file) => openPreview(artifact.id, file.filename)} title={artifact.title} version={artifact.version_number} /></div>}
                                </div>;
                              })}</div>
                            </> : run.status === "failed" ? <div className="rounded-xl border border-red-100 bg-red-50 p-3"><p className="text-sm leading-6 text-red-700">{run.error_message || "本次任务执行失败，可以重新尝试。"}</p><Button size="sm" variant="ghost" disabled={executionBusy} onClick={() => void retry(run)} className="mt-2 text-red-700"><RotateCcw className="h-3.5 w-3.5" />重新执行</Button></div>
                              : run.status === "queued" || run.status === "running" ? <p role="status" className="flex items-start gap-2 text-sm leading-6 text-txs"><Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin" /><span>{workPhaseLabel(run)}</span></p>
                              : <p className="text-sm text-txs">这次运行尚无可预览文档。</p>}
                          </div>
                        </div>
                      </div>;
                    })}
                    {pendingMessage && <UserTaskMessage text={pendingMessage} />}
                    {(busy || pendingRunId) && !activeRun && <p role="status" className="flex items-center gap-2 text-sm text-txs"><Loader2 className="h-4 w-4 animate-spin" />{busy ? progress || "正在提交任务" : "任务已提交，正在排队"}</p>}
                    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p>}
                    {canOptimizeLessonPlan && <div className="rounded-xl border border-[var(--annotation)]/20 bg-[var(--annotation-soft)] p-4"><p className="text-sm leading-6 text-txs">确认诊断报告中的判断和证据后，可以基于原始教案继续优化。</p><Button className="mt-3 h-auto whitespace-normal rounded-lg bg-[var(--annotation)] px-3 py-2 text-xs text-white" disabled={executionBusy} onClick={() => setOptimizeConfirmOpen(true)}><Sparkles className="h-4 w-4" />确认报告无误，生成优化教案</Button></div>}
                  </div>
                </div>
                <form aria-label="任务输入" onSubmit={(event) => { event.preventDefault(); void revise(); }} className="flex shrink-0 items-end gap-2 border-t border-[var(--paper-rule)] bg-[var(--paper)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">
                  <textarea id="task-revision" aria-label="继续对话" value={revision} disabled={!selectedArtifact || executionBusy} onChange={(event) => setRevision(event.target.value)} rows={1} placeholder="继续提出修改想法…" className="h-10 min-w-0 flex-1 resize-none rounded-xl border border-[var(--paper-rule)] bg-[var(--paper-deep)] overflow-y-auto px-3 py-2 text-sm leading-5 text-tx outline-none placeholder:text-txt focus:border-[var(--annotation)]/50" />
                  <Button type="submit" size="icon" aria-label="生成新版本" disabled={!selectedArtifact || !revision.trim() || executionBusy} className="h-10 w-10 shrink-0 rounded-full bg-[var(--annotation)] text-white">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
                </form>
              </section>

              {previewOpen && <div role="separator" aria-label="调整对话与预览宽度" aria-orientation="vertical" aria-valuemin={20} aria-valuemax={75} aria-valuenow={conversationShare} aria-controls="task-conversation work-preview" tabIndex={0} onPointerDown={startSplitDrag} onPointerMove={moveSplitDrag} onPointerUp={stopSplitDrag} onPointerCancel={stopSplitDrag} onLostPointerCapture={stopSplitDrag} onDoubleClick={() => setConversationShare(clampConversationShare(40))} onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                setConversationShare((current) => clampConversationShare(event.key === "Home" ? 20 : event.key === "End" ? 75 : current + (event.key === "ArrowRight" ? 2 : -2)));
              }} className="hidden w-2 touch-none cursor-col-resize items-center justify-center border-x border-[var(--paper-rule)] bg-[var(--paper-deep)] transition-colors hover:bg-[var(--annotation-soft)] focus:bg-[var(--annotation-soft)] focus:outline-none md:flex print:hidden"><span className="h-10 w-0.5 rounded-full bg-[var(--paper-rule)]" /></div>}
              {previewOpen && <section id="work-preview" aria-label="作品预览" className={cn("min-h-0 min-w-0 flex-col border-[var(--paper-rule)] bg-[var(--paper-deep)] md:flex md:border-l print:block print:border-0 print:bg-white", mobilePane === "preview" ? "flex" : "hidden")}>
                <header className="shrink-0 border-b border-[var(--paper-rule)] bg-[var(--paper)] px-4 py-3 print:hidden">
                  <div className="flex min-w-0 items-center justify-between gap-2"><div className="min-w-0"><p className="editorial-kicker">作品预览</p><h2 className="mt-1 truncate text-sm font-bold text-tx">{displayedTitle || "等待生成文档"}</h2></div>
                    {detail.artifacts.length > 0 && <select aria-label="作品版本" value={selectedArtifact?.id ?? ""} onChange={(event) => openPreview(event.target.value)} className="max-w-28 rounded-lg border border-[var(--paper-rule)] bg-[var(--paper-deep)] px-2 py-1.5 text-xs text-txs">{detail.artifacts.map((artifact) => <option key={artifact.id} value={artifact.id}>版本 v{artifact.version_number}</option>)}</select>}
                    <Button type="button" size="icon-sm" variant="ghost" aria-label="收起作品预览" title="收起作品预览" onClick={closePreview}><PanelRightClose className="h-4 w-4" /></Button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1">
                    <Button size="icon-sm" variant="ghost" onClick={() => void copyArtifact()} disabled={!selectedArtifact} aria-label="复制产物" title="复制正文">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
                    <Button size="icon-sm" variant="ghost" onClick={downloadArtifact} disabled={!selectedArtifact} aria-label="下载 Markdown" title="下载 Markdown"><Download className="h-4 w-4" /></Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => window.print()} disabled={!selectedArtifact} aria-label="打印" title="打印"><Printer className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => void exportDocx()} disabled={!selectedArtifact || exporting} aria-label="导出 Word">{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}Word</Button>
                  </div>
                </header>
                <div ref={previewScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 md:p-5 print:overflow-visible print:p-0">
                  {selectedArtifact ? <article className="hai-work-artifact min-h-full rounded-xl border border-[var(--paper-rule)] bg-[var(--paper)] px-5 py-6 shadow-ds-xs print:rounded-none print:border-0 print:p-0 print:shadow-none">
                    <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-[var(--paper-rule)] pb-4 print:hidden"><Badge className="bg-tl text-white">版本 v{selectedArtifact.version_number}</Badge>{isLessonPlanOptimizationArtifact && <Badge className="bg-[var(--annotation)] text-white">优化教案</Badge>}<span className="text-[10px] text-txs">{selectedRun?.skill_snapshot.name || "工作技能"} · {selectedRun?.skill_snapshot.version || "v1"}</span>{selectedRun?.skill_snapshot.fallback && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">通用 Skill 模式</Badge>}</div>
                    <MarkdownRenderer content={displayedMarkdown} />
                  </article> : <div className="flex min-h-64 flex-col items-center justify-center px-5 py-12 text-center"><FileText className="h-9 w-9 text-txt" /><h2 className="mt-4 font-serif text-lg font-black text-tx">作品会显示在这里</h2><p className="mt-2 text-sm leading-6 text-txs">生成完成后，点击对话里的文档链接即可阅读。</p></div>}
                </div>
              </section>}
            </div>
            <ConfirmDialog open={optimizeConfirmOpen} onOpenChange={setOptimizeConfirmOpen} title="确认生成优化教案？" description="HAI 将以当前诊断报告和原始教案为依据生成新版本，不会覆盖已有诊断报告。生成结果可继续下载 Markdown 或导出 Word。" confirmText="确认生成" cancelText="暂不生成" variant="primary" onConfirm={optimizeLessonPlan} />
          </>
        ) : null}
      </HaiWorkShell>
    </>
  );
}

function UserTaskMessage({ text, snapshot }: { text: string; snapshot?: Record<string, unknown> }) {
  const context = snapshot ? [snapshot.stage, snapshot.subject, snapshot.grade, snapshot.topic].filter(Boolean).join(" · ") : "";
  const materialIds = snapshot && Array.isArray(snapshot.material_ids) ? snapshot.material_ids : [];
  return <div className="ml-5 flex flex-col items-end"><p className="mb-2 text-[10px] font-bold text-txt">你</p><div className="max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[var(--annotation)] px-4 py-3 text-sm leading-6 text-[var(--paper)]">{text.length > 600 ? <details><summary className="cursor-pointer">{text.slice(0, 280)}…<span className="mt-2 block text-xs opacity-80">展开完整提交内容</span></summary><p className="mt-3">{text}</p></details> : text}</div>{context && <p className="mt-2 text-right text-[10px] leading-5 text-txt">{context}</p>}{materialIds.length > 0 && <p className="mt-1 text-[10px] text-txt">已提交 {materialIds.length} 份材料</p>}</div>;
}

function initialTaskRequest(run: HaiWorkRun) {
  const input = run.input_snapshot;
  return String(input.constraints || input.desired_outcomes || input.desired_outcome || input.lesson_plan || input.current_design || input.unit_theme || input.topic || "已提交教学任务与相关设置。");
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").slice(0, 80);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function workPhaseLabel(run?: HaiWorkRun) {
  if (run?.execution_phase === "unit_overall") return "正在生成单元整体设计与课时规划";
  const lesson = run?.execution_phase?.match(/^unit_lesson_(\d+)_(\d+)$/);
  if (lesson) return `正在生成第 ${lesson[1]} / ${lesson[2]} 份课时教案`;
  if (run?.execution_phase === "repairing") return "正在重新生成内容";
  if (run?.execution_phase === "saving") return "正在保存产物";
  if (run?.status === "queued") return "任务已提交，正在排队";
  return "产物正在后台生成";
}
