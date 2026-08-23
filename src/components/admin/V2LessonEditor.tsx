import { useEffect, useState } from "react";
import {
  Link as LinkIcon,
  Pencil,
  PlayCircle,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import MarkdownEditor from "@/components/admin/MarkdownEditor";
import {
  canPublishV2AssessmentBlock,
  isV2AssessmentVisibleOnLesson,
} from "@/components/admin/v2-course-form-utils";
import QuestionSettingsFields, {
  type QuestionSettingsTypeOption,
} from "@/components/questions/QuestionSettingsFields";
import { Button } from "@/components/ui/button";
import {
  deleteV2AssessmentBlockAdmin,
  deleteV2AssessmentItemAdmin,
  deleteV2CardAdmin,
  getV2AssessmentKeyAdmin,
  getV2Dictionaries,
  publishV2LessonAdmin,
  saveV2AssessmentItemAdmin,
  saveV2Block,
  saveV2CardAdmin,
  saveV2Lesson,
  saveV2Resource,
  uploadV2Resource,
  type V2AssessmentBlock,
  type V2AssessmentItem,
  type V2DictionaryGroup,
  type V2DictionaryItem,
  type V2KnowledgeCard,
  type V2Lesson,
  type V2LessonBundle,
  type V2Objective,
} from "@/db/v2-api";

interface V2LessonEditorProps {
  bundle: V2LessonBundle;
  unitId: string;
  onSaved: () => Promise<void> | void;
}

export default function V2LessonEditor({ bundle, unitId, onSaved }: V2LessonEditorProps) {
  const [lesson, setLesson] = useState(bundle.lesson);
  const [objectives, setObjectives] = useState<V2Objective[]>(bundle.lesson.objectives);
  const [groups, setGroups] = useState<V2DictionaryGroup[]>([]);
  const [dictionaryItems, setDictionaryItems] = useState<V2DictionaryItem[]>(bundle.dictionaryItems);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");

  useEffect(() => {
    setLesson(bundle.lesson);
    setObjectives(Array.isArray(bundle.lesson.objectives) ? bundle.lesson.objectives : []);
    setDictionaryItems(bundle.dictionaryItems);
    setSaveNotice("");
  }, [bundle]);

  useEffect(() => {
    getV2Dictionaries()
      .then((result) => {
        setGroups(result.groups);
        setDictionaryItems(result.items);
      })
      .catch((error) => console.error("V2 dictionaries load failed", error));
  }, []);

  const itemsFor = (groupKey: string) => {
    const group = groups.find((row) => row.key === groupKey);
    return group ? dictionaryItems.filter((item) => item.group_id === group.id && item.is_active) : [];
  };

  async function saveLesson() {
    if (!lesson.title.trim()) {
      toast.error("单课标题不能为空");
      return;
    }
    if (!Number.isFinite(lesson.credits) || lesson.credits < 0) {
      toast.error("学分必须是大于或等于 0 的数字");
      return;
    }
    setSaving(true);
    setSaveNotice("正在保存…");
    try {
      const wantsPublished = lesson.status === "published";
      const firstPublish = wantsPublished && bundle.lesson.status !== "published";
      const saved = await saveV2Lesson(
        {
          ...lesson,
          unit_id: unitId,
          title: lesson.title.trim(),
          objectives: objectives
            .map((objective, index) => ({
              id: objective.id || `objective-${index + 1}`,
              text: objective.text.trim(),
              type_id: objective.type_id ?? null,
            }))
            .filter((objective) => objective.text),
          status: firstPublish ? bundle.lesson.status : lesson.status,
          published_at: firstPublish
            ? bundle.lesson.published_at
            : wantsPublished
              ? (lesson.published_at ?? new Date().toISOString())
              : null,
        },
        lesson.id,
      );
      const finalLesson = firstPublish ? await publishV2LessonAdmin(lesson.id) : saved;
      setLesson(finalLesson);
      setSaveNotice(
        firstPublish
          ? "已发布，所属 Module 和 Unit 已同步发布"
          : `已保存 · ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
      );
      toast.success(firstPublish ? "Lesson 已发布，前端目录已可见" : "Lesson 已保存");
      await onSaved();
    } catch (error) {
      console.error(error);
      setSaveNotice("保存失败");
      toast.error(error instanceof Error ? error.message : "Lesson 保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function addResource() {
    if (!resourceUrl.trim()) {
      toast.error("请填写资源外链");
      return;
    }
    try {
      await saveV2Resource({
        lesson_id: lesson.id,
        title: resourceTitle.trim() || "课程资源",
        external_url: resourceUrl.trim(),
        is_active: true,
        is_downloadable: false,
        sort_order: bundle.resources.length,
        metadata: {},
      });
      setResourceTitle("");
      setResourceUrl("");
      toast.success("资源已添加");
      await onSaved();
    } catch (error) {
      console.error(error);
      toast.error("资源添加失败");
    }
  }

  async function uploadResource(file: File) {
    try {
      await uploadV2Resource(lesson.id, file);
      toast.success("资源已上传到 R2");
      await onSaved();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "资源上传失败");
    }
  }

  return (
    <div className="rounded-3xl border border-bdl bg-white/65 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-bdl pb-4">
        <div>
          <p className="text-[10px] font-ds-black tracking-[.16em] text-ac">LESSON EDITOR</p>
          <h3 className="mt-2 font-serif text-2xl font-ds-black text-tx">{lesson.title}</h3>
          <p className="mt-1 text-xs text-txs">基础信息、学习设计、正文资源和评估在同一 Lesson 下维护。</p>
          {saveNotice && <p className={`mt-2 text-[11px] font-ds-bold ${saveNotice === "保存失败" ? "text-red-600" : "text-ac"}`}>{saveNotice}</p>}
        </div>
        <div className="flex gap-2">
          <Link
            to={`/course-v2/lesson/${lesson.id}`}
            target="_blank"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-bdl px-3 text-xs font-ds-bold text-txs hover:border-ac hover:text-ac"
          >
            <LinkIcon className="h-3.5 w-3.5" />预览
          </Link>
          <Button onClick={() => void saveLesson()} disabled={saving} className="bg-[#173d39] text-white hover:bg-[#24554e]">
            <Save className="h-4 w-4" />{saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="标题" value={lesson.title} onChange={(value) => setLesson({ ...lesson, title: value })} />
          <Field label="副标题" value={lesson.subtitle ?? ""} onChange={(value) => setLesson({ ...lesson, subtitle: value || null })} />
          <Field
            label="时长（分钟）"
            value={String(lesson.duration_minutes ?? "")}
            onChange={(value) => setLesson({ ...lesson, duration_minutes: value ? Number(value) : null })}
          />
          <Field
            label="学分"
            value={String(lesson.credits ?? 0)}
            onChange={(value) => setLesson({ ...lesson, credits: value ? Number(value) : 0 })}
            placeholder="例如：1.5"
          />
          <SelectField
            label="Lesson Type"
            value={lesson.lesson_type_id ?? ""}
            onChange={(value) => setLesson({ ...lesson, lesson_type_id: value || null })}
            options={itemsFor("lesson_type")}
            placeholder="选择单课类型"
          />
          <label className="text-xs text-txs">
            状态
            <select
              value={lesson.status}
              onChange={(event) => setLesson({ ...lesson, status: event.target.value as V2Lesson["status"] })}
              className="mt-1 w-full rounded-xl border border-bdl bg-white px-3 py-2 text-sm text-tx outline-none"
            >
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="archived">已归档</option>
            </select>
          </label>
          <label className="flex items-center gap-2 self-end rounded-xl border border-bdl bg-white px-3 py-2 text-xs text-txs">
            <input type="checkbox" checked={lesson.is_trial} onChange={(event) => setLesson({ ...lesson, is_trial: event.target.checked })} />
            允许试看
          </label>
        </div>
        <TextArea label="描述" value={lesson.description ?? ""} onChange={(value) => setLesson({ ...lesson, description: value || null })} />

        <div className="rounded-2xl border border-[#efb393]/35 bg-[#fffaf2] p-4">
          <p className="text-xs font-ds-bold text-tx">学习设计</p>
          <div className="mt-3 grid gap-3">
            <Field label="今天的挑战" value={lesson.challenge_title ?? ""} onChange={(value) => setLesson({ ...lesson, challenge_title: value || null })} />
            <TextArea label="挑战说明 Markdown" value={lesson.challenge_markdown ?? ""} onChange={(value) => setLesson({ ...lesson, challenge_markdown: value || null })} />
            <ObjectiveEditor objectives={objectives} setObjectives={setObjectives} typeOptions={itemsFor("objective_type")} />
            <TextArea label="达标标准 Markdown" value={lesson.success_criteria_markdown ?? ""} onChange={(value) => setLesson({ ...lesson, success_criteria_markdown: value || null })} />
            <TextArea label="核心带走内容 Markdown" value={lesson.takeaway_markdown ?? ""} onChange={(value) => setLesson({ ...lesson, takeaway_markdown: value || null })} />
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs text-txs">正文 Markdown</p>
          <MarkdownEditor value={lesson.body_markdown ?? ""} onChange={(value) => setLesson({ ...lesson, body_markdown: value || null })} />
        </div>

        <ResourceEditor
          resources={bundle.resources}
          resourceTitle={resourceTitle}
          resourceUrl={resourceUrl}
          setResourceTitle={setResourceTitle}
          setResourceUrl={setResourceUrl}
          onAdd={() => void addResource()}
          onUpload={uploadResource}
        />

        <KnowledgeCardEditor
          lessonId={lesson.id}
          cards={bundle.cards}
          typeOptions={itemsFor("knowledge_card_type")}
          onSaved={onSaved}
        />

        <AssessmentEditor
          lessonId={lesson.id}
          assessments={bundle.assessments}
          assessmentTypes={itemsFor("assessment_type")}
          itemTypes={itemsFor("item_type")}
          gradingModes={itemsFor("grading_mode")}
          onSaved={onSaved}
        />
      </div>
    </div>
  );
}

function ObjectiveEditor({ objectives, setObjectives, typeOptions }: { objectives: V2Objective[]; setObjectives: (value: V2Objective[]) => void; typeOptions: V2DictionaryItem[] }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-txs">学习目标</p>
        <button
          type="button"
          onClick={() => setObjectives([...objectives, { id: crypto.randomUUID(), text: "", type_id: null }])}
          className="inline-flex items-center gap-1 text-[10px] font-ds-bold text-ac hover:underline"
        >
          <Plus className="h-3 w-3" />添加目标
        </button>
      </div>
      <div className="mt-2 space-y-2">
        {objectives.map((objective, index) => (
          <div key={objective.id || index} className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
            <select
              aria-label={`学习目标 ${index + 1} 类型`}
              value={objective.type_id ?? ""}
              onChange={(event) => setObjectives(objectives.map((row, rowIndex) => rowIndex === index ? { ...row, type_id: event.target.value || null } : row))}
              className="rounded-xl border border-bdl bg-white px-3 py-2 text-xs text-tx outline-none"
            >
              <option value="">选择目标类型</option>
              {typeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            <input
              aria-label={`学习目标 ${index + 1}`}
              value={objective.text}
              onChange={(event) => setObjectives(objectives.map((row, rowIndex) => rowIndex === index ? { ...row, text: event.target.value } : row))}
              placeholder="能够……"
              className="rounded-xl border border-bdl bg-white px-3 py-2 text-sm text-tx outline-none focus:border-ac"
            />
            <button type="button" onClick={() => setObjectives(objectives.filter((_, rowIndex) => rowIndex !== index))} aria-label={`删除学习目标 ${index + 1}`} className="rounded-lg px-2 text-txs hover:bg-red-50 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {objectives.length === 0 && <p className="rounded-xl border border-dashed border-bdl bg-white/50 px-3 py-4 text-center text-[11px] text-txs">暂无学习目标，点击“添加目标”并显式选择类型。</p>}
      </div>
    </div>
  );
}

function KnowledgeCardEditor({ lessonId, cards, typeOptions, onSaved }: { lessonId: string; cards: V2KnowledgeCard[]; typeOptions: V2DictionaryItem[]; onSaved: () => Promise<void> | void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [typeId, setTypeId] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setEditingId(null);
    setTitle("");
    setContent("");
    setTypeId("");
  }

  function edit(card: V2KnowledgeCard) {
    setEditingId(card.id);
    setTitle(card.title);
    setContent(card.content_markdown);
    setTypeId(card.card_type_id ?? "");
  }

  async function save() {
    if (!title.trim() || !content.trim()) {
      toast.error("知识卡标题和内容不能为空");
      return;
    }
    setSaving(true);
    try {
      await saveV2CardAdmin({
        lesson_id: lessonId,
        title: title.trim(),
        content_markdown: content,
        card_type_id: typeId || null,
        is_active: true,
        sort_order: editingId ? (cards.find((card) => card.id === editingId)?.sort_order ?? 0) : cards.length,
      }, editingId ?? undefined);
      toast.success(editingId ? "知识卡已更新" : "知识卡已添加");
      reset();
      await onSaved();
    } catch (error) {
      console.error(error);
      toast.error("知识卡保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function remove(card: V2KnowledgeCard) {
    if (!window.confirm(`确定删除知识卡“${card.title}”吗？学员已有的对应收藏也会一并移除。`)) return;
    try {
      await deleteV2CardAdmin(card.id);
      if (editingId === card.id) reset();
      toast.success("知识卡已删除");
      await onSaved();
    } catch (error) {
      console.error(error);
      toast.error("知识卡删除失败");
    }
  }

  return (
    <div className="rounded-2xl border border-[#efb393]/35 bg-[#fffaf2] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-ds-bold text-tx">知识卡（{cards.length}）</p>
        <span className="text-[10px] text-txs">可编辑、删除和独立收藏</span>
      </div>
      <div className="mt-3 grid gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="卡片标题" value={title} onChange={setTitle} />
          <SelectField label="知识卡类型" value={typeId} onChange={setTypeId} options={typeOptions} placeholder="选择类型" />
        </div>
        <TextArea label="卡片内容 Markdown" value={content} onChange={setContent} />
        <div className="flex gap-2">
          <Button onClick={() => void save()} disabled={saving} variant="outline" className="w-fit border-bdl bg-white text-tx">
            {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{editingId ? "保存知识卡" : "添加知识卡"}
          </Button>
          {editingId && <Button onClick={reset} variant="ghost" className="text-txs"><X className="h-4 w-4" />取消编辑</Button>}
        </div>
        {cards.map((card) => (
          <div key={card.id} className="rounded-xl border border-bdl bg-white/70 p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-ds-bold text-tx">{card.title}</p>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[11px] text-txs">{card.content_markdown}</p>
              </div>
              <button type="button" onClick={() => edit(card)} aria-label={`编辑知识卡 ${card.title}`} className="rounded-lg p-1.5 text-ac hover:bg-acl"><Pencil className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => void remove(card)} aria-label={`删除知识卡 ${card.title}`} className="rounded-lg p-1.5 text-txs hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssessmentEditor({ lessonId, assessments, assessmentTypes, itemTypes, gradingModes, onSaved }: { lessonId: string; assessments: V2LessonBundle["assessments"]; assessmentTypes: V2DictionaryItem[]; itemTypes: V2DictionaryItem[]; gradingModes: V2DictionaryItem[]; onSaved: () => Promise<void> | void }) {
  const [typeId, setTypeId] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("10");
  const [required, setRequired] = useState(true);
  const [saving, setSaving] = useState(false);

  function selectPreset(key: string) {
    const type = assessmentTypes.find((item) => item.key === key);
    setTypeId(type?.id ?? "");
    const labels: Record<string, string> = { pretest: "课前诊断", practice: "课中练习", posttest: "课后达标测试", authentic_task: "开放性真实任务" };
    setTitle(labels[key] ?? "");
  }

  async function addBlock() {
    if (!title.trim()) {
      toast.error("请填写评估区块标题");
      return;
    }
    setSaving(true);
    try {
      await saveV2Block({
        lesson_id: lessonId,
        unit_id: null,
        assessment_type_id: typeId || null,
        title: title.trim(),
        instructions_markdown: instructions.trim() || null,
        required,
        estimated_minutes: estimatedMinutes ? Number(estimatedMinutes) : null,
        sort_order: assessments.length,
        status: "draft",
      });
      setTitle("");
      setInstructions("");
      toast.success("评估区块已创建，请继续添加试题");
      await onSaved();
    } catch (error) {
      console.error(error);
      toast.error("评估区块创建失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-bdl p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-ds-bold text-tx">评估区块（{assessments.length}）</p>
          <p className="mt-1 text-[10px] text-txs">新建区块默认为草稿。添加完试题后，点击“发布到课程详情页”才会对学员显示。</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {assessmentTypes.map((type) => (
            <button key={type.id} type="button" onClick={() => selectPreset(type.key)} className="rounded-full border border-bdl bg-white px-2.5 py-1 text-[10px] font-ds-bold text-ac hover:border-ac">{type.label}</button>
          ))}
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-[#efb393]/35 bg-[#fffaf2] p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <SelectField label="评估类型" value={typeId} onChange={setTypeId} options={assessmentTypes} placeholder="选择前测 / 后测 / 真实任务" />
          <Field label="区块标题" value={title} onChange={setTitle} placeholder="例如：课后达标测试" />
          <Field label="预计分钟" value={estimatedMinutes} onChange={setEstimatedMinutes} />
          <label className="flex items-center gap-2 self-end rounded-xl border border-bdl bg-white px-3 py-2 text-xs text-txs"><input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} />必做</label>
        </div>
        <div className="mt-2"><TextArea label="作答说明 Markdown" value={instructions} onChange={setInstructions} /></div>
        <Button onClick={() => void addBlock()} disabled={saving} variant="outline" className="mt-3 border-bdl bg-white text-tx"><Plus className="h-4 w-4" />创建评估区块</Button>
      </div>
      <div className="mt-4 space-y-3">
        {assessments.map((assessment) => (
          <AssessmentBlockEditor key={assessment.id} assessment={assessment} assessmentTypes={assessmentTypes} itemTypes={itemTypes} gradingModes={gradingModes} onSaved={onSaved} />
        ))}
      </div>
    </div>
  );
}

function AssessmentBlockEditor({ assessment, assessmentTypes, itemTypes, gradingModes, onSaved }: { assessment: V2LessonBundle["assessments"][number]; assessmentTypes: V2DictionaryItem[]; itemTypes: V2DictionaryItem[]; gradingModes: V2DictionaryItem[]; onSaved: () => Promise<void> | void }) {
  const [block, setBlock] = useState<V2AssessmentBlock>(assessment);
  const [editingItem, setEditingItem] = useState<(V2AssessmentItem & { options: V2LessonBundle["assessments"][number]["items"][number]["options"] }) | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [newItemTypeId, setNewItemTypeId] = useState("");

  useEffect(() => setBlock(assessment), [assessment]);

  async function saveBlock(statusOverride?: V2AssessmentBlock["status"]) {
    const nextBlock = statusOverride ? { ...block, status: statusOverride } : block;
    try {
      const saved = await saveV2Block(nextBlock, block.id);
      setBlock(saved);
      toast.success(statusOverride === "published" ? "评估区块已发布，课程详情页已显示" : "评估区块已保存");
      await onSaved();
    } catch (error) {
      console.error(error);
      toast.error("评估区块保存失败");
    }
  }

  async function publishBlock() {
    if (assessment.items.length === 0) {
      toast.error("请至少添加一道试题后再发布");
      return;
    }
    await saveBlock("published");
  }

  async function removeBlock() {
    if (!window.confirm(`确定删除评估区块“${assessment.title}”吗？其中的试题、作答和批阅记录都会删除。`)) return;
    try {
      await deleteV2AssessmentBlockAdmin(assessment.id);
      toast.success("评估区块已删除");
      await onSaved();
    } catch (error) {
      console.error(error);
      toast.error("评估区块删除失败");
    }
  }

  return (
    <div className="rounded-xl border border-bdl bg-bgs/35 p-4">
      <div className={`mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 ${isV2AssessmentVisibleOnLesson(block.status) ? "border-tl/20 bg-tll text-tl" : "border-[#efb393]/45 bg-[#fffaf2] text-[#9a5b3c]"}`}>
        <p className="text-[11px] font-ds-bold">
          {isV2AssessmentVisibleOnLesson(block.status)
            ? "已发布：该区块及试题会显示在 V2 课程详情页"
            : "当前为草稿：区块和试题不会显示在 V2 课程详情页"}
        </p>
        {canPublishV2AssessmentBlock(block.status, assessment.items.length) && (
          <Button onClick={() => void publishBlock()} size="sm" className="bg-[#173d39] text-white hover:bg-[#24554e]">
            <PlayCircle className="h-3.5 w-3.5" />发布到课程详情页
          </Button>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="区块标题" value={block.title} onChange={(value) => setBlock({ ...block, title: value })} />
        <SelectField label="评估类型" value={block.assessment_type_id ?? ""} onChange={(value) => setBlock({ ...block, assessment_type_id: value || null })} options={assessmentTypes} placeholder="选择类型" />
        <Field label="预计分钟" value={String(block.estimated_minutes ?? "")} onChange={(value) => setBlock({ ...block, estimated_minutes: value ? Number(value) : null })} />
        <label className="text-xs text-txs">状态<select value={block.status} onChange={(event) => setBlock({ ...block, status: event.target.value as V2AssessmentBlock["status"] })} className="mt-1 w-full rounded-xl border border-bdl bg-white px-3 py-2 text-sm text-tx outline-none"><option value="draft">草稿</option><option value="published">已发布</option><option value="archived">已归档</option></select></label>
      </div>
      <div className="mt-2"><TextArea label="作答说明 Markdown" value={block.instructions_markdown ?? ""} onChange={(value) => setBlock({ ...block, instructions_markdown: value || null })} /></div>
      <label className="mt-2 flex items-center gap-2 text-xs text-txs"><input type="checkbox" checked={block.required} onChange={(event) => setBlock({ ...block, required: event.target.checked })} />必做区块</label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => void saveBlock()} size="sm" variant="outline" className="border-bdl bg-white text-tx"><Save className="h-3.5 w-3.5" />保存区块</Button>
        <Button onClick={() => { setEditingItem(null); setNewItemTypeId(itemTypes[0]?.id ?? ""); setShowComposer(true); }} size="sm" className="bg-[#173d39] text-white hover:bg-[#24554e]"><Plus className="h-3.5 w-3.5" />新建题目</Button>
        <Button onClick={() => void removeBlock()} size="sm" variant="ghost" className="text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" />删除区块</Button>
      </div>

      <div className="mt-3 rounded-xl border border-ac/15 bg-white/70 p-3">
        <p className="text-[10px] font-ds-bold text-txs">按题型添加</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {itemTypes.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => {
                setEditingItem(null);
                setNewItemTypeId(type.id);
                setShowComposer(true);
              }}
              className="rounded-ds-pill border border-bd bg-bg px-3 py-1.5 text-ds-xs text-txs transition-colors hover:border-ac hover:bg-acl hover:text-ac"
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {(showComposer || editingItem) && (
        <AssessmentItemComposer
          key={editingItem?.id ?? `new-${assessment.id}-${newItemTypeId}`}
          assessmentId={assessment.id}
          item={editingItem}
          initialTypeId={newItemTypeId}
          itemTypes={itemTypes}
          gradingModes={gradingModes}
          assessmentStatus={block.status}
          sortOrder={editingItem?.sort_order ?? assessment.items.length}
          onClose={() => { setShowComposer(false); setEditingItem(null); }}
          onSaved={async () => { setShowComposer(false); setEditingItem(null); await onSaved(); }}
        />
      )}

      <div className="mt-3 space-y-2">
        {assessment.items.map((item, index) => (
          <div key={item.id} className="rounded-lg border border-bdl bg-white/70 px-3 py-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-ds-bold text-tx">{index + 1}. {item.prompt_markdown}</p>
                <p className="mt-1 text-[10px] text-txs">{dictionaryLabel(itemTypes, item.item_type_id)} · {dictionaryLabel(gradingModes, item.grading_mode_id)}{item.options.length > 0 ? ` · ${item.options.length} 个选项` : ""}</p>
              </div>
              <button type="button" onClick={() => { setEditingItem(item); setNewItemTypeId(""); setShowComposer(false); }} aria-label={`编辑试题 ${index + 1}`} className="rounded-lg p-1.5 text-ac hover:bg-acl"><Pencil className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={async () => { if (!window.confirm("确定删除这道试题吗？")) return; await deleteV2AssessmentItemAdmin(item.id); toast.success("试题已删除"); await onSaved(); }} aria-label={`删除试题 ${index + 1}`} className="rounded-lg p-1.5 text-txs hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type AdminAssessmentItem = V2AssessmentItem & { options: V2LessonBundle["assessments"][number]["items"][number]["options"] };

function AssessmentItemComposer({ assessmentId, item, initialTypeId, itemTypes, gradingModes, assessmentStatus, sortOrder, onClose, onSaved }: { assessmentId: string; item: AdminAssessmentItem | null; initialTypeId: string; itemTypes: V2DictionaryItem[]; gradingModes: V2DictionaryItem[]; assessmentStatus: V2AssessmentBlock["status"]; sortOrder: number; onClose: () => void; onSaved: () => Promise<void> | void }) {
  const defaultType = item?.item_type_id || initialTypeId || itemTypes[0]?.id || "";
  const [typeId, setTypeId] = useState(defaultType);
  const [gradingModeId, setGradingModeId] = useState(item?.grading_mode_id ?? "");
  const [prompt, setPrompt] = useState(item?.prompt_markdown ?? "");
  const [caseMarkdown, setCaseMarkdown] = useState(item?.case_markdown ?? "");
  const [maxScore, setMaxScore] = useState(String(item?.max_score ?? ""));
  const [rubricText, setRubricText] = useState(() => rubricToText(item?.rubric));
  const [options, setOptions] = useState(() => item?.options.map((option) => ({ key: option.option_key, text: option.option_text, sort_order: option.sort_order })) ?? []);
  const [correct, setCorrect] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const typeKey = itemTypes.find((type) => type.id === typeId)?.key ?? "";
  const isChoice = ["single_choice", "multiple_choice", "true_false"].includes(typeKey);
  const questionTypes: QuestionSettingsTypeOption[] = itemTypes.map((type) => ({
    value: type.id,
    label: type.label,
    kind: type.key === "single_choice"
      ? "single"
      : type.key === "multiple_choice"
        ? "multiple"
        : type.key === "true_false"
          ? "true_false"
          : "text",
  }));

  useEffect(() => {
    if (!item) return;
    getV2AssessmentKeyAdmin(item.id)
      .then((key) => setCorrect(Array.isArray(key?.correct) ? key.correct : []))
      .catch((error) => {
        console.error(error);
        toast.error("正确答案加载失败");
      });
  }, [item]);

  useEffect(() => {
    if (typeKey === "true_false" && options.length === 0) {
      setOptions([
        { key: "T", text: "正确", sort_order: 0 },
        { key: "F", text: "错误", sort_order: 1 },
      ]);
    } else if (["single_choice", "multiple_choice"].includes(typeKey) && options.length === 0) {
      setOptions(["A", "B", "C", "D"].map((key, index) => ({ key, text: "", sort_order: index })));
    }
    if (!gradingModeId) {
      const desired = isChoice ? "auto" : "manual";
      setGradingModeId(gradingModes.find((mode) => mode.key === desired)?.id ?? "");
    }
  }, [gradingModeId, gradingModes, isChoice, options.length, typeKey]);

  function changeType(value: string) {
    const key = itemTypes.find((type) => type.id === value)?.key;
    setTypeId(value);
    setCorrect([]);
    if (key === "true_false") {
      setOptions([
        { key: "T", text: "正确", sort_order: 0 },
        { key: "F", text: "错误", sort_order: 1 },
      ]);
    } else if (key === "single_choice" || key === "multiple_choice") {
      setOptions(["A", "B", "C", "D"].map((optionKey, index) => ({ key: optionKey, text: "", sort_order: index })));
    } else {
      setOptions([]);
    }
    const gradingKey = key === "single_choice" || key === "multiple_choice" || key === "true_false" ? "auto" : "manual";
    setGradingModeId(gradingModes.find((mode) => mode.key === gradingKey)?.id ?? "");
  }

  async function save() {
    if (!prompt.trim() || !typeId) {
      toast.error("请选择题型并填写题目");
      return;
    }
    const validOptions = options.filter((option) => option.key.trim() && option.text.trim());
    if (isChoice && (validOptions.length < 2 || correct.length === 0)) {
      toast.error("选择题至少需要 2 个选项并设置正确答案");
      return;
    }
    setSaving(true);
    try {
      await saveV2AssessmentItemAdmin({
        assessment_block_id: assessmentId,
        item_type_id: typeId,
        grading_mode_id: gradingModeId || null,
        prompt_markdown: prompt.trim(),
        case_markdown: caseMarkdown.trim() || null,
        max_score: maxScore ? Number(maxScore) : null,
        rubric: rubricText.trim() ? { criteria: rubricText.split("\n").map((line) => line.trim()).filter(Boolean) } : null,
        sort_order: sortOrder,
        is_required: true,
        options: validOptions.map((option, index) => ({ ...option, sort_order: index })),
        answer_key: isChoice ? { correct } : null,
      }, item?.id);
      toast.success(
        assessmentStatus === "published"
          ? (item ? "试题已更新，课程详情页已同步" : "试题已添加，课程详情页已同步")
          : (item ? "试题已更新；发布评估区块后才会显示在课程详情页" : "试题已添加；发布评估区块后才会显示在课程详情页"),
      );
      await onSaved();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "试题保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-ac/25 bg-white p-4">
      <div className="flex items-center justify-between"><p className="text-xs font-ds-bold text-tx">{item ? "编辑试题 / 任务" : "添加试题 / 任务"}</p><button type="button" onClick={onClose} className="text-xs text-txs hover:text-tx"><X className="h-4 w-4" /></button></div>
      <div className="mt-3">
        <QuestionSettingsFields
          type={typeId}
          types={questionTypes}
          prompt={prompt}
          options={options.map((option) => ({ key: option.key, text: option.text }))}
          correct={correct}
          namePrefix={`v2-${assessmentId}-${item?.id ?? "new"}`}
          promptLabel="题目 Markdown"
          promptPlaceholder="写清楚题目情境、问题和学员需要提交的答案"
          onTypeChange={changeType}
          onPromptChange={setPrompt}
          onOptionsChange={(nextOptions) => setOptions(nextOptions.map((option, index) => ({ ...option, sort_order: index })))}
          onCorrectChange={setCorrect}
        />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <SelectField label="评分方式" value={gradingModeId} onChange={setGradingModeId} options={gradingModes} placeholder="选择评分方式" />
        <Field label="分值" value={maxScore} onChange={setMaxScore} placeholder="10" />
      </div>
      {(typeKey === "open_task" || typeKey === "short_answer") && <div className="mt-2 grid gap-2"><TextArea label="案例 / 真实情境 Markdown（可选）" value={caseMarkdown} onChange={setCaseMarkdown} /><TextArea label="批阅标准（每行一条）" value={rubricText} onChange={setRubricText} /></div>}
      <Button onClick={() => void save()} disabled={saving} className="mt-4 bg-[#173d39] text-white hover:bg-[#24554e]"><Save className="h-4 w-4" />{saving ? "保存中…" : "保存试题"}</Button>
    </div>
  );
}

function ResourceEditor({ resources, resourceTitle, resourceUrl, setResourceTitle, setResourceUrl, onAdd, onUpload }: { resources: V2LessonBundle["resources"]; resourceTitle: string; resourceUrl: string; setResourceTitle: (value: string) => void; setResourceUrl: (value: string) => void; onAdd: () => void; onUpload: (file: File) => void }) {
  return (
    <div className="rounded-2xl border border-bdl p-4">
      <div className="flex items-center justify-between"><p className="text-xs font-ds-bold text-tx">正文与资源（{resources.length}）</p><span className="text-[10px] text-txs">支持外链或上传到 R2</span></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1.5fr_auto_auto]">
        <input value={resourceTitle} onChange={(event) => setResourceTitle(event.target.value)} placeholder="资源名称" className="rounded-xl border border-bdl bg-white px-3 py-2 text-xs text-tx outline-none focus:border-ac" />
        <input value={resourceUrl} onChange={(event) => setResourceUrl(event.target.value)} placeholder="https://... 外链" className="rounded-xl border border-bdl bg-white px-3 py-2 text-xs text-tx outline-none focus:border-ac" />
        <Button onClick={onAdd} variant="outline" className="border-bdl bg-white text-tx"><Plus className="h-4 w-4" />外链</Button>
        <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-bdl bg-white px-3 py-2 text-xs font-medium text-tx hover:border-ac"><input type="file" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.target.value = ""; }} /><LinkIcon className="h-4 w-4" />上传</label>
      </div>
      <div className="mt-3 space-y-2">{resources.map((resource) => <div key={resource.id} className="flex items-center gap-2 rounded-xl bg-bgs/45 px-3 py-2 text-xs"><LinkIcon className="h-3.5 w-3.5 text-ac" /><span className="min-w-0 flex-1 truncate text-tx">{resource.title ?? resource.external_url}</span>{resource.external_url && <a href={resource.external_url} target="_blank" rel="noreferrer" className="text-ac hover:underline">打开</a>}</div>)}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="text-xs text-txs">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-xl border border-bdl bg-white px-3 py-2 text-sm text-tx outline-none focus:border-ac" /></label>;
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-xs text-txs">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-bdl bg-white px-3 py-2 text-sm text-tx outline-none focus:border-ac" /></label>;
}

function SelectField({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (value: string) => void; options: V2DictionaryItem[]; placeholder: string }) {
  return <label className="text-xs text-txs">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-bdl bg-white px-3 py-2 text-sm text-tx outline-none"><option value="">{placeholder}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>;
}

function dictionaryLabel(items: V2DictionaryItem[], id: string | null): string {
  return items.find((item) => item.id === id)?.label ?? "未设置类型";
}

function rubricToText(rubric: Record<string, unknown> | null | undefined): string {
  if (!rubric || !Array.isArray(rubric.criteria)) return "";
  return rubric.criteria.filter((value): value is string => typeof value === "string").join("\n");
}
