import {
  Bot,
  CheckCircle2,
  Link2,
  Plus,
  RotateCcw,
  Save,
  Unlink,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/db/supabase";

type ChatModule = {
  id: string;
  slug: string;
  name: string;
};

type ChatSkill = {
  id: string;
  slug: string;
  name: string;
  description: string;
  source_path: string;
  is_enabled: boolean;
  updated_at: string;
};

type ChatSkillVersion = {
  id: string;
  skill_id: string;
  version_label: string;
  status: "draft" | "published" | "archived";
  instructions: string;
  default_instructions: string;
  reference_config: Record<string, unknown>;
  snapshot_manifest: Array<Record<string, unknown>>;
  snapshot_hash: string | null;
  reference_count: number;
  published_at: string | null;
  updated_at: string;
};

export type ChatSkillReferenceDraft = {
  id: string;
  skill_version_id: string;
  path: string;
  name: string;
  description: string;
  media_type: string;
  content: string;
  content_hash: string;
  load_mode: "always" | "on_demand" | "evaluation_only";
  max_chars: number;
  sort_order: number;
  metadata: Record<string, unknown>;
};

type ChatSkillBinding = {
  module_id: string;
  skill_id: string;
  is_enabled: boolean;
};

const DEFAULT_REFERENCE_CONFIG = {
  include_method_index: true,
  method_card_limit: 6,
  memory_enabled: true,
  max_reference_count: 4,
  max_reference_chars: 12000,
};

export default function HaiChatSkillManagement() {
  const [modules, setModules] = useState<ChatModule[]>([]);
  const [skills, setSkills] = useState<ChatSkill[]>([]);
  const [versions, setVersions] = useState<ChatSkillVersion[]>([]);
  const [bindings, setBindings] = useState<ChatSkillBinding[]>([]);
  const [references, setReferences] = useState<ChatSkillReferenceDraft[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [skillDraft, setSkillDraft] = useState<ChatSkill | null>(null);
  const [versionDraft, setVersionDraft] = useState<ChatSkillVersion | null>(
    null,
  );
  const [referenceConfigText, setReferenceConfigText] = useState("{}");
  const [referenceDrafts, setReferenceDrafts] = useState<
    ChatSkillReferenceDraft[]
  >([]);
  const [importText, setImportText] = useState("");
  const [importVersionLabel, setImportVersionLabel] = useState("");
  const [showCreator, setShowCreator] = useState(false);
  const [createDraft, setCreateDraft] = useState({
    slug: "",
    name: "",
    description: "",
    source_path: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const selectedSkill = skills.find((item) => item.id === selectedSkillId) ??
    null;
  const skillVersions = useMemo(
    () => versions.filter((item) => item.skill_id === selectedSkillId),
    [selectedSkillId, versions],
  );
  const selectedModule = modules.find((item) => item.id === selectedModuleId) ??
    null;
  const selectedBinding =
    bindings.find((item) => item.module_id === selectedModuleId) ?? null;
  const effectiveSkill = selectedBinding?.is_enabled
    ? skills.find((item) => item.id === selectedBinding.skill_id) ?? null
    : null;

  async function loadAll(
    preferredSkillId?: string,
    preferredVersionId?: string,
    preferredModuleId?: string,
  ) {
    setLoading(true);
    const [
      moduleResult,
      skillResult,
      versionResult,
      bindingResult,
      referenceResult,
    ] = await Promise.all([
      supabase.from("hai_feature_modules").select("id, slug, name").eq(
        "surface_mode",
        "chat",
      ).order("sort_order"),
      supabase.from("hai_chat_skills").select("*").order("created_at"),
      supabase.from("hai_chat_skill_versions").select("*").order(
        "created_at",
        { ascending: false },
      ),
      supabase.from("hai_chat_skill_bindings").select(
        "module_id, skill_id, is_enabled",
      ),
      supabase.from("hai_chat_skill_references").select("*").order(
        "sort_order",
      ).order("path"),
    ]);
    const error = moduleResult.error || skillResult.error ||
      versionResult.error || bindingResult.error || referenceResult.error;
    if (error) {
      setStatus(
        `Chat Skill 加载失败：${error.message}。请确认 20260722120000 和 20260722143000 两个迁移均已执行。`,
      );
      setLoading(false);
      return;
    }

    const nextModules = (moduleResult.data as ChatModule[]) ?? [];
    const nextSkills = (skillResult.data as ChatSkill[]) ?? [];
    const nextVersions = (versionResult.data as ChatSkillVersion[]) ?? [];
    const nextBindings = (bindingResult.data as ChatSkillBinding[]) ?? [];
    const nextReferences =
      (referenceResult.data as ChatSkillReferenceDraft[]) ??
        [];
    const nextModuleId = preferredModuleId || selectedModuleId ||
      nextModules.find((item) => item.slug === "hai-chat")?.id ||
      nextModules[0]?.id || "";
    const boundSkillId = nextBindings.find((item) =>
      item.module_id === nextModuleId && item.is_enabled
    )?.skill_id;
    const nextSkillId = preferredSkillId || selectedSkillId || boundSkillId ||
      nextSkills[0]?.id || "";
    const nextSkillVersions = nextVersions.filter((item) =>
      item.skill_id === nextSkillId
    );

    setModules(nextModules);
    setSkills(nextSkills);
    setVersions(nextVersions);
    setBindings(nextBindings);
    setReferences(nextReferences);
    setSelectedModuleId(nextModuleId);
    setSelectedSkillId(nextSkillId);
    setSelectedVersionId(
      preferredVersionId ||
        nextSkillVersions.find((item) => item.status === "published")?.id ||
        nextSkillVersions[0]?.id || "",
    );
    setLoading(false);
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    const skill = skills.find((item) => item.id === selectedSkillId) ?? null;
    setSkillDraft(skill ? { ...skill } : null);
    const nextVersions = versions.filter((item) =>
      item.skill_id === selectedSkillId
    );
    if (!nextVersions.some((item) => item.id === selectedVersionId)) {
      setSelectedVersionId(
        nextVersions.find((item) => item.status === "published")?.id ||
          nextVersions[0]?.id || "",
      );
    }
  }, [selectedSkillId, skills, versions, selectedVersionId]);

  useEffect(() => {
    const version = versions.find((item) => item.id === selectedVersionId) ??
      null;
    setVersionDraft(version ? { ...version } : null);
    setReferenceConfigText(
      JSON.stringify(
        version?.reference_config ?? DEFAULT_REFERENCE_CONFIG,
        null,
        2,
      ),
    );
    setReferenceDrafts(
      references.filter((item) => item.skill_version_id === selectedVersionId)
        .map((item) => ({ ...item, metadata: { ...item.metadata } })),
    );
  }, [selectedVersionId, versions, references]);

  async function saveSkill() {
    if (!skillDraft || saving) return;
    if (!skillDraft.name.trim()) return setStatus("Skill 名称不能为空。");
    setSaving(true);
    const { error } = await supabase.from("hai_chat_skills").update({
      name: skillDraft.name.trim(),
      description: skillDraft.description.trim(),
      source_path: skillDraft.source_path.trim(),
    }).eq("id", skillDraft.id);
    setSaving(false);
    if (error) return setStatus(error.message);
    setStatus("Chat Skill 元数据已保存。");
    await loadAll(skillDraft.id, selectedVersionId, selectedModuleId);
  }

  async function toggleSkill() {
    if (!skillDraft || saving) return;
    const nextEnabled = !skillDraft.is_enabled;
    const blockedReason = chatSkillEnableBlockReason(
      nextEnabled,
      skillVersions,
    );
    if (blockedReason) return setStatus(blockedReason);
    setSaving(true);
    const { error } = await supabase.from("hai_chat_skills").update({
      is_enabled: nextEnabled,
    }).eq("id", skillDraft.id);
    setSaving(false);
    if (error) return setStatus(error.message);
    setStatus(
      nextEnabled
        ? "Skill 已启用；绑定后将优先于 Context Orchestrator。"
        : "Skill 已停用；已有绑定会自动回退到旧链路。",
    );
    await loadAll(skillDraft.id, selectedVersionId, selectedModuleId);
  }

  async function saveVersion(): Promise<boolean> {
    if (!versionDraft || saving) return false;
    if (versionDraft.status !== "draft") {
      setStatus("已发布或已归档版本只读；请新建草稿版本后再修改。");
      return false;
    }
    if (!versionDraft.instructions.trim()) {
      setStatus("Skill 指令不能为空。");
      return false;
    }
    const referenceConfig = parseJsonObject(referenceConfigText);
    if (!referenceConfig) {
      setStatus("引用配置必须是合法 JSON 对象。");
      return false;
    }
    setSaving(true);
    const { error } = await supabase.rpc(
      "hai_save_chat_skill_draft_snapshot",
      {
        p_version_id: versionDraft.id,
        p_version_label: versionDraft.version_label.trim(),
        p_instructions: versionDraft.instructions,
        p_reference_config: referenceConfig,
        p_references: serializeReferences(referenceDrafts),
      },
    );
    setSaving(false);
    if (error) {
      setStatus(error.message);
      return false;
    }
    setStatus("SKILL.md 与 references 已作为同一草稿快照保存。");
    return true;
  }

  async function publishVersion() {
    if (!versionDraft || saving) return;
    if (!await saveVersion()) return;
    setSaving(true);
    const { error } = await supabase.rpc("hai_publish_chat_skill_version", {
      p_version_id: versionDraft.id,
    });
    setSaving(false);
    if (error) return setStatus(error.message);
    setStatus(
      `已发布 ${versionDraft.version_label}；绑定模块的下一轮对话将加载它。`,
    );
    await loadAll(selectedSkillId, versionDraft.id, selectedModuleId);
  }

  async function addVersion() {
    if (!selectedSkill || saving) return;
    const base = skillVersions.find((item) => item.status === "published") ??
      skillVersions[0];
    const label = `v${skillVersions.length + 1}`;
    const baseReferences = base
      ? references.filter((item) => item.skill_version_id === base.id)
      : [];
    setSaving(true);
    const { data, error } = await supabase.rpc(
      "hai_import_chat_skill_snapshot",
      {
        p_skill_id: selectedSkill.id,
        p_version_label: label,
        p_instructions: base?.instructions || "请粘贴完整 SKILL.md 指令。",
        p_reference_config: base?.reference_config || DEFAULT_REFERENCE_CONFIG,
        p_references: serializeReferences(baseReferences),
      },
    );
    setSaving(false);
    if (error) return setStatus(error.message);
    setStatus(`已从当前版本完整复制 ${label} 草稿快照。`);
    await loadAll(selectedSkill.id, String(data), selectedModuleId);
  }

  async function importPastedBundle() {
    if (!selectedSkill || saving) return;
    const bundle = parsePastedSkillBundle(importText);
    if (!bundle.instructions.trim()) {
      return setStatus("没有识别到 SKILL.md 内容。");
    }
    await importBundle(bundle);
  }

  async function importFiles(fileList: FileList | null) {
    if (!selectedSkill || !fileList?.length || saving) return;
    const files = Array.from(fileList);
    if (files.some((file) => file.size > 200_000)) {
      return setStatus("单个导入文件不能超过 20 万字符/字节。");
    }
    const entries = await Promise.all(files.map(async (file) => ({
      path: normalizeSkillBundlePath(file.webkitRelativePath || file.name),
      content: await file.text(),
    })));
    const skillFile = entries.find((entry) =>
      entry.path.toLowerCase() === "skill.md"
    );
    if (!skillFile) return setStatus("上传内容中必须包含 SKILL.md。");
    await importBundle({
      instructions: skillFile.content,
      references: entries.filter((entry) => entry !== skillFile).map(
        (entry, index) =>
          createReferenceDraft(
            entry.path,
            entry.content,
            index,
          ),
      ),
    });
  }

  async function importBundle(bundle: ParsedSkillBundle) {
    if (!selectedSkill || saving) return;
    const label = importVersionLabel.trim() || `v${skillVersions.length + 1}`;
    setSaving(true);
    const { data, error } = await supabase.rpc(
      "hai_import_chat_skill_snapshot",
      {
        p_skill_id: selectedSkill.id,
        p_version_label: label,
        p_instructions: bundle.instructions,
        p_reference_config: DEFAULT_REFERENCE_CONFIG,
        p_references: serializeReferences(bundle.references),
      },
    );
    setSaving(false);
    if (error) return setStatus(error.message);
    setImportText("");
    setImportVersionLabel("");
    setStatus(
      `已导入 ${label} 草稿：SKILL.md + ${bundle.references.length} 个 reference 文件。确认后再发布。`,
    );
    await loadAll(selectedSkill.id, String(data), selectedModuleId);
  }

  function updateReference(
    id: string,
    patch: Partial<ChatSkillReferenceDraft>,
  ) {
    setReferenceDrafts((current) =>
      current.map((item) => item.id === id ? { ...item, ...patch } : item)
    );
  }

  async function bindSkill() {
    if (!selectedModule || !selectedSkill || saving) return;
    const blockedReason = chatSkillBindingBlockReason(
      selectedSkill,
      skillVersions,
    );
    if (blockedReason) return setStatus(blockedReason);
    setSaving(true);
    const { error } = await supabase.from("hai_chat_skill_bindings").upsert({
      module_id: selectedModule.id,
      skill_id: selectedSkill.id,
      is_enabled: true,
    }, { onConflict: "module_id" });
    setSaving(false);
    if (error) return setStatus(error.message);
    setStatus(
      `已将 ${selectedSkill.name} 绑定到 ${selectedModule.name}；下一轮对话优先加载该 Skill。`,
    );
    await loadAll(selectedSkill.id, selectedVersionId, selectedModule.id);
  }

  async function disableBinding() {
    if (!selectedBinding || saving) return;
    setSaving(true);
    const { error } = await supabase.from("hai_chat_skill_bindings").update({
      is_enabled: false,
    }).eq("module_id", selectedBinding.module_id);
    setSaving(false);
    if (error) return setStatus(error.message);
    setStatus(
      "绑定已停用；该模块将回退到 Context Orchestrator 或已发布 Prompt。",
    );
    await loadAll(selectedSkillId, selectedVersionId, selectedModuleId);
  }

  async function createSkill() {
    if (!createDraft.slug.trim() || !createDraft.name.trim() || saving) return;
    setSaving(true);
    const { data: skill, error } = await supabase.from("hai_chat_skills")
      .insert({
        slug: createDraft.slug.trim(),
        name: createDraft.name.trim(),
        description: createDraft.description.trim(),
        source_path: createDraft.source_path.trim(),
        is_enabled: false,
      }).select("id").single();
    if (error || !skill) {
      setSaving(false);
      return setStatus(error?.message || "Chat Skill 创建失败。");
    }
    const { data: version, error: versionError } = await supabase.from(
      "hai_chat_skill_versions",
    ).insert({
      skill_id: skill.id,
      version_label: "v1",
      status: "draft",
      instructions: "请粘贴完整 SKILL.md 指令。",
      default_instructions: "",
      reference_config: DEFAULT_REFERENCE_CONFIG,
    }).select("id").single();
    setSaving(false);
    if (versionError) {
      await supabase.from("hai_chat_skills").delete().eq("id", skill.id);
      return setStatus(`${versionError.message}；未完成的 Skill 已自动清理。`);
    }
    setShowCreator(false);
    setCreateDraft({ slug: "", name: "", description: "", source_path: "" });
    setStatus("已创建停用的 Chat Skill 草稿；发布版本、启用并绑定后才会生效。");
    await loadAll(skill.id, version.id, selectedModuleId);
  }

  if (loading) {
    return (
      <section className="rounded-ds-lg border border-bd bg-white p-4 text-ds-sm text-txs">
        正在加载 Chat Skill 配置…
      </section>
    );
  }

  return (
    <section className="rounded-ds-lg border border-ac/20 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Bot className="mt-0.5 h-5 w-5 text-ac" />
          <div>
            <h2 className="text-ds-lg font-ds-bold text-tx">Chat Skill 加载</h2>
            <p className="mt-1 text-ds-xs leading-relaxed text-txs">
              已绑定、已启用且存在已发布版本的 Skill 优先执行；否则安全回退到
              Context Orchestrator / 已发布
              Prompt。来源路径仅用于审计，线上执行数据库快照。
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowCreator((current) => !current)}
        >
          <Plus className="h-4 w-4" />
          {showCreator ? "取消新增" : "新增 Skill"}
        </Button>
      </div>

      {status && (
        <div className="mt-3 rounded-ds-md border border-bd bg-bg px-3 py-2 text-ds-xs text-tx">
          {status}
        </div>
      )}

      {showCreator && (
        <div className="mt-4 grid gap-3 rounded-ds-md border border-ac/20 bg-ac/5 p-3 md:grid-cols-2">
          <AdminInput
            label="Skill 标识"
            value={createDraft.slug}
            placeholder="例如 hai-consultation"
            onChange={(value) =>
              setCreateDraft((current) => ({ ...current, slug: value }))}
          />
          <AdminInput
            label="显示名称"
            value={createDraft.name}
            placeholder="例如 哈老师备课答疑"
            onChange={(value) =>
              setCreateDraft((current) => ({ ...current, name: value }))}
          />
          <AdminInput
            label="来源路径（仅审计）"
            value={createDraft.source_path}
            placeholder="/Users/.../SKILL.md"
            onChange={(value) =>
              setCreateDraft((current) => ({ ...current, source_path: value }))}
          />
          <AdminInput
            label="说明"
            value={createDraft.description}
            placeholder="适用范围与边界"
            onChange={(value) =>
              setCreateDraft((current) => ({ ...current, description: value }))}
          />
          <div className="flex justify-end md:col-span-2">
            <Button
              size="sm"
              disabled={saving}
              onClick={() => void createSkill()}
            >
              <Plus className="h-4 w-4" />创建草稿
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 rounded-ds-md border border-bd bg-bg p-3 lg:grid-cols-[1fr_1fr_auto]">
        <label className="text-ds-xs text-txs">
          Chat 模块<select
            value={selectedModuleId}
            onChange={(event) => setSelectedModuleId(event.target.value)}
            className="mt-1 h-10 w-full rounded-ds-md border border-bd bg-white px-3 text-ds-sm text-tx"
          >
            {modules.map((module) => (
              <option key={module.id} value={module.id}>
                {module.name} · {module.slug}
              </option>
            ))}
          </select>
        </label>
        <label className="text-ds-xs text-txs">
          准备绑定的 Skill<select
            value={selectedSkillId}
            onChange={(event) => setSelectedSkillId(event.target.value)}
            className="mt-1 h-10 w-full rounded-ds-md border border-bd bg-white px-3 text-ds-sm text-tx"
          >
            {skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name} · {skill.slug}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <Button
            size="sm"
            disabled={saving || !selectedSkill || !selectedModule}
            onClick={() => void bindSkill()}
          >
            <Link2 className="h-4 w-4" />绑定并启用
          </Button>
          {selectedBinding?.is_enabled && (
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => void disableBinding()}
            >
              <Unlink className="h-4 w-4" />停用绑定
            </Button>
          )}
        </div>
        <div className="lg:col-span-3 text-ds-xs text-txs">
          当前生效：{effectiveSkill
            ? (
              <Badge
                variant="outline"
                className="ml-1 border-green-200 text-green-700"
              >
                {effectiveSkill.name}
              </Badge>
            )
            : (
              <Badge variant="outline" className="ml-1">
                无 Skill，使用回退链路
              </Badge>
            )}
        </div>
      </div>

      {skills.length === 0
        ? (
          <p className="mt-4 rounded-ds-md bg-bg px-4 py-8 text-center text-ds-sm text-txs">
            暂无 Chat Skill。
          </p>
        )
        : skillDraft && selectedSkill
        ? (
          <div className="mt-4 space-y-4 rounded-ds-md border border-bd p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-ds-base font-ds-bold text-tx">
                  {selectedSkill.name}
                </h3>
                <p className="mt-1 text-[11px] text-txs">
                  {selectedSkill.slug}
                </p>
              </div>
              <Badge
                variant="outline"
                className={selectedSkill.is_enabled
                  ? "text-green-700"
                  : "text-txs"}
              >
                {selectedSkill.is_enabled ? "已启用" : "已停用"}
              </Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <AdminInput
                label="显示名称"
                value={skillDraft.name}
                placeholder="Skill 名称"
                onChange={(value) =>
                  setSkillDraft({ ...skillDraft, name: value })}
              />
              <AdminInput
                label="来源路径（仅审计）"
                value={skillDraft.source_path}
                placeholder="/Users/.../SKILL.md"
                onChange={(value) =>
                  setSkillDraft({ ...skillDraft, source_path: value })}
              />
              <label className="text-ds-xs text-txs md:col-span-2">
                说明<textarea
                  value={skillDraft.description}
                  onChange={(event) =>
                    setSkillDraft({
                      ...skillDraft,
                      description: event.target.value,
                    })}
                  rows={2}
                  className="mt-1 w-full rounded-ds-md border border-bd p-3 text-ds-sm text-tx"
                />
              </label>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => void toggleSkill()}
              >
                {skillDraft.is_enabled ? "停用 Skill" : "启用 Skill"}
              </Button>
              <Button
                size="sm"
                disabled={saving}
                onClick={() => void saveSkill()}
              >
                <Save className="h-4 w-4" />保存元数据
              </Button>
            </div>

            <div className="border-t border-bd pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-ds-sm font-ds-bold text-tx">发布版本</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void addVersion()}
                >
                  <Plus className="h-4 w-4" />新建草稿版本
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {skillVersions.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => setSelectedVersionId(version.id)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      version.id === selectedVersionId
                        ? "border-ac bg-ac text-white"
                        : "border-bd bg-white text-tx"
                    }`}
                  >
                    {version.version_label} · {version.status}
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-ds-md border border-ac/20 bg-ac/5 p-3">
                <h4 className="text-ds-xs font-ds-bold text-tx">
                  导入完整 Skill 包
                </h4>
                <p className="mt-1 text-[11px] leading-relaxed text-txs">
                  新建草稿，不会直接发布。可多选上传 SKILL.md 与 references
                  文件；也可粘贴以“=== SKILL.md ===”和“=== references/文件名
                  ===”分隔的文本包。
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <AdminInput
                    label="新版本标签"
                    value={importVersionLabel}
                    placeholder={`v${skillVersions.length + 1}`}
                    onChange={setImportVersionLabel}
                  />
                  <label className="block text-ds-xs text-txs">
                    多选 SKILL.md + references
                    <input
                      type="file"
                      multiple
                      accept=".md,.txt,.json,.yaml,.yml,.csv,text/*"
                      disabled={saving}
                      onChange={(event) => {
                        void importFiles(event.target.files);
                        event.target.value = "";
                      }}
                      className="mt-1 block w-full rounded-ds-md border border-bd bg-white px-3 py-2 text-xs text-tx"
                    />
                  </label>
                  <label className="block text-ds-xs text-txs">
                    或选择整个 Skill 文件夹
                    <input
                      type="file"
                      multiple
                      {...({
                        webkitdirectory: "",
                        directory: "",
                      } as Record<string, string>)}
                      disabled={saving}
                      onChange={(event) => {
                        void importFiles(event.target.files);
                        event.target.value = "";
                      }}
                      className="mt-1 block w-full rounded-ds-md border border-bd bg-white px-3 py-2 text-xs text-tx"
                    />
                  </label>
                </div>
                <label className="mt-3 block text-ds-xs text-txs">
                  或粘贴 Skill 文本包<textarea
                    value={importText}
                    onChange={(event) => setImportText(event.target.value)}
                    rows={7}
                    placeholder={"=== SKILL.md ===\n---\nname: ...\n---\n...\n\n=== references/methods.md ===\n..."}
                    className="mt-1 w-full rounded-ds-md border border-bd bg-white p-3 font-mono text-xs leading-relaxed text-tx"
                  />
                </label>
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving || !importText.trim()}
                    onClick={() => void importPastedBundle()}
                  >
                    <Upload className="h-4 w-4" />导入为草稿快照
                  </Button>
                </div>
              </div>
            </div>

            {versionDraft && (
              <div className="space-y-3 rounded-ds-md border border-bd bg-bg p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <AdminInput
                    label="版本标签"
                    value={versionDraft.version_label}
                    placeholder="v1"
                    disabled={versionDraft.status !== "draft"}
                    onChange={(value) =>
                      setVersionDraft({
                        ...versionDraft,
                        version_label: value,
                      })}
                  />
                  <Badge
                    variant="outline"
                    className={versionDraft.status === "published"
                      ? "text-green-700"
                      : "text-amber-700"}
                  >
                    {versionDraft.status}
                  </Badge>
                </div>
                <label className="block text-ds-xs text-txs">
                  完整 Skill 指令（可直接粘贴 SKILL.md）<textarea
                    value={versionDraft.instructions}
                    readOnly={versionDraft.status !== "draft"}
                    onChange={(event) =>
                      setVersionDraft({
                        ...versionDraft,
                        instructions: event.target.value,
                      })}
                    rows={22}
                    className="mt-1 w-full rounded-ds-md border border-bd bg-white p-3 font-mono text-xs leading-relaxed text-tx read-only:bg-slate-50"
                  />
                </label>
                <label className="block text-ds-xs text-txs">
                  引用配置 JSON<textarea
                    value={referenceConfigText}
                    readOnly={versionDraft.status !== "draft"}
                    onChange={(event) =>
                      setReferenceConfigText(event.target.value)}
                    rows={6}
                    className="mt-1 w-full rounded-ds-md border border-bd bg-white p-3 font-mono text-xs text-tx read-only:bg-slate-50"
                  />
                  <span className="mt-1 block text-[10px]">
                    method_card_limit 取
                    0–10；include_method_index、memory_enabled 支持开关。
                  </span>
                </label>
                <div className="space-y-2 rounded-ds-md border border-bd bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-ds-xs font-ds-bold text-tx">
                        Versioned references
                      </h4>
                      <p className="mt-1 text-[10px] text-txs">
                        当前版本共 {referenceDrafts.length}{" "}
                        个文件；发布时内容、哈希和加载策略一起冻结。
                      </p>
                    </div>
                    {versionDraft.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setReferenceDrafts((current) => [
                            ...current,
                            createReferenceDraft(
                              `references/reference-${current.length + 1}.md`,
                              "",
                              current.length,
                            ),
                          ])}
                      >
                        <Plus className="h-4 w-4" />添加 reference
                      </Button>
                    )}
                  </div>
                  {referenceDrafts.length === 0
                    ? (
                      <p className="rounded-ds-md bg-bg px-3 py-4 text-center text-xs text-txs">
                        当前版本没有 reference 文件。
                      </p>
                    )
                    : referenceDrafts.map((reference, index) => (
                      <div
                        key={reference.id}
                        className="space-y-2 rounded-ds-md border border-bd bg-bg p-3"
                      >
                        <div className="grid gap-2 md:grid-cols-[1fr_160px_110px]">
                          <AdminInput
                            label="相对路径"
                            value={reference.path}
                            placeholder="references/example.md"
                            disabled={versionDraft.status !== "draft"}
                            onChange={(value) =>
                              updateReference(reference.id, {
                                path: normalizeSkillBundlePath(value),
                              })}
                          />
                          <label className="text-ds-xs text-txs">
                            加载策略<select
                              value={reference.load_mode}
                              disabled={versionDraft.status !== "draft"}
                              onChange={(event) =>
                                updateReference(reference.id, {
                                  load_mode: event.target
                                    .value as ChatSkillReferenceDraft[
                                      "load_mode"
                                    ],
                                })}
                              className="mt-1 h-10 w-full rounded-ds-md border border-bd bg-white px-2 text-xs text-tx disabled:bg-slate-50"
                            >
                              <option value="always">always</option>
                              <option value="on_demand">on_demand</option>
                              <option value="evaluation_only">
                                evaluation_only
                              </option>
                            </select>
                          </label>
                          <AdminInput
                            label="字符上限"
                            value={String(reference.max_chars)}
                            placeholder="12000"
                            disabled={versionDraft.status !== "draft"}
                            onChange={(value) =>
                              updateReference(reference.id, {
                                max_chars: Number(value) || 12000,
                              })}
                          />
                        </div>
                        <AdminInput
                          label="说明（帮助按题匹配）"
                          value={reference.description}
                          placeholder="适用于什么问题"
                          disabled={versionDraft.status !== "draft"}
                          onChange={(value) =>
                            updateReference(reference.id, {
                              description: value,
                            })}
                        />
                        <label className="block text-ds-xs text-txs">
                          文件内容<textarea
                            value={reference.content}
                            readOnly={versionDraft.status !== "draft"}
                            onChange={(event) =>
                              updateReference(reference.id, {
                                content: event.target.value,
                              })}
                            rows={8}
                            className="mt-1 w-full rounded-ds-md border border-bd bg-white p-3 font-mono text-xs leading-relaxed text-tx read-only:bg-slate-50"
                          />
                        </label>
                        <div className="flex items-center justify-between gap-2 text-[10px] text-txs">
                          <span>
                            {reference.content.length} 字符 · 顺序 {index + 1}
                          </span>
                          {versionDraft.status === "draft" && (
                            <button
                              type="button"
                              className="text-red-600 hover:underline"
                              onClick={() =>
                                setReferenceDrafts((current) =>
                                  current.filter((item) =>
                                    item.id !== reference.id
                                  )
                                )}
                            >
                              移除
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  {versionDraft.status !== "draft" && (
                    <div className="rounded-ds-md border border-green-200 bg-green-50 px-3 py-2 text-[10px] text-green-800">
                      快照哈希：{versionDraft.snapshot_hash ||
                        "历史版本尚未回填"}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={versionDraft.status !== "draft" ||
                      !versionDraft.default_instructions}
                    onClick={() =>
                      setVersionDraft({
                        ...versionDraft,
                        instructions: versionDraft.default_instructions,
                      })}
                  >
                    <RotateCcw className="h-4 w-4" />恢复默认
                  </Button>
                  {versionDraft.status === "draft" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={saving}
                      onClick={() => void saveVersion()}
                    >
                      <Save className="h-4 w-4" />保存版本
                    </Button>
                  )}
                  {versionDraft.status === "draft"
                    ? (
                      <Button
                        size="sm"
                        disabled={saving}
                        onClick={() => void publishVersion()}
                      >
                        <Upload className="h-4 w-4" />发布版本
                      </Button>
                    )
                    : versionDraft.status === "published"
                    ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700">
                        <CheckCircle2 className="h-4 w-4" />当前已发布
                      </span>
                    )
                    : <span className="text-xs text-txs">已归档，只读</span>}
                </div>
              </div>
            )}
          </div>
        )
        : null}
    </section>
  );
}

export function chatSkillEnableBlockReason(
  nextEnabled: boolean,
  versions: Array<Pick<ChatSkillVersion, "status">>,
) {
  if (
    nextEnabled && !versions.some((version) => version.status === "published")
  ) {
    return "请先发布至少一个 Skill 版本，再启用该 Skill。";
  }
  return null;
}

export function chatSkillBindingBlockReason(
  skill: Pick<ChatSkill, "is_enabled">,
  versions: Array<Pick<ChatSkillVersion, "status">>,
) {
  if (!skill.is_enabled) return "请先启用这个 Skill，再绑定到 Chat 模块。";
  if (!versions.some((version) => version.status === "published")) {
    return "请先发布至少一个 Skill 版本，再绑定到 Chat 模块。";
  }
  return null;
}

export type ParsedSkillBundle = {
  instructions: string;
  references: ChatSkillReferenceDraft[];
};

export function parsePastedSkillBundle(value: string): ParsedSkillBundle {
  const marker = /^===\s*(SKILL\.md|references\/[^=\r\n]+?)\s*===\s*$/gmi;
  const matches = Array.from(value.matchAll(marker));
  if (matches.length === 0) {
    return { instructions: value.trim(), references: [] };
  }

  let instructions = "";
  const references: ChatSkillReferenceDraft[] = [];
  matches.forEach((match, index) => {
    const path = normalizeSkillBundlePath(match[1]);
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? value.length;
    const content = value.slice(start, end).replace(/^\r?\n/, "").trimEnd();
    if (path.toLowerCase() === "skill.md") {
      instructions = content;
    } else {
      references.push(createReferenceDraft(path, content, references.length));
    }
  });
  return { instructions, references };
}

export function normalizeSkillBundlePath(value: string) {
  const normalized = value.trim().replace(/\\/g, "/").replace(/^\.\//, "")
    .replace(/\/{2,}/g, "/");
  if (/(^|\/)SKILL\.md$/i.test(normalized)) return "SKILL.md";
  const referenceIndex = normalized.toLowerCase().indexOf("references/");
  if (referenceIndex >= 0) return normalized.slice(referenceIndex);
  const basename = normalized.split("/").filter(Boolean).pop() ||
    "reference.md";
  return `references/${basename}`;
}

function createReferenceDraft(
  path: string,
  content: string,
  sortOrder: number,
): ChatSkillReferenceDraft {
  const normalizedPath = normalizeSkillBundlePath(path);
  return {
    id: globalThis.crypto?.randomUUID?.() ??
      `local-${Date.now()}-${sortOrder}`,
    skill_version_id: "",
    path: normalizedPath,
    name: normalizedPath.split("/").pop() || normalizedPath,
    description: "",
    media_type: mediaTypeForPath(normalizedPath),
    content,
    content_hash: "",
    load_mode: "on_demand",
    max_chars: 12000,
    sort_order: sortOrder * 10,
    metadata: {},
  };
}

function serializeReferences(references: ChatSkillReferenceDraft[]) {
  return references.map((reference, index) => ({
    path: normalizeSkillBundlePath(reference.path),
    name: reference.name || reference.path.split("/").pop() || reference.path,
    description: reference.description,
    media_type: reference.media_type || mediaTypeForPath(reference.path),
    content: reference.content,
    load_mode: reference.load_mode,
    max_chars: reference.max_chars,
    sort_order: index * 10,
    metadata: reference.metadata || {},
  }));
}

function mediaTypeForPath(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "md") return "text/markdown";
  if (extension === "json") return "application/json";
  if (extension === "yaml" || extension === "yml") {
    return "application/yaml";
  }
  if (extension === "csv") return "text/csv";
  return "text/plain";
}

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function AdminInput(
  { label, value, placeholder, onChange, disabled = false }: {
    label: string;
    value: string;
    placeholder: string;
    onChange: (value: string) => void;
    disabled?: boolean;
  },
) {
  return (
    <label className="block text-ds-xs text-txs">
      {label}
      <input
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-ds-md border border-bd bg-white px-3 text-ds-sm text-tx disabled:bg-slate-50"
      />
    </label>
  );
}
