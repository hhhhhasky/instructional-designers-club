import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Bot, BookOpen, CheckCircle2, GitBranch, KeyRound, Layers3, Loader2, Pencil, Plus, RefreshCw, Route, Save, Settings2, SlidersHorizontal, Ticket, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/db/supabase";
import { getAdminStudentList, type StudentItem } from "@/db/admin-api";
import type { HaiFeatureModule } from "@/db/hai-api";

interface HaiUserAccessRow {
  user_id: string;
  status: "active" | "paused" | "revoked";
  access_source: string;
  quota_policy_key: string;
  expires_at: string | null;
  notes: string | null;
  profiles?: {
    nickname: string;
    phone: string;
    access_level: string;
  } | null | Array<{
    nickname: string;
    phone: string;
    access_level: string;
  }>;
}

interface HaiInviteCode {
  id: string;
  code: string;
  label: string;
  quota_policy_key: string;
  max_uses: number;
  used_count: number;
  status: "active" | "disabled";
  expires_at: string | null;
}

interface HaiQuotaPolicy {
  key: string;
  label: string;
  daily_token_limit: number;
  weekly_token_limit: number;
  single_request_token_limit: number;
  max_output_tokens: number;
  user_concurrency_limit: number;
  global_concurrency_limit: number;
  enabled: boolean;
}

interface HaiPromptVersion {
  id: string;
  module_id: string;
  version_label: string;
  status: "draft" | "published" | "archived";
  system_prompt: string;
  developer_prompt: string;
  response_contract: string;
  created_at: string;
}

interface HaiKnowledgeSource {
  id: string;
  title: string;
  topic: string | null;
  source_type: string;
  visibility: "private" | "shared";
  is_active: boolean;
  metadata: Record<string, unknown>;
  updated_at: string;
  chunk_count?: number;
}

interface HaiRuntimeSetting {
  key: string;
  label: string;
  description: string;
  category: string;
  value: string | number | boolean;
  default_value: string | number | boolean;
  value_type: "number" | "integer" | "boolean" | "string" | "select";
  min_value: number | null;
  max_value: number | null;
  step: number | null;
  options: Array<{ label?: string; value: string | number | boolean }>;
  unit: string | null;
  enabled: boolean;
}

interface HaiOrchestratorPromptConfig {
  key: string;
  layer_order: number;
  layer_key: string;
  label: string;
  description: string;
  content: string;
  default_content: string;
  enabled: boolean;
  updated_at: string;
}

type HanMethodCardKind =
  | "methodology"
  | "framework"
  | "method"
  | "strategy"
  | "consultation_standard";

type HanMethodCardOwnership =
  | "han_course"
  | "course_adapted_theory"
  | "consultation_calibration";

type MethodIntentTag =
  | "teaching_design"
  | "lesson_plan_diagnosis"
  | "public_lesson"
  | "learning_profile"
  | "classroom_management"
  | "learning_motivation"
  | "assessment_feedback"
  | "ai_lesson_planning"
  | "pbl_crossdisciplinary"
  | "teacher_growth"
  | "general_question"
  | "unknown";

interface HanMethodCard {
  id: string;
  name: string;
  aliases: string[];
  course: string;
  kind: HanMethodCardKind;
  ownership: HanMethodCardOwnership;
  priority: number;
  summary: string;
  useWhen: string[];
  avoidWhen: string[];
  coreJudgement: string;
  moves: string[];
  answerFocus: string;
  queryTerms: string[];
  intents: MethodIntentTag[];
  related: string[];
  sourceRefs: string[];
}

interface HaiMethodCardConfigRow {
  id: string;
  name: string;
  aliases: string[];
  course: string;
  kind: HanMethodCardKind;
  ownership: HanMethodCardOwnership;
  priority: number;
  summary: string;
  use_when: string[];
  avoid_when: string[];
  core_judgement: string;
  moves: string[];
  answer_focus: string;
  query_terms: string[];
  intents: MethodIntentTag[];
  related: string[];
  source_refs: string[];
  enabled: boolean;
  is_deleted: boolean;
  updated_at: string;
  created_at?: string;
}

type MethodCardAdminItem = HanMethodCard & {
  enabled: boolean;
  isBuiltin: boolean;
  hasDatabaseOverride: boolean;
  updatedAt: string | null;
};

type PromptConfigKind = "custom_context" | "diagnostic_module";

const BASE_PROMPT_CONFIG_KEYS = new Set([
  "core_identity",
  "safety_boundaries",
  "semantic_router_prompt",
  "style_pack",
  "diagnostic_module.showcase_lesson_diagnosis",
  "diagnostic_module.showcase_lesson_design",
  "diagnostic_module.daily_improvement_diagnosis",
  "diagnostic_module.daily_improvement_design",
  "diagnostic_module.teaching_concept_qa",
]);

export default function HaiManagementSection() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [accessRows, setAccessRows] = useState<HaiUserAccessRow[]>([]);
  const [invites, setInvites] = useState<HaiInviteCode[]>([]);
  const [modules, setModules] = useState<HaiFeatureModule[]>([]);
  const [quotas, setQuotas] = useState<HaiQuotaPolicy[]>([]);
  const [prompts, setPrompts] = useState<HaiPromptVersion[]>([]);
  const [knowledgeSources, setKnowledgeSources] = useState<HaiKnowledgeSource[]>([]);
  const [runtimeSettings, setRuntimeSettings] = useState<HaiRuntimeSetting[]>([]);
  const [orchestratorPromptConfigs, setOrchestratorPromptConfigs] = useState<HaiOrchestratorPromptConfig[]>([]);
  const [defaultMethodCards, setDefaultMethodCards] = useState<HanMethodCard[]>([]);
  const [methodCardConfigRows, setMethodCardConfigRows] = useState<HaiMethodCardConfigRow[]>([]);
  const [selectedMethodCardId, setSelectedMethodCardId] = useState("");
  const [methodCardDraft, setMethodCardDraft] = useState<MethodCardAdminItem | null>(null);
  const [methodCardSearch, setMethodCardSearch] = useState("");
  const [creatingMethodCard, setCreatingMethodCard] = useState(false);
  const [selectedPromptConfigKey, setSelectedPromptConfigKey] = useState("");
  const [promptConfigDraft, setPromptConfigDraft] = useState("");
  const [showPromptConfigCreator, setShowPromptConfigCreator] = useState(false);
  const [promptConfigCreateDraft, setPromptConfigCreateDraft] = useState({
    kind: "custom_context" as PromptConfigKind,
    slug: "",
    label: "",
    description: "",
    content: "",
  });
  const promptConfigDraftKeyRef = useRef("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [promptDraft, setPromptDraft] = useState({ versionLabel: "v-next", systemPrompt: "", developerPrompt: "", responseContract: "" });
  const [inviteDraft, setInviteDraft] = useState({ code: "", label: "HAI 内测邀请", quotaPolicyKey: "beta", maxUses: 1 });
  const [knowledgeDraft, setKnowledgeDraft] = useState({ title: "", topic: "教学设计理论", content: "" });
  const [knowledgeEdit, setKnowledgeEdit] = useState<{ id: string; title: string; topic: string; content: string } | null>(null);
  const [loadingKnowledgeId, setLoadingKnowledgeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const selectedModule = modules.find((item) => item.id === selectedModuleId) ?? modules[0] ?? null;

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const keyword = studentSearch.trim().toLowerCase();
    return students.filter(
      (s) => s.nickname.toLowerCase().includes(keyword) || s.phone.includes(keyword),
    );
  }, [students, studentSearch]);
  const currentPrompt = useMemo(
    () => prompts.find((item) => item.module_id === selectedModule?.id && item.status === "published") ?? null,
    [prompts, selectedModule?.id],
  );
  const askHanModule = useMemo(
    () => modules.find((item) => item.slug === "ask-han") ?? selectedModule,
    [modules, selectedModule],
  );
  const orchestratorSettings = useMemo(
    () => runtimeSettings.filter((setting) => setting.category === "上下文编排"),
    [runtimeSettings],
  );
  const evaluatorSettings = useMemo(
    () => runtimeSettings.filter((setting) => setting.category === "质检"),
    [runtimeSettings],
  );
  const routerSettings = useMemo(
    () => runtimeSettings.filter((setting) => setting.category === "路由"),
    [runtimeSettings],
  );
  const selectedPromptConfig = useMemo(
    () => orchestratorPromptConfigs.find((item) => item.key === selectedPromptConfigKey) ?? orchestratorPromptConfigs[0] ?? null,
    [orchestratorPromptConfigs, selectedPromptConfigKey],
  );
  const methodCardItems = useMemo(
    () => buildMethodCardAdminItems(defaultMethodCards, methodCardConfigRows),
    [defaultMethodCards, methodCardConfigRows],
  );
  const filteredMethodCardItems = useMemo(() => {
    const keyword = methodCardSearch.trim().toLowerCase();
    if (!keyword) return methodCardItems;
    return methodCardItems.filter((card) =>
      [
        card.id,
        card.name,
        card.course,
        card.summary,
        ...card.aliases,
        ...card.queryTerms,
      ].some((value) => value.toLowerCase().includes(keyword))
    );
  }, [methodCardItems, methodCardSearch]);
  const selectedMethodCard = useMemo(
    () => methodCardItems.find((card) => card.id === selectedMethodCardId) ?? null,
    [methodCardItems, selectedMethodCardId],
  );
  const promptConfigDirty = selectedPromptConfig ? promptConfigDraft !== selectedPromptConfig.content : false;
  const promptConfigMatchesDefault = selectedPromptConfig ? promptConfigDraft.trim() === selectedPromptConfig.default_content.trim() : false;
  const enabledPromptConfigCount = orchestratorPromptConfigs.filter((item) => item.enabled).length;
  const promptConfigGroups = useMemo(() => {
    const groups = new Map<string, HaiOrchestratorPromptConfig[]>();
    for (const config of orchestratorPromptConfigs) {
      const statusLabel = config.enabled ? "当前生效" : "已停用 / 归档";
      const label = `${statusLabel} · ${config.layer_order}｜${config.layer_key}`;
      groups.set(label, [...(groups.get(label) ?? []), config]);
    }
    return Array.from(groups.entries());
  }, [orchestratorPromptConfigs]);
  const orchestratorEnabled = Boolean(runtimeSettings.find((item) => item.key === "context.orchestrator_enabled")?.value ?? true);
  const evaluatorEnabled = Boolean(runtimeSettings.find((item) => item.key === "evaluator.enabled")?.value ?? true);
  const passScore = Number(runtimeSettings.find((item) => item.key === "evaluator.pass_score")?.value ?? 78);

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!selectedModule) return;
    const prompt = prompts.find((item) => item.module_id === selectedModule.id && item.status === "published");
    setPromptDraft({
      versionLabel: prompt?.version_label ? `${prompt.version_label}-next` : "v-next",
      systemPrompt: prompt?.system_prompt ?? "",
      developerPrompt: prompt?.developer_prompt ?? "",
      responseContract: prompt?.response_contract ?? "",
    });
  }, [selectedModule, prompts]);

  useEffect(() => {
    if (!selectedPromptConfig) {
      promptConfigDraftKeyRef.current = "";
      setPromptConfigDraft("");
      return;
    }
    const keyChanged = promptConfigDraftKeyRef.current !== selectedPromptConfig.key;
    if (keyChanged || !promptConfigDirty) {
      promptConfigDraftKeyRef.current = selectedPromptConfig.key;
      setPromptConfigDraft(selectedPromptConfig.content);
    }
  }, [selectedPromptConfig, promptConfigDirty]);

  useEffect(() => {
    if (creatingMethodCard) return;
    if (!selectedMethodCard) {
      setMethodCardDraft(null);
      return;
    }
    setMethodCardDraft(cloneMethodCardAdminItem(selectedMethodCard));
  }, [creatingMethodCard, selectedMethodCard]);

  async function loadAll() {
    setLoading(true);
    setLoadError("");
    setStatus("");
    try {
      const [
        studentRows,
        accessResult,
        inviteResult,
        moduleResult,
        quotaResult,
        promptResult,
        knowledgeResult,
        knowledgeChunkResult,
        runtimeResult,
        orchestratorPromptResult,
        methodCardResult,
      ] = await Promise.all([
        getAdminStudentList(),
        supabase
          .from("hai_user_access")
          .select("*, profiles!user_id(nickname, phone, access_level)")
          .order("granted_at", { ascending: false }),
        supabase
          .from("hai_invite_codes")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("hai_feature_modules")
          .select("*")
          .order("sort_order", { ascending: true }),
        supabase
          .from("hai_quota_policies")
          .select("*")
          .order("key", { ascending: true }),
        supabase
          .from("hai_prompt_versions")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("hai_knowledge_sources")
          .select("id, title, topic, source_type, visibility, is_active, metadata, updated_at")
          .order("updated_at", { ascending: false })
          .limit(30),
        supabase
          .from("hai_knowledge_chunks")
          .select("source_id"),
        supabase
          .from("hai_runtime_settings")
          .select("*")
          .order("category", { ascending: true })
          .order("key", { ascending: true }),
        supabase
          .from("hai_orchestrator_prompt_configs")
          .select("*")
          .order("layer_order", { ascending: true })
          .order("key", { ascending: true }),
        supabase.functions.invoke("hai-method-cards-admin", { body: {} }),
      ]);

      if (accessResult.error) throw accessResult.error;
      if (inviteResult.error) throw inviteResult.error;
      if (moduleResult.error) throw moduleResult.error;
      if (quotaResult.error) throw quotaResult.error;
      if (promptResult.error) throw promptResult.error;
      if (knowledgeResult.error) throw knowledgeResult.error;
      if (knowledgeChunkResult.error) throw knowledgeChunkResult.error;
      if (runtimeResult.error) throw runtimeResult.error;
      if (orchestratorPromptResult.error) throw orchestratorPromptResult.error;
      if (methodCardResult.error) throw methodCardResult.error;

      setStudents(studentRows);
      setAccessRows((accessResult.data as HaiUserAccessRow[]) ?? []);
      setInvites((inviteResult.data as HaiInviteCode[]) ?? []);
      const moduleRows = (moduleResult.data as HaiFeatureModule[]) ?? [];
      setModules(moduleRows);
      setSelectedModuleId((current) => current || moduleRows[0]?.id || "");
      setQuotas((quotaResult.data as HaiQuotaPolicy[]) ?? []);
      setPrompts((promptResult.data as HaiPromptVersion[]) ?? []);
      const chunkCounts = new Map<string, number>();
      for (const chunk of (knowledgeChunkResult.data ?? []) as Array<{ source_id: string }>) {
        chunkCounts.set(chunk.source_id, (chunkCounts.get(chunk.source_id) ?? 0) + 1);
      }
      setKnowledgeSources(((knowledgeResult.data as HaiKnowledgeSource[]) ?? []).map((source) => ({
        ...source,
        chunk_count: chunkCounts.get(source.id) ?? 0,
      })));
      setRuntimeSettings((runtimeResult.data as HaiRuntimeSetting[]) ?? []);
      const promptConfigRows = (orchestratorPromptResult.data as HaiOrchestratorPromptConfig[]) ?? [];
      setOrchestratorPromptConfigs(promptConfigRows);
      setSelectedPromptConfigKey((current) => current || promptConfigRows[0]?.key || "");
      const methodCardPayload = (methodCardResult.data ?? {}) as {
        default_cards?: HanMethodCard[];
        override_rows?: HaiMethodCardConfigRow[];
      };
      const methodCardDefaults = methodCardPayload.default_cards ?? [];
      const methodCardRows = methodCardPayload.override_rows ?? [];
      setDefaultMethodCards(methodCardDefaults);
      setMethodCardConfigRows(methodCardRows);
      const methodCards = buildMethodCardAdminItems(
        methodCardDefaults,
        methodCardRows,
      );
      setSelectedMethodCardId((current) =>
        methodCards.some((card) => card.id === current)
          ? current
          : methodCards[0]?.id ?? ""
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }

  async function grantAccess() {
    if (!selectedUserId || saving) return;
    setSaving(true);
    setStatus("");
    try {
      const { error } = await supabase.from("hai_user_access").upsert({
        user_id: selectedUserId,
        status: "active",
        access_source: "admin",
        quota_policy_key: "beta",
        granted_at: new Date().toISOString(),
      });
      if (error) throw error;
      await loadAll();
      setStatus("内测授权已保存。");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "未知错误";
      setStatus(`授权失败：${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function createInvite() {
    const code = inviteDraft.code.trim();
    if (!code || saving) return;
    setSaving(true);
    setStatus("");
    try {
      const { error } = await supabase.from("hai_invite_codes").insert({
        code,
        label: inviteDraft.label,
        quota_policy_key: inviteDraft.quotaPolicyKey,
        max_uses: inviteDraft.maxUses,
        status: "active",
      });
      if (error) throw error;
      setInviteDraft({ code: "", label: "HAI 内测邀请", quotaPolicyKey: "beta", maxUses: 1 });
      await loadAll();
      setStatus("邀请码已创建。");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "未知错误";
      setStatus(`创建失败：${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function updateAccess(row: HaiUserAccessRow, updates: Partial<HaiUserAccessRow>) {
    const { error } = await supabase.from("hai_user_access").update(updates).eq("user_id", row.user_id);
    if (error) {
      setStatus(error.message);
      return;
    }
    await loadAll();
  }

  async function updateModule(module: HaiFeatureModule, updates: Partial<HaiFeatureModule>) {
    const { error } = await supabase.from("hai_feature_modules").update(updates).eq("id", module.id);
    if (error) {
      setStatus(error.message);
      return;
    }
    await loadAll();
  }

  async function updateRuntimeSetting(setting: HaiRuntimeSetting, value: string | number | boolean, enabled = setting.enabled) {
    const normalized = normalizeRuntimeValue(setting, value);
    const { error } = await supabase
      .from("hai_runtime_settings")
      .update({ value: normalized, enabled, updated_at: new Date().toISOString() })
      .eq("key", setting.key);
    if (error) {
      setStatus(error.message);
      return;
    }
    setRuntimeSettings((current) => current.map((item) => (
      item.key === setting.key ? { ...item, value: normalized, enabled } : item
    )));
    setStatus("运行时设置已保存。");
  }

  async function updateOrchestratorPromptConfig(config: HaiOrchestratorPromptConfig, updates: Partial<HaiOrchestratorPromptConfig>) {
    if (saving) return;
    setSaving(true);
    setStatus("");
    try {
      const updatedAt = new Date().toISOString();
      const { error } = await supabase
        .from("hai_orchestrator_prompt_configs")
        .update({
          ...updates,
          updated_at: updatedAt,
        })
        .eq("key", config.key);
      if (error) throw error;
      setOrchestratorPromptConfigs((current) => current.map((item) => (
        item.key === config.key ? { ...item, ...updates, updated_at: updatedAt } : item
      )));
      setStatus("上下文编排 Prompt 已保存。");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "未知错误";
      setStatus(`编排配置保存失败：${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveSelectedPromptConfig() {
    const content = promptConfigDraft.trim();
    if (!selectedPromptConfig || saving || !content || !promptConfigDirty) return;
    await updateOrchestratorPromptConfig(selectedPromptConfig, { content });
  }

  async function resetSelectedPromptConfig() {
    if (!selectedPromptConfig || saving) return;
    setPromptConfigDraft(selectedPromptConfig.default_content);
    await updateOrchestratorPromptConfig(selectedPromptConfig, { content: selectedPromptConfig.default_content });
  }

  async function createOrchestratorPromptConfig() {
    if (saving) return;
    const slug = normalizePromptConfigSlug(promptConfigCreateDraft.slug);
    const content = promptConfigCreateDraft.content.trim();
    const label = promptConfigCreateDraft.label.trim();
    if (!slug || !content || !label) {
      setStatus("新增失败：请填写名称、英文标识和提示词内容。");
      return;
    }
    const prefix = promptConfigCreateDraft.kind === "diagnostic_module"
      ? "diagnostic_module"
      : "custom_context";
    const key = `${prefix}.${slug}`;
    if (orchestratorPromptConfigs.some((item) => item.key === key)) {
      setStatus(`新增失败：${key} 已存在。`);
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      const now = new Date().toISOString();
      const row: HaiOrchestratorPromptConfig = {
        key,
        layer_order: promptConfigCreateDraft.kind === "diagnostic_module" ? 4 : 6,
        layer_key: prefix,
        label,
        description: promptConfigCreateDraft.description.trim() ||
          (promptConfigCreateDraft.kind === "diagnostic_module"
            ? "管理员新增的动态诊断模块。保存后自动进入语义路由候选。"
            : "管理员新增的通用上下文层。启用后自动注入回答编排。"),
        content,
        default_content: content,
        enabled: true,
        updated_at: now,
      };
      const { error } = await supabase
        .from("hai_orchestrator_prompt_configs")
        .insert(row);
      if (error) throw error;
      setOrchestratorPromptConfigs((current) =>
        sortPromptConfigs([...current, row])
      );
      setSelectedPromptConfigKey(key);
      setPromptConfigCreateDraft({
        kind: "custom_context",
        slug: "",
        label: "",
        description: "",
        content: "",
      });
      setShowPromptConfigCreator(false);
      setStatus(promptConfigCreateDraft.kind === "diagnostic_module"
        ? "新的诊断模块已创建，并已同步到语义路由和后端数据库。"
        : "新的上下文层已创建，并已同步到回答编排和后端数据库。");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "未知错误";
      setStatus(`新增失败：${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrchestratorPromptConfig(
    config: HaiOrchestratorPromptConfig,
  ) {
    if (saving || BASE_PROMPT_CONFIG_KEYS.has(config.key)) return;
    if (!window.confirm(`确定删除“${config.label}”吗？删除后会立即停止注入 HAI。`)) {
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      const { error } = await supabase
        .from("hai_orchestrator_prompt_configs")
        .delete()
        .eq("key", config.key);
      if (error) throw error;
      const remaining = orchestratorPromptConfigs.filter((item) =>
        item.key !== config.key
      );
      setOrchestratorPromptConfigs(remaining);
      setSelectedPromptConfigKey(remaining[0]?.key ?? "");
      setStatus("上下文层已删除，并已从后端数据库和运行时编排中移除。");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "未知错误";
      setStatus(`删除上下文失败：${msg}`);
    } finally {
      setSaving(false);
    }
  }

  function startCreateMethodCard() {
    setCreatingMethodCard(true);
    setSelectedMethodCardId("");
    setMethodCardDraft(createEmptyMethodCardDraft());
  }

  function cancelCreateMethodCard() {
    setCreatingMethodCard(false);
    const fallback = methodCardItems[0] ?? null;
    setSelectedMethodCardId(fallback?.id ?? "");
    setMethodCardDraft(fallback ? cloneMethodCardAdminItem(fallback) : null);
  }

  async function saveMethodCard() {
    if (!methodCardDraft || saving) return;
    const normalizedId = normalizePromptConfigSlug(methodCardDraft.id);
    const normalized = {
      ...methodCardDraft,
      id: normalizedId,
      name: methodCardDraft.name.trim(),
      course: methodCardDraft.course.trim(),
      summary: methodCardDraft.summary.trim(),
      coreJudgement: methodCardDraft.coreJudgement.trim(),
      answerFocus: methodCardDraft.answerFocus.trim(),
    };
    if (
      !normalized.id ||
      !normalized.name ||
      !normalized.course ||
      !normalized.summary ||
      !normalized.coreJudgement ||
      !normalized.answerFocus
    ) {
      setStatus("方法卡保存失败：请填写标识、名称、课程、摘要、核心判断和回答聚焦。");
      return;
    }
    if (
      creatingMethodCard &&
      methodCardItems.some((card) => card.id === normalized.id)
    ) {
      setStatus(`方法卡保存失败：${normalized.id} 已存在。`);
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      const now = new Date().toISOString();
      const row = methodCardToConfigRow(normalized, now);
      const { error } = await supabase
        .from("hai_method_card_configs")
        .upsert(row);
      if (error) throw error;
      setMethodCardConfigRows((current) => [
        ...current.filter((item) => item.id !== row.id),
        row,
      ]);
      setCreatingMethodCard(false);
      setSelectedMethodCardId(row.id);
      setStatus("方法卡已保存到后端数据库，并已同步到语义路由和回答编排。");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "未知错误";
      setStatus(`方法卡保存失败：${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleMethodCard(card: MethodCardAdminItem) {
    if (saving) return;
    setMethodCardDraft((current) =>
      current?.id === card.id ? { ...current, enabled: !card.enabled } : current
    );
    await persistMethodCardOverride(
      { ...card, enabled: !card.enabled },
      !card.enabled ? "方法卡已启用。" : "方法卡已停用，运行时不会再选择它。",
    );
  }

  async function resetMethodCardToDefault(card: MethodCardAdminItem) {
    if (saving || !card.isBuiltin || !card.hasDatabaseOverride) return;
    if (!window.confirm(`确定把“${card.name}”恢复为代码默认版本吗？`)) {
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      const { error } = await supabase
        .from("hai_method_card_configs")
        .delete()
        .eq("id", card.id);
      if (error) throw error;
      setMethodCardConfigRows((current) =>
        current.filter((item) => item.id !== card.id)
      );
      const defaultCard = defaultMethodCards.find((item) => item.id === card.id);
      setMethodCardDraft(defaultCard
        ? cloneMethodCardAdminItem(toDefaultMethodCardAdminItem(defaultCard))
        : null);
      setStatus("方法卡已恢复为代码默认版本。");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "未知错误";
      setStatus(`方法卡恢复失败：${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteMethodCard(card: MethodCardAdminItem) {
    if (saving) return;
    if (!window.confirm(`确定删除“${card.name}”吗？删除后路由不会再选择它。`)) {
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      if (card.isBuiltin) {
        const row = methodCardToConfigRow(
          { ...card, enabled: false },
          new Date().toISOString(),
          true,
        );
        const { error } = await supabase
          .from("hai_method_card_configs")
          .upsert(row);
        if (error) throw error;
        setMethodCardConfigRows((current) => [
          ...current.filter((item) => item.id !== row.id),
          row,
        ]);
      } else {
        const { error } = await supabase
          .from("hai_method_card_configs")
          .delete()
          .eq("id", card.id);
        if (error) throw error;
        setMethodCardConfigRows((current) =>
          current.filter((item) => item.id !== card.id)
        );
      }
      setCreatingMethodCard(false);
      setSelectedMethodCardId("");
      setMethodCardDraft(null);
      setStatus("方法卡已删除，并已从路由候选和回答上下文中移除。");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "未知错误";
      setStatus(`方法卡删除失败：${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function persistMethodCardOverride(
    card: MethodCardAdminItem,
    successMessage: string,
  ) {
    setSaving(true);
    setStatus("");
    try {
      const row = methodCardToConfigRow(card, new Date().toISOString());
      const { error } = await supabase
        .from("hai_method_card_configs")
        .upsert(row);
      if (error) throw error;
      setMethodCardConfigRows((current) => [
        ...current.filter((item) => item.id !== row.id),
        row,
      ]);
      setStatus(successMessage);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "未知错误";
      setStatus(`方法卡保存失败：${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function updateQuota(policy: HaiQuotaPolicy, updates: Partial<HaiQuotaPolicy>) {
    const { error } = await supabase.from("hai_quota_policies").update(updates).eq("key", policy.key);
    if (error) {
      setStatus(error.message);
      return;
    }
    await loadAll();
  }

  async function publishPrompt() {
    if (!selectedModule || !promptDraft.systemPrompt.trim() || saving) return;
    setSaving(true);
    setStatus("");
    try {
      const { error: archiveError } = await supabase
        .from("hai_prompt_versions")
        .update({ status: "archived" })
        .eq("module_id", selectedModule.id)
        .eq("status", "published");
      if (archiveError) throw archiveError;

      const { error } = await supabase.from("hai_prompt_versions").insert({
        module_id: selectedModule.id,
        version_label: promptDraft.versionLabel.trim() || "v-next",
        status: "published",
        system_prompt: promptDraft.systemPrompt,
        developer_prompt: promptDraft.developerPrompt,
        response_contract: promptDraft.responseContract,
        published_at: new Date().toISOString(),
      });
      if (error) throw error;
      await loadAll();
      setStatus("Prompt 新版本已发布。");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "未知错误";
      setStatus(`发布失败：${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function createKnowledgeSource() {
    const title = knowledgeDraft.title.trim();
    const topic = knowledgeDraft.topic.trim() || "未分类";
    const content = knowledgeDraft.content.trim();
    if (!title || !content || saving) return;
    setSaving(true);
    setStatus("");
    try {
      const { data: source, error: sourceError } = await supabase
        .from("hai_knowledge_sources")
        .insert({
          title,
          topic,
          source_type: "admin_entry",
          visibility: "shared",
          is_active: true,
          content,
          metadata: { status: "active", source_kind: "admin_entry", migrated_from: "club_admin" },
        })
        .select("id")
        .single();
      if (sourceError) throw sourceError;

      const sourceId = (source as { id: string }).id;
      const chunks = chunkKnowledge(content);
      const { error: chunkError } = await supabase.from("hai_knowledge_chunks").insert(
        chunks.map((chunk, index) => ({
          source_id: sourceId,
          chunk_index: index,
          topic,
          content: chunk,
          token_count: estimateTokenCount(chunk),
          metadata: { title, topic, chunk_level: "admin_entry" },
        })),
      );
      if (chunkError) throw chunkError;
      setKnowledgeDraft({ title: "", topic: "教学设计理论", content: "" });
      await loadAll();
      setStatus(`知识条目已入库，生成 ${chunks.length} 个片段。`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "未知错误";
      setStatus(`入库失败：${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function startEditKnowledgeSource(source: HaiKnowledgeSource) {
    if (saving || loadingKnowledgeId) return;
    setLoadingKnowledgeId(source.id);
    setStatus("");
    try {
      const { data, error } = await supabase
        .from("hai_knowledge_sources")
        .select("id, title, topic, content")
        .eq("id", source.id)
        .single();
      if (error) throw error;
      const row = data as { id: string; title: string; topic: string | null; content: string };
      setKnowledgeEdit({
        id: row.id,
        title: row.title,
        topic: row.topic || "未分类",
        content: row.content,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "未知错误";
      setStatus(`加载原文失败：${msg}`);
    } finally {
      setLoadingKnowledgeId("");
    }
  }

  async function saveKnowledgeEdit() {
    if (!knowledgeEdit || saving) return;
    const title = knowledgeEdit.title.trim();
    const topic = knowledgeEdit.topic.trim() || "未分类";
    const content = knowledgeEdit.content.trim();
    if (!title || !content) return;
    setSaving(true);
    setStatus("");
    try {
      const chunks = chunkKnowledge(content);
      const { error: sourceError } = await supabase
        .from("hai_knowledge_sources")
        .update({
          title,
          topic,
          content,
          updated_at: new Date().toISOString(),
        })
        .eq("id", knowledgeEdit.id);
      if (sourceError) throw sourceError;

      const { error: deleteError } = await supabase
        .from("hai_knowledge_chunks")
        .delete()
        .eq("source_id", knowledgeEdit.id);
      if (deleteError) throw deleteError;

      if (chunks.length > 0) {
        const { error: insertError } = await supabase.from("hai_knowledge_chunks").insert(
          chunks.map((chunk, index) => ({
            source_id: knowledgeEdit.id,
            chunk_index: index,
            topic,
            content: chunk,
            token_count: estimateTokenCount(chunk),
            metadata: { title, topic, chunk_level: "admin_edit" },
          })),
        );
        if (insertError) throw insertError;
      }

      setKnowledgeEdit(null);
      await loadAll();
      setStatus(`知识条目已更新，重新生成 ${chunks.length} 个片段。`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "未知错误";
      setStatus(`修改失败：${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleKnowledgeSource(source: HaiKnowledgeSource) {
    const { error } = await supabase
      .from("hai_knowledge_sources")
      .update({ is_active: !source.is_active, updated_at: new Date().toISOString() })
      .eq("id", source.id);
    if (error) {
      setStatus(error.message);
      return;
    }
    await loadAll();
  }

  async function deleteKnowledgeSource(source: HaiKnowledgeSource) {
    if (saving) return;
    setSaving(true);
    setStatus("");
    try {
      const { error } = await supabase
        .from("hai_knowledge_sources")
        .delete()
        .eq("id", source.id);
      if (error) throw error;
      await loadAll();
      setStatus("知识条目已删除。");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "未知错误";
      setStatus(`删除失败：${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function rebuildKnowledgeChunks(source: HaiKnowledgeSource) {
    if (saving) return;
    setSaving(true);
    setStatus("");
    try {
      const { data, error } = await supabase
        .from("hai_knowledge_sources")
        .select("id, title, topic, content")
        .eq("id", source.id)
        .single();
      if (error) throw error;
      const row = data as { id: string; title: string; topic: string | null; content: string };
      const chunks = chunkKnowledge(row.content);
      const { error: deleteError } = await supabase
        .from("hai_knowledge_chunks")
        .delete()
        .eq("source_id", row.id);
      if (deleteError) throw deleteError;
      if (chunks.length > 0) {
        const { error: insertError } = await supabase.from("hai_knowledge_chunks").insert(
          chunks.map((chunk, index) => ({
            source_id: row.id,
            chunk_index: index,
            topic: row.topic || "未分类",
            content: chunk,
            token_count: estimateTokenCount(chunk),
            metadata: { title: row.title, topic: row.topic || "未分类", chunk_level: "admin_rebuild" },
          })),
        );
        if (insertError) throw insertError;
      }
      await loadAll();
      setStatus(`知识条目已重新分块，生成 ${chunks.length} 个片段。`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "未知错误";
      setStatus(`重新分块失败：${msg}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-ds-lg border border-bd bg-white text-txs">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        正在加载 HAI 配置
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-ds-lg border border-red-200 bg-red-50 p-6">
        <h2 className="mb-2 text-ds-lg font-ds-bold text-red-800">HAI 配置加载失败</h2>
        <p className="mb-4 text-ds-sm leading-relaxed text-red-700">
          请确认已在 Supabase 数据库中执行 HAI 迁移 SQL（<code className="rounded bg-red-100 px-1.5 py-0.5 text-xs">supabase/migrations/20260703090000_hai_workspace.sql</code>）。
        </p>
        <pre className="max-h-40 overflow-auto rounded-ds-md border border-red-200 bg-white p-3 text-xs leading-relaxed text-red-900">
          {loadError}
        </pre>
        <Button variant="outline" className="mt-4" onClick={() => void loadAll()}>
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {status && (
        <div className={`rounded-ds-md border px-4 py-3 text-ds-sm ${
          status.startsWith("创建失败") || status.startsWith("新增失败") || status.startsWith("授权失败") || status.startsWith("发布失败") || status.startsWith("入库失败")
            || status.startsWith("删除失败") || status.startsWith("重新分块失败") || status.startsWith("加载原文失败") || status.startsWith("修改失败")
            || status.startsWith("编排配置保存失败") || status.startsWith("删除上下文失败")
            || status.startsWith("方法卡保存失败") || status.startsWith("方法卡删除失败") || status.startsWith("方法卡恢复失败")
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-bd bg-white text-tx"
        }`}>
          {status}
        </div>
      )}

      <section className="rounded-ds-lg border border-bd bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <GitBranch className="h-5 w-5 shrink-0 text-ac" />
            <div className="min-w-0">
              <h2 className="text-ds-lg font-ds-bold text-tx">上下文编排</h2>
              <p className="mt-1 text-ds-xs text-txs">单聊链路：场景与用户目的识别、按需记忆、问题重构、诊断框架、检索规划、回答质检与 trace。</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={orchestratorEnabled ? "border-ac/30 text-ac" : "border-red-200 text-red-600"}>
              {orchestratorEnabled ? "编排开启" : "旧链路回退"}
            </Badge>
            <Badge variant="outline" className={evaluatorEnabled ? "border-ac/30 text-ac" : "text-txs"}>
              {evaluatorEnabled ? `质检 ${passScore} 分` : "质检关闭"}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={<Route className="h-4 w-4" />} label="核心链路" value={orchestratorEnabled ? "Context Orchestrator" : "Legacy Prompt"} />
          <MetricCard icon={<Layers3 className="h-4 w-4" />} label="可编辑层" value={`${enabledPromptConfigCount}/${orchestratorPromptConfigs.length || 0}`} />
          <MetricCard icon={<BookOpen className="h-4 w-4" />} label="课程方法卡" value={`${methodCardItems.filter((card) => card.enabled).length}/${methodCardItems.length || 0}`} />
          <MetricCard icon={<Settings2 className="h-4 w-4" />} label="启用参数" value={`${runtimeSettings.filter((setting) => setting.enabled).length}/${runtimeSettings.length || 0}`} />
          <MetricCard icon={<CheckCircle2 className="h-4 w-4" />} label="当前版本" value={currentPrompt?.version_label ?? "未发布"} />
        </div>

        <div className="mt-4">
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-ac" />
                <h3 className="text-ds-base font-ds-bold text-tx">编排参数</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {[...orchestratorSettings, ...routerSettings, ...evaluatorSettings].map((setting) => (
                  <RuntimeSettingCard
                    key={setting.key}
                    setting={setting}
                    onToggle={(enabled) => updateRuntimeSetting(setting, setting.value, enabled)}
                    onSave={(value) => updateRuntimeSetting(setting, value)}
                  />
                ))}
                {orchestratorSettings.length + routerSettings.length + evaluatorSettings.length === 0 && (
                  <p className="rounded-ds-md bg-bg px-3 py-6 text-center text-ds-sm text-txs md:col-span-2">尚未写入上下文编排运行时配置。</p>
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <Route className="h-4 w-4 text-ac" />
                <h3 className="text-ds-base font-ds-bold text-tx">语义路由策略</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-ds-md border border-bd bg-bg p-3">
                  <p className="text-ds-sm font-ds-bold text-tx">LLM 主路由</p>
                  <p className="mt-2 text-ds-xs leading-relaxed text-txs">每轮先由 LLM 识别公开课、说课、赛课或日常提分场景，再判断用户要诊断已有方案、获得设计思路，还是进行教学概念答疑。局部示范只提供结构样例和局部改法，不生成完整教案或完整说课稿。</p>
                </div>
                <div className="rounded-ds-md border border-bd bg-bg p-3">
                  <p className="text-ds-sm font-ds-bold text-tx">代码降级</p>
                  <p className="mt-2 text-ds-xs leading-relaxed text-txs">只有在 LLM 路由关闭、调用失败或 JSON 不可用时，才回退到本地确定性规则，保证服务不中断。</p>
                </div>
              </div>
            </div>

            {askHanModule && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-ac" />
                  <h3 className="text-ds-base font-ds-bold text-tx">问问哈老师模块上限</h3>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <NumberInput label="历史条数" value={askHanModule.history_message_limit ?? 20} onChange={(value) => updateModule(askHanModule, { history_message_limit: value })} />
                  <NumberInput label="记忆候选" value={askHanModule.memory_limit ?? 20} onChange={(value) => updateModule(askHanModule, { memory_limit: value })} />
                  <NumberInput label="素材召回" value={askHanModule.material_match_count ?? 8} onChange={(value) => updateModule(askHanModule, { material_match_count: value })} />
                  <NumberInput label="知识召回" value={askHanModule.knowledge_match_count ?? 6} onChange={(value) => updateModule(askHanModule, { knowledge_match_count: value })} />
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers3 className="h-4 w-4 text-ac" />
                  <div>
                    <h3 className="text-ds-base font-ds-bold text-tx">分层上下文</h3>
                    <p className="mt-1 text-[11px] text-txs">基础层保持精简；新增普通上下文会注入回答，新增诊断模块会自动进入语义路由候选。</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowPromptConfigCreator((current) => !current)}>
                  {showPromptConfigCreator ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  {showPromptConfigCreator ? "取消新增" : "新增可编辑层"}
                </Button>
              </div>
              {showPromptConfigCreator && (
                <div className="mb-3 rounded-ds-md border border-ac/20 bg-ac/5 p-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-ds-xs text-txs">
                      层类型
                      <select
                        value={promptConfigCreateDraft.kind}
                        onChange={(event) => setPromptConfigCreateDraft((current) => ({
                          ...current,
                          kind: event.target.value as PromptConfigKind,
                        }))}
                        className="mt-1 h-10 w-full rounded-ds-md border border-bd bg-white px-3 text-ds-sm text-tx"
                      >
                        <option value="custom_context">普通上下文层</option>
                        <option value="diagnostic_module">诊断模块</option>
                      </select>
                    </label>
                    <label className="text-ds-xs text-txs">
                      显示名称
                      <input
                        value={promptConfigCreateDraft.label}
                        onChange={(event) => setPromptConfigCreateDraft((current) => ({ ...current, label: event.target.value }))}
                        placeholder={promptConfigCreateDraft.kind === "diagnostic_module" ? "例如：诊断模块：课堂管理" : "例如：回答案例边界"}
                        className="mt-1 h-10 w-full rounded-ds-md border border-bd bg-white px-3 text-ds-sm text-tx"
                      />
                    </label>
                    <label className="text-ds-xs text-txs">
                      英文标识
                      <input
                        value={promptConfigCreateDraft.slug}
                        onChange={(event) => setPromptConfigCreateDraft((current) => ({ ...current, slug: event.target.value }))}
                        placeholder="例如 classroom_management"
                        className="mt-1 h-10 w-full rounded-ds-md border border-bd bg-white px-3 text-ds-sm text-tx"
                      />
                      <span className="mt-1 block">数据库键：{promptConfigCreateDraft.kind}.{normalizePromptConfigSlug(promptConfigCreateDraft.slug) || "your_key"}</span>
                    </label>
                    <label className="text-ds-xs text-txs">
                      用途说明
                      <input
                        value={promptConfigCreateDraft.description}
                        onChange={(event) => setPromptConfigCreateDraft((current) => ({ ...current, description: event.target.value }))}
                        placeholder="说明何时使用这一层"
                        className="mt-1 h-10 w-full rounded-ds-md border border-bd bg-white px-3 text-ds-sm text-tx"
                      />
                    </label>
                  </div>
                  <label className="mt-3 block text-ds-xs text-txs">
                    提示词内容
                    <textarea
                      value={promptConfigCreateDraft.content}
                      onChange={(event) => setPromptConfigCreateDraft((current) => ({ ...current, content: event.target.value }))}
                      placeholder={promptConfigCreateDraft.kind === "diagnostic_module" ? "写明适用场景、诊断重点、常见误区和回答要求。" : "写明希望 HAI 每次回答都遵循的补充上下文。"}
                      className="mt-1 min-h-36 w-full rounded-ds-md border border-bd bg-white px-3 py-2 text-ds-sm leading-relaxed text-tx"
                    />
                  </label>
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      className="bg-ac text-white hover:bg-acd"
                      disabled={saving || !promptConfigCreateDraft.label.trim() || !normalizePromptConfigSlug(promptConfigCreateDraft.slug) || !promptConfigCreateDraft.content.trim()}
                      onClick={createOrchestratorPromptConfig}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      创建并同步
                    </Button>
                  </div>
                </div>
              )}
              <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.2fr)]">
                <div className="max-h-[520px] overflow-auto rounded-ds-md border border-bd bg-bg p-2">
                  {promptConfigGroups.length === 0 ? (
                    <p className="px-3 py-8 text-center text-ds-sm text-txs">尚未写入编排 Prompt 配置。</p>
                  ) : promptConfigGroups.map(([group, configs]) => (
                    <div key={group} className="mb-3 last:mb-0">
                      <p className="px-2 pb-1 text-[11px] font-ds-bold text-txs">{group}</p>
                      <div className="space-y-1">
                        {configs.map((config) => (
                          <button
                            key={config.key}
                            type="button"
                            onClick={() => setSelectedPromptConfigKey(config.key)}
                            className={`w-full rounded-ds-sm border px-2 py-2 text-left transition ${
                              selectedPromptConfig?.key === config.key ? "border-ac/40 bg-white" : "border-transparent hover:bg-white"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="min-w-0 truncate text-ds-sm font-ds-bold text-tx">{config.label}</span>
                              <Badge variant="outline" className={config.enabled ? "shrink-0 border-ac/30 text-ac" : "shrink-0 border-bd text-txs"}>
                                {config.enabled ? "启用" : "停用"}
                              </Badge>
                            </div>
                            <p className="mt-1 truncate text-[11px] text-txs">{config.key}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-ds-md border border-bd bg-bg p-3">
                  {selectedPromptConfig ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-ds-sm font-ds-bold text-tx">{selectedPromptConfig.label}</p>
                            {selectedPromptConfig.key === "semantic_router_prompt" && selectedPromptConfig.enabled && (
                              <Badge variant="outline" className="border-ac/30 text-ac">运行时路由策略</Badge>
                            )}
                            {promptConfigDirty && <Badge variant="outline" className="border-amber-200 text-amber-700">未保存</Badge>}
                            {promptConfigMatchesDefault && <Badge variant="outline" className="border-bd text-txs">默认内容</Badge>}
                          </div>
                          <p className="mt-1 text-[11px] text-txs">{selectedPromptConfig.description}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <label className="flex items-center gap-1 text-ds-xs text-txs">
                            <input
                              type="checkbox"
                              checked={selectedPromptConfig.enabled}
                              disabled={BASE_PROMPT_CONFIG_KEYS.has(selectedPromptConfig.key)}
                              onChange={(event) => updateOrchestratorPromptConfig(selectedPromptConfig, { enabled: event.target.checked })}
                            />
                            {BASE_PROMPT_CONFIG_KEYS.has(selectedPromptConfig.key) ? "基础层" : "启用"}
                          </label>
                          <Button size="sm" variant="outline" disabled={saving} onClick={resetSelectedPromptConfig}>
                            <RefreshCw className="h-3.5 w-3.5" />
                            默认
                          </Button>
                          <Button size="sm" className="bg-ac text-white hover:bg-acd" disabled={saving || !promptConfigDraft.trim() || !promptConfigDirty} onClick={saveSelectedPromptConfig}>
                            <Save className="h-3.5 w-3.5" />
                            保存
                          </Button>
                          {!BASE_PROMPT_CONFIG_KEYS.has(selectedPromptConfig.key) && (
                            <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" disabled={saving} onClick={() => deleteOrchestratorPromptConfig(selectedPromptConfig)}>
                              <Trash2 className="h-3.5 w-3.5" />
                              删除
                            </Button>
                          )}
                        </div>
                      </div>
                      <textarea
                        value={promptConfigDraft}
                        onChange={(event) => setPromptConfigDraft(event.target.value)}
                        className="min-h-[360px] w-full rounded-ds-md border border-bd bg-white px-3 py-2 text-ds-sm leading-relaxed"
                        placeholder="编辑该层 Prompt / 诊断框架"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-txs">
                        <span>{selectedPromptConfig.key}</span>
                        <span>{promptConfigDraft.length} 字 · 约 {estimateTokenCount(promptConfigDraft)} tokens · 更新于 {formatDateTime(selectedPromptConfig.updated_at)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="px-3 py-12 text-center text-ds-sm text-txs">选择一个编排层后编辑。</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-ac" />
                  <div>
                    <h3 className="text-ds-base font-ds-bold text-tx">课程方法卡</h3>
                    <p className="mt-1 text-[11px] text-txs">
                      默认方法卡可由数据库覆盖；新增、修改、启停和删除会同步影响语义路由与最终回答。
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-ac/30 text-ac">
                    {methodCardItems.filter((card) => card.enabled).length}/{methodCardItems.length} 启用
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={creatingMethodCard ? cancelCreateMethodCard : startCreateMethodCard}
                  >
                    {creatingMethodCard ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {creatingMethodCard ? "取消新增" : "新增方法卡"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(240px,0.72fr)_minmax(0,1.28fr)]">
                <div className="rounded-ds-md border border-bd bg-bg p-2">
                  <input
                    value={methodCardSearch}
                    onChange={(event) => setMethodCardSearch(event.target.value)}
                    placeholder="搜索名称、课程、标识或关键词"
                    className="mb-2 h-9 w-full rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
                  />
                  <div className="max-h-[680px] space-y-1 overflow-auto">
                    {filteredMethodCardItems.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => {
                          setCreatingMethodCard(false);
                          setSelectedMethodCardId(card.id);
                        }}
                        className={`w-full rounded-ds-sm border px-2 py-2 text-left transition ${
                          selectedMethodCardId === card.id && !creatingMethodCard
                            ? "border-ac/40 bg-white"
                            : "border-transparent hover:bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-ds-sm font-ds-bold text-tx">
                            {card.name}
                          </span>
                          <Badge
                            variant="outline"
                            className={card.enabled
                              ? "shrink-0 border-ac/30 text-ac"
                              : "shrink-0 border-bd text-txs"}
                          >
                            {card.enabled ? "启用" : "停用"}
                          </Badge>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-txs">
                          {card.course} · {card.id}
                        </p>
                        <p className="mt-1 text-[11px] text-txs">
                          {card.hasDatabaseOverride ? "数据库版本" : "代码默认"}
                        </p>
                      </button>
                    ))}
                    {filteredMethodCardItems.length === 0 && (
                      <p className="px-3 py-10 text-center text-ds-sm text-txs">
                        没有匹配的方法卡。
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-ds-md border border-bd bg-bg p-3">
                  {methodCardDraft ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-ds-sm font-ds-bold text-tx">
                              {creatingMethodCard ? "新增课程方法卡" : methodCardDraft.name}
                            </p>
                            {!creatingMethodCard && (
                              <Badge variant="outline" className="border-bd text-txs">
                                {methodCardDraft.hasDatabaseOverride ? "数据库覆盖" : "代码默认"}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-txs">
                            方法卡名称、适用边界、判断逻辑、动作与关键词都会参与路由和回答。
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {!creatingMethodCard && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={saving}
                              onClick={() => void toggleMethodCard(methodCardDraft)}
                            >
                              {methodCardDraft.enabled ? "停用" : "启用"}
                            </Button>
                          )}
                          {!creatingMethodCard &&
                            methodCardDraft.isBuiltin &&
                            methodCardDraft.hasDatabaseOverride && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={saving}
                              onClick={() => void resetMethodCardToDefault(methodCardDraft)}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              恢复默认
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="bg-ac text-white hover:bg-acd"
                            disabled={saving}
                            onClick={() => void saveMethodCard()}
                          >
                            <Save className="h-3.5 w-3.5" />
                            保存
                          </Button>
                          {!creatingMethodCard && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-200 text-red-600 hover:bg-red-50"
                              disabled={saving}
                              onClick={() => void deleteMethodCard(methodCardDraft)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              删除
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <MethodCardTextField
                          label="英文标识"
                          value={methodCardDraft.id}
                          disabled={!creatingMethodCard}
                          onChange={(value) => setMethodCardDraft((current) =>
                            current ? { ...current, id: normalizePromptConfigSlug(value) } : current
                          )}
                        />
                        <MethodCardTextField
                          label="方法名称"
                          value={methodCardDraft.name}
                          onChange={(value) => setMethodCardDraft((current) =>
                            current ? { ...current, name: value } : current
                          )}
                        />
                        <MethodCardTextField
                          label="所属课程"
                          value={methodCardDraft.course}
                          onChange={(value) => setMethodCardDraft((current) =>
                            current ? { ...current, course: value } : current
                          )}
                        />
                        <label className="text-ds-xs text-txs">
                          类型
                          <select
                            value={methodCardDraft.kind}
                            onChange={(event) => setMethodCardDraft((current) =>
                              current
                                ? { ...current, kind: event.target.value as HanMethodCard["kind"] }
                                : current
                            )}
                            className="mt-1 h-10 w-full rounded-ds-md border border-bd bg-white px-3 text-ds-sm text-tx"
                          >
                            <option value="methodology">总方法论</option>
                            <option value="framework">框架</option>
                            <option value="method">方法</option>
                            <option value="strategy">策略</option>
                            <option value="consultation_standard">咨询校准标准</option>
                          </select>
                        </label>
                        <label className="text-ds-xs text-txs">
                          来源归属
                          <select
                            value={methodCardDraft.ownership}
                            onChange={(event) => setMethodCardDraft((current) =>
                              current
                                ? { ...current, ownership: event.target.value as HanMethodCard["ownership"] }
                                : current
                            )}
                            className="mt-1 h-10 w-full rounded-ds-md border border-bd bg-white px-3 text-ds-sm text-tx"
                          >
                            <option value="han_course">哈老师课程方法</option>
                            <option value="course_adapted_theory">课程吸收改造理论</option>
                            <option value="consultation_calibration">咨询反馈校准</option>
                          </select>
                        </label>
                        <label className="text-ds-xs text-txs">
                          路由优先级
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={methodCardDraft.priority}
                            onChange={(event) => setMethodCardDraft((current) =>
                              current
                                ? {
                                  ...current,
                                  priority: Math.max(0, Math.min(100, Number(event.target.value) || 0)),
                                }
                                : current
                            )}
                            className="mt-1 h-10 w-full rounded-ds-md border border-bd bg-white px-3 text-ds-sm text-tx"
                          />
                        </label>
                      </div>

                      <MethodCardTextarea
                        label="方法摘要"
                        value={methodCardDraft.summary}
                        onChange={(value) => setMethodCardDraft((current) =>
                          current ? { ...current, summary: value } : current
                        )}
                      />
                      <div className="grid gap-3 md:grid-cols-2">
                        <MethodCardListField
                          label="别名"
                          value={methodCardDraft.aliases}
                          placeholder="每行一个别名"
                          onChange={(value) => setMethodCardDraft((current) =>
                            current ? { ...current, aliases: value } : current
                          )}
                        />
                        <MethodCardListField
                          label="路由关键词"
                          value={methodCardDraft.queryTerms}
                          placeholder="每行一个关键词或用户表达"
                          onChange={(value) => setMethodCardDraft((current) =>
                            current ? { ...current, queryTerms: value } : current
                          )}
                        />
                        <MethodCardListField
                          label="适用情境"
                          value={methodCardDraft.useWhen}
                          placeholder="每行一个适用条件"
                          onChange={(value) => setMethodCardDraft((current) =>
                            current ? { ...current, useWhen: value } : current
                          )}
                        />
                        <MethodCardListField
                          label="不适用边界"
                          value={methodCardDraft.avoidWhen}
                          placeholder="每行一个不适用条件"
                          onChange={(value) => setMethodCardDraft((current) =>
                            current ? { ...current, avoidWhen: value } : current
                          )}
                        />
                      </div>
                      <MethodCardTextarea
                        label="核心判断"
                        value={methodCardDraft.coreJudgement}
                        onChange={(value) => setMethodCardDraft((current) =>
                          current ? { ...current, coreJudgement: value } : current
                        )}
                      />
                      <MethodCardListField
                        label="操作动作"
                        value={methodCardDraft.moves}
                        placeholder="每行一个可执行动作"
                        onChange={(value) => setMethodCardDraft((current) =>
                          current ? { ...current, moves: value } : current
                        )}
                      />
                      <MethodCardTextarea
                        label="回答聚焦"
                        value={methodCardDraft.answerFocus}
                        onChange={(value) => setMethodCardDraft((current) =>
                          current ? { ...current, answerFocus: value } : current
                        )}
                      />
                      <div className="grid gap-3 md:grid-cols-3">
                        <MethodCardListField
                          label="适用诊断标签"
                          value={methodCardDraft.intents}
                          placeholder="如 teaching_design"
                          onChange={(value) => setMethodCardDraft((current) =>
                            current
                              ? { ...current, intents: value as HanMethodCard["intents"] }
                              : current
                          )}
                        />
                        <MethodCardListField
                          label="关联方法卡 ID"
                          value={methodCardDraft.related}
                          placeholder="每行一个关联 ID"
                          onChange={(value) => setMethodCardDraft((current) =>
                            current ? { ...current, related: value } : current
                          )}
                        />
                        <MethodCardListField
                          label="资料来源"
                          value={methodCardDraft.sourceRefs}
                          placeholder="每行一个文件或来源"
                          onChange={(value) => setMethodCardDraft((current) =>
                            current ? { ...current, sourceRefs: value } : current
                          )}
                        />
                      </div>
                      <p className="text-[11px] text-txs">
                        {methodCardDraft.updatedAt
                          ? `数据库更新于 ${formatDateTime(methodCardDraft.updatedAt)}`
                          : "当前为代码默认版本，保存后会生成数据库覆盖记录。"}
                      </p>
                    </div>
                  ) : (
                    <p className="px-3 py-16 text-center text-ds-sm text-txs">
                      选择一张方法卡，或新增方法卡。
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      <section className="rounded-ds-lg border border-bd bg-white p-4">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-ac" />
          <h2 className="text-ds-lg font-ds-bold text-tx">内测用户</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <input
            type="text"
            placeholder="搜索学员（昵称或手机号）"
            value={studentSearch}
            onChange={(event) => {
              setStudentSearch(event.target.value);
              setSelectedUserId("");
            }}
            className="h-10 rounded-ds-md border border-bd bg-bg px-3 text-ds-sm placeholder:text-txs"
          />
          <select
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            className="h-10 rounded-ds-md border border-bd bg-bg px-3 text-ds-sm"
          >
            <option value="">选择学员</option>
            {filteredStudents.map((student) => (
              <option key={student.id} value={student.id}>
                {student.nickname} · {student.phone} · {student.access_level}
              </option>
            ))}
          </select>
          <Button className="bg-ac text-white hover:bg-acd" disabled={!selectedUserId || saving} onClick={grantAccess}>
            <Save className="h-4 w-4" />
            授权
          </Button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-ds-sm">
            <thead className="text-txs">
              <tr className="border-b border-bd">
                <th className="py-2">用户</th>
                <th>会员</th>
                <th>状态</th>
                <th>额度</th>
                <th>来源</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {accessRows.map((row) => {
                const profile = profileOf(row.profiles);
                return (
                  <tr key={row.user_id} className="border-b border-bdl">
                    <td className="py-2">{profile?.nickname ?? row.user_id}<br /><span className="text-txs">{profile?.phone}</span></td>
                    <td>{profile?.access_level}</td>
                    <td><Badge variant="outline">{row.status}</Badge></td>
                    <td>{row.quota_policy_key}</td>
                    <td>{row.access_source}</td>
                    <td className="space-x-2">
                      <Button size="sm" variant="outline" onClick={() => updateAccess(row, { status: row.status === "active" ? "paused" : "active" })}>
                        {row.status === "active" ? "暂停" : "启用"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => updateAccess(row, { status: "revoked" })}>
                        撤销
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-ds-lg border border-bd bg-white p-4">
          <div className="mb-4 flex items-center gap-2">
            <Ticket className="h-5 w-5 text-ac" />
            <h2 className="text-ds-lg font-ds-bold text-tx">邀请码</h2>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_120px_auto]">
            <input className="h-10 rounded-ds-md border border-bd bg-bg px-3 text-ds-sm" placeholder="邀请码" value={inviteDraft.code} onChange={(event) => setInviteDraft((current) => ({ ...current, code: event.target.value }))} />
            <input className="h-10 rounded-ds-md border border-bd bg-bg px-3 text-ds-sm" placeholder="标签" value={inviteDraft.label} onChange={(event) => setInviteDraft((current) => ({ ...current, label: event.target.value }))} />
            <input className="h-10 rounded-ds-md border border-bd bg-bg px-3 text-ds-sm" type="number" min={1} value={inviteDraft.maxUses} onChange={(event) => setInviteDraft((current) => ({ ...current, maxUses: Number(event.target.value) || 1 }))} />
            <Button className="bg-ac text-white hover:bg-acd" disabled={!inviteDraft.code.trim() || saving} onClick={createInvite}>
              创建
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {invites.slice(0, 8).map((invite) => (
              <div key={invite.id} className="flex items-center justify-between rounded-ds-md border border-bd bg-bg px-3 py-2 text-ds-sm">
                <span className="font-ds-semibold text-tx">{invite.code}</span>
                <span className="text-txs">{invite.used_count}/{invite.max_uses} · {invite.quota_policy_key}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-ds-lg border border-bd bg-white p-4">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-ac" />
            <h2 className="text-ds-lg font-ds-bold text-tx">额度策略</h2>
          </div>
          <div className="space-y-3">
            {quotas.map((quota) => (
              <div key={quota.key} className="rounded-ds-md border border-bd bg-bg p-3">
                <div className="mb-2 flex items-center justify-between">
                  <strong>{quota.label}</strong>
                  <Badge variant="outline">{quota.key}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-ds-sm">
                  <NumberInput label="日额度" value={quota.daily_token_limit} onChange={(value) => updateQuota(quota, { daily_token_limit: value })} />
                  <NumberInput label="周额度" value={quota.weekly_token_limit} onChange={(value) => updateQuota(quota, { weekly_token_limit: value })} />
                  <NumberInput label="单轮" value={quota.single_request_token_limit} onChange={(value) => updateQuota(quota, { single_request_token_limit: value })} />
                  <NumberInput label="输出" value={quota.max_output_tokens} onChange={(value) => updateQuota(quota, { max_output_tokens: value })} />
                  <NumberInput label="用户并发" value={quota.user_concurrency_limit} onChange={(value) => updateQuota(quota, { user_concurrency_limit: value })} />
                  <NumberInput label="全局并发" value={quota.global_concurrency_limit} onChange={(value) => updateQuota(quota, { global_concurrency_limit: value })} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-ds-lg border border-bd bg-white p-4">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-ac" />
          <h2 className="text-ds-lg font-ds-bold text-tx">知识库</h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-[220px_220px_minmax(0,1fr)_auto]">
          <input
            value={knowledgeDraft.title}
            onChange={(event) => setKnowledgeDraft((current) => ({ ...current, title: event.target.value }))}
            className="h-10 rounded-ds-md border border-bd bg-bg px-3 text-ds-sm"
            placeholder="知识标题"
          />
          <input
            value={knowledgeDraft.topic}
            onChange={(event) => setKnowledgeDraft((current) => ({ ...current, topic: event.target.value }))}
            className="h-10 rounded-ds-md border border-bd bg-bg px-3 text-ds-sm"
            placeholder="主题"
          />
          <textarea
            value={knowledgeDraft.content}
            onChange={(event) => setKnowledgeDraft((current) => ({ ...current, content: event.target.value }))}
            className="min-h-24 rounded-ds-md border border-bd bg-bg px-3 py-2 text-ds-sm leading-relaxed"
            placeholder="粘贴旧 HAI 知识条目内容"
          />
          <Button className="h-10 bg-ac text-white hover:bg-acd" disabled={!knowledgeDraft.title.trim() || !knowledgeDraft.content.trim() || saving} onClick={createKnowledgeSource}>
            入库
          </Button>
        </div>
        {knowledgeEdit && (
          <div className="mt-4 rounded-ds-md border border-ac/30 bg-ac/5 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Pencil className="h-4 w-4 shrink-0 text-ac" />
                <h3 className="truncate text-ds-base font-ds-bold text-tx">编辑知识条目</h3>
              </div>
              <Button size="sm" variant="ghost" disabled={saving} onClick={() => setKnowledgeEdit(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-3 lg:grid-cols-[220px_220px_minmax(0,1fr)_auto]">
              <input
                value={knowledgeEdit.title}
                onChange={(event) => setKnowledgeEdit((current) => current ? { ...current, title: event.target.value } : current)}
                className="h-10 rounded-ds-md border border-bd bg-white px-3 text-ds-sm"
                placeholder="知识标题"
                disabled={saving}
              />
              <input
                value={knowledgeEdit.topic}
                onChange={(event) => setKnowledgeEdit((current) => current ? { ...current, topic: event.target.value } : current)}
                className="h-10 rounded-ds-md border border-bd bg-white px-3 text-ds-sm"
                placeholder="主题"
                disabled={saving}
              />
              <textarea
                value={knowledgeEdit.content}
                onChange={(event) => setKnowledgeEdit((current) => current ? { ...current, content: event.target.value } : current)}
                className="min-h-44 rounded-ds-md border border-bd bg-white px-3 py-2 text-ds-sm leading-relaxed"
                placeholder="知识原文"
                disabled={saving}
              />
              <div className="flex flex-col gap-2">
                <Button className="h-10 bg-ac text-white hover:bg-acd" disabled={!knowledgeEdit.title.trim() || !knowledgeEdit.content.trim() || saving} onClick={saveKnowledgeEdit}>
                  <Save className="h-4 w-4" />
                  保存
                </Button>
                <Button className="h-10" variant="outline" disabled={saving} onClick={() => setKnowledgeEdit(null)}>
                  取消
                </Button>
              </div>
            </div>
          </div>
        )}
        <div className="mt-4 grid gap-2 lg:grid-cols-3">
          {knowledgeSources.length === 0 ? (
            <p className="rounded-ds-md bg-bg px-3 py-6 text-center text-ds-sm text-txs lg:col-span-3">暂无知识条目</p>
          ) : knowledgeSources.map((source) => (
            <div
              key={source.id}
              className={`cursor-pointer rounded-ds-md border p-3 transition hover:border-ac/50 hover:bg-white ${
                knowledgeEdit?.id === source.id ? "border-ac bg-ac/5" : "border-bd bg-bg"
              }`}
              onClick={() => void startEditKnowledgeSource(source)}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <strong className="truncate text-ds-sm text-tx">{source.title}</strong>
                <Badge variant="outline" className={source.is_active ? "text-ac" : "text-txs"}>
                  {source.is_active ? "启用" : "停用"}
                </Badge>
              </div>
              <p className="text-ds-xs text-txs">
                {source.topic || "未分类"} · {formatDateTime(source.updated_at)} · {source.chunk_count ?? 0} chunks
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button size="sm" variant="outline" onClick={(event) => {
                  event.stopPropagation();
                  void toggleKnowledgeSource(source);
                }}>
                  {source.is_active ? "停用" : "启用"}
                </Button>
                <Button size="sm" variant="outline" disabled={saving || loadingKnowledgeId === source.id} onClick={(event) => {
                  event.stopPropagation();
                  void startEditKnowledgeSource(source);
                }}>
                  {loadingKnowledgeId === source.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="outline" disabled={saving} onClick={(event) => {
                  event.stopPropagation();
                  void rebuildKnowledgeChunks(source);
                }}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Button size="sm" variant="ghost" className="mt-2 w-full text-red-600 hover:text-red-700" disabled={saving} onClick={(event) => {
                event.stopPropagation();
                void deleteKnowledgeSource(source);
              }}>
                  <Trash2 className="h-3.5 w-3.5" />
                删除
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-ds-lg border border-bd bg-white p-4">
        <div className="mb-4 flex items-center gap-2">
          <Bot className="h-5 w-5 text-ac" />
          <h2 className="text-ds-lg font-ds-bold text-tx">功能模块与生成参数</h2>
        </div>
        <div className="grid gap-3 xl:grid-cols-3">
          {modules.map((module) => (
            <div key={module.id} className="rounded-ds-md border border-bd bg-bg p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <strong className="text-tx">{module.name}</strong>
                <Button size="sm" variant="outline" onClick={() => updateModule(module, { is_enabled: !module.is_enabled })}>
                  {module.is_enabled ? "启用" : "停用"}
                </Button>
              </div>
              <p className="mb-3 min-h-10 text-ds-xs text-txs">{module.description}</p>
              <div className="grid grid-cols-2 gap-2 text-ds-sm">
                <TextInput label="模型" value={module.default_model} onChange={(value) => updateModule(module, { default_model: value })} />
                <NumberInput label="温度" value={Number(module.default_temperature)} step={0.05} onChange={(value) => updateModule(module, { default_temperature: value })} />
                <OptionalNumberInput label="Top P" value={module.default_top_p} step={0.05} min={0.01} max={1} onChange={(value) => updateModule(module, { default_top_p: value })} />
                <NumberInput label="输出" value={module.default_max_output_tokens} onChange={(value) => updateModule(module, { default_max_output_tokens: value })} />
                <SelectInput label="思考模式" value={module.thinking_enabled ? "enabled" : "disabled"} options={[["disabled", "关闭"], ["enabled", "开启"]]} onChange={(value) => updateModule(module, { thinking_enabled: value === "enabled" })} />
                <SelectInput label="推理强度" value={module.reasoning_effort ?? "high"} options={[["high", "High"], ["max", "Max"]]} onChange={(value) => updateModule(module, { reasoning_effort: value as HaiFeatureModule["reasoning_effort"] })} />
                <SelectInput label="输出格式" value={module.response_format ?? "text"} options={[["text", "Text"], ["json_object", "JSON"]]} onChange={(value) => updateModule(module, { response_format: value as HaiFeatureModule["response_format"] })} />
                <StopSequencesInput value={module.stop_sequences ?? []} onChange={(value) => updateModule(module, { stop_sequences: value })} />
                <NumberInput label="历史条数" value={module.history_message_limit ?? 20} onChange={(value) => updateModule(module, { history_message_limit: value })} />
                <NumberInput label="记忆条数" value={module.memory_limit ?? 20} onChange={(value) => updateModule(module, { memory_limit: value })} />
                <NumberInput label="素材召回" value={module.material_match_count ?? 8} onChange={(value) => updateModule(module, { material_match_count: value })} />
                <NumberInput label="知识召回" value={module.knowledge_match_count ?? 6} onChange={(value) => updateModule(module, { knowledge_match_count: value })} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-ds-lg border border-bd bg-white p-4">
        <div className="mb-4 flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-ac" />
          <h2 className="text-ds-lg font-ds-bold text-tx">运行时设置</h2>
        </div>
        <div className="grid gap-3 xl:grid-cols-3">
          {runtimeSettings.map((setting) => (
            <div key={setting.key} className="rounded-ds-md border border-bd bg-bg p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-ds-sm font-ds-bold text-tx">{setting.label}</p>
                  <p className="mt-1 text-[11px] text-txs">{setting.key}</p>
                </div>
                <label className="flex items-center gap-1 text-ds-xs text-txs">
                  <input
                    type="checkbox"
                    checked={setting.enabled}
                    onChange={(event) => void updateRuntimeSetting(setting, setting.value, event.target.checked)}
                  />
                  启用
                </label>
              </div>
              <p className="mb-3 min-h-8 text-ds-xs leading-relaxed text-txs">{setting.description}</p>
              <RuntimeSettingInput setting={setting} onSave={(value) => updateRuntimeSetting(setting, value)} />
            </div>
          ))}
          {runtimeSettings.length === 0 && (
            <p className="rounded-ds-md bg-bg px-3 py-8 text-center text-ds-sm text-txs xl:col-span-3">暂无运行时设置</p>
          )}
        </div>
      </section>

      <section className="rounded-ds-lg border border-bd bg-white p-4">
        <div className="mb-4 flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-ac" />
          <h2 className="text-ds-lg font-ds-bold text-tx">Prompt 发布</h2>
        </div>
        <div className="mb-3 grid gap-2 md:grid-cols-[240px_1fr]">
          <select
            value={selectedModuleId}
            onChange={(event) => setSelectedModuleId(event.target.value)}
            className="h-10 rounded-ds-md border border-bd bg-bg px-3 text-ds-sm"
          >
            {modules.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}
          </select>
          <input
            value={promptDraft.versionLabel}
            onChange={(event) => setPromptDraft((current) => ({ ...current, versionLabel: event.target.value }))}
            className="h-10 rounded-ds-md border border-bd bg-bg px-3 text-ds-sm"
            placeholder="版本名"
          />
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <textarea
            value={promptDraft.systemPrompt}
            onChange={(event) => setPromptDraft((current) => ({ ...current, systemPrompt: event.target.value }))}
            className="min-h-[240px] rounded-ds-md border border-bd bg-bg px-3 py-2 text-ds-sm leading-relaxed"
            placeholder="System Prompt"
          />
          <textarea
            value={promptDraft.developerPrompt}
            onChange={(event) => setPromptDraft((current) => ({ ...current, developerPrompt: event.target.value }))}
            className="min-h-[240px] rounded-ds-md border border-bd bg-bg px-3 py-2 text-ds-sm leading-relaxed"
            placeholder="补充指令"
          />
          <textarea
            value={promptDraft.responseContract}
            onChange={(event) => setPromptDraft((current) => ({ ...current, responseContract: event.target.value }))}
            className="min-h-[240px] rounded-ds-md border border-bd bg-bg px-3 py-2 text-ds-sm leading-relaxed"
            placeholder="输出契约 / 格式要求"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-ds-xs text-txs">
            当前发布版本：{currentPrompt?.version_label ?? "无"}
          </p>
          <Button className="bg-ac text-white hover:bg-acd" disabled={!promptDraft.systemPrompt.trim() || saving} onClick={publishPrompt}>
            <Save className="h-4 w-4" />
            发布新版本
          </Button>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-ds-md border border-bd bg-bg px-3 py-3">
      <div className="mb-2 flex items-center gap-2 text-ac">
        {icon}
        <span className="text-ds-xs text-txs">{label}</span>
      </div>
      <p className="truncate text-ds-base font-ds-bold text-tx">{value}</p>
    </div>
  );
}

function RuntimeSettingCard({
  setting,
  onToggle,
  onSave,
}: {
  setting: HaiRuntimeSetting;
  onToggle: (enabled: boolean) => void;
  onSave: (value: string | number | boolean) => void;
}) {
  return (
    <div className="rounded-ds-md border border-bd bg-bg p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-ds-sm font-ds-bold text-tx">{setting.label}</p>
          <p className="mt-1 truncate text-[11px] text-txs">{setting.key}</p>
        </div>
        <label className="flex shrink-0 items-center gap-1 text-ds-xs text-txs">
          <input
            type="checkbox"
            checked={setting.enabled}
            onChange={(event) => onToggle(event.target.checked)}
          />
          启用
        </label>
      </div>
      <p className="mb-3 min-h-10 text-ds-xs leading-relaxed text-txs">{setting.description}</p>
      <RuntimeSettingInput setting={setting} onSave={onSave} />
    </div>
  );
}

function profileOf(value: HaiUserAccessRow["profiles"]) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function chunkKnowledge(content: string) {
  const clean = content.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const size = 1700;
  const overlap = 160;
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(clean.length, start + size);
    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= clean.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

function estimateTokenCount(text: string) {
  if (!text) return 0;
  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) ?? []).length;
  const words = (text.match(/[A-Za-z0-9_]+(?:[-'][A-Za-z0-9_]+)*/g) ?? []).length;
  return Math.max(1, Math.ceil(cjk * 0.9 + words * 1.25 + Math.max(0, text.length - cjk) / 4));
}

function normalizeRuntimeValue(setting: HaiRuntimeSetting, value: string | number | boolean) {
  if (setting.value_type === "boolean") return Boolean(value);
  if (setting.value_type === "integer" || setting.value_type === "number") {
    const fallback = Number(setting.default_value) || 0;
    const raw = typeof value === "number" ? value : Number(value);
    let next = Number.isFinite(raw) ? raw : fallback;
    if (setting.value_type === "integer") next = Math.round(next);
    if (setting.min_value !== null) next = Math.max(setting.min_value, next);
    if (setting.max_value !== null) next = Math.min(setting.max_value, next);
    return next;
  }
  return String(value ?? "");
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1 block text-ds-xs text-txs">{label}</span>
      <input
        value={local}
        onChange={(event) => setLocal(event.target.value)}
        onBlur={() => {
          const next = local.trim();
          if (next && next !== value) onChange(next);
        }}
        className="h-9 w-full rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const [local, setLocal] = useState(String(value));

  useEffect(() => {
    setLocal(String(value));
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1 block text-ds-xs text-txs">{label}</span>
      <input
        value={local}
        type="number"
        step={step}
        onChange={(event) => setLocal(event.target.value)}
        onBlur={() => {
          const next = Number(local);
          if (Number.isFinite(next) && next !== value) onChange(next);
        }}
        className="h-9 w-full rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
      />
    </label>
  );
}

function OptionalNumberInput({
  label,
  value,
  step = 1,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number | null;
  step?: number;
  min?: number;
  max?: number;
  onChange: (value: number | null) => void;
}) {
  const [local, setLocal] = useState(value === null || value === undefined ? "" : String(value));

  useEffect(() => {
    setLocal(value === null || value === undefined ? "" : String(value));
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1 block text-ds-xs text-txs">{label}</span>
      <input
        value={local}
        type="number"
        step={step}
        min={min}
        max={max}
        placeholder="默认"
        onChange={(event) => setLocal(event.target.value)}
        onBlur={() => {
          if (!local.trim()) {
            if (value !== null) onChange(null);
            return;
          }
          let next = Number(local);
          if (!Number.isFinite(next)) return;
          if (min !== undefined) next = Math.max(min, next);
          if (max !== undefined) next = Math.min(max, next);
          if (next !== value) onChange(next);
        }}
        className="h-9 w-full rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-ds-xs text-txs">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>{labelText}</option>
        ))}
      </select>
    </label>
  );
}

function StopSequencesInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [local, setLocal] = useState(value.join("\\n"));

  useEffect(() => {
    setLocal(value.join("\\n"));
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1 block text-ds-xs text-txs">停止序列</span>
      <input
        value={local}
        placeholder="用 \\n 分隔"
        onChange={(event) => setLocal(event.target.value)}
        onBlur={() => {
          const next = local.split("\\n").map((item) => item.trim()).filter(Boolean).slice(0, 16);
          if (next.join("\\n") !== value.join("\\n")) onChange(next);
        }}
        className="h-9 w-full rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
      />
    </label>
  );
}

function RuntimeSettingInput({
  setting,
  onSave,
}: {
  setting: HaiRuntimeSetting;
  onSave: (value: string | number | boolean) => void;
}) {
  const [local, setLocal] = useState(String(setting.value ?? ""));

  useEffect(() => {
    setLocal(String(setting.value ?? ""));
  }, [setting.value]);

  if (setting.value_type === "boolean") {
    return (
      <label className="flex h-9 items-center gap-2 text-ds-sm text-tx">
        <input
          type="checkbox"
          checked={Boolean(setting.value)}
          onChange={(event) => onSave(event.target.checked)}
        />
        {Boolean(setting.value) ? "已开启" : "已关闭"}
      </label>
    );
  }

  if (setting.value_type === "select" && setting.options.length > 0) {
    return (
      <select
        value={String(setting.value ?? "")}
        onChange={(event) => onSave(event.target.value)}
        className="h-9 w-full rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
      >
        {setting.options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label ?? String(option.value)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <label className="block">
      <div className="flex items-center gap-2">
        <input
          value={local}
          type={setting.value_type === "string" ? "text" : "number"}
          min={setting.min_value ?? undefined}
          max={setting.max_value ?? undefined}
          step={setting.step ?? undefined}
          onChange={(event) => setLocal(event.target.value)}
          onBlur={() => {
            const value = setting.value_type === "string" ? local : Number(local);
            onSave(value);
          }}
          className="h-9 min-w-0 flex-1 rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
        />
        {setting.unit && <span className="shrink-0 text-ds-xs text-txs">{setting.unit}</span>}
      </div>
    </label>
  );
}

function MethodCardTextField({
  label,
  value,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-ds-xs text-txs">
      {label}
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-ds-md border border-bd bg-white px-3 text-ds-sm text-tx disabled:bg-bdl disabled:text-txs"
      />
    </label>
  );
}

function MethodCardTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-ds-xs text-txs">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-24 w-full rounded-ds-md border border-bd bg-white px-3 py-2 text-ds-sm leading-relaxed text-tx"
      />
    </label>
  );
}

function MethodCardListField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string[];
  placeholder: string;
  onChange: (value: string[]) => void;
}) {
  return (
    <label className="block text-ds-xs text-txs">
      {label}
      <textarea
        value={value.join("\n")}
        placeholder={placeholder}
        onChange={(event) => onChange(splitMethodCardLines(event.target.value))}
        className="mt-1 min-h-28 w-full rounded-ds-md border border-bd bg-white px-3 py-2 text-ds-sm leading-relaxed text-tx"
      />
    </label>
  );
}

function buildMethodCardAdminItems(
  defaultCards: HanMethodCard[],
  rows: HaiMethodCardConfigRow[],
): MethodCardAdminItem[] {
  const defaults = new Map(
    defaultCards.map((card) => [
      card.id,
      toDefaultMethodCardAdminItem(card),
    ]),
  );
  const cards = new Map(defaults);
  for (const row of rows) {
    if (!row.id) continue;
    if (row.is_deleted) {
      cards.delete(row.id);
      continue;
    }
    cards.set(row.id, {
      ...methodCardFromConfigRow(row),
      enabled: row.enabled !== false,
      isBuiltin: defaults.has(row.id),
      hasDatabaseOverride: true,
      updatedAt: row.updated_at ?? null,
    });
  }
  return Array.from(cards.values()).sort((a, b) =>
    b.priority - a.priority || a.name.localeCompare(b.name, "zh-CN")
  );
}

function toDefaultMethodCardAdminItem(
  card: HanMethodCard,
): MethodCardAdminItem {
  return {
    ...cloneHanMethodCard(card),
    enabled: true,
    isBuiltin: true,
    hasDatabaseOverride: false,
    updatedAt: null,
  };
}

function methodCardFromConfigRow(
  row: HaiMethodCardConfigRow,
): HanMethodCard {
  return {
    id: row.id,
    name: row.name,
    aliases: row.aliases ?? [],
    course: row.course,
    kind: row.kind,
    ownership: row.ownership,
    priority: row.priority,
    summary: row.summary,
    useWhen: row.use_when ?? [],
    avoidWhen: row.avoid_when ?? [],
    coreJudgement: row.core_judgement,
    moves: row.moves ?? [],
    answerFocus: row.answer_focus,
    queryTerms: row.query_terms ?? [],
    intents: row.intents ?? [],
    related: row.related ?? [],
    sourceRefs: row.source_refs ?? [],
  };
}

function methodCardToConfigRow(
  card: MethodCardAdminItem,
  updatedAt: string,
  isDeleted = false,
): HaiMethodCardConfigRow {
  return {
    id: card.id,
    name: card.name.trim(),
    aliases: cleanMethodCardLines(card.aliases),
    course: card.course.trim(),
    kind: card.kind,
    ownership: card.ownership,
    priority: Math.max(0, Math.min(100, Math.round(card.priority))),
    summary: card.summary.trim(),
    use_when: cleanMethodCardLines(card.useWhen),
    avoid_when: cleanMethodCardLines(card.avoidWhen),
    core_judgement: card.coreJudgement.trim(),
    moves: cleanMethodCardLines(card.moves),
    answer_focus: card.answerFocus.trim(),
    query_terms: cleanMethodCardLines(card.queryTerms),
    intents: cleanMethodCardLines(card.intents) as HanMethodCard["intents"],
    related: cleanMethodCardLines(card.related),
    source_refs: cleanMethodCardLines(card.sourceRefs),
    enabled: isDeleted ? false : card.enabled,
    is_deleted: isDeleted,
    updated_at: updatedAt,
  };
}

function createEmptyMethodCardDraft(): MethodCardAdminItem {
  return {
    id: "",
    name: "",
    aliases: [],
    course: "教学通识课",
    kind: "method",
    ownership: "han_course",
    priority: 50,
    summary: "",
    useWhen: [],
    avoidWhen: [],
    coreJudgement: "",
    moves: [],
    answerFocus: "",
    queryTerms: [],
    intents: [],
    related: [],
    sourceRefs: [],
    enabled: true,
    isBuiltin: false,
    hasDatabaseOverride: false,
    updatedAt: null,
  };
}

function cloneMethodCardAdminItem(
  card: MethodCardAdminItem,
): MethodCardAdminItem {
  return {
    ...cloneHanMethodCard(card),
    enabled: card.enabled,
    isBuiltin: card.isBuiltin,
    hasDatabaseOverride: card.hasDatabaseOverride,
    updatedAt: card.updatedAt,
  };
}

function cloneHanMethodCard(card: HanMethodCard): HanMethodCard {
  return {
    ...card,
    aliases: [...card.aliases],
    useWhen: [...card.useWhen],
    avoidWhen: [...card.avoidWhen],
    moves: [...card.moves],
    queryTerms: [...card.queryTerms],
    intents: [...card.intents],
    related: [...card.related],
    sourceRefs: [...card.sourceRefs],
  };
}

function splitMethodCardLines(value: string) {
  return value.replace(/\r\n?/g, "\n").split("\n");
}

function cleanMethodCardLines(value: string[]) {
  return value.map((item) => item.trim()).filter((item, index, all) =>
    Boolean(item) && all.indexOf(item) === index
  );
}

function normalizePromptConfigSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sortPromptConfigs(configs: HaiOrchestratorPromptConfig[]) {
  return [...configs].sort((a, b) =>
    a.layer_order - b.layer_order || a.key.localeCompare(b.key)
  );
}
