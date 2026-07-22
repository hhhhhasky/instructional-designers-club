import {
  ArrowRight,
  BookOpenCheck,
  ClipboardCheck,
  Clock3,
  FileText,
  Loader2,
  NotebookPen,
  Paperclip,
  Sparkles,
  UploadCloud,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageMeta from "@/components/common/PageMeta";
import HaiWorkShell from "@/components/hai/HaiWorkShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  getHaiAccessStatus,
  getHaiTextbookCatalog,
  getHaiWorkTasks,
  getHaiWorkTools,
  streamHaiWork,
  uploadHaiMaterial,
  type HaiAccessStatus,
  type HaiFeatureModule,
  type HaiTextbookCatalogEntry,
  type HaiWorkTask,
  type HaiWorkToolSlug,
} from "@/db/hai-api";

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
    accent: "#b56238",
  },
  "segment-optimization": {
    name: "环节优化",
    eyebrow: "拆解 · 改写",
    description: "聚焦导入、探究、练习、评价等单个环节，诊断断点并给出可直接替换的版本。",
    promise: "交付优化稿、师生活动和学习证据",
    icon: WandSparkles,
    accent: "#2f6255",
  },
  "subject-lesson-design": {
    name: "思政公开课设计",
    eyebrow: "议题 · 价值 · 证据",
    description: "按年级、册次、单元、课题和框题精确读取内置教材知识，再匹配思政 Skill，形成价值议题、学习任务、课堂活动与评价证据的完整闭环。",
    promise: "交付可追改的思政公开课完整教案",
    icon: NotebookPen,
    accent: "#4d567a",
  },
};

const stages = ["小学", "初中", "高中", "中职", "高职", "高校", "其他"];
const segmentTypes = ["课程导入", "问题链", "任务活动", "教师讲解", "合作探究", "练习迁移", "评价反馈", "课堂总结", "其他"];
const acceptedFileTypes = ".txt,.md,.markdown,.html,.htm,.json,.csv,.docx,.pdf";
const maxFileBytes = 20 * 1024 * 1024;

export default function HaiWorkPage() {
  const { toolSlug: rawToolSlug } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const toolSlug = isWorkToolSlug(rawToolSlug) ? rawToolSlug : null;
  const [access, setAccess] = useState<HaiAccessStatus | null>(null);
  const [tools, setTools] = useState<HaiFeatureModule[]>([]);
  const [tasks, setTasks] = useState<HaiWorkTask[]>([]);
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
        const [{ access: nextAccess }, nextTools, nextTasks] = await Promise.all([
          getHaiAccessStatus(),
          getHaiWorkTools(),
          getHaiWorkTasks(),
        ]);
        if (!cancelled) {
          setAccess(nextAccess);
          setTools(nextTools);
          setTasks(nextTasks);
        }
      } catch (nextError) {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : "教研工作台加载失败。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const enabledToolSlugs = useMemo(() => new Set(tools.map((item) => item.slug)), [tools]);
  const activeModule = toolSlug ? tools.find((item) => item.slug === toolSlug) : undefined;
  const activeConfig = toolSlug ? resolveWorkToolConfig(toolSlug, activeModule) : null;
  const sidebar = <WorkSidebar tasks={tasks} tools={tools} />;

  return (
    <>
      <PageMeta title={activeConfig ? `${activeConfig.name} - HAI` : "帮你干活 - HAI"} description="HAI 教研工作台" canonicalPath={toolSlug ? `/hai/work/${toolSlug}` : "/hai/work"} />
      <HaiWorkShell
        sidebar={sidebar}
        title={activeConfig?.name ?? "帮你干活"}
        subtitle={activeConfig?.promise ?? "诊断、优化与生成，沉淀为可追改的工作产物"}
      >
        {loading ? (
          <WorkLoading />
        ) : error ? (
          <WorkError message={error} />
        ) : !access?.allowed ? (
          <WorkLocked reason={access?.reason} />
        ) : toolSlug ? (
          enabledToolSlugs.has(toolSlug) ? (
            <WorkToolForm toolSlug={toolSlug} config={activeConfig ?? HAI_WORK_TOOL_CONFIG[toolSlug]} />
          ) : (
            <WorkError message="这项工作功能尚未在后台启用。" />
          )
        ) : (
          <WorkLanding tools={tools} tasks={tasks} />
        )}
      </HaiWorkShell>
    </>
  );
}

function WorkLanding({ tools, tasks }: { tools: HaiFeatureModule[]; tasks: HaiWorkTask[] }) {
  const visibleTools = getSupportedWorkTools(tools);
  return (
    <div className="mx-auto max-w-6xl px-4 py-5 pb-24 md:px-8 md:py-8">
      <section className="relative overflow-hidden rounded-[30px] border border-[#d9d0c1] bg-[#253831] px-5 py-7 text-[#fffaf0] shadow-[0_24px_60px_rgba(37,56,49,0.18)] md:px-9 md:py-10">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border border-[#f5d8aa]/20" />
        <div className="absolute right-10 top-8 h-24 w-24 rotate-12 border border-[#f5d8aa]/15" />
        <p className="text-[11px] font-bold tracking-[0.28em] text-[#e7bc82]">HAI 教研工作台</p>
        <h2 className="mt-4 max-w-2xl font-serif text-3xl font-black leading-tight tracking-tight md:text-5xl">
          不只聊一聊，<br />把教学工作真正做完。
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-[#d9dfd9] md:text-base">
          选择一项任务，提交你的真实材料。HAI 会形成一份可保存、可追改、可回看的工作产物。
        </p>
        <div className="mt-6 flex flex-wrap gap-2 text-xs text-[#d9dfd9]">
          {["材料有边界", "结果可追改", "版本可回看"].map((item) => (
            <span key={item} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">{item}</span>
          ))}
        </div>
      </section>

      <section className="mt-7 grid gap-4 lg:grid-cols-3">
        {visibleTools.map(({ slug, config }, index) => (
          <WorkToolCard key={slug} slug={slug} config={config} index={index} />
        ))}
      </section>

      <section className="mt-9">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black tracking-[0.24em] text-[#a15a37]">最近产物</p>
            <h3 className="mt-1 text-xl font-black text-[#2d302b]">最近任务</h3>
          </div>
          <span className="text-xs text-[#847b6f]">产物会自动保存在这里</span>
        </div>
        {tasks.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {tasks.slice(0, 6).map((task) => <RecentTaskCard key={task.id} task={task} tools={tools} />)}
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-[#d7cdbd] bg-[#faf6ee] px-6 py-10 text-center">
            <BookOpenCheck className="mx-auto h-7 w-7 text-[#a79b8b]" />
            <p className="mt-3 text-sm font-bold text-[#4b4c46]">第一份工作产物，等你来创建</p>
            <p className="mt-1 text-xs text-[#857b6e]">建议从一份正在修改的真实教案开始。</p>
          </div>
        )}
      </section>
    </div>
  );
}

function WorkToolCard({ slug, config, index }: {
  slug: HaiWorkToolSlug;
  config: HaiWorkToolVisualConfig;
  index: number;
}) {
  const Icon = config.icon;
  return (
    <Link
      to={`/hai/work/${slug}`}
      className="group relative min-h-[260px] overflow-hidden rounded-[26px] border border-[#d9d0c1] bg-[#fffaf1] p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(76,57,33,0.13)]"
    >
      <span className="absolute right-4 top-3 font-serif text-6xl font-black text-[#e7dfd1]">0{index + 1}</span>
      <div className="relative">
        <div className="flex h-12 w-12 items-center justify-center rounded-[18px] text-white shadow-lg" style={{ backgroundColor: config.accent }}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="mt-5 text-[10px] font-black tracking-[0.22em]" style={{ color: config.accent }}>{config.eyebrow}</p>
        <h3 className="mt-2 text-xl font-black text-[#2f312d]">{config.name}</h3>
        <p className="mt-3 text-sm leading-6 text-[#756d63]">{config.description}</p>
        <div className="mt-5 flex items-center justify-between border-t border-[#e5ded3] pt-4 text-xs font-bold text-[#4e514b]">
          <span>{config.promise}</span>
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}

function WorkToolForm({ toolSlug, config }: { toolSlug: HaiWorkToolSlug; config: HaiWorkToolVisualConfig }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState<Record<string, string>>(() => initialForm(toolSlug));
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [catalog, setCatalog] = useState<HaiTextbookCatalogEntry[]>([]);

  useEffect(() => {
    if (toolSlug !== "subject-lesson-design") return;
    let cancelled = false;
    getHaiTextbookCatalog().then((items) => {
      if (!cancelled) setCatalog(items);
    }).catch((nextError) => {
      if (!cancelled) setError(nextError instanceof Error ? nextError.message : "教材目录加载失败。");
    });
    return () => { cancelled = true; };
  }, [toolSlug]);

  const gradeOptions = useMemo(() => unique(catalog.map((item) => item.grade_label)), [catalog]);
  const gradeCatalog = useMemo(
    () => catalog.filter((item) => item.grade_label === form.grade),
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
    () => unique(topicCatalog.map((item) => `${item.frame_label} ${item.frame_title}`)),
    [topicCatalog],
  );
  const selectedEdition = topicCatalog[0] ?? volumeCatalog[0];

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
    setForm((current) => ({
      ...current,
      [key]: value,
      ...Object.fromEntries(resetAfter[key].map((field) => [field, ""])),
    }));
  }

  function selectFiles(fileList: FileList | null) {
    const next = Array.from(fileList ?? []);
    if (next.length > 5) {
      setError("每个任务最多上传 5 份材料。");
      return;
    }
    const oversized = next.find((file) => file.size > maxFileBytes);
    if (oversized) {
      setError(`“${oversized.name}”超过 20MB，请缩小文件后重试。`);
      return;
    }
    setError("");
    setFiles(next);
  }

  async function submit() {
    if (!user || busy) return;
    const validation = validateForm(toolSlug, form, files.length);
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
      await streamHaiWork({ toolSlug, input: form, materialIds }, {
        onEvent: (event) => {
          if (event.type === "progress") setProgress(event.message);
          if (event.type === "error") setError(event.message);
          if (event.type === "done") navigate(`/hai/work/tasks/${event.taskId}`);
        },
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "任务执行失败，请重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 pb-28 md:px-8 md:py-8">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-[#c8bba9] bg-[#f7f0e5] text-[#7f563d]">01 教学背景</Badge>
        <span className="h-px w-5 bg-[#d7cdbf]" />
        <Badge variant="outline" className="border-[#c8bba9] bg-[#f7f0e5] text-[#7f563d]">02 原始材料</Badge>
        <span className="h-px w-5 bg-[#d7cdbf]" />
        <Badge variant="outline" className="border-[#c8bba9] bg-[#f7f0e5] text-[#7f563d]">03 生成产物</Badge>
      </div>

      <div className="mt-5 rounded-[28px] border border-[#ddd3c4] bg-[#fffaf2] p-5 shadow-[0_12px_35px_rgba(68,50,28,0.07)] md:p-7">
        <p className="text-[10px] font-black tracking-[0.24em]" style={{ color: config.accent }}>{config.eyebrow}</p>
        <h2 className="mt-2 text-2xl font-black text-[#2d302b]">先把真实情况交给 HAI</h2>
        <p className="mt-2 text-sm leading-6 text-[#766e64]">信息越具体，产物越能进入你的课堂。思政公开课可直接选择内置教材目录，无需手动上传教材。</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {toolSlug === "subject-lesson-design" ? (
            <FixedField label="学段" value="初中" />
          ) : (
            <SelectField label="学段" value={form.stage} options={stages} onChange={(value) => update("stage", value)} />
          )}
          {toolSlug === "subject-lesson-design" ? (
            <FixedField label="学科与课型" value="道德与法治 · 公开课" />
          ) : (
            <TextField label="学科" value={form.subject} placeholder="例如：语文、数学、思想政治" onChange={(value) => update("subject", value)} />
          )}
          {toolSlug === "subject-lesson-design" ? (
            <>
              <SelectField label="年级" value={form.grade} options={gradeOptions} onChange={(value) => updateTextbookField("grade", value)} />
              <SelectField label="册次" value={form.volume} options={volumeOptions} onChange={(value) => updateTextbookField("volume", value)} />
              <SelectField label="单元" value={form.unit} options={unitOptions} onChange={(value) => updateTextbookField("unit", value)} />
              <SelectField label="课题" value={form.topic} options={topicOptions} onChange={(value) => updateTextbookField("topic", value)} />
              <SelectField label="框题（可选；不选则读取全课）" value={form.frame} options={frameOptions} onChange={(value) => updateTextbookField("frame", value)} />
            </>
          ) : (
            <TextField label="课题" value={form.topic} placeholder="输入本节课题" onChange={(value) => update("topic", value)} />
          )}
          {toolSlug === "segment-optimization" && (
            <SelectField label="要优化的环节" value={form.segment_type} options={segmentTypes} onChange={(value) => update("segment_type", value)} />
          )}
          <TextField label="课时与班级约束（可选）" value={form.constraints} placeholder="例如：40 分钟、48 人、不能使用平板" onChange={(value) => update("constraints", value)} />
        </div>
        {toolSlug === "subject-lesson-design" && catalog.length === 0 && !error && (
          <p className="mt-4 text-xs text-[#81786e]">正在读取教材目录…</p>
        )}
        {toolSlug === "subject-lesson-design" && selectedEdition && (
          <div className={`mt-4 rounded-[16px] border px-4 py-3 text-xs leading-5 ${selectedEdition.requires_confirmation ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
            当前版本：{selectedEdition.edition_label}。内置内容为知识点梳理，不是教材逐字原文。
            {selectedEdition.requires_confirmation ? " 该册标记为待纸质教材复核，生成结果会同步提醒核对。" : ""}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-[28px] border border-[#ddd3c4] bg-white p-5 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black tracking-[0.24em] text-[#8c654d]">原始材料</p>
            <h2 className="mt-2 text-xl font-black text-[#2d302b]">{materialTitle(toolSlug)}</h2>
          </div>
          <FileText className="h-6 w-6 text-[#a19382]" />
        </div>

        {toolSlug === "lesson-diagnosis" && (
          <TextAreaField label="教案正文" value={form.lesson_plan} placeholder="粘贴完整教案；也可以只上传文件。" minRows={12} onChange={(value) => update("lesson_plan", value)} />
        )}
        {toolSlug === "segment-optimization" && (
          <>
            <TextAreaField label="当前环节设计" value={form.current_design} placeholder="尽量保留原始师生对话、任务、时间和评价方式。" minRows={8} onChange={(value) => update("current_design", value)} />
            <TextAreaField label="希望优化后达成什么效果" value={form.desired_outcome} placeholder="例如：让导入真正暴露学生前概念，并自然进入核心问题。" minRows={4} onChange={(value) => update("desired_outcome", value)} />
          </>
        )}
        {toolSlug === "subject-lesson-design" && (
          <TextAreaField label="补充教材内容（可选）" value={form.textbook_content} placeholder="如教材版本与内置知识点不同，可粘贴本课原文；用户补充内容优先。" minRows={6} onChange={(value) => update("textbook_content", value)} />
        )}

        <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-[20px] border border-dashed border-[#cfc3b2] bg-[#faf6ee] p-4 transition hover:border-[#a56a47] hover:bg-[#f7efe3]">
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#9a6849] shadow-sm"><UploadCloud className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-[#3f413d]">上传补充材料</span>
              <span className="mt-1 block truncate text-xs text-[#81776b]">TXT / MD / DOCX / 文字型 PDF，最多 5 份，每份 20MB</span>
            </span>
          </span>
          <input type="file" multiple accept={acceptedFileTypes} className="sr-only" onChange={(event) => selectFiles(event.target.files)} />
          <Paperclip className="h-4 w-4 shrink-0 text-[#9c8f7e]" />
        </label>
        {files.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {files.map((file) => (
              <span key={`${file.name}-${file.size}`} className="rounded-full border border-[#ddd2c3] bg-white px-3 py-1.5 text-xs text-[#655d54]">{file.name}</span>
            ))}
          </div>
        )}
      </div>

      {error && <div className="mt-4 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="mt-5 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-xs leading-5 text-[#81786e]">提交后会创建一份独立任务。以后每次追改都会保留旧版本。</p>
        <Button className="h-12 rounded-[18px] bg-[#253831] px-6 text-white hover:bg-[#314a40]" disabled={busy} onClick={() => void submit()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? progress || "正在执行" : `开始${config.name}`}
        </Button>
      </div>
    </div>
  );
}

export function WorkSidebar({ tasks, tools }: { tasks: HaiWorkTask[]; tools: HaiFeatureModule[] }) {
  const visibleTools = getSupportedWorkTools(tools);
  return (
    <div>
      <p className="px-1 text-[11px] font-black tracking-[0.16em] text-[#8f684e]">工作工具</p>
      <div className="mt-3 space-y-1.5">
        {visibleTools.map(({ slug, config }) => {
          const Icon = config.icon;
          return (
            <Link key={slug} to={`/hai/work/${slug}`} className="flex items-center gap-3 rounded-[16px] px-3 py-2.5 text-sm font-bold text-[#5d5b55] transition hover:bg-white hover:text-[#283b34]">
              <Icon className="h-4 w-4" />{config.name}
            </Link>
          );
        })}
      </div>
      <div className="my-5 h-px bg-[#ddd4c6]" />
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] font-black tracking-[0.16em] text-[#8e867a]">最近任务</p>
        <Clock3 className="h-3.5 w-3.5 text-[#a79c8d]" />
      </div>
      <div className="mt-3 space-y-1">
        {tasks.slice(0, 8).map((task) => (
          <Link key={task.id} to={`/hai/work/tasks/${task.id}`} className="block rounded-[14px] px-3 py-2.5 transition hover:bg-white">
            <p className="truncate text-xs font-bold text-[#4b4b46]">{task.title}</p>
            <p className="mt-1 text-[10px] text-[#93897b]">{formatDate(task.updated_at)} · v{task.latest_artifact?.version_number ?? "—"}</p>
          </Link>
        ))}
        {tasks.length === 0 && <p className="px-3 py-4 text-xs leading-5 text-[#9b9184]">任务完成后会出现在这里。</p>}
      </div>
    </div>
  );
}

function RecentTaskCard({ task, tools }: { task: HaiWorkTask; tools: HaiFeatureModule[] }) {
  const config = resolveWorkToolConfig(task.module_slug, tools.find((item) => item.slug === task.module_slug));
  const Icon = config.icon;
  return (
    <Link to={`/hai/work/tasks/${task.id}`} className="group flex items-center gap-4 rounded-[22px] border border-[#ddd4c6] bg-white p-4 transition hover:border-[#b9aa96] hover:shadow-[0_10px_24px_rgba(74,56,33,0.08)]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] text-white" style={{ backgroundColor: config.accent }}><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-[#3d3f3a]">{task.title}</span>
        <span className="mt-1 block text-xs text-[#8a8074]">{formatDate(task.updated_at)} · v{task.latest_artifact?.version_number ?? "—"}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-[#9c9182] transition group-hover:translate-x-1" />
    </Link>
  );
}

function TextField({ label, value, placeholder, onChange }: FieldProps) {
  return (
    <label className="block text-xs font-bold text-[#625d55]">
      {label}
      <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-11 w-full rounded-[15px] border border-[#d9d0c4] bg-white px-3 text-sm font-normal text-[#363934] outline-none transition focus:border-[#a56a47] focus:ring-2 focus:ring-[#a56a47]/10" />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs font-bold text-[#625d55]">
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-[15px] border border-[#d9d0c4] bg-white px-3 text-sm font-normal text-[#363934] outline-none focus:border-[#a56a47]">
        <option value="">请选择</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function FixedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[15px] border border-[#d9d0c4] bg-[#f5efe5] px-3 py-2.5" aria-label={label}>
      <p className="text-[10px] font-bold tracking-[0.12em] text-[#8f684e]">{label}</p>
      <p className="mt-1 text-sm font-black text-[#363934]">{value}</p>
    </div>
  );
}

function TextAreaField({ label, value, placeholder, minRows, onChange }: FieldProps & { minRows: number }) {
  return (
    <label className="mt-5 block text-xs font-bold text-[#625d55]">
      {label}
      <textarea aria-label={label} value={value} rows={minRows} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full resize-y rounded-[18px] border border-[#d9d0c4] bg-[#fffdf9] p-4 text-sm font-normal leading-7 text-[#353733] outline-none transition focus:border-[#a56a47] focus:ring-2 focus:ring-[#a56a47]/10" />
    </label>
  );
}

type FieldProps = { label: string; value: string; placeholder: string; onChange: (value: string) => void };

function WorkLoading() {
  return <div className="flex min-h-[60vh] items-center justify-center text-sm text-[#81786e]"><Loader2 className="mr-2 h-4 w-4 animate-spin" />正在打开教研工作台</div>;
}

function WorkError({ message }: { message: string }) {
  return <div className="mx-auto max-w-xl px-5 py-20 text-center"><h2 className="text-xl font-black text-[#393b37]">工作台暂时没有打开</h2><p className="mt-3 text-sm leading-6 text-[#7d7469]">{message}</p></div>;
}

function WorkLocked({ reason }: { reason?: string }) {
  return (
    <div className="mx-auto max-w-xl px-5 py-20 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#f0e7d8] text-[#9c6747]"><ClipboardCheck className="h-6 w-6" /></div>
      <h2 className="mt-5 text-2xl font-black text-[#393b37]">“帮你干活”仍在内测</h2>
      <p className="mt-3 text-sm leading-6 text-[#7d7469]">{reason || "当前账号还没有 HAI 使用权限。"}</p>
      <Button asChild className="mt-6 rounded-[16px] bg-[#263b34] text-white"><Link to="/hai/chat">先去聊聊问题</Link></Button>
    </div>
  );
}

function initialForm(toolSlug: HaiWorkToolSlug) {
  return {
    stage: toolSlug === "subject-lesson-design" ? "初中" : "",
    subject: toolSlug === "subject-lesson-design" ? "道德与法治" : "",
    grade: "",
    volume: "",
    unit: "",
    topic: "",
    frame: "",
    lesson_type: toolSlug === "subject-lesson-design" ? "公开课" : "",
    segment_type: "",
    current_design: "",
    desired_outcome: "",
    lesson_plan: "",
    textbook_content: "",
    constraints: "",
    tool_slug: toolSlug,
  };
}

function validateForm(toolSlug: HaiWorkToolSlug, form: Record<string, string>, fileCount: number) {
  if (!form.stage) return "请选择学段。";
  if (!form.subject.trim()) return "请填写学科。";
  if (!form.topic.trim()) return "请填写课题。";
  if (toolSlug === "lesson-diagnosis" && !form.lesson_plan.trim() && fileCount === 0) return "请粘贴教案正文或上传教案文件。";
  if (toolSlug === "segment-optimization") {
    if (!form.segment_type) return "请选择要优化的环节。";
    if (!form.current_design.trim()) return "请粘贴当前环节设计。";
    if (!form.desired_outcome.trim()) return "请说明希望优化后达成的效果。";
  }
  if (toolSlug === "subject-lesson-design") {
    if (!form.grade) return "请选择年级。";
    if (!form.volume) return "请选择册次。";
    if (!form.unit) return "请选择单元。";
  }
  return "";
}

function materialTitle(toolSlug: HaiWorkToolSlug) {
  if (toolSlug === "lesson-diagnosis") return "提交需要诊断的教案";
  if (toolSlug === "segment-optimization") return "保留你的原始环节";
  return "补充你的版本差异或本班学情（可选）";
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function isWorkToolSlug(value: string | undefined): value is HaiWorkToolSlug {
  return value === "lesson-diagnosis" || value === "segment-optimization" || value === "subject-lesson-design";
}

export function resolveWorkToolConfig(slug: HaiWorkToolSlug, module?: HaiFeatureModule): HaiWorkToolVisualConfig {
  const fallback = HAI_WORK_TOOL_CONFIG[slug];
  return {
    ...fallback,
    name: module?.name?.trim() || fallback.name,
    description: module?.description?.trim() || fallback.description,
  };
}

function getSupportedWorkTools(tools: HaiFeatureModule[]) {
  return tools.flatMap((module) => {
    if (!isWorkToolSlug(module.slug)) return [];
    return [{ slug: module.slug, config: resolveWorkToolConfig(module.slug, module) }];
  });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
