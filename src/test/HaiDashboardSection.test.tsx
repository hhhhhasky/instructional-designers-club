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
    expect(screen.getByRole("columnheader", { name: "7 天累计总量" })).toBeInTheDocument();
    expect(screen.getByText("9,000")).toBeInTheDocument();
    expect(screen.getByText("积分钱包列表")).toBeInTheDocument();
    expect(screen.getByText("积分老师")).toBeInTheDocument();
    expect(screen.getByText("已消耗 8")).toBeInTheDocument();
  });

  it("reloads the dashboard when the time range changes", async () => {
    const user = userEvent.setup();
    render(<HaiDashboardSection />);
    await screen.findByText("每一次调用，都能看见");

    await user.click(screen.getByRole("button", { name: "近 7 天" }));

    await waitFor(() => expect(getAdminHaiDashboard).toHaveBeenLastCalledWith(7));
  });

  it("sorts the selected time range automatically by the chosen ranking field", async () => {
    const user = userEvent.setup();
    render(<HaiDashboardSection />);
    await screen.findByText("每一次调用，都能看见");

    const rankingRows = screen.getByTestId("hai-user-ranking-rows");
    expect(rankingRows.querySelectorAll("tr")[0]).toHaveTextContent("王老师");

    await user.selectOptions(screen.getByLabelText("排行榜排序方式"), "requests");

    expect(rankingRows.querySelectorAll("tr")[0]).toHaveTextContent("陈老师");
    expect(screen.getByText("当前统计周期：近 30 天")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Token 总量（近 30 天）" })).toBeInTheDocument();
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
    work_request_count: 0,
    work_success_rate: 0,
    work_revision_count: 0,
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
    seven_day_total_tokens: 9000,
    average_tokens: 1200,
    failed_count: 0,
    last_used_at: "2026-07-13T10:00:00.000Z",
  }, {
    user_id: "user-2",
    nickname: "陈老师",
    phone: "13900002222",
    access_level: "plus",
    request_count: 20,
    total_tokens: 6000,
    input_tokens: 4000,
    output_tokens: 2000,
    seven_day_total_tokens: 5000,
    average_tokens: 300,
    failed_count: 1,
    last_used_at: "2026-07-13T09:00:00.000Z",
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
    intent: "showcase_lesson_diagnosis",
    scene: "public_lesson",
    user_goal: "diagnosis",
    support_depth: "advice",
    route_method: "llm",
    diagnostic_module: "showcase_lesson_diagnosis",
    skill: {
      slug: "hai-consultation",
      name: "哈老师教学决策咨询",
      version_label: "v12",
      snapshot_hash: "hash-12",
    },
    method_card_ids: ["design-logic-chain"],
    reference_paths: ["references/decision-rules.md"],
    memory_selection: { should_load_memory: true, loaded: true },
    prompt_assembly: {
      captured_at: "2026-07-13T10:00:01.000Z",
      final_stage: "answer_draft",
      model_calls: [{
        stage: "answer_draft",
        estimated_input_tokens: 100,
        messages: [{ role: "system", content: "完整运行时提示词" }],
      }],
    },
    score: 84,
    passed: true,
    problems: [],
    created_at: "2026-07-13T10:00:00.000Z",
  }],
  recent_work_traces: [],
  daily_reviews: [],
  point_wallets: [{
    user_id: "wallet-user-1",
    balance_tokens: 12000,
    total_credited_tokens: 20000,
    total_consumed_tokens: 8000,
    updated_at: "2026-07-13T11:00:00.000Z",
    profile: { nickname: "积分老师", phone: "13700003333", access_level: "plus" },
  }],
  tokens_per_point: 1000,
};
