import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import HaiWorkspaceShell from "@/components/hai/HaiWorkspaceShell";

vi.mock("@/components/layout/Header", () => ({
  default: () => <div data-testid="workspace-global-header" />,
}));

describe("HAI editorial workspace shell", () => {
  it("shares the consultation shell, mobile panels, safe area, and print boundary", () => {
    const { container, unmount } = render(
      <MemoryRouter initialEntries={["/hai/chat"]}>
        <HaiWorkspaceShell
          mode="consultation"
          title="聊聊问题"
          subtitle="问问哈老师"
          sidebar={<div>对话记录</div>}
          inspector={<div>咨询上下文</div>}
          sidebarLabel="打开对话记录"
          inspectorLabel="打开咨询上下文"
          contentMode="managed"
        >
          <div>咨询正文</div>
        </HaiWorkspaceShell>
      </MemoryRouter>,
    );

    expect(screen.getByText("咨询笔记")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开对话记录" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开咨询上下文" })).toBeInTheDocument();
    expect(screen.getByText("咨询正文").parentElement).toHaveClass("overflow-hidden");
    expect(container.firstElementChild).toHaveClass("print:overflow-visible", "print:bg-white");
    expect(container.querySelector("header")).toHaveClass(
      "pt-[calc(0.625rem+env(safe-area-inset-top))]",
      "print:hidden",
    );
    expect(document.body).toHaveClass("hai-chat-active");

    unmount();
    expect(document.body).not.toHaveClass("hai-chat-active");
  });

  it("labels durable Work output as a proof archive", () => {
    render(
      <MemoryRouter initialEntries={["/hai/work/tasks/task-1"]}>
        <HaiWorkspaceShell
          mode="proof"
          title="教案诊断"
          subtitle="任务一"
          sidebar={<div>任务记录</div>}
          contentMode="scroll"
        >
          <article>版本化产物</article>
        </HaiWorkspaceShell>
      </MemoryRouter>,
    );

    expect(screen.getByText("校样档案")).toBeInTheDocument();
    expect(screen.getByText("版本化产物").parentElement).toHaveClass("hai-work-scroll", "overflow-y-auto");
  });
});
