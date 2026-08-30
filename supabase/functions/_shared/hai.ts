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

export type HaiProviderUsage = {
  promptTokens: number | null;
  cacheHitTokens: number | null;
  cacheMissTokens: number | null;
  completionTokens: number | null;
  reasoningTokens: number | null;
  visibleOutputTokens: number | null;
  totalTokens: number | null;
  providerRequestId?: string | null;
};

export type HaiModelCallStage =
  | "chat_starter_questions"
  | "chat_draft"
  | "chat_rewrite"
  | "work_initial"
  | "work_repair"
  | "roundtable";

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

type HaiPricingRow = {
  provider: string;
  model_name: string;
  effective_from: string;
  effective_to: string | null;
  timezone: string;
  peak_cache_hit_input_per_million: number | string;
  peak_cache_miss_input_per_million: number | string;
  peak_output_per_million: number | string;
  off_peak_cache_hit_input_per_million: number | string;
  off_peak_cache_miss_input_per_million: number | string;
  off_peak_output_per_million: number | string;
  currency: string;
  metadata?: Record<string, unknown>;
};

function inferProviderCode(baseUrl: string, explicit?: string | null) {
  const value = explicit?.trim().toLowerCase();
  if (value) return value;
  const url = baseUrl.toLowerCase();
  if (url.includes("deepseek")) return "deepseek";
  if (url.includes("bigmodel") || url.includes("z.ai")) return "zhipu";
  return "openai_compatible";
}

function isDeepSeekPeak(at: Date, timezone = "Asia/Shanghai") {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(at);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const totalMinutes = hour * 60 + minute;
  return day >= 1 && day <= 5 && (
    (totalMinutes >= 9 * 60 && totalMinutes < 12 * 60) ||
    (totalMinutes >= 14 * 60 && totalMinutes < 18 * 60)
  );
}

function money(value: number | null) {
  return value == null ? null : value.toFixed(8);
}

export function normalizeProviderUsage(value: unknown, providerRequestId?: string | null): HaiProviderUsage | null {
  const record = normalizeRecord(value);
  if (Object.keys(record).length === 0) return null;
  const details = normalizeRecord(record.completion_tokens_details);
  const promptDetails = normalizeRecord(record.prompt_tokens_details);
  const promptTokens = Number.isFinite(Number(record.prompt_tokens)) ? Number(record.prompt_tokens) : null;
  const cachedRaw = record.prompt_cache_hit_tokens ?? promptDetails.cached_tokens;
  const cacheHitTokens = Number.isFinite(Number(cachedRaw))
    ? Number(cachedRaw)
    : null;
  const cacheMissRaw = record.prompt_cache_miss_tokens ?? (
    promptTokens != null && cacheHitTokens != null ? Math.max(0, promptTokens - cacheHitTokens) : null
  );
  const cacheMissTokens = Number.isFinite(Number(cacheMissRaw))
    ? Number(cacheMissRaw)
    : null;
  const completionTokens = Number.isFinite(Number(record.completion_tokens))
    ? Number(record.completion_tokens)
    : null;
  const reasoningTokens = Number.isFinite(Number(details.reasoning_tokens))
    ? Number(details.reasoning_tokens)
    : null;
  const totalTokens = Number.isFinite(Number(record.total_tokens)) ? Number(record.total_tokens) : null;
  return {
    promptTokens,
    cacheHitTokens,
    cacheMissTokens,
    completionTokens,
    reasoningTokens,
    visibleOutputTokens: completionTokens == null || reasoningTokens == null
      ? null
      : Math.max(0, completionTokens - reasoningTokens),
    totalTokens,
    providerRequestId: providerRequestId ?? null,
  };
}

async function loadHaiPricing(
  admin: SupabaseClient,
  provider: string,
  model: string,
  at: Date,
): Promise<HaiPricingRow | null> {
  const { data, error } = await admin
    .from("hai_model_pricing")
    .select("provider, model_name, effective_from, effective_to, timezone, peak_cache_hit_input_per_million, peak_cache_miss_input_per_million, peak_output_per_million, off_peak_cache_hit_input_per_million, off_peak_cache_miss_input_per_million, off_peak_output_per_million, currency, metadata")
    .eq("provider", provider)
    .ilike("model_name", model)
    .eq("enabled", true)
    .order("effective_from", { ascending: false });
  if (error) {
    console.warn("hai pricing lookup failed", error.message);
    return null;
  }
  return ((data ?? []) as HaiPricingRow[]).find((row) => {
    const from = new Date(row.effective_from).getTime();
    const to = row.effective_to ? new Date(row.effective_to).getTime() : Number.POSITIVE_INFINITY;
    const timestamp = at.getTime();
    return from <= timestamp && timestamp < to;
  }) ?? null;
}

export async function recordHaiModelCall(params: {
  admin: SupabaseClient;
  userId: string;
  requestId: string;
  callIndex: number;
  stage: HaiModelCallStage;
  route: string;
  entityType?: string | null;
  entityId?: string | null;
  model: string;
  provider?: string | null;
  modelProviderId?: string | null;
  startedAt: Date;
  completedAt?: Date | null;
  status?: "running" | "completed" | "failed";
  usage: HaiProviderUsage | null;
  metadata?: Record<string, unknown>;
}) {
  const provider = inferProviderCode(params.provider ?? "deepseek");
  const pricing = await loadHaiPricing(params.admin, provider, params.model, params.startedAt);
  const peak = pricing ? isDeepSeekPeak(params.startedAt, pricing.timezone) : false;
  const priceBand = pricing ? (peak ? "peak" : "off_peak") : "unknown";
  const hitRate = pricing
    ? Number(peak ? pricing.peak_cache_hit_input_per_million : pricing.off_peak_cache_hit_input_per_million)
    : null;
  const missRate = pricing
    ? Number(peak ? pricing.peak_cache_miss_input_per_million : pricing.off_peak_cache_miss_input_per_million)
    : null;
  const outputRate = pricing
    ? Number(peak ? pricing.peak_output_per_million : pricing.off_peak_output_per_million)
    : null;
  const usage = params.usage;
  const usageStatus = usage == null
    ? "missing"
    : usage.promptTokens != null && usage.cacheHitTokens != null && usage.cacheMissTokens != null &&
        usage.completionTokens != null && usage.totalTokens != null
      ? "provider"
      : "provider_partial";
  const cacheHitCost = usage?.cacheHitTokens != null && hitRate != null
    ? usage.cacheHitTokens / 1_000_000 * hitRate
    : null;
  const cacheMissCost = usage?.cacheMissTokens != null && missRate != null
    ? usage.cacheMissTokens / 1_000_000 * missRate
    : null;
  const outputCost = usage?.completionTokens != null && outputRate != null
    ? usage.completionTokens / 1_000_000 * outputRate
    : null;
  const totalCost = cacheHitCost != null && cacheMissCost != null && outputCost != null
    ? cacheHitCost + cacheMissCost + outputCost
    : null;
  const { error } = await params.admin.from("hai_model_calls").upsert({
    user_id: params.userId,
    request_id: params.requestId,
    call_index: params.callIndex,
    stage: params.stage,
    route: params.route,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    provider,
    model: params.model,
    provider_request_id: usage?.providerRequestId ?? null,
    status: params.status ?? "completed",
    started_at: params.startedAt.toISOString(),
    completed_at: (params.completedAt ?? new Date()).toISOString(),
    prompt_tokens: usage?.promptTokens ?? null,
    cache_hit_tokens: usage?.cacheHitTokens ?? null,
    cache_miss_tokens: usage?.cacheMissTokens ?? null,
    completion_tokens: usage?.completionTokens ?? null,
    reasoning_tokens: usage?.reasoningTokens ?? null,
    visible_output_tokens: usage?.visibleOutputTokens ?? null,
    total_tokens: usage?.totalTokens ?? null,
    usage_status: usageStatus,
    price_band: priceBand,
    price_snapshot: pricing ? {
      provider: pricing.provider,
      model: pricing.model_name,
      effective_from: pricing.effective_from,
      timezone: pricing.timezone,
      cache_hit_input_per_million: hitRate,
      cache_miss_input_per_million: missRate,
      output_per_million: outputRate,
      ...(pricing.metadata ?? {}),
    } : {},
    cache_hit_cost: money(cacheHitCost),
    cache_miss_cost: money(cacheMissCost),
    output_cost: money(outputCost),
    total_cost: money(totalCost),
    currency: pricing?.currency ?? "CNY",
    metadata: params.metadata ?? {},
  }, { onConflict: "request_id,call_index" });
  if (error) console.warn("hai model call ledger write failed", error.message);
}

export async function summarizeHaiModelCalls(params: {
  admin: SupabaseClient;
  requestId: string;
}) {
  const { data, error } = await params.admin
    .from("hai_model_calls")
    .select("prompt_tokens, cache_hit_tokens, cache_miss_tokens, completion_tokens, reasoning_tokens, visible_output_tokens, total_tokens, total_cost, usage_status, currency")
    .eq("request_id", params.requestId)
    .order("call_index");
  if (error) {
    console.warn("hai model call ledger summary failed", error.message);
    return null;
  }
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return null;
  const sum = (key: string) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  const allProvider = rows.every((row) => row.usage_status === "provider");
  const anyProvider = rows.some((row) => row.usage_status === "provider" || row.usage_status === "provider_partial");
  const summary = {
    promptTokens: sum("prompt_tokens"),
    cacheHitTokens: sum("cache_hit_tokens"),
    cacheMissTokens: sum("cache_miss_tokens"),
    completionTokens: sum("completion_tokens"),
    reasoningTokens: sum("reasoning_tokens"),
    visibleOutputTokens: sum("visible_output_tokens"),
    totalTokens: sum("total_tokens"),
    totalCost: rows.every((row) => row.total_cost !== null && row.total_cost !== undefined)
      ? rows.reduce((total, row) => total + (Number(row.total_cost) || 0), 0)
      : null,
    currency: String(rows.find((row) => row.currency)?.currency ?? "CNY"),
    usageStatus: allProvider ? "actual" : anyProvider ? "partial" : "missing",
  };
  const { error: updateError } = await params.admin
    .from("hai_usage_events")
    .update({
      actual_prompt_tokens: summary.promptTokens,
      actual_cache_hit_tokens: summary.cacheHitTokens,
      actual_cache_miss_tokens: summary.cacheMissTokens,
      actual_completion_tokens: summary.completionTokens,
      actual_reasoning_tokens: summary.reasoningTokens,
      actual_visible_output_tokens: summary.visibleOutputTokens,
      actual_total_tokens: summary.totalTokens,
      actual_cost: summary.totalCost === null ? null : summary.totalCost.toFixed(8),
      actual_currency: summary.currency,
      actual_usage_status: summary.usageStatus,
    })
    .eq("request_id", params.requestId)
    .neq("status", "started");
  if (updateError) console.warn("hai usage event actual usage update failed", updateError.message);
  return summary;
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
  const rawMax = Math.round(finiteNumber(params.module.default_max_output_tokens) ?? 4096);
  // reasoning 模型 (如 deepseek-v4-pro) thinking 会消耗大量 token，
  // 4096 不够用会导致思考吃光 budget、模型不产出 content。
  const thinkingFloor = params.module.thinking_enabled === true ? 16384 : 1;
  const maxTokens = Math.max(rawMax, thinkingFloor);
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
    providerCode: "deepseek",
  };
}

type ProviderConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  providerCode: string;
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
      providerCode: "deepseek",
    };
  }

  const { data, error } = await admin
    .from("hai_model_providers")
    .select("label, model_name, api_key, base_url, is_enabled, provider_code")
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
      providerCode: "deepseek",
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
    providerCode: inferProviderCode(data.base_url, data.provider_code),
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
    onUsage?: (usage: HaiProviderUsage) => void | Promise<void>;
    onProviderResolved?: (providerCode: string) => void;
  } = {},
) {
  const config = options.admin
    ? await resolveProviderConfig(options.admin, options.modelProviderId, options.model)
    : deepSeekConfig();
  if (!config.apiKey) throw new HttpError(503, "AI 服务未配置 DeepSeek API Key。");
  options.onProviderResolved?.(config.providerCode);

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
      stream_options: { include_usage: true },
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
      let data;
      try { data = JSON.parse(payload); } catch { continue; }
      const providerUsage = normalizeProviderUsage(data?.usage, data?.id);
      if (providerUsage && options.onUsage) await options.onUsage(providerUsage);
      const delta = data?.choices?.[0]?.delta;
      if (!delta) continue;
      // reasoning_content 是思考过程，不混入输出流（否则会污染 JSON 解析）
      if (delta.content) yield String(delta.content as string);
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
