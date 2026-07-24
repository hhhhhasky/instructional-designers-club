import {
  Archive,
  Check,
  ChevronLeft,
  Copy,
  Download,
  FileClock,
  Loader2,
  Printer,
  RefreshCcw,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import MarkdownRenderer from "@/components/common/MarkdownRenderer";
import PageMeta from "@/components/common/PageMeta";
import HaiWorkShell from "@/components/hai/HaiWorkShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  archiveHaiWorkTask,
  getHaiWorkTaskDetail,
  getHaiWorkTasks,
  getHaiWorkTools,
  streamHaiWork,
  type HaiFeatureModule,
  type HaiWorkArtifact,
  type HaiWorkRun,
  type HaiWorkTask,
  type HaiWorkTaskDetail,
} from "@/db/hai-api";
import { resolveWorkToolConfig, WorkSidebar } from "@/pages/HaiWorkPage";
import { cn } from "@/lib/utils";

export default function HaiWorkTaskPage() {
  const { taskId = "" } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [detail, setDetail] = useState<HaiWorkTaskDetail | null>(null);
  const [tasks, setTasks] = useState<HaiWorkTask[]>([]);
  const [tools, setTools] = useState<HaiFeatureModule[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [revision, setRevision] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login", { state: { from: `/hai/work/tasks/${taskId}` } });
  }, [authLoading, navigate, taskId, user]);

  const loadDetail = useCallback(async (preserveSelection = true) => {
    if (!user || !taskId) return;
    try {
      const [nextDetail, nextTasks, nextTools] = await Promise.all([getHaiWorkTaskDetail(taskId), getHaiWorkTasks(), getHaiWorkTools()]);
      setDetail(nextDetail);
      setTasks(nextTasks);
      setTools(nextTools);
      setSelectedArtifactId((current) => preserveSelection && current
        ? current
        : nextDetail.artifacts[0]?.id ?? null);
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "任务读取失败。");
    } finally {
      setLoading(false);
    }
  }, [taskId, user]);

  useEffect(() => { void loadDetail(false); }, [loadDetail]);

  const activeRun = detail?.runs.find((run) => run.status === "queued" || run.status === "running");
  useEffect(() => {
    if (!activeRun) return;
    const timer = window.setInterval(() => void loadDetail(), 4000);
    return () => window.clearInterval(timer);
  }, [activeRun, loadDetail]);

  const selectedArtifact = useMemo(
    () => detail?.artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? detail?.artifacts[0] ?? null,
    [detail?.artifacts, selectedArtifactId],
  );
  const selectedRun = selectedArtifact
    ? detail?.runs.find((run) => run.id === selectedArtifact.run_id) ?? null
    : detail?.runs[0] ?? null;
  const config = detail
    ? resolveWorkToolConfig(detail.task.module_slug, tools.find((item) => item.slug === detail.task.module_slug))
    : null;

  async function revise() {
    if (!detail || !selectedArtifact || !selectedRun || !revision.trim() || busy) return;
    await executeRun({
      run: selectedRun,
      parentArtifact: selectedArtifact,
      revisionInstruction: revision.trim(),
    });
  }

  async function retry(run: HaiWorkRun) {
    if (!detail || busy) return;
    const parentArtifact = run.parent_artifact_id
      ? detail.artifacts.find((artifact) => artifact.id === run.parent_artifact_id) ?? null
      : null;
    await executeRun({
      run,
      parentArtifact,
      revisionInstruction: run.revision_instruction ?? "",
    });
  }

  async function executeRun({ run, parentArtifact, revisionInstruction }: {
    run: HaiWorkRun;
    parentArtifact: HaiWorkArtifact | null;
    revisionInstruction: string;
  }) {
    if (!detail) return;
    setBusy(true);
    setError("");
    setProgress("正在创建新版本");
    const snapshot = { ...run.input_snapshot };
    const materialIds = Array.isArray(snapshot.material_ids) ? snapshot.material_ids.map(String) : [];
    delete snapshot.material_ids;
    try {
      await streamHaiWork({
        toolSlug: detail.task.module_slug,
        input: snapshot,
        materialIds,
        taskId: detail.task.id,
        parentArtifactId: parentArtifact?.id,
        revisionInstruction: revisionInstruction || undefined,
      }, {
        onEvent: (event) => {
          if (event.type === "progress") setProgress(event.message);
          if (event.type === "error") setError(event.message);
          if (event.type === "done") setSelectedArtifactId(event.artifactId);
        },
      });
      setRevision("");
      await loadDetail(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "任务执行失败。");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  async function copyArtifact() {
    if (!selectedArtifact) return;
    await navigator.clipboard.writeText(selectedArtifact.content_markdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function downloadArtifact() {
    if (!selectedArtifact) return;
    const blob = new Blob([selectedArtifact.content_markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFileName(selectedArtifact.title)}-v${selectedArtifact.version_number}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function archiveTask() {
    if (!detail || busy) return;
    await archiveHaiWorkTask(detail.task.id);
    navigate("/hai/work");
  }

  const inspector = detail ? (
    <TaskInspector
      detail={detail}
      selectedArtifactId={selectedArtifact?.id ?? null}
      onSelect={setSelectedArtifactId}
      onRetry={(run) => void retry(run)}
      busy={busy}
    />
  ) : null;

  return (
    <>
      <PageMeta title={detail?.task.title ?? "HAI 工作任务"} description="HAI 版本化任务产物" canonicalPath={`/hai/work/tasks/${taskId}`} />
      <HaiWorkShell
        sidebar={<WorkSidebar tasks={tasks} tools={tools} />}
        inspector={inspector}
        workspaceMode="proof"
        title={config?.name ?? "工作任务"}
        subtitle={detail?.task.title ?? "正在读取任务"}
      >
        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center text-sm text-txs"><Loader2 className="mr-2 h-4 w-4 animate-spin" />正在读取任务档案</div>
        ) : error && !detail ? (
          <div className="mx-auto max-w-lg px-5 py-20 text-center"><h2 className="font-serif text-xl font-black">任务无法打开</h2><p className="mt-3 text-sm text-txs">{error}</p><Button asChild className="mt-6"><Link to="/hai/work">返回工作台</Link></Button></div>
        ) : detail ? (
          <div className="min-h-full pb-[calc(6rem+env(safe-area-inset-bottom))] print:bg-white print:pb-0">
            <div className="sticky top-0 z-10 border-b border-[var(--paper-rule)] bg-[var(--paper)]/95 px-4 py-3 backdrop-blur md:px-7 print:hidden">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Button asChild size="icon-sm" variant="ghost"><Link to="/hai/work" aria-label="返回工作台"><ChevronLeft className="h-4 w-4" /></Link></Button>
                  <div className="min-w-0">
                    <h2 className="truncate font-serif text-sm font-black text-tx">{detail.task.title}</h2>
                    <p className="mt-0.5 text-[10px] text-txs">创建于 {formatDateTime(detail.task.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => void copyArtifact()} disabled={!selectedArtifact} aria-label="复制产物">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}<span className="hidden sm:inline">{copied ? "已复制" : "复制"}</span>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={downloadArtifact} disabled={!selectedArtifact} aria-label="下载 Markdown">
                    <Download className="h-4 w-4" /><span className="hidden sm:inline">Markdown</span>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => window.print()} disabled={!selectedArtifact} aria-label="打印或另存 PDF">
                    <Printer className="h-4 w-4" /><span className="hidden sm:inline">打印</span>
                  </Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => void archiveTask()} aria-label="归档任务"><Archive className="h-4 w-4" /></Button>
                </div>
              </div>
              {detail.artifacts.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 xl:hidden">
                  {detail.artifacts.map((artifact) => (
                    <button key={artifact.id} type="button" onClick={() => setSelectedArtifactId(artifact.id)} className={cn(
                      "shrink-0 rounded-full border px-3 py-1 text-xs font-bold",
                      artifact.id === selectedArtifact?.id ? "border-ac bg-ac text-white" : "border-bd bg-[var(--paper)] text-txs",
                    )}>v{artifact.version_number}</button>
                  ))}
                </div>
              )}
            </div>

            {activeRun && (
              <div className="mx-4 mt-4 flex items-center gap-3 rounded-ds-lg border border-am/30 bg-am-light px-4 py-3 text-sm text-am md:mx-7 print:hidden">
                <Loader2 className="h-4 w-4 animate-spin" />HAI 正在生成新版本，页面会自动刷新。
              </div>
            )}
            {error && <div className="mx-4 mt-4 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 md:mx-7 print:hidden">{error}</div>}

            {selectedArtifact ? (
              <article className="hai-work-artifact mx-auto max-w-4xl px-5 py-7 md:px-10 md:py-10 print:max-w-none print:p-0">
                <div className="mb-7 flex flex-wrap items-center gap-2 border-b border-[var(--paper-rule)] pb-5 print:hidden">
                  <Badge className="bg-tl text-white">版本 v{selectedArtifact.version_number}</Badge>
                  <Badge variant="outline" className="border-[var(--paper-rule)] bg-[var(--paper-deep)] text-txs">{selectedRun?.skill_snapshot.name || "工作技能"} · {selectedRun?.skill_snapshot.version || "v1"}</Badge>
                  {selectedRun?.skill_snapshot.fallback && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">通用 Skill 模式</Badge>}
                </div>
                <MarkdownRenderer content={selectedArtifact.content_markdown} />
              </article>
            ) : (
              <EmptyArtifact runs={detail.runs} busy={busy} onRetry={(run) => void retry(run)} />
            )}

            {selectedArtifact && (
              <section className="mx-4 mb-8 rounded-ds-xl border border-[var(--paper-rule)] bg-[var(--paper-deep)] p-5 md:mx-7 md:p-6 print:hidden">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-md bg-[var(--annotation)] text-white"><Sparkles className="h-4 w-4" /></span>
                  <div>
                    <h3 className="font-serif text-base font-black text-tx">基于这一版继续追改</h3>
                    <p className="mt-1 text-xs leading-5 text-txs">新要求会生成下一个版本，当前内容不会被覆盖。</p>
                  </div>
                </div>
                <textarea value={revision} onChange={(event) => setRevision(event.target.value)} rows={4} placeholder="例如：把导入压缩到 3 分钟，并增加一个能暴露学生前概念的问题。" className="mt-4 w-full resize-y rounded-ds-lg border border-bd bg-[var(--paper)] p-4 text-sm leading-6 outline-none focus:border-ac focus:ring-2 focus:ring-ac/10" />
                <div className="mt-3 flex items-center justify-end">
                  <Button className="h-11 rounded-ds-lg bg-tl px-5 text-white hover:bg-tl/90" disabled={!revision.trim() || busy} onClick={() => void revise()}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{busy ? progress || "正在生成" : "生成新版本"}
                  </Button>
                </div>
              </section>
            )}
          </div>
        ) : null}
      </HaiWorkShell>
    </>
  );
}

function TaskInspector({ detail, selectedArtifactId, onSelect, onRetry, busy }: {
  detail: HaiWorkTaskDetail;
  selectedArtifactId: string | null;
  onSelect: (id: string) => void;
  onRetry: (run: HaiWorkRun) => void;
  busy: boolean;
}) {
  const failedRuns = detail.runs.filter((run) => run.status === "failed");
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="editorial-kicker">历史版本</p>
        <FileClock className="h-4 w-4 text-txt" />
      </div>
      <div className="mt-4 space-y-2">
        {detail.artifacts.map((artifact) => {
          const run = detail.runs.find((item) => item.id === artifact.run_id);
          return (
            <button key={artifact.id} type="button" onClick={() => onSelect(artifact.id)} className={cn(
              "w-full rounded-ds-lg border p-3 text-left transition",
              selectedArtifactId === artifact.id ? "border-ac bg-[var(--paper)] shadow-ds-sm" : "border-transparent bg-[var(--paper-deep)] hover:border-[var(--paper-rule)]",
            )}>
              <div className="flex items-center justify-between gap-2"><span className="font-serif text-sm font-black text-tx">版本 v{artifact.version_number}</span><span className="text-[10px] text-txt">{formatDateTime(artifact.created_at)}</span></div>
              <p className="mt-2 truncate text-xs text-txs">{run?.revision_instruction || "首次生成"}</p>
              <p className="mt-1 text-[10px] text-txt">{run?.skill_snapshot.name || "工作技能"}</p>
            </button>
          );
        })}
      </div>
      {failedRuns.length > 0 && (
        <div className="mt-5 border-t border-[var(--paper-rule)] pt-4">
          <p className="text-[11px] font-black tracking-[0.16em] text-red-600">失败记录</p>
          {failedRuns.slice(0, 3).map((run) => (
            <div key={run.id} className="mt-2 rounded-[16px] border border-red-100 bg-red-50 p-3">
              <p className="line-clamp-2 text-xs leading-5 text-red-700">{run.error_message || "执行失败"}</p>
              <Button size="sm" variant="ghost" className="mt-2 h-7 px-2 text-red-700" disabled={busy} onClick={() => onRetry(run)}><RotateCcw className="h-3.5 w-3.5" />重试</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyArtifact({ runs, busy, onRetry }: { runs: HaiWorkRun[]; busy: boolean; onRetry: (run: HaiWorkRun) => void }) {
  const failed = runs.find((run) => run.status === "failed");
  const active = runs.find((run) => run.status === "queued" || run.status === "running");
  return (
    <div className="mx-auto max-w-lg px-5 py-20 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-ds-xl bg-[var(--annotation-soft)] text-[var(--annotation)]">{active ? <Loader2 className="h-6 w-6 animate-spin" /> : <RefreshCcw className="h-6 w-6" />}</span>
      <h2 className="mt-5 font-serif text-xl font-black text-tx">{active ? "产物正在生成" : "这次还没有形成产物"}</h2>
      <p className="mt-3 text-sm leading-6 text-txs">{active ? "你可以稍后回到这个任务，结果完成后会保存在这里。" : failed?.error_message || "可以重试上一次运行。"}</p>
      {failed && <Button className="mt-6 rounded-ds-lg bg-tl text-white hover:bg-tl/90" disabled={busy} onClick={() => onRetry(failed)}><RefreshCcw className="h-4 w-4" />重新执行</Button>}
    </div>
  );
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").slice(0, 80);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
