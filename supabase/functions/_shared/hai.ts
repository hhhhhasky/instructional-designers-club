import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";
import { getSupabasePublishableKey, getSupabaseSecretKey } from "./supabase-keys.ts";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type AuthedRequest = {
  user: User;
  token: string;
  admin: SupabaseClient;
  userClient: SupabaseClient;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type HaiRuntimeConfig = {
  contextWindowTokens: number;
  contextWarningRemainingRatio: number;
  defaultTemperature: number;
  contextOrchestratorEnabled: boolean;
  orchestratorCaseMax: number;
  orchestratorMethodMax: number;
  orchestratorTheoryMax: number;
  orchestratorExpressionMax: number;
  routerLlmFallbackEnabled: boolean;
  routerLlmConfidenceThreshold: number;
  evaluatorEnabled: boolean;
  evaluatorPassScore: number;
  evaluatorMaxRewrites: number;
  materialMatchCount: number;
  knowledgeMatchCount: number;
  materialChunkMaxChars: number;
  knowledgeChunkMaxChars: number;
  memoryEnabled: boolean;
  materialRetrievalEnabled: boolean;
  knowledgeRetrievalEnabled: boolean;
  logConfigSnapshot: boolean;
  roundtableMinTemperature: number;
};

export type HaiModuleConfig = {
  default_model: string;
  default_temperature: number | null;
  default_max_output_tokens: number | null;
  thinking_enabled: boolean | null;
  default_top_p?: number | null;
  reasoning_effort?: string | null;
  response_format?: string | null;
  stop_sequences?: string[] | null;
  model_provider_id?: string | null;
};

export type HaiChatCompletionOptions = {
  model: string;
  temperature: number;
  topP?: number;
  maxTokens: number;
  thinkingEnabled: boolean;
  reasoningEffort?: "high" | "max";
  responseFormat?: "text" | "json_object";
  stopSequences?: string[];
  modelProviderId?: string | null;
};

const defaultRuntimeConfig: HaiRuntimeConfig = {
  contextWindowTokens: 1000000,
  contextWarningRemainingRatio: 0.2,
  defaultTemperature: 0.25,
  contextOrchestratorEnabled: true,
  orchestratorCaseMax: 3,
  orchestratorMethodMax: 2,
  orchestratorTheoryMax: 1,
  orchestratorExpressionMax: 5,
  routerLlmFallbackEnabled: true,
  routerLlmConfidenceThreshold: 0.72,
  evaluatorEnabled: true,
  evaluatorPassScore: 78,
  evaluatorMaxRewrites: 1,
  materialMatchCount: 8,
  knowledgeMatchCount: 6,
  materialChunkMaxChars: 1800,
  knowledgeChunkMaxChars: 1400,
  memoryEnabled: true,
  materialRetrievalEnabled: true,
  knowledgeRetrievalEnabled: true,
  logConfigSnapshot: true,
  roundtableMinTemperature: 0.35,
};

export const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

export function handleCors(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export function sseHeaders() {
  return {
    ...corsHeaders,
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  };
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(500, `缺少服务端环境变量 ${name}。`);
  return value;
}

export function createAdminClient() {
  return createClient(requiredEnv("SUPABASE_URL"), getSupabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createUserClient(request: Request) {
  return createClient(requiredEnv("SUPABASE_URL"), getSupabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        authorization: request.headers.get("authorization") ?? "",
      },
    },
  });
}

export async function requireUser(request: Request): Promise<AuthedRequest> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new HttpError(401, "请先登录。");

  const admin = createAdminClient();
  const userClient = createUserClient(request);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "登录状态已失效。");

  return { user: data.user, token, admin, userClient };
}

export async function assertHaiAccess(userClient: SupabaseClient) {
  const { data, error } = await userClient.rpc("hai_access_status");
  if (error) throw new HttpError(500, error.message);
  const status = normalizeRecord(data);
  if (!status.allowed) {
    throw new HttpError(403, String(status.reason || "HAI 当前仅面向内测用户开放。"));
  }
  return status;
}

export function estimateTokens(text: string) {
  if (!text) return 0;
  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) ?? []).length;
  const kana = (text.match(/[\u3040-\u30ff]/g) ?? []).length;
  const hangul = (text.match(/[\uac00-\ud7af]/g) ?? []).length;
  const words = (text.match(/[A-Za-z0-9_]+(?:[-'][A-Za-z0-9_]+)*/g) ?? []).length;
  const punctuation = (text.match(/[^\s\w\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g) ?? []).length;
  const whitespace = (text.match(/\s+/g) ?? []).length;
  const covered = cjk + kana + hangul + punctuation + whitespace;
  const otherChars = Math.max(0, text.length - covered);
  return Math.max(1, Math.ceil(cjk * 0.9 + kana * 0.9 + hangul * 0.75 + words * 1.25 + punctuation * 0.35 + otherChars / 4));
}

export function createTitle(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "新的 HAI 对话";
  return normalized.length > 28 ? `${normalized.slice(0, 28)}...` : normalized;
}

export function normalizeRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function reserveUsage(params: {
  userClient: SupabaseClient;
  requestId: string;
  route: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await params.userClient.rpc("hai_check_and_reserve_usage", {
    p_request_id: params.requestId,
    p_route: params.route,
    p_estimated_input_tokens: params.estimatedInputTokens,
    p_estimated_output_tokens: params.estimatedOutputTokens,
    p_metadata: params.metadata ?? {},
  });
  if (error) throw new HttpError(500, error.message);

  const result = normalizeRecord(data);
  if (!result.allowed) {
    throw new HttpError(429, String(result.reason || "HAI 使用额度不足，请稍后再试。"));
  }
  return result;
}

export async function finalizeUsage(params: {
  userClient: SupabaseClient;
  requestId: string;
  status: "completed" | "failed" | "cached";
  route: string;
  inputTokens: number;
  outputTokens: number;
  entityType?: string | null;
  entityId?: string | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await params.userClient.rpc("hai_finalize_usage", {
    p_request_id: params.requestId,
    p_status: params.status,
    p_input_tokens: params.inputTokens,
    p_output_tokens: params.outputTokens,
    p_route: params.route,
    p_entity_type: params.entityType ?? null,
    p_entity_id: params.entityId ?? null,
    p_duration_ms: params.durationMs ?? null,
    p_metadata: params.metadata ?? {},
  });
  if (error) console.warn("hai finalize usage failed", error.message);
}

export async function loadHaiRuntimeConfig(admin: SupabaseClient): Promise<HaiRuntimeConfig> {
  const { data, error } = await admin
    .from("hai_runtime_settings")
    .select("key, value, enabled");
  if (error) throw new HttpError(500, error.message);

  const settings = new Map<string, unknown>();
  for (const row of (data ?? []) as Array<{ key: string; value: unknown; enabled: boolean }>) {
    if (row.enabled !== false) settings.set(row.key, row.value);
  }

  return {
    contextWindowTokens: integerSetting(settings, "context.window_tokens", defaultRuntimeConfig.contextWindowTokens),
    contextWarningRemainingRatio: numberSetting(settings, "context.warning_remaining_ratio", defaultRuntimeConfig.contextWarningRemainingRatio),
    defaultTemperature: numberSetting(settings, "chat.temperature", defaultRuntimeConfig.defaultTemperature),
    contextOrchestratorEnabled: booleanSetting(settings, "context.orchestrator_enabled", defaultRuntimeConfig.contextOrchestratorEnabled),
    orchestratorCaseMax: integerSetting(settings, "orchestrator.case_max", defaultRuntimeConfig.orchestratorCaseMax),
    orchestratorMethodMax: integerSetting(settings, "orchestrator.method_max", defaultRuntimeConfig.orchestratorMethodMax),
    orchestratorTheoryMax: integerSetting(settings, "orchestrator.theory_max", defaultRuntimeConfig.orchestratorTheoryMax),
    orchestratorExpressionMax: integerSetting(settings, "orchestrator.expression_max", defaultRuntimeConfig.orchestratorExpressionMax),
    routerLlmFallbackEnabled: booleanSetting(settings, "router.llm_fallback_enabled", defaultRuntimeConfig.routerLlmFallbackEnabled),
    routerLlmConfidenceThreshold: numberSetting(settings, "router.llm_confidence_threshold", defaultRuntimeConfig.routerLlmConfidenceThreshold),
    evaluatorEnabled: booleanSetting(settings, "evaluator.enabled", defaultRuntimeConfig.evaluatorEnabled),
    evaluatorPassScore: numberSetting(settings, "evaluator.pass_score", defaultRuntimeConfig.evaluatorPassScore),
    evaluatorMaxRewrites: integerSetting(settings, "evaluator.max_rewrites", defaultRuntimeConfig.evaluatorMaxRewrites),
    materialMatchCount: integerSetting(settings, "retrieval.material_match_count", defaultRuntimeConfig.materialMatchCount),
    knowledgeMatchCount: integerSetting(settings, "retrieval.knowledge_match_count", defaultRuntimeConfig.knowledgeMatchCount),
    materialChunkMaxChars: integerSetting(settings, "retrieval.material_chunk_max_chars", defaultRuntimeConfig.materialChunkMaxChars),
    knowledgeChunkMaxChars: integerSetting(settings, "retrieval.knowledge_chunk_max_chars", defaultRuntimeConfig.knowledgeChunkMaxChars),
    memoryEnabled: booleanSetting(settings, "context.memory_enabled", defaultRuntimeConfig.memoryEnabled),
    materialRetrievalEnabled: booleanSetting(settings, "retrieval.material_enabled", defaultRuntimeConfig.materialRetrievalEnabled),
    knowledgeRetrievalEnabled: booleanSetting(settings, "retrieval.knowledge_enabled", defaultRuntimeConfig.knowledgeRetrievalEnabled),
    logConfigSnapshot: booleanSetting(settings, "observability.log_config_snapshot", defaultRuntimeConfig.logConfigSnapshot),
    roundtableMinTemperature: numberSetting(settings, "chat.roundtable_min_temperature", defaultRuntimeConfig.roundtableMinTemperature),
  };
}

export function parseRuntimeSetting(value: unknown, valueType: string): string | number | boolean {
  if (valueType === "boolean") return parseBoolean(value, false);
  if (valueType === "integer") return Math.round(parseNumber(value, 0));
  if (valueType === "number") return parseNumber(value, 0);
  return String(value ?? "");
}

export function buildChatCompletionOptions(params: {
  module: HaiModuleConfig;
  runtime: HaiRuntimeConfig;
  minTemperature?: number;
}): HaiChatCompletionOptions {
  const rawTemperature = finiteNumber(params.module.default_temperature) ?? params.runtime.defaultTemperature;
  const minTemperature = params.minTemperature ?? 0;
  const temperature = clamp(rawTemperature, minTemperature, 2);
  const topP = finiteNumber(params.module.default_top_p);
  const maxTokens = Math.max(1, Math.round(finiteNumber(params.module.default_max_output_tokens) ?? 4096));
  const reasoningEffort = normalizeReasoningEffort(params.module.reasoning_effort);
  const responseFormat = normalizeResponseFormat(params.module.response_format);
  const stopSequences = Array.isArray(params.module.stop_sequences)
    ? params.module.stop_sequences.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 16)
    : [];

  return {
    model: params.module.default_model,
    temperature,
    topP: normalizeTopP(topP),
    maxTokens,
    thinkingEnabled: params.module.thinking_enabled === true,
    reasoningEffort,
    responseFormat,
    stopSequences: stopSequences.length > 0 ? stopSequences : undefined,
    modelProviderId: params.module.model_provider_id ?? null,
  };
}

export function runtimeConfigSnapshot(runtime: HaiRuntimeConfig, options: HaiChatCompletionOptions) {
  return {
    model: options.model,
    model_provider_id: options.modelProviderId ?? null,
    temperature: options.temperature,
    top_p: options.topP ?? null,
    max_tokens: options.maxTokens,
    thinking_enabled: options.thinkingEnabled,
    reasoning_effort: options.reasoningEffort ?? null,
    response_format: options.responseFormat ?? "text",
    stop_sequences: options.stopSequences ?? [],
    context_window_tokens: runtime.contextWindowTokens,
    context_warning_remaining_ratio: runtime.contextWarningRemainingRatio,
    context_orchestrator_enabled: runtime.contextOrchestratorEnabled,
    orchestrator_case_max: runtime.orchestratorCaseMax,
    orchestrator_method_max: runtime.orchestratorMethodMax,
    orchestrator_theory_max: runtime.orchestratorTheoryMax,
    orchestrator_expression_max: runtime.orchestratorExpressionMax,
    router_llm_fallback_enabled: runtime.routerLlmFallbackEnabled,
    router_llm_confidence_threshold: runtime.routerLlmConfidenceThreshold,
    evaluator_enabled: runtime.evaluatorEnabled,
    evaluator_pass_score: runtime.evaluatorPassScore,
    evaluator_max_rewrites: runtime.evaluatorMaxRewrites,
    material_match_count: runtime.materialMatchCount,
    knowledge_match_count: runtime.knowledgeMatchCount,
    material_chunk_max_chars: runtime.materialChunkMaxChars,
    knowledge_chunk_max_chars: runtime.knowledgeChunkMaxChars,
    memory_enabled: runtime.memoryEnabled,
    material_retrieval_enabled: runtime.materialRetrievalEnabled,
    knowledge_retrieval_enabled: runtime.knowledgeRetrievalEnabled,
  };
}

function numberSetting(settings: Map<string, unknown>, key: string, fallback: number) {
  return parseNumber(settings.get(key), fallback);
}

function integerSetting(settings: Map<string, unknown>, key: string, fallback: number) {
  return Math.max(0, Math.round(parseNumber(settings.get(key), fallback)));
}

function booleanSetting(settings: Map<string, unknown>, key: string, fallback: boolean) {
  return parseBoolean(settings.get(key), fallback);
}

function parseNumber(value: unknown, fallback: number) {
  const candidate = typeof value === "number" ? value : Number(value);
  return Number.isFinite(candidate) ? candidate : fallback;
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

function finiteNumber(value: unknown) {
  const candidate = typeof value === "number" ? value : Number(value);
  return Number.isFinite(candidate) ? candidate : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeTopP(value: number | undefined) {
  if (value === undefined || value <= 0) return undefined;
  return clamp(value, Number.MIN_VALUE, 1);
}

function normalizeReasoningEffort(value: unknown): "high" | "max" | undefined {
  return value === "high" || value === "max" ? value : undefined;
}

function normalizeResponseFormat(value: unknown): "text" | "json_object" | undefined {
  return value === "json_object" ? "json_object" : value === "text" ? "text" : undefined;
}

function deepSeekConfig() {
  return {
    baseUrl: Deno.env.get("DEEPSEEK_BASE_URL") || "https://api.deepseek.com",
    apiKey: Deno.env.get("DEEPSEEK_API_KEY"),
    model: Deno.env.get("DEEPSEEK_MODEL") || "deepseek-v4-flash",
  };
}

type ProviderConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

/**
 * Resolve a model provider's credentials.
 * When modelProviderId is provided, looks it up from hai_model_providers.
 * Falls back to the legacy DEEPSEEK_* env vars for backward compatibility.
 */
async function resolveProviderConfig(
  admin: SupabaseClient,
  modelProviderId: string | null | undefined,
  fallbackModel?: string | null,
): Promise<ProviderConfig> {
  if (!modelProviderId) {
    const envKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!envKey) throw new HttpError(503, "AI 服务未配置 API Key。");
    return {
      baseUrl: Deno.env.get("DEEPSEEK_BASE_URL") || "https://api.deepseek.com",
      apiKey: envKey,
      model: fallbackModel || Deno.env.get("DEEPSEEK_MODEL") || "deepseek-v4-flash",
    };
  }

  const { data, error } = await admin
    .from("hai_model_providers")
    .select("label, model_name, api_key, base_url, is_enabled")
    .eq("id", modelProviderId)
    .maybeSingle();

  if (error || !data) {
    console.warn("Model provider not found in DB, falling back to env:", error?.message);
    const envKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!envKey) throw new HttpError(503, "AI 服务未配置 API Key。");
    return {
      baseUrl: Deno.env.get("DEEPSEEK_BASE_URL") || "https://api.deepseek.com",
      apiKey: envKey,
      model: fallbackModel || Deno.env.get("DEEPSEEK_MODEL") || "deepseek-v4-flash",
    };
  }

  if (!data.is_enabled) {
    throw new HttpError(503, `模型供应商 "${data.label}" 已被禁用。`);
  }

  // ENV: prefix → read from Deno.env; otherwise use the stored value
  let apiKey = data.api_key;
  if (apiKey.startsWith("ENV:")) {
    const envName = apiKey.slice(4);
    apiKey = Deno.env.get(envName) || "";
  }
  if (!apiKey) {
    throw new HttpError(503, `模型供应商 "${data.label}" 的 API Key 未配置。`);
  }

  return {
    baseUrl: data.base_url.replace(/\/$/, "") || "https://api.deepseek.com",
    apiKey,
    model: fallbackModel || data.model_name,
  };
}

export async function* streamDeepSeek(
  messages: ChatMessage[],
  options: {
    model?: string | null;
    temperature?: number | null;
    topP?: number | null;
    maxTokens?: number | null;
    thinkingEnabled?: boolean | null;
    reasoningEffort?: "high" | "max" | null;
    responseFormat?: "text" | "json_object" | null;
    stopSequences?: string[] | null;
    userId?: string | null;
    admin?: SupabaseClient | null;
    modelProviderId?: string | null;
  } = {},
) {
  const config = options.admin
    ? await resolveProviderConfig(options.admin, options.modelProviderId, options.model)
    : deepSeekConfig();
  if (!config.apiKey) throw new HttpError(503, "AI 服务未配置 DeepSeek API Key。");

  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(compactObject({
      model: options.model || config.model,
      messages,
      temperature: options.temperature ?? 0.25,
      top_p: options.topP,
      max_tokens: options.maxTokens ?? 4096,
      response_format: options.responseFormat ? { type: options.responseFormat } : undefined,
      stop: options.stopSequences && options.stopSequences.length > 0 ? options.stopSequences : undefined,
      stream: true,
      user_id: options.userId ?? undefined,
      thinking: options.thinkingEnabled === true
        ? compactObject({ type: "enabled", reasoning_effort: options.reasoningEffort })
        : { type: "disabled" },
    })),
  });

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    const message = normalizeRecord(normalizeRecord(data).error).message || normalizeRecord(data).message || "DeepSeek 流式请求失败。";
    throw new HttpError(response.status, String(message));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === "[DONE]") continue;
      const data = JSON.parse(payload);
      const token = data?.choices?.[0]?.delta?.content;
      if (token) yield String(token);
    }
  }
}

function compactObject(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null));
}

export function sendSse(controller: ReadableStreamDefaultController<Uint8Array>, encoder: TextEncoder, payload: unknown) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
}

export type ExplicitMemoryCandidate = {
  category: string;
  content: string;
  confidence: number;
  slot: "teaching_assignment" | "student_profile" | "response_preference" | "teaching_constraint";
  intent: "remember" | "future_rule";
};

export async function rememberExplicitTeacherFacts(
  admin: SupabaseClient,
  userId: string,
  text: string,
) {
  const candidates = extractExplicitMemoryCandidates(text);
  if (candidates.length === 0) return;

  for (const candidate of candidates) {
    const { data: existingRows, error: selectError } = await admin
      .from("hai_user_memories")
      .select("id, content, source_type, status")
      .eq("user_id", userId)
      .eq("category", candidate.category)
      .neq("status", "archived")
      .limit(20);
    if (selectError) {
      console.warn("hai memory select failed", selectError.message);
      continue;
    }

    const existing = (Array.isArray(existingRows) ? existingRows : []) as Array<{
      id: string;
      content: string;
      source_type: string | null;
      status: string;
    }>;
    if (existing.some((item) => item.content === candidate.content)) continue;

    const slotPrefix = explicitMemorySlotPrefix(candidate.slot);
    const conflicts = existing.filter((item) => item.content.startsWith(slotPrefix));
    const protectedConflicts = conflicts.filter((item) => !isAutoExtractedMemory(item.source_type));
    const replaceableConflicts = conflicts.filter((item) => isAutoExtractedMemory(item.source_type));
    let status: "active" | "candidate" = "active";
    let action: "new" | "update" | "conflict" = "new";

    if (protectedConflicts.length > 0) {
      status = "candidate";
      action = "conflict";
    } else if (replaceableConflicts.length > 0) {
      const { error: archiveError } = await admin
        .from("hai_user_memories")
        .update({ status: "archived" })
        .in("id", replaceableConflicts.map((item) => item.id));
      if (archiveError) {
        console.warn("hai memory conflict archive failed", archiveError.message);
        status = "candidate";
        action = "conflict";
      } else {
        action = "update";
      }
    }

    const { error } = await admin.from("hai_user_memories").insert({
      user_id: userId,
      category: candidate.category,
      content: candidate.content,
      confidence: candidate.confidence,
      source_type: `chat_explicit_v2:${candidate.intent}:${action}`,
      status,
    });
    if (error) console.warn("hai memory insert failed", error.message);
  }
}

export function extractExplicitMemoryCandidates(text: string): ExplicitMemoryCandidate[] {
  const source = text.replace(/\s+/g, " ").trim();
  if (!source || source.length > 3000) return [];
  const instruction = extractExplicitMemoryInstruction(source);
  if (!instruction) return [];

  const payload = instruction.payload;
  const compact = payload.replace(/\s+/g, "");
  const candidates: ExplicitMemoryCandidate[] = [];

  if (instruction.intent === "future_rule") {
    const value = cleanMemoryValue(payload);
    if (!value) return [];
    return [{
      category: "teaching_preference",
      content: `这位老师希望 HAI ${value}。`,
      confidence: 0.98,
      slot: "response_preference",
      intent: instruction.intent,
    }];
  }

  const teaching = compact.match(
    /(?:我(?:现在|目前)?(?:主要)?(?:教|带|任教))([^，。！？；;、\n]{2,40}?)(?:(?:的)?(?:老师|学生|班))?(?=[，。！？；;、\n]|$)/,
  ) ?? compact.match(
    /我是([^，。！？；;、\n]{2,40}?)(?:老师|教师)(?=[，。！？；;、\n]|$)/,
  );
  if (teaching) {
    const value = cleanMemoryValue(teaching[1]);
    if (value) {
      candidates.push({
        category: "basic_info",
        content: `这位老师教${value}。`,
        confidence: 0.98,
        slot: "teaching_assignment",
        intent: instruction.intent,
      });
    }
  }

  const students = payload.match(/我的学生([^。！？；;\n]{4,100})/);
  if (students) {
    const value = cleanMemoryValue(students[1]);
    if (value) {
      candidates.push({
        category: "student_view",
        content: `这位老师的学生${value}。`,
        confidence: 0.98,
        slot: "student_profile",
        intent: instruction.intent,
      });
    }
  }

  const preference = payload.match(/(?:我的偏好是|我希望你|回答时请|给建议时请)([^。！？；;\n]{4,120})/);
  if (preference) {
    const value = cleanMemoryValue(preference[1]);
    if (value) {
      candidates.push({
        category: "teaching_preference",
        content: `这位老师希望 HAI ${value}。`,
        confidence: 0.98,
        slot: "response_preference",
        intent: instruction.intent,
      });
    }
  }

  const constraint = payload.match(/(?:我的限制是|现实限制是|客观限制是|最大的困难是)([^。！？；;\n]{4,120})/);
  if (constraint) {
    const value = cleanMemoryValue(constraint[1]);
    if (value) {
      candidates.push({
        category: "constraint",
        content: `这位老师当前的现实限制是${value}。`,
        confidence: 0.98,
        slot: "teaching_constraint",
        intent: instruction.intent,
      });
    }
  }

  return candidates
    .filter((candidate) => candidate.content.length <= 180)
    .filter((candidate, index, all) => (
      all.findIndex((item) => (
        item.category === candidate.category && item.content === candidate.content
      )) === index
    ))
    .slice(0, 4);
}

function extractExplicitMemoryInstruction(source: string): {
  intent: ExplicitMemoryCandidate["intent"];
  payload: string;
} | null {
  const remember = source.match(
    /(?:^|[。！？；;]\s*)(?:(?:请你?|麻烦你)(?:帮我)?|帮我)?(?:记住|记一下|记下来)(?:这件事|以下内容)?[：:，,\s]*(.+)$/u,
  );
  if (remember?.[1]) {
    const payload = remember[1].trim();
    return payload ? { intent: "remember", payload } : null;
  }

  const futureRule = source.match(
    /(?:^|[。！？；;]\s*)((?:以后|今后)(?=(?:请|都|一律|务必|就|要|不要|别|回答|建议|分析|跟我|和我|按|照))[^。！？\n]{3,240})/u,
  );
  if (futureRule?.[1]) {
    return { intent: "future_rule", payload: futureRule[1].trim() };
  }
  return null;
}

function explicitMemorySlotPrefix(slot: ExplicitMemoryCandidate["slot"]) {
  switch (slot) {
    case "teaching_assignment":
      return "这位老师教";
    case "student_profile":
      return "这位老师的学生";
    case "response_preference":
      return "这位老师希望 HAI ";
    case "teaching_constraint":
      return "这位老师当前的现实限制是";
  }
}

function isAutoExtractedMemory(sourceType: string | null) {
  return sourceType === "chat_explicit" || sourceType?.startsWith("chat_explicit_v2:") === true;
}

function cleanMemoryValue(value: string) {
  return value
    .replace(/^(是|：|:|，|,|\s)+/, "")
    .replace(/[。！？；;，,\s]+$/, "")
    .trim()
    .slice(0, 120);
}
