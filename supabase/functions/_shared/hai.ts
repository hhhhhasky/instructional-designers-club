import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

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
};

const defaultRuntimeConfig: HaiRuntimeConfig = {
  contextWindowTokens: 1000000,
  contextWarningRemainingRatio: 0.2,
  defaultTemperature: 0.25,
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
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createUserClient(request: Request) {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_ANON_KEY"), {
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
    topP: topP === undefined ? undefined : clamp(topP, 0, 1),
    maxTokens,
    thinkingEnabled: params.module.thinking_enabled === true,
    reasoningEffort,
    responseFormat,
    stopSequences: stopSequences.length > 0 ? stopSequences : undefined,
  };
}

export function runtimeConfigSnapshot(runtime: HaiRuntimeConfig, options: HaiChatCompletionOptions) {
  return {
    model: options.model,
    temperature: options.temperature,
    top_p: options.topP ?? null,
    max_tokens: options.maxTokens,
    thinking_enabled: options.thinkingEnabled,
    reasoning_effort: options.reasoningEffort ?? null,
    response_format: options.responseFormat ?? "text",
    stop_sequences: options.stopSequences ?? [],
    context_window_tokens: runtime.contextWindowTokens,
    context_warning_remaining_ratio: runtime.contextWarningRemainingRatio,
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
  } = {},
) {
  const config = deepSeekConfig();
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

type MemoryCandidate = {
  category: string;
  content: string;
  confidence: number;
};

export async function rememberExplicitTeacherFacts(
  admin: SupabaseClient,
  userId: string,
  text: string,
) {
  const candidates = extractExplicitMemoryCandidates(text);
  if (candidates.length === 0) return;

  for (const candidate of candidates) {
    const { data: existing, error: selectError } = await admin
      .from("hai_user_memories")
      .select("id")
      .eq("user_id", userId)
      .eq("category", candidate.category)
      .eq("content", candidate.content)
      .neq("status", "archived")
      .limit(1)
      .maybeSingle();
    if (selectError) {
      console.warn("hai memory select failed", selectError.message);
      continue;
    }
    if (existing) continue;

    const { error } = await admin.from("hai_user_memories").insert({
      user_id: userId,
      category: candidate.category,
      content: candidate.content,
      confidence: candidate.confidence,
      source_type: "chat_explicit",
      status: "active",
      metadata: { extractor: "regex-v1" },
    });
    if (error) console.warn("hai memory insert failed", error.message);
  }
}

function extractExplicitMemoryCandidates(text: string): MemoryCandidate[] {
  const source = text.replace(/\s+/g, " ").trim();
  if (!source || source.length > 3000) return [];
  const compact = source.replace(/\s+/g, "");
  const candidates: MemoryCandidate[] = [];

  const teaching = compact.match(/(?:我是|我现在|我目前)?(?:教|带|任教)([^，。！？；;、\n]{2,40})(?:的)?(?:老师|学生|班)?/);
  if (teaching) {
    const value = cleanMemoryValue(teaching[1]);
    if (value) {
      candidates.push({
        category: "basic_info",
        content: `这位老师教${value}。`,
        confidence: 0.88,
      });
    }
  }

  const students = source.match(/我的学生([^。！？\n]{4,100})/);
  if (students) {
    const value = cleanMemoryValue(students[1]);
    if (value) {
      candidates.push({
        category: "student_view",
        content: `这位老师的学生${value}。`,
        confidence: 0.82,
      });
    }
  }

  const preference = source.match(/(?:请记住|记住|以后记住|我的偏好是|我希望你)([^。！？\n]{6,120})/);
  if (preference) {
    const value = cleanMemoryValue(preference[1]);
    if (value) {
      candidates.push({
        category: "teaching_preference",
        content: `这位老师希望 HAI ${value}。`,
        confidence: 0.86,
      });
    }
  }

  const constraint = source.match(/(?:我的限制是|现实限制是|现在的问题是|最大的困难是)([^。！？\n]{4,120})/);
  if (constraint) {
    const value = cleanMemoryValue(constraint[1]);
    if (value) {
      candidates.push({
        category: "constraint",
        content: `这位老师当前的现实限制是${value}。`,
        confidence: 0.8,
      });
    }
  }

  return candidates
    .filter((candidate) => candidate.content.length <= 180)
    .slice(0, 4);
}

function cleanMemoryValue(value: string) {
  return value
    .replace(/^(是|：|:|，|,|\s)+/, "")
    .replace(/[。！？；;，,\s]+$/, "")
    .trim()
    .slice(0, 120);
}
