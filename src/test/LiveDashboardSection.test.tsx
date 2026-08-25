import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LiveDashboardSection from "@/components/admin/LiveDashboardSection";
import { getAdminLiveSessionDashboard, getAdminLiveSessions } from "@/db/live-api";
import type { AdminLiveSessionDashboard } from "@/lib/live-dashboard";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "admin-1" }, profile: { nickname: "管理员", role: "admin" } }),
}));

vi.mock("@/db/live-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/db/live-api")>();
  return {
    ...actual,
    getAdminLiveSessions: vi.fn(),
    getAdminLiveSessionDashboard: vi.fn(),
  };
});

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

describe("Live large dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminLiveSessions).mockResolvedValue([fixture.session]);
    vi.mocked(getAdminLiveSessionDashboard).mockResolvedValue(fixture);
  });

  it("shows room-level KPIs and per-question detail outside the Live management workspace", async () => {
    render(<LiveDashboardSection />);

    expect(await screen.findByText("教学目标设计直播")).toBeInTheDocument();
    expect(screen.getByText("累计进入")).toBeInTheDocument();
    expect(screen.getByText("参与答题")).toBeInTheDocument();
    expect(screen.getByText("每道题的互动参与")).toBeInTheDocument();
    expect(screen.getByText("逐题互动明细")).toBeInTheDocument();
    expect(screen.getAllByText("哪个目标更可评价？").length).toBeGreaterThan(0);
    expect(screen.getAllByText("A · 了解知识").length).toBeGreaterThan(0);
  });
});

const fixture: AdminLiveSessionDashboard = {
  session: {
    id: "live-1",
    room_code: "123456",
    title: "教学目标设计直播",
    status: "ended",
    current_question_id: "q1",
    question_state: "revealed",
  },
  participantCount: 12,
  answeredParticipantCount: 9,
  totalResponses: 9,
  questionCount: 1,
  overallParticipationRate: 75,
  questions: [{
    question: {
      id: "q1",
      live_id: "live-1",
      position: 1,
      title: "哪个目标更可评价？",
      type: "single_choice",
      content: "请从两个目标中选择",
      options: [{ id: "A", text: "了解知识" }, { id: "B", text: "能解释并运用" }],
      correct_answer: "B",
      audience_mode: "targeted",
      target_user_ids: [],
      target_tags: ["需要支持"],
    },
    answeredCount: 9,
    responseRate: 75,
    targetParticipantCount: 12,
    correctCount: 6,
    correctRate: 66.7,
    options: [
      { id: "A", label: "了解知识", count: 3, percentage: 33.3 },
      { id: "B", label: "能解释并运用", count: 6, percentage: 66.7 },
    ],
  }],
};
