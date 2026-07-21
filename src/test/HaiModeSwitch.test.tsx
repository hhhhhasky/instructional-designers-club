import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import HaiDesktopModeSwitch from "@/components/hai/HaiDesktopModeSwitch";

describe("HAI 桌面端模式切换", () => {
  it("使用中文分区标签和矩形标签页样式", () => {
    render(
      <MemoryRouter initialEntries={["/hai/chat"]}>
        <HaiDesktopModeSwitch />
      </MemoryRouter>,
    );

    const switcher = screen.getByTestId("hai-desktop-mode-switch");
    expect(screen.getByRole("link", { name: "聊聊问题" })).toHaveAttribute("href", "/hai/chat");
    expect(screen.getByRole("link", { name: "帮你干活" })).toHaveAttribute("href", "/hai/work");
    expect(switcher).not.toHaveClass("rounded-ds-full");
    expect(screen.getByRole("link", { name: "聊聊问题" })).not.toHaveClass("rounded-ds-full");
  });
});
