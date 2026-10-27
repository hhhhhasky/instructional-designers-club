import UnitDesignProgress from "@/components/hai/UnitDesignProgress";
import { haiTaskTitle } from "@/lib/hai-task-title";
import HaiImagePptPage from "@/pages/HaiImagePptPage";
import {
  ArrowUp,
  ArrowUpRight,
  Plus,
  MessageSquare,
  MessageCircleMore,
  BookOpenCheck,
  ChevronDown,
  ClipboardCheck,
  Search,
  FileText,
  ImagePlus,
  LayoutTemplate,
  Loader2,
  NotebookPen,
  Paperclip,
  Sparkles,
  X,
  WandSparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import PageMeta from "@/components/common/PageMeta";
import HaiHistorySidebar, { HAI_HISTORY_ROW_CLASS, formatHistoryDate } from "@/components/hai/HaiHistorySidebar";
import HaiWorkShell from "@/components/hai/HaiWorkShell";
import HaiImageGenerationPage from "@/pages/HaiImageGenerationPage";
import UnitTextbookSelector from "@/components/hai/UnitTextbookSelector";
import PublicLessonProgress from "@/components/hai/PublicLessonProgress";
import { validateUnitSelection, type UnitBookSelection, type UnitScope } from "@/lib/hai-unit-design";
import TaskActionMenu from "@/components/hai/TaskActionMenu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  getArchivedHaiWorkTasks,
  getHaiAccessStatus,
  getHaiTextbookCatalog,
  getHaiWorkTasks,
  getHaiWorkTools,
  type HaiAccessStatus,
  type HaiFeatureModule,
  type HaiTextbookCatalogEntry,
  type HaiUsageSummary,
  type HaiWorkTask,
  type HaiWorkToolSlug,
  submitHaiWork,
  uploadHaiMaterial,
} from "@/db/hai-api";
import { getHaiImageGenerationTasks, HAI_MAX_REFERENCE_IMAGES, HAI_MAX_REFERENCE_IMAGE_BYTES, type HaiImageGenerationTask } from "@/db/hai-image-generation";
import {
  workSubjectsForStage,
} from "@/lib/hai-subject-options";
import { formatHaiTextbookGrade, formatHaiTextbookName, getHaiTextbookHierarchy, type HaiTextbookHierarchy } from "@/lib/hai-textbook-hierarchy";
import { cn } from "@/lib/utils";

export type HaiWorkToolVisualConfig = {
  name: string;
  eyebrow: string;
  description: string;
  promise: string;
  icon: React.ElementType;
  accent: string;
};

export const HAI_WORK_TOOL_CONFIG: Record<HaiWorkToolSlug, HaiWorkToolVisualConfig> = {
  "lesson-diagnosis": {
    name: "教案诊断",
    eyebrow: "阅读 · 诊断",
    description: "读取完整教案，从七个教学设计要素与四组系统关系找到最该先改的地方。",
    promise: "交付评分、证据和优先修改建议",
    icon: ClipboardCheck,
    accent: "var(--proof)",
  },
  "segment-optimization": {
    name: "环节优化",
    eyebrow: "拆解 · 改写",
    description: "聚焦课程导入、问题链、任务活动和评价反馈，诊断断点并给出可直接替换的版本。",
    promise: "交付优化稿、师生活动和学习证据",
    icon: WandSparkles,
    accent: "var(--annotation)",
  },
  "subject-lesson-design": {
    name: "公开课设计",
    eyebrow: "课题 · 学习 · 证据",
    description: "选择学段与学科；已有教材可按年级、册次、单元和课题精确读取，暂未收录的教材由教师补充，生成学习任务、课堂活动与评价证据完整对齐的公开课教案。",
    promise: "交付可追改的完整公开课教案",
    icon: NotebookPen,
    accent: "var(--am)",
  },
  "teaching-design": {
    name: "教学设计",
    eyebrow: "单元 · 逆向 · 对齐",
    description: "依据学段、学科与预期成果，用逆向设计方法生成完整单元规划：先定预期结果，再定评估证据，最后排学习活动，对齐核心素养与教-学-评一致性。",
    promise: "交付可追改的三阶段单元规划",
    icon: LayoutTemplate,
    accent: "var(--ac)",
  },
  "unit-learning-design": {
    name: "大单元教学",
    eyebrow: "重构 · 统整 · 逐课设计",
    description: "从教材与课标出发，支持单元内、教材内和跨教材重构，形成整体设计与每一课时的独立教案。",
    promise: "交付 1 份单元整体设计 + N 份课时教案",
    icon: BookOpenCheck,
    accent: "var(--proof)",
  },
  "image-generation": {
    name: "图片生成",
    eyebrow: "提示词 · 视觉 · 生成",
    description: "结合图片尺寸、PPT 艺术风格和教学图片类型，生成可直接保存、下载并继续调整的教学图片。",
    promise: "交付可追踪的教学图片与完整生成记录",
    icon: ImagePlus,
    accent: "var(--proof)",
  },
};

const workToolSummaries: Record<HaiWorkToolSlug, string> = {
  "subject-lesson-design": "从教学内容到完整公开课教案",
  "unit-learning-design": "单元整体设计与每一课时的教案",
  "lesson-diagnosis": "找到教案中最值得先改的地方",
  "segment-optimization": "改进导入、问题链、活动与评价",
  "image-generation": "生成课堂配图、概念图等教学图片",
  "teaching-design": "从目标、评价到完整的单元规划",
};

const workGrades = Array.from({ length: 12 }, (_, index) => {
  const number = index + 1;
  return { value: `${number}年级`, label: number <= 9 ? formatHaiTextbookGrade(`${number}年级`) : ["高一", "高二", "高三"][number - 10], stage: number <= 6 ? "小学" : number <= 9 ? "初中" : "高中" };
});
workGrades.push({ value: "其他", label: "其他（中职/高职/高校等）", stage: "其他（中职/高职/高校等）" });

function matchesWorkGrade(row: HaiTextbookCatalogEntry, grade: string) {
  if (row.grade_label === "高中") return ["10年级", "11年级", "12年级"].includes(grade);
  const selection = workGrades.find(item => item.value === grade);
  return formatHaiTextbookGrade(row.grade_label) === formatHaiTextbookGrade(grade) || row.grade_label === selection?.label;
}

// 当前前端只开放教师暂时最常用的四类环节；数据库中的其他 Skill 和匹配条件暂不删除。
const segmentTypes = ["课程导入", "问题链", "任务活动", "评价反馈"];
function subjectsForWorkForm(stage: string) {
  // Work 工具共用教材目录和“无目录时手填/上传”的分流。
  return workSubjectsForStage(stage);
}

export const HAI_DESIGN_TYPES = [
  { value: "backwards-design", name: "单元逆向规划", description: "先定目标→评估证据→学习活动，大概念统领单元" },
  { value: "scope-sequence", name: "学期课程序列", description: "跨年级/学段的纵向衔接与横向协调" },
  { value: "three-part-lesson", name: "三段式教案", description: "命名—辨认—回忆，适合幼小概念教学" },
  { value: "phenomenon-anchor", name: "现象驱动单元", description: "以真实现象为锚的跨学科单元" },
  { value: "interdisciplinary-connection", name: "跨学科联结", description: "为真实问题映射多学科实施方案" },
  { value: "explicit-instruction", name: "显性教学序列", description: "我示范—共练—你独立的渐进释放" },
  { value: "worked-example-fading", name: "样例渐进撤除", description: "完整样例→逐步撤除→独立练习" },
  { value: "socratic-questioning", name: "苏格拉底提问", description: "启发式提问序列发展概念理解" },
  { value: "variation-task", name: "变式理论任务", description: "对比/分离/概括/融合辨识关键特征" },
  { value: "formative-assessment-loop", name: "形成性评价闭环", description: "证据收集→即时教学调整" },
  { value: "cognitive-load-analysis", name: "认知负荷分析", description: "分析任务的内在/外在/相关负荷" },
  { value: "document-based-lesson", name: "史料探究课", description: "四阶段史料探究（历史）" },
];
const acceptedFileTypes = ".txt,.md,.markdown,.docx";
const maxFileBytes = 20 * 1024 * 1024;

export default function HaiWorkPage() {
  const { toolSlug: rawToolSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const toolSlug = isWorkToolSlug(rawToolSlug) ? rawToolSlug : null;
  const [access, setAccess] = useState<HaiAccessStatus | null>(null);
  const [usage, setUsage] = useState<HaiUsageSummary | null>(null);
  const [tools, setTools] = useState<HaiFeatureModule[]>([]);
  const [tasks, setTasks] = useState<HaiWorkTask[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<HaiWorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/login", { state: { from: toolSlug ? `/hai/work/${toolSlug}` : "/hai/work" } });
  }, [authLoading, navigate, toolSlug, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [{ access: nextAccess, usage: nextUsage }, nextTools, nextTasks, nextArchivedTasks] = await Promise.all([
          getHaiAccessStatus(),
          getHaiWorkTools(),
          getHaiWorkTasks(),
          getArchivedHaiWorkTasks(),
        ]);
        if (!cancelled) {
          setAccess(nextAccess);
          setUsage(nextUsage);
          setTools(nextTools);
          setTasks(nextTasks);
          setArchivedTasks(nextArchivedTasks);
        }
      } catch (nextError) {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : "教研工作台加载失败。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toolSlug, user]);

  const loadTasks = useCallback(async () => {
    try {
      const [nextTasks, nextArchivedTasks] = await Promise.all([
        getHaiWorkTasks(),
        getArchivedHaiWorkTasks(),
      ]);
      setTasks(nextTasks);
      setArchivedTasks(nextArchivedTasks);
    } catch {
      // 列表刷新失败不阻断,静默处理。
    }
  }, [toolSlug]);
  const enabledToolSlugs = useMemo(() => new Set(tools.map((item) => item.slug)), [tools]);
  const activeModule = toolSlug ? tools.find((item) => item.slug === toolSlug) : undefined;
  const activeConfig = toolSlug ? resolveWorkToolConfig(toolSlug, activeModule) : null;
  const pointsBlocked = usage?.quota_mode === "points" && (
    usage.can_consume === false || Number(usage.current_points ?? 0) <= 0
  );
  const sidebar = <WorkSidebar tasks={tasks} archivedTasks={archivedTasks} tools={tools} selectedToolSlug={toolSlug} onTasksChanged={loadTasks} />;

  return (
    <>
      <PageMeta title={activeConfig ? `${activeConfig.name} - HAI` : "帮你干活 - HAI"} description="HAI 教研工作台" canonicalPath={toolSlug ? `/hai/work/${toolSlug}` : "/hai/work"} />
      <HaiWorkShell
        sidebar={sidebar}
        usage={usage}
        title={activeConfig?.name ?? "帮你干活"}
        subtitle={activeConfig?.promise ?? "分析教学问题，帮你写教案、做课件"}
      >
        {loading ? (
          <WorkLoading />
        ) : error ? (
          <WorkError message={error} />
        ) : !access?.allowed ? (
          <WorkLocked reason={access?.reason} />
        ) : toolSlug ? (
          enabledToolSlugs.has(toolSlug) && !isHiddenWorkTool(toolSlug) ? (
            <WorkLanding key={location.key} tools={tools} pointsBlocked={pointsBlocked} initialTool={toolSlug} />
          ) : (
            <WorkError message="这项工作功能暂不可新建，已有任务仍可从历史任务中打开。" />
          )
        ) : (
          location.state?.imagePpt ? <HaiImagePptPage embedded /> : <WorkLanding key={location.key} tools={tools} pointsBlocked={pointsBlocked} />
        )}
      </HaiWorkShell>
    </>
  );
}

function WorkLanding({ tools, pointsBlocked, initialTool = null }: { tools: HaiFeatureModule[]; pointsBlocked: boolean; initialTool?: HaiWorkToolSlug | null }) {
  const visibleTools = getSupportedWorkTools(tools);
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<HaiWorkToolSlug | null>(initialTool);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const settingsPanel = useRef<HTMLDivElement>(null);
  const active = visibleTools.find((tool) => tool.slug === selected);
  const isImage = selected === "image-generation";
  const files = isImage ? imageFiles : documentFiles;
  const setFiles = isImage ? setImageFiles : setDocumentFiles;
  const uploadBlocked = busy || pointsBlocked || Boolean(active?.previewOnly);

  useEffect(() => {
    if (!selected) return;
    const firstField = settingsPanel.current?.querySelector("select, input:not([type=file]), textarea");
    const target = firstField?.closest("label") ?? firstField;
    target?.scrollIntoView?.({
      block: "nearest",
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "instant" : "smooth",
    });
  }, [selected]);

  function addFiles(fileList: FileList | null) {
    const next = [...files, ...Array.from(fileList ?? [])];
    const limit = isImage ? HAI_MAX_REFERENCE_IMAGES : 5;
    if (next.length > limit) { setFileError(`每个任务最多上传 ${limit} ${isImage ? "张参考图" : "份材料"}。`); return; }
    const invalid = next.find((file) => isImage
      ? !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || file.size > HAI_MAX_REFERENCE_IMAGE_BYTES || file.size === 0
      : !/\.(txt|md|markdown|docx)$/i.test(file.name) || file.size > maxFileBytes || file.size === 0);
    if (invalid) { setFileError(isImage ? "参考图支持 PNG、JPG、WEBP、GIF，每张不超过 10MB。" : "教案或教材支持 TXT、MD、DOCX，每份不超过 20MB。"); return; }
    setFileError("");
    setFiles(next);
  }

  return (
    <div className={cn("relative isolate flex min-h-full flex-col px-4 pb-10 md:px-10 md:pb-16", active ? "pt-5 md:pt-6" : "pt-10 md:pt-[clamp(2rem,9vh,5rem)]")}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_at_50%_0%,var(--proof-soft),transparent_75%)]" />
      <section className="mx-auto w-full max-w-4xl" aria-label="创建教研任务">
        <div className="mb-5 flex items-center justify-center gap-3 md:mb-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--annotation)] text-[var(--paper)]"><Sparkles aria-hidden className="h-5 w-5" /></span>
          <div>
            <p className="mb-1.5 text-xs font-bold tracking-widest text-[var(--annotation)]">HAI · 帮你干活</p>
            <h2 className="font-serif text-[23px] font-black leading-snug tracking-tight text-[var(--ink)] md:text-3xl">今天，想一起完成什么？</h2>
          </div>
        </div>
        <div role="group" aria-label="任务输入与设置" className="rounded-[28px] border border-[var(--paper-rule)] bg-[var(--paper)] p-3 shadow-[0_12px_48px_-20px_rgba(60,48,35,0.18)] transition-shadow focus-within:shadow-[0_12px_48px_-20px_rgba(60,48,35,0.28)] md:p-5">
          <label htmlFor="work-request" className="sr-only">描述你的教学需求</label>
          <textarea id="work-request" disabled={busy} value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} placeholder={isImage ? "例如：为‘水循环’设计一张课堂概念图，突出蒸发、凝结和降水的关系…" : selected === "unit-learning-design" ? "例如：围绕‘多边形的面积’设计6课时，让学生从记公式走向理解底、高与面积的关系…" : selected === "subject-lesson-design" ? "例如：设计一节《落花生》公开课，让学生理解课文如何借事物表达做人的道理…" : selected === "lesson-diagnosis" ? "上传或粘贴教案，说说你最想检查的地方，例如：课堂活动能否真正帮助学生达成目标…" : selected === "segment-optimization" ? "例如：帮我改进这节课的导入，让学生已有的认识和疑问显现出来…" : "说说你的想法，再从下方选择要做的工作…"} className="min-h-28 w-full resize-y border-0 bg-transparent px-3 py-3 text-base leading-8 text-tx outline-none placeholder:text-txt md:text-lg" />
          {files.length > 0 && <div className="mb-3 flex flex-wrap gap-2 px-2">{files.map((file, index) => <span key={`${file.name}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-[var(--paper-rule)] bg-[var(--paper-deep)] px-3 py-2 text-xs text-txs"><Paperclip className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{file.name}</span><button type="button" disabled={busy} aria-label={`移除${file.name}`} onClick={() => setFiles(files.filter((_, i) => i !== index))} className="rounded-full p-1 hover:bg-[var(--paper)]"><X className="h-3 w-3" /></button></span>)}</div>}
          <div role="group" aria-label="任务工具栏" className="flex items-start gap-2 border-t border-[var(--paper-rule)] pt-2.5">
            <button type="button" disabled={uploadBlocked} onClick={() => fileInput.current?.click()} aria-label={isImage ? "添加参考图片" : "上传教案或教材"} title={isImage ? "上传教材截图或参考图" : "上传教案或教材 · TXT、MD、DOCX"} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--paper-rule)] text-[var(--txs)] transition hover:bg-[var(--paper-deep)] disabled:cursor-not-allowed disabled:opacity-40"><Plus aria-hidden className="h-4 w-4" /></button>
            <input ref={fileInput} type="file" multiple aria-label={isImage ? "上传参考图片" : "上传补充材料"} accept={isImage ? "image/png,image/jpeg,image/webp,image/gif" : acceptedFileTypes} className="sr-only" disabled={uploadBlocked} onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = ""; }} />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1" role="group" aria-label="选择工作功能">
              {visibleTools.map(({ slug, config, previewOnly }) => {
                const Icon = config.icon;
                return <button key={slug} type="button" disabled={busy} aria-label={config.name} title={workToolSummaries[slug]} aria-describedby={`work-tool-${slug}-summary`} aria-pressed={selected === slug} aria-expanded={selected === slug} aria-controls={active ? "hai-selected-settings" : undefined} onClick={() => { setSelected(slug); setFileError(""); }} className={cn("inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border px-1.5 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--annotation)] disabled:opacity-50 sm:px-2", selected === slug ? "border-[var(--annotation)] bg-[var(--annotation-soft)] text-[var(--annotation)]" : "border-transparent text-[var(--txs)] hover:bg-[var(--paper-deep)] hover:text-[var(--ink)]")}>
                  <Icon aria-hidden className="hidden h-3.5 w-3.5 shrink-0 sm:block" />{config.name}
                  <span id={`work-tool-${slug}-summary`} className="sr-only">{workToolSummaries[slug]}</span>
                  {previewOnly && <span className="text-[10px] font-normal">本地预览</span>}
                </button>;
              })}
            </div>
            <button type="submit" form={isImage ? "hai-image-settings" : "hai-work-settings"} disabled={!active || uploadBlocked} aria-label={active ? `提交${active.config.name}任务` : "请先选择工作功能"} title="提交任务" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--annotation)] text-[var(--paper)] transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}</button>
          </div>
          {active && <div ref={settingsPanel} id="hai-selected-settings" role="region" aria-label={`${active.config.name}任务设置`} className="mt-3 rounded-2xl border border-[var(--paper-rule)] bg-[var(--paper-deep)] p-3 md:p-4">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-sm font-bold text-[var(--annotation)]">{active.config.name} · {isImage ? "图片设置" : "备课信息"}</h3>
              <p role="status" className="text-xs leading-5 text-[var(--txs)]">已选择{active.config.name}，请补充下方信息。</p>
            </div>
            {isImage ? <div className="flex flex-wrap items-center gap-2"><HaiImageGenerationPage inline={{ prompt: draft, setPrompt: setDraft, referenceFiles: imageFiles, setReferenceFiles: setImageFiles, onBusyChange: setBusy }} /></div> : <WorkToolForm key={active.slug} toolSlug={active.slug} config={active.config} pointsBlocked={pointsBlocked} previewOnly={active.previewOnly} request={draft} attachedFiles={documentFiles} onBusyChange={setBusy} />}
          </div>}
        </div>
        {fileError && <p role="alert" className="mt-3 text-sm text-red-700">{fileError}</p>}
        <p className="mt-3 text-center text-xs leading-6 text-[var(--txs)]">{active ? active.config.promise : "选择输入框内的工作功能，即可展开相关设置。"}</p>
        {visibleTools.length === 0 && <p className="mt-6 text-center text-sm text-txs">暂时没有已启用的工作功能，请稍后再来。</p>}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-[var(--txs)] lg:hidden">
          <span>还没想清楚要做什么？</span>
          <Link to="/hai/chat" className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-1 underline decoration-[var(--paper-rule)] underline-offset-4 transition-colors hover:text-[var(--annotation)]"><MessageCircleMore aria-hidden className="h-3.5 w-3.5" />先聊聊问题<ArrowUpRight aria-hidden className="h-3 w-3" /></Link>
        </div>
      </section>
    </div>
  );
}

function WorkToolForm({
  toolSlug,
  config,
  pointsBlocked,
  previewOnly = false,
  request = "",
  attachedFiles,
  onBusyChange,
}: {
  toolSlug: HaiWorkToolSlug;
  config: HaiWorkToolVisualConfig;
  pointsBlocked: boolean;
  previewOnly?: boolean;
  request?: string;
  attachedFiles: File[];
  onBusyChange?: (busy: boolean) => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState<Record<string, string>>(() => initialForm(toolSlug));
  const [unitBooks, setUnitBooks] = useState<UnitBookSelection[]>([]);
  const isUnitDesign = toolSlug === "unit-learning-design";
  const files = attachedFiles;
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [catalog, setCatalog] = useState<HaiTextbookCatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(Boolean(form.stage && form.subject));

  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);

  useEffect(() => {
    if (!form.stage || !form.subject || form.stage.startsWith("其他")) {
      setCatalog([]);
      setCatalogLoading(false);
      return;
    }
    let cancelled = false;
    setCatalog([]);
    setCatalogLoading(true);
    getHaiTextbookCatalog(form.stage, form.subject).then((items) => {
      if (!cancelled) setCatalog(items);
    }).catch((nextError) => {
      if (!cancelled) setError(nextError instanceof Error ? nextError.message : "教材目录加载失败。");
    }).finally(() => {
      if (!cancelled) setCatalogLoading(false);
    });
    return () => { cancelled = true; };
  }, [form.stage, form.subject]);

  const gradeCatalog = useMemo(
    () => catalog.filter((item) => matchesWorkGrade(item, form.grade)),
    [catalog, form.grade],
  );
  const volumeOptions = useMemo(() => unique(gradeCatalog.map((item) => item.volume)), [gradeCatalog]);
  const volumeCatalog = useMemo(
    () => gradeCatalog.filter((item) => item.volume === form.volume),
    [gradeCatalog, form.volume],
  );
  const unitOptions = useMemo(
    () => unique(volumeCatalog.map((item) => `${item.unit_label} ${item.unit_title}`)),
    [volumeCatalog],
  );
  const unitCatalog = useMemo(
    () => volumeCatalog.filter((item) => `${item.unit_label} ${item.unit_title}` === form.unit),
    [form.unit, volumeCatalog],
  );
  const topicOptions = useMemo(
    () => unique(unitCatalog.map((item) => `${item.lesson_label} ${item.lesson_title}`)),
    [unitCatalog],
  );
  const topicCatalog = useMemo(
    () => unitCatalog.filter((item) => `${item.lesson_label} ${item.lesson_title}` === form.topic),
    [form.topic, unitCatalog],
  );
  const frameOptions = useMemo(
    () => unique(topicCatalog.map((item) => `${item.frame_label} ${item.frame_title}`.trim())),
    [topicCatalog],
  );
  const hierarchyLabels = useMemo(
    () => getHaiTextbookHierarchy(form.subject, catalog),
    [catalog, form.subject],
  );
  const requiresTeacherTextbook = Boolean(form.grade && form.subject) && !catalogLoading && gradeCatalog.length === 0;

  function update(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateTextbookField(key: "grade" | "volume" | "unit" | "topic" | "frame", value: string) {
    const resetAfter: Record<typeof key, string[]> = {
      grade: ["volume", "unit", "topic", "frame"],
      volume: ["unit", "topic", "frame"],
      unit: ["topic", "frame"],
      topic: ["frame"],
      frame: [],
    };
    const nextCatalog = key === "volume"
      ? gradeCatalog.find((item) => item.volume === value)
      : key === "unit"
      ? volumeCatalog.find((item) => `${item.unit_label} ${item.unit_title}` === value)
      : key === "topic"
      ? unitCatalog.find((item) => `${item.lesson_label} ${item.lesson_title}` === value)
      : key === "frame"
      ? topicCatalog.find((item) => `${item.frame_label} ${item.frame_title}`.trim() === value)
      : undefined;
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "volume" ? {
        collection_slug: nextCatalog?.collection_slug || "",
      } : {}),
      ...(key === "unit" ? {
        collection_slug: nextCatalog?.collection_slug || current.collection_slug || "",
        unit_route_number: String(nextCatalog?.unit_route_number ?? ""),
      } : {}),
      ...(key === "topic" ? {
        collection_slug: nextCatalog?.collection_slug || current.collection_slug || "",
        unit_route_number: String(nextCatalog?.unit_route_number ?? current.unit_route_number ?? ""),
        lesson_route_number: String(nextCatalog?.lesson_route_number ?? ""),
      } : {}),
      ...(key === "frame" ? {
        collection_slug: nextCatalog?.collection_slug || current.collection_slug || "",
        unit_route_number: String(nextCatalog?.unit_route_number ?? current.unit_route_number ?? ""),
        lesson_route_number: String(nextCatalog?.lesson_route_number ?? current.lesson_route_number ?? ""),
        frame_route_number: String(nextCatalog?.frame_route_number ?? ""),
      } : {}),
      ...Object.fromEntries(resetAfter[key].map((field) => [field, ""])),
      ...(key === "grade" ? {
        collection_slug: "",
        unit_route_number: "",
        lesson_route_number: "",
        frame_route_number: "",
      } : {}),
      ...(key === "volume" ? {
        unit_route_number: "",
        lesson_route_number: "",
        frame_route_number: "",
      } : {}),
      ...(key === "unit" ? {
        lesson_route_number: "",
        frame_route_number: "",
      } : {}),
      ...(key === "topic" ? { frame_route_number: "" } : {}),
    }));
  }

  const submission = useRef<{ key: string; id: string } | null>(null);

  async function submit() {
    if (!user || busy || previewOnly) return;
    if (pointsBlocked) {
      setError("HAI 积分已用完，请购买积分后继续使用。");
      return;
    }
    const inputForm = { ...form, constraints: [request.trim(), form.constraints.trim()].filter(Boolean).join("\n\n"), desired_outcome: form.desired_outcome.trim() || request.trim(), desired_outcomes: form.desired_outcomes.trim() || request.trim() };
    const validation = catalogLoading ? "请等待教材目录加载完成。" : isUnitDesign
      ? validateUnitSelection(form.reconstruction_scope, unitBooks) || (catalogLoading ? "请等待教材目录加载完成。" : "")
      : validateForm(toolSlug, inputForm, files.length, requiresTeacherTextbook, hierarchyLabels);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const materialIds: string[] = [];
      for (const [index, file] of files.entries()) {
        setProgress(`正在解析材料 ${index + 1}/${files.length}：${file.name}`);
        const material = await uploadHaiMaterial({
          userId: user.id,
          file,
          kind: toolSlug === "subject-lesson-design" ? "course_system" : "lesson_material",
        });
        materialIds.push(material.id);
      }
      setProgress("HAI 正在创建工作任务");
      const input = isUnitDesign
        ? { ...inputForm, textbook_selections: unitBooks, topic: form.unit_theme.trim() || catalog.find((row) => row.collection_slug === unitBooks[0]?.collection_slug && row.unit_route_number === unitBooks[0]?.units[0]?.unit_number)?.unit_title || "大单元教学" }
        : toolSlug === "subject-lesson-design"
        ? {
            ...inputForm,
            teaching_mode: "",
          }
        : inputForm;
      const requestKey = JSON.stringify({ toolSlug, form: inputForm, unitBooks, files: files.map((file) => [file.name, file.size, file.lastModified]) });
      if (submission.current?.key !== requestKey) submission.current = { key: requestKey, id: crypto.randomUUID() };
      const result = await submitHaiWork({ toolSlug, input, materialIds, clientRequestId: submission.current.id });
      submission.current = null;
      navigate(`/hai/work/tasks/${result.taskId}`);

    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "任务执行失败，请重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id="hai-work-settings" aria-label={`${config.name}设置`} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      {error && <div role="alert" className="mb-5 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {previewOnly && (
        <div role="status" className="mt-5 rounded-[18px] border border-[var(--paper-rule)] bg-[var(--proof-soft)] px-4 py-3 text-sm leading-6 text-tx">
          本地界面预览：可以选择重构范围、教材和课题。正式生成服务尚未部署，生成与材料上传暂未开放。
        </div>
      )}
      {pointsBlocked && (
        <div className="mt-5 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          当前积分余额为 0。你可以浏览和填写页面，但生成、上传与提交操作已暂停。
          <Link className="ml-1 font-black text-ac underline" to="/hai/points">购买积分</Link>
        </div>
      )}

      <div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {toolSlug === "segment-optimization" && <SelectField label="要优化的环节" value={form.segment_type} options={segmentTypes} onChange={(value) => update("segment_type", value)} emphasized />}
          <SelectField label="年级" value={form.grade} options={workGrades.map(item => item.value)} optionLabel={value => workGrades.find(item => item.value === value)?.label ?? value} onChange={(value) => {
            const stage = workGrades.find(item => item.value === value)?.stage ?? "初中";
            const nextSubjects = subjectsForWorkForm(stage);
            setForm(current => {
              let subject = current.subject;
              if (stage === "高中" && subject === "道德与法治") subject = "思想政治";
              if (stage !== "高中" && subject === "思想政治" && nextSubjects.includes("道德与法治")) subject = "道德与法治";
              if (stage === "高中" && subject === "数学") subject = "高中数学 A版";
              if (stage !== "高中" && subject.startsWith("高中数学")) subject = "数学";
              return { ...current, stage, grade: value, subject: nextSubjects.includes(subject) ? subject : nextSubjects[0] || "", collection_slug: "", unit_route_number: "", lesson_route_number: "", frame_route_number: "", volume: "", unit: "", topic: "", frame: "", textbook_content: "" };
            });
            setUnitBooks([]);
            setError("");
          }} />
          <SelectField label="学科" value={form.subject} options={subjectsForWorkForm(form.stage)} onChange={(value) => {
            setUnitBooks([]);
            setForm(current => ({ ...current, subject: value, teaching_mode: "", collection_slug: "", unit_route_number: "", lesson_route_number: "", frame_route_number: "", volume: "", unit: "", topic: "", frame: "", textbook_content: "" }));
            setError("");
          }} />
          {isUnitDesign ? <>
            <UnitTextbookSelector catalog={catalog} scope={form.reconstruction_scope as UnitScope | ""} books={unitBooks} onChange={setUnitBooks} onScopeChange={(scope) => { update("reconstruction_scope", scope); setUnitBooks([]); }} />
          </> : requiresTeacherTextbook ? (
            <>
              <TextField label="册次 / 教材" value={form.volume} placeholder="填写教材名称或册次" onChange={(value) => update("volume", value)} />
              <TextField label={hierarchyLabels.top} value={form.unit} placeholder={`填写${hierarchyLabels.top}名称`} onChange={(value) => update("unit", value)} />
              <TextField label={hierarchyLabels.middle} value={form.topic} placeholder={`填写${hierarchyLabels.middle}`} onChange={(value) => update("topic", value)} />
              {hierarchyLabels.hasThirdLevel && (
                <TextField label={`${hierarchyLabels.bottom}（可选）`} value={form.frame} placeholder={`如有${hierarchyLabels.bottom}请填写`} onChange={(value) => update("frame", value)} />
              )}
            </>
          ) : (
            <>
              <SelectField label="册次 / 教材" value={form.volume} options={volumeOptions} optionLabel={(volume) => formatHaiTextbookName({ grade_label: workGrades.find(item => item.value === form.grade)?.label ?? form.grade, volume })} onChange={(value) => updateTextbookField("volume", value)} />
              <SelectField label={hierarchyLabels.top} value={form.unit} options={unitOptions} onChange={(value) => updateTextbookField("unit", value)} />
              <SelectField label={hierarchyLabels.middle} value={form.topic} options={topicOptions} onChange={(value) => updateTextbookField("topic", value)} />
              {hierarchyLabels.hasThirdLevel && (
                <SelectField label={`${hierarchyLabels.bottom}（可选；不选则读取完整二级内容）`} value={form.frame} options={frameOptions} onChange={(value) => updateTextbookField("frame", value)} />
              )}
            </>
          )}
          {toolSlug === "teaching-design" ? (
            <>
              <DesignTypeField value={form.design_type} onChange={(value) => update("design_type", value)} />
              <TextField label="课时 / 范围" value={form.unit_duration} placeholder="例如：6 课时、一学期、1 课时（45 分钟）" onChange={(value) => update("unit_duration", value)} />
            </>
          ) : null}
        </div>
        {catalogLoading && !error && (
          <p className="mt-4 text-xs text-txs">正在读取教材目录…</p>
        )}
        {requiresTeacherTextbook && !isUnitDesign && (
          <div className="mt-4 rounded-[16px] border border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
            当前年级与学科暂未收录内置教材。请填写教材信息，并通过输入框“+”上传教材文件。
          </div>
        )}
      </div>

      {["subject-lesson-design", "unit-learning-design", "teaching-design"].includes(toolSlug) && <p className="mt-3 text-xs leading-6 text-txs">
        {toolSlug === "subject-lesson-design" ? "提交后先进入“确定教什么”，确认教学重点后再推荐教学模式。" : isUnitDesign ? "提交后先推荐2—3种教学模式；确认模式与整体设计后，再逐课生成详案。" : "提交后分步确认设计，再生成完整成果。"}
        确认操作不单独扣费，完整交付时按本轮实际用量统一结算；失败或停止不扣费。
      </p>}

      {isUnitDesign && <details className="mt-3 border-t border-[var(--paper-rule)] pt-3">
        <summary className="cursor-pointer text-xs font-bold text-[var(--txs)]">了解大单元教学流程</summary>
        <section aria-label="大单元教学流程预览" className="pt-4">
          <UnitDesignProgress />
          <p className="mt-3 text-xs leading-6 text-[var(--txs)]">先比较适合所选教材的教学模式，再审阅完整整体设计。两步均由你确认；之后连续生成全部课时详案，可分份下载或打包获取。</p>
        </section>
      </details>}
      {toolSlug === "subject-lesson-design" && <section aria-label="公开课设计流程预览" className="mt-4 border-t border-[var(--paper-rule)] pt-4">
          <h4 className="mb-3 text-xs font-bold text-[var(--annotation)]">公开课设计流程</h4>
          <PublicLessonProgress />
          <p className="mt-3 text-xs leading-5 text-[var(--txs)]">先明确本课最需要促成的学生转变，再选择合适的教学模式。两个关键决定都由你确认，最后生成完整教案。</p>
      </section>}
      {busy && <p role="status" className="mt-3 text-xs text-txs">{progress || "正在执行任务…"}</p>}

    </form>
  );
}

export function WorkSidebar({ tasks, archivedTasks, onTasksChanged, imageTasks: providedImageTasks, selectedImageTaskId, onImageTaskSelected }: { tasks: HaiWorkTask[]; archivedTasks: HaiWorkTask[]; tools?: HaiFeatureModule[]; selectedToolSlug?: HaiWorkToolSlug | null; onTasksChanged?: () => void; imageTasks?: HaiImageGenerationTask[]; selectedImageTaskId?: string; onImageTaskSelected?: (taskId: string) => void }) {
  const [loadedImageTasks, setLoadedImageTasks] = useState<HaiImageGenerationTask[]>([]);
  useEffect(() => {
    if (providedImageTasks) return;
    let cancelled = false;
    getHaiImageGenerationTasks().then((items) => { if (!cancelled) setLoadedImageTasks(items); }).catch(() => { /* 图片记录暂不可用时仍显示其他历史任务。 */ });
    return () => { cancelled = true; };
  }, [providedImageTasks]);
  const imageTasks = providedImageTasks ?? loadedImageTasks;
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [showAllActive, setShowAllActive] = useState(false);
  const [search, setSearch] = useState("");
  const keyword = search.trim().toLocaleLowerCase();
  const [searchResult, setSearchResult] = useState<{ keyword: string; tasks: HaiWorkTask[]; archived: HaiWorkTask[]; images: HaiImageGenerationTask[] } | null>(null);
  const [searchPending, setSearchPending] = useState(false);
  const [searchError, setSearchError] = useState("");
  useEffect(() => {
    if (!keyword) { setSearchResult(null); setSearchPending(false); setSearchError(""); return; }
    let cancelled = false;
    setSearchPending(true);
    setSearchError("");
    const timer = setTimeout(() => {
      Promise.all([getHaiWorkTasks(undefined, keyword), getArchivedHaiWorkTasks(undefined, keyword), getHaiImageGenerationTasks(keyword)])
        .then(([foundTasks, archived, images]) => { if (!cancelled) setSearchResult({ keyword, tasks: foundTasks, archived, images }); })
        .catch(() => { if (!cancelled) setSearchError("搜索暂时失败，请稍后重试。"); })
        .finally(() => { if (!cancelled) setSearchPending(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [keyword, tasks, archivedTasks, providedImageTasks]);
  const results = searchResult?.keyword === keyword ? searchResult : null;
  const matches = (task: { title: string }) => !keyword || task.title.toLocaleLowerCase().includes(keyword);
  const history = [
    ...(results?.tasks ?? tasks).filter(matches).map((task) => ({ kind: "work" as const, task })),
    ...(results?.images ?? imageTasks).filter(matches).map((task) => ({ kind: "image" as const, task })),
  ].sort((a, b) => Date.parse(b.task.updated_at) - Date.parse(a.task.updated_at));
  const matchingArchived = (results?.archived ?? archivedTasks).filter(matches);
  const visibleHistory = keyword || showAllActive ? history : history.slice(0, 10);
  return (
    <HaiHistorySidebar title="历史任务" action={<Button asChild size="icon-sm" variant="ghost"><Link to="/hai/work" state={{ newTask: true }} aria-label="新建任务"><Plus className="h-4 w-4" /></Link></Button>}>
      <div className="relative mt-1">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-txt" />
        <input type="search" aria-label="搜索历史任务" placeholder="搜索任务名称" value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-full min-w-0 rounded-md border border-[var(--paper-rule)] bg-[var(--paper)] pl-9 pr-8 text-xs text-tx outline-none transition placeholder:text-txt focus:border-[var(--annotation)]/50 [&::-webkit-search-cancel-button]:hidden" />
        {search && <button type="button" aria-label="清空任务搜索" onClick={() => setSearch("")} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2 text-txt hover:text-tx"><X className="h-3.5 w-3.5" /></button>}
      </div>
      {keyword && <p role="status" className="mt-2 px-1 text-xs text-txt">{searchPending ? "正在搜索…" : searchError || `匹配 ${history.length + matchingArchived.length} 项任务`}</p>}
      <div className="mt-3 space-y-1">
        {visibleHistory.map((item) => item.kind === "image"
          ? <ImageTaskRow key={`image-${item.task.id}`} task={item.task} selected={item.task.id === selectedImageTaskId} onSelect={onImageTaskSelected} />
          : <TaskRow key={item.task.id} task={item.task} onTasksChanged={onTasksChanged} />)}
        {!keyword && history.length === 0 && <div className="px-3 py-8 text-center"><MessageSquare className="mx-auto h-5 w-5 text-txt" /><p className="mt-3 text-xs leading-6 text-txt">还没有历史任务<br />从右侧开始第一份教学工作</p></div>}
      </div>
      {keyword && !searchPending && !searchError && history.length + matchingArchived.length === 0 && <p className="px-3 py-6 text-center text-xs leading-6 text-txt">没有找到匹配的任务</p>}
      {!keyword && history.length > 10 && (
        <button
          type="button"
          onClick={() => setShowAllActive((open) => !open)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-ds-md px-3 py-2 text-xs font-bold text-txt transition hover:bg-[var(--paper)] hover:text-ac"
          aria-expanded={showAllActive}
        >
          {showAllActive ? "收起" : `展示全部(${history.length})`}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAllActive && "rotate-180")} />
        </button>
      )}
      {matchingArchived.length > 0 && (
        <>
          <div className="my-5 h-px bg-[var(--paper-rule)]" />
          <button
            type="button"
            onClick={() => setArchivedOpen((open) => !open)}
            disabled={Boolean(keyword)}
            className="flex w-full items-center justify-between px-1 text-left"
            aria-expanded={Boolean(keyword) || archivedOpen}
          >
            <span className="text-xs font-black tracking-[0.16em] text-txt">已归档 · {matchingArchived.length}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 text-txt transition-transform", (keyword || archivedOpen) && "rotate-180")} />
          </button>
          {(keyword || archivedOpen) && (
            <div className="mt-3 space-y-1">
              {matchingArchived.map((task) => <TaskRow key={task.id} task={task} onTasksChanged={onTasksChanged} />)}
            </div>
          )}
        </>
      )}
    </HaiHistorySidebar>
  );
}

function ImageTaskRow({ task, selected, onSelect }: { task: HaiImageGenerationTask; selected: boolean; onSelect?: (taskId: string) => void }) {
  return (
    <Link to={task.ppt_deck_id ? `/hai/work/image-generation/ppt/${task.ppt_deck_id}` : `/hai/work/image-generation/${task.id}`} onClick={onSelect && !task.ppt_deck_id ? (event) => { event.preventDefault(); onSelect(task.id); } : undefined} className={cn(`${HAI_HISTORY_ROW_CLASS} w-full min-w-0 items-center px-3 py-2.5 text-left`, selected && "bg-[var(--paper)]")}>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-xs font-semibold", selected ? "text-[var(--annotation)]" : "text-tx")}>{haiTaskTitle(task.title)}</span>
        <span className="mt-1 block text-xs text-txs">{formatHistoryDate(task.updated_at)}</span>
      </span>
    </Link>
  );
}

function TaskRow({ task, onTasksChanged }: { task: HaiWorkTask; onTasksChanged?: () => void }) {
  const { pathname } = useLocation();
  return (
    <div className={cn(HAI_HISTORY_ROW_CLASS, "relative items-center", pathname.includes(task.id) && "border-ac/30 bg-[var(--paper)]")}>
      <Link to={`/hai/work/tasks/${task.id}`} className="min-w-0 flex-1 px-3 py-2.5 pr-9">
        <p className="truncate text-xs font-semibold text-tx">{haiTaskTitle(task.title)}</p>
        <p className="mt-1 text-xs text-txs">{formatHistoryDate(task.updated_at)}</p>
      </Link>
      <TaskActionMenu
        task={task}
        onArchived={onTasksChanged}
        onUnarchived={onTasksChanged}
        onRenamed={onTasksChanged}
        onDeleted={onTasksChanged}
        triggerClassName="absolute right-0.5 top-0.5 opacity-40 transition group-hover:opacity-100 focus:opacity-100"
      />
    </div>
  );
}

function TextField({ label, value, placeholder, onChange }: FieldProps) {
  return (
    <label className="block text-xs font-bold text-txs">
      {label}
      <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 h-10 min-w-0 w-full rounded-ds-md border border-bd bg-[var(--paper)] px-3 text-sm font-normal text-tx outline-none transition focus:border-ac focus:ring-2 focus:ring-ac/10" />
    </label>
  );
}

function SelectField({ label, value, options, optionLabel, onChange, emphasized = false }: { label: string; value: string; options: readonly string[]; optionLabel?: (value: string) => string; onChange: (value: string) => void; emphasized?: boolean }) {
  return (
    <label className={cn("block text-xs font-bold", emphasized ? "text-[var(--annotation)]" : "text-[var(--txs)]")}>
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className={cn("mt-1.5 h-10 min-w-0 w-full rounded-ds-md border bg-[var(--paper)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--annotation)]", emphasized ? "border-[var(--annotation)] font-bold" : "border-[var(--paper-rule)] font-normal")}>
        <option value="">请选择</option>
        {options.map((option) => <option key={option} value={option}>{optionLabel ? optionLabel(option) : option}</option>)}
      </select>
    </label>
  );
}

function DesignTypeField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs font-bold text-txs">设计类型
    <select aria-label="设计类型" value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-10 w-full rounded-ds-md border border-bd bg-[var(--paper)] px-2 text-sm font-normal text-tx">
      <option value="">请选择</option>
      {HAI_DESIGN_TYPES.map((item) => <option key={item.value} value={item.value}>{item.name}</option>)}
    </select>
    {value && <span className="mt-1 block text-xs font-normal leading-5">{HAI_DESIGN_TYPES.find((item) => item.value === value)?.description}</span>}
  </label>;
}

type FieldProps = { label: string; value: string; placeholder: string; onChange: (value: string) => void };

function WorkLoading() {
  return <div className="flex min-h-[60vh] items-center justify-center text-sm text-txs"><Loader2 className="mr-2 h-4 w-4 animate-spin" />正在打开教研工作台</div>;
}

function WorkError({ message }: { message: string }) {
  return <div className="mx-auto max-w-xl px-5 py-20 text-center"><h2 className="font-serif text-xl font-black text-tx">工作台暂时没有打开</h2><p className="mt-3 text-sm leading-6 text-txs">{message}</p></div>;
}

function WorkLocked({ reason }: { reason?: string }) {
  return (
    <div className="mx-auto max-w-xl px-5 py-20 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-ds-xl bg-[var(--proof-soft)] text-[var(--proof)]"><ClipboardCheck className="h-6 w-6" /></div>
      <h2 className="mt-5 font-serif text-2xl font-black text-tx">HAI 暂时不可用</h2>
      <p className="mt-3 text-sm leading-6 text-txs">{reason || "请先登录，并确保账户状态正常。"}</p>
      <Button asChild className="mt-6 rounded-ds-lg bg-tl text-white hover:bg-tl/90"><Link to="/hai/chat">先去聊聊问题</Link></Button>
    </div>
  );
}

function initialForm(toolSlug: HaiWorkToolSlug) {
  return {
    stage: "初中",
    subject: "道德与法治",
    collection_slug: "",
    unit_route_number: "",
    lesson_route_number: "",
    frame_route_number: "",
    grade: "",
    volume: "",
    unit: "",
    topic: "",
    frame: "",
    teaching_mode: "",
    segment_type: "",
    current_design: "",
    desired_outcome: "",
    desired_outcomes: "",
    unit_duration: "",
    design_type: "",
    lesson_plan: "",
    textbook_content: "",
    constraints: "",
    reconstruction_scope: "",
    unit_theme: "",
    learner_context: "",
    tool_slug: toolSlug,
  };
}

function validateForm(
  toolSlug: HaiWorkToolSlug,
  form: Record<string, string>,
  fileCount: number,
  requiresTeacherTextbook = false,
  hierarchyLabels: HaiTextbookHierarchy = getHaiTextbookHierarchy(form.subject),
) {
  if (!form.stage) return "请选择学段。";
  if (!form.subject.trim()) return "请选择学科。";
  if (!form.grade) return requiresTeacherTextbook ? "请填写年级。" : "请选择年级。";
  if (!form.volume) return requiresTeacherTextbook ? "请填写册次或教材名称。" : "请选择册次。";
  if (!form.unit) return requiresTeacherTextbook ? `请填写${hierarchyLabels.top}。` : `请选择${hierarchyLabels.top}。`;
  if (!form.topic.trim()) return requiresTeacherTextbook ? `请填写${hierarchyLabels.middle}。` : `请选择${hierarchyLabels.middle}。`;
  if (!requiresTeacherTextbook) {
    if (!form.collection_slug || !form.unit_route_number || !form.lesson_route_number) return `教材目录编号缺失，请重新选择${hierarchyLabels.top}、${hierarchyLabels.middle}。`;
    if (form.frame.trim() && !form.frame_route_number) return `${hierarchyLabels.bottom}编号缺失，请重新选择${hierarchyLabels.bottom}。`;
  }
  if (toolSlug === "teaching-design") {
    if (!form.design_type) return "请选择设计类型。";
    if (!form.desired_outcomes.trim()) return "请填写预期成果或任务说明。";
    if (!form.unit_duration.trim()) return "请填写课时或范围。";
  }
  if (toolSlug === "lesson-diagnosis" && !form.lesson_plan.trim() && fileCount === 0) return "请通过输入框“+”上传教案文件。";
  if (toolSlug === "segment-optimization") {
    if (!form.segment_type) return "请选择要优化的环节。";
    if (!form.current_design.trim() && fileCount === 0) return "请通过输入框“+”上传环节设计文件。";
    if (!form.desired_outcome.trim()) return "请说明希望优化后达成的效果。";
  }
  if (requiresTeacherTextbook && !form.textbook_content.trim() && fileCount === 0) return "当前年级与学科暂无内置教材，请通过输入框“+”上传教材文件。";
  return "";
}



function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function isWorkToolSlug(value: string | undefined): value is HaiWorkToolSlug {
  return value === "unit-learning-design" || value === "lesson-diagnosis" || value === "segment-optimization" || value === "subject-lesson-design" || value === "teaching-design" || value === "image-generation";
}

export function resolveWorkToolConfig(slug: HaiWorkToolSlug, module?: HaiFeatureModule): HaiWorkToolVisualConfig {
  // 历史页面也会读取到新模块创建的任务，未知 slug 必须有可渲染的图标。
  const fallback = HAI_WORK_TOOL_CONFIG[slug] ?? {
    name: "工作任务",
    eyebrow: "我的备课记录",
    description: "查看已保存的教案、课件和教学建议。",
    promise: "查看备课记录",
    icon: FileText,
    accent: "var(--proof)",
  };
  if (slug === "subject-lesson-design") return fallback;
  return {
    ...fallback,
    name: module?.name?.trim() || fallback.name,
    description: module?.description?.trim() || fallback.description,
  };
}

// 仅撤下新建入口；模块配置和历史任务仍保留。
function isHiddenWorkTool(slug: string) {
  return slug === "teaching-design";
}

function getSupportedWorkTools(tools: HaiFeatureModule[] = []) {
  const modules = new Map(tools.filter((module) => isWorkToolSlug(module.slug)).map((module) => [module.slug, module]));
  const stableOrder: HaiWorkToolSlug[] = ["subject-lesson-design", "unit-learning-design", "lesson-diagnosis", "segment-optimization", "image-generation"];
  return stableOrder.flatMap((slug) => {
    const module = modules.get(slug);
    return module ? [{ slug, config: resolveWorkToolConfig(slug, module), previewOnly: false }] : [];
  });
}
