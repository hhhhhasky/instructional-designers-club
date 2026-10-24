import { haiTaskTitle } from "@/lib/hai-task-title";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteHaiWorkTask, getHaiWorkTasks, getArchivedHaiWorkTasks, getHaiWorkTaskDetail, type HaiWorkTask, type HaiWorkTaskDetail, renameHaiWorkTask, submitHaiWork } from "@/db/hai-api";
import { WorkSidebar } from "@/pages/HaiWorkPage";
import { getHaiImageGenerationTasks, type HaiImageGenerationTask } from "@/db/hai-image-generation";
import HaiWorkTaskPage from "@/pages/HaiWorkTaskPage";

const { stableUser, detail, tools } = vi.hoisted(() => ({
  stableUser: { id: "user-1" },
  tools: [
    { slug: "lesson-diagnosis", name: "教案诊断", description: "诊断教案", is_enabled: true, surface_mode: "work" },
    { slug: "segment-optimization", name: "环节优化", description: "优化环节", is_enabled: true, surface_mode: "work" },
    { slug: "subject-lesson-design", name: "公开课设计", description: "设计公开课", is_enabled: true, surface_mode: "work" },
  ],
  detail: {
    task: {
      id: "task-1",
      user_id: "user-1",
      module_slug: "lesson-diagnosis",
      title: "教案诊断｜背影",
      status: "active",
      latest_artifact_id: "artifact-2",
      archived_at: null,
      created_at: "2026-07-21T08:00:00.000Z",
      updated_at: "2026-07-21T08:10:00.000Z",
    },
    runs: [
      {
        id: "run-2", task_id: "task-1", user_id: "user-1", skill_version_id: "skill-v1",
        parent_artifact_id: "artifact-1", client_request_id: "request-2", status: "completed",
        input_snapshot: { stage: "初中", subject: "语文", topic: "背影", lesson_plan: "教案", material_ids: [], output_mode: "lesson-plan-optimization" },
        skill_snapshot: { slug: "lesson-diagnosis-general", name: "通用七要素教案诊断", version: "v1", fallback: true },
        revision_instruction: "补充评价证据", error_message: null, input_tokens: 100, output_tokens: 200,
        duration_ms: 1200, started_at: "2026-07-21T08:09:00.000Z", completed_at: "2026-07-21T08:10:00.000Z",
        created_at: "2026-07-21T08:09:00.000Z", updated_at: "2026-07-21T08:10:00.000Z",
      },
      {
        id: "run-1", task_id: "task-1", user_id: "user-1", skill_version_id: "skill-v1",
        parent_artifact_id: null, client_request_id: "request-1", status: "completed",
        input_snapshot: { stage: "初中", subject: "语文", topic: "背影", lesson_plan: "教案", material_ids: [] },
        skill_snapshot: { slug: "lesson-diagnosis-general", name: "通用七要素教案诊断", version: "v1", fallback: true },
        revision_instruction: null, error_message: null, input_tokens: 100, output_tokens: 200,
        duration_ms: 1200, started_at: "2026-07-21T08:00:00.000Z", completed_at: "2026-07-21T08:01:00.000Z",
        created_at: "2026-07-21T08:00:00.000Z", updated_at: "2026-07-21T08:01:00.000Z",
      },
    ],
    artifacts: [
      { id: "artifact-2", task_id: "task-1", run_id: "run-2", user_id: "user-1", parent_artifact_id: "artifact-1", version_number: 2, title: "诊断 v2", content_json: {}, content_markdown: "# 第二版诊断", created_at: "2026-07-21T08:10:00.000Z" },
      { id: "artifact-1", task_id: "task-1", run_id: "run-1", user_id: "user-1", parent_artifact_id: null, version_number: 1, title: "诊断 v1", content_json: {}, content_markdown: "# 第一版诊断", created_at: "2026-07-21T08:01:00.000Z" },
    ],
  },
}));

vi.mock("@/db/hai-image-generation", () => ({ getHaiImageGenerationTasks: vi.fn().mockResolvedValue([]) }));

vi.mock("@/components/layout/Header", () => ({ default: () => null }));
vi.mock("@/components/common/PageMeta", () => ({ default: () => null }));
vi.mock("@/components/common/MarkdownRenderer", () => ({ default: ({ content }: { content: string }) => <div>{content}</div> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: stableUser, loading: false }) }));
vi.mock("@/db/hai-api", () => ({
  getHaiWorkTaskDetail: vi.fn().mockResolvedValue(detail),
  getHaiWorkTasks: vi.fn().mockResolvedValue([detail.task]),
  getArchivedHaiWorkTasks: vi.fn().mockResolvedValue([]),
  getHaiWorkTools: vi.fn().mockResolvedValue(tools),
  archiveHaiWorkTask: vi.fn(),
  deleteHaiWorkTask: vi.fn(),
  renameHaiWorkTask: vi.fn(),
  submitHaiWork: vi.fn().mockResolvedValue({ taskId: "task-1", runId: "run-3", status: "queued", artifactId: null, error: null, replayed: false }),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/hai/work/tasks/task-1"]}>
      <Routes>
        <Route path="/hai/work/tasks/:taskId" element={<HaiWorkTaskPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function openLatestPreview() {
  const links = await screen.findAllByRole("link", { name: /^阅读 / });
  fireEvent.click(links[links.length - 1]);
}

describe("HAI Work task page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the task sidebar renderable before the tool catalog is available", () => {
    render(<MemoryRouter><WorkSidebar tasks={[detail.task as HaiWorkTask]} archivedTasks={[]} imageTasks={[]} /></MemoryRouter>);

    expect(screen.getByText("历史任务")).toBeInTheDocument();
    expect(screen.getByText(haiTaskTitle(detail.task.title))).toBeInTheDocument();
  });

  it("shows history across tools even when a work tool is selected", () => {
    const otherTask = { ...detail.task, id: "task-2", module_slug: "segment-optimization", title: "环节优化｜导入" } as HaiWorkTask;
    render(
      <MemoryRouter>
        <WorkSidebar
          tasks={[detail.task as HaiWorkTask, otherTask]}
          archivedTasks={[]}
          imageTasks={[]}
          selectedToolSlug="lesson-diagnosis"
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(haiTaskTitle(detail.task.title))).toBeInTheDocument();
    expect(screen.getByText(haiTaskTitle(otherTask.title))).toBeInTheDocument();
  });

  it("mixes image and document history by update time with the correct destinations", () => {
    render(<MemoryRouter><WorkSidebar tasks={[detail.task as HaiWorkTask]} archivedTasks={[]} imageTasks={[{ id: "image-task", title: "水循环配图", updated_at: "2099-01-01T00:00:00Z" } as import("@/db/hai-image-generation").HaiImageGenerationTask]} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /水循环配图/ })).toHaveAttribute("href", "/hai/work/image-generation/image-task");
    expect(screen.getByRole("link", { name: new RegExp(haiTaskTitle(detail.task.title)) })).toHaveAttribute("href", `/hai/work/tasks/${detail.task.id}`);
    const taskLinks = screen.getAllByRole("link").filter((link) => link.getAttribute("href") !== "/hai/work");
    expect(taskLinks[0]).toHaveTextContent("水循环配图");
  });

  it("searches task names beyond the visible recent list and restores the list when cleared", async () => {
    const tasks = Array.from({ length: 12 }, (_, index) => ({ ...detail.task, id: `history-${index}`, title: index === 11 ? "水循环课堂设计" : `常规课例 ${index}` })) as HaiWorkTask[];
    const older = { ...detail.task, id: "older", title: "水循环旧任务" } as HaiWorkTask;
    const image = { id: "image", title: "水循环配图", updated_at: detail.task.updated_at } as HaiImageGenerationTask;
    vi.mocked(getHaiWorkTasks).mockResolvedValueOnce([tasks[11], older]);
    vi.mocked(getHaiImageGenerationTasks).mockResolvedValueOnce([image]);
    render(<MemoryRouter><WorkSidebar tasks={tasks} archivedTasks={[]} imageTasks={[image]} /></MemoryRouter>);
    const user = userEvent.setup();
    expect(screen.queryByText("水循环课堂设计")).not.toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "搜索历史任务" }), "水循环");
    expect(await screen.findByText("水循环旧任务")).toBeInTheDocument();
    expect(screen.getByText("水循环课堂设计")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /水循环配图/ })).toHaveAttribute("href", "/hai/work/image-generation/image");
    expect(screen.queryByText("常规课例 0")).not.toBeInTheDocument();
    expect(getHaiWorkTasks).toHaveBeenCalledWith(undefined, "水循环");
    expect(getHaiImageGenerationTasks).toHaveBeenCalledWith("水循环");
    await user.click(screen.getByRole("button", { name: "清空任务搜索" }));
    expect(screen.getByText("常规课例 0")).toBeInTheDocument();
    expect(screen.queryByText("水循环旧任务")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /展示全部/ })).toBeInTheDocument();
  });

  it("includes archived matches automatically and gives an empty result message", async () => {
    const archived = { ...detail.task, id: "archive", title: "公开课 PPT 旧稿", status: "archived" } as HaiWorkTask;
    vi.mocked(getArchivedHaiWorkTasks).mockResolvedValueOnce([archived]);
    render(<MemoryRouter><WorkSidebar tasks={[]} archivedTasks={[archived]} imageTasks={[]} /></MemoryRouter>);
    const user = userEvent.setup();
    expect(screen.queryByText(archived.title)).not.toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "  ppt ");
    expect(await screen.findByText("匹配 1 项任务")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /公开课 PPT 旧稿/ })).toHaveAttribute("href", "/hai/work/tasks/archive");
    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "不存在的名字");
    expect(await screen.findByText("没有找到匹配的任务")).toBeInTheDocument();
  });

  it("starts with the preview collapsed, opens a linked artifact and can fold it again", async () => {
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("link", { name: "阅读 诊断 v2 · v2" });
    expect(screen.queryByRole("region", { name: "作品预览" })).not.toBeInTheDocument();
    expect(screen.queryByRole("separator", { name: "调整对话与预览宽度" })).not.toBeInTheDocument();
    const composer = screen.getByRole("form", { name: "任务输入" });
    expect(composer.textContent).toBe("");
    expect(within(composer).getByLabelText("继续对话")).toHaveAttribute("rows", "1");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(haiTaskTitle(detail.task.title));
    await user.click(screen.getByRole("link", { name: "阅读 诊断 v2 · v2" }));
    expect(screen.getByRole("region", { name: "作品预览" })).toBeInTheDocument();
    const separator = screen.getByRole("separator", { name: "调整对话与预览宽度" });
    separator.focus();
    await user.keyboard("{ArrowRight}");
    expect(separator).toHaveAttribute("aria-valuenow", "42");
    await user.click(screen.getByRole("button", { name: "收起作品预览" }));
    expect(screen.queryByRole("region", { name: "作品预览" })).not.toBeInTheDocument();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "阅读 诊断 v1 · v1" }));
    expect(screen.getByText("# 第一版诊断")).toBeInTheDocument();
    expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "42");
  });

  it("restores the latest durable artifact and version navigation", async () => {
    renderPage();
    await openLatestPreview();

    expect(await screen.findByText("# 第二版诊断")).toBeInTheDocument();
    expect(screen.getAllByText("版本 v2").length).toBeGreaterThan(0);
    expect(screen.getByText("通用 Skill 模式")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复制产物" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下载 Markdown" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打印" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出 Word" })).toBeInTheDocument();
  });

  it("shows the conversation in the middle and opens linked versions only in the preview", async () => {
    renderPage();
    await openLatestPreview();
    const user = userEvent.setup();
    const preview = await screen.findByRole("region", { name: "作品预览" });
    const conversation = screen.getByRole("region", { name: "任务对话" });
    expect(within(conversation).getByText("补充评价证据")).toBeInTheDocument();
    expect(within(conversation).queryByText("# 第二版诊断")).not.toBeInTheDocument();
    expect(within(preview).getByText("# 第二版诊断")).toBeInTheDocument();
    await user.click(within(conversation).getByRole("link", { name: "阅读 诊断 v1 · v1" }));
    expect(within(preview).getByText("# 第一版诊断")).toBeInTheDocument();
    expect(within(preview).queryByText("# 第二版诊断")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "作品预览" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "任务对话" }));
    await user.type(screen.getByLabelText("继续对话"), "请修改第一版的导入");
    await user.click(screen.getByRole("button", { name: "生成新版本" }));
    expect(submitHaiWork).toHaveBeenCalledWith(expect.objectContaining({ parentArtifactId: "artifact-1", revisionInstruction: "请修改第一版的导入" }));
  });

  it("polls a running task and shows the artifact as soon as it completes", async () => {
    const completedDetail = detail as unknown as HaiWorkTaskDetail;
    const runningDetail: HaiWorkTaskDetail = {
      ...completedDetail,
      task: { ...completedDetail.task, latest_artifact_id: null },
      runs: [{
        ...completedDetail.runs[0],
        id: "run-pending",
        status: "running",
        parent_artifact_id: null,
        completed_at: null,
      }],
      artifacts: [],
    };
    vi.mocked(getHaiWorkTaskDetail)
      .mockResolvedValueOnce(runningDetail)
      .mockResolvedValueOnce(completedDetail);

    renderPage();
    expect(await screen.findByText("产物正在后台生成")).toBeInTheDocument();
    const link = await screen.findByRole("link", { name: "阅读 诊断 v2 · v2" }, { timeout: 4500 });
    expect(screen.queryByRole("region", { name: "作品预览" })).not.toBeInTheDocument();
    fireEvent.click(link);
    expect(screen.getByText("# 第二版诊断")).toBeInTheDocument();
    expect(getHaiWorkTaskDetail).toHaveBeenCalledTimes(2);
  }, 6000);

  it("keeps a failed run and its retry action in the conversation", async () => {
    vi.mocked(getHaiWorkTaskDetail).mockResolvedValueOnce({ ...detail, artifacts: [], runs: [{ ...detail.runs[1], status: "failed", error_message: "本次执行未完成，请重试。" }] } as HaiWorkTaskDetail);
    renderPage();
    const user = userEvent.setup();
    const conversation = await screen.findByRole("region", { name: "任务对话" });
    expect(within(conversation).getByText("本次执行未完成，请重试。")).toBeInTheDocument();
    await user.click(within(conversation).getByRole("button", { name: "重新执行" }));
    expect(submitHaiWork).toHaveBeenCalledWith(expect.objectContaining({ taskId: "task-1", toolSlug: "lesson-diagnosis", input: expect.objectContaining({ lesson_plan: "教案" }) }));
  });

  it("renames the task from the action menu", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderPage();
    await openLatestPreview();
    await screen.findByText("# 第二版诊断");

    await user.click(screen.getAllByRole("button", { name: "任务操作" })[0]);
    await user.click(await screen.findByRole("menuitem", { name: /重命名/ }));

    const input = screen.getByDisplayValue(haiTaskTitle(detail.task.title)) as HTMLInputElement;
    await user.clear(input);
    await user.type(input, "教案诊断｜荷塘月色");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(renameHaiWorkTask).toHaveBeenCalledWith("task-1", "教案诊断｜荷塘月色");
  });

  it("deletes the task from the action menu", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderPage();
    await openLatestPreview();
    await screen.findByText("# 第二版诊断");

    await user.click(screen.getAllByRole("button", { name: "任务操作" })[0]);
    await user.click(await screen.findByRole("menuitem", { name: /删除/ }));
    await user.click(await screen.findByRole("button", { name: "永久删除" }));

    expect(deleteHaiWorkTask).toHaveBeenCalledWith("task-1");
  });

  it("creates a child artifact when revising the selected version", async () => {
    const user = userEvent.setup();
    vi.mocked(submitHaiWork).mockResolvedValue({ taskId: "task-1", runId: "run-3", status: "queued", artifactId: null, error: null, replayed: false });
    renderPage();
    await openLatestPreview();
    await screen.findByText("# 第二版诊断");

    await user.type(screen.getByLabelText("继续对话"), "让建议更具体");
    await user.click(screen.getByRole("button", { name: "生成新版本" }));

    expect(submitHaiWork).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-1",
        parentArtifactId: "artifact-2",
        revisionInstruction: "让建议更具体",
      }),
    );
    expect(getHaiWorkTaskDetail).toHaveBeenCalledTimes(2);
  });

  it("confirms a diagnosis before generating an optimized lesson plan", async () => {
    const user = userEvent.setup();
    vi.mocked(submitHaiWork).mockResolvedValue({ taskId: "task-1", runId: "run-3", status: "queued", artifactId: null, error: null, replayed: false });
    renderPage();
    await openLatestPreview();
    await screen.findByText("# 第二版诊断");

    await user.click(screen.getByRole("button", { name: /确认报告无误，生成优化教案/ }));
    expect(screen.getByText("确认生成优化教案？")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认生成" }));

    expect(submitHaiWork).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-1",
        parentArtifactId: "artifact-2",
        revisionInstruction: expect.stringContaining("诊断报告已确认无误"),
        input: expect.objectContaining({
          lesson_plan: "教案",
          output_mode: "lesson-plan-optimization",
        }),
      }),
    );
  });

  it("shows the optimization action when the original lesson plan was uploaded", async () => {
    const uploadedLessonPlanDetail = {
      ...detail,
      task: { ...detail.task, latest_artifact_id: "artifact-1" },
      runs: [{
        ...detail.runs[1],
        input_snapshot: { ...detail.runs[1].input_snapshot, lesson_plan: "", material_ids: ["material-1"] },
      }],
      artifacts: [detail.artifacts[1]],
    } as unknown as HaiWorkTaskDetail;
    vi.mocked(getHaiWorkTaskDetail).mockResolvedValueOnce(uploadedLessonPlanDetail);

    renderPage();
    await openLatestPreview();

    expect(await screen.findByRole("button", { name: /确认报告无误，生成优化教案/ })).toBeInTheDocument();
  });
  it("keeps the old artifact visible after a queued revision and selects its new result when the worker finishes", async () => {
    const user = userEvent.setup();
    const newRun = { ...detail.runs[0], id: "run-3", status: "queued", execution_mode: "async", execution_phase: "queued" };
    const nextArtifact = { ...detail.artifacts[0], id: "artifact-3", run_id: "run-3", version_number: 3, content_markdown: "# 后台完成的新教案" };
    const queued = { ...detail, runs: [newRun, ...detail.runs] } as HaiWorkTaskDetail;
    const completed = { ...detail, runs: [{ ...newRun, status: "completed" }, ...detail.runs], artifacts: [nextArtifact, ...detail.artifacts] } as HaiWorkTaskDetail;
    vi.mocked(getHaiWorkTaskDetail).mockResolvedValueOnce(detail as HaiWorkTaskDetail)
      .mockResolvedValueOnce(queued).mockResolvedValueOnce(completed);
    vi.mocked(submitHaiWork).mockResolvedValue({ taskId: "task-1", runId: "run-3", status: "queued", artifactId: null, error: null, replayed: false });
    renderPage();
    await openLatestPreview();
    await screen.findByText("# 第二版诊断");
    await user.type(screen.getByLabelText("继续对话"), "补全评价");
    await user.click(screen.getByRole("button", { name: "生成新版本" }));
    expect(await screen.findByText(/任务已提交，正在排队/)).toBeInTheDocument();
    expect(screen.getByText("# 第二版诊断")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成新版本" })).toBeDisabled();
    expect(await screen.findByText("# 后台完成的新教案", {}, { timeout: 4500 })).toBeInTheDocument();
    expect(submitHaiWork).toHaveBeenCalledTimes(1);
  }, 6000);

  it("reuses the same request id when retrying an unconfirmed submission", async () => {
    const user = userEvent.setup();
    vi.mocked(getHaiWorkTaskDetail).mockResolvedValue(detail as HaiWorkTaskDetail);
    vi.mocked(submitHaiWork).mockRejectedValueOnce(new Error("提交回执暂未确认"));
    renderPage();
    await openLatestPreview();
    await screen.findByText("# 第二版诊断");
    await user.type(screen.getByLabelText("继续对话"), "同一修改要求");
    await user.click(screen.getByRole("button", { name: "生成新版本" }));
    await screen.findByText("提交回执暂未确认");
    await user.click(screen.getByRole("button", { name: "生成新版本" }));
    expect(submitHaiWork).toHaveBeenCalledTimes(2);
    expect(vi.mocked(submitHaiWork).mock.calls[0][0].clientRequestId).toBe(vi.mocked(submitHaiWork).mock.calls[1][0].clientRequestId);
  });

  it("keeps the overall design and all lesson files within one history version and previews each separately", async () => {
    const unitDetail: HaiWorkTaskDetail = { ...detail as HaiWorkTaskDetail, task: { ...detail.task as HaiWorkTask, module_slug: "unit-learning-design" }, artifacts: [{ ...detail.artifacts[0], content_json: { format: "unit_learning_package", files: [
      { kind: "unit", filename: "00_单元整体设计.md", title: "单元整体设计", markdown: "# 整体设计正文" },
      { kind: "lesson", filename: "01_第01课时_课题一.md", title: "课题一", markdown: "# 第一课完整教案" },
      { kind: "lesson", filename: "02_第02课时_课题二.md", title: "课题二", markdown: "# 第二课完整教案" },
    ] } }] };
    vi.mocked(getHaiWorkTaskDetail).mockResolvedValueOnce(unitDetail);
    renderPage();
    await openLatestPreview();
    const user = userEvent.setup();
    expect(await screen.findByText("# 整体设计正文")).toBeInTheDocument();
    expect(screen.getByText("1 份整体设计 · 2 份课时教案")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下载整套文件" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "预览 课题二" }));
    expect(screen.getByText("# 第二课完整教案")).toBeInTheDocument();
    expect(screen.queryByText("# 第一课完整教案")).not.toBeInTheDocument();
    expect(screen.queryByText("# 整体设计正文")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下载 课题一" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "复制产物" }));
    expect(await navigator.clipboard.readText()).toBe("# 第二课完整教案");
  });

  it("opens a lesson link from an older unit version without resetting to the overall design", async () => {
    const makeFiles = (version: number) => [
      { kind: "unit", filename: "00_unit.md", title: `整体设计 v${version}`, markdown: `# 整体 v${version}` },
      { kind: "lesson", filename: "01_lesson.md", title: `课时教案 v${version}`, markdown: `# 课时 v${version}` },
    ];
    vi.mocked(getHaiWorkTaskDetail).mockResolvedValueOnce({ ...detail, task: { ...detail.task, module_slug: "unit-learning-design" }, artifacts: detail.artifacts.map((artifact) => ({ ...artifact, content_json: { format: "unit_learning_package", files: makeFiles(artifact.version_number) } })) } as HaiWorkTaskDetail);
    renderPage();
    await openLatestPreview();
    const user = userEvent.setup();
    await screen.findByText("# 整体 v2");
    await user.click(screen.getByRole("button", { name: "预览 课时教案 v1" }));
    const preview = screen.getByRole("region", { name: "作品预览" });
    expect(within(preview).getByText("# 课时 v1")).toBeInTheDocument();
    expect(within(preview).queryByText("# 整体 v1")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "作品版本" })).toHaveValue("artifact-1");
    await user.click(screen.getByRole("button", { name: "复制产物" }));
    expect(await navigator.clipboard.readText()).toBe("# 课时 v1");
  });

});
