import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useHaiExit } from "@/lib/hai-navigation";

function ExitButton() {
  const exit = useHaiExit();
  return <button type="button" onClick={exit}>返回网站</button>;
}

describe("HAI exit navigation", () => {
  beforeEach(() => sessionStorage.clear());

  it("returns to the site page that opened HAI", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[{ pathname: "/hai/chat", state: { fromSite: "/courses" } }]}>
        <Routes>
          <Route path="/hai/chat" element={<ExitButton />} />
          <Route path="/courses" element={<div>课程列表</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "返回网站" }));
    expect(await screen.findByText("课程列表")).toBeInTheDocument();
  });

  it("falls back to the homepage for a direct HAI entry", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/hai/chat"]}>
        <Routes>
          <Route path="/hai/chat" element={<ExitButton />} />
          <Route path="/" element={<div>网站首页</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "返回网站" }));
    expect(await screen.findByText("网站首页")).toBeInTheDocument();
  });

  it.each([
    "/hai/work/image-generation/task-1",
    "/hai/work/image-generation/ppt/deck-1",
    "/hai/work/tasks/task-1",
    "/hai/work/tasks/task-1/courseware",
  ])("returns %s to the unified Work homepage", async (path) => {
    sessionStorage.setItem("hai-exit-path", "/courses");
    const user = userEvent.setup();
    const { unmount } = render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path} element={<ExitButton />} />
          <Route path="/hai/work" element={<div>新的帮你干活主页</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "返回网站" }));
    expect(await screen.findByText("新的帮你干活主页")).toBeInTheDocument();
    unmount();
  });


  it("returns the embedded courseware builder to the main input on the same route", async () => {
    function UnifiedHome() {
      return useLocation().state?.imagePpt ? <ExitButton /> : <div>统一任务输入框</div>;
    }
    const user = userEvent.setup();
    const { unmount } = render(<MemoryRouter initialEntries={[{ pathname: "/hai/work", state: { imagePpt: true } }]}><Routes>
      <Route path="/hai/work" element={<UnifiedHome />} />
    </Routes></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: "返回网站" }));
    expect(await screen.findByText("统一任务输入框")).toBeInTheDocument();
    unmount();
  });

});
