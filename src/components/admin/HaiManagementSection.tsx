import { BookOpen, Bot, ChevronDown, Coins, Cpu, KeyRound, Loader2, Pencil, Plus, RefreshCw, Save, SlidersHorizontal, Trash2, UserPlus, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import HaiChatSkillManagement from "@/components/admin/HaiChatSkillManagement";
import HaiWorkSkillManagement from "@/components/admin/HaiWorkSkillManagement";
import ModuleParamFields, { NumberInput } from "@/components/admin/hai/ModuleParamFields";
import { filterPointUsers, type PointUserLevelFilter } from "@/components/admin/hai/point-user-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { adminUpdateUserAccessLevel, getAdminStudentList, type StudentItem } from "@/db/admin-api";
import type { HaiFeatureModule, HaiModelProvider } from "@/db/hai-api";
import { deleteHaiModelProvider, getHaiModelProviders, saveHaiModelProvider } from "@/db/hai-api";
import { supabase } from "@/db/supabase";
import type { MembershipType } from "@/types/types";

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

interface HaiPointWalletRow {
  user_id: string;
  balance_tokens: number;
  total_credited_tokens: number;
  total_consumed_tokens: number;
  newcomer_grant_tokens: number;
  newcomer_granted_at: string | null;
  profiles?: HaiUserAccessRow["profiles"];
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

interface HaiPackageConfig {
  points: number;
  price: number;
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

export default function HaiManagementSection() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [accessRows, setAccessRows] = useState<HaiUserAccessRow[]>([]);
  const [pointWallets, setPointWallets] = useState<HaiPointWalletRow[]>([]);
  const [modules, setModules] = useState<HaiFeatureModule[]>([]);
  const [quotas, setQuotas] = useState<HaiQuotaPolicy[]>([]);
  const [knowledgeSources, setKnowledgeSources] = useState<HaiKnowledgeSource[]>([]);
  const [runtimeSettings, setRuntimeSettings] = useState<HaiRuntimeSetting[]>([]);
  const [modelProviders, setModelProviders] = useState<HaiModelProvider[]>([]);
  const [providerDraft, setProviderDraft] = useState({ id: "", label: "", provider_code: "", model_name: "", api_key: "", base_url: "", is_enabled: true, sort_order: 0 });
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [defaultMethodCards, setDefaultMethodCards] = useState<HanMethodCard[]>([]);
  const [methodCardConfigRows, setMethodCardConfigRows] = useState<HaiMethodCardConfigRow[]>([]);
  const [selectedMethodCardId, setSelectedMethodCardId] = useState("");
  const [methodCardDraft, setMethodCardDraft] = useState<MethodCardAdminItem | null>(null);
  const [methodCardSearch, setMethodCardSearch] = useState("");
  const [creatingMethodCard, setCreatingMethodCard] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [pointUserId, setPointUserId] = useState("");
  const [pointLevelDraft, setPointLevelDraft] = useState<MembershipType>("free");
  const [pointDraft, setPointDraft] = useState({ points: 100, reason: "线下购买积分" });
  const [pointUserSearch, setPointUserSearch] = useState("");
  const [pointUserLevelFilter, setPointUserLevelFilter] = useState<PointUserLevelFilter>("all");
  const [tokensPerPointDraft, setTokensPerPointDraft] = useState("100");
  const [studentSearch, setStudentSearch] = useState("");
  const [knowledgeDraft, setKnowledgeDraft] = useState({ title: "", topic: "教学设计理论", content: "" });
  const [knowledgeEdit, setKnowledgeEdit] = useState<{ id: string; title: string; topic: string; content: string } | null>(null);
  const [loadingKnowledgeId, setLoadingKnowledgeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const keyword = studentSearch.trim().toLowerCase();
    return students.filter(
      (s) => s.nickname.toLowerCase().includes(keyword) || s.phone.includes(keyword),
    );
  }, [students, studentSearch]);
  const selectedPointUser = useMemo(
    () => students.find((student) => student.id === pointUserId) ?? null,
    [pointUserId, students],
  );
  const filteredPointUsers = useMemo(
    () => filterPointUsers(students, pointUserSearch, pointUserLevelFilter),
    [pointUserLevelFilter, pointUserSearch, students],
  );
  const selectedPointWallet = useMemo(
    () => pointWallets.find((wallet) => wallet.user_id === pointUserId) ?? null,
    [pointUserId, pointWallets],
  );
  const tokensPerPoint = useMemo(() => Number(
    runtimeSettings.find((setting) => setting.key === "points.tokens_per_point")?.value ?? 100,
  ), [runtimeSettings]);
  const tokensPerPointSetting = useMemo(
    () => runtimeSettings.find((setting) => setting.key === "points.tokens_per_point") ?? null,
    [runtimeSettings],
  );
  const newcomerGrantPoints = useMemo(() => Math.max(
    0,
    Math.round(Number(runtimeSettings.find((setting) => setting.key === "points.newcomer_grant_points")?.value ?? 1000)),
  ), [runtimeSettings]);
  const generalRuntimeSettings = useMemo(() => {
    const dedicatedKeys = new Set([
      "points.tokens_per_point",
      "points.cny_per_point",
      "points.wecom_qr_url",
      ...[1, 2, 3].flatMap((slot) => [
        `points.package_${slot}_points`,
        `points.package_${slot}_price_cny`,
      ]),
    ]);
    return runtimeSettings.filter((setting) => !dedicatedKeys.has(setting.key));
  }, [runtimeSettings]);
  const [packageDrafts, setPackageDrafts] = useState<HaiPackageConfig[]>([
    { points: 10, price: 10 },
    { points: 100, price: 99 },
  ]);
  const [packageStatus, setPackageStatus] = useState("");
  const [localPointPackages, setLocalPointPackages] = useState(() => readLocalPointPackages());
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
  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    setPackageDrafts((current) =>
      current.map((currentPackage, index) =>
        localPointPackages[index]
          ? { ...currentPackage, ...localPointPackages[index] }
          : currentPackage,
      ),
    );
  }, [localPointPackages]);

  useEffect(() => {
    if (selectedPointUser) setPointLevelDraft(selectedPointUser.access_level);
  }, [selectedPointUser]);

  useEffect(() => {
    if (tokensPerPointSetting) setTokensPerPointDraft(String(tokensPerPointSetting.value));
  }, [tokensPerPointSetting]);

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
        pointWalletResult,
        moduleResult,
        quotaResult,
        knowledgeResult,
        knowledgeChunkResult,
        runtimeResult,
        methodCardResult,
        providerRows,
      ] = await Promise.all([
        getAdminStudentList(),
        supabase
          .from("hai_user_access")
          .select("*, profiles!user_id(nickname, phone, access_level)")
          .eq("access_source", "admin")
          .order("granted_at", { ascending: false }),
        supabase
          .from("hai_point_wallets")
          .select("*, profiles!user_id(nickname, phone, access_level)")
          .order("updated_at", { ascending: false }),
        supabase
          .from("hai_feature_modules")
          .select("*")
          .order("sort_order", { ascending: true }),
        supabase
          .from("hai_quota_policies")
          .select("*")
          .order("key", { ascending: true }),
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
        supabase.functions.invoke("hai-method-cards-admin", { body: {} }),
        getHaiModelProviders(),
      ]);

      if (accessResult.error) throw accessResult.error;
      if (pointWalletResult.error) throw pointWalletResult.error;
      if (moduleResult.error) throw moduleResult.error;
      if (quotaResult.error) throw quotaResult.error;
      if (knowledgeResult.error) throw knowledgeResult.error;
      if (knowledgeChunkResult.error) throw knowledgeChunkResult.error;
      if (runtimeResult.error) throw runtimeResult.error;
      if (methodCardResult.error) throw methodCardResult.error;

      setStudents(studentRows);
      setAccessRows((accessResult.data as HaiUserAccessRow[]) ?? []);
      setPointWallets((pointWalletResult.data as HaiPointWalletRow[]) ?? []);
      const moduleRows = (moduleResult.data as HaiFeatureModule[]) ?? [];
      // Chat 与 Work 模块的生成参数统一在此面板管理，不再拆分。
      setModules(moduleRows);
      setQuotas((quotaResult.data as HaiQuotaPolicy[]) ?? []);
      const chunkCounts = new Map<string, number>();
      for (const chunk of (knowledgeChunkResult.data ?? []) as Array<{ source_id: string }>) {
        chunkCounts.set(chunk.source_id, (chunkCounts.get(chunk.source_id) ?? 0) + 1);
      }
      setKnowledgeSources(((knowledgeResult.data as HaiKnowledgeSource[]) ?? []).map((source) => ({
        ...source,
        chunk_count: chunkCounts.get(source.id) ?? 0,
      })));
      setRuntimeSettings((runtimeResult.data as HaiRuntimeSetting[]) ?? []);
      setModelProviders(providerRows);
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

  async function addPoints() {
    if (!pointUserId || pointDraft.points <= 0 || !pointDraft.reason.trim() || saving) return;
    setSaving(true);
    setStatus("");
    try {
      const { data, error } = await supabase.rpc("hai_admin_add_points", {
        p_user_id: pointUserId,
        p_points: Math.round(pointDraft.points),
        p_reason: pointDraft.reason.trim(),
      });
      if (error) throw error;
      await loadAll();
      const result = data as { current_points?: number } | null;
      setStatus(`积分已增加，用户当前持有 ${formatAdminPoints(result?.current_points)} 积分。`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "未知错误";
      setStatus(`增加积分失败：${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function updatePointUserLevel() {
    if (!selectedPointUser || saving) return;
    if (selectedPointUser.access_level === pointLevelDraft) {
      setStatus("会员等级未变化。");
      return;
    }

    setSaving(true);
    setStatus("");
    try {
      const result = await adminUpdateUserAccessLevel(selectedPointUser.id, pointLevelDraft);
      setStudents((current) => current.map((student) => (
        student.id === selectedPointUser.id
          ? { ...student, access_level: result.access_level }
          : student
      )));
      setStatus(`第 1 步已完成：用户等级已调整为 ${membershipLabel(result.access_level)}。`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "未知错误";
      setStatus(`等级调整失败：${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function grantNewcomerPoints() {
    if (!selectedPointUser || saving) return;
    setSaving(true);
    setStatus("");
    try {
      const { data, error } = await supabase.rpc("hai_admin_grant_newcomer_points", {
        p_user_id: selectedPointUser.id,
      });
      if (error) throw error;
      await loadAll();
      const result = data as { granted_points?: number; current_points?: number } | null;
      setStatus(
        `第 2 步已完成：已发放 ${formatAdminPoints(result?.granted_points)} 积分，`
        + `用户当前持有 ${formatAdminPoints(result?.current_points)} 积分。`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : "未知错误";
      setStatus(`首次积分发放失败：${msg}`);
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
      return false;
    }
    setRuntimeSettings((current) => current.map((item) => (
      item.key === setting.key ? { ...item, value: normalized, enabled } : item
    )));
    setStatus("运行时设置已保存。");
    return true;
  }

  async function saveTokensPerPoint() {
    if (!tokensPerPointSetting || saving) return;
    const next = normalizeRuntimeValue(tokensPerPointSetting, tokensPerPointDraft);
    if (typeof next !== "number" || !Number.isFinite(next) || next < 1) {
      setStatus("每积分对应 Token 必须是大于 0 的整数。");
      return;
    }

    setSaving(true);
    setStatus("");
    try {
      const saved = await updateRuntimeSetting(tokensPerPointSetting, next, true);
      if (!saved) return;
      setTokensPerPointDraft(String(next));
      setStatus(`积分换算比例已保存：每 1 积分对应 ${next.toLocaleString("zh-CN")} Token。`);
    } finally {
      setSaving(false);
    }
  }

  function updatePackageDraft(index: number, key: keyof HaiPackageConfig, value: string) {
    const next = Math.max(0, Number(value) || 0);
    setPackageDrafts((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [key]: next } : item
    )));
  }

  function savePackageDrafts() {
    const cleaned = packageDrafts.map((item) => ({
      points: Math.max(1, Math.round(item.points)),
      price: Math.max(0.01, Number(item.price.toFixed(2))),
    }));
    setLocalPointPackages(cleaned);
    setPackageDrafts(cleaned);
    window.localStorage.setItem(LOCAL_POINT_PACKAGES_KEY, JSON.stringify(cleaned));
    setPackageStatus("套餐显示已保存到当前浏览器。");
  }

  async function handleSaveProvider() {
    setSaving(true);
    setStatus("");
    try {
      await saveHaiModelProvider({
        id: editingProviderId || undefined,
        label: providerDraft.label,
        provider_code: providerDraft.provider_code,
        model_name: providerDraft.model_name,
        api_key: providerDraft.api_key,
        base_url: providerDraft.base_url,
        is_enabled: providerDraft.is_enabled,
        sort_order: providerDraft.sort_order,
      });
      setEditingProviderId(null);
      setProviderDraft({ id: "", label: "", provider_code: "", model_name: "", api_key: "", base_url: "", is_enabled: true, sort_order: 0 });
      await loadAll();
      setStatus("模型供应商已保存。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProvider(id: string) {
    if (!confirm("确定删除该模型供应商？")) return;
    try {
      await deleteHaiModelProvider(id);
      await loadAll();
      setStatus("模型供应商已删除。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "删除失败");
    }
  }

  function startEditProvider(provider: HaiModelProvider) {
    setEditingProviderId(provider.id);
    setProviderDraft({
      id: provider.id,
      label: provider.label,
      provider_code: provider.provider_code,
      model_name: provider.model_name,
      api_key: "",
      base_url: provider.base_url,
      is_enabled: provider.is_enabled,
      sort_order: provider.sort_order,
    });
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
          status.startsWith("创建失败") || status.startsWith("新增失败") || status.startsWith("授权失败") || status.startsWith("入库失败")
            || status.startsWith("删除失败") || status.startsWith("重新分块失败") || status.startsWith("加载原文失败") || status.startsWith("修改失败")
            || status.startsWith("方法卡保存失败") || status.startsWith("方法卡删除失败") || status.startsWith("方法卡恢复失败")
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-bd bg-white text-tx"
        }`}>
          {status}
        </div>
      )}

      <CollapsiblePanel
        title="Chat Skill"
        description="管理 HAI 对话 Skill、绑定关系和发布版本。"
        icon={<Bot className="h-5 w-5" />}
        summary="点击展开"
      >
        <HaiChatSkillManagement />
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Work Skill"
        description="管理帮你干活工具的 Skill、参考文档和发布版本。"
        icon={<SlidersHorizontal className="h-5 w-5" />}
        summary="点击展开"
      >
        <HaiWorkSkillManagement />
      </CollapsiblePanel>

      <CollapsiblePanel
        title="课程方法卡"
        description="保留 35 张课程方法卡及新增、编辑、删减和启停能力。"
        icon={<BookOpen className="h-5 w-5" />}
        summary={`${methodCardItems.filter((card) => card.enabled).length}/${methodCardItems.length} 启用`}
      >
        <div>
          <div className="mb-3 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={creatingMethodCard ? cancelCreateMethodCard : startCreateMethodCard}
            >
              {creatingMethodCard ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {creatingMethodCard ? "取消新增" : "新增方法卡"}
            </Button>
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
      </CollapsiblePanel>

      <CollapsiblePanel
        title="内测用户"
        description="管理 HAI 内测资格、状态和用户额度。"
        icon={<UserPlus className="h-5 w-5" />}
        summary={`${accessRows.length} 人`}
      >
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
      </CollapsiblePanel>

      <CollapsiblePanel
        title="积分与套餐设置"
        description="前端套餐显示可直接编辑并保存到当前浏览器；其余内部配置仍保存到数据库。"
        icon={<Coins className="h-5 w-5" />}
        summary={`${localPointPackages.length} 个显示套餐`}
        defaultOpen
      >
        <div className="rounded-ds-md border border-ac/25 bg-acl/30 p-4">
          <div>
            <h3 className="text-ds-base font-ds-bold text-tx">积分与 Token 换算比例</h3>
            <p className="mt-1 text-ds-xs leading-relaxed text-txs">
              仅用于后台计费，用户端不会展示这个换算关系。
            </p>
          </div>
          {tokensPerPointSetting ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-ds-xs font-ds-semibold text-txs">每 1 积分对应的 Token 数量</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={tokensPerPointSetting.min_value ?? 1}
                    max={tokensPerPointSetting.max_value ?? undefined}
                    step={tokensPerPointSetting.step ?? 1}
                    value={tokensPerPointDraft}
                    onChange={(event) => setTokensPerPointDraft(event.target.value)}
                    className="h-10 min-w-0 flex-1 rounded-ds-md border border-bd bg-white px-3 text-ds-sm"
                    aria-label="每 1 积分对应的 Token 数量"
                  />
                  <span className="shrink-0 text-ds-xs text-txs">Token / 积分</span>
                </div>
              </label>
              <Button
                className="bg-ac text-white hover:bg-acd"
                disabled={saving || !tokensPerPointDraft.trim() || Number(tokensPerPointDraft) === tokensPerPoint}
                onClick={saveTokensPerPoint}
              >
                保存换算比例
              </Button>
            </div>
          ) : (
            <p className="mt-3 rounded-ds-md bg-white px-3 py-2 text-ds-sm text-amber-700">
              未找到换算比例配置，请刷新页面后重试。
            </p>
          )}
          <p className="mt-3 text-ds-xs leading-relaxed text-amber-800">
            调整后，现有钱包的剩余 Token 总量不变，用户看到的积分余额会按新比例重新换算；之后的积分入账和用量折算将使用新比例。
          </p>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-ds-base font-ds-bold text-tx">前端套餐显示</h3>
            <p className="mt-1 text-ds-xs text-txs">仅修改购买页文本显示，不写入数据库。当前浏览器保存后立即生效。</p>
          </div>
          <Button size="sm" className="bg-ac text-white hover:bg-acd" onClick={savePackageDrafts}>
            保存显示
          </Button>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {packageDrafts.map((pointPackage, index) => (
            <div key={index} className="rounded-ds-md border border-bd bg-bg p-3">
              <strong className="text-ds-sm text-tx">套餐 {index + 1}</strong>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-ds-xs text-txs">积分数量</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={pointPackage.points}
                    onChange={(event) => updatePackageDraft(index, "points", event.target.value)}
                    className="h-9 w-full rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
                    aria-label={`套餐 ${index + 1} 积分数量`}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-ds-xs text-txs">套餐价格</span>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={pointPackage.price}
                    onChange={(event) => updatePackageDraft(index, "price", event.target.value)}
                    className="h-9 w-full rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
                    aria-label={`套餐 ${index + 1} 价格`}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-ds-xs text-txs">{packageStatus || "默认显示 2 档：10 积分 ¥10、100 积分 ¥99。"}</p>
      </CollapsiblePanel>

      <section className="grid gap-6 xl:grid-cols-2">
        <CollapsiblePanel
          title="用户积分"
          description="先手动调整会员等级，再单独发放首次 HAI 积分。"
          icon={<Coins className="h-5 w-5" />}
          summary={`${pointWallets.length} 个钱包`}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-ds-xs font-ds-semibold text-txs">手机号或用户名</span>
              <input
                type="search"
                value={pointUserSearch}
                onChange={(event) => setPointUserSearch(event.target.value)}
                placeholder="输入手机号或用户名"
                className="h-10 w-full rounded-ds-md border border-bd bg-bg px-3 text-ds-sm"
                aria-label="按手机号或用户名筛选积分用户"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-ds-xs font-ds-semibold text-txs">会员等级</span>
              <select
                value={pointUserLevelFilter}
                onChange={(event) => setPointUserLevelFilter(event.target.value as PointUserLevelFilter)}
                className="h-10 w-full rounded-ds-md border border-bd bg-bg px-3 text-ds-sm"
                aria-label="按会员等级筛选积分用户"
              >
                <option value="all">全部等级</option>
                <option value="free">Free</option>
                <option value="plus2015">2015Plus</option>
                <option value="plus">Plus</option>
                <option value="pro">Pro</option>
              </select>
            </label>
          </div>
          <div className="mt-2 flex min-h-7 items-center justify-between gap-3 text-ds-xs text-txs">
            <span>已找到 {filteredPointUsers.length} 个用户</span>
            {(pointUserSearch.trim() || pointUserLevelFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setPointUserSearch("");
                  setPointUserLevelFilter("all");
                }}
                className="font-ds-semibold text-ac hover:text-acd"
              >
                清除筛选
              </button>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-ds-xs font-ds-semibold text-txs">选择要操作的用户</span>
            <select className="h-10 w-full rounded-ds-md border border-bd bg-bg px-3 text-ds-sm" value={pointUserId} onChange={(event) => setPointUserId(event.target.value)}>
              <option value="">选择用户</option>
              {selectedPointUser && !filteredPointUsers.some((student) => student.id === selectedPointUser.id) && (
                <option value={selectedPointUser.id}>
                  {selectedPointUser.nickname} · {selectedPointUser.phone} · {membershipLabel(selectedPointUser.access_level)}（当前已选）
                </option>
              )}
              {filteredPointUsers.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.nickname} · {student.phone} · {membershipLabel(student.access_level)}
                </option>
              ))}
            </select>
          </label>
          {filteredPointUsers.length === 0 && (
            <p className="mt-2 rounded-ds-md bg-bg px-3 py-2 text-ds-xs text-txs">
              未找到匹配用户，请调整手机号、用户名或会员等级。
            </p>
          )}

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="rounded-ds-md border border-bd bg-white p-3">
              <p className="text-ds-sm font-ds-bold text-tx">1. 手动调整会员等级</p>
              <div className="mt-2 flex gap-2">
                <select
                  className="h-10 min-w-0 flex-1 rounded-ds-md border border-bd bg-bg px-3 text-ds-sm"
                  value={pointLevelDraft}
                  disabled={!selectedPointUser || saving}
                  onChange={(event) => setPointLevelDraft(event.target.value as MembershipType)}
                  aria-label="HAI 积分发放前调整会员等级"
                >
                  <option value="free">Free</option>
                  <option value="plus2015">2015Plus</option>
                  <option value="plus">Plus</option>
                  <option value="pro">Pro</option>
                </select>
                <Button
                  variant="outline"
                  disabled={!selectedPointUser || selectedPointUser.access_level === pointLevelDraft || saving}
                  onClick={updatePointUserLevel}
                >
                  保存等级
                </Button>
              </div>
            </div>

            <div className="rounded-ds-md border border-bd bg-white p-3">
              <p className="text-ds-sm font-ds-bold text-tx">2. 发放首次 HAI 积分</p>
              <Button
                className="mt-2 w-full bg-ac text-white hover:bg-acd"
                disabled={
                  !selectedPointUser
                  || !["plus", "pro"].includes(selectedPointUser.access_level)
                  || selectedPointWallet?.newcomer_granted_at != null
                  || saving
                }
                onClick={grantNewcomerPoints}
              >
                {selectedPointWallet?.newcomer_granted_at
                  ? "已发放首次积分"
                  : `发放首次 ${formatAdminPoints(newcomerGrantPoints)} 积分`}
              </Button>
              <p className="mt-2 text-ds-xs text-txs">
                {selectedPointUser && !["plus", "pro"].includes(selectedPointUser.access_level)
                  ? "请先完成第 1 步：仅 Plus / Pro 可领取首次赠送。"
                  : "该福利只能发放一次，成功后将同步到用户前端并发送通知。"}
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-bd pt-4">
            <p className="mb-2 text-ds-sm font-ds-bold text-tx">其他积分入账</p>
            <p className="mb-2 text-ds-xs text-txs">用于线下购买、补发等场景；2015Plus 用户购买积分后也可使用 HAI。</p>
            <div className="grid gap-2 md:grid-cols-[110px_minmax(0,1fr)_auto]">
            <input className="h-10 rounded-ds-md border border-bd bg-bg px-3 text-ds-sm" type="number" min={1} step={1} value={pointDraft.points} onChange={(event) => setPointDraft((current) => ({ ...current, points: Math.max(0, Number(event.target.value) || 0) }))} aria-label="增加积分" />
            <input className="h-10 rounded-ds-md border border-bd bg-bg px-3 text-ds-sm" placeholder="增加原因" value={pointDraft.reason} onChange={(event) => setPointDraft((current) => ({ ...current, reason: event.target.value }))} />
            <Button className="bg-ac text-white hover:bg-acd" disabled={!pointUserId || pointDraft.points <= 0 || !pointDraft.reason.trim() || saving} onClick={addPoints}>
              增加积分
            </Button>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {pointWallets.slice(0, 12).map((wallet) => {
              const profile = profileOf(wallet.profiles);
              return (
              <div key={wallet.user_id} className="flex items-center justify-between gap-3 rounded-ds-md border border-bd bg-bg px-3 py-2 text-ds-sm">
                <span><strong className="font-ds-semibold text-tx">{profile?.nickname ?? wallet.user_id}</strong><br /><span className="text-txs">{profile?.phone} · {profile?.access_level}</span></span>
                <span className="text-right"><strong className="text-ac">{formatAdminPoints(wallet.balance_tokens / Math.max(1, tokensPerPoint))} 积分</strong><br /><span className="text-txs">已消耗 {formatAdminPoints(wallet.total_consumed_tokens / Math.max(1, tokensPerPoint))}</span></span>
              </div>
              );
            })}
            {pointWallets.length === 0 && <p className="rounded-ds-md bg-bg px-3 py-6 text-center text-ds-sm text-txs">暂无积分钱包</p>}
          </div>
        </CollapsiblePanel>

        <CollapsiblePanel
          title="额度策略"
          description="内测用户保留日/周额度；Plus、Pro 仅配置单轮和并发上限。"
          icon={<KeyRound className="h-5 w-5" />}
          summary={`${quotas.length} 套`}
        >
          <div className="space-y-3">
            {quotas.map((quota) => (
              <div key={quota.key} className="rounded-ds-md border border-bd bg-bg p-3">
                <div className="mb-2 flex items-center justify-between">
                  <strong>{quota.label}</strong>
                  <Badge variant="outline">{quota.key}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-ds-sm">
                  {!['plus', 'pro'].includes(quota.key) && <NumberInput label="日额度" value={quota.daily_token_limit} onChange={(value) => updateQuota(quota, { daily_token_limit: value })} />}
                  {!['plus', 'pro'].includes(quota.key) && <NumberInput label="周额度" value={quota.weekly_token_limit} onChange={(value) => updateQuota(quota, { weekly_token_limit: value })} />}
                  <NumberInput label="单轮" value={quota.single_request_token_limit} onChange={(value) => updateQuota(quota, { single_request_token_limit: value })} />
                  <NumberInput label="输出" value={quota.max_output_tokens} onChange={(value) => updateQuota(quota, { max_output_tokens: value })} />
                  <NumberInput label="用户并发" value={quota.user_concurrency_limit} onChange={(value) => updateQuota(quota, { user_concurrency_limit: value })} />
                  <NumberInput label="全局并发" value={quota.global_concurrency_limit} onChange={(value) => updateQuota(quota, { global_concurrency_limit: value })} />
                </div>
              </div>
            ))}
          </div>
        </CollapsiblePanel>
      </section>

      <CollapsiblePanel
        title="知识库"
        description="管理共享知识条目、原文和检索分块。"
        icon={<BookOpen className="h-5 w-5" />}
        summary={`${knowledgeSources.length} 条`}
      >
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
      </CollapsiblePanel>

      <CollapsiblePanel
        title="模型供应商"
        description="配置 LLM 模型后端（API Key、Base URL、模型名）。API Key 仅在服务端使用，不会暴露给前端。"
        icon={<Cpu className="h-5 w-5" />}
        summary={`${modelProviders.filter((p) => p.is_enabled).length}/${modelProviders.length} 启用`}
      >
        {/* Add / Edit form */}
        <div className="mb-4 rounded-ds-md border border-bd bg-white p-3">
          <p className="mb-2 text-ds-sm font-ds-bold text-tx">
            {editingProviderId ? "编辑模型供应商" : "新增模型供应商"}
          </p>
          <div className="grid gap-2 sm:grid-cols-6">
            <input
              placeholder="provider code（如 deepseek / zhipu）"
              value={providerDraft.provider_code}
              onChange={(e) => setProviderDraft((d) => ({ ...d, provider_code: e.target.value }))}
              className="h-9 rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
            />
            <input
              placeholder="唯一配置名称（如 DeepSeek V4）"
              value={providerDraft.label}
              onChange={(e) => setProviderDraft((d) => ({ ...d, label: e.target.value }))}
              className="h-9 rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
            />
            <input
              placeholder="模型名（如 deepseek-v4-flash）"
              value={providerDraft.model_name}
              onChange={(e) => setProviderDraft((d) => ({ ...d, model_name: e.target.value }))}
              className="h-9 rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
            />
            <input
              type="password"
              placeholder={editingProviderId ? "留空=不修改" : "API Key"}
              value={providerDraft.api_key}
              onChange={(e) => setProviderDraft((d) => ({ ...d, api_key: e.target.value }))}
              className="h-9 rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
            />
            <input
              placeholder="Base URL（如 https://api.deepseek.com）"
              value={providerDraft.base_url}
              onChange={(e) => setProviderDraft((d) => ({ ...d, base_url: e.target.value }))}
              className="h-9 rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
            />
            <div className="flex items-center gap-2">
              <select
                value={providerDraft.is_enabled ? "1" : "0"}
                onChange={(e) => setProviderDraft((d) => ({ ...d, is_enabled: e.target.value === "1" }))}
                className="h-9 rounded-ds-sm border border-bd bg-white px-2 text-ds-sm"
              >
                <option value="1">启用</option>
                <option value="0">停用</option>
              </select>
              <Button size="sm" onClick={handleSaveProvider} disabled={saving || !providerDraft.label.trim() || !providerDraft.model_name.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                保存
              </Button>
              {editingProviderId && (
                <Button size="sm" variant="outline" onClick={() => { setEditingProviderId(null); setProviderDraft({ id: "", label: "", provider_code: "", model_name: "", api_key: "", base_url: "", is_enabled: true, sort_order: 0 }); }}>
                  <X className="h-4 w-4" />取消
                </Button>
              )}
            </div>
          </div>
        </div>
        {/* Provider list */}
        {modelProviders.length === 0 ? (
          <p className="py-4 text-center text-ds-sm text-txs">暂无模型供应商，请添加。</p>
        ) : (
          <div className="space-y-2">
            {modelProviders.map((provider) => (
              <div
                key={provider.id}
                className="flex flex-wrap items-center gap-3 rounded-ds-md border border-bd bg-white px-3 py-2"
              >
                <span className="min-w-[140px] text-ds-sm font-ds-bold text-tx">{provider.label}</span>
                <Badge variant="outline">{provider.provider_code}</Badge>
                <code className="text-ds-xs text-txs">{provider.model_name}</code>
                <span className="text-ds-xs text-txs truncate max-w-[200px] hidden sm:inline">{provider.base_url}</span>
                <Badge variant={provider.is_enabled ? "default" : "secondary"}>
                  {provider.is_enabled ? "启用" : "停用"}
                </Badge>
                <span className="flex-1" />
                <Button size="sm" variant="outline" onClick={() => startEditProvider(provider)}>
                  <Pencil className="h-3.5 w-3.5" />编辑
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDeleteProvider(provider.id)}>
                  <Trash2 className="h-3.5 w-3.5" />删除
                </Button>
              </div>
            ))}
          </div>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel
        title="功能模块与生成参数（Chat + Work）"
        description="管理所有 HAI 功能模块的模型、温度、Token 等生成参数。"
        icon={<Bot className="h-5 w-5" />}
        summary={`${modules.filter((module) => module.is_enabled).length}/${modules.length} 启用`}
      >
        <div className="grid gap-3 xl:grid-cols-3">
          {modules.map((module) => (
            <div key={module.id} className="rounded-ds-md border border-bd bg-bg p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <strong className="text-tx">{module.name}</strong>
                <Button size="sm" variant="outline" onClick={() => updateModule(module, { is_enabled: !module.is_enabled })}>
                  {module.is_enabled ? "停用" : "启用"}
                </Button>
              </div>
              <p className="mb-3 min-h-10 text-ds-xs text-txs">{module.description}</p>
              <ModuleParamFields module={module} onPatch={(updates) => updateModule(module, updates)} providers={modelProviders} />
            </div>
          ))}
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        title="运行时设置"
        description="管理仍在使用的检索、记忆和质检参数。"
        icon={<SlidersHorizontal className="h-5 w-5" />}
        summary={`${generalRuntimeSettings.filter((setting) => setting.enabled).length}/${generalRuntimeSettings.length} 启用`}
      >
        <div className="grid gap-3 xl:grid-cols-3">
          {generalRuntimeSettings.map((setting) => (
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
          {generalRuntimeSettings.length === 0 && (
            <p className="rounded-ds-md bg-bg px-3 py-8 text-center text-ds-sm text-txs xl:col-span-3">暂无运行时设置</p>
          )}
        </div>
      </CollapsiblePanel>

    </div>
  );
}

export function CollapsiblePanel({
  title,
  description,
  icon,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-ds-lg border border-bd bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac/40"
      >
        <span className="shrink-0 text-ac">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-ds-base font-ds-bold text-tx">{title}</span>
          <span className="mt-0.5 block truncate text-ds-xs text-txs">{description}</span>
        </span>
        {summary && (
          <span className="hidden shrink-0 rounded-full border border-bd bg-bg px-2.5 py-1 text-[11px] text-txs sm:inline">
            {summary}
          </span>
        )}
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-txs transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-bd bg-bg/30 p-4">
          {children}
        </div>
      )}
    </section>
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

function formatAdminPoints(value?: number) {
  const points = Number(value ?? 0);
  return Number.isInteger(points) ? points.toLocaleString("zh-CN") : points.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function membershipLabel(level: MembershipType) {
  if (level === "plus2015") return "2015Plus";
  if (level === "plus") return "Plus";
  if (level === "pro") return "Pro";
  return "Free";
}

const LOCAL_POINT_PACKAGES_KEY = "hai-local-point-packages";

function readLocalPointPackages(): HaiPackageConfig[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_POINT_PACKAGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{ points?: number; price?: number }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => Number(item.points) > 0 && Number(item.price) > 0)
      .slice(0, 3)
      .map((item) => ({
        points: Math.max(1, Math.round(Number(item.points))),
        price: Math.max(0.01, Number(item.price)),
      }));
  } catch {
    return [];
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
