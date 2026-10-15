import { ArrowDownToLine, ImagePlus, Loader2, Paperclip, Sparkles, WandSparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import PageMeta from "@/components/common/PageMeta";
import HaiWorkShell from "@/components/hai/HaiWorkShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  getHaiAccessStatus,
  getHaiWorkTools,
  type HaiFeatureModule,
  type HaiWorkToolSlug,
} from "@/db/hai-api";
import {
  acknowledgeHaiImage,
  downloadHaiImage,
  failHaiImage,
  generateHaiImage,
  getHaiImageGenerationRuns,
  getHaiImageGenerationTasks,
  HAI_IMAGE_DELIVERY_TIMEOUT_MS,
  HAI_IMAGE_FAILURE_MESSAGE,
  HAI_IMAGE_POLL_INTERVAL_MS,
  HAI_IMAGE_GENERATION_POINTS,
  HAI_IMAGE_SIZES,
  HAI_IMAGE_STYLES,
  HAI_IMAGE_SUBJECTS,
  getRecommendedImageStyles,
  imageStyleLabel,
  isImageSubject,
  HAI_IMAGE_TYPES,
  HAI_MAX_REFERENCE_IMAGE_BYTES,
  HAI_MAX_REFERENCE_IMAGES,
  type HaiImageGenerationRun,
  type HaiImageGenerationTask,
  type HaiImageSize,
  type HaiImageStyle,
  type HaiImageSubject,
  type HaiImageType,
  refreshHaiImage,
} from "@/db/hai-image-generation";
import { cn } from "@/lib/utils";
import { WorkSidebar } from "@/pages/HaiWorkPage";

const sizeLabels: Record<HaiImageSize, string> = {
  "16:9": "16:9 横屏",
  "1:1": "1:1 方形",
  "3:4": "3:4 竖屏",
  "4:3": "4:3 横屏",
  "9:16": "9:16 竖屏",
};

type PendingImage = {
  prompt: string;
  size: HaiImageSize;
  style: HaiImageStyle;
  subject: HaiImageSubject | "";
  imageType: HaiImageType;
  referenceFiles: File[];
  referenceRunId: string | null;
};

export default function HaiImageGenerationPage() {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId?: string }>();
  const { user, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<{ allowed: boolean; reason?: string } | null>(null);
  const [usage, setUsage] = useState<{ quota_mode?: string; current_points?: number; can_consume?: boolean } | null>(null);
  const [tools, setTools] = useState<HaiFeatureModule[]>([]);
  const [imageTasks, setImageTasks] = useState<HaiImageGenerationTask[]>([]);
  const [runs, setRuns] = useState<HaiImageGenerationRun[]>([]);
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<HaiImageSize>("16:9");
  const [style, setStyle] = useState<HaiImageStyle>("教育扁平插画");
  const [subject, setSubject] = useState<HaiImageSubject | "">("");
  const restoredTask = useRef<string | null>(null);
  const [imageType, setImageType] = useState<HaiImageType>("课件 PPT");
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [selectedReferenceRunId, setSelectedReferenceRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const activeSubmission = useRef("");
  const localDeadlines = useRef<Record<string, number>>({});
  const deliveredRuns = useRef(new Set<string>());
  const acknowledging = useRef(new Set<string>());
  const downloadedImages = useRef<Record<string, Blob>>({});
  const [pending, setPending] = useState<PendingImage | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login", { state: { from: taskId ? `/hai/work/image-generation/${taskId}` : "/hai/work/image-generation" } });
  }, [authLoading, navigate, taskId, user]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [{ access: nextAccess, usage: nextUsage }, nextTools, nextTasks, nextRuns] = await Promise.all([
        getHaiAccessStatus(),
        getHaiWorkTools(),
        getHaiImageGenerationTasks(),
        taskId ? getHaiImageGenerationRuns(taskId) : Promise.resolve([] as HaiImageGenerationRun[]),
      ]);
      setAccess(nextAccess);
      setUsage(nextUsage);
      setTools(nextTools);
      setImageTasks(nextTasks);
      setRuns(nextRuns);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "图片生成记录读取失败。");
    }
  }, [taskId, user]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!taskId) {
      setSelectedReferenceRunId(null);
      return;
    }
    const latest = [...runs].reverse().find((run) => run.status === "completed" && run.r2_key);
    setSelectedReferenceRunId((current) => current && runs.some((run) => run.id === current && run.status === "completed" && run.r2_key) ? current : latest?.id ?? null);
  }, [runs, taskId]);

  useEffect(() => {
    if (!taskId) { restoredTask.current = null; return; }
    if (!runs.length || restoredTask.current === taskId) return;
    restoredTask.current = taskId;
    const latest = runs[runs.length - 1];
    const savedSubject = latest.metadata?.subject;
    setSubject(typeof savedSubject === "string" && isImageSubject(savedSubject) ? savedSubject : "");
    if (HAI_IMAGE_STYLES.includes(latest.art_style)) setStyle(latest.art_style);
    if (HAI_IMAGE_SIZES.includes(latest.image_size)) setSize(latest.image_size);
    if (HAI_IMAGE_TYPES.includes(latest.image_type)) setImageType(latest.image_type);
  }, [taskId, runs]);

  function selectSubject(value: string) {
    const next = isImageSubject(value) ? value : "";
    setSubject(next);
    const recommended = getRecommendedImageStyles(next);
    if (recommended.length && !recommended.includes(style)) setStyle(recommended[0]);
  }

  const activeRunIds = runs.filter((run) => run.status === "running" || run.status === "queued").map((run) => run.id).join(",");
  const deadlineFor = (run: HaiImageGenerationRun) => run.metadata?.execution_mode === "provider_async"
    ? Number.POSITIVE_INFINITY
    : localDeadlines.current[run.id] ?? Date.parse(run.delivery_deadline_at || run.created_at) + (run.delivery_deadline_at ? 0 : HAI_IMAGE_DELIVERY_TIMEOUT_MS);
  const failRun = (runId: string, stage = "client_deadline") => {
    if (deliveredRuns.current.has(runId)) return;
    setRuns((current) => current.map((run) => run.id === runId && run.status !== "completed" ? { ...run, status: "failed", error_message: HAI_IMAGE_FAILURE_MESSAGE } : run));
    void failHaiImage(runId, stage).catch(() => undefined);
  };
  useEffect(() => {
    const timers = runs.filter((run) => ["running", "queued"].includes(run.status) && Number.isFinite(deadlineFor(run))).map((run) => setTimeout(() => failRun(run.id), Math.max(0, deadlineFor(run) - Date.now())));
    return () => timers.forEach(clearTimeout);
  }, [activeRunIds]);
  useEffect(() => {
    if (!activeRunIds || !user) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      for (const runId of activeRunIds.split(",")) {
        if (cancelled) return;
        const run = runs.find((item) => item.id === runId);
        if (!run || deliveredRuns.current.has(runId) || Date.now() >= deadlineFor(run)) continue;
        try {
          const result = await refreshHaiImage(runId, Math.min(deadlineFor(run), Date.now() + 130_000));
          if (cancelled || !result.run || deliveredRuns.current.has(runId)) continue;
          if (Date.now() >= deadlineFor(run)) { failRun(runId); continue; }
          setRuns((current) => current.map((item) => item.id === runId && item.status !== "failed" ? result.run! : item));
          const blob = downloadedImages.current[runId];
          if (blob && result.run.r2_key && result.run.status === "running") void delivered(result.run, blob);
        } catch { /* Keep the saved task; retry on the next poll. */ }
      }
      if (!cancelled) timer = setTimeout(() => void poll(), HAI_IMAGE_POLL_INTERVAL_MS);
    };
    timer = setTimeout(() => void poll(), HAI_IMAGE_POLL_INTERVAL_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [activeRunIds, user]);
  async function delivered(run: HaiImageGenerationRun, blob: Blob) {
    downloadedImages.current[run.id] = blob;
    if (run.status === "completed" || deliveredRuns.current.has(run.id) || acknowledging.current.has(run.id)) return;
    if (run.metadata?.execution_mode === "provider_async") {
      acknowledging.current.add(run.id);
      try {
        const result = await acknowledgeHaiImage(run.id);
        if (result.run) setRuns((current) => current.map((item) => item.id === run.id ? result.run! : item));
        if (result.run?.status === "completed") {
          deliveredRuns.current.add(run.id);
          void getHaiAccessStatus().then(({ usage: nextUsage }) => setUsage(nextUsage)).catch(() => undefined);
        }
      } catch { /* The next status poll retries the acknowledgement without regenerating. */ }
      finally { acknowledging.current.delete(run.id); }
      return;
    }
    if (Date.now() >= deadlineFor(run)) { failRun(run.id); return; }
    deliveredRuns.current.add(run.id);
    // Stop the user's timer at actual image load, before the acknowledgement
    // network round trip. An acknowledgement failure never hides a delivered image.
    setRuns((current) => current.map((item) => item.id === run.id ? { ...item, status: "completed" } : item));
    try {
      const result = await acknowledgeHaiImage(run.id, deadlineFor(run));
      if (result.run?.status === "completed") setRuns((current) => current.map((item) => item.id === run.id ? result.run! : item));
      void getHaiAccessStatus().then(({ usage: nextUsage }) => setUsage(nextUsage)).catch(() => undefined);
    } catch { /* Unacknowledged delivery is free; database cleanup closes it. */ }
  }

  const pointsBlocked = usage?.quota_mode === "points" && (
    usage.can_consume === false || Number(usage.current_points ?? 0) < HAI_IMAGE_GENERATION_POINTS
  );
  const conversationMode = Boolean(taskId || runs.length || pending);

  function selectTask(nextTaskId: string) {
    if (nextTaskId === taskId) {
      // Same-URL navigation does not change the route param, so the loading
      // effect will not run again. Refresh in place without clearing the
      // conversation first; otherwise clicking the same card makes the
      // workspace appear empty.
      void load();
      return;
    }
    navigate(`/hai/work/image-generation/${nextTaskId}`);
    setRuns([]);
    setPrompt("");
    setReferenceFiles([]);
    setSelectedReferenceRunId(null);
    setPending(null);
    setError("");
  }

  async function submit() {
    const value = prompt.trim();
    if (!value || busy || activeRunIds || pointsBlocked || activeSubmission.current) return;
    const submissionId = crypto.randomUUID();
    activeSubmission.current = submissionId;
    const deadlineAt = Date.now() + HAI_IMAGE_DELIVERY_TIMEOUT_MS;
    const submissionTimer = setTimeout(() => { if (activeSubmission.current !== submissionId) return; activeSubmission.current = ""; setPending(null); setBusy(false); setError(HAI_IMAGE_FAILURE_MESSAGE); }, HAI_IMAGE_DELIVERY_TIMEOUT_MS);
    const referenceRunId = referenceFiles.length ? null : selectedReferenceRunId;
    const input: PendingImage = { prompt: value, size, style, subject, imageType, referenceFiles, referenceRunId };
    setBusy(true);
    setError("");
    setPending(input);
    setPrompt("");
    setReferenceFiles([]);
    try {
      const response = await generateHaiImage({ prompt: value, size, style, subject, imageType, taskId, deadlineAt, clientRequestId: submissionId, parentRunId: runs[runs.length - 1]?.id, referenceFiles: input.referenceFiles, referenceRunIds: input.referenceRunId ? [input.referenceRunId] : [] });
      if (activeSubmission.current !== submissionId) { void load(); return; }
      if (!response.task || !response.run) throw new Error(HAI_IMAGE_FAILURE_MESSAGE);
      if (response.run.metadata?.execution_mode !== "provider_async") {
        localDeadlines.current[response.run.id] = Math.min(deadlineAt, Date.parse(response.run.delivery_deadline_at || "") || deadlineAt);
      }
      setImageTasks((current) => [response.task as HaiImageGenerationTask, ...current.filter((task) => task.id !== response.task?.id)]);
      setRuns((current) => [...current.filter((run) => run.id !== response.run?.id), response.run as HaiImageGenerationRun]);
      if (response.run.status === "completed") setSelectedReferenceRunId(response.run.id);
      setPending(null);
      void getHaiAccessStatus().then(({ usage: nextUsage }) => setUsage(nextUsage)).catch(() => undefined);
      navigate(`/hai/work/image-generation/${response.task.id}`);
      if (response.run.status === "completed") toast.success("图片已生成，可以查看和下载。");
      else if (response.run.status === "failed") setError(response.run.error_message || "本轮生成失败。");
      else toast.message("正在生成图片，请稍候。");
    } catch {
      if (activeSubmission.current !== submissionId) return;
      setPending(null);
      setReferenceFiles(input.referenceFiles);
      setError(HAI_IMAGE_FAILURE_MESSAGE);
    } finally {
      clearTimeout(submissionTimer);
      if (activeSubmission.current === submissionId) { activeSubmission.current = ""; setBusy(false); }
    }
  }

  async function download(run: HaiImageGenerationRun) {
    try {
      const blob = downloadedImages.current[run.id] ?? await downloadHaiImage(run.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `HAI-图片-${run.id.slice(0, 8)}.${blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg"}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (nextError) {
      toast.error(nextError instanceof Error ? nextError.message : "图片下载失败。");
    }
  }

  const sidebar = (
    <WorkSidebar
      tasks={[]}
      archivedTasks={[]}
      tools={tools}
      selectedToolSlug={"image-generation" as HaiWorkToolSlug}
      imageTasks={imageTasks}
      selectedImageTaskId={taskId}
      onImageTaskSelected={selectTask}
    />
  );
  const selectedReferenceRun = selectedReferenceRunId ? runs.find((run) => run.id === selectedReferenceRunId) ?? null : null;

  return (
    <>
      <PageMeta title="图片生成 - HAI" description="HAI 教研工作台图片生成" canonicalPath={taskId ? `/hai/work/image-generation/${taskId}` : "/hai/work/image-generation"} />
      <HaiWorkShell sidebar={sidebar} title="图片生成" subtitle="把教学画面变成可以直接保存、下载和继续调整的图片" workspaceMode="production">
        {!access?.allowed ? (
          <div className="mx-auto max-w-xl px-5 py-20 text-center">
            <h2 className="font-serif text-2xl font-black text-tx">HAI 暂时不可用</h2>
            <p className="mt-3 text-sm leading-6 text-txs">{access?.reason || "正在检查 HAI 使用权限。"}</p>
            <Button asChild className="mt-6 rounded-ds-lg bg-tl text-white"><a href="/hai/chat">先去聊聊问题</a></Button>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col bg-[var(--paper)]">
            {!conversationMode ? (
              <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-8 md:px-8">
                <div className="w-full max-w-3xl">
                  <div className="mb-5 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--annotation-soft)] text-[var(--annotation)]"><ImagePlus className="h-5 w-5" /></div>
                    <h2 className="mt-4 font-serif text-2xl font-black tracking-tight text-tx">描述你想生成的教学画面</h2>
                    <p className="mt-2 text-sm text-txs">每张图片消耗 {HAI_IMAGE_GENERATION_POINTS} 积分；学科可不选，选择后会推荐适合的风格。</p>
                  </div>
                  <ImageComposer prompt={prompt} setPrompt={setPrompt} size={size} setSize={setSize} style={style} setStyle={setStyle} subject={subject} setSubject={selectSubject} imageType={imageType} setImageType={setImageType} referenceFiles={referenceFiles} setReferenceFiles={setReferenceFiles} referenceRun={null} onUsePrevious={() => undefined} onClearPrevious={() => undefined} busy={busy || Boolean(activeRunIds)} pointsBlocked={Boolean(pointsBlocked)} onSubmit={() => void submit()} conversation={false} />
                </div>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
                  <div className="mx-auto max-w-4xl space-y-7">
                    {runs.map((run) => <ImageConversation key={run.id} run={run} onDownload={() => void download(run)} deadlineAt={deadlineFor(run)} onDelivered={(blob) => void delivered(run, blob)} onFailure={(stage) => failRun(run.id, stage)} />)}
                    {pending && <PendingConversation pending={pending} />}
                    {error && <div className="rounded-ds-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</div>}
                  </div>
                </div>
                <ImageComposer prompt={prompt} setPrompt={setPrompt} size={size} setSize={setSize} style={style} setStyle={setStyle} subject={subject} setSubject={selectSubject} imageType={imageType} setImageType={setImageType} referenceFiles={referenceFiles} setReferenceFiles={setReferenceFiles} referenceRun={selectedReferenceRun} onUsePrevious={() => setSelectedReferenceRunId(runs.slice().reverse().find((run) => run.status === "completed" && run.r2_key)?.id ?? null)} onClearPrevious={() => setSelectedReferenceRunId(null)} busy={busy || Boolean(activeRunIds)} pointsBlocked={Boolean(pointsBlocked)} onSubmit={() => void submit()} conversation />
              </>
            )}
          </div>
        )}
      </HaiWorkShell>
    </>
  );
}

function ImageComposer({ prompt, setPrompt, size, setSize, style, setStyle, subject, setSubject, imageType, setImageType, referenceFiles, setReferenceFiles, referenceRun, onUsePrevious, onClearPrevious, busy, pointsBlocked, onSubmit, conversation }: { prompt: string; setPrompt: (value: string) => void; size: HaiImageSize; setSize: (value: HaiImageSize) => void; style: HaiImageStyle; setStyle: (value: HaiImageStyle) => void; subject: HaiImageSubject | ""; setSubject: (value: string) => void; imageType: HaiImageType; setImageType: (value: HaiImageType) => void; referenceFiles: File[]; setReferenceFiles: (value: File[]) => void; referenceRun: HaiImageGenerationRun | null; onUsePrevious: () => void; onClearPrevious: () => void; busy: boolean; pointsBlocked: boolean; onSubmit: () => void; conversation: boolean }) {
  const recommendedStyles = getRecommendedImageStyles(subject);
  const styleOption = (value: HaiImageStyle) => <option key={value} value={value}>{imageStyleLabel(value)}</option>;
  function selectReferenceFiles(fileList: FileList | null) {
    const selected = Array.from(fileList ?? []);
    if (selected.length > HAI_MAX_REFERENCE_IMAGES || referenceFiles.length + selected.length > HAI_MAX_REFERENCE_IMAGES) {
      toast.error(`最多只能上传 ${HAI_MAX_REFERENCE_IMAGES} 张参考图片。`);
      return;
    }
    const invalid = selected.find((file) => !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || file.size <= 0 || file.size > HAI_MAX_REFERENCE_IMAGE_BYTES);
    if (invalid) {
      toast.error(`参考图片需为 PNG、JPG、WEBP 或 GIF，且每张不超过 10MB。`);
      return;
    }
    if (referenceRun) onClearPrevious();
    setReferenceFiles([...referenceFiles, ...selected]);
  }
  return (
    <div className={cn("bg-white", conversation ? "shrink-0 border-t border-[var(--paper-rule)] px-4 py-3 md:px-8" : "rounded-ds-xl border border-[var(--paper-rule)] p-3 shadow-ds-lg")}>
      <div className="mx-auto max-w-4xl">
        <textarea aria-label="图片提示词" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={conversation ? 2 : 3} placeholder={conversation ? "继续描述你想怎么调整下一张图…" : "例如：一张展示‘水循环’的课堂概念图，突出蒸发、凝结和降水之间的关系。"} className="w-full resize-none bg-white px-2 py-2 text-sm leading-6 text-tx outline-none placeholder:text-txt" />
        {(referenceFiles.length > 0 || referenceRun) && <div className="mb-2 flex flex-wrap items-center gap-2">{referenceFiles.length > 0 && <ReferenceFileStrip files={referenceFiles} onRemove={(index) => setReferenceFiles(referenceFiles.filter((_, current) => current !== index))} />}{referenceRun && <span className="inline-flex items-center gap-1.5 rounded-ds-md border border-[var(--annotation)]/30 bg-[var(--annotation-soft)] px-2 py-1 text-xs text-tl">已选择上一张生成图用于微调<button type="button" aria-label="取消上一张图参考" onClick={onClearPrevious} className="rounded-full p-0.5 hover:bg-white"><X className="h-3 w-3" /></button></span>}</div>}
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--paper-rule)] pt-2">
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-ds-md border border-[var(--paper-rule)] bg-white px-2 text-xs text-txs hover:border-ac"><Paperclip className="h-3.5 w-3.5" />参考图片<input aria-label="上传参考图片" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="sr-only" disabled={busy} onChange={(event) => { selectReferenceFiles(event.target.files); event.currentTarget.value = ""; }} /></label>
          {conversation && !referenceRun && <button type="button" disabled={busy} onClick={onUsePrevious} className="inline-flex h-8 items-center gap-1.5 rounded-ds-md border border-[var(--paper-rule)] bg-white px-2 text-xs text-txs hover:border-ac disabled:cursor-not-allowed disabled:opacity-50">沿用上一张图微调</button>}
          <span className="text-[11px] text-txt">最多 {HAI_MAX_REFERENCE_IMAGES} 张</span>
          <CompactSelect label="图片尺寸" value={size} options={HAI_IMAGE_SIZES.map((item) => ({ value: item, label: sizeLabels[item] }))} onChange={(value) => setSize(value as HaiImageSize)} disabled={busy} />
          <CompactSelect label="学科" value={subject} options={[{ value: "", label: "学科（选填）" }, ...HAI_IMAGE_SUBJECTS.map((item) => ({ value: item, label: item }))]} onChange={setSubject} disabled={busy} />
          <label className="inline-flex items-center">
            <span className="sr-only">风格</span>
            <select aria-label="风格" value={style} onChange={(event) => setStyle(event.target.value as HaiImageStyle)} disabled={busy} className="h-8 max-w-[170px] rounded-ds-md border border-[var(--paper-rule)] bg-white px-2 text-xs text-txs outline-none focus:border-ac disabled:opacity-50">
              {recommendedStyles.length > 0 ? <><optgroup label={`${subject}推荐`}>{recommendedStyles.map(styleOption)}</optgroup><optgroup label="其他风格（可跨学科使用）">{HAI_IMAGE_STYLES.filter((item) => !recommendedStyles.includes(item)).map(styleOption)}</optgroup></> : <><optgroup label="通用风格">{HAI_IMAGE_STYLES.slice(0, 14).map(styleOption)}</optgroup><optgroup label="教学主题风格">{HAI_IMAGE_STYLES.slice(14).map(styleOption)}</optgroup></>}
            </select>
          </label>
          <CompactSelect label="生成图类型" value={imageType} options={HAI_IMAGE_TYPES.map((item) => ({ value: item, label: item }))} onChange={(value) => setImageType(value as HaiImageType)} disabled={busy} />
          <span className="ml-auto text-xs text-txs">{HAI_IMAGE_GENERATION_POINTS} 积分/张</span>
          <Button className="h-9 rounded-ds-lg bg-tl px-4 text-white hover:bg-tl/90" disabled={!prompt.trim() || busy || pointsBlocked} onClick={onSubmit}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}{pointsBlocked ? "积分不足" : busy ? "生成中" : "生成图片"}</Button>
        </div>
      </div>
    </div>
  );
}

function ReferenceFileStrip({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  return <div className="mb-2 flex flex-wrap gap-2">{files.map((file, index) => <ReferenceFilePreview key={`${file.name}-${file.size}-${index}`} file={file} onRemove={() => onRemove(index)} />)}</div>;
}

function ReferenceFilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSource(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <div className="relative h-14 w-14 overflow-hidden rounded-ds-md border border-[var(--paper-rule)] bg-[var(--paper)]"><img src={source} alt={file.name} className="h-full w-full object-cover" /><button type="button" aria-label={`移除${file.name}`} onClick={onRemove} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"><X className="h-3 w-3" /></button></div>;
}

function CompactSelect({ label, value, options, onChange, disabled }: { disabled?: boolean; label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return <label className="inline-flex items-center"><span className="sr-only">{label}</span><select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="h-8 max-w-[150px] rounded-ds-md border border-[var(--paper-rule)] bg-white px-2 text-xs text-txs outline-none focus:border-ac">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function PendingConversation({ pending }: { pending: PendingImage }) {
  return <><div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--annotation)] px-4 py-3 text-sm leading-6 text-white shadow-ds-sm"><p>{pending.prompt}</p><div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-white/80"><span>{sizeLabels[pending.size]}</span>{pending.subject && <span>· {pending.subject}</span>}<span>· {imageStyleLabel(pending.style)}</span><span>· {pending.imageType}</span>{(pending.referenceFiles.length > 0 || pending.referenceRunId) && <span>· 参考图 {pending.referenceFiles.length || 1} 张</span>}</div></div></div><div className="flex items-center gap-3 text-sm text-txs"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--annotation-soft)] text-[var(--annotation)]"><Loader2 className="h-4 w-4 animate-spin" /></span>正在提交图片任务…</div></>;
}

function ImageConversation({ run, onDownload, deadlineAt, onDelivered, onFailure }: { run: HaiImageGenerationRun; onDownload: () => void; deadlineAt: number; onDelivered: (blob: Blob) => void; onFailure: (stage: string) => void }) {
  const active = ["running", "queued"].includes(run.status);
  const ready = Boolean(run.r2_key && run.image_url && run.status !== "failed");
  return <div className="space-y-3">
    <div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--annotation)] px-4 py-3 text-sm leading-6 text-white shadow-ds-sm"><p>{run.prompt}</p><div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-white/80"><span>{sizeLabels[run.image_size]}</span>{typeof run.metadata?.subject === "string" && run.metadata.subject && <span>· {run.metadata.subject}</span>}<span>· {imageStyleLabel(run.art_style)}</span><span>· {run.image_type}</span>{run.reference_images?.length > 0 && <span>· 参考图 {run.reference_images.length} 张</span>}</div></div></div>
    <div className="flex items-start gap-3"><span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--annotation-soft)] text-[var(--annotation)]"><Sparkles className="h-4 w-4" /></span><div className="min-w-0 max-w-[92%]"><p className="mb-2 text-xs font-bold text-txs">{run.status === "completed" ? "HAI 已生成" : active ? "正在生成" : "本轮生成失败"}</p>
      {ready ? <div className="overflow-hidden rounded-ds-xl border border-[var(--paper-rule)] bg-white shadow-ds-sm"><GeneratedImage run={run} deadlineAt={deadlineAt} onDelivered={onDelivered} onFailure={onFailure} />{run.status === "completed" && <div className="flex items-center justify-between gap-3 border-t border-[var(--paper-rule)] px-3 py-2"><span className="truncate text-[11px] text-txs">{!run.delivery_deadline_at || run.delivered_at ? "图片已保存，可随时查看和下载" : "图片已加载，可下载"}</span><Button size="sm" variant="ghost" onClick={onDownload}><ArrowDownToLine className="h-4 w-4" />下载</Button></div>}</div>
      : active ? <div className="rounded-ds-lg border border-[var(--paper-rule)] bg-white px-4 py-3 text-sm leading-6 text-txs">正在生成图片，每 10 秒自动查询；离开后可从任务记录继续取回。</div>
      : <div className="rounded-ds-lg border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{HAI_IMAGE_FAILURE_MESSAGE}</div>}
    </div></div>
  </div>;
}

function GeneratedImage({ run, deadlineAt, onDelivered, onFailure }: { run: HaiImageGenerationRun; deadlineAt: number; onDelivered: (blob: Blob) => void; onFailure: (stage: string) => void }) {
  const [source, setSource] = useState("");
  const downloadedBlob = useRef<Blob | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const callbacks = useRef({ onDelivered, onFailure }); callbacks.current = { onDelivered, onFailure };
  useEffect(() => {
    let cancelled = false, objectUrl = "";
    setSource(""); setLoadError("");
    void downloadHaiImage(run.id, run.status === "completed" || !Number.isFinite(deadlineAt) ? undefined : deadlineAt).then((blob) => {
      if (cancelled) return;
      downloadedBlob.current = blob; objectUrl = URL.createObjectURL(blob); setSource(objectUrl);
    }).catch(() => {
      if (!cancelled) {
        if (run.status !== "completed" && Number.isFinite(deadlineAt)) callbacks.current.onFailure("image_download");
        else setLoadError("图片加载失败，请重新加载。");
      }
    });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [run.id, attempt]);
  if (loadError) return <div className="flex min-h-40 items-center justify-center px-4 py-8 text-sm text-red-600"><div><p>{loadError}</p><Button variant="ghost" onClick={() => setAttempt((value) => value + 1)}>重新加载图片</Button></div></div>;
  if (!source) return <div className="flex min-h-40 items-center justify-center px-4 py-8 text-sm text-txt">正在加载图片预览…</div>;
  return <img src={source} alt={run.prompt} onLoad={() => { if (downloadedBlob.current) callbacks.current.onDelivered(downloadedBlob.current); }} onError={() => run.status !== "completed" && Number.isFinite(deadlineAt) ? callbacks.current.onFailure("image_decode") : setLoadError("图片加载失败，请重新加载。")} className="max-h-[560px] w-full object-contain" />;
}
