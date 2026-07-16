import { supabase } from "@/db/supabase";

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
  sort_order: number;
  is_enabled: boolean;
}

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

export async function getHaiModules(): Promise<HaiFeatureModule[]> {
  const { data, error } = await supabase
    .from("hai_feature_modules")
    .select("*")
    .eq("is_enabled", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as HaiFeatureModule[]) ?? [];
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
    moduleSlug: string;
    message: string;
    mode?: "chat" | "roundtable";
    roleIds?: string[];
    capturePromptSnapshot?: boolean;
  },
  handlers: {
    onEvent: (event: HaiStreamEvent) => void;
  },
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("请先登录。");

  const endpoint = payload.mode === "roundtable" ? "hai-roundtable-chat" : "hai-chat";
  const url = `${getFunctionsBaseUrl()}/${endpoint}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      clientRequestId: crypto.randomUUID(),
    }),
  });

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    throw new Error(String(data.message || "HAI 请求失败。"));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const line = event.split("\n").find((part) => part.startsWith("data: "));
      if (!line) continue;
      handlers.onEvent(JSON.parse(line.slice(6)) as HaiStreamEvent);
    }
  }
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
