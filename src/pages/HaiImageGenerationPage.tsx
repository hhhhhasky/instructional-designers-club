import { ArrowDownToLine, ImagePlus, Loader2, Paperclip, Sparkles, WandSparkles, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
  downloadHaiImage,
  generateHaiImage,
  getHaiImageGenerationRuns,
  getHaiImageGenerationTasks,
  HAI_IMAGE_GENERATION_POINTS,
  HAI_MAX_REFERENCE_IMAGE_BYTES,
  HAI_MAX_REFERENCE_IMAGES,
  HAI_IMAGE_SIZES,
  HAI_IMAGE_STYLES,
  HAI_IMAGE_TYPES,
  type HaiImageGenerationRun,
  type HaiImageGenerationTask,
  type HaiImageSize,
  type HaiImageStyle,
  type HaiImageType,
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
  const [imageType, setImageType] = useState<HaiImageType>("概念图");
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [selectedReferenceRunId, setSelectedReferenceRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
    if (!value || busy || pointsBlocked) return;
    const referenceRunId = referenceFiles.length ? null : selectedReferenceRunId;
    const input: PendingImage = { prompt: value, size, style, imageType, referenceFiles, referenceRunId };
    setBusy(true);
    setError("");
    setPending(input);
    setPrompt("");
    setReferenceFiles([]);
    try {
      const response = await generateHaiImage({ prompt: value, size, style, imageType, taskId, parentRunId: runs[runs.length - 1]?.id, referenceFiles: input.referenceFiles, referenceRunIds: input.referenceRunId ? [input.referenceRunId] : [] });
      if (!response.task || !response.run) throw new Error("图片生成返回数据不完整。");
      setImageTasks((current) => [response.task as HaiImageGenerationTask, ...current.filter((task) => task.id !== response.task?.id)]);
      setRuns((current) => [...current, response.run as HaiImageGenerationRun]);
      setSelectedReferenceRunId((response.run as HaiImageGenerationRun).id);
      setPending(null);
      setUsage((current) => current ? { ...current, current_points: Math.max(0, Number(current.current_points ?? 0) - HAI_IMAGE_GENERATION_POINTS) } : current);
      navigate(`/hai/work/image-generation/${response.task.id}`);
      toast.success("图片已生成并保存到 R2。");
    } catch (nextError) {
      setPending(null);
      setReferenceFiles(input.referenceFiles);
      setError(nextError instanceof Error ? nextError.message : "图片生成失败，请重试。");
      void load();
    } finally {
      setBusy(false);
    }
  }

  async function download(run: HaiImageGenerationRun) {
    try {
      const blob = await downloadHaiImage(run.id);
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
            <h2 className="font-serif text-2xl font-black text-tx">需要 Plus 或 Pro 会员</h2>
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
                    <p className="mt-2 text-sm text-txs">每张图片消耗 {HAI_IMAGE_GENERATION_POINTS} 积分；尺寸、风格和用途可在输入框下方调整。</p>
                  </div>
                  <ImageComposer prompt={prompt} setPrompt={setPrompt} size={size} setSize={setSize} style={style} setStyle={setStyle} imageType={imageType} setImageType={setImageType} referenceFiles={referenceFiles} setReferenceFiles={setReferenceFiles} referenceRun={null} onUsePrevious={() => undefined} onClearPrevious={() => undefined} busy={busy} pointsBlocked={Boolean(pointsBlocked)} onSubmit={() => void submit()} conversation={false} />
                </div>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
                  <div className="mx-auto max-w-4xl space-y-7">
                    {runs.map((run) => <ImageConversation key={run.id} run={run} onDownload={() => void download(run)} />)}
                    {pending && <PendingConversation pending={pending} />}
                    {error && <div className="rounded-ds-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</div>}
                  </div>
                </div>
                <ImageComposer prompt={prompt} setPrompt={setPrompt} size={size} setSize={setSize} style={style} setStyle={setStyle} imageType={imageType} setImageType={setImageType} referenceFiles={referenceFiles} setReferenceFiles={setReferenceFiles} referenceRun={selectedReferenceRun} onUsePrevious={() => setSelectedReferenceRunId(runs.slice().reverse().find((run) => run.status === "completed" && run.r2_key)?.id ?? null)} onClearPrevious={() => setSelectedReferenceRunId(null)} busy={busy} pointsBlocked={Boolean(pointsBlocked)} onSubmit={() => void submit()} conversation />
              </>
            )}
          </div>
        )}
      </HaiWorkShell>
    </>
  );
}

function ImageComposer({ prompt, setPrompt, size, setSize, style, setStyle, imageType, setImageType, referenceFiles, setReferenceFiles, referenceRun, onUsePrevious, onClearPrevious, busy, pointsBlocked, onSubmit, conversation }: { prompt: string; setPrompt: (value: string) => void; size: HaiImageSize; setSize: (value: HaiImageSize) => void; style: HaiImageStyle; setStyle: (value: HaiImageStyle) => void; imageType: HaiImageType; setImageType: (value: HaiImageType) => void; referenceFiles: File[]; setReferenceFiles: (value: File[]) => void; referenceRun: HaiImageGenerationRun | null; onUsePrevious: () => void; onClearPrevious: () => void; busy: boolean; pointsBlocked: boolean; onSubmit: () => void; conversation: boolean }) {
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
          <CompactSelect label="图片尺寸" value={size} options={HAI_IMAGE_SIZES.map((item) => ({ value: item, label: sizeLabels[item] }))} onChange={(value) => setSize(value as HaiImageSize)} />
          <CompactSelect label="PPT 艺术风格" value={style} options={HAI_IMAGE_STYLES.map((item) => ({ value: item, label: item }))} onChange={(value) => setStyle(value as HaiImageStyle)} />
          <CompactSelect label="图片用途" value={imageType} options={HAI_IMAGE_TYPES.map((item) => ({ value: item, label: item }))} onChange={(value) => setImageType(value as HaiImageType)} />
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

function CompactSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return <label className="inline-flex items-center"><span className="sr-only">{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-8 max-w-[150px] rounded-ds-md border border-[var(--paper-rule)] bg-white px-2 text-xs text-txs outline-none focus:border-ac">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function PendingConversation({ pending }: { pending: PendingImage }) {
  return <><div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--annotation)] px-4 py-3 text-sm leading-6 text-white shadow-ds-sm"><p>{pending.prompt}</p><div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-white/80"><span>{sizeLabels[pending.size]}</span><span>· {pending.style}</span><span>· {pending.imageType}</span>{(pending.referenceFiles.length > 0 || pending.referenceRunId) && <span>· 参考图 {pending.referenceFiles.length || 1} 张</span>}</div></div></div><div className="flex items-center gap-3 text-sm text-txs"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--annotation-soft)] text-[var(--annotation)]"><Loader2 className="h-4 w-4 animate-spin" /></span>正在生成图片并保存到 R2…</div></>;
}

function ImageConversation({ run, onDownload }: { run: HaiImageGenerationRun; onDownload: () => void }) {
  const references = run.reference_images ?? [];
  return <div className="space-y-3"><div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--annotation)] px-4 py-3 text-sm leading-6 text-white shadow-ds-sm"><p>{run.prompt}</p><div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-white/80"><span>{sizeLabels[run.image_size]}</span><span>· {run.art_style}</span><span>· {run.image_type}</span>{references.length > 0 && <span>· 参考图 {references.length} 张</span>}</div></div></div><div className="flex items-start gap-3"><span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--annotation-soft)] text-[var(--annotation)]"><Sparkles className="h-4 w-4" /></span><div className="min-w-0 max-w-[92%]"><p className="mb-2 text-xs font-bold text-txs">{run.status === "completed" ? "HAI 已生成" : run.status === "running" || run.status === "queued" ? "正在生成" : "本轮生成失败"}</p>{run.image_url ? <div className="overflow-hidden rounded-ds-xl border border-[var(--paper-rule)] bg-white shadow-ds-sm"><GeneratedImage run={run} /><div className="flex items-center justify-between gap-3 border-t border-[var(--paper-rule)] px-3 py-2"><span className="truncate text-[11px] text-txs">已保存到 Cloudflare R2 · 图片已显示在对话区</span><Button size="sm" variant="ghost" onClick={onDownload}><ArrowDownToLine className="h-4 w-4" />下载</Button></div></div> : <div className="rounded-ds-lg border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{run.error_message || "图片生成失败，可修改提示词后继续生成。"}</div>}</div></div></div>;
}

function GeneratedImage({ run }: { run: HaiImageGenerationRun }) {
  const [source, setSource] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    setSource("");
    setLoadError("");
    void downloadHaiImage(run.id).then((blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    }).catch((nextError) => {
      if (!cancelled) setLoadError(nextError instanceof Error ? nextError.message : "图片预览加载失败。");
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [run.id]);

  if (loadError) return <div className="flex min-h-40 items-center justify-center px-4 py-8 text-sm text-red-600">{loadError}</div>;
  if (!source) return <div className="flex min-h-40 items-center justify-center px-4 py-8 text-sm text-txt">正在加载图片预览…</div>;
  return <img src={source} alt={run.prompt} className="max-h-[560px] w-full object-contain" />;
}
