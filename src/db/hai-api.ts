import { supabase, typedSupabase } from "@/db/supabase";
import { consumeSseResponse } from "@/lib/sse";
import type { Database } from "@/types/database.generated";

export interface HaiAccessStatus {
  authenticated: boolean;
  allowed: boolean;
  is_admin?: boolean;
  status?: string;
  reason?: string;
  quota_policy_key?: string;
  expires_at?: string | null;
}

export interface HaiUsageSummary {
  policy_key?: string;
  daily_used: number;
  weekly_used: number;
  daily_limit: number;
  weekly_limit: number;
  single_request_token_limit?: number;
  max_output_tokens?: number;
}

export interface HaiFeatureModule {
  id: string;
  slug: string;
  name: string;
  short_label: string;
  description: string;
  icon_key: string;
  category: string;
  input_schema: Array<Record<string, unknown>>;
  default_model: string;
  default_temperature: number;
  default_max_output_tokens: number;
  thinking_enabled: boolean;
  default_top_p: number | null;
  reasoning_effort: "high" | "max";
  response_format: "text" | "json_object";
  stop_sequences: string[];
  history_message_limit: number;
  memory_limit: number;
  material_match_count: number;
  knowledge_match_count: number;
  model_provider_id: string | null;
  sort_order: number;
  is_enabled: boolean;
  surface_mode?: "chat" | "work";
}

/** Frontend-safe model provider. api_key is NEVER returned to the client. */
export interface HaiModelProvider {
  id: string;
  label: string;
  model_name: string;
  base_url: string;
  is_enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type HaiMode = "chat" | "work";
export type HaiWorkToolSlug = "lesson-diagnosis" | "segment-optimization" | "subject-lesson-design";
export type HaiWorkRunStatus = "queued" | "running" | "completed" | "failed";
export const HAI_CHAT_MODULE_SLUG = "hai-chat" as const;

export type HaiApiErrorCode =
  | "chat_module_unavailable"
  | "task_not_found"
  | "service_unavailable";

export class HaiApiError extends Error {
  readonly code: HaiApiErrorCode;
  readonly detail?: string;

  constructor(code: HaiApiErrorCode, message: string, detail?: string) {
    super(message);
    this.name = "HaiApiError";
    this.code = code;
    this.detail = detail;
  }
}

export interface HaiTextbookCatalogEntry {
  collection_slug: string;
  collection_title: string;
  stage: string;
  subject: string;
  grade_level: number;
  grade_label: string;
  volume: string;
  edition_label: string;
  publication_status: string;
  verification_status: string;
  requires_confirmation: boolean;
  unit_number: number;
  unit_label: string;
  unit_title: string;
  lesson_number: number;
  lesson_label: string;
  lesson_title: string;
  frame_number: number;
  frame_label: string;
  frame_title: string;
}

export interface HaiWorkTask {
  id: string;
  user_id: string;
  module_slug: HaiWorkToolSlug;
  title: string;
  status: "active" | "archived";
  latest_artifact_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  latest_artifact?: Pick<HaiWorkArtifact, "id" | "version_number" | "created_at"> | null;
}

export interface HaiWorkRun {
  id: string;
  task_id: string;
  user_id: string;
  parent_artifact_id: string | null;
  client_request_id: string;
  status: HaiWorkRunStatus;
  input_snapshot: Record<string, unknown>;
  skill_snapshot: {
    slug?: string;
    name?: string;
    version?: string;
    fallback?: boolean;
    snapshot_hash?: string;
    source_metadata?: Record<string, unknown>;
    reference_paths?: string[];
    reference_hashes?: string[];
    textbook_sources?: Array<Record<string, unknown>>;
  };
  revision_instruction: string | null;
  error_message: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  duration_ms: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HaiWorkArtifact {
  id: string;
  task_id: string;
  run_id: string;
  user_id: string;
  parent_artifact_id: string | null;
  version_number: number;
  title: string;
  content_json: Record<string, unknown>;
  content_markdown: string;
  created_at: string;
}

export interface HaiWorkTaskDetail {
  task: HaiWorkTask;
  runs: HaiWorkRun[];
  artifacts: HaiWorkArtifact[];
}

export type HaiWorkStreamEvent =
  | { type: "ready"; taskId: string; runId: string; skill?: string; skillVersion?: string; fallback?: boolean; replayed?: boolean }
  | { type: "progress"; stage: string; message: string }
  | { type: "done"; taskId: string; runId: string; artifactId: string; versionNumber: number; usage?: { inputTokens: number; outputTokens: number; totalTokens: number }; replayed?: boolean }
  | { type: "error"; message: string; taskId?: string; runId?: string; replayed?: boolean };

export interface HaiConversation {
  id: string;
  user_id: string;
  title: string;
  mode: "chat" | "roundtable";
  module_slug: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HaiMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  citations: unknown[];
  metadata: Record<string, unknown>;
  input_tokens: number | null;
  output_tokens: number | null;
  token_estimate: number | null;
  created_at: string;
}

export interface HaiMessageFeedback {
  id: string;
  message_id: string;
  user_id: string;
  rating: "up" | "down";
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface HaiUserMemory {
  id: string;
  user_id: string;
  category: string;
  content: string;
  confidence: number | null;
  source_type: string | null;
  status: "candidate" | "active" | "archived";
  created_at: string;
  updated_at: string;
}

export interface HaiProfileMemoryInput {
  category: "basic_info" | "challenge" | "teaching_preference";
  content: string;
}

export const HAI_PROFILE_ONBOARDING_SOURCE = "profile_onboarding_v1";

export interface HaiMaterial {
  id: string;
  user_id: string;
  conversation_id: string | null;
  title: string;
  file_name: string;
  mime_type: string | null;
  storage_path: string;
  size_bytes: number | null;
  kind: "lesson_material" | "course_system" | "student_work" | "reflection";
  status: "created" | "uploaded" | "processing" | "processed" | "processed_no_embedding" | "failed";
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface HaiPromptSnapshotModelCall {
  stage: "semantic_router" | "answer_draft" | "answer_rewrite";
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  estimated_input_tokens: number;
}

export interface HaiPromptSnapshot {
  captured_at: string;
  model_calls: HaiPromptSnapshotModelCall[];
  final_answer: string;
}

export type HaiStreamEvent =
  | { type: "ready"; conversationId: string; moduleSlug: string; mode?: "chat" | "roundtable" }
  | { type: "token"; token: string }
  | { type: "done"; conversationId: string; messageId: string; usage?: { inputTokens: number; outputTokens: number; totalTokens: number }; promptSnapshot?: HaiPromptSnapshot }
  | { type: "error"; message: string };

export async function getHaiAccessStatus(): Promise<{
  access: HaiAccessStatus;
  usage: HaiUsageSummary | null;
}> {
  const { data, error } = await supabase.functions.invoke("hai-access-status");
  if (error) throw new Error(await getFunctionErrorMessage(error, "读取 HAI 权限失败。"));
  return normalizeAccessPayload(data);
}

export async function redeemHaiInvite(code: string): Promise<{
  access: HaiAccessStatus;
  usage: HaiUsageSummary | null;
}> {
  const { data, error } = await supabase.functions.invoke("hai-redeem-invite", {
    body: { code },
  });
  if (error) throw new Error(await getFunctionErrorMessage(error, "邀请码兑换失败。"));
  return normalizeAccessPayload(data);
}

export async function getHaiChatModule(): Promise<HaiFeatureModule> {
  const { data, error } = await typedSupabase
    .from("hai_feature_modules")
    .select("*")
    .eq("surface_mode", "chat")
    .eq("slug", HAI_CHAT_MODULE_SLUG)
    .eq("is_enabled", true)
    .maybeSingle();
  if (error) {
    throw new HaiApiError(
      "service_unavailable",
      "无法读取 HAI Chat 配置，请稍后重试。",
      error.message,
    );
  }
  if (!data) {
    throw new HaiApiError(
      "chat_module_unavailable",
      "HAI Chat 当前未启用，请联系管理员检查模块和已发布 Skill。",
    );
  }
  return normalizeHaiChatModule(data);
}

export async function getHaiWorkTools(): Promise<HaiFeatureModule[]> {
  const { data, error } = await supabase
    .from("hai_feature_modules")
    .select("*")
    .eq("surface_mode", "work")
    .eq("is_enabled", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as HaiFeatureModule[]) ?? [];
}

// ── Model Providers ────────────────────────────────────────────

export async function getHaiModelProviders(): Promise<HaiModelProvider[]> {
  const { data, error } = await supabase
    .from("hai_model_providers")
    .select("id, label, model_name, base_url, is_enabled, sort_order, created_at, updated_at")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as HaiModelProvider[]) ?? [];
}

export async function saveHaiModelProvider(
  provider: { label: string; model_name: string; api_key: string; base_url: string; is_enabled: boolean; sort_order: number; id?: string },
): Promise<void> {
  const { error } = await supabase
    .from("hai_model_providers")
    .upsert({
      id: provider.id,
      label: provider.label,
      model_name: provider.model_name,
      api_key: provider.api_key,
      base_url: provider.base_url,
      is_enabled: provider.is_enabled,
      sort_order: provider.sort_order,
    });
  if (error) throw error;
}

export async function deleteHaiModelProvider(id: string): Promise<void> {
  const { error } = await supabase.from("hai_model_providers").delete().eq("id", id);
  if (error) throw error;
}

export async function getHaiTextbookCatalog(
  stage = "初中",
  subject = "道德与法治",
): Promise<HaiTextbookCatalogEntry[]> {
  const { data, error } = await supabase.rpc("hai_list_textbook_catalog", {
    p_stage: stage,
    p_subject: subject,
  });
  if (error) throw error;
  return (data as HaiTextbookCatalogEntry[]) ?? [];
}

export async function getHaiWorkTasks(): Promise<HaiWorkTask[]> {
  const { data, error } = await supabase
    .from("hai_work_tasks")
    .select("*, latest_artifact:hai_work_artifacts!hai_work_tasks_latest_artifact_id_fkey(id, version_number, created_at)")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as unknown as HaiWorkTask[]) ?? [];
}

export async function getHaiWorkTaskDetail(taskId: string): Promise<HaiWorkTaskDetail> {
  refreshStaleWorkRunsInBackground(taskId);

  const [taskResult, runsResult, artifactsResult] = await Promise.all([
    supabase.from("hai_work_tasks").select("*").eq("id", taskId).single(),
    supabase.from("hai_work_runs").select("*").eq("task_id", taskId).order("created_at", { ascending: false }),
    supabase.from("hai_work_artifacts").select("*").eq("task_id", taskId).order("version_number", { ascending: false }),
  ]);
  if (taskResult.error) {
    if (taskResult.error.code === "PGRST116") {
      throw new HaiApiError("task_not_found", "该 HAI Work 任务不存在或你无权访问。");
    }
    throw new HaiApiError(
      "service_unavailable",
      "HAI Work 任务暂时无法读取，请稍后重试。",
      taskResult.error.message,
    );
  }
  if (runsResult.error) {
    throw new HaiApiError(
      "service_unavailable",
      "HAI Work 运行记录暂时无法读取，请稍后重试。",
      runsResult.error.message,
    );
  }
  if (artifactsResult.error) {
    throw new HaiApiError(
      "service_unavailable",
      "HAI Work 产物暂时无法读取，请稍后重试。",
      artifactsResult.error.message,
    );
  }
  return {
    task: taskResult.data as HaiWorkTask,
    runs: (runsResult.data as HaiWorkRun[]) ?? [],
    artifacts: (artifactsResult.data as HaiWorkArtifact[]) ?? [],
  };
}

function refreshStaleWorkRunsInBackground(taskId: string) {
  try {
    void Promise.resolve(
      supabase.rpc("hai_mark_stale_work_runs", { p_task_id: taskId }),
    ).then(({ error }) => {
      if (error) {
        console.warn("[HAI Work] 过期运行状态后台校正失败", {
          taskId,
          message: error.message,
        });
      }
    }).catch((error: unknown) => {
      console.warn("[HAI Work] 过期运行状态后台校正异常", {
        taskId,
        message: error instanceof Error ? error.message : String(error),
      });
    });
  } catch (error) {
    console.warn("[HAI Work] 过期运行状态后台校正异常", {
      taskId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function archiveHaiWorkTask(taskId: string): Promise<void> {
  const { error } = await supabase.from("hai_work_tasks").update({
    status: "archived",
    archived_at: new Date().toISOString(),
  }).eq("id", taskId);
  if (error) throw error;
}

export async function streamHaiWork(
  payload: {
    toolSlug: HaiWorkToolSlug;
    input: Record<string, unknown>;
    materialIds?: string[];
    taskId?: string;
    parentArtifactId?: string;
    revisionInstruction?: string;
    clientRequestId?: string;
  },
  handlers: { onEvent: (event: HaiWorkStreamEvent) => void },
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("请先登录。");
  const response = await fetch(`${getFunctionsBaseUrl()}/hai-work`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      clientRequestId: payload.clientRequestId || crypto.randomUUID(),
    }),
  });
  await consumeSseResponse<HaiWorkStreamEvent>(response, {
    fallbackErrorMessage: "HAI Work 请求失败。",
    onEvent: handlers.onEvent,
  });
}

export async function getHaiConversations(): Promise<HaiConversation[]> {
  const { data, error } = await supabase
    .from("hai_conversations")
    .select("*")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as HaiConversation[]) ?? [];
}

export async function getHaiMessages(conversationId: string): Promise<HaiMessage[]> {
  const { data, error } = await supabase
    .from("hai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as HaiMessage[]) ?? [];
}

export async function getHaiMessageFeedback(messageIds: string[]): Promise<HaiMessageFeedback[]> {
  if (messageIds.length === 0) return [];
  const { data, error } = await supabase
    .from("hai_message_feedback")
    .select("*")
    .in("message_id", messageIds);
  if (error) throw error;
  return (data as HaiMessageFeedback[]) ?? [];
}

export async function setHaiMessageFeedback(
  messageId: string,
  rating: "up" | "down",
): Promise<HaiMessageFeedback> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("请先登录后再评价。 ");
  const { data, error } = await supabase
    .from("hai_message_feedback")
    .upsert({
      message_id: messageId,
      user_id: authData.user.id,
      rating,
      updated_at: new Date().toISOString(),
    }, { onConflict: "message_id,user_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as HaiMessageFeedback;
}

export async function archiveHaiConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from("hai_conversations")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) throw error;
}

export async function getHaiMemories(): Promise<HaiUserMemory[]> {
  const { data, error } = await supabase
    .from("hai_user_memories")
    .select("*")
    .eq("status", "active")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as HaiUserMemory[]) ?? [];
}

export async function hasCompletedHaiProfileOnboarding(): Promise<boolean> {
  const { data, error } = await supabase
    .from("hai_user_memories")
    .select("id")
    .eq("source_type", HAI_PROFILE_ONBOARDING_SOURCE)
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

export async function saveHaiProfileMemories(params: {
  userId: string;
  memories: HaiProfileMemoryInput[];
}): Promise<HaiUserMemory[]> {
  const { data, error } = await supabase
    .from("hai_user_memories")
    .insert(params.memories.map((memory) => ({
      user_id: params.userId,
      category: memory.category,
      content: memory.content,
      confidence: 1,
      source_type: HAI_PROFILE_ONBOARDING_SOURCE,
      status: "active",
    })))
    .select("*");
  if (error) throw error;
  return (data as HaiUserMemory[]) ?? [];
}

export async function createHaiMemory(params: {
  userId: string;
  category: string;
  content: string;
}): Promise<HaiUserMemory> {
  const { data, error } = await supabase
    .from("hai_user_memories")
    .insert({
      user_id: params.userId,
      category: params.category,
      content: params.content,
      confidence: 0.85,
      source_type: "manual",
      status: "active",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as HaiUserMemory;
}

export async function archiveHaiMemory(memoryId: string): Promise<void> {
  const { error } = await supabase
    .from("hai_user_memories")
    .update({ status: "archived" })
    .eq("id", memoryId);
  if (error) throw error;
}

export async function getHaiMaterials(): Promise<HaiMaterial[]> {
  const { data, error } = await supabase
    .from("hai_materials")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw error;
  return (data as HaiMaterial[]) ?? [];
}

export async function uploadHaiMaterial(params: {
  userId: string;
  file: File;
  kind: HaiMaterial["kind"];
  conversationId?: string | null;
}): Promise<HaiMaterial> {
  const safeName = params.file.name.replace(/[^\w.\-\u4e00-\u9fa5]+/g, "_");
  const storagePath = `${params.userId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("hai-user-materials")
    .upload(storagePath, params.file, {
      contentType: params.file.type || undefined,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("hai_materials")
    .insert({
      user_id: params.userId,
      conversation_id: params.conversationId ?? null,
      title: params.file.name.replace(/\.[^.]+$/, "") || params.file.name,
      file_name: params.file.name,
      mime_type: params.file.type || null,
      storage_path: storagePath,
      size_bytes: params.file.size,
      kind: params.kind,
      status: "uploaded",
    })
    .select("*")
    .single();
  if (error) throw error;

  const material = data as HaiMaterial;
  const { error: ingestError } = await supabase.functions.invoke("hai-ingest-material", {
    body: { materialId: material.id },
  });
  if (ingestError) throw ingestError;

  const { data: refreshed, error: refreshError } = await supabase
    .from("hai_materials")
    .select("*")
    .eq("id", material.id)
    .single();
  if (refreshError) throw refreshError;
  return refreshed as HaiMaterial;
}

export async function deleteHaiMaterial(materialId: string): Promise<void> {
  const { data: material, error: selectError } = await supabase
    .from("hai_materials")
    .select("id, storage_path")
    .eq("id", materialId)
    .single();
  if (selectError) throw selectError;

  const storagePath = String((material as { storage_path?: string }).storage_path || "");
  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from("hai-user-materials")
      .remove([storagePath]);
    if (storageError) throw storageError;
  }

  const { error } = await supabase
    .from("hai_materials")
    .delete()
    .eq("id", materialId);
  if (error) throw error;
}

export async function streamHaiChat(
  payload: {
    conversationId: string | null;
    message: string;
    capturePromptSnapshot?: boolean;
  },
  handlers: {
    onEvent: (event: HaiStreamEvent) => void;
  },
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("请先登录。");

  const url = `${getFunctionsBaseUrl()}/hai-chat`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      moduleSlug: HAI_CHAT_MODULE_SLUG,
      mode: "chat",
      clientRequestId: crypto.randomUUID(),
    }),
  });
  await consumeSseResponse<HaiStreamEvent>(response, {
    fallbackErrorMessage: "HAI 请求失败。",
    onEvent: handlers.onEvent,
  });
}

function getFunctionsBaseUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) throw new Error("缺少 VITE_SUPABASE_URL。");
  return `${String(url).replace(/\/$/, "")}/functions/v1`;
}

function normalizeAccessPayload(value: unknown) {
  const record = isRecord(value) ? value : {};
  return {
    access: (isRecord(record.access) ? record.access : {}) as unknown as HaiAccessStatus,
    usage: (isRecord(record.usage) ? record.usage : null) as HaiUsageSummary | null,
  };
}

function normalizeHaiChatModule(
  row: Database["public"]["Tables"]["hai_feature_modules"]["Row"],
): HaiFeatureModule {
  const reasoningEffort = row.reasoning_effort;
  const responseFormat = row.response_format;
  const inputSchema = normalizeModuleInputSchema(row.input_schema);
  if (
    row.slug !== HAI_CHAT_MODULE_SLUG ||
    row.surface_mode !== "chat" ||
    (reasoningEffort !== "high" && reasoningEffort !== "max") ||
    (responseFormat !== "text" && responseFormat !== "json_object") ||
    inputSchema === null
  ) {
    throw new HaiApiError(
      "service_unavailable",
      ""问问哈老师"配置不完整，请联系管理员检查模块配置。",
      `slug=${row.slug}, surface_mode=${row.surface_mode}, reasoning_effort=${reasoningEffort}, response_format=${responseFormat}`,
    );
  }
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    short_label: row.short_label,
    description: row.description,
    icon_key: row.icon_key,
    category: row.category,
    input_schema: inputSchema,
    default_model: row.default_model,
    default_temperature: row.default_temperature,
    default_max_output_tokens: row.default_max_output_tokens,
    thinking_enabled: row.thinking_enabled,
    default_top_p: row.default_top_p,
    reasoning_effort: reasoningEffort,
    response_format: responseFormat,
    stop_sequences: row.stop_sequences,
    history_message_limit: row.history_message_limit,
    memory_limit: row.memory_limit,
    material_match_count: row.material_match_count,
    knowledge_match_count: row.knowledge_match_count,
    sort_order: row.sort_order,
    is_enabled: row.is_enabled,
    surface_mode: "chat",
  };
}

function normalizeModuleInputSchema(value: unknown): Array<Record<string, unknown>> | null {
  if (!Array.isArray(value)) return null;
  const fields: Array<Record<string, unknown>> = [];
  for (const item of value) {
    if (isRecord(item)) fields.push(item);
  }
  return fields;
}

async function getFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  let message = error instanceof Error && error.message.trim() ? error.message : fallback;
  if (!isRecord(error)) return message;

  const context = error.context;
  if (context instanceof Response) {
    const payload = await context.clone().json().catch(() => null);
    if (isRecord(payload) && typeof payload.message === "string" && payload.message.trim()) {
      message = payload.message;
    }
  }
  return message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
