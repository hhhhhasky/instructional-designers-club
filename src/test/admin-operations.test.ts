import { describe, expect, it } from "vitest";
import { buildOperationsMetrics, type OperationsDashboardSource } from "@/db/admin-operations";

describe("operations dashboard metrics", () => {
  it("combines growth, activation, learning and HAI signals", () => {
    const result = buildOperationsMetrics(sourceFixture());

    expect(result).toMatchObject({
      total_members: 100,
      paid_members: 30,
      paid_ratio: 30,
      current_month_growth: 15,
      growth_change: 50,
      activated_members: 70,
      activation_rate: 70,
      zero_record_members: 30,
      learner_touches: 50,
      active_learner_touches: 30,
      completion_rate: 40,
      average_credits: 9,
      hai_adoption_rate: 12,
    });
    expect(result.health_score).toBeGreaterThan(0);
    expect(result.insights.some((item) => item.id === "activation" && item.tone === "watch")).toBe(true);
    expect(result.insights.some((item) => item.id === "course" && item.action_tab === "courses")).toBe(true);
  });

  it("keeps empty datasets stable", () => {
    const source = sourceFixture();
    source.members = { total: 0, distribution: [], monthly_growth: [] };
    source.inactive = { total_members: 0, zero_record_students: [], inactive_counts: [] };
    source.courses = [];
    source.leaderboard = [];
    source.hai.summary.active_users = 0;

    const result = buildOperationsMetrics(source);

    expect(result.activation_rate).toBe(0);
    expect(result.completion_rate).toBe(0);
    expect(result.average_credits).toBe(0);
    expect(result.growth_change).toBeNull();
  });
});

function sourceFixture(): OperationsDashboardSource {
  return {
    members: {
      total: 100,
      distribution: [
        { access_level: "free", count: 70 },
        { access_level: "plus", count: 20 },
        { access_level: "pro", count: 10 },
      ],
      monthly_growth: [
        { month: "2026-06", new_members: 10 },
        { month: "2026-07", new_members: 15 },
      ],
    },
    courses: [
      {
        id: "course-1",
        title: "从目标到评价",
        category: "教学设计",
        level: "entry",
        membership_type: "free",
        view_count: 100,
        total_learners: 30,
        completed_learners: 9,
        active_learners: 20,
        completion_rate: 30,
      },
      {
        id: "course-2",
        title: "课堂提问设计",
        category: "课堂实践",
        level: "entry",
        membership_type: "plus",
        view_count: 80,
        total_learners: 20,
        completed_learners: 11,
        active_learners: 10,
        completion_rate: 55,
      },
    ],
    inactive: {
      total_members: 100,
      zero_record_students: Array.from({ length: 30 }, (_, index) => ({
        id: `member-${index}`,
        nickname: `会员${index}`,
        phone: "13800000000",
        access_level: "free" as const,
        created_at: "2026-07-01T00:00:00.000Z",
      })),
      inactive_counts: [],
    },
    leaderboard: [
      { id: "1", nickname: "甲", phone: "1", access_level: "free", status: "active", created_at: "", total_credits: 8, estimated_watch_minutes: 10, avg_completion_rate: 40 },
      { id: "2", nickname: "乙", phone: "2", access_level: "plus", status: "active", created_at: "", total_credits: 10, estimated_watch_minutes: 20, avg_completion_rate: 60 },
    ],
    hai: {
      range_days: 30,
      summary: {
        request_count: 80,
        active_users: 12,
        total_tokens: 10000,
        input_tokens: 7000,
        output_tokens: 3000,
        average_tokens_per_user: 833,
        average_tokens_per_request: 125,
        success_rate: 98,
        average_duration_ms: 2400,
        quality_average: 85,
        quality_pass_rate: 90,
        open_alerts: 0,
      },
      daily_usage: [],
      user_rankings: [],
      recent_events: [],
      alerts: [],
      recent_traces: [],
    },
    maintenance: {
      published_courses: 20,
      draft_courses: 3,
      active_members: 100,
      banned_members: 2,
      visible_questions: 15,
      pending_resets: 0,
      active_content: 18,
      open_hai_alerts: 0,
    },
  };
}
