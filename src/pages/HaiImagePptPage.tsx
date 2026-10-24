import { haiTaskTitle } from "@/lib/hai-task-title";
import { saveHaiFile, haiImageAsPng } from "@/lib/hai-file-save";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  FileText,
  ImagePlus,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import PageMeta from "@/components/common/PageMeta";
import HaiWorkShell from "@/components/hai/HaiWorkShell";
import ImagePptOutlineDocument from "@/components/hai/ImagePptOutlineDocument";
import {
  normalizePptCourse,
  pptPageMarkdown,
  pptPagesToMarkdown,
} from "../../supabase/functions/_shared/hai_image_ppt";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  getArchivedHaiWorkTasks,
  getHaiWorkTaskDetail,
  getHaiWorkTasks,
  getHaiWorkTools,
  type HaiFeatureModule,
  type HaiWorkArtifact,
  type HaiWorkTask,
} from "@/db/hai-api";
import {
  acknowledgeHaiImage,
  downloadHaiImage,
  getHaiImageAccessUrls,
  getHaiImageGenerationTasks,
  getRecommendedImageStyles,
  HAI_IMAGE_STYLES,
  type HaiImageGenerationTask,
  type HaiImageStyle,
  imageStyleLabel,
} from "@/db/hai-image-generation";
import {
  imagePptRequest,
  type ImagePptResult,
  type PptCourse,
  type PptPage,
} from "@/db/hai-image-ppt";
import { exportImagePpt } from "@/lib/hai-image-ppt-export";
import { cn } from "@/lib/utils";
import { WorkSidebar } from "@/pages/HaiWorkPage";

const emptyCourse: PptCourse = {
  subject: "",
  grade: "",
  unit: "",
  topic: "",
  teacher: "",
};
const activeStatuses = ["planning", "styling", "generating"];
const inputClass =
  "w-full rounded-xl border border-[var(--paper-rule)] bg-[var(--paper)] px-3 py-2.5 text-sm text-tx outline-none focus:border-[var(--annotation)]";
const stylePreviewAssets = import.meta.glob<string>(
  "/public/images/hai-ppt-styles/*.png",
  { eager: true, import: "default", query: "?url" },
);
export default function HaiImagePptPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<HaiWorkTask[]>([]);
  const [archived, setArchived] = useState<HaiWorkTask[]>([]);
  const [imageTasks, setImageTasks] = useState<HaiImageGenerationTask[]>([]);
  const [tools, setTools] = useState<HaiFeatureModule[]>([]);
  const [keyword, setKeyword] = useState("");
  const [selectedTask, setSelectedTask] = useState("");
  const [artifacts, setArtifacts] = useState<HaiWorkArtifact[]>([]);
  const [artifactId, setArtifactId] = useState("");
  const [requirements, setRequirements] = useState(
    String(location.state?.workDraft || ""),
  );
  const [result, setResult] = useState<ImagePptResult | null>(null);
  const [pages, setPages] = useState<PptPage[]>([]);
  const [outlineMarkdown, setOutlineMarkdown] = useState("");
  const [course, setCourse] = useState<PptCourse>(emptyCourse);
  const [style, setStyle] = useState<HaiImageStyle>("教育扁平插画");
  const [allStyles, setAllStyles] = useState(false);
  const [previewPageId, setPreviewPageId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [imageErrors, setImageErrors] = useState<Record<string, string>>({});
  const [imageReload, setImageReload] = useState(0);
  const imageUrls = useRef<Record<string, string>>({});
  const [editPage, setEditPage] = useState<PptPage | null>(null);
  const [exporting, setExporting] = useState("");
  const [localStep, setLocalStep] = useState<number | null>(null);
  const acknowledged = useRef(new Set<string>());
  const requestId = useRef(crypto.randomUUID());
  const pageTop = useRef<HTMLElement>(null);
  const sourceLoad = useRef(0);
  const deck = result?.deck;
  const active = Boolean(deck && activeStatuses.includes(deck.status));
  const sampleMode = deck?.preview_approved === false;
  const previewRow = result?.pages.find((p) =>
    p.page_id === deck?.preview_page_id
  );
  const previewReady = Boolean(
    result?.runs.some((r) =>
      r.id === previewRow?.current_run_id && r.r2_key && r.status !== "failed"
    ),
  );
  const step = localStep ??
    (!deck ? 1 : !deck.outline.length || deck.status === "planning" ||
        deck.status === "outline"
      ? 2
      : deck.status === "style"
      ? 3
      : 4);
  useEffect(() => {
    pageTop.current?.scrollIntoView?.({ block: "start" });
  }, [step]);
  const apply = useCallback((next: ImagePptResult) => {
    setResult(next);
    setPages(next.deck.outline);
    setPreviewPageId(
      next.deck.preview_page_id ||
        next.deck.outline[Math.min(1, next.deck.outline.length - 1)]?.id || "",
    );
    setOutlineMarkdown(
      next.deck.outline_markdown || pptPagesToMarkdown(next.deck.outline),
    );
    setCourse(normalizePptCourse(next.deck.course));
    if (next.deck.art_style) setStyle(next.deck.art_style as HaiImageStyle);
  }, []);
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { state: { from: location.pathname } });
    }
  }, [authLoading, user, navigate, location.pathname]);
  const loadHistory = useCallback(async () => {
    const [a, b, c, d] = await Promise.all([
      getHaiWorkTasks(),
      getArchivedHaiWorkTasks(),
      getHaiImageGenerationTasks(),
      getHaiWorkTools(),
    ]);
    setTasks(a);
    setArchived(b);
    setImageTasks(c);
    setTools(d);
  }, []);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    setError("");
    setResult(null);
    setLocalStep(null);
    void Promise.all([
      loadHistory(),
      deckId ? imagePptRequest("get", { deckId }) : Promise.resolve(null),
    ]).then(([, next]) => {
      if (alive && next) apply(next);
    }).catch((e) => {
      if (alive) setError(e.message);
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [user, deckId, apply, loadHistory]);
  useEffect(() => {
    if (!deckId || !active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await imagePptRequest("get", { deckId });
        if (!stopped) {
          apply(next);
          if (activeStatuses.includes(next.deck.status)) {
            timer = setTimeout(poll, 10000);
          }
        }
      } catch {
        if (!stopped) timer = setTimeout(poll, 10000);
      }
    };
    timer = setTimeout(poll, 3000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [deckId, active, apply]);
  const readyIds = (result?.runs ?? []).filter((r) =>
    r.r2_key && r.status !== "failed"
  ).map((r) => r.id).join(",");
  useEffect(() => {
    if (!readyIds) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const ids = readyIds.split(",");
        const next = await getHaiImageAccessUrls(ids, "preview");
        if (!alive) return;
        imageUrls.current = { ...imageUrls.current, ...next };
        setUrls(imageUrls.current);
        setImageErrors((current) => {
          const errors = { ...current };
          for (const id of ids) {
            if (next[id]) delete errors[id];
            else if (!imageUrls.current[id]) {
              errors[id] = "图片已生成，暂未取到显示地址。";
            }
          }
          return errors;
        });
        timer = setTimeout(
          refresh,
          ids.every((id) => next[id]) ? 8 * 60 * 1000 : 5000,
        );
      } catch (error) {
        if (!alive) return;
        setImageErrors((current) => ({
          ...current,
          ...Object.fromEntries(
            readyIds.split(",").filter((id) => !imageUrls.current[id]).map((
              id,
            ) => [
              id,
              error instanceof Error
                ? error.message
                : "图片地址加载失败，请稍后重试。",
            ]),
          ),
        }));
        timer = setTimeout(refresh, 5000);
      }
    };
    void refresh();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [readyIds, imageReload]);
  async function chooseTask(id: string) {
    const revision = ++sourceLoad.current;
    setSelectedTask(id);
    setArtifacts([]);
    setArtifactId("");
    if (!id) return;
    setBusy(true);
    setError("");
    try {
      const detail = await getHaiWorkTaskDetail(id);
      if (sourceLoad.current !== revision) return;
      const complete = detail.artifacts.filter((a) =>
        a.content_markdown.trim() &&
        detail.runs.some((r) => r.id === a.run_id && r.status === "completed")
      );
      setArtifacts(complete);
      setArtifactId(complete[0]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "教案加载失败。");
    } finally {
      if (sourceLoad.current === revision) setBusy(false);
    }
  }
  async function create() {
    if (!artifactId || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await imagePptRequest("create", {
        artifactId,
        requirements,
        clientRequestId: requestId.current,
      });
      apply(next);
      navigate(`/hai/work/image-generation/ppt/${next.deck.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  async function act(action: string, data: Record<string, unknown> = {}) {
    if (!deck || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await imagePptRequest(action, {
        deckId: deck.id,
        revision: deck.revision,
        ...data,
      });
      apply(next);
      setLocalStep(null);
      setEditPage(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  async function delivered(id: string) {
    if (acknowledged.current.has(id)) return;
    acknowledged.current.add(id);
    try {
      const ack = await acknowledgeHaiImage(id);
      if (ack.run?.status !== "completed") {
        throw Error("图片交付确认失败，请刷新后重试。");
      }
      setResult((current) =>
        current
          ? {
            ...current,
            runs: current.runs.map((r) =>
              r.id === id ? { ...r, status: "completed" } : r
            ),
          }
          : current
      );
    } catch (e) {
      acknowledged.current.delete(id);
      toast.error(e instanceof Error ? e.message : "交付确认失败。");
    }
  }
  async function downloadOne(id: string, index: number) {
    try {
      await saveHaiFile(`${String(index + 1).padStart(2, "0")}-课件.png`, async () => {
        const blob = await downloadHaiImage(id);
        const ack = await acknowledgeHaiImage(id);
        if (ack.run?.status !== "completed") throw Error("图片交付未完成，请重试。");
        return haiImageAsPng(blob);
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "下载失败。");
    }
  }
  async function downloadAll(format: "zip" | "pptx") {
    if (!result) return;
    setExporting("正在准备图片…");
    try {
      await exportImagePpt(
        result,
        format,
        (n) => setExporting(`正在准备第${n}/${result.deck.outline.length}页…`),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "下载失败。");
    } finally {
      setExporting("");
    }
  }
  const source = artifacts.find((a) => a.id === artifactId);
  const lessons = [...tasks, ...archived].filter((t) =>
    t.module_slug === "subject-lesson-design" && t.latest_artifact_id &&
    t.title.toLowerCase().includes(keyword.toLowerCase())
  );
  const recommended = getRecommendedImageStyles(course.subject);
  const visibleStyles = allStyles
    ? HAI_IMAGE_STYLES
    : recommended.length
    ? recommended
    : HAI_IMAGE_STYLES.slice(0, 14);
  const readyCount =
    result?.pages.filter((p) =>
      result.runs.some((r) =>
        r.id === p.current_run_id && r.r2_key && r.status !== "failed"
      )
    ).length ?? 0;
  const content = (
        <main
          ref={pageTop}
          className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-9"
        >
          <Link
            to="/hai/work"
            className="mb-6 inline-flex items-center gap-2 text-xs text-txs hover:text-tx"
          >
            <ArrowLeft className="h-3.5 w-3.5" />返回帮你干活主页
          </Link>
          <ol
            aria-label="制作课件的四个步骤"
            className="mb-8 grid grid-cols-4 gap-1 border-b border-[var(--paper-rule)] md:gap-4"
          >
            {["选择教案", "文字大纲", "确认风格", "生成与下载"].map((
              label,
              i,
            ) => (
              <li
                key={label}
                aria-current={step === i + 1 ? "step" : undefined}
                className={cn(
                  "flex flex-col items-start gap-2 border-b-2 px-1 pb-4 text-xs md:flex-row md:items-center md:text-sm",
                  step === i + 1
                    ? "border-[var(--annotation)] font-bold text-[var(--annotation)]"
                    : "border-transparent text-txt",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px]",
                    step >= i + 1
                      ? "bg-[var(--annotation-soft)] text-[var(--annotation)]"
                      : "bg-[var(--paper-deep)]",
                  )}
                >
                  {step > i + 1 ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="whitespace-nowrap">{label}</span>
              </li>
            ))}
          </ol>
          {error && (
            <p
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {error}
            </p>
          )}
          {deck?.error_message && step !== 4 && (
            <p
              role="alert"
              className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              {deck.error_message}
            </p>
          )}
          {loading
            ? (
              <div role="status" className="py-16 text-center text-sm text-txs">
                <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />正在读取工作记录…
              </div>
            )
            : (
              <>
                {step === 1 && (
                  <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
                    <section className="space-y-5">
                      <div>
                        <p className="mb-2 text-[11px] font-bold tracking-widest text-[var(--annotation)]">
                          从已经想清楚的教学出发
                        </p>
                        <h1 className="font-serif text-2xl font-bold text-tx">
                          这次，为哪一份教案做课件？
                        </h1>
                        <p className="mt-3 text-sm leading-7 text-txs">
                          加载已有教案，再说说希望学生看到怎样的页面。
                        </p>
                      </div>
                      <input
                        aria-label="搜索已有教案"
                        className={inputClass}
                        placeholder="搜索课题名称"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                      />
                      <select
                        aria-label="选择已有教案"
                        className={inputClass}
                        value={selectedTask}
                        disabled={busy}
                        onChange={(e) => void chooseTask(e.target.value)}
                      >
                        <option value="">选择一份公开课教案</option>
                        {lessons.map((t) => (
                          <option key={t.id} value={t.id}>
                            {haiTaskTitle(t.title)}
                            {t.status === "archived" ? "（已归档）" : ""}
                          </option>
                        ))}
                      </select>
                      {selectedTask && (
                        <select
                          aria-label="选择教案版本"
                          className={inputClass}
                          value={artifactId}
                          disabled={busy}
                          onChange={(e) => setArtifactId(e.target.value)}
                        >
                          <option value="">
                            {busy
                              ? "正在加载…"
                              : artifacts.length
                              ? "选择版本"
                              : "这份任务还没有完整教案"}
                          </option>
                          {artifacts.map((a) => (
                            <option key={a.id} value={a.id}>
                              第{a.version_number}版 · {a.title}
                            </option>
                          ))}
                        </select>
                      )}
                      <label className="block text-sm font-bold text-tx">
                        补充你的需求<textarea
                          aria-label="课件补充需求"
                          className={cn(
                            inputClass,
                            "mt-2 min-h-40 resize-y leading-7",
                          )}
                          value={requirements}
                          maxLength={8000}
                          onChange={(e) => setRequirements(e.target.value)}
                          placeholder="例如：用于七年级课堂，材料分步呈现，讨论前先不要显示结论；希望控制在十五页左右。"
                        />
                      </label>
                      <p className="text-xs leading-6 text-txs">
                        页数根据教学内容和你的需求规划。文字规划按现有规则计费，图片在后续确认后生成。
                      </p>
                      <Button
                        disabled={!artifactId || busy}
                        onClick={() => void create()}
                      >
                        {busy
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <ArrowRight className="h-4 w-4" />}生成文字大纲
                      </Button>
                    </section>
                    <aside className="min-w-0 rounded-2xl border border-[var(--paper-rule)] bg-[var(--paper)] p-5 md:p-7">
                      <p className="mb-4 flex items-center gap-2 text-xs font-bold text-txs">
                        <FileText className="h-4 w-4" />教案预览
                      </p>
                      {source
                        ? (
                          <>
                            <h2 className="mb-3 font-serif text-lg font-bold">
                              {source.title}
                            </h2>
                            <pre className="max-h-[530px] overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-7 text-txs">{source.content_markdown}</pre>
                          </>
                        )
                        : (
                          <p className="py-16 text-center text-sm leading-7 text-txt">
                            选定教案后，正文会显示在这里。<br />原教案的教学流程将成为课件主线。
                          </p>
                        )}
                    </aside>
                  </div>
                )}
                {step === 2 && (
                  <section>
                    <div className="mb-6">
                      <h1 className="font-serif text-2xl font-bold">
                        先把整套课件的思路读顺
                      </h1>
                      <p className="mt-2 text-sm leading-7 text-txs">
                        像审阅一份稿子一样通读、编辑，也可以直接告诉 AI
                        怎样改。艺术风格在下一步选择。
                      </p>
                    </div>
                    {pages.length > 0 && (
                      <details className="mb-5 rounded-xl border border-[var(--paper-rule)] bg-[var(--paper)] p-4">
                        <summary className="cursor-pointer text-sm font-bold">
                          课程信息
                        </summary>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {([
                            ["subject", "学科"],
                            ["grade", "年级"],
                            ["unit", "单元"],
                            ["topic", "课题名称"],
                            ["teacher", "执教教师（选填）"],
                          ] as const).map(([key, label]) => (
                            <label key={key} className="text-xs text-txs">
                              {label}
                              <input
                                className={cn(inputClass, "mt-1")}
                                value={course[key]}
                                onChange={(e) =>
                                  setCourse((c) => ({
                                    ...c,
                                    [key]: e.target.value,
                                  }))}
                              />
                            </label>
                          ))}
                        </div>
                      </details>
                    )}

                    <ImagePptOutlineDocument
                      markdown={outlineMarkdown}
                      onChange={setOutlineMarkdown}
                      onRevise={(feedback) =>
                        act("revise_outline", {
                          markdown: outlineMarkdown,
                          course,
                          feedback,
                        })}
                      onConfirm={() =>
                        void act("outline", {
                          markdown: outlineMarkdown,
                          course,
                        })}
                      busy={busy}
                      planning={deck?.status === "planning"}
                      canConfirm={Boolean(course.topic.trim())}
                    />
                    {!outlineMarkdown && deck?.status !== "planning" && (
                      <Button
                        disabled={busy}
                        onClick={() => void act("retry_plan")}
                      >
                        <RotateCcw className="h-4 w-4" />重新规划
                      </Button>
                    )}
                  </section>
                )}
                {step === 3 && (
                  <section>
                    <div className="mb-6">
                      <h1 className="font-serif text-2xl font-bold">
                        给整套课件，选一种视觉表达
                      </h1>
                      <p className="mt-2 text-sm leading-7 text-txs">
                        {recommended.length
                          ? "先看看适合这门学科的风格，也可以展开全部选项。"
                          : "选择一种通用风格或教学主题风格。"}{" "}
                        同套页面将共用字体层级、配色、导航位置和课程信息。
                      </p>
                    </div>
                    <div
                      role="group"
                      aria-label="选择课件风格"
                      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
                    >
                      {visibleStyles.map((value) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={style === value}
                          onClick={() => setStyle(value)}
                          className={cn(
                            "overflow-hidden rounded-2xl border bg-[var(--paper)] text-left transition",
                            style === value
                              ? "border-[var(--annotation)] ring-2 ring-[var(--annotation-soft)]"
                              : "border-[var(--paper-rule)] hover:border-[var(--annotation)]/50",
                          )}
                        >
                          <StylePreview style={value} />
                          <span className="flex items-center justify-between gap-2 px-4 py-3 text-sm font-bold">
                            {imageStyleLabel(value)}
                            {style === value && (
                              <Check className="h-4 w-4 text-[var(--annotation)]" />
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setAllStyles((v) => !v)}
                      className="mt-4 inline-flex items-center gap-2 text-sm text-txs"
                    >
                      {allStyles ? "收起其他风格" : "查看全部风格"}
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--paper-rule)] pt-6">
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setLocalStep(2)}
                      >
                        <ArrowLeft className="h-4 w-4" />返回修改大纲
                      </Button>
                      <div>
                        <p className="mb-3 text-xs leading-6 text-txs">
                          先生成1页样张，图片20积分。满意后再生成其余{Math.max(
                            0,
                            pages.length - 1,
                          )}页。<br />整套设定的文字规划按现有用量规则计费。
                        </p>
                        <label className="mb-4 block text-xs text-txs">
                          选择样张页面
                          <select
                            aria-label="选择样张页面"
                            className={cn(inputClass, "mt-2")}
                            value={previewPageId}
                            onChange={(e) => setPreviewPageId(e.target.value)}
                          >
                            {pages.map((p, i) => (
                              <option key={p.id} value={p.id}>
                                第{i + 1}页 · {p.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Button
                          disabled={busy || !previewPageId}
                          onClick={() =>
                            void act("generate", { style, previewPageId })}
                        >
                          {busy
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : (
                              <ImagePlus className="h-4 w-4" />
                            )}使用「{imageStyleLabel(style)}」生成1页样张
                        </Button>
                      </div>
                    </div>
                  </section>
                )}
                {step === 4 && deck && (
                  <section>
                    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h1 className="font-serif text-2xl font-bold">
                          {deck.status === "styling"
                            ? "正在确定整套文字与配色"
                            : deck.status === "completed"
                            ? "课件已生成，可以带进课堂了"
                            : sampleMode
                            ? previewReady
                              ? "先看看，这一页是否合你的心意"
                              : "先生成一页，看看实际效果"
                            : "让每一页，依次成形"}
                        </h1>
                        <p
                          role="status"
                          className="mt-2 text-sm leading-7 text-txs"
                        >
                          {deck.status === "styling"
                            ? "沿用所选艺术风格，为整套课件确定字号、色号、导航和课程信息。"
                            : `已生成 ${readyCount} / ${pages.length} 页 · ${
                              imageStyleLabel(style)
                            }`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          disabled={active || busy || Boolean(exporting) ||
                            readyCount !== pages.length}
                          onClick={() => void downloadAll("zip")}
                        >
                          <Download className="h-4 w-4" />整套图片
                        </Button>
                        <Button
                          disabled={active || busy || Boolean(exporting) ||
                            readyCount !== pages.length}
                          onClick={() => void downloadAll("pptx")}
                        >
                          <Download className="h-4 w-4" />下载PPT
                        </Button>
                      </div>
                    </div>
                    {sampleMode && (
                      <div className="mb-6 rounded-xl border border-[var(--paper-rule)] bg-[var(--paper)] p-5">
                        <p className="text-sm leading-7">
                          本次只生成1页样张。满意后沿用当前风格和整套设定，一次生成全部剩余页面；不满意可以返回调整。
                        </p>
                        {!active && (
                          <div className="mt-4 flex flex-wrap gap-3">
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() => void act("back_outline")}
                            >
                              返回修改大纲
                            </Button>
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() => void act("back_style")}
                            >
                              返回选择风格
                            </Button>
                            {pages.length > 1 && (
                              <Button
                                disabled={busy || !previewReady}
                                onClick={() => void act("approve_preview")}
                              >
                                满意，生成剩余{pages.length - 1}页 ·{" "}
                                {(pages.length - 1) * 20}积分
                              </Button>
                            )}
                          </div>
                        )}
                        <p className="mt-3 text-xs leading-6 text-txs">
                          样张直接计入整套课件。图片成功显示后逐张结算，返回调整后再次生成样张按新图计费。
                        </p>
                      </div>
                    )}
                    {exporting && (
                      <p role="status" className="mb-4 text-sm text-txs">
                        {exporting}
                      </p>
                    )}
                    {deck.error_message && (
                      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <p>{deck.error_message}</p>
                        <Button
                          className="mt-3"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            void act(
                              Object.keys(deck.settings).length
                                ? "resume"
                                : "retry_plan",
                            )}
                        >
                          继续生成
                        </Button>
                      </div>
                    )}
                    <div
                      className={cn(
                        "mb-7 h-1.5 overflow-hidden rounded-full bg-[var(--paper-rule)]",
                        sampleMode && "hidden",
                      )}
                    >
                      <div
                        className="h-full bg-[var(--annotation)] transition-all"
                        style={{
                          width: `${
                            pages.length ? readyCount / pages.length * 100 : 0
                          }%`,
                        }}
                      />
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      {pages.map((page, index) => {
                        if (
                          sampleMode && page.id !== deck.preview_page_id
                        ) return null;
                        const row = result.pages.find((p) =>
                          p.page_id === page.id
                        );
                        const run = result.runs.find((r) =>
                          r.id === row?.current_run_id
                        );
                        return (
                          <article
                            key={page.id}
                            className="overflow-hidden rounded-2xl border border-[var(--paper-rule)] bg-[var(--paper)]"
                          >
                            <div className="aspect-video bg-[var(--paper-deep)]">
                              {run?.r2_key && urls[run.id] &&
                                  !imageErrors[run.id]
                                ? (
                                  <div className="h-full w-full">
                                    <img
                                      alt={`第${index + 1}页：${page.title}`}
                                      src={urls[run.id]}
                                      decoding="async"
                                      className="h-full w-full object-contain"
                                      onLoad={() => void delivered(run.id)}
                                      onError={() =>
                                        setImageErrors((current) => ({
                                          ...current,
                                          [run.id]:
                                            "图片已生成，但加载失败，请重新加载。",
                                        }))}
                                    />
                                  </div>
                                )
                                : (
                                  <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center text-sm text-txs">
                                    {run?.status === "failed"
                                      ? <RotateCcw className="h-6 w-6" />
                                      : active && run
                                      ? (
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                      )
                                      : (
                                        <FileText className="h-6 w-6 opacity-40" />
                                      )}
                                    <p>
                                      {run?.status === "failed"
                                        ? "本页生成失败"
                                        : run?.r2_key
                                        ? imageErrors[run.id] ||
                                          "图片已生成，正在加载图片…"
                                        : run
                                        ? "正在生成本页…"
                                        : "等待生成"}
                                    </p>
                                    {run?.r2_key && imageErrors[run.id] && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          setImageReload((n) => n + 1)}
                                      >
                                        重新加载图片
                                      </Button>
                                    )}
                                  </div>
                                )}
                            </div>
                            <div className="flex items-center gap-3 p-4">
                              <span className="font-serif text-lg font-bold text-[var(--annotation)]">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <h2 className="min-w-0 flex-1 truncate text-sm font-bold">
                                {page.title}
                              </h2>
                              {run?.r2_key && (
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label={`下载第${index + 1}页`}
                                  onClick={() =>
                                    void downloadOne(run.id, index)}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={active || busy}
                                onClick={() =>
                                  setEditPage({
                                    ...page,
                                    content_markdown: pptPageMarkdown(page),
                                  })}
                              >
                                修改／重试
                              </Button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    {editPage && (
                      <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                        role="dialog"
                        aria-modal="true"
                        aria-label="修改单页课件"
                      >
                        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[var(--paper)] p-6">
                          <h2 className="mb-4 font-serif text-xl font-bold">
                            修改这一页
                          </h2>
                          <label className="text-sm">
                            标题<input
                              className={cn(inputClass, "mb-4 mt-2")}
                              value={editPage.title}
                              onChange={(e) =>
                                setEditPage({
                                  ...editPage,
                                  title: e.target.value,
                                })}
                            />
                          </label>
                          <label className="text-sm">
                            本页内容与参考排版<textarea
                              className={cn(
                                inputClass,
                                "mb-4 mt-2 min-h-64 font-mono leading-7",
                              )}
                              value={editPage.content_markdown || ""}
                              onChange={(e) =>
                                setEditPage({
                                  ...editPage,
                                  content_markdown: e.target.value,
                                })}
                            />
                          </label>
                          <p className="mb-4 text-xs leading-6 text-txs">
                            保留整套字体、配色和导航设定，仅重新生成本页。新图成功显示后消耗20积分。
                          </p>
                          <div className="flex justify-end gap-3">
                            <Button
                              variant="ghost"
                              onClick={() => setEditPage(null)}
                            >
                              取消
                            </Button>
                            <Button
                              disabled={busy || !editPage.title.trim()}
                              onClick={() =>
                                void act("retry_page", {
                                  pageId: editPage.id,
                                  page: editPage,
                                })}
                            >
                              重新生成本页
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
        </main>
  );
  if (embedded) return content;
  return (
    <>
      <PageMeta
        title="从教案制作图片课件 - HAI"
        description="选择已有教案，确认文字大纲和风格，逐页生成课堂课件"
        canonicalPath="/hai/work/image-generation/ppt"
      />
      <HaiWorkShell
        title={course.topic || "从教案制作课件"}
        subtitle="让教学设计，变成课堂上看得见的画面"
        compactHeader
        sidebar={
          <WorkSidebar
            tasks={tasks}
            archivedTasks={archived}
            tools={tools}
            imageTasks={imageTasks}
            selectedToolSlug="image-generation"
            selectedImageTaskId={deck?.image_task_id}
            onTasksChanged={loadHistory}
          />
        }
      >
        {content}
      </HaiWorkShell>
    </>
  );
}

function StylePreview({ style }: { style: HaiImageStyle }) {
  const [failed, setFailed] = useState(false);
  const index = HAI_IMAGE_STYLES.indexOf(style);
  useEffect(() => setFailed(false), [style]);
  const src = stylePreviewAssets[`/public/images/hai-ppt-styles/${index}.png`];
  if (!src || failed) return null;
  return (
    <div className="aspect-video overflow-hidden bg-[var(--paper-deep)]">
      <img
        src={src}
        alt={`${imageStyleLabel(style)}预置风格参考`}
        loading="lazy"
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
