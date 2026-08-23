import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FilePlus2,
  FolderPlus,
  Library,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { V2AccessPanel, V2ReviewPanel } from "@/components/admin/V2AdminSecondaryPanels";
import V2DictionaryPanel from "@/components/admin/V2DictionaryPanel";
import V2LessonEditor from "@/components/admin/V2LessonEditor";
import {
  buildV2OutlineExpansion,
  getV2ErrorMessage,
  resolveV2CreateParentId,
  type V2CreateType,
} from "@/components/admin/v2-course-form-utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  getV2LessonAdminBundle,
  getV2Outlines,
  saveV2Lesson,
  saveV2Module,
  saveV2Unit,
  type V2LessonBundle,
  type V2Outline,
} from "@/db/v2-api";

type V2Panel = "outline" | "reviews" | "dictionary" | "access";

export default function V2CourseManagementSection() {
  const [panel, setPanel] = useState<V2Panel>("outline");
  const panels = [
    ["outline", "课程大纲", BookOpen],
    ["reviews", "批阅中心", ClipboardCheck],
    ["dictionary", "数据字典", SlidersHorizontal],
    ["access", "V2 权限", ShieldCheck],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-4">
        {panels.map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => setPanel(value)}
            className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-xs font-ds-bold transition ${
              panel === value
                ? "border-[#173d39] bg-[#173d39] text-white"
                : "border-bdl bg-white/60 text-txs hover:border-ac"
            }`}
          >
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>
      {panel === "outline" && <V2OutlinePanel />}
      {panel === "reviews" && <V2ReviewPanel />}
      {panel === "dictionary" && <V2DictionaryPanel />}
      {panel === "access" && <V2AccessPanel />}
    </div>
  );
}

function V2OutlinePanel() {
  const { user } = useAuth();
  const [outlines, setOutlines] = useState<V2Outline[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<V2LessonBundle | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<{ type: V2CreateType; parentId?: string } | null>(null);
  const initializedExpansion = useRef(false);

  const loadOutline = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getV2Outlines();
      setOutlines(result);
      if (!initializedExpansion.current) {
        setExpanded(buildV2OutlineExpansion(result));
        initializedExpansion.current = true;
      }
    } catch (error) {
      console.error(error);
      toast.error("V2 大纲加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSelectedLesson = useCallback(async () => {
    if (!selectedLessonId || !user) {
      setSelectedBundle(null);
      return;
    }
    try {
      setSelectedBundle(await getV2LessonAdminBundle(selectedLessonId, user.id));
    } catch (error) {
      console.error(error);
      toast.error("课程编辑数据加载失败");
    }
  }, [selectedLessonId, user]);

  const refresh = useCallback(async () => {
    await Promise.all([loadOutline(), loadSelectedLesson()]);
  }, [loadOutline, loadSelectedLesson]);

  useEffect(() => { void loadOutline(); }, [loadOutline]);
  useEffect(() => { void loadSelectedLesson(); }, [loadSelectedLesson]);

  const selectedUnit = useMemo(
    () => outlines.flatMap((outline) => outline.units).find((unit) => unit.lessons.some((lesson) => lesson.id === selectedLessonId)),
    [outlines, selectedLessonId],
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(400px,1.2fr)]">
      <section className="rounded-3xl border border-bdl bg-white/65 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-ds-black tracking-[.16em] text-ac">V2 OUTLINE</p>
            <h3 className="mt-2 font-serif text-2xl font-ds-black text-tx">Module → Unit → Lesson</h3>
            <p className="mt-1 text-xs text-txs">进入页面默认展开全部模块、单元和单课。</p>
          </div>
          <Button onClick={() => setCreating({ type: "module" })} className="bg-[#173d39] text-white hover:bg-[#24554e]">
            <FolderPlus className="h-4 w-4" />新增模块
          </Button>
        </div>

        {creating && (
          <OutlineCreateForm
            key={`${creating.type}:${creating.parentId ?? "root"}`}
            type={creating.type}
            initialParentId={creating.parentId}
            outlines={outlines}
            onClose={() => setCreating(null)}
            onSaved={async () => { setCreating(null); await loadOutline(); }}
          />
        )}

        {loading ? (
          <p className="py-10 text-center text-xs text-txs">正在加载 V2 大纲...</p>
        ) : outlines.length === 0 ? (
          <EmptyOutline onCreate={() => setCreating({ type: "module" })} />
        ) : (
          <div className="mt-5 space-y-3">
            {outlines.map((outline) => (
              <div key={outline.module.id} className="rounded-2xl border border-bdl bg-white/55">
                <button
                  type="button"
                  onClick={() => setExpanded((current) => ({ ...current, [outline.module.id]: !current[outline.module.id] }))}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left"
                >
                  {expanded[outline.module.id] ? <ChevronDown className="h-4 w-4 text-ac" /> : <ChevronRight className="h-4 w-4 text-ac" />}
                  <span className="font-ds-bold text-tx">{outline.module.title}</span>
                  <StatusPill status={outline.module.status} />
                  <span className="ml-auto text-[10px] text-txs">{outline.units.length} 个单元</span>
                </button>
                {expanded[outline.module.id] && (
                  <div className="border-t border-bdl px-4 pb-3">
                    {outline.units.map((unit) => (
                      <div key={unit.id} className="mt-3 rounded-xl bg-bgs/45 p-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setExpanded((current) => ({ ...current, [unit.id]: !current[unit.id] }))}
                            className="inline-flex min-w-0 items-center gap-1.5 text-left"
                          >
                            {expanded[unit.id] ? <ChevronDown className="h-3.5 w-3.5 text-ac" /> : <ChevronRight className="h-3.5 w-3.5 text-ac" />}
                            <span className="truncate text-xs font-ds-bold text-tx">{unit.title}</span>
                          </button>
                          <StatusPill status={unit.status} />
                          <span className="text-[10px] text-txs">{unit.lessons.length} 课</span>
                          <button
                            type="button"
                            onClick={() => setCreating({ type: "lesson", parentId: unit.id })}
                            className="ml-auto inline-flex items-center gap-1 text-[10px] font-ds-bold text-ac hover:underline"
                          >
                            <Plus className="h-3 w-3" />新增课
                          </button>
                        </div>
                        {expanded[unit.id] && (
                          <div className="mt-2 space-y-1 border-l border-ac/25 pl-3">
                            {unit.lessons.map((lesson) => (
                              <button
                                type="button"
                                key={lesson.id}
                                onClick={() => setSelectedLessonId(lesson.id)}
                                className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition ${
                                  selectedLessonId === lesson.id ? "bg-[#173d39] text-white" : "text-txs hover:bg-white"
                                }`}
                              >
                                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{lesson.title}</span>
                                <StatusPill status={lesson.status} inverse={selectedLessonId === lesson.id} />
                              </button>
                            ))}
                            {unit.lessons.length === 0 && <p className="py-2 text-[11px] text-txs">暂无单课</p>}
                          </div>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCreating({ type: "unit", parentId: outline.module.id })}
                      className="mt-3 inline-flex items-center gap-1 text-[10px] font-ds-bold text-ac hover:underline"
                    >
                      <Plus className="h-3 w-3" />新增单元
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        {selectedBundle ? (
          <V2LessonEditor bundle={selectedBundle} unitId={selectedUnit?.id ?? selectedBundle.unit.id} onSaved={refresh} />
        ) : (
          <div className="grid min-h-[420px] place-items-center rounded-3xl border border-dashed border-bdl bg-white/35 p-8 text-center">
            <div>
              <Library className="mx-auto h-9 w-9 text-ac/55" />
              <p className="mt-3 text-sm font-ds-bold text-tx">从左侧完整大纲中选择一节 Lesson</p>
              <p className="mt-1 text-xs text-txs">选中后可编辑内容、知识卡、前后测和真实任务。</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function OutlineCreateForm({ type, initialParentId, outlines, onClose, onSaved }: { type: V2CreateType; initialParentId?: string; outlines: V2Outline[]; onClose: () => void; onSaved: () => Promise<void> | void }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState(resolveV2CreateParentId(type, outlines, initialParentId));
  const [saving, setSaving] = useState(false);
  const label = type === "module" ? "模块" : type === "unit" ? "单元" : "单课";
  const options = type === "module"
    ? []
    : type === "unit"
      ? outlines.map((item) => ({ id: item.module.id, title: item.module.title }))
      : outlines.flatMap((item) => item.units.map((unit) => ({ id: unit.id, title: `${item.module.title} / ${unit.title}` })));

  async function submit() {
    if (!title.trim()) { toast.error(`${label}名称不能为空`); return; }
    setSaving(true);
    try {
      if (type === "module") {
        await saveV2Module({ title: title.trim(), slug: slug.trim() || slugify(title), status: "draft", is_active: true, sort_order: outlines.length });
      } else if (type === "unit") {
        await saveV2Unit({ module_id: parentId, title: title.trim(), slug: slug.trim() || slugify(title), status: "draft", is_active: true, sort_order: outlines.find((item) => item.module.id === parentId)?.units.length ?? 0 });
      } else {
        const unit = outlines.flatMap((item) => item.units).find((row) => row.id === parentId);
        if (!unit) throw new Error("请选择所属单元");
        await saveV2Lesson({ unit_id: unit.id, title: title.trim(), slug: slug.trim() || slugify(title), status: "draft", is_trial: false, credits: 0, sort_order: unit.lessons.length, objectives: [] });
      }
      toast.success(`${label}已创建`);
      await onSaved();
    } catch (error) {
      console.error(error);
      toast.error(getV2ErrorMessage(error, `${label}创建失败`));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-ac/25 bg-acl/40 p-4">
      <div className="flex items-center justify-between"><p className="text-xs font-ds-bold text-tx">新增{label}</p><button type="button" onClick={onClose} className="text-xs text-txs hover:text-tx">取消</button></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label={`${label}名称`} value={title} onChange={setTitle} placeholder={`例如：${label}一`} />
        <Field label="Slug（可选）" value={slug} onChange={setSlug} placeholder="自动根据名称生成" />
        {type !== "module" && (
          <label className="text-xs text-txs sm:col-span-2">
            所属{type === "unit" ? "模块" : "单元"}
            <select value={parentId} onChange={(event) => setParentId(event.target.value)} className="mt-1 w-full rounded-xl border border-bdl bg-white px-3 py-2 text-sm text-tx outline-none">
              {options.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
            </select>
          </label>
        )}
      </div>
      <Button onClick={() => void submit()} disabled={saving || (type !== "module" && !parentId)} className="mt-3 bg-[#173d39] text-white hover:bg-[#24554e]"><Plus className="h-4 w-4" />{saving ? "创建中…" : "创建"}</Button>
    </div>
  );
}

function EmptyOutline({ onCreate }: { onCreate: () => void }) {
  return <div className="py-14 text-center"><FilePlus2 className="mx-auto h-9 w-9 text-ac/55" /><p className="mt-3 text-sm font-ds-bold text-tx">还没有 V2 课程</p><button type="button" onClick={onCreate} className="mt-3 text-xs font-ds-bold text-ac hover:underline">创建第一个模块 →</button></div>;
}

function StatusPill({ status, inverse = false }: { status: string; inverse?: boolean }) {
  const labels: Record<string, string> = { draft: "草稿", published: "已发布", archived: "已归档" };
  return <span className={`rounded-full px-2 py-0.5 text-[9px] font-ds-bold ${inverse ? "bg-white/15 text-white/70" : status === "published" ? "bg-bgs text-ac" : "bg-bgs text-txs"}`}>{labels[status] ?? status}</span>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="text-xs text-txs">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-xl border border-bdl bg-white px-3 py-2 text-sm text-tx outline-none focus:border-ac" /></label>;
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-+|-+$/g, "") || `v2-${Date.now()}`;
}
