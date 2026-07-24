import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getHaiChatModule,
  getHaiMemories,
  hasCompletedHaiProfileOnboarding,
  saveHaiProfileMemories,
} from "@/db/hai-api";
import { copyHaiAnswer, createHaiShareImage } from "@/lib/hai-share";
import HaiPage, { EmptyState, HAI_STARTER_QUESTIONS, MessageBubble } from "@/pages/HaiPage";

vi.mock("@/components/layout/Header", () => ({ default: () => <div data-testid="global-header" /> }));
vi.mock("@/components/common/Footer", () => ({ default: () => <div data-testid="global-footer" /> }));
vi.mock("@/components/common/PageMeta", () => ({ default: () => null }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}));

vi.mock("@/db/hai-api", () => ({
  archiveHaiConversation: vi.fn(),
  archiveHaiMemory: vi.fn(),
  createHaiMemory: vi.fn(),
  getHaiAccessStatus: vi.fn().mockResolvedValue({
    access: { authenticated: true, allowed: true },
    usage: { daily_used: 0, weekly_used: 0, daily_limit: 1000, weekly_limit: 5000 },
  }),
  getHaiConversations: vi.fn().mockResolvedValue([]),
  getHaiMemories: vi.fn().mockResolvedValue([]),
  getHaiMessages: vi.fn().mockResolvedValue([]),
  getHaiMessageFeedback: vi.fn().mockResolvedValue([]),
  getHaiChatModule: vi.fn().mockResolvedValue({
    id: "module-1",
    slug: "hai-chat",
    name: "HAI Chat",
    short_label: "HAI Chat",
    description: "从教学目标和学习证据出发诊断你的备课问题。",
    icon_key: "bot",
    category: "chat",
    input_schema: [],
    default_model: "test-model",
    default_temperature: 0.5,
    default_max_output_tokens: 1000,
    thinking_enabled: false,
    default_top_p: null,
    reasoning_effort: "high",
    response_format: "text",
    stop_sequences: [],
    history_message_limit: 20,
    memory_limit: 8,
    material_match_count: 0,
    knowledge_match_count: 5,
    sort_order: 1,
    is_enabled: true,
  }),
  hasCompletedHaiProfileOnboarding: vi.fn().mockResolvedValue(true),
  redeemHaiInvite: vi.fn(),
  saveHaiProfileMemories: vi.fn().mockResolvedValue([]),
  setHaiMessageFeedback: vi.fn(),
  streamHaiChat: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/hai-share", () => ({
  copyHaiAnswer: vi.fn(),
  createHaiShareImage: vi.fn(),
}));

describe("HAI new conversation guidance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getHaiMemories).mockResolvedValue([]);
    vi.mocked(hasCompletedHaiProfileOnboarding).mockResolvedValue(true);
    vi.mocked(saveHaiProfileMemories).mockResolvedValue([]);
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

describe("HAI first-entry profile onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getHaiMemories).mockResolvedValue([]);
    vi.mocked(hasCompletedHaiProfileOnboarding).mockResolvedValue(false);
    vi.mocked(saveHaiProfileMemories).mockResolvedValue([]);
  });

  it("collects a university teacher profile with click-first questions and saves it as memories", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/hai"]}>
        <HaiPage />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("hai-profile-onboarding")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "高校" }));
    await user.click(screen.getByRole("button", { name: "其他 / 专业课" }));
    await user.type(screen.getByPlaceholderText("例如：课程与教学论、机械设计"), "课程与教学论");
    await user.click(screen.getByRole("button", { name: "下一步" }));
    await user.click(screen.getByRole("button", { name: "4—7 年" }));
    await user.click(screen.getByRole("button", { name: "一线任课教师" }));
    await user.click(screen.getByRole("button", { name: "教学目标与重难点" }));
    await user.click(screen.getByRole("button", { name: "评价与学习证据" }));
    await user.click(screen.getByRole("button", { name: "下一步" }));
    await user.click(screen.getByRole("button", { name: "先直接指出最核心的问题" }));
    await user.click(screen.getByRole("button", { name: "完成，让 HAI 记住我" }));

    expect(saveHaiProfileMemories).toHaveBeenCalledWith({
      userId: "user-1",
      memories: [
        { category: "basic_info", content: "我目前主要在高校任教。" },
        { category: "basic_info", content: "我主要教授课程与教学论。" },
        { category: "basic_info", content: "我的教龄是4—7 年。" },
        { category: "basic_info", content: "我目前的主要角色是一线任课教师。" },
        { category: "challenge", content: "我目前最常遇到的教学问题是教学目标与重难点、评价与学习证据。" },
        { category: "teaching_preference", content: "我更希望 HAI 先直接指出最核心的问题。" },
      ],
    });
  });
});

describe("HAI mobile chat shell", () => {
  it("locks the page shell and leaves the message region as the single vertical scroller", async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/hai"]}>
        <HaiPage />
      </MemoryRouter>,
    );

    const scrollRegion = await screen.findByTestId("hai-message-scroll-region");
    const composer = screen.getByTestId("hai-composer");

    expect(document.body).toHaveClass("hai-chat-active");
    expect(scrollRegion).toHaveClass("overflow-y-auto", "overscroll-contain", "flex-1");
    expect(composer).toHaveClass("shrink-0");
    expect(screen.getByTestId("global-header").parentElement).toHaveClass("hidden", "md:block");
    expect(screen.getByTestId("global-footer").parentElement).toHaveClass("hidden", "md:block");

    unmount();
    expect(document.body).not.toHaveClass("hai-chat-active");
  });

  it(“shows an explicit unavailable state when hai-chat cannot be loaded”, async () => {
    vi.mocked(getHaiChatModule).mockRejectedValueOnce(
      new Error(“HAI Chat 当前未启用，请联系管理员检查模块和已发布 Skill。”),
    );

    render(
      <MemoryRouter initialEntries={["/hai"]}>
        <HaiPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("HAI 暂时不可用");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "“问问哈老师”当前未启用，请联系管理员检查模块和已发布 Skill。",
    );
    expect(screen.queryByLabelText("输入教学问题")).not.toBeInTheDocument();
  });
});

describe("HAI assistant message actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(copyHaiAnswer).mockResolvedValue(undefined);
    vi.mocked(createHaiShareImage).mockResolvedValue(new Blob(["share-image"], { type: "image/png" }));
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:hai-share-preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
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

  it("generates and previews a share image without downloading it", async () => {
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

    expect(createHaiShareImage).toHaveBeenCalledWith({
      question: "这份教案应该先改哪里？",
      answer: "先看目标是否清楚。",
    });
    expect(await screen.findByTestId("hai-share-preview-image")).toHaveAttribute(
      "src",
      "blob:hai-share-preview",
    );
    expect(screen.getByText("手机长按图片选择保存或转发，电脑端可右键保存。")).toBeInTheDocument();
    expect(document.querySelector("a[download]")).not.toBeInTheDocument();
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

  it("records whether an assistant answer was helpful", async () => {
    const user = userEvent.setup();
    const onFeedback = vi.fn();
    render(
      <MessageBubble
        message={{
          id: "assistant-feedback",
          role: "assistant",
          content: "先检查学习证据，再决定是否重讲。",
          created_at: "2026-07-13T08:00:00.000Z",
        }}
        feedback="down"
        onFeedback={onFeedback}
      />,
    );

    expect(screen.getByRole("button", { name: "这条回答没帮助" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "这条回答有帮助" }));
    expect(onFeedback).toHaveBeenCalledWith("assistant-feedback", "up");
  });
});
