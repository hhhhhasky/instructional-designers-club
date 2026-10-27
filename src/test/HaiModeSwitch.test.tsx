import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import HaiDesktopModeSwitch from "@/components/hai/HaiDesktopModeSwitch";

describe("HAI 桌面端工作入口", () => {
  it("在聊天页突出返回工作台，不再并列两个模式", () => {
    render(
      <MemoryRouter initialEntries={["/hai/chat"]}>
        <HaiDesktopModeSwitch />
      </MemoryRouter>,
    );

    const switcher = screen.getByTestId("hai-desktop-mode-switch");
    expect(screen.queryByRole("link", { name: "聊聊问题" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "帮你干活" })).toHaveAttribute("href", "/hai/work");
    expect(screen.getByRole("link", { name: "购买积分" })).toHaveAttribute("href", "/hai/points");
    expect(switcher).not.toHaveClass("rounded-ds-full");
    expect(screen.getByRole("link", { name: "帮你干活" })).toHaveClass("bg-[var(--annotation)]");
  });

  it("工作页右上角只保留积分入口", () => {
    render(<MemoryRouter initialEntries={["/hai/work/tasks/task-1"]}><HaiDesktopModeSwitch /></MemoryRouter>);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "购买积分" })).toHaveAttribute("href", "/hai/points");
  });
});
