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
  duration_ms: number | null;
  created_at: string;
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
  route_method: string;
  diagnostic_module: string;
  score: number | null;
  passed: boolean | null;
  problems: string[];
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
  };
  daily_usage: HaiDailyUsage[];
  user_rankings: HaiUserRanking[];
  recent_events: Array<HaiUsageEventRow & { profile: HaiProfile | null }>;
  alerts: Array<HaiUsageAlertRow & { profile: HaiProfile | null }>;
  recent_traces: HaiRecentTrace[];
}

const PAGE_SIZE = 1000;
const MAX_EVENT_PAGES = 20;

export async function getAdminHaiDashboard(rangeDays: HaiDashboardRangeDays): Promise<HaiDashboardData> {
  const now = new Date();
  const since = startOfRange(rangeDays, now).toISOString();
  const [events, alertResult, traceResult] = await Promise.all([
    fetchUsageEvents(since),
    supabase
      .from("hai_usage_alerts")
      .select("id, user_id, severity, title, description, route, created_at, profiles!user_id(nickname, phone, access_level)")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("hai_messages")
      .select("id, metadata, created_at")
      .eq("role", "assistant")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  if (alertResult.error) throw alertResult.error;
  if (traceResult.error) throw traceResult.error;

  return buildHaiDashboardData(
    events,
    (alertResult.data as HaiUsageAlertRow[]) ?? [],
    (traceResult.data as HaiTraceMessageRow[]) ?? [],
    rangeDays,
    now,
  );
}

async function fetchUsageEvents(since: string): Promise<HaiUsageEventRow[]> {
  const rows: HaiUsageEventRow[] = [];

  for (let page = 0; page < MAX_EVENT_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("hai_usage_events")
      .select("id, user_id, event_type, route, status, total_tokens, input_tokens, output_tokens, duration_ms, created_at, profiles!user_id(nickname, phone, access_level)")
      .like("event_type", "hai.request.%")
      .in("status", ["completed", "cached", "failed"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    const pageRows = (data as HaiUsageEventRow[]) ?? [];
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) break;
  }

  return rows;
}

export function buildHaiDashboardData(
  events: HaiUsageEventRow[],
  alerts: HaiUsageAlertRow[],
  traceMessages: HaiTraceMessageRow[],
  rangeDays: HaiDashboardRangeDays,
  now = new Date(),
): HaiDashboardData {
  const dailyMap = createDailyBuckets(rangeDays, now);
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
      input_tokens: 0,
      output_tokens: 0,
      average_tokens: 0,
      failed_count: 0,
      last_used_at: event.created_at,
    };
    current.request_count += 1;
    current.total_tokens += tokens;
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
    },
    daily_usage: Array.from(dailyMap.values()).map(({ user_ids, ...day }) => ({
      ...day,
      users: user_ids.size,
    })),
    user_rankings: userRankings,
    recent_events: events.slice(0, 30).map((event) => ({ ...event, profile: profileOf(event.profiles) })),
    alerts: alerts.map((alert) => ({ ...alert, profile: profileOf(alert.profiles) })),
    recent_traces: traces.slice(0, 8),
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
  const trace = recordOf(message.metadata.hai_context_trace);
  if (!trace) return null;
  const intent = recordOf(trace.intent_result);
  const evaluation = recordOf(trace.evaluation_result);
  return {
    id: message.id,
    question: stringOf(trace.question) || "无问题文本",
    intent: stringOf(intent?.primary_intent) || "unknown",
    route_method: stringOf(intent?.route_method) || "-",
    diagnostic_module: stringOf(trace.diagnostic_module) || "-",
    score: numberOf(evaluation?.score),
    passed: typeof evaluation?.pass === "boolean" ? evaluation.pass : null,
    problems: Array.isArray(evaluation?.problems)
      ? evaluation.problems.filter((item): item is string => typeof item === "string")
      : [],
    created_at: message.created_at,
  };
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

function numberOf(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonNegative(value: number | null) {
  return typeof value === "number" && value > 0 ? value : 0;
}

function roundPercent(ratio: number) {
  return Math.round(ratio * 1000) / 10;
}
