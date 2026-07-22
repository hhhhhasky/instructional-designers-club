import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type HaiFeatureModule, getHaiWorkTools, streamHaiWork } from "@/db/hai-api";
import HaiWorkPage from "@/pages/HaiWorkPage";

vi.mock("@/components/layout/Header", () => ({ default: () => <div data-testid="global-header" /> }));
vi.mock("@/components/common/PageMeta", () => ({ default: () => null }));
const { stableUser, tools } = vi.hoisted(() => ({
  stableUser: { id: "user-1" },
  tools: [
    { slug: "lesson-diagnosis", name: "教案诊断", is_enabled: true, surface_mode: "work" },
    { slug: "segment-optimization", name: "环节优化", is_enabled: true, surface_mode: "work" },
    {
      slug: "subject-lesson-design",
      name: "思政公开课设计",
      description: "后台维护的思政公开课入口说明",
      is_enabled: true,
      surface_mode: "work",
    },
  ] as HaiFeatureModule[],
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: stableUser, loading: false }),
}));

vi.mock("@/db/hai-api", () => ({
  getHaiAccessStatus: vi.fn().mockResolvedValue({ access: { authenticated: true, allowed: true }, usage: null }),
  getHaiWorkTools: vi.fn().mockResolvedValue(tools),
  getHaiWorkTasks: vi.fn().mockResolvedValue([]),
  getHaiTextbookCatalog: vi.fn().mockResolvedValue([
    {
      collection_slug: "junior-politics-grade-7-volume-1-2024",
      collection_title: "七年级上册",
      stage: "初中",
      subject: "道德与法治",
      grade_level: 7,
      grade_label: "7年级",
      volume: "上册",
      edition_label: "2024年秋统编新版",
      publication_status: "current",
      verification_status: "source_declared_current",
      requires_confirmation: false,
      unit_number: 1,
      unit_label: "第一单元",
      unit_title: "少年有梦",
      lesson_number: 1,
      lesson_label: "第一课",
      lesson_title: "开启初中生活",
      frame_number: 1,
      frame_label: "第一框",
      frame_title: "奏响中学序曲",
    },
  ]),
  uploadHaiMaterial: vi.fn(),
  streamHaiWork: vi.fn(),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/hai/work" element={<HaiWorkPage />} />
        <Route path="/hai/work/:toolSlug" element={<HaiWorkPage />} />
        <Route path="/hai/work/tasks/:taskId" element={<div data-testid="task-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("HAI Work workbench", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows all three enabled work tools", async () => {
    renderAt("/hai/work");

    expect((await screen.findAllByRole("link", { name: /教案诊断/ })).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /环节优化/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /思政公开课设计/ }).length).toBeGreaterThan(0);
    expect(screen.getByText("后台维护的思政公开课入口说明")).toBeInTheDocument();
  });

  it("removes a tool entry when the backend module is disabled", async () => {
    vi.mocked(getHaiWorkTools).mockResolvedValueOnce(tools.filter((item) => item.slug !== "segment-optimization"));
    renderAt("/hai/work");

    expect((await screen.findAllByRole("link", { name: /教案诊断/ })).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /环节优化/ })).not.toBeInTheDocument();
  });

  it("submits subject lesson generation from the built-in textbook catalog without an upload", async () => {
    const user = userEvent.setup();
    renderAt("/hai/work/subject-lesson-design");

    await screen.findByText("先把真实情况交给 HAI");
    expect(screen.getByLabelText("学段")).toHaveTextContent("初中");
    expect(screen.getByLabelText("学科与课型")).toHaveTextContent("道德与法治 · 公开课");
    await user.selectOptions(await screen.findByRole("combobox", { name: "年级" }), "7年级");
    await user.selectOptions(screen.getByRole("combobox", { name: "册次" }), "上册");
    await user.selectOptions(screen.getByRole("combobox", { name: "单元" }), "第一单元 少年有梦");
    await user.selectOptions(screen.getByRole("combobox", { name: "课题" }), "第一课 开启初中生活");
    await user.click(screen.getByRole("radio", { name: /案例式/ }));
    await user.click(screen.getByRole("button", { name: "开始思政公开课设计" }));

    expect(streamHaiWork).toHaveBeenCalledWith(
      expect.objectContaining({
        toolSlug: "subject-lesson-design",
        materialIds: [],
        input: expect.objectContaining({
          grade: "7年级",
          volume: "上册",
          unit: "第一单元 少年有梦",
          topic: "第一课 开启初中生活",
          teaching_mode: "案例式",
        }),
      }),
      expect.any(Object),
    );
  });

  it("submits a pasted lesson plan and opens the durable task", async () => {
    const user = userEvent.setup();
    vi.mocked(streamHaiWork).mockImplementation(async (_payload, handlers) => {
      handlers.onEvent({ type: "done", taskId: "task-1", runId: "run-1", artifactId: "artifact-1", versionNumber: 1 });
    });
    renderAt("/hai/work/lesson-diagnosis");

    await screen.findByText("先把真实情况交给 HAI");
    await user.selectOptions(screen.getByRole("combobox", { name: /学段/ }), "初中");
    await user.type(screen.getByRole("textbox", { name: /学科/ }), "语文");
    await user.type(screen.getByRole("textbox", { name: /课题/ }), "背影");
    await user.type(screen.getByRole("textbox", { name: /教案正文/ }), "教学目标：理解父爱。教学环节：教师讲解。教学评价：课堂提问。");
    await user.click(screen.getByRole("button", { name: "开始教案诊断" }));

    expect(await screen.findByTestId("task-page")).toBeInTheDocument();
    expect(streamHaiWork).toHaveBeenCalledWith(
      expect.objectContaining({ toolSlug: "lesson-diagnosis", materialIds: [] }),
      expect.any(Object),
    );
  });
});
