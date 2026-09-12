import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FilePlus2,
  FileSpreadsheet,
  FolderPlus,
  Library,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { V2ReviewPanel } from "@/components/admin/V2AdminSecondaryPanels";
import V2CourseWorkbookImport from "@/components/admin/V2CourseWorkbookImport";
import V2DictionaryPanel from "@/components/admin/V2DictionaryPanel";
import V2LessonEditor from "@/components/admin/V2LessonEditor";
import {
  buildV2OutlineExpansion,
  getV2ErrorMessage,
  resolveV2CreateParentId,
  type V2CreateType,
} from "@/components/admin/v2-course-form-utils";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  deleteV2LessonAdmin,
  deleteV2UnitAdmin,
  getV2LessonAdminBundle,
  getV2Outlines,
  saveV2Lesson,
  saveV2Unit,
  type V2LessonBundle,
  type V2Outline,
} from "@/db/v2-api";

type V2Panel = "outline" | "reviews" | "dictionary";

export default function V2CourseManagementSection() {
  const [panel, setPanel] = useState<V2Panel>("outline");
  const panels = [
    ["outline", "课程大纲", BookOpen],
    ["reviews", "批阅中心", ClipboardCheck],
    ["dictionary", "数据字典", SlidersHorizontal],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-3">
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
  const [importing, setImporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "unit" | "lesson"; id: string; title: string; lessonCount?: number } | null>(null);
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
    () => outlines.find((outline) => outline.lessons.some((lesson) => lesson.id === selectedLessonId))?.unit,
    [outlines, selectedLessonId],
  );

  async function removeTarget() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "unit") {
        const deletingSelectedLesson = outlines.find((outline) => outline.unit.id === deleteTarget.id)?.lessons.some((lesson) => lesson.id === selectedLessonId);
        await deleteV2UnitAdmin(deleteTarget.id);
        if (deletingSelectedLesson) setSelectedLessonId(null);
      } else {
        await deleteV2LessonAdmin(deleteTarget.id);
        if (selectedLessonId === deleteTarget.id) setSelectedLessonId(null);
      }
      toast.success(`${deleteTarget.type === "unit" ? "单元" : "单课"}已删除`);
      setDeleteTarget(null);
      await loadOutline();
    } catch (error) {
      console.error(error);
      toast.error(getV2ErrorMessage(error, "删除失败"));
      throw error;
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(400px,1.2fr)]">
      <section className="rounded-3xl border border-bdl bg-white/65 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-ds-black tracking-[.16em] text-ac">V2 OUTLINE</p>
            <h3 className="mt-2 font-serif text-2xl font-ds-black text-tx">Unit → Lesson</h3>
            <p className="mt-1 text-xs text-txs">单元是一级目录，展开后管理其下的单课。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setImporting((current) => !current)} variant="outline" className="border-bdl bg-white text-tx"><FileSpreadsheet className="h-4 w-4" />Excel 批量导入</Button>
            <Button onClick={() => setCreating({ type: "unit" })} className="bg-[#173d39] text-white hover:bg-[#24554e]"><FolderPlus className="h-4 w-4" />新增单元</Button>
          </div>
        </div>

        {importing && <V2CourseWorkbookImport onClose={() => setImporting(false)} onImported={loadOutline} />}

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
          <EmptyOutline onCreate={() => setCreating({ type: "unit" })} />
        ) : (
          <div className="mt-5 space-y-3">
            {outlines.map(({ unit, lessons }) => (
              <div key={unit.id} className="overflow-hidden rounded-2xl border border-bdl bg-white/55">
                <div className="flex items-center gap-2 px-4 py-3">
                  <button type="button" onClick={() => setExpanded((current) => ({ ...current, [unit.id]: !current[unit.id] }))} className="inline-flex min-w-0 flex-1 items-center gap-2 text-left">
                    {expanded[unit.id] ? <ChevronDown className="h-4 w-4 shrink-0 text-ac" /> : <ChevronRight className="h-4 w-4 shrink-0 text-ac" />}
                    <span className="truncate font-ds-bold text-tx">{unit.title}</span>
                    <StatusPill status={unit.status} />
                    <span className="ml-auto text-[10px] text-txs">{lessons.length} 课</span>
                  </button>
                  <button type="button" onClick={() => setCreating({ type: "lesson", parentId: unit.id })} aria-label={`在 ${unit.title} 中新增单课`} className="rounded-lg p-1.5 text-ac hover:bg-acl"><Plus className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setDeleteTarget({ type: "unit", id: unit.id, title: unit.title, lessonCount: lessons.length })} aria-label={`删除单元 ${unit.title}`} className="rounded-lg p-1.5 text-txs hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                {expanded[unit.id] && (
                  <div className="space-y-1 border-t border-bdl px-4 py-3">
                    {lessons.map((lesson) => (
                      <div key={lesson.id} className={`flex items-center gap-1 rounded-lg transition ${selectedLessonId === lesson.id ? "bg-[#173d39] text-white" : "text-txs hover:bg-white"}`}>
                        <button type="button" onClick={() => setSelectedLessonId(lesson.id)} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-xs">
                          <BookOpen className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{lesson.title}</span>
                          <StatusPill status={lesson.status} inverse={selectedLessonId === lesson.id} />
                        </button>
                        <button type="button" onClick={() => setDeleteTarget({ type: "lesson", id: lesson.id, title: lesson.title })} aria-label={`删除单课 ${lesson.title}`} className={`mr-1 rounded-md p-1.5 ${selectedLessonId === lesson.id ? "text-white/60 hover:bg-white/10 hover:text-white" : "text-txs hover:bg-red-50 hover:text-red-600"}`}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                    {lessons.length === 0 && <p className="py-2 pl-2 text-[11px] text-txs">暂无单课</p>}
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
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={`删除${deleteTarget?.type === "unit" ? "单元" : "单课"}“${deleteTarget?.title ?? ""}”？`}
        description={deleteTarget?.type === "unit" ? `该单元下的 ${deleteTarget.lessonCount ?? 0} 节单课及其学习数据会一并删除，此操作不可撤销。` : "该单课的正文、知识卡、评估与学习数据会一并删除，此操作不可撤销。"}
        confirmText="确认删除"
        onConfirm={removeTarget}
      />
    </div>
  );
}

function OutlineCreateForm({ type, initialParentId, outlines, onClose, onSaved }: { type: V2CreateType; initialParentId?: string; outlines: V2Outline[]; onClose: () => void; onSaved: () => Promise<void> | void }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState(resolveV2CreateParentId(type, outlines, initialParentId));
  const [saving, setSaving] = useState(false);
  const label = type === "unit" ? "单元" : "单课";
  const options = type === "lesson" ? outlines.map((item) => ({ id: item.unit.id, title: item.unit.title })) : [];

  async function submit() {
    if (!title.trim()) { toast.error(`${label}名称不能为空`); return; }
    setSaving(true);
    try {
      if (type === "unit") {
        await saveV2Unit({ title: title.trim(), slug: slug.trim() || slugify(title), status: "draft", is_active: true, sort_order: outlines.length });
      } else {
        const unit = outlines.find((item) => item.unit.id === parentId);
        if (!unit) throw new Error("请选择所属单元");
        await saveV2Lesson({ unit_id: unit.unit.id, title: title.trim(), slug: slug.trim() || slugify(title), status: "draft", is_trial: false, credits: 0, sort_order: unit.lessons.length, objectives: [] });
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
        {type === "lesson" && (
          <label className="text-xs text-txs sm:col-span-2">
            所属单元
            <select value={parentId} onChange={(event) => setParentId(event.target.value)} className="mt-1 w-full rounded-xl border border-bdl bg-white px-3 py-2 text-sm text-tx outline-none">
              {options.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
            </select>
          </label>
        )}
      </div>
      <Button onClick={() => void submit()} disabled={saving || (type === "lesson" && !parentId)} className="mt-3 bg-[#173d39] text-white hover:bg-[#24554e]"><Plus className="h-4 w-4" />{saving ? "创建中…" : "创建"}</Button>
    </div>
  );
}

function EmptyOutline({ onCreate }: { onCreate: () => void }) {
  return <div className="py-14 text-center"><FilePlus2 className="mx-auto h-9 w-9 text-ac/55" /><p className="mt-3 text-sm font-ds-bold text-tx">还没有 V2 课程</p><button type="button" onClick={onCreate} className="mt-3 text-xs font-ds-bold text-ac hover:underline">创建第一个单元 →</button></div>;
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
