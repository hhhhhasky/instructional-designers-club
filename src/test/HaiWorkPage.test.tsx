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

  it("blocks subject lesson generation without textbook content or a file", async () => {
    const user = userEvent.setup();
    renderAt("/hai/work/subject-lesson-design");

    await screen.findByText("先把真实情况交给 HAI");
    await user.selectOptions(screen.getByRole("combobox", { name: /学段/ }), "高中");
    expect(screen.getByLabelText("学科与课型")).toHaveTextContent("思想政治 · 公开课");
    await user.type(screen.getByRole("textbox", { name: /单元/ }), "第一单元");
    await user.type(screen.getByRole("textbox", { name: /课题/ }), "实现人生价值");
    await user.click(screen.getByRole("button", { name: "开始思政公开课设计" }));

    expect(screen.getByText("请粘贴教材正文或上传教材文件，HAI 不会猜测教材内容。")).toBeInTheDocument();
    expect(streamHaiWork).not.toHaveBeenCalled();
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
