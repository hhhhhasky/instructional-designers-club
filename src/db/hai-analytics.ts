import { supabase } from "./supabase";

export type HaiDashboardRangeDays = 7 | 30 | 90;

interface HaiProfile {
  nickname: string;
  phone: string;
  access_level: string;
}

type HaiProfileRelation = HaiProfile | HaiProfile[] | null;

export interface HaiUsageEventRow {
  id: string;
  user_id: string | null;
  event_type: string;
  route: string;
  status: "completed" | "cached" | "failed";
  total_tokens: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  actual_prompt_tokens?: number | null;
  actual_cache_hit_tokens?: number | null;
  actual_cache_miss_tokens?: number | null;
  actual_completion_tokens?: number | null;
  actual_reasoning_tokens?: number | null;
  actual_visible_output_tokens?: number | null;
  actual_total_tokens?: number | null;
  actual_cost?: number | null;
  actual_currency?: string | null;
  actual_usage_status?: "actual" | "partial" | "missing" | "estimated" | null;
  duration_ms: number | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  profiles?: HaiProfileRelation;
}

export interface HaiModelCallRow {
  id: string;
  user_id: string | null;
  request_id: string;
  call_index: number;
  stage: string;
  route: string;
  model: string;
  provider_request_id: string | null;
  status: "running" | "completed" | "failed";
  started_at: string;
  completed_at: string | null;
  prompt_tokens: number | null;
  cache_hit_tokens: number | null;
  cache_miss_tokens: number | null;
  completion_tokens: number | null;
  reasoning_tokens: number | null;
  visible_output_tokens: number | null;
  total_tokens: number | null;
  usage_status: "provider" | "provider_partial" | "missing";
  price_band: "peak" | "off_peak" | "unknown";
  total_cost: number | null;
  currency: string;
  metadata?: Record<string, unknown>;
  profiles?: HaiProfileRelation;
}

export interface HaiUsageAlertRow {
  id: string;
  user_id: string | null;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  route: string | null;
  created_at: string;
  profiles?: HaiProfileRelation;
}

export interface HaiTraceMessageRow {
  id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface HaiWorkDebugTraceRow {
  id: string;
  task_id: string;
  user_id: string;
  status: "queued" | "running" | "completed" | "failed";
  input_tokens: number | null;
  output_tokens: number | null;
  duration_ms: number | null;
  error_message: string | null;
  skill_snapshot: Record<string, unknown>;
  input_snapshot: Record<string, unknown>;
  debug_trace: Record<string, unknown> | null;
  parent_artifact_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  task_title: string;
  module_slug: string;
  profile: HaiProfile | null;
}

export interface HaiPromptAssemblyModelCall {
  stage: "semantic_router" | "answer_draft" | "answer_rewrite";
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  estimated_input_tokens: number;
}

export interface HaiPromptAssembly {
  captured_at: string;
  final_stage: "answer_draft" | "answer_rewrite";
  model_calls: HaiPromptAssemblyModelCall[];
}

export interface HaiDailyUsage {
  date: string;
  label: string;
  requests: number;
  users: number;
  tokens: number;
  input_tokens: number;
  output_tokens: number;
  failed: number;
}

export interface HaiUserRanking {
  user_id: string;
  nickname: string;
  phone: string;
  access_level: string;
  request_count: number;
  total_tokens: number;
  seven_day_total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  average_tokens: number;
  failed_count: number;
  last_used_at: string;
}

export interface HaiRecentTrace {
  id: string;
  question: string;
  intent: string;
  scene: string;
  user_goal: string;
  support_depth: string;
  route_method: string;
  diagnostic_module: string;
  skill: {
    slug: string;
    name: string;
    version_label: string;
    snapshot_hash: string;
  } | null;
  method_card_ids: string[];
  reference_paths: string[];
  memory_selection: Record<string, unknown>;
  prompt_assembly: HaiPromptAssembly | null;
  score: number | null;
  passed: boolean | null;
  problems: string[];
  created_at: string;
}

export interface HaiDailyReviewRun {
  id: string;
  run_date: string;
  status: "running" | "completed" | "failed" | "skipped";
  turns_evaluated: number;
  average_score: number | null;
  pass_rate: number | null;
  low_score_count: number;
  positive_feedback_count: number;
  negative_feedback_count: number;
  issues_found: Array<Record<string, unknown>>;
  changes_applied: Array<Record<string, unknown>>;
  changes_pending: Array<Record<string, unknown>>;
  publish_mode: "none" | "draft" | "pending" | "gated_auto" | "manual" | "rolled_back";
  baseline_skill_version_id: string | null;
  candidate_skill_version_id: string | null;
  candidate_comparison: Record<string, unknown>;
  note: string | null;
  error_message: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface HaiDashboardData {
  range_days: HaiDashboardRangeDays;
  summary: {
    request_count: number;
    active_users: number;
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    average_tokens_per_user: number;
    average_tokens_per_request: number;
    success_rate: number;
    average_duration_ms: number;
    quality_average: number | null;
    quality_pass_rate: number | null;
    open_alerts: number;
    work_request_count?: number;
    work_success_rate?: number;
    work_revision_count?: number;
    actual_call_count?: number;
    actual_complete_call_count?: number;
    actual_prompt_tokens?: number;
    actual_cache_hit_tokens?: number;
    actual_cache_miss_tokens?: number;
    actual_completion_tokens?: number;
    actual_reasoning_tokens?: number;
    actual_visible_output_tokens?: number;
    actual_total_tokens?: number;
    actual_cost?: number | null;
    actual_currency?: string | null;
    actual_usage_status?: "actual" | "partial" | "missing";
  };
  daily_usage: HaiDailyUsage[];
  user_rankings: HaiUserRanking[];
  recent_events: Array<HaiUsageEventRow & { profile: HaiProfile | null }>;
  alerts: Array<HaiUsageAlertRow & { profile: HaiProfile | null }>;
  recent_traces: HaiRecentTrace[];
  recent_work_traces: HaiWorkDebugTraceRow[];
  daily_reviews: HaiDailyReviewRun[];
  recent_model_calls?: Array<HaiModelCallRow & { profile: HaiProfile | null }>;
}

const PAGE_SIZE = 1000;
const MAX_EVENT_PAGES = 20;
const MAX_TRACE_PAGES = 20;
const MAX_WORK_TRACE_PAGES = 20;
const MAX_MODEL_CALL_PAGES = 20;

export async function getAdminHaiDashboard(rangeDays: HaiDashboardRangeDays): Promise<HaiDashboardData> {
  const now = new Date();
  const since = startOfRange(rangeDays, now).toISOString();
  const [events, modelCalls, alertResult, traceMessages, workTraces, dailyReviews] = await Promise.all([
    fetchUsageEvents(since),
    fetchModelCalls(since),
    supabase
      .from("hai_usage_alerts")
      .select("id, user_id, severity, title, description, route, created_at, profiles!user_id(nickname, phone, access_level)")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50),
    fetchTraceMessages(since),
    fetchWorkDebugTraces(since),
    fetchDailyReviews(),
  ]);

  if (alertResult.error) throw alertResult.error;
  return buildHaiDashboardData(
    events,
    (alertResult.data as HaiUsageAlertRow[]) ?? [],
    traceMessages,
    rangeDays,
    now,
    dailyReviews,
    workTraces,
    modelCalls,
  );
}

async function fetchModelCalls(since: string): Promise<HaiModelCallRow[]> {
  const rows: HaiModelCallRow[] = [];
  for (let page = 0; page < MAX_MODEL_CALL_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await (supabase as any)
      .from("hai_model_calls")
      .select("id, user_id, request_id, call_index, stage, route, model, provider_request_id, status, started_at, completed_at, prompt_tokens, cache_hit_tokens, cache_miss_tokens, completion_tokens, reasoning_tokens, visible_output_tokens, total_tokens, usage_status, price_band, total_cost, currency, metadata, profiles!user_id(nickname, phone, access_level)")
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      // Migration may not yet be applied in a local/admin preview environment.
      console.warn("getAdminHaiDashboard: model-call ledger unavailable, degrading to empty list.", error);
      return [];
    }
    const batch = (data as HaiModelCallRow[]) ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchWorkDebugTraces(since: string): Promise<HaiWorkDebugTraceRow[]> {
  const rows: HaiWorkDebugTraceRow[] = [];
  for (let page = 0; page < MAX_WORK_TRACE_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("hai_work_runs")
      .select("id, task_id, user_id, status, input_tokens, output_tokens, duration_ms, error_message, skill_snapshot, input_snapshot, parent_artifact_id, created_at, started_at, completed_at, profiles!user_id(nickname, phone, access_level), hai_work_tasks!inner(title, module_slug), hai_work_debug_traces(debug_trace)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = ((data ?? []) as unknown[]).map((row) => {
      const item = row as Record<string, unknown>;
      const task = Array.isArray(item.hai_work_tasks) ? item.hai_work_tasks[0] : item.hai_work_tasks;
      const debug = Array.isArray(item.hai_work_debug_traces) ? item.hai_work_debug_traces[0] : item.hai_work_debug_traces;
      return {
        ...item,
        task_title: (task as Record<string, unknown> | null)?.title ?? "未命名任务",
        module_slug: (task as Record<string, unknown> | null)?.module_slug ?? "-",
        profile: profileOf(item.profiles as HaiProfileRelation | undefined),
        skill_snapshot: recordOf(item.skill_snapshot) ?? {},
        input_snapshot: recordOf(item.input_snapshot) ?? {},
        debug_trace: recordOf((debug as Record<string, unknown> | null)?.debug_trace),
      } as HaiWorkDebugTraceRow;
    });
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchTraceMessages(since: string): Promise<HaiTraceMessageRow[]> {
  const rows: HaiTraceMessageRow[] = [];
  for (let page = 0; page < MAX_TRACE_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("hai_messages")
      .select("id, metadata, created_at")
      .eq("role", "assistant")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data as HaiTraceMessageRow[]) ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function triggerHaiDailyReview(runDate?: string) {
  const { data, error } = await supabase.functions.invoke("hai-daily-review", {
    body: { trigger: "admin", force: true, ...(runDate ? { runDate } : {}) },
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

async function fetchUsageEvents(since: string): Promise<HaiUsageEventRow[]> {
  const rows: HaiUsageEventRow[] = [];

  for (let page = 0; page < MAX_EVENT_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const query = supabase
      .from("hai_usage_events")
      .select("id, user_id, event_type, route, status, total_tokens, input_tokens, output_tokens, actual_prompt_tokens, actual_cache_hit_tokens, actual_cache_miss_tokens, actual_completion_tokens, actual_reasoning_tokens, actual_visible_output_tokens, actual_total_tokens, actual_cost, actual_currency, actual_usage_status, duration_ms, metadata, created_at, profiles!user_id(nickname, phone, access_level)")
      .like("event_type", "hai.request.%")
      .in("status", ["completed", "cached", "failed"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    let { data, error } = await query;
    if (error) {
      // Keep the dashboard readable during the short window before the ledger
      // migration is applied; legacy rows simply show estimated usage.
      const fallbackResult = await supabase
        .from("hai_usage_events")
        .select("id, user_id, event_type, route, status, total_tokens, input_tokens, output_tokens, duration_ms, metadata, created_at, profiles!user_id(nickname, phone, access_level)")
        .like("event_type", "hai.request.%")
        .in("status", ["completed", "cached", "failed"])
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      data = fallbackResult.data as typeof data;
      error = fallbackResult.error;
    }
    if (error) throw error;
    const pageRows = (data as HaiUsageEventRow[]) ?? [];
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) break;
  }

  return rows;
}

async function fetchDailyReviews(): Promise<HaiDailyReviewRun[]> {
  const { data, error } = await supabase
    .from("hai_optimization_log")
    .select("id, run_date, status, turns_evaluated, average_score, pass_rate, low_score_count, positive_feedback_count, negative_feedback_count, issues_found, changes_applied, changes_pending, publish_mode, baseline_skill_version_id, candidate_skill_version_id, candidate_comparison, note, error_message, completed_at, created_at")
    .order("run_date", { ascending: false })
    .limit(14);

  if (error) {
    // 容错：daily-review 历史只是看板的辅助面板。远端 schema 可能因待应用迁移
    // 暂时缺少新增列（如 baseline_skill_version_id 等），不应让整张运营数据看板随之崩掉。
    // 失败时降级为空列表，待迁移应用后自动恢复。
    console.warn("getAdminHaiDashboard: daily-review query failed, degrading to empty list.", error);
    return [];
  }

  return (data as HaiDailyReviewRun[]) ?? [];
}

export function buildHaiDashboardData(
  events: HaiUsageEventRow[],
  alerts: HaiUsageAlertRow[],
  traceMessages: HaiTraceMessageRow[],
  rangeDays: HaiDashboardRangeDays,
  now = new Date(),
  dailyReviews: HaiDailyReviewRun[] = [],
  workTraces: HaiWorkDebugTraceRow[] = [],
  modelCalls: HaiModelCallRow[] = [],
): HaiDashboardData {
  const dailyMap = createDailyBuckets(rangeDays, now);
  const sevenDayStart = startOfRange(7, now);
  const rankings = new Map<string, HaiUserRanking>();
  const activeUsers = new Set<string>();
  let totalTokens = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let successCount = 0;
  let totalDuration = 0;
  let durationCount = 0;

  for (const event of events) {
    const tokens = nonNegative(event.total_tokens);
    const input = nonNegative(event.input_tokens);
    const output = nonNegative(event.output_tokens);
    totalTokens += tokens;
    inputTokens += input;
    outputTokens += output;
    if (event.status === "completed" || event.status === "cached") successCount += 1;
    if (typeof event.duration_ms === "number" && event.duration_ms >= 0) {
      totalDuration += event.duration_ms;
      durationCount += 1;
    }

    const day = dailyMap.get(toDateKey(new Date(event.created_at)));
    if (day) {
      day.requests += 1;
      day.tokens += tokens;
      day.input_tokens += input;
      day.output_tokens += output;
      if (event.status === "failed") day.failed += 1;
      if (event.user_id) day.user_ids.add(event.user_id);
    }

    if (!event.user_id) continue;
    activeUsers.add(event.user_id);
    const profile = profileOf(event.profiles);
    const current = rankings.get(event.user_id) ?? {
      user_id: event.user_id,
      nickname: profile?.nickname || "未命名用户",
      phone: profile?.phone || "",
      access_level: profile?.access_level || "-",
      request_count: 0,
      total_tokens: 0,
      seven_day_total_tokens: 0,
      input_tokens: 0,
      output_tokens: 0,
      average_tokens: 0,
      failed_count: 0,
      last_used_at: event.created_at,
    };
    current.request_count += 1;
    current.total_tokens += tokens;
    if (new Date(event.created_at) >= sevenDayStart) current.seven_day_total_tokens += tokens;
    current.input_tokens += input;
    current.output_tokens += output;
    if (event.status === "failed") current.failed_count += 1;
    if (event.created_at > current.last_used_at) current.last_used_at = event.created_at;
    rankings.set(event.user_id, current);
  }

  const userRankings = Array.from(rankings.values())
    .map((item) => ({
      ...item,
      average_tokens: item.request_count > 0 ? Math.round(item.total_tokens / item.request_count) : 0,
    }))
    .sort((a, b) => b.total_tokens - a.total_tokens || b.request_count - a.request_count);

  const traces = traceMessages
    .map(toTrace)
    .filter((item): item is HaiRecentTrace => item !== null);
  const scoredTraces = traces.filter((item): item is HaiRecentTrace & { score: number } => typeof item.score === "number");
  const passedScoredTraces = scoredTraces.filter((item) => item.passed === true);
  const workEvents = events.filter((event) => event.route === "hai-work");
  const workCompleted = workEvents.filter((event) => event.status === "completed" || event.status === "cached");
  const workRevisions = workCompleted.filter((event) => event.metadata?.revision === true);
  const actualCalls = modelCalls.filter((call) => call.usage_status === "provider" || call.usage_status === "provider_partial");
  const completeActualCalls = modelCalls.filter((call) => call.usage_status === "provider");
  const actualCostValues = actualCalls.map((call) => call.total_cost).filter((value): value is number => typeof value === "number");
  const actualCost = actualCostValues.length > 0 ? actualCostValues.reduce((sum, value) => sum + value, 0) : null;
  const actualUsageStatus = actualCalls.length === 0
    ? "missing"
    : completeActualCalls.length === actualCalls.length
    ? "actual"
    : "partial";

  return {
    range_days: rangeDays,
    summary: {
      request_count: events.length,
      active_users: activeUsers.size,
      total_tokens: totalTokens,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      average_tokens_per_user: activeUsers.size > 0 ? Math.round(totalTokens / activeUsers.size) : 0,
      average_tokens_per_request: events.length > 0 ? Math.round(totalTokens / events.length) : 0,
      success_rate: events.length > 0 ? roundPercent(successCount / events.length) : 0,
      average_duration_ms: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
      quality_average: scoredTraces.length > 0
        ? Math.round(scoredTraces.reduce((sum, item) => sum + item.score, 0) / scoredTraces.length)
        : null,
      quality_pass_rate: scoredTraces.length > 0 ? roundPercent(passedScoredTraces.length / scoredTraces.length) : null,
      open_alerts: alerts.length,
      work_request_count: workEvents.length,
      work_success_rate: workEvents.length > 0 ? roundPercent(workCompleted.length / workEvents.length) : 0,
      work_revision_count: workRevisions.length,
      actual_call_count: actualCalls.length,
      actual_complete_call_count: completeActualCalls.length,
      actual_prompt_tokens: actualCalls.reduce((sum, item) => sum + nonNegative(item.prompt_tokens), 0),
      actual_cache_hit_tokens: actualCalls.reduce((sum, item) => sum + nonNegative(item.cache_hit_tokens), 0),
      actual_cache_miss_tokens: actualCalls.reduce((sum, item) => sum + nonNegative(item.cache_miss_tokens), 0),
      actual_completion_tokens: actualCalls.reduce((sum, item) => sum + nonNegative(item.completion_tokens), 0),
      actual_reasoning_tokens: actualCalls.reduce((sum, item) => sum + nonNegative(item.reasoning_tokens), 0),
      actual_visible_output_tokens: actualCalls.reduce((sum, item) => sum + nonNegative(item.visible_output_tokens), 0),
      actual_total_tokens: actualCalls.reduce((sum, item) => sum + nonNegative(item.total_tokens), 0),
      actual_cost: actualCost,
      actual_currency: actualCalls.find((item) => item.currency)?.currency ?? null,
      actual_usage_status: actualUsageStatus,
    },
    daily_usage: Array.from(dailyMap.values()).map(({ user_ids, ...day }) => ({
      ...day,
      users: user_ids.size,
    })),
    user_rankings: userRankings,
    recent_events: events.slice(0, 30).map((event) => ({ ...event, profile: profileOf(event.profiles) })),
    alerts: alerts.map((alert) => ({ ...alert, profile: profileOf(alert.profiles) })),
    recent_traces: traces,
    recent_work_traces: workTraces,
    daily_reviews: dailyReviews,
    recent_model_calls: modelCalls.slice(0, 100).map((call) => ({ ...call, profile: profileOf(call.profiles) })),
  };
}

function createDailyBuckets(rangeDays: HaiDashboardRangeDays, now: Date) {
  const buckets = new Map<string, Omit<HaiDailyUsage, "users"> & { user_ids: Set<string> }>();
  const start = startOfRange(rangeDays, now);
  for (let index = 0; index < rangeDays; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = toDateKey(date);
    buckets.set(key, {
      date: key,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      requests: 0,
      tokens: 0,
      input_tokens: 0,
      output_tokens: 0,
      failed: 0,
      user_ids: new Set(),
    });
  }
  return buckets;
}

function startOfRange(rangeDays: HaiDashboardRangeDays, now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - rangeDays + 1);
  return start;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTrace(message: HaiTraceMessageRow): HaiRecentTrace | null {
  const trace = normalizedTraceOf(message.metadata);
  if (!trace) return null;
  const intent = trace.intent;
  const evaluation = trace.evaluation;
  return {
    id: message.id,
    question: trace.question || "无问题文本",
    intent: stringOf(intent?.primary_intent) || "unknown",
    scene: stringOf(intent?.scene) || "unclear",
    user_goal: stringOf(intent?.user_goal) || "unclear",
    support_depth: stringOf(intent?.support_depth) || "advice",
    route_method: stringOf(intent?.route_method) || "-",
    diagnostic_module: trace.diagnosticModule || "-",
    skill: trace.skill,
    method_card_ids: trace.methodCardIds,
    reference_paths: trace.referencePaths,
    memory_selection: trace.memorySelection,
    prompt_assembly: trace.promptAssembly,
    score: numberOf(evaluation?.score),
    passed: typeof evaluation?.pass === "boolean" ? evaluation.pass : null,
    problems: Array.isArray(evaluation?.problems)
      ? evaluation.problems.filter((item): item is string => typeof item === "string")
      : [],
    created_at: message.created_at,
  };
}

function normalizedTraceOf(metadata: Record<string, unknown>) {
  const current = recordOf(metadata.hai_trace);
  if (current) {
    return {
      question: stringOf(current.question),
      intent: recordOf(current.intent_result),
      evaluation: recordOf(current.evaluation_result),
      diagnosticModule: stringOf(current.diagnostic_module),
      skill: skillSummaryOf(current.skill),
      methodCardIds: stringArray(current.method_card_ids),
      referencePaths: arrayOfRecords(current.references).map((item) => stringOf(item.path)).filter(Boolean),
      memorySelection: recordOf(current.memory_selection) ?? {},
      promptAssembly: normalizePromptAssembly(current.prompt_assembly),
    };
  }
  const legacySkill = recordOf(metadata.hai_skill_trace);
  if (legacySkill) {
    return {
      question: stringOf(legacySkill.question),
      intent: recordOf(legacySkill.intent_result),
      evaluation: recordOf(legacySkill.evaluation_result),
      diagnosticModule: stringOf(legacySkill.diagnostic_module),
      skill: null,
      methodCardIds: stringArray(legacySkill.method_card_ids),
      referencePaths: stringArray(legacySkill.reference_paths),
      memorySelection: { loaded: legacySkill.memory_loaded === true },
      promptAssembly: null,
    };
  }
  const legacyContext = recordOf(metadata.hai_context_trace);
  if (!legacyContext) return null;
  return {
    question: stringOf(legacyContext.question),
    intent: recordOf(legacyContext.intent_result),
    evaluation: recordOf(legacyContext.evaluation_result),
    diagnosticModule: stringOf(legacyContext.diagnostic_module),
    skill: null,
    methodCardIds: stringArray(legacyContext.methodology_ids ?? legacyContext.method_card_ids),
    referencePaths: stringArray(legacyContext.reference_paths),
    memorySelection: recordOf(legacyContext.memory_selection) ?? {},
    promptAssembly: null,
  };
}

function skillSummaryOf(value: unknown): HaiRecentTrace["skill"] {
  const skill = recordOf(value);
  const version = recordOf(skill?.version);
  if (!skill) return null;
  return {
    slug: stringOf(skill.slug),
    name: stringOf(skill.name),
    version_label: stringOf(version?.label),
    snapshot_hash: stringOf(version?.snapshot_hash),
  };
}

function normalizePromptAssembly(value: unknown): HaiPromptAssembly | null {
  const record = recordOf(value);
  if (!record || typeof record.captured_at !== "string") return null;
  const finalStage = record.final_stage === "answer_rewrite"
    ? "answer_rewrite"
    : record.final_stage === "answer_draft"
    ? "answer_draft"
    : null;
  if (!finalStage || !Array.isArray(record.model_calls)) return null;
  const modelCalls = record.model_calls.map((item) => {
    const call = recordOf(item);
    if (!call || (call.stage !== "semantic_router" && call.stage !== "answer_draft" && call.stage !== "answer_rewrite")) return null;
    if (typeof call.estimated_input_tokens !== "number" || !Array.isArray(call.messages)) return null;
    const messages = call.messages.map((message) => {
      const row = recordOf(message);
      if (!row || (row.role !== "system" && row.role !== "user" && row.role !== "assistant") || typeof row.content !== "string") return null;
      return { role: row.role, content: row.content };
    }).filter((message): message is HaiPromptAssemblyModelCall["messages"][number] => message !== null);
    return { stage: call.stage, messages, estimated_input_tokens: call.estimated_input_tokens };
  }).filter((call): call is HaiPromptAssemblyModelCall => call !== null);
  return { captured_at: record.captured_at, final_stage: finalStage, model_calls: modelCalls };
}

function profileOf(value: HaiProfileRelation | undefined): HaiProfile | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function arrayOfRecords(value: unknown) {
  return Array.isArray(value)
    ? value.map(recordOf).filter((item): item is Record<string, unknown> => item !== null)
    : [];
}

function numberOf(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonNegative(value: number | null) {
  return typeof value === "number" && value > 0 ? value : 0;
}

function roundPercent(ratio: number) {
  return Math.round(ratio * 1000) / 10;
}
