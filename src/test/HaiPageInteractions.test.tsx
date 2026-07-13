import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmptyState, HAI_STARTER_QUESTIONS, MessageBubble } from "@/pages/HaiPage";
import { copyHaiAnswer, shareHaiExchange } from "@/lib/hai-share";

vi.mock("@/components/layout/Header", () => ({ default: () => null }));
vi.mock("@/components/common/Footer", () => ({ default: () => null }));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/hai-share", () => ({
  copyHaiAnswer: vi.fn(),
  shareHaiExchange: vi.fn(),
}));

describe("HAI new conversation guidance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offers three starter questions and selects one with a single tap", async () => {
    const user = userEvent.setup();
    const onQuestionSelect = vi.fn();
    render(<EmptyState module={null} busy={false} onQuestionSelect={onQuestionSelect} />);

    expect(screen.getAllByRole("button")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: HAI_STARTER_QUESTIONS[1] }));

    expect(onQuestionSelect).toHaveBeenCalledOnce();
    expect(onQuestionSelect).toHaveBeenCalledWith(HAI_STARTER_QUESTIONS[1]);
  });
});

describe("HAI assistant message actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(copyHaiAnswer).mockResolvedValue(undefined);
    vi.mocked(shareHaiExchange).mockResolvedValue("downloaded");
  });

  it("copies the full assistant answer", async () => {
    const user = userEvent.setup();
    render(
      <MessageBubble
        message={{
          id: "assistant-1",
          role: "assistant",
          content: "**先判断目标**，再检查活动。",
          created_at: "2026-07-13T08:00:00.000Z",
        }}
        question="这份教案应该先改哪里？"
      />,
    );

    await user.click(screen.getByRole("button", { name: "复制这条回答" }));

    expect(copyHaiAnswer).toHaveBeenCalledWith("**先判断目标**，再检查活动。");
    expect(screen.getByText("已复制")).toBeInTheDocument();
  });

  it("generates a share image from the paired question and answer", async () => {
    const user = userEvent.setup();
    render(
      <MessageBubble
        message={{
          id: "assistant-2",
          role: "assistant",
          content: "先看目标是否清楚。",
          created_at: "2026-07-13T08:00:00.000Z",
        }}
        question="这份教案应该先改哪里？"
      />,
    );

    await user.click(screen.getByRole("button", { name: "把这轮问答生成分享图" }));

    expect(shareHaiExchange).toHaveBeenCalledWith({
      question: "这份教案应该先改哪里？",
      answer: "先看目标是否清楚。",
    });
  });

  it("hides actions while an answer is still streaming", () => {
    render(
      <MessageBubble
        message={{
          id: "assistant-streaming",
          role: "assistant",
          content: "正在生成的回答",
          created_at: "2026-07-13T08:00:00.000Z",
          pending: true,
        }}
        question="问题"
      />,
    );

    expect(screen.queryByRole("button", { name: "复制这条回答" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "把这轮问答生成分享图" })).not.toBeInTheDocument();
  });
});
