import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";

vi.mock("@/routes", () => ({
  default: [
    { path: "/", name: "首页", element: <div>首页内容</div> },
    { path: "/learning", name: "我的学习", element: <div>学习内容</div> },
  ],
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, profile: null }),
}));
vi.mock("@/components/layout/SiteNotifications", () => ({ default: () => null }));

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  localStorage.setItem("site-sidebar-collapsed", "true");
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(min-width: 768px)",
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

describe("折叠工具栏预览", () => {
  it("悬停打开完整导航，移入卡片后可直接跳转并收起预览", async () => {
    render(<App />);
    const toggle = screen.getByRole("button", { name: "展开工具栏" });
    const navigation = screen.getByRole("navigation", { name: "网站导航", hidden: true });
    const sidebar = navigation.closest("aside");
    expect(sidebar).toHaveAttribute("aria-hidden", "true");

    fireEvent.mouseEnter(toggle);
    expect(sidebar).toHaveClass("site-sidebar-preview");
    expect(sidebar).not.toHaveAttribute("aria-hidden", "true");
    fireEvent.mouseLeave(toggle, { relatedTarget: sidebar });
    fireEvent.mouseEnter(sidebar!);
    expect(sidebar).toHaveClass("site-sidebar-preview");

    fireEvent.mouseLeave(sidebar!);
    expect(sidebar).not.toHaveClass("site-sidebar-preview");
    fireEvent.mouseEnter(toggle);
    expect(sidebar).toHaveClass("site-sidebar-preview");

    fireEvent.click(within(navigation).getByRole("link", { name: "我的学习" }));
    await waitFor(() => expect(screen.getByText("学习内容")).toBeInTheDocument());
    expect(sidebar).not.toHaveClass("site-sidebar-preview");
    expect(toggle).toHaveAccessibleName("展开工具栏");
  });
});
