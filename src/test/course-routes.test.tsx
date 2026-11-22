import { HelmetProvider } from "react-helmet-async";
import { Suspense } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, matchRoutes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import routes from "@/routes";

const { findCourseRoute } = vi.hoisted(() => ({
  findCourseRoute: vi.fn(),
}));
vi.mock("@/db/course-routes", () => ({ findCourseRoute }));
vi.mock("@/pages/CourseDetailPage", () => ({
  default: ({ courseId }: { courseId: string }) => <p>课节编号 {courseId}</p>,
}));

function CurrentLocation() {
  const { pathname, search, hash } = useLocation();
  return <output>{pathname}{search}{hash}</output>;
}

function renderRoute(path: string, locationOnlyAt?: string) {
  render(<HelmetProvider><MemoryRouter initialEntries={[path]}>
    <CurrentLocation />
    <Suspense fallback={<p>加载路由</p>}>
      <Routes>
        {routes.map((route) => <Route
          key={route.path}
          path={route.path}
          element={route.path === locationOnlyAt ? null : route.element}
        />)}
      </Routes>
    </Suspense>
  </MemoryRouter></HelmetProvider>);
}

afterEach(() => {
  cleanup();
  findCourseRoute.mockReset();
});

describe("官网课程网址", () => {
  it.each([
    ["/course", "课程"],
    ["/course/teaching-general-2025", "教学通识课"],
    ["/course/teacher-ai", "教师AI课"],
    ["/course/gaoding-gongkaike-2027", "搞定公开课 2027 版"],
    ["/course/gaoding-gongkaike-2027/four-levels", "课程学习"],
    ["/course/daofa/alignment-canvas", "三元对齐画布"],
    ["/course/teaching-general-v2/standard-analysis-01", "V2 课程详情"],
    ["/learning/map", "学习地图"],
  ])("%s 对应 %s", (path, name) => {
    const matches = matchRoutes(routes, path);
    expect(matches?.[matches.length - 1]?.route.name).toBe(name);
  });

  it.each([
    ["/courses/gongding-gongkaike?from=share#chapter-3", "/course/gaoding-gongkaike-2027", "?from=share#chapter-3"],
    ["/courses/plus/scenarios?from=share", "/course/teaching-general-2025", "?from=share#scenarios"],
    ["/learning-map?mapedit=1", "/learning/map", "?mapedit=1"],
  ])("%s 会保留参数和定位", async (oldPath, path, suffix) => {
    renderRoute(oldPath, path);
    expect(await screen.findByText(path + suffix)).toBeInTheDocument();
  });

  it("按课节归属迁移旧 ID，之后以同一 ID 打开单课", async () => {
    const id = "11b090dc-8b15-4616-80b1-a09765c73e29";
    findCourseRoute.mockResolvedValue({
      id, membership_type: "plus", access_product_code: "gongding-gongkaike", route_slug: "four-levels",
    });
    renderRoute(`/courses/${id}?from=share#notes`);
    expect(await screen.findByText("/course/gaoding-gongkaike-2027/four-levels?from=share#notes")).toBeInTheDocument();
    expect(await screen.findByText(`课节编号 ${id}`)).toBeInTheDocument();
    expect(findCourseRoute).toHaveBeenCalledWith("id", id);
    expect(findCourseRoute).toHaveBeenCalledWith("route_slug", "four-levels");
  });

  it("不存在的单课显示找不到的提示", async () => {
    findCourseRoute.mockResolvedValue(null);
    renderRoute("/course/teacher-ai/unknown");
    expect(await screen.findByRole("heading", { name: "页面找不到了" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回课程总览" })).toHaveAttribute("href", "/course");
  });
});
