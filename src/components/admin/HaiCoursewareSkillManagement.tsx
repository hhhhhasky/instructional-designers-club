import { SkillAdvancedSettings, skillVersionStatus, confirmSkillNavigation, useWarnOnUnsavedChanges } from "@/components/admin/hai/HaiConfigWorkspace";
import { Braces, FileText, PackageOpen, Plus, Save, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/db/supabase";

type JsonObject = Record<string, unknown>;
type Skill = {
  id: string; slug: string; name: string; description: string; match_criteria: JsonObject;
  priority: number; is_fallback: boolean; is_enabled: boolean; updated_at: string;
};
type SkillVersion = {
  id: string; skill_id: string; version_label: string; status: "draft" | "published" | "archived";
  instructions: string; default_instructions: string; input_contract: JsonObject; output_contract: JsonObject;
  source_metadata: JsonObject; published_at: string | null; updated_at: string;
};
export type CoursewareSkillReferenceDraft = {
  id: string; skill_version_id: string; path: string; name: string; description: string;
  media_type: string; content: string; load_mode: "always" | "subject" | "lesson_genre" | "visual_mode" | "evaluation_only";
  match_criteria: JsonObject; max_chars: number; sort_order: number; metadata: JsonObject;
};

export function normalizeCoursewareReferencePath(value: string) {
  const normalized = value.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/{2,}/g, "/");
  const index = normalized.toLowerCase().indexOf("references/");
  if (index >= 0) return normalized.slice(index);
  return `references/${normalized.split("/").filter(Boolean).pop() || "reference.md"}`;
}

export function serializeCoursewareReferences(references: CoursewareSkillReferenceDraft[]) {
  return references.map((reference, index) => ({
    path: normalizeCoursewareReferencePath(reference.path),
    name: reference.name.trim() || reference.path.split("/").pop() || "reference.md",
    description: reference.description.trim(), media_type: reference.media_type || "text/markdown", content: reference.content,
    load_mode: reference.load_mode, match_criteria: reference.match_criteria ?? {},
    max_chars: Math.max(1, Math.min(reference.max_chars || 24000, 50000)), sort_order: index * 10, metadata: reference.metadata ?? {},
  }));
}

export function nextCoursewareSkillVersionLabel(versions: Array<Pick<SkillVersion, "version_label">>) {
  const labels = new Set(versions.map((version) => version.version_label));
  let index = versions.length + 1;
  while (labels.has(`v${index}`)) index += 1;
  return `v${index}`;
}

export default function HaiCoursewareSkillManagement() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [versions, setVersions] = useState<SkillVersion[]>([]);
  const [references, setReferences] = useState<CoursewareSkillReferenceDraft[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [skillDraft, setSkillDraft] = useState<Skill | null>(null);
  const [versionDraft, setVersionDraft] = useState<SkillVersion | null>(null);
  const [referenceDrafts, setReferenceDrafts] = useState<CoursewareSkillReferenceDraft[]>([]);
  const [criteriaText, setCriteriaText] = useState("{}");
  const [inputText, setInputText] = useState("{}");
  const [outputText, setOutputText] = useState("{}");
  const [sourceText, setSourceText] = useState("{}");
  const [showCreator, setShowCreator] = useState(false);
  const [createDraft, setCreateDraft] = useState({ slug: "", name: "", description: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const selectedSkill = skills.find((skill) => skill.id === selectedSkillId) ?? null;
  const skillVersions = useMemo(() => versions.filter((version) => version.skill_id === selectedSkillId), [selectedSkillId, versions]);

  const originalVersion = versions.find((item) => item.id === selectedVersionId);
  const hasUnsavedEdits = Boolean(
    (skillDraft && selectedSkill && JSON.stringify(skillDraft) !== JSON.stringify(selectedSkill)) ||
    (versionDraft && originalVersion && JSON.stringify(versionDraft) !== JSON.stringify(originalVersion)) ||
    JSON.stringify(referenceDrafts) !== JSON.stringify(references.filter((item) => item.skill_version_id === selectedVersionId)) ||
    (originalVersion && (inputText !== JSON.stringify(originalVersion.input_contract ?? {}, null, 2) || outputText !== JSON.stringify(originalVersion.output_contract ?? {}, null, 2) || sourceText !== JSON.stringify(originalVersion.source_metadata ?? {}, null, 2))) ||
    (selectedSkill && criteriaText !== JSON.stringify(selectedSkill.match_criteria ?? {}, null, 2))
  );

  useWarnOnUnsavedChanges(hasUnsavedEdits);

  async function loadAll(preferredSkillId?: string, preferredVersionId?: string) {
    setLoading(true);
    const [skillResult, versionResult, referenceResult] = await Promise.all([
      supabase.from("hai_courseware_skills").select("*").order("priority", { ascending: false }),
      supabase.from("hai_courseware_skill_versions").select("*").order("created_at", { ascending: false }),
      supabase.from("hai_courseware_skill_references").select("*").order("sort_order").order("path"),
    ]);
    if (skillResult.error || versionResult.error || referenceResult.error) {
      setStatus(skillResult.error?.message || versionResult.error?.message || referenceResult.error?.message || "课件 Skill 加载失败。");
      setLoading(false); return;
    }
    const nextSkills = (skillResult.data ?? []) as Skill[];
    const nextVersions = (versionResult.data ?? []) as SkillVersion[];
    setSkills(nextSkills); setVersions(nextVersions); setReferences((referenceResult.data ?? []) as CoursewareSkillReferenceDraft[]);
    const skillId = preferredSkillId || selectedSkillId || nextSkills[0]?.id || "";
    const available = nextVersions.filter((version) => version.skill_id === skillId);
    setSelectedSkillId(skillId);
    setSelectedVersionId(preferredVersionId || available.find((version) => version.status === "published")?.id || available[0]?.id || "");
    setLoading(false);
  }

  useEffect(() => { void loadAll(); }, []);
  useEffect(() => {
    if (!selectedSkill) { setSkillDraft(null); return; }
    setSkillDraft({ ...selectedSkill }); setCriteriaText(JSON.stringify(selectedSkill.match_criteria ?? {}, null, 2));
    if (!skillVersions.some((version) => version.id === selectedVersionId)) setSelectedVersionId(skillVersions.find((version) => version.status === "published")?.id || skillVersions[0]?.id || "");
  }, [selectedSkillId, selectedSkill?.updated_at, skillVersions.length]);
  useEffect(() => {
    const selected = versions.find((version) => version.id === selectedVersionId) ?? null;
    setVersionDraft(selected ? { ...selected } : null);
    setInputText(JSON.stringify(selected?.input_contract ?? {}, null, 2));
    setOutputText(JSON.stringify(selected?.output_contract ?? {}, null, 2));
    setSourceText(JSON.stringify(selected?.source_metadata ?? {}, null, 2));
    setReferenceDrafts(references.filter((reference) => reference.skill_version_id === selectedVersionId).map((reference) => ({ ...reference, match_criteria: { ...reference.match_criteria }, metadata: { ...reference.metadata } })));
  }, [selectedVersionId, originalVersion?.updated_at]);

  function parseJson(value: string, label: string) {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      return parsed as JsonObject;
    } catch { setStatus(`${label}必须是合法 JSON 对象。`); return null; }
  }

  async function createSkill() {
    if (!createDraft.slug.trim() || !createDraft.name.trim() || saving) return;
    setSaving(true);
    const { data: skill, error } = await supabase.from("hai_courseware_skills").insert({
      slug: createDraft.slug.trim(), name: createDraft.name.trim(), description: createDraft.description.trim(),
      priority: 10, is_enabled: false, is_fallback: false, match_criteria: {},
    }).select("id").single();
    if (error || !skill) { setSaving(false); setStatus(error?.message || "课件 Skill 创建失败。"); return; }
    const instructions = "请在这里填写课件 Skill 主文档，并从公共与学科功能页中规划 pageFunction。";
    const { data: version, error: versionError } = await supabase.from("hai_courseware_skill_versions").insert({
      skill_id: skill.id, version_label: "v1", status: "draft", instructions, default_instructions: instructions,
      input_contract: {}, output_contract: { schemaVersion: "hai_courseware_deck_v4" }, source_metadata: {},
    }).select("id").single();
    const { error: referenceError } = !versionError && version ? await supabase.from("hai_courseware_skill_references").insert({
      skill_version_id: version.id, path: "references/common.md", name: "公共规则", content: "请补充页面功能与输出规则。", load_mode: "always", match_criteria: {},
    }) : { error: null };
    if (versionError || !version) {
      await supabase.from("hai_courseware_skills").delete().eq("id", skill.id);
      setSaving(false); setStatus(`${versionError?.message || "Skill 草稿创建失败。"}；未完成的 Skill 已清理。`); return;
    }
    setSaving(false);
    setCreateDraft({ slug: "", name: "", description: "" }); setShowCreator(false); setStatus(referenceError ? `Skill 草稿已创建，但公共 Reference 创建失败：${referenceError.message}` : "已创建停用的课件 Skill 草稿。");
    await loadAll(skill.id, version.id);
  }

  async function saveSkill() {
    if (!skillDraft || saving) return;
    const criteria = parseJson(criteriaText, "匹配条件"); if (!criteria) return;
    setSaving(true);
    const { error } = await supabase.from("hai_courseware_skills").update({ name: skillDraft.name.trim(), description: skillDraft.description.trim(), priority: skillDraft.priority, match_criteria: criteria }).eq("id", skillDraft.id);
    setSaving(false); if (error) { setStatus(error.message); return; }
    setStatus("课件 Skill 匹配配置已保存。"); await loadAll(skillDraft.id, selectedVersionId);
  }

  async function saveVersion() {
    if (!versionDraft || versionDraft.status !== "draft" || saving) return false;
    const input = parseJson(inputText, "输入契约"); const output = parseJson(outputText, "输出契约"); const source = parseJson(sourceText, "来源信息");
    if (!input || !output || !source || !versionDraft.instructions.trim()) { if (!versionDraft.instructions.trim()) setStatus("Skill 主文档不能为空。"); return false; }
    setSaving(true);
    const { error } = await supabase.rpc("hai_save_courseware_skill_draft_snapshot", {
      p_version_id: versionDraft.id, p_version_label: versionDraft.version_label.trim(), p_instructions: versionDraft.instructions,
      p_input_contract: input, p_output_contract: output, p_source_metadata: source, p_references: serializeCoursewareReferences(referenceDrafts),
    });
    setSaving(false); if (error) { setStatus(error.message); return false; }
    setStatus(`主文档与 ${referenceDrafts.length} 个 reference 已保存。`); await loadAll(selectedSkillId, versionDraft.id); return true;
  }

  async function publishVersion() {
    if (!versionDraft || !(await saveVersion())) return;
    setSaving(true); const { error } = await supabase.rpc("hai_publish_courseware_skill_version", { p_version_id: versionDraft.id }); setSaving(false);
    if (error) { setStatus(error.message); return; }
    setStatus(`已发布 ${versionDraft.version_label}，之后的新课件使用该版本。`); await loadAll(selectedSkillId, versionDraft.id);
  }

  async function cloneVersion() {
    if (!selectedSkill || !versionDraft || saving) return;
    setSaving(true); const label = nextCoursewareSkillVersionLabel(skillVersions);
    const { data, error } = await supabase.rpc("hai_clone_courseware_skill_version", { p_skill_id: selectedSkill.id, p_source_version_id: versionDraft.id, p_version_label: label }); setSaving(false);
    if (error) { setStatus(error.message); return; }
    setStatus(`已复制为草稿 ${label}。`); await loadAll(selectedSkill.id, String(data));
  }

  async function toggleEnabled() {
    if (!skillDraft || saving) return;
    setSaving(true); const { error } = await supabase.rpc("hai_set_courseware_skill_enabled", { p_skill_id: skillDraft.id, p_enabled: !skillDraft.is_enabled }); setSaving(false);
    if (error) { setStatus(error.message); return; }
    setStatus(skillDraft.is_enabled ? "课件 Skill 已停用。" : "课件 Skill 已启用。"); await loadAll(skillDraft.id, selectedVersionId);
  }

  async function setFallback() {
    if (!skillDraft || saving) return;
    setSaving(true); const { error } = await supabase.rpc("hai_set_courseware_fallback_skill", { p_skill_id: skillDraft.id }); setSaving(false);
    if (error) { setStatus(error.message); return; }
    setStatus("已设为无专项匹配时使用的通用课件 Skill。"); await loadAll(skillDraft.id, selectedVersionId);
  }

  return <section className="min-w-0">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-2"><PackageOpen className="mt-0.5 h-5 w-5 text-ac" /><div><h2 className="text-ds-lg font-ds-bold text-tx">AI 课件 Skill</h2><p className="mt-1 text-ds-xs text-txs">管理分学科功能页、运行时 reference、匹配条件和发布版本。历史课件保存生成时的 Skill 快照。</p></div></div><Button size="sm" variant="outline" onClick={() => setShowCreator((value) => !value)}>{showCreator ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{showCreator ? "取消" : "新增 Skill"}</Button></div>
    {status && <div className="mt-3 rounded-ds-md border border-bd bg-bg px-3 py-2 text-ds-xs text-tx">{status}</div>}
    {showCreator && <div className="mt-4 grid gap-3 rounded-ds-md border border-ac/20 bg-ac/5 p-3 md:grid-cols-2"><Input label="Skill 标识" value={createDraft.slug} onChange={(slug) => setCreateDraft({ ...createDraft, slug })} /><Input label="名称" value={createDraft.name} onChange={(name) => setCreateDraft({ ...createDraft, name })} /><label className="md:col-span-2 text-ds-xs text-txs">说明<textarea rows={2} value={createDraft.description} onChange={(event) => setCreateDraft({ ...createDraft, description: event.target.value })} className="mt-1 w-full rounded-ds-md border border-bd p-3 text-ds-sm text-tx" /></label><div className="md:col-span-2 flex justify-end"><Button size="sm" disabled={saving} onClick={() => void createSkill()}><Plus className="h-4 w-4" />创建草稿</Button></div></div>}
    {loading ? <p className="mt-5 rounded-ds-md bg-bg px-4 py-8 text-center text-ds-sm text-txs">正在加载课件 Skill</p> : skills.length === 0 ? <p className="mt-5 rounded-ds-md bg-bg px-4 py-8 text-center text-ds-sm text-txs">尚无课件 Skill；请先执行数据库迁移或新建 Skill。</p> : <div className="mt-5 grid gap-4 xl:grid-cols-[200px_minmax(0,1fr)]">
      <div className="max-h-80 space-y-1 overflow-auto xl:max-h-[650px]">{skills.map((skill) => <button key={skill.id} type="button" onClick={() => { if (skill.id === selectedSkillId || confirmSkillNavigation(hasUnsavedEdits)) setSelectedSkillId(skill.id); }} className={`w-full border-l-2 px-3 py-3 text-left ${skill.id === selectedSkillId ? "border-ac bg-ac/5" : "border-transparent hover:bg-bg"}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-bold">{skill.name}</span><Badge variant="outline" className={skill.is_enabled ? "text-sage" : "text-txs"}>{skill.is_enabled ? "已启用" : "已停用"}</Badge></div><p className="mt-1 text-xs text-txs">{skill.slug} · 优先级 {skill.priority}</p><div className="mt-2 flex gap-1">{skill.is_fallback && <Badge variant="outline">通用降级</Badge>}{versions.some((version) => version.skill_id === skill.id && version.status === "published") && <Badge variant="outline" className="text-sage">已发布</Badge>}</div></button>)}</div>
      {skillDraft && <div className="min-w-0 space-y-5"><SkillAdvancedSettings label="Skill 名称、匹配与启停"><div className="grid gap-3 md:grid-cols-2"><Input label="名称" value={skillDraft.name} onChange={(name) => setSkillDraft({ ...skillDraft, name })} /><Input label="优先级" type="number" value={String(skillDraft.priority)} onChange={(value) => setSkillDraft({ ...skillDraft, priority: Number(value) || 0 })} /><label className="md:col-span-2 text-ds-xs text-txs">说明<textarea rows={2} value={skillDraft.description} onChange={(event) => setSkillDraft({ ...skillDraft, description: event.target.value })} className="mt-1 w-full rounded-ds-md border border-bd p-3 text-ds-sm text-tx" /></label><JsonEditor label="匹配条件 JSON" value={criteriaText} onChange={setCriteriaText} rows={5} hint="支持 subjects、subject_profiles、stages、lesson_genres、visual_modes、output_modes 数组；{} 表示通用。" /></div><div className="flex flex-wrap justify-between gap-2"><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void toggleEnabled()}>{skillDraft.is_enabled ? "停用" : "启用"}</Button>{!skillDraft.is_fallback && <Button size="sm" variant="outline" onClick={() => void setFallback()}>设为通用降级</Button>}</div><Button size="sm" onClick={() => void saveSkill()}><Save className="h-4 w-4" />保存匹配配置</Button></div>
        </SkillAdvancedSettings>
        <div className="border-t border-bd pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Braces className="h-4 w-4 text-ac" /><h3 className="text-sm font-bold">版本与 Reference</h3></div><Button size="sm" variant="outline" disabled={!versionDraft} onClick={() => void cloneVersion()}><Plus className="h-4 w-4" />复制为草稿</Button></div><label className="mt-3 block text-xs text-txs">当前查看版本<select aria-label="课件 Skill 版本" value={selectedVersionId} onChange={(event) => { if (confirmSkillNavigation(hasUnsavedEdits)) setSelectedVersionId(event.target.value); }} className="mt-1 h-10 w-full rounded border border-bd bg-white px-3 text-sm text-tx">{skillVersions.map((version) => <option key={version.id} value={version.id}>{version.version_label} · {skillVersionStatus(version.status)}</option>)}</select></label></div>
        {versionDraft && <div className="space-y-4"><div className="flex items-end justify-between gap-3"><Input label="版本标签" value={versionDraft.version_label} disabled={versionDraft.status !== "draft"} onChange={(version_label) => setVersionDraft({ ...versionDraft, version_label })} /><Badge variant="outline" className={versionDraft.status === "published" ? "text-sage" : "text-amber-700"}>{skillVersionStatus(versionDraft.status)}</Badge></div><label className="block text-ds-xs text-txs">Skill 主文档<textarea rows={14} readOnly={versionDraft.status !== "draft"} value={versionDraft.instructions} onChange={(event) => setVersionDraft({ ...versionDraft, instructions: event.target.value })} className="mt-1 w-full rounded-ds-md border border-bd p-3 font-mono text-xs leading-relaxed read-only:bg-slate-50" /></label><SkillAdvancedSettings label="高级设置 · 输入输出格式与来源"><div className="grid gap-3 xl:grid-cols-3"><JsonEditor label="输入契约" value={inputText} onChange={setInputText} readOnly={versionDraft.status !== "draft"} /><JsonEditor label="输出契约" value={outputText} onChange={setOutputText} readOnly={versionDraft.status !== "draft"} /><JsonEditor label="来源信息" value={sourceText} onChange={setSourceText} readOnly={versionDraft.status !== "draft"} /></div></SkillAdvancedSettings><ReferenceEditor references={referenceDrafts} readOnly={versionDraft.status !== "draft"} onChange={setReferenceDrafts} /><div className="flex justify-end gap-2">{versionDraft.status === "draft" && <><Button size="sm" variant="outline" disabled={saving} onClick={() => void saveVersion()}><Save className="h-4 w-4" />保存草稿快照</Button><Button size="sm" disabled={saving} onClick={() => void publishVersion()}><Upload className="h-4 w-4" />发布版本</Button></>}</div></div>}
      </div>}
    </div>}
  </section>;
}

function ReferenceEditor({ references, readOnly, onChange }: { references: CoursewareSkillReferenceDraft[]; readOnly: boolean; onChange: (value: CoursewareSkillReferenceDraft[]) => void }) {
  const update = (id: string, patch: Partial<CoursewareSkillReferenceDraft>) => onChange(references.map((reference) => reference.id === id ? { ...reference, ...patch } : reference));
  return <div className="space-y-4 border-t border-bd pt-4"><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-2"><FileText className="mt-0.5 h-4 w-4 text-ac" /><div><h4 className="text-xs font-bold">Reference 文档</h4><p className="mt-1 text-xs text-txs">always 始终加载；其余按学科、课型或视觉模式匹配；evaluation_only 不进入生成。</p></div></div>{!readOnly && <Button size="sm" variant="outline" onClick={() => onChange([...references, createReference(references.length)])}><Plus className="h-4 w-4" />添加</Button>}</div>{references.map((reference, index) => <details key={reference.id} className="space-y-3 border-b border-bd py-3"><summary className="cursor-pointer text-sm font-bold text-tx">{reference.name || reference.path}</summary><div className="flex justify-between text-xs font-bold text-txs"><span>REFERENCE {index + 1}</span>{!readOnly && <button type="button" className="text-red-600" onClick={() => onChange(references.filter((item) => item.id !== reference.id))}>移除</button>}</div><div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_160px_110px]"><Input label="路径" value={reference.path} disabled={readOnly} onChange={(path) => update(reference.id, { path: normalizeCoursewareReferencePath(path) })} /><label className="text-ds-xs text-txs">加载方式<select value={reference.load_mode} disabled={readOnly} onChange={(event) => update(reference.id, { load_mode: event.target.value as CoursewareSkillReferenceDraft["load_mode"] })} className="mt-1 h-10 w-full rounded-ds-md border border-bd bg-white px-2 text-xs disabled:bg-slate-50"><option value="always">always</option><option value="subject">subject</option><option value="lesson_genre">lesson_genre</option><option value="visual_mode">visual_mode</option><option value="evaluation_only">evaluation_only</option></select></label><Input label="字符上限" type="number" value={String(reference.max_chars)} disabled={readOnly} onChange={(value) => update(reference.id, { max_chars: Number(value) || 24000 })} /></div><Input label="名称" value={reference.name} disabled={readOnly} onChange={(name) => update(reference.id, { name })} /><label className="block text-ds-xs text-txs">匹配条件<textarea key={`${reference.id}-${JSON.stringify(reference.match_criteria)}`} defaultValue={JSON.stringify(reference.match_criteria ?? {}, null, 2)} readOnly={readOnly} rows={3} onBlur={(event) => { try { const parsed = JSON.parse(event.target.value); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) update(reference.id, { match_criteria: parsed }); } catch { event.target.value = JSON.stringify(reference.match_criteria ?? {}, null, 2); } }} className="mt-1 w-full rounded-ds-md border border-bd bg-white p-3 font-mono text-xs read-only:bg-slate-50" /></label><label className="block text-ds-xs text-txs">Markdown 内容<textarea rows={10} readOnly={readOnly} value={reference.content} onChange={(event) => update(reference.id, { content: event.target.value })} className="mt-1 w-full rounded-ds-md border border-bd p-3 font-mono text-xs leading-relaxed read-only:bg-slate-50" /></label></details>)}</div>;
}

function createReference(index: number): CoursewareSkillReferenceDraft { return { id: crypto.randomUUID(), skill_version_id: "", path: `references/reference-${index + 1}.md`, name: `Reference ${index + 1}`, description: "", media_type: "text/markdown", content: "", load_mode: "always", match_criteria: {}, max_chars: 24000, sort_order: index * 10, metadata: {} }; }
function Input({ label, value, onChange, type = "text", disabled = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean }) { return <label className="block min-w-0 text-ds-xs text-txs">{label}<input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-ds-md border border-bd bg-white px-3 text-ds-sm text-tx disabled:bg-slate-50" /></label>; }
function JsonEditor({ label, value, onChange, rows = 6, readOnly = false, hint }: { label: string; value: string; onChange: (value: string) => void; rows?: number; readOnly?: boolean; hint?: string }) { return <label className="block min-w-0 text-ds-xs text-txs">{label}<textarea rows={rows} value={value} readOnly={readOnly} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-ds-md border border-bd bg-white p-3 font-mono text-xs text-tx read-only:bg-slate-50" />{hint && <span className="mt-1 block text-xs leading-relaxed">{hint}</span>}</label>; }
