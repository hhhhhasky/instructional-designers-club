import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HaiImagePptPage from "@/pages/HaiImagePptPage";
import type { ImagePptResult } from "@/db/hai-image-ppt";
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  detail: vi.fn(),
  user: { id: "owner" },
  ack: vi.fn(),
  urls: vi.fn(),
}));
vi.mock(
  "@/contexts/AuthContext",
  () => ({ useAuth: () => ({ user: mocks.user, loading: false }) }),
);
vi.mock("@/components/common/PageMeta", () => ({ default: () => null }));
vi.mock(
  "@/components/hai/HaiWorkShell",
  () => ({
    default: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  }),
);
vi.mock("@/pages/HaiWorkPage", () => ({ WorkSidebar: () => null }));
vi.mock("@/db/hai-api", () => ({
  getHaiWorkTasks: async () => [{
    id: "lesson",
    module_slug: "subject-lesson-design",
    title: "比较方案",
    latest_artifact_id: "artifact",
    status: "active",
  }],
  getArchivedHaiWorkTasks: async () => [],
  getHaiWorkTools: async () => [],
  getHaiWorkTaskDetail: mocks.detail,
}));
vi.mock("@/db/hai-image-ppt", () => ({ imagePptRequest: mocks.request }));
vi.mock(
  "@/db/hai-image-generation",
  async (original) => ({
    ...await original<object>(),
    getHaiImageGenerationTasks: async () => [],
    getHaiImageAccessUrls: mocks.urls,
    acknowledgeHaiImage: mocks.ack,
  }),
);
const course = {
  subject: "数学",
  grade: "七年级",
  unit: "第一单元",
  topic: "比较方案",
  teacher: "",
};
const page = {
  id: "P01",
  title: "观察方案",
  text: "比较方案A和B，说明选择依据。",
  image_description: "两个方案并排",
  layout: "左侧材料，右侧问题",
  section: "导入",
};
function result(
  status: ImagePptResult["deck"]["status"] = "outline",
): ImagePptResult {
  return {
    deck: {
      id: "deck",
      image_task_id: "image-task",
      source_artifact_id: "artifact",
      source_version: 2,
      requirements: "材料分步呈现",
      course,
      outline: [page],
      art_style: null,
      settings: {},
      status,
      revision: 1,
      error_message: null,
    },
    pages: [],
    runs: [],
  };
}
function mount(path = "/ppt/deck") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/ppt/:deckId" element={<HaiImagePptPage />} />
        <Route path="/ppt" element={<HaiImagePptPage />} />
        <Route
          path="/hai/work/image-generation/ppt/:deckId"
          element={<HaiImagePptPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}
describe("教案转图片课件四步流程", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.urls.mockResolvedValue({});
    mocks.request.mockResolvedValue(result());
    mocks.detail.mockResolvedValue({
      artifacts: [{
        id: "artifact",
        run_id: "run",
        title: "比较方案",
        version_number: 2,
        content_markdown: "完整教案正文",
      }],
      runs: [{ id: "run", status: "completed" }],
    });
  });
  afterEach(cleanup);
  it("图片已保存但地址失败时显示加载错误，重试只获取图片地址", async () => {
    const data = result("paused");
    data.pages = [{
      page_id: "P01",
      page_index: 0,
      current_run_id: "saved",
      attempt: 1,
    }];
    data.runs = [{
      id: "saved",
      status: "running",
      r2_key: "saved.png",
      error_message: null,
      metadata: {},
    }];
    mocks.request.mockResolvedValue(data);
    mocks.urls.mockRejectedValueOnce(Error("显示地址加载失败"));
    mount();
    await screen.findByText("显示地址加载失败");
    expect(screen.queryByText("正在生成本页…")).not.toBeInTheDocument();
    mocks.urls.mockResolvedValue({
      saved: "https://image.example.test/saved.png",
    });
    fireEvent.click(screen.getByRole("button", { name: "重新加载图片" }));
    expect(await screen.findByRole("img", { name: "第1页：观察方案" }))
      .toHaveAttribute("src", "https://image.example.test/saved.png");
    expect(mocks.request.mock.calls.every(([action]) => action === "get")).toBe(
      true,
    );
  });
  it("新任务课程信息尚未返回时，第二步仍显示规划进度", async () => {
    mocks.request.mockResolvedValue({
      ...result("planning"),
      deck: {
        ...result("planning").deck,
        course: {} as ImagePptResult["deck"]["course"],
        outline: [],
        outline_markdown: "",
      },
    });
    mount();
    expect(await screen.findByText("正在阅读教案，组织整套课件的思路…"))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "确认大纲，选择风格" })).not
      .toBeInTheDocument();
  });
  it("从已有教案与补充需求启动，不出现旧格式或页数档位", async () => {
    const user = userEvent.setup();
    mount("/ppt");
    await screen.findByRole("combobox", { name: "选择已有教案" });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "选择已有教案" }),
      "lesson",
    );
    await screen.findByText("第2版 · 比较方案");
    await user.type(
      screen.getByRole("textbox", { name: "课件补充需求" }),
      "先讨论后呈现结论",
    );
    mocks.request.mockResolvedValue(result("planning"));
    await user.click(screen.getByRole("button", { name: "生成文字大纲" }));
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(
        "create",
        expect.objectContaining({
          artifactId: "artifact",
          requirements: "先讨论后呈现结论",
          clientRequestId: expect.any(String),
        }),
      )
    );
    expect(screen.queryByText("可编辑 PPT模式")).not.toBeInTheDocument();
    expect(screen.queryByText("HTML")).not.toBeInTheDocument();
  });
  it("大纲可编辑，并把修改后的完整正文带到下一步", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole("button", { name: "编辑全文" }));
    const body = screen.getByRole("textbox", { name: "课件文字大纲全文" });
    await user.clear(body);
    await user.type(body, "## 第1页｜观察方案\n\n修改后的材料与问题");
    mocks.request.mockResolvedValue({
      ...result("style"),
      deck: { ...result("style").deck, revision: 2 },
    });
    await user.click(
      screen.getByRole("button", { name: "确认大纲，选择风格" }),
    );
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(
        "outline",
        expect.objectContaining({
          markdown: "## 第1页｜观察方案\n\n修改后的材料与问题",
          revision: 1,
        }),
      )
    );
    await screen.findByRole("group", { name: "选择课件风格" });
  });
  it("选择既有风格后直接开始，不增加共用设定确认步骤", async () => {
    const user = userEvent.setup();
    mocks.request.mockResolvedValue(result("style"));
    mount();
    const styles = await screen.findByRole("group", { name: "选择课件风格" });
    await user.click(within(styles).getByRole("button", { name: /几何极简/ }));
    mocks.request.mockResolvedValue(result("styling"));
    await user.click(
      screen.getByRole("button", { name: /使用「几何极简」生成1页样张/ }),
    );
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(
        "generate",
        expect.objectContaining({ style: "几何极简" }),
      )
    );
    await screen.findByText("正在确定整套文字与配色");
    expect(screen.queryByRole("button", { name: "确认字体" })).not
      .toBeInTheDocument();
  });
  it("未完成的整套禁止下载，但保留单页修改入口", async () => {
    mocks.request.mockResolvedValue({
      ...result("paused"),
      deck: {
        ...result("paused").deck,
        error_message: "一页未完成",
        settings: {},
      },
    });
    mount();
    expect(await screen.findByRole("button", { name: "下载PPT" }))
      .toBeDisabled();
    expect(screen.getByRole("button", { name: "修改／重试" })).toBeEnabled();
  });
  it("全文自由增删分页，不再使用逐页填表按钮", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText("共1页");
    expect(screen.queryByRole("button", { name: "增加一页" })).not
      .toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "编辑全文" }));
    const body = screen.getByRole("textbox", { name: "课件文字大纲全文" });
    await user.clear(body);
    await user.type(body, "## 第1页｜封面\n\n## 第2页｜讨论\n\n你会怎样选择？");
    expect(screen.getByText("共2页")).toBeInTheDocument();
    await user.clear(body);
    await user.type(body, "没有标明分页的文档");
    expect(screen.getByRole("button", { name: "确认大纲，选择风格" }))
      .toBeDisabled();
  });
  it("自然语言修改以当前已编辑的全文为基础", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole("button", { name: "编辑全文" }));
    const body = screen.getByRole("textbox", { name: "课件文字大纲全文" });
    await user.clear(body);
    await user.type(body, "## 第1页｜观察\n\n我已经编辑过的材料");
    await user.type(
      screen.getByRole("textbox", { name: "大纲修改意见" }),
      "把活动展开一些",
    );
    mocks.request.mockResolvedValue({
      ...result("planning"),
      deck: {
        ...result("planning").deck,
        outline_markdown: "## 第1页｜观察\n\n我已经编辑过的材料",
      },
    });
    await user.click(screen.getByRole("button", { name: "按意见修改大纲" }));
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(
        "revise_outline",
        expect.objectContaining({
          markdown: "## 第1页｜观察\n\n我已经编辑过的材料",
          feedback: "把活动展开一些",
          revision: 1,
        }),
      )
    );
    await screen.findByText("正在根据你的意见修改整份大纲…");
  });
});
