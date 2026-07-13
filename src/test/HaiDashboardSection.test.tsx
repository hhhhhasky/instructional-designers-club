import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HaiDashboardSection from "@/components/admin/HaiDashboardSection";
import { getAdminHaiDashboard, type HaiDashboardData } from "@/db/hai-analytics";

vi.mock("@/db/hai-analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/db/hai-analytics")>();
  return { ...actual, getAdminHaiDashboard: vi.fn() };
});

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ComposedChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
  Line: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

describe("HAI dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminHaiDashboard).mockResolvedValue(dashboardFixture);
  });

  it("shows usage metrics and the per-user token leaderboard", async () => {
    render(<HaiDashboardSection />);

    expect(await screen.findByText("每一次调用，都能看见")).toBeInTheDocument();
    expect(screen.getAllByText("使用次数").length).toBeGreaterThan(0);
    expect(screen.getByText("使用人数")).toBeInTheDocument();
    expect(screen.getByText("单用户 Token 消耗排行榜")).toBeInTheDocument();
    expect(screen.getAllByText("王老师").length).toBeGreaterThan(0);
    expect(screen.getByText("12,000")).toBeInTheDocument();
  });

  it("reloads the dashboard when the time range changes", async () => {
    const user = userEvent.setup();
    render(<HaiDashboardSection />);
    await screen.findByText("每一次调用，都能看见");

    await user.click(screen.getByRole("button", { name: "近 7 天" }));

    await waitFor(() => expect(getAdminHaiDashboard).toHaveBeenLastCalledWith(7));
  });
});

const dashboardFixture: HaiDashboardData = {
  range_days: 30,
  summary: {
    request_count: 18,
    active_users: 3,
    total_tokens: 24000,
    input_tokens: 16000,
    output_tokens: 8000,
    average_tokens_per_user: 8000,
    average_tokens_per_request: 1333,
    success_rate: 94.4,
    average_duration_ms: 3200,
    quality_average: 84,
    quality_pass_rate: 88.9,
    open_alerts: 0,
  },
  daily_usage: [{ date: "2026-07-13", label: "7/13", requests: 18, users: 3, tokens: 24000, input_tokens: 16000, output_tokens: 8000, failed: 1 }],
  user_rankings: [{
    user_id: "user-1",
    nickname: "王老师",
    phone: "13800001111",
    access_level: "pro",
    request_count: 10,
    total_tokens: 12000,
    input_tokens: 8000,
    output_tokens: 4000,
    average_tokens: 1200,
    failed_count: 0,
    last_used_at: "2026-07-13T10:00:00.000Z",
  }],
  recent_events: [{
    id: "event-1",
    user_id: "user-1",
    event_type: "hai.request.completed",
    route: "hai-chat",
    status: "completed",
    total_tokens: 1200,
    input_tokens: 800,
    output_tokens: 400,
    duration_ms: 3200,
    created_at: "2026-07-13T10:00:00.000Z",
    profile: { nickname: "王老师", phone: "13800001111", access_level: "pro" },
  }],
  alerts: [],
  recent_traces: [{
    id: "trace-1",
    question: "公开课应该先改哪里？",
    intent: "lesson_design",
    route_method: "llm",
    diagnostic_module: "goal_alignment",
    score: 84,
    passed: true,
    problems: [],
    created_at: "2026-07-13T10:00:00.000Z",
  }],
};
