import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import routes from "@/routes";

function WorkHome() {
  return <div>统一工作台：{useLocation().pathname}</div>;
}
afterEach(cleanup);
describe("旧 Work 新建入口", () => {
  it("HAI 默认入口直接进入工作台", async () => {
    render(<MemoryRouter initialEntries={["/hai"]}><Routes>
      <Route path="/hai" element={routes.find(route => route.path === "/hai")!.element} />
      <Route path="/hai/work" element={<WorkHome />} />
    </Routes></MemoryRouter>);
    expect(await screen.findByText("统一工作台：/hai/work")).toBeInTheDocument();
  });

  it.each([
    "/hai/work/image-generation",
    "/hai/work/image-generation/ppt",
    "/hai/work/subject-lesson-design",
    "/hai/work/lesson-diagnosis",
    "/hai/work/segment-optimization",
    "/hai/work/unit-learning-design",
    "/hai/work/teaching-design",
  ])("%s 只进入统一主页", async (path) => {
    const legacy = routes.filter((route) => ["/hai/work/image-generation", "/hai/work/image-generation/ppt", "/hai/work/:toolSlug"].includes(route.path));
    render(<MemoryRouter initialEntries={[path]}><Routes>
      {legacy.map((route) => <Route key={route.path} path={route.path} element={route.element} />)}
      <Route path="/hai/work" element={<WorkHome />} />
    </Routes></MemoryRouter>);
    expect(await screen.findByText("统一工作台：/hai/work")).toBeInTheDocument();
  });
});
