import { describe, expect, it } from "vitest";
import {
  buildHaiDashboardData,
  type HaiTraceMessageRow,
  type HaiUsageAlertRow,
  type HaiUsageEventRow,
} from "@/db/hai-analytics";

describe("HAI dashboard aggregation", () => {
  it("summarizes usage and builds a per-user token leaderboard", () => {
    const events: HaiUsageEventRow[] = [
      usageEvent({ id: "event-1", user_id: "user-1", total_tokens: 1000, input_tokens: 700, output_tokens: 300, duration_ms: 1000 }),
      usageEvent({ id: "event-2", user_id: "user-1", status: "failed", total_tokens: 200, input_tokens: 200, output_tokens: 0, duration_ms: 2000 }),
      usageEvent({ id: "event-3", user_id: "user-2", total_tokens: 800, input_tokens: 500, output_tokens: 300, duration_ms: null, profiles: [{ nickname: "李老师", phone: "13900001111", access_level: "plus" }] }),
    ];
    const alerts: HaiUsageAlertRow[] = [{
      id: "alert-1",
      user_id: "user-1",
      severity: "warning",
      title: "周额度接近上限",
      description: "已使用 90%",
      route: "hai-chat",
      created_at: "2026-07-13T10:00:00.000Z",
    }];
    const traces: HaiTraceMessageRow[] = [
      traceMessage("trace-1", 80, true),
      traceMessage("trace-2", 60, false),
    ];

    const result = buildHaiDashboardData(events, alerts, traces, 7, new Date("2026-07-13T12:00:00.000Z"));

    expect(result.summary).toMatchObject({
      request_count: 3,
      active_users: 2,
      total_tokens: 2000,
      input_tokens: 1400,
      output_tokens: 600,
      average_tokens_per_user: 1000,
      average_tokens_per_request: 667,
      success_rate: 66.7,
      average_duration_ms: 1500,
      quality_average: 70,
      quality_pass_rate: 50,
      open_alerts: 1,
    });
    expect(result.user_rankings).toHaveLength(2);
    expect(result.user_rankings[0]).toMatchObject({
      user_id: "user-1",
      request_count: 2,
      total_tokens: 1200,
      average_tokens: 600,
      failed_count: 1,
    });
    expect(result.daily_usage.reduce((sum, day) => sum + day.requests, 0)).toBe(3);
    expect(result.recent_traces[0]).toMatchObject({ score: 80, passed: true, intent: "lesson_design" });
  });

  it("returns stable zero-state metrics when no one has used HAI", () => {
    const result = buildHaiDashboardData([], [], [], 30, new Date("2026-07-13T12:00:00.000Z"));

    expect(result.summary.request_count).toBe(0);
    expect(result.summary.average_tokens_per_user).toBe(0);
    expect(result.summary.quality_average).toBeNull();
    expect(result.daily_usage).toHaveLength(30);
    expect(result.user_rankings).toEqual([]);
  });
});

function usageEvent(overrides: Partial<HaiUsageEventRow>): HaiUsageEventRow {
  return {
    id: "event",
    user_id: "user-1",
    event_type: "hai.request.completed",
    route: "hai-chat",
    status: "completed",
    total_tokens: 0,
    input_tokens: 0,
    output_tokens: 0,
    duration_ms: null,
    created_at: "2026-07-13T10:00:00.000Z",
    profiles: { nickname: "王老师", phone: "13800001111", access_level: "pro" },
    ...overrides,
  };
}

function traceMessage(id: string, score: number, pass: boolean): HaiTraceMessageRow {
  return {
    id,
    created_at: "2026-07-13T10:00:00.000Z",
    metadata: {
      hai_context_trace: {
        question: "公开课应该先改哪里？",
        intent_result: { primary_intent: "lesson_design", route_method: "llm" },
        diagnostic_module: "goal_alignment",
        evaluation_result: { score, pass, problems: pass ? [] : ["建议不够聚焦"] },
      },
    },
  };
}
