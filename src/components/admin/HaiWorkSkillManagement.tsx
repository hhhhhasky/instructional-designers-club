import {
  SkillAdvancedSettings,
  skillVersionStatus,
  confirmSkillNavigation,
  useWarnOnUnsavedChanges,
} from "@/components/admin/hai/HaiConfigWorkspace";
import {
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { HaiFeatureModule } from "@/db/hai-api";
import { supabase } from "@/db/supabase";

type WorkSkill = {
  id: string;
  slug: string;
  module_slug: string;
  name: string;
  description: string;
  match_criteria: Record<string, unknown>;
  priority: number;
  is_fallback: boolean;
  is_enabled: boolean;
  updated_at: string;
};

type WorkSkillVersion = {
  id: string;
  skill_id: string;
  version_label: string;
  status: "draft" | "published" | "archived";
  prompt_template: string;
  default_prompt_template: string;
  input_contract: Record<string, unknown>;
  output_contract: Record<string, unknown>;
  snapshot_hash: string;
  source_metadata: Record<string, unknown>;
  published_at: string | null;
  updated_at: string;
};

export type WorkSkillReferenceDraft = {
  id: string;
  skill_version_id: string;
  path: string;
  name: string;
  description: string;
  media_type: string;
  content: string;
  content_hash: string;
  load_mode: "always" | "case" | "issue" | "task" | "evaluation_only";
  max_chars: number;
  sort_order: number;
  metadata: Record<string, unknown>;
};

export default function HaiWorkSkillManagement() {
  const [skills, setSkills] = useState<WorkSkill[]>([]);
  const [versions, setVersions] = useState<WorkSkillVersion[]>([]);
  const [references, setReferences] = useState<WorkSkillReferenceDraft[]>([]);
  const [modules, setModules] = useState<HaiFeatureModule[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [skillDraft, setSkillDraft] = useState<WorkSkill | null>(null);
  const [versionDraft, setVersionDraft] = useState<WorkSkillVersion | null>(null);
  const [referenceDrafts, setReferenceDrafts] = useState<WorkSkillReferenceDraft[]>([]);
  const [criteriaText, setCriteriaText] = useState("{}");
  const [outputText, setOutputText] = useState("{}");
  const [showCreator, setShowCreator] = useState(false);
  const [createDraft, setCreateDraft] = useState({
    slug: "",
    module_slug: "subject-lesson-design",
    name: "",
    description: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [editorTab, setEditorTab] = useState("prompt");

  const selectedSkill = skills.find((item) => item.id === selectedSkillId) ?? null;
  const skillVersions = useMemo(
    () => versions.filter((item) => item.skill_id === selectedSkillId),
    [selectedSkillId, versions],
  );
  const moduleOptions = useMemo(
    () => modules.map((module) => ({ value: module.slug, label: module.name })),
    [modules],
  );

  const originalVersion = versions.find((item) => item.id === selectedVersionId);
  const hasUnsavedEdits = Boolean(
    (skillDraft && selectedSkill && JSON.stringify(skillDraft) !== JSON.stringify(selectedSkill)) ||
      (versionDraft && originalVersion && JSON.stringify(versionDraft) !== JSON.stringify(originalVersion)) ||
      JSON.stringify(referenceDrafts) !==
        JSON.stringify(references.filter((item) => item.skill_version_id === selectedVersionId)) ||
      (originalVersion && outputText !== JSON.stringify(originalVersion.output_contract ?? {}, null, 2)) ||
      (selectedSkill && criteriaText !== JSON.stringify(selectedSkill.match_criteria ?? {}, null, 2)),
  );

  useWarnOnUnsavedChanges(hasUnsavedEdits);

  async function loadAll(preferredSkillId?: string, preferredVersionId?: string) {
    setLoading(true);
    const [skillResult, versionResult, moduleResult, referenceResult] = await Promise.all([
      supabase
        .from("hai_work_skills")
        .select("*")
        .order("module_slug")
        .order("priority", { ascending: false }),
      supabase.from("hai_work_skill_versions").select("*").order("created_at", { ascending: false }),
      supabase
        .from("hai_feature_modules")
        .select("*")
        .eq("surface_mode", "work")
        .order("sort_order", { ascending: true }),
      supabase.from("hai_work_skill_references").select("*").order("sort_order").order("path"),
    ]);
    if (skillResult.error || versionResult.error || moduleResult.error || referenceResult.error) {
      setStatus(
        skillResult.error?.message ||
          versionResult.error?.message ||
          moduleResult.error?.message ||
          referenceResult.error?.message ||
          "Work 工具加载失败。",
      );
      setLoading(false);
      return;
    }
    const nextSkills = (skillResult.data as WorkSkill[]) ?? [];
    const nextVersions = (versionResult.data as WorkSkillVersion[]) ?? [];
    setSkills(nextSkills);
    setVersions(nextVersions);
    setReferences((referenceResult.data as WorkSkillReferenceDraft[]) ?? []);
    setModules((moduleResult.data as HaiFeatureModule[]) ?? []);
    const nextSkillId = preferredSkillId || selectedSkillId || nextSkills[0]?.id || "";
    const nextSkillVersions = nextVersions.filter((item) => item.skill_id === nextSkillId);
    setSelectedSkillId(nextSkillId);
    setModuleFilter(nextSkills.find((skill) => skill.id === nextSkillId)?.module_slug || "");
    setSelectedVersionId(
      preferredVersionId ||
        nextSkillVersions.find((item) => item.status === "published")?.id ||
        nextSkillVersions[0]?.id ||
        "",
    );
    setLoading(false);
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!selectedSkill) {
      setSkillDraft(null);
      return;
    }
    setSkillDraft({ ...selectedSkill });
    setCriteriaText(JSON.stringify(selectedSkill.match_criteria ?? {}, null, 2));
    const nextVersions = versions.filter((item) => item.skill_id === selectedSkill.id);
    if (!nextVersions.some((item) => item.id === selectedVersionId)) {
      setSelectedVersionId(
        nextVersions.find((item) => item.status === "published")?.id || nextVersions[0]?.id || "",
      );
    }
  }, [selectedSkillId, selectedSkill?.updated_at]);

  useEffect(() => {
    const selected = versions.find((item) => item.id === selectedVersionId) ?? null;
    setVersionDraft(selected ? { ...selected } : null);
    setOutputText(JSON.stringify(selected?.output_contract ?? {}, null, 2));
    setReferenceDrafts(
      references
        .filter((item) => item.skill_version_id === selectedVersionId)
        .map((item) => ({ ...item, metadata: { ...item.metadata } })),
    );
  }, [selectedVersionId, originalVersion?.updated_at]);

  async function saveSkill() {
    if (!skillDraft || saving) return;
    const criteria = parseJson(criteriaText, "匹配条件");
    if (!criteria) return;
    setSaving(true);
    const { error } = await supabase
      .from("hai_work_skills")
      .update({
        name: skillDraft.name.trim(),
        description: skillDraft.description.trim(),
        match_criteria: criteria,
        priority: skillDraft.priority,
      })
      .eq("id", skillDraft.id);
    setSaving(false);
    if (error) return setStatus(error.message);
    setStatus("Work Skill 元数据已保存。");
    await loadAll(skillDraft.id, selectedVersionId);
  }

  async function toggleSkillEnabled() {
    if (!skillDraft || saving) return;
    const nextEnabled = !skillDraft.is_enabled;
    const blockedReason = workSkillEnableBlockReason(nextEnabled, skillVersions);
    if (blockedReason) return setStatus(blockedReason);
    setSaving(true);
    const { data, error } = await supabase.rpc("hai_set_work_skill_enabled", {
      p_skill_id: skillDraft.id,
      p_enabled: nextEnabled,
    });
    setSaving(false);
    if (error) return setStatus(error.message);
    const toolVisible = data === true;
    setStatus(
      nextEnabled
        ? `Skill 已启用，所属工具${toolVisible ? "已在前端显示" : "暂未显示"}。`
        : `Skill 已停用，所属工具${toolVisible ? "仍有其他可用 Skill，继续显示" : "已从前端隐藏"}。`,
    );
    await loadAll(skillDraft.id, selectedVersionId);
  }

  async function saveVersion(): Promise<boolean> {
    if (!versionDraft || saving) return false;
    const blockedReason = workReferenceEditBlockReason(versionDraft.status);
    if (blockedReason) {
      setStatus(blockedReason);
      return false;
    }
    const outputContract = parseJson(outputText, "输出契约");
    if (!outputContract) return false;
    if (!versionDraft.prompt_template.trim()) {
      setStatus("提示词不能为空。");
      return false;
    }
    setSaving(true);
    const { error } = await supabase.rpc("hai_save_work_skill_draft_snapshot", {
      p_version_id: versionDraft.id,
      p_version_label: versionDraft.version_label.trim(),
      p_instructions: versionDraft.prompt_template,
      p_input_contract: versionDraft.input_contract ?? {},
      p_output_contract: outputContract,
      p_references: serializeWorkReferences(referenceDrafts),
    });
    setSaving(false);
    if (error) {
      setStatus(error.message);
      return false;
    }
    setStatus(`Skill 主文档与 ${referenceDrafts.length} 个 reference 已作为同一草稿快照保存。`);
    await loadAll(selectedSkillId, versionDraft.id);
    return true;
  }

  async function publishVersion() {
    if (!versionDraft || saving) return;
    const saved = await saveVersion();
    if (!saved) return;
    setSaving(true);
    const { error } = await supabase.rpc("hai_publish_work_skill_version", { p_version_id: versionDraft.id });
    setSaving(false);
    if (error) return setStatus(error.message);
    setStatus(`已发布 ${versionDraft.version_label}，之后的新任务会使用该版本。`);
    await loadAll(selectedSkillId, versionDraft.id);
  }

  async function restoreDefault() {
    if (!versionDraft || !versionDraft.default_prompt_template || saving) return;
    setVersionDraft({ ...versionDraft, prompt_template: versionDraft.default_prompt_template });
    setStatus("已恢复为种子默认内容，点击“保存版本”后生效。");
  }

  async function makeFallback() {
    if (!skillDraft || saving) return;
    setSaving(true);
    const { error } = await supabase.rpc("hai_set_work_fallback_skill", { p_skill_id: skillDraft.id });
    setSaving(false);
    if (error) return setStatus(error.message);
    setStatus("已设为该功能的通用降级 Skill。");
    await loadAll(skillDraft.id, selectedVersionId);
  }

  async function deleteSkill() {
    if (!selectedSkill || saving) return;
    const blockedReason = workSkillDeleteBlockReason(selectedSkill);
    if (blockedReason) return setStatus(blockedReason);
    if (
      !window.confirm(
        `确定删除“${selectedSkill.name}”及其 ${skillVersions.length} 个提示词版本吗？历史任务中的 Skill 快照会保留。`,
      )
    )
      return;
    const nextSkillId = skills.find((item) => item.id !== selectedSkill.id)?.id;
    setSaving(true);
    const { error } = await supabase.from("hai_work_skills").delete().eq("id", selectedSkill.id);
    setSaving(false);
    if (error) return setStatus(error.message);
    setStatus(`已删除 Skill“${selectedSkill.name}”。`);
    setSelectedSkillId("");
    setSelectedVersionId("");
    await loadAll(nextSkillId);
  }

  async function deleteVersion() {
    if (!versionDraft || !selectedSkill || saving) return;
    const blockedReason = workVersionDeleteBlockReason(versionDraft);
    if (blockedReason) return setStatus(blockedReason);
    if (
      !window.confirm(`确定删除“${selectedSkill.name} / ${versionDraft.version_label}”吗？此操作不可撤销。`)
    )
      return;
    setSaving(true);
    const { error } = await supabase.from("hai_work_skill_versions").delete().eq("id", versionDraft.id);
    setSaving(false);
    if (error) return setStatus(error.message);
    setStatus(`已删除版本 ${versionDraft.version_label}。`);
    setSelectedVersionId("");
    await loadAll(selectedSkill.id);
  }

  async function addVersion() {
    if (!selectedSkill || saving) return;
    const versionLabel = nextWorkVersionLabel(skillVersions);
    setSaving(true);
    const { data, error } = await supabase.rpc("hai_clone_work_skill_version", {
      p_skill_id: selectedSkill.id,
      p_version_label: versionLabel,
    });
    setSaving(false);
    if (error) return setStatus(error.message);
    setStatus(`已将当前版本及其 references 完整复制为草稿 ${versionLabel}。`);
    await loadAll(selectedSkill.id, String(data));
  }

  async function createSkill() {
    if (!createDraft.slug.trim() || !createDraft.name.trim() || saving) return;
    setSaving(true);
    const { data: skill, error } = await supabase
      .from("hai_work_skills")
      .insert({
        slug: createDraft.slug.trim(),
        module_slug: createDraft.module_slug,
        name: createDraft.name.trim(),
        description: createDraft.description.trim(),
        match_criteria: {},
        priority: 10,
        is_fallback: false,
        is_enabled: false,
      })
      .select("id")
      .single();
    if (error || !skill) {
      setSaving(false);
      return setStatus(error?.message || "Skill 创建失败。");
    }
    const { data: version, error: versionError } = await supabase
      .from("hai_work_skill_versions")
      .insert({
        skill_id: skill.id,
        version_label: "v1",
        status: "draft",
        prompt_template: "请补充 Work Skill 提示词。",
        default_prompt_template: "请补充 Work Skill 提示词。",
        input_contract: {},
        output_contract: {},
      })
      .select("id")
      .single();
    setSaving(false);
    if (versionError) {
      await supabase.from("hai_work_skills").delete().eq("id", skill.id);
      return setStatus(`${versionError.message}；未完成的 Skill 已自动清理。`);
    }
    setCreateDraft({ slug: "", module_slug: createDraft.module_slug, name: "", description: "" });
    setShowCreator(false);
    setStatus("新 Skill 已创建为停用草稿，发布版本并启用后参与匹配。");
    await loadAll(skill.id, version.id);
  }

  function parseJson(value: string, label: string) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== "object" || !parsed || Array.isArray(parsed)) throw new Error();
      return parsed as Record<string, unknown>;
    } catch {
      setStatus(`${label}必须是合法 JSON 对象。`);
      return null;
    }
  }

  const activeModuleSlug = moduleFilter || selectedSkill?.module_slug || modules[0]?.slug || "";
  const visibleSkills = skills.filter(
    (skill) =>
      skill.module_slug === activeModuleSlug && `${skill.name} ${skill.description}`.includes(search.trim()),
  );
  const activeModule = modules.find((module) => module.slug === activeModuleSlug);
  return (
    <section className="min-w-0">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BriefcaseBusiness className="mt-1 h-5 w-5 text-ac" />
          <div>
            <h2 className="text-lg font-bold text-tx">Work 工具</h2>
            <p className="mt-1 text-xs leading-relaxed text-txs">
              选择工具与 Skill，集中编辑提示词、参考文档和版本。模型与生成参数在「模型与运行」统一管理。
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowCreator((current) => !current)}>
          {showCreator ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showCreator ? "取消" : "新增 Skill"}
        </Button>
      </header>
      {status && (
        <p role="status" className="mt-4 border-l-2 border-ac bg-bg px-3 py-2 text-xs text-tx">
          {status}
        </p>
      )}
      {showCreator && (
        <div className="mt-4 grid gap-3 border-y border-bd py-4 md:grid-cols-2">
          <AdminInput
            label="Skill 标识"
            value={createDraft.slug}
            placeholder="例如 subject-public-lesson"
            onChange={(value) => setCreateDraft((current) => ({ ...current, slug: value }))}
          />
          <AdminInput
            label="显示名称"
            value={createDraft.name}
            placeholder="例如 高中学科公开课"
            onChange={(value) => setCreateDraft((current) => ({ ...current, name: value }))}
          />
          <label className="text-xs text-txs">
            所属工具
            <select
              value={createDraft.module_slug}
              onChange={(event) =>
                setCreateDraft((current) => ({ ...current, module_slug: event.target.value }))
              }
              className="mt-1 h-10 w-full rounded border border-bd bg-white px-3 text-sm text-tx"
            >
              {moduleOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <AdminInput
            label="说明"
            value={createDraft.description}
            placeholder="适用范围和能力说明"
            onChange={(value) => setCreateDraft((current) => ({ ...current, description: value }))}
          />
          <div className="md:col-span-2 flex justify-end">
            <Button size="sm" disabled={saving} onClick={() => void createSkill()}>
              <Plus className="h-4 w-4" />
              创建停用草稿
            </Button>
          </div>
        </div>
      )}
      {loading ? (
        <p className="py-10 text-sm text-txs">正在加载 Work 工具…</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-1 border-b border-bd pb-3" aria-label="选择 Work 工具">
            {modules.map((module) => (
              <button
                key={module.id}
                type="button"
                aria-pressed={activeModuleSlug === module.slug}
                onClick={() => {
                  if (module.slug !== activeModuleSlug && !confirmSkillNavigation(hasUnsavedEdits)) return;
                  setModuleFilter(module.slug);
                  setSelectedSkillId(skills.find((skill) => skill.module_slug === module.slug)?.id || "");
                }}
                className={`rounded px-3 py-2 text-xs ${activeModuleSlug === module.slug ? "bg-ac text-white" : "text-txs hover:bg-bg"}`}
              >
                {module.name}
                <span className="ml-2 opacity-70">
                  {skills.filter((skill) => skill.module_slug === module.slug).length}
                </span>
              </button>
            ))}
          </div>
          {activeModule && (
            <p className="mt-3 text-xs text-txs">
              {activeModule.description} · {activeModule.is_enabled ? "前端已启用" : "前端已隐藏"}
            </p>
          )}
          <div className="mt-5 grid min-w-0 gap-6 xl:grid-cols-[200px_minmax(0,1fr)]">
            <aside className="min-w-0">
              <label className="mb-3 flex items-center gap-2 border-b border-bd pb-2">
                <Search className="h-4 w-4 text-txs" />
                <input
                  aria-label="搜索 Work Skill"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索 Skill"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </label>
              <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2 xl:max-h-[650px] xl:grid-cols-1">
                {visibleSkills.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    aria-pressed={skill.id === selectedSkillId}
                    onClick={() => {
                      if (skill.id === selectedSkillId || confirmSkillNavigation(hasUnsavedEdits))
                        setSelectedSkillId(skill.id);
                    }}
                    className={`min-w-0 border-l-2 px-3 py-3 text-left ${skill.id === selectedSkillId ? "border-ac bg-ac/5" : "border-transparent hover:bg-bg"}`}
                  >
                    <span className="block text-sm font-bold text-tx">{skill.name}</span>
                    <span className="mt-1 block text-[11px] text-txs">
                      {skill.is_enabled ? "已启用" : "已停用"}
                      {skill.is_fallback ? " · 通用降级" : ""} ·{" "}
                      {versions.find(
                        (version) => version.skill_id === skill.id && version.status === "published",
                      )?.version_label || "仅草稿"}
                    </span>
                  </button>
                ))}
              </div>
              {!visibleSkills.length && (
                <p className="py-5 text-xs text-txs">没有匹配的 Skill。可清空搜索或新增。</p>
              )}
            </aside>
            {selectedSkill && skillDraft ? (
              <div className="min-w-0 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-tx">{selectedSkill.name}</h3>
                    <p className="mt-1 text-xs text-txs">{selectedSkill.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void toggleSkillEnabled()}
                  >
                    {skillDraft.is_enabled ? "停用 Skill" : "启用 Skill"}
                  </Button>
                </div>
                <div className="flex flex-wrap items-end gap-3 border-y border-bd py-3">
                  <label className="min-w-40 flex-1 text-xs text-txs">
                    当前查看版本
                    <select
                      aria-label="Work Skill 版本"
                      value={selectedVersionId}
                      onChange={(event) => {
                        if (confirmSkillNavigation(hasUnsavedEdits)) setSelectedVersionId(event.target.value);
                      }}
                      className="mt-1 h-10 w-full rounded border border-bd bg-white px-3 text-sm text-tx"
                    >
                      {skillVersions.map((version) => (
                        <option key={version.id} value={version.id}>
                          {version.version_label} · {skillVersionStatus(version.status)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button size="sm" variant="outline" disabled={saving} onClick={() => void addVersion()}>
                    <Plus className="h-4 w-4" />
                    复制为草稿版本
                  </Button>
                </div>
                <div className="flex gap-5 border-b border-bd" aria-label="Skill 编辑内容">
                  {[
                    { id: "prompt", name: "主提示词" },
                    { id: "references", name: `参考文档 ${referenceDrafts.length}` },
                    { id: "settings", name: "匹配与设置" },
                  ].map((tab) => (
                    <button
                      type="button"
                      key={tab.id}
                      aria-pressed={editorTab === tab.id}
                      onClick={() => setEditorTab(tab.id)}
                      className={`border-b-2 pb-3 text-xs font-bold ${editorTab === tab.id ? "border-ac text-ac" : "border-transparent text-txs"}`}
                    >
                      {tab.name}
                    </button>
                  ))}
                </div>
                {versionDraft && (
                  <>
                    {versionDraft.status !== "draft" && (
                      <p className="text-xs text-txs">
                        <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                        {versionDraft.status === "published"
                          ? "已发布版本只读，修改前请复制为草稿。"
                          : "已归档版本只读，修改前请复制为草稿。"}
                      </p>
                    )}
                    <div hidden={editorTab !== "prompt"} className="space-y-4">
                      <AdminInput
                        label="版本标签"
                        value={versionDraft.version_label}
                        placeholder="v1"
                        disabled={versionDraft.status !== "draft"}
                        onChange={(value) => setVersionDraft({ ...versionDraft, version_label: value })}
                      />
                      <label className="block text-xs text-txs">
                        Skill 主文档
                        <textarea
                          value={versionDraft.prompt_template}
                          readOnly={versionDraft.status !== "draft"}
                          onChange={(event) =>
                            setVersionDraft({ ...versionDraft, prompt_template: event.target.value })
                          }
                          rows={22}
                          className="mt-2 w-full rounded border border-bd bg-white p-4 text-sm leading-7 text-tx read-only:bg-slate-50"
                        />
                      </label>
                    </div>
                    <div hidden={editorTab !== "references"}>
                      <WorkReferenceEditor
                        references={referenceDrafts}
                        readOnly={versionDraft.status !== "draft"}
                        onChange={setReferenceDrafts}
                      />
                    </div>
                  </>
                )}
                <div hidden={editorTab !== "settings"} className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <AdminInput
                      label="显示名称"
                      value={skillDraft.name}
                      placeholder="Skill 名称"
                      onChange={(value) => setSkillDraft({ ...skillDraft, name: value })}
                    />
                    <AdminInput
                      label="优先级"
                      value={String(skillDraft.priority)}
                      placeholder="0"
                      type="number"
                      onChange={(value) => setSkillDraft({ ...skillDraft, priority: Number(value) || 0 })}
                    />
                    <label className="md:col-span-2 text-xs text-txs">
                      说明
                      <textarea
                        value={skillDraft.description}
                        onChange={(event) =>
                          setSkillDraft({ ...skillDraft, description: event.target.value })
                        }
                        rows={2}
                        className="mt-1 w-full rounded border border-bd bg-white p-3 text-sm text-tx"
                      />
                    </label>
                  </div>
                  <SkillAdvancedSettings label="高级设置 · 匹配条件与输出格式">
                    <label className="block text-xs text-txs">
                      匹配条件 JSON
                      <textarea
                        value={criteriaText}
                        onChange={(event) => setCriteriaText(event.target.value)}
                        rows={5}
                        className="mt-1 w-full rounded border border-bd bg-white p-3 font-mono text-xs text-tx"
                      />
                      <span className="mt-1 block">
                        支持 stages、subjects、lesson_types 数组；空对象表示不限制。
                      </span>
                    </label>
                    {versionDraft && (
                      <label className="block text-xs text-txs">
                        输出契约 JSON
                        <textarea
                          value={outputText}
                          readOnly={versionDraft.status !== "draft"}
                          onChange={(event) => setOutputText(event.target.value)}
                          rows={6}
                          className="mt-1 w-full rounded border border-bd bg-white p-3 font-mono text-xs text-tx read-only:bg-slate-50"
                        />
                      </label>
                    )}
                  </SkillAdvancedSettings>
                  <div className="flex flex-wrap justify-between gap-2">
                    <div className="flex gap-2">
                      {!selectedSkill.is_fallback && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          onClick={() => void makeFallback()}
                        >
                          设为通用降级
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        disabled={saving}
                        onClick={() => void deleteSkill()}
                      >
                        <Trash2 className="h-4 w-4" />
                        删除 Skill
                      </Button>
                    </div>
                    <Button size="sm" disabled={saving} onClick={() => void saveSkill()}>
                      <Save className="h-4 w-4" />
                      保存 Skill 设置
                    </Button>
                  </div>
                </div>
                {versionDraft && (
                  <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-bd bg-white/95 py-4">
                    <span className="text-xs text-txs">
                      {versionDraft.version_label} · {skillVersionStatus(versionDraft.status)}
                      {hasUnsavedEdits ? " · 有未保存修改" : ""}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {versionDraft.status === "draft" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={saving || !versionDraft.default_prompt_template}
                          onClick={() => void restoreDefault()}
                        >
                          <RotateCcw className="h-4 w-4" />
                          恢复默认
                        </Button>
                      )}
                      {versionDraft.status !== "published" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          disabled={saving}
                          onClick={() => void deleteVersion()}
                        >
                          <Trash2 className="h-4 w-4" />
                          删除版本
                        </Button>
                      )}
                      {versionDraft.status === "draft" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saving}
                            onClick={() => void saveVersion()}
                          >
                            <Save className="h-4 w-4" />
                            保存草稿
                          </Button>
                          <Button size="sm" disabled={saving} onClick={() => void publishVersion()}>
                            <Upload className="h-4 w-4" />
                            发布版本
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="py-10 text-sm text-txs">选择一个 Skill 开始编辑。</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export function workSkillDeleteBlockReason(skill: Pick<WorkSkill, "is_enabled" | "is_fallback">) {
  if (skill.is_enabled) return "请先停用并保存这个 Skill，再执行删除。";
  if (skill.is_fallback) return "通用降级 Skill 不能直接删除，请先把同功能的另一个 Skill 设为通用降级。";
  return null;
}

export function workVersionDeleteBlockReason(version: Pick<WorkSkillVersion, "status">) {
  return version.status === "published"
    ? "当前已发布版本不能直接删除。请先发布另一个版本，使它自动归档。"
    : null;
}

export function workSkillEnableBlockReason(
  nextEnabled: boolean,
  versions: Array<Pick<WorkSkillVersion, "status">>,
) {
  if (nextEnabled && !versions.some((version) => version.status === "published")) {
    return "请先发布至少一个 Skill 版本，再启用前端工具。";
  }
  return null;
}

export function workReferenceEditBlockReason(status: WorkSkillVersion["status"]) {
  return status === "draft" ? null : "已发布或已归档版本只读；请先复制为草稿版本，再修改主文档或 reference。";
}

export function normalizeWorkReferencePath(value: string) {
  const normalized = value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/{2,}/g, "/");
  const referenceIndex = normalized.toLowerCase().indexOf("references/");
  if (referenceIndex >= 0) return normalized.slice(referenceIndex);
  const basename = normalized.split("/").filter(Boolean).pop() || "reference.md";
  return `references/${basename}`;
}

export function serializeWorkReferences(references: WorkSkillReferenceDraft[]) {
  return references.map((reference, index) => ({
    path: normalizeWorkReferencePath(reference.path),
    name: reference.name.trim() || reference.path.split("/").pop() || reference.path,
    description: reference.description,
    media_type: reference.media_type || mediaTypeForReferencePath(reference.path),
    content: reference.content,
    load_mode: reference.load_mode,
    max_chars: Math.max(1, Math.min(reference.max_chars || 24000, 50000)),
    sort_order: index * 10,
    metadata: reference.metadata || {},
  }));
}

export function nextWorkVersionLabel(versions: Array<Pick<WorkSkillVersion, "version_label">>) {
  const used = new Set(versions.map((version) => version.version_label));
  let index = versions.length + 1;
  while (used.has(`v${index}`)) index += 1;
  return `v${index}`;
}

function WorkReferenceEditor({
  references,
  readOnly,
  onChange,
}: {
  references: WorkSkillReferenceDraft[];
  readOnly: boolean;
  onChange: (references: WorkSkillReferenceDraft[]) => void;
}) {
  function updateReference(id: string, patch: Partial<WorkSkillReferenceDraft>) {
    onChange(references.map((reference) => (reference.id === id ? { ...reference, ...patch } : reference)));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 text-ac" />
          <div>
            <h4 className="text-ds-xs font-ds-bold text-tx">Reference 文档</h4>
            <p className="mt-1 text-[10px] leading-relaxed text-txs">
              共 {references.length} 个文件。always 每次加载；case、issue、task
              根据用户选择三选一；evaluation_only 不进入正式生成。
            </p>
          </div>
        </div>
        {!readOnly && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onChange([
                ...references,
                createWorkReferenceDraft(
                  `references/reference-${references.length + 1}.md`,
                  references.length,
                ),
              ])
            }
          >
            <Plus className="h-4 w-4" />
            添加 reference
          </Button>
        )}
      </div>

      <div className="rounded-ds-md border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] leading-relaxed text-blue-900">
        参考文档随版本一起保存与发布；按各工具的实际加载策略进入生成。
      </div>

      {references.length === 0 ? (
        <p className="rounded-ds-md border border-dashed border-bd bg-bg px-3 py-5 text-center text-xs text-txs">
          当前版本没有 reference 文档。
        </p>
      ) : (
        references.map((reference, index) => (
          <details key={reference.id} className="space-y-3 border-b border-bd py-3">
            <summary className="cursor-pointer text-sm font-bold text-tx">
              {reference.name || reference.path}
            </summary>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-ds-bold uppercase tracking-wide text-txs">
                Reference {index + 1}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  className="text-[10px] text-red-600 hover:underline"
                  onClick={() => onChange(references.filter((item) => item.id !== reference.id))}
                >
                  移除
                </button>
              )}
            </div>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_120px]">
              <AdminInput
                label="相对路径"
                value={reference.path}
                placeholder="references/case-mode-v3.md"
                disabled={readOnly}
                onChange={(value) =>
                  updateReference(reference.id, { path: normalizeWorkReferencePath(value) })
                }
              />
              <label className="block text-ds-xs text-txs">
                加载策略
                <select
                  value={reference.load_mode}
                  disabled={readOnly}
                  onChange={(event) =>
                    updateReference(reference.id, {
                      load_mode: event.target.value as WorkSkillReferenceDraft["load_mode"],
                    })
                  }
                  className="mt-1 h-10 w-full rounded-ds-md border border-bd bg-white px-2 text-xs text-tx disabled:bg-slate-50"
                >
                  <option value="always">公共 · always</option>
                  <option value="case">案例式 · case</option>
                  <option value="issue">议题式 · issue</option>
                  <option value="task">任务式 · task</option>
                  <option value="evaluation_only">仅评估 · evaluation_only</option>
                </select>
              </label>
              <AdminInput
                label="字符上限"
                value={String(reference.max_chars)}
                placeholder="24000"
                type="number"
                disabled={readOnly}
                onChange={(value) => updateReference(reference.id, { max_chars: Number(value) || 24000 })}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <AdminInput
                label="显示名称"
                value={reference.name}
                placeholder="案例式教学模板 V3"
                disabled={readOnly}
                onChange={(value) => updateReference(reference.id, { name: value })}
              />
              <AdminInput
                label="说明"
                value={reference.description}
                placeholder="该文档解决什么问题"
                disabled={readOnly}
                onChange={(value) => updateReference(reference.id, { description: value })}
              />
            </div>
            <label className="block text-ds-xs text-txs">
              文档内容
              <textarea
                value={reference.content}
                readOnly={readOnly}
                onChange={(event) => updateReference(reference.id, { content: event.target.value })}
                rows={10}
                className="mt-1 w-full rounded-ds-md border border-bd bg-white p-3 font-mono text-xs leading-relaxed text-tx read-only:bg-slate-50"
              />
            </label>
            <div className="flex flex-wrap justify-between gap-2 text-[10px] text-txs">
              <span>
                {reference.content.length} 字符 · 保存顺序 {index + 1}
              </span>
              {reference.content_hash && <span>当前哈希 {reference.content_hash.slice(0, 12)}…</span>}
            </div>
          </details>
        ))
      )}
    </div>
  );
}

function createWorkReferenceDraft(path: string, index: number): WorkSkillReferenceDraft {
  const normalizedPath = normalizeWorkReferencePath(path);
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${index}`,
    skill_version_id: "",
    path: normalizedPath,
    name: normalizedPath.split("/").pop() || normalizedPath,
    description: "",
    media_type: mediaTypeForReferencePath(normalizedPath),
    content: "",
    content_hash: "",
    load_mode: "always",
    max_chars: 24000,
    sort_order: index * 10,
    metadata: {},
  };
}

function mediaTypeForReferencePath(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "json") return "application/json";
  if (extension === "yaml" || extension === "yml") return "application/yaml";
  if (extension === "csv") return "text/csv";
  if (extension === "txt") return "text/plain";
  return "text/markdown";
}

function AdminInput({
  label,
  value,
  placeholder,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-ds-xs text-txs">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-ds-md border border-bd bg-white px-3 text-ds-sm text-tx disabled:bg-slate-50"
      />
    </label>
  );
}
