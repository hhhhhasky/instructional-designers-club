import { AlertTriangle, Braces, BriefcaseBusiness, CheckCircle2, Plus, RotateCcw, Save, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  published_at: string | null;
  updated_at: string;
};

const moduleOptions = [
  { value: "lesson-diagnosis", label: "教案诊断" },
  { value: "segment-optimization", label: "环节优化" },
  { value: "subject-lesson-design", label: "学科定制设计" },
];

export default function HaiWorkSkillManagement() {
  const [skills, setSkills] = useState<WorkSkill[]>([]);
  const [versions, setVersions] = useState<WorkSkillVersion[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [skillDraft, setSkillDraft] = useState<WorkSkill | null>(null);
  const [versionDraft, setVersionDraft] = useState<WorkSkillVersion | null>(null);
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

  const selectedSkill = skills.find((item) => item.id === selectedSkillId) ?? null;
  const skillVersions = useMemo(
    () => versions.filter((item) => item.skill_id === selectedSkillId),
    [selectedSkillId, versions],
  );

  async function loadAll(preferredSkillId?: string, preferredVersionId?: string) {
    setLoading(true);
    const [skillResult, versionResult] = await Promise.all([
      supabase.from("hai_work_skills").select("*").order("module_slug").order("priority", { ascending: false }),
      supabase.from("hai_work_skill_versions").select("*").order("created_at", { ascending: false }),
    ]);
    if (skillResult.error || versionResult.error) {
      setStatus(skillResult.error?.message || versionResult.error?.message || "Work Skill 加载失败。");
      setLoading(false);
      return;
    }
    const nextSkills = (skillResult.data as WorkSkill[]) ?? [];
    const nextVersions = (versionResult.data as WorkSkillVersion[]) ?? [];
    setSkills(nextSkills);
    setVersions(nextVersions);
    const nextSkillId = preferredSkillId || selectedSkillId || nextSkills[0]?.id || "";
    const nextSkillVersions = nextVersions.filter((item) => item.skill_id === nextSkillId);
    setSelectedSkillId(nextSkillId);
    setSelectedVersionId(preferredVersionId || nextSkillVersions.find((item) => item.status === "published")?.id || nextSkillVersions[0]?.id || "");
    setLoading(false);
  }

  useEffect(() => { void loadAll(); }, []);

  useEffect(() => {
    if (!selectedSkill) {
      setSkillDraft(null);
      return;
    }
    setSkillDraft({ ...selectedSkill });
    setCriteriaText(JSON.stringify(selectedSkill.match_criteria ?? {}, null, 2));
    const nextVersions = versions.filter((item) => item.skill_id === selectedSkill.id);
    if (!nextVersions.some((item) => item.id === selectedVersionId)) {
      setSelectedVersionId(nextVersions.find((item) => item.status === "published")?.id || nextVersions[0]?.id || "");
    }
  }, [selectedSkillId, selectedSkill?.updated_at]);

  useEffect(() => {
    const selected = versions.find((item) => item.id === selectedVersionId) ?? null;
    setVersionDraft(selected ? { ...selected } : null);
    setOutputText(JSON.stringify(selected?.output_contract ?? {}, null, 2));
  }, [selectedVersionId, versions]);

  async function saveSkill() {
    if (!skillDraft || saving) return;
    const criteria = parseJson(criteriaText, "匹配条件");
    if (!criteria) return;
    setSaving(true);
    const { error } = await supabase.from("hai_work_skills").update({
      name: skillDraft.name.trim(),
      description: skillDraft.description.trim(),
      match_criteria: criteria,
      priority: skillDraft.priority,
      is_enabled: skillDraft.is_enabled,
    }).eq("id", skillDraft.id);
    setSaving(false);
    if (error) return setStatus(error.message);
    setStatus("Work Skill 元数据已保存。");
    await loadAll(skillDraft.id, selectedVersionId);
  }

  async function saveVersion(): Promise<boolean> {
    if (!versionDraft || saving) return false;
    const outputContract = parseJson(outputText, "输出契约");
    if (!outputContract) return false;
    if (!versionDraft.prompt_template.trim()) {
      setStatus("提示词不能为空。");
      return false;
    }
    setSaving(true);
    const { error } = await supabase.from("hai_work_skill_versions").update({
      version_label: versionDraft.version_label.trim(),
      prompt_template: versionDraft.prompt_template,
      output_contract: outputContract,
    }).eq("id", versionDraft.id);
    setSaving(false);
    if (error) {
      setStatus(error.message);
      return false;
    }
    setStatus("Skill 版本已保存。");
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
    if (!window.confirm(`确定删除“${selectedSkill.name}”及其 ${skillVersions.length} 个提示词版本吗？历史任务中的 Skill 快照会保留。`)) return;
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
    if (!window.confirm(`确定删除“${selectedSkill.name} / ${versionDraft.version_label}”吗？此操作不可撤销。`)) return;
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
    const base = skillVersions.find((item) => item.status === "published") ?? skillVersions[0];
    const versionLabel = `v${skillVersions.length + 1}`;
    setSaving(true);
    const { data, error } = await supabase.from("hai_work_skill_versions").insert({
      skill_id: selectedSkill.id,
      version_label: versionLabel,
      status: "draft",
      prompt_template: base?.prompt_template || "请补充 Work Skill 提示词。",
      default_prompt_template: base?.default_prompt_template || base?.prompt_template || "请补充 Work Skill 提示词。",
      input_contract: base?.input_contract || {},
      output_contract: base?.output_contract || {},
    }).select("id").single();
    setSaving(false);
    if (error) return setStatus(error.message);
    setStatus(`已创建草稿 ${versionLabel}。`);
    await loadAll(selectedSkill.id, data.id);
  }

  async function createSkill() {
    if (!createDraft.slug.trim() || !createDraft.name.trim() || saving) return;
    setSaving(true);
    const { data: skill, error } = await supabase.from("hai_work_skills").insert({
      slug: createDraft.slug.trim(),
      module_slug: createDraft.module_slug,
      name: createDraft.name.trim(),
      description: createDraft.description.trim(),
      match_criteria: {},
      priority: 10,
      is_fallback: false,
      is_enabled: false,
    }).select("id").single();
    if (error || !skill) {
      setSaving(false);
      return setStatus(error?.message || "Skill 创建失败。");
    }
    const { data: version, error: versionError } = await supabase.from("hai_work_skill_versions").insert({
      skill_id: skill.id,
      version_label: "v1",
      status: "draft",
      prompt_template: "请补充 Work Skill 提示词。",
      default_prompt_template: "请补充 Work Skill 提示词。",
      input_contract: {},
      output_contract: {},
    }).select("id").single();
    setSaving(false);
    if (versionError) {
      await supabase.from("hai_work_skills").delete().eq("id", skill.id);
      return setStatus(`${versionError.message}；未完成的 Skill 已自动清理。`);
    }
    setCreateDraft({ slug: "", module_slug: "subject-lesson-design", name: "", description: "" });
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

  return (
    <section className="rounded-ds-lg border border-bd bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <BriefcaseBusiness className="mt-0.5 h-5 w-5 text-ac" />
          <div>
            <h2 className="text-ds-lg font-ds-bold text-tx">Work Skill 工作台</h2>
            <p className="mt-1 text-ds-xs leading-relaxed text-txs">管理教案诊断、环节优化与学科定制的匹配条件、提示词版本和通用降级路径。这里与 Chat 编排完全分离。</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowCreator((current) => !current)}>
          {showCreator ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{showCreator ? "取消" : "新增 Skill"}
        </Button>
      </div>

      {status && <div className="mt-3 rounded-ds-md border border-bd bg-bg px-3 py-2 text-ds-xs text-tx">{status}</div>}

      {showCreator && (
        <div className="mt-4 grid gap-3 rounded-ds-md border border-ac/20 bg-ac/5 p-3 md:grid-cols-2">
          <AdminInput label="Skill 标识" value={createDraft.slug} placeholder="例如 politics-public-lesson" onChange={(value) => setCreateDraft((current) => ({ ...current, slug: value }))} />
          <AdminInput label="显示名称" value={createDraft.name} placeholder="例如 思政课公开课" onChange={(value) => setCreateDraft((current) => ({ ...current, name: value }))} />
          <label className="text-ds-xs text-txs">所属功能<select value={createDraft.module_slug} onChange={(event) => setCreateDraft((current) => ({ ...current, module_slug: event.target.value }))} className="mt-1 h-10 w-full rounded-ds-md border border-bd bg-white px-3 text-ds-sm text-tx">{moduleOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <AdminInput label="说明" value={createDraft.description} placeholder="适用范围和能力说明" onChange={(value) => setCreateDraft((current) => ({ ...current, description: value }))} />
          <div className="md:col-span-2 flex justify-end"><Button size="sm" disabled={saving} onClick={() => void createSkill()}><Plus className="h-4 w-4" />创建停用草稿</Button></div>
        </div>
      )}

      {loading ? (
        <p className="mt-5 rounded-ds-md bg-bg px-4 py-8 text-center text-ds-sm text-txs">正在加载 Work Skill</p>
      ) : skills.length === 0 ? (
        <p className="mt-5 rounded-ds-md bg-bg px-4 py-8 text-center text-ds-sm text-txs">尚未执行 Work 模式迁移。</p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-2">
            {skills.map((skill) => (
              <button key={skill.id} type="button" onClick={() => setSelectedSkillId(skill.id)} className={`w-full rounded-ds-md border p-3 text-left transition ${skill.id === selectedSkillId ? "border-ac/40 bg-ac/5" : "border-bd bg-bg hover:bg-white"}`}>
                <div className="flex items-center justify-between gap-2"><span className="truncate text-ds-sm font-ds-bold text-tx">{skill.name}</span><span className={`h-2 w-2 rounded-full ${skill.is_enabled ? "bg-green-500" : "bg-slate-300"}`} /></div>
                <p className="mt-1 text-[11px] text-txs">{moduleOptions.find((item) => item.value === skill.module_slug)?.label}</p>
                <div className="mt-2 flex gap-1">{skill.is_fallback && <Badge variant="outline">通用降级</Badge>}{versions.some((item) => item.skill_id === skill.id && item.status === "published") ? <Badge variant="outline" className="text-green-700">已发布</Badge> : <Badge variant="outline" className="text-amber-700">仅草稿</Badge>}</div>
              </button>
            ))}
          </div>

          {skillDraft && (
            <div className="min-w-0 space-y-4 rounded-ds-md border border-bd bg-bg p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <AdminInput label="显示名称" value={skillDraft.name} placeholder="Skill 名称" onChange={(value) => setSkillDraft({ ...skillDraft, name: value })} />
                <AdminInput label="优先级" value={String(skillDraft.priority)} placeholder="0" type="number" onChange={(value) => setSkillDraft({ ...skillDraft, priority: Number(value) || 0 })} />
                <label className="md:col-span-2 text-ds-xs text-txs">说明<textarea value={skillDraft.description} onChange={(event) => setSkillDraft({ ...skillDraft, description: event.target.value })} rows={2} className="mt-1 w-full rounded-ds-md border border-bd bg-white p-3 text-ds-sm text-tx" /></label>
                <label className="md:col-span-2 text-ds-xs text-txs">匹配条件 JSON<textarea value={criteriaText} onChange={(event) => setCriteriaText(event.target.value)} rows={5} className="mt-1 w-full rounded-ds-md border border-bd bg-white p-3 font-mono text-xs text-tx" /><span className="mt-1 block text-[10px]">支持 stages、subjects、lesson_types 数组；空对象表示不限制。</span></label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-bd pt-3">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSkillDraft({ ...skillDraft, is_enabled: !skillDraft.is_enabled })}>{skillDraft.is_enabled ? "停用" : "启用"}</Button>
                  {!selectedSkill?.is_fallback && <Button size="sm" variant="outline" onClick={() => void makeFallback()}>设为通用降级</Button>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" disabled={saving} onClick={() => void deleteSkill()}><Trash2 className="h-4 w-4" />删除 Skill</Button>
                  <Button size="sm" disabled={saving} onClick={() => void saveSkill()}><Save className="h-4 w-4" />保存 Skill</Button>
                </div>
              </div>

              {(skillDraft.is_enabled || skillDraft.is_fallback) && (
                <div className="flex items-start gap-2 rounded-ds-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />正在启用或承担通用降级的 Skill 不能删除，避免线上功能失去执行路径。
                </div>
              )}

              <div className="border-t border-bd pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2"><Braces className="h-4 w-4 text-ac" /><h3 className="text-ds-sm font-ds-bold text-tx">提示词版本</h3></div>
                  <Button size="sm" variant="outline" onClick={() => void addVersion()}><Plus className="h-4 w-4" />新建草稿版本</Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">{skillVersions.map((version) => <button key={version.id} type="button" onClick={() => setSelectedVersionId(version.id)} className={`rounded-full border px-3 py-1 text-xs ${version.id === selectedVersionId ? "border-ac bg-ac text-white" : "border-bd bg-white text-tx"}`}>{version.version_label} · {version.status}</button>)}</div>
              </div>

              {versionDraft && (
                <div className="space-y-3 rounded-ds-md border border-bd bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><AdminInput label="版本标签" value={versionDraft.version_label} placeholder="v1" onChange={(value) => setVersionDraft({ ...versionDraft, version_label: value })} /><Badge variant="outline" className={versionDraft.status === "published" ? "text-green-700" : "text-amber-700"}>{versionDraft.status}</Badge></div>
                  <label className="block text-ds-xs text-txs">Skill 提示词<textarea value={versionDraft.prompt_template} onChange={(event) => setVersionDraft({ ...versionDraft, prompt_template: event.target.value })} rows={14} className="mt-1 w-full rounded-ds-md border border-bd bg-bg p-3 font-mono text-xs leading-relaxed text-tx" /></label>
                  <label className="block text-ds-xs text-txs">输出契约 JSON<textarea value={outputText} onChange={(event) => setOutputText(event.target.value)} rows={6} className="mt-1 w-full rounded-ds-md border border-bd bg-bg p-3 font-mono text-xs text-tx" /></label>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="outline" disabled={!versionDraft.default_prompt_template} onClick={() => void restoreDefault()}><RotateCcw className="h-4 w-4" />恢复默认</Button>
                    {versionDraft.status !== "published" && <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" disabled={saving} onClick={() => void deleteVersion()}><Trash2 className="h-4 w-4" />删除版本</Button>}
                    <Button size="sm" variant="outline" disabled={saving} onClick={() => void saveVersion()}><Save className="h-4 w-4" />保存版本</Button>
                    {versionDraft.status !== "published" && <Button size="sm" disabled={saving} onClick={() => void publishVersion()}><Upload className="h-4 w-4" />发布版本</Button>}
                    {versionDraft.status === "published" && <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700"><CheckCircle2 className="h-4 w-4" />当前生效</span>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
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

function AdminInput({ label, value, placeholder, onChange, type = "text" }: { label: string; value: string; placeholder: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block text-ds-xs text-txs">{label}<input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-ds-md border border-bd bg-white px-3 text-ds-sm text-tx" /></label>;
}
