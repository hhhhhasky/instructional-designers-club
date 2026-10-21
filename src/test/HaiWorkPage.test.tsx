import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getHaiAccessStatus, uploadHaiMaterial, getHaiTextbookCatalog, getHaiWorkTasks, getHaiWorkTools, type HaiFeatureModule, type HaiWorkTask, submitHaiWork } from "@/db/hai-api";
import HaiWorkPage from "@/pages/HaiWorkPage";

vi.mock("@/db/hai-image-generation", async (original) => ({ ...await original<object>(), getHaiImageGenerationTasks: vi.fn().mockResolvedValue([]) }));

vi.mock("@/components/layout/Header", () => ({ default: () => <div data-testid="global-header" /> }));
vi.mock("@/components/common/PageMeta", () => ({ default: () => null }));
const { stableUser, tools } = vi.hoisted(() => ({
  stableUser: { id: "user-1" },
  tools: [
    { slug: "lesson-diagnosis", name: "教案诊断", is_enabled: true, surface_mode: "work" },
    { slug: "segment-optimization", name: "环节优化", is_enabled: true, surface_mode: "work" },
    {
      slug: "subject-lesson-design",
      name: "公开课设计",
      description: "覆盖不同学科的公开课设计入口",
      is_enabled: true,
      surface_mode: "work",
    },
    { slug: "teaching-design", name: "研发教学方案", is_enabled: true, surface_mode: "work" },
  ] as HaiFeatureModule[],
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: stableUser, loading: false }),
}));

vi.mock("@/db/hai-api", () => ({
  getHaiAccessStatus: vi.fn().mockResolvedValue({ access: { authenticated: true, allowed: true }, usage: null }),
  getHaiWorkTools: vi.fn().mockResolvedValue(tools),
  getHaiWorkTasks: vi.fn().mockResolvedValue([]),
  getArchivedHaiWorkTasks: vi.fn().mockResolvedValue([]),
  getHaiTextbookCatalog: vi.fn().mockImplementation((_stage: string, subject: string) => Promise.resolve([{
      collection_slug: subject === "数学" ? "junior-math-grade-7-volume-1" : "junior-politics-grade-7-volume-1-2024",
      collection_title: subject === "数学" ? "数学七年级上册" : "道德与法治七年级上册",
      stage: "初中",
      subject,
      grade_level: 7,
      grade_label: "7年级",
      volume: "上册",
      edition_label: subject === "数学" ? "人教版" : "2024年秋统编新版",
      publication_status: "current",
      verification_status: "source_declared_current",
      requires_confirmation: false,
      unit_number: 1,
      unit_label: "第一单元",
      unit_title: subject === "数学" ? "有理数" : "少年有梦",
      lesson_number: 1,
      lesson_label: "第一课",
      lesson_title: subject === "数学" ? "正数和负数" : "开启初中生活",
      frame_number: subject === "数学" ? 0 : 1,
      frame_label: subject === "数学" ? "" : "第一框",
      frame_title: subject === "数学" ? "" : "奏响中学序曲",
      unit_route_number: 1,
      lesson_route_number: 1,
      frame_route_number: subject === "数学" ? null : 1,
    }])),
  uploadHaiMaterial: vi.fn(),
  submitHaiWork: vi.fn().mockResolvedValue({ taskId: "task-1", runId: "run-3", status: "queued", artifactId: null, error: null, replayed: false }),
}));

const defaultGetHaiTextbookCatalog = vi.mocked(getHaiTextbookCatalog).getMockImplementation()!;

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
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(getHaiAccessStatus).mockResolvedValue({
      access: { authenticated: true, allowed: true, quota_mode: "points", membership_level: "plus" },
      usage: {
        quota_mode: "points",
        membership_level: "plus",
        can_consume: true,
        current_points: 100,
        daily_used: 0,
        weekly_used: 0,
        daily_limit: 0,
        weekly_limit: 0,
      },
    });
    vi.mocked(getHaiTextbookCatalog).mockImplementation(defaultGetHaiTextbookCatalog);
  });

  it("keeps the Work page visible but disables paid actions when a Plus member has no points", async () => {
    vi.mocked(getHaiAccessStatus).mockResolvedValueOnce({
      access: {
        authenticated: true,
        allowed: true,
        quota_mode: "points",
        membership_level: "plus",
        status: "needs_points",
        can_consume: false,
      },
      usage: {
        quota_mode: "points",
        membership_level: "plus",
        can_consume: false,
        current_points: 0,
        daily_used: 0,
        weekly_used: 0,
        daily_limit: 0,
        weekly_limit: 0,
      },
    });

    renderAt("/hai/work/lesson-diagnosis");

    expect(await screen.findByText(/当前积分余额为 0/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提交教案诊断任务" })).toBeDisabled();
    expect(screen.getByLabelText("上传补充材料")).toBeDisabled();
    expect(submitHaiWork).not.toHaveBeenCalled();
  });

  it("shows all four enabled work tools", async () => {
    renderAt("/hai/work");

    expect((await screen.findAllByRole("button", { name: /教案诊断/ })).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /环节优化/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /公开课设计/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /研发教学方案/ }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("描述你的教学需求")).toBeInTheDocument();
  });

  it("removes a tool entry when the backend module is disabled", async () => {
    vi.mocked(getHaiWorkTools).mockResolvedValueOnce(tools.filter((item) => item.slug !== "segment-optimization"));
    renderAt("/hai/work");

    expect((await screen.findAllByRole("button", { name: /教案诊断/ })).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /环节优化/ })).not.toBeInTheDocument();
  });

  it("exposes the missing unit tool only as an interactive local preview", async () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("MODE", "development");
    renderAt("/hai/work");
    const user = userEvent.setup();
    const links = await screen.findAllByRole("button", { name: /大单元教学/ });
    await user.click(links[0]);
    expect(await screen.findByText(/本地界面预览：/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "单元内重构" }));
    await user.selectOptions(screen.getByLabelText("教材 1 · 年级 / 册次"), "junior-politics-grade-7-volume-1-2024");
    await user.click(screen.getByRole("radio", { name: "第一单元 少年有梦" }));
    expect(screen.getByRole("button", { name: "提交大单元教学任务" })).toBeDisabled();
    expect(screen.getByLabelText("上传补充材料")).toBeDisabled();
    expect(submitHaiWork).not.toHaveBeenCalled();
  });

  it("keeps an unpublished unit tool hidden in production", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("MODE", "production");
    renderAt("/hai/work");
    await screen.findAllByRole("button", { name: /教案诊断/ });
    expect(screen.queryByRole("button", { name: /大单元教学/ })).not.toBeInTheDocument();
  });

  it("renders recent tasks created by a newer backend module", async () => {
    vi.mocked(getHaiWorkTasks).mockResolvedValueOnce([{
      id: "future-task",
      user_id: "user-1",
      module_slug: "future-work-tool" as HaiWorkTask["module_slug"],
      title: "已有工作产物",
      status: "active",
      latest_artifact_id: null,
      created_at: "2026-10-21T08:00:00Z",
      updated_at: "2026-10-21T08:00:00Z",
      archived_at: null,
    }]);
    renderAt("/hai/work");

    expect(await screen.findAllByRole("link", { name: /已有工作产物/ })).toHaveLength(1);
  });

  it("opens settings immediately on selection and preserves the idea while switching tools", async () => {
    renderAt("/hai/work");
    const user = userEvent.setup();
    await screen.findByRole("button", { name: "教案诊断" });
    expect(screen.queryByRole("form", { name: "教案诊断设置" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "教案诊断" }));
    expect(await screen.findByRole("form", { name: "教案诊断设置" })).toBeInTheDocument();
    const composer = screen.getByRole("group", { name: "任务输入与设置" });
    expect(composer.querySelectorAll('input[type="file"]')).toHaveLength(1);
    expect(composer.querySelectorAll('button[type="submit"]')).toHaveLength(1);
    expect(within(composer).getByText("更多要求（选填）").closest("details")).not.toHaveAttribute("open");
    await user.type(screen.getByLabelText("描述你的教学需求"), "请重点检查学生的学习证据");
    await user.click(screen.getByRole("button", { name: "公开课设计" }));
    expect(await screen.findByRole("form", { name: "公开课设计设置" })).toBeInTheDocument();
    expect(screen.getByLabelText("描述你的教学需求")).toHaveValue("请重点检查学生的学习证据");
    expect(screen.getAllByRole("textbox", { name: "描述你的教学需求" })).toHaveLength(1);
    await user.click(screen.getByRole("link", { name: "新建任务" }));
    expect(await screen.findByLabelText("描述你的教学需求")).toHaveValue("");
    expect(screen.queryByRole("form", { name: "公开课设计设置" })).not.toBeInTheDocument();
  });

  it("uploads and removes files beside the idea, then submits the selected settings and attachment together", async () => {
    renderAt("/hai/work");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "教案诊断" }));
    const input = screen.getByLabelText("上传补充材料");
    const click = vi.spyOn(input, "click");
    await user.click(screen.getByRole("button", { name: "上传教案或教材" }));
    expect(click).toHaveBeenCalled();
    const file = new File(["完整的教案内容"], "我的教案.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    await user.upload(input, file);
    expect(screen.getByText("我的教案.docx")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "移除我的教案.docx" }));
    expect(screen.queryByText("我的教案.docx")).not.toBeInTheDocument();
    await user.upload(input, file);
    await user.type(screen.getByLabelText("描述你的教学需求"), "重点检查学习证据");
    await user.selectOptions(await screen.findByLabelText("年级"), "7年级");
    await user.selectOptions(screen.getByLabelText("册次 / 教材"), "上册");
    await user.selectOptions(screen.getByLabelText("单元"), "第一单元 少年有梦");
    await user.selectOptions(screen.getByLabelText("课题"), "第一课 开启初中生活");
    vi.mocked(uploadHaiMaterial).mockResolvedValueOnce({ id: "material-1" } as Awaited<ReturnType<typeof uploadHaiMaterial>>);
    await user.click(screen.getByRole("button", { name: "提交教案诊断任务" }));
    expect(await screen.findByTestId("task-page")).toBeInTheDocument();
    expect(uploadHaiMaterial).toHaveBeenCalledWith(expect.objectContaining({ file }));
    expect(submitHaiWork).toHaveBeenCalledWith(expect.objectContaining({ toolSlug: "lesson-diagnosis", materialIds: ["material-1"], input: expect.objectContaining({ constraints: "重点检查学习证据", topic: "第一课 开启初中生活" }) }));
  });

  it("expands image settings under the same request box without navigation", async () => {
    vi.mocked(getHaiWorkTools).mockResolvedValueOnce([...tools, { slug: "image-generation", name: "图片生成", is_enabled: true, surface_mode: "work" } as HaiFeatureModule]);
    renderAt("/hai/work");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "图片生成" }));
    expect(await screen.findByRole("form", { name: "图片生成设置" })).toBeInTheDocument();
    const composer = screen.getByRole("group", { name: "任务输入与设置" });
    expect(within(composer).getAllByRole("combobox")).toHaveLength(4);
    expect(composer.querySelectorAll('input[type="file"]')).toHaveLength(1);
    expect(composer.querySelectorAll('button[type="submit"]')).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "生成图片" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "图片尺寸" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "风格" })).toBeInTheDocument();
    expect(screen.queryByLabelText("图片提示词")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加参考图片" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("描述你的教学需求"), "画出水循环");
    await user.click(screen.getByRole("button", { name: "教案诊断" }));
    expect(await screen.findByRole("form", { name: "教案诊断设置" })).toBeInTheDocument();
    expect(screen.getByLabelText("描述你的教学需求")).toHaveValue("画出水循环");
  });

  it("submits subject lesson generation from the built-in textbook catalog without an upload", async () => {
    const user = userEvent.setup();
    renderAt("/hai/work/subject-lesson-design");

    await screen.findByRole("form", { name: "公开课设计设置" });
    expect(screen.getByLabelText("学段")).toHaveTextContent("初中");
    expect(screen.getByLabelText("学科")).toHaveTextContent("道德与法治");
    expect(screen.getByRole("option", { name: "小学" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "高中" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "其他（中职/高职/高校等）" })).toBeInTheDocument();
    const subjectSelect = screen.getByRole("combobox", { name: "学科" }) as HTMLSelectElement;
    expect(Array.from(subjectSelect.options).map((option) => option.textContent)).toEqual([
      "请选择",
      "语文",
      "数学",
      "英语",
      "物理",
      "化学",
      "生物",
      "地理",
      "历史",
      "道德与法治",
      "信息科技",
      "心理健康",
      "音乐",
      "美术",
      "体育",
      "综合实践",
    ]);
    await user.selectOptions(await screen.findByRole("combobox", { name: "年级" }), "7年级");
    await user.selectOptions(screen.getByRole("combobox", { name: "册次 / 教材" }), "上册");
    await user.selectOptions(screen.getByRole("combobox", { name: "单元" }), "第一单元 少年有梦");
    await user.selectOptions(screen.getByRole("combobox", { name: "课题" }), "第一课 开启初中生活");
    await user.click(screen.getByRole("radio", { name: /案例式/ }));
    await user.click(screen.getByRole("button", { name: "提交公开课设计任务" }));

    expect(submitHaiWork).toHaveBeenCalledWith(
      expect.objectContaining({
        toolSlug: "subject-lesson-design",
        materialIds: [],
        input: expect.objectContaining({
          grade: "7年级",
          volume: "上册",
          unit: "第一单元 少年有梦",
          topic: "第一课 开启初中生活",
          collection_slug: "junior-politics-grade-7-volume-1-2024",
          unit_route_number: "1",
          lesson_route_number: "1",
          teaching_mode: "案例式",
        }),
      }),
    );
    expect(vi.mocked(submitHaiWork).mock.calls[0]?.[0].input).not.toHaveProperty("lesson_type");
  });

  it("supports mathematics from the built-in textbook catalog", async () => {
    const user = userEvent.setup();
    renderAt("/hai/work/subject-lesson-design");

    await screen.findByRole("form", { name: "公开课设计设置" });
    await user.selectOptions(screen.getByRole("combobox", { name: "学科" }), "数学");
    await user.selectOptions(await screen.findByRole("combobox", { name: "年级" }), "7年级");
    await user.selectOptions(screen.getByRole("combobox", { name: "册次 / 教材" }), "上册");
    await user.selectOptions(screen.getByRole("combobox", { name: "单元" }), "第一单元 有理数");
    await user.selectOptions(screen.getByRole("combobox", { name: "课题" }), "第一课 正数和负数");
    expect(screen.queryByRole("radio", { name: /任务式/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "提交公开课设计任务" }));

    expect(submitHaiWork).toHaveBeenCalledWith(
      expect.objectContaining({
        toolSlug: "subject-lesson-design",
        input: expect.objectContaining({
          stage: "初中",
          subject: "数学",
          topic: "第一课 正数和负数",
          collection_slug: "junior-math-grade-7-volume-1",
          unit_route_number: "1",
          lesson_route_number: "1",
          frame_route_number: "",
          teaching_mode: "",
        }),
      }),
    );
    expect(vi.mocked(submitHaiWork).mock.calls[0]?.[0].input).not.toHaveProperty("lesson_type");
  });

  it("lets an uncovered public-lesson subject use the manual textbook path", async () => {
    const user = userEvent.setup();
    vi.mocked(getHaiTextbookCatalog).mockImplementation((stage, subject) =>
      subject === "英语" ? Promise.resolve([]) : Promise.resolve([{
        collection_slug: "junior-politics-grade-7-volume-1-2024",
        collection_title: "道德与法治七年级上册",
        stage: String(stage ?? ""),
        subject: String(subject ?? ""),
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
        unit_route_number: 1,
        lesson_route_number: 1,
        frame_route_number: 1,
      }]));
    renderAt("/hai/work/subject-lesson-design");

    await screen.findByRole("form", { name: "公开课设计设置" });
    await user.selectOptions(screen.getByRole("combobox", { name: "学科" }), "英语");
    const gradeField = await screen.findByRole("textbox", { name: "年级" });
    expect(screen.getByText(/当前学段与学科暂未收录内置教材/)).toBeInTheDocument();
    await user.type(gradeField, "八年级");
    await user.type(screen.getByRole("textbox", { name: "册次 / 教材" }), "上册");
    await user.type(screen.getByRole("textbox", { name: "单元" }), "Unit 1");
    await user.type(screen.getByRole("textbox", { name: /课题/ }), "My school");
    await user.type(screen.getByRole("textbox", { name: /教材内容/ }), "本课教材内容");
    await user.click(screen.getByRole("button", { name: "提交公开课设计任务" }));

    expect(submitHaiWork).toHaveBeenCalledWith(
      expect.objectContaining({
        toolSlug: "subject-lesson-design",
        input: expect.objectContaining({ subject: "英语", grade: "八年级", topic: "My school", teaching_mode: "" }),
      }),
    );
  });

  it("submits a pasted lesson plan and opens the durable task", async () => {
    const user = userEvent.setup();
    vi.mocked(submitHaiWork).mockResolvedValue({ taskId: "task-1", runId: "run-3", status: "queued", artifactId: null, error: null, replayed: false });
    renderAt("/hai/work/lesson-diagnosis");

    await screen.findByRole("form", { name: "教案诊断设置" });
    await user.selectOptions(screen.getByRole("combobox", { name: /学科/ }), "语文");
    await user.selectOptions(await screen.findByRole("combobox", { name: "年级" }), "7年级");
    await user.selectOptions(screen.getByRole("combobox", { name: "册次 / 教材" }), "上册");
    await user.selectOptions(screen.getByRole("combobox", { name: "单元" }), "第一单元 少年有梦");
    await user.selectOptions(screen.getByRole("combobox", { name: "课题" }), "第一课 开启初中生活");
    await user.click(screen.getByText(/粘贴正文（也可用上方/));
    await user.type(screen.getByRole("textbox", { name: /教案正文/ }), "教学目标：理解父爱。教学环节：教师讲解。教学评价：课堂提问。");
    await user.click(screen.getByRole("button", { name: "提交教案诊断任务" }));

    expect(await screen.findByTestId("task-page")).toBeInTheDocument();
    expect(submitHaiWork).toHaveBeenCalledWith(
      expect.objectContaining({
        toolSlug: "lesson-diagnosis",
        materialIds: [],
        input: expect.objectContaining({
          grade: "7年级",
          volume: "上册",
          unit: "第一单元 少年有梦",
          topic: "第一课 开启初中生活",
          collection_slug: "junior-politics-grade-7-volume-1-2024",
          unit_route_number: "1",
          lesson_route_number: "1",
        }),
      }),
    );
  });

  it("shows the shared Work subject list even when a textbook is not yet catalogued", async () => {
    const user = userEvent.setup();
    renderAt("/hai/work/lesson-diagnosis");

    await screen.findByRole("form", { name: "教案诊断设置" });
    await user.selectOptions(screen.getByRole("combobox", { name: /学段/ }), "小学");
    const subjectSelect = screen.getByRole("combobox", { name: /学科/ }) as HTMLSelectElement;
    expect(Array.from(subjectSelect.options).map((option) => option.textContent)).toEqual([
      "请选择",
      "语文",
      "数学",
      "英语",
      "道德与法治",
      "科学",
      "信息科技",
      "心理健康",
      "音乐",
      "美术",
      "体育",
      "综合实践",
    ]);
    expect(screen.getByRole("option", { name: "英语" })).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: /学段/ }), "高中");
    expect(Array.from(subjectSelect.options).map((option) => option.textContent)).toEqual([
      "请选择",
      "语文",
      "高中数学 A版",
      "高中数学 B版",
      "英语",
      "物理",
      "化学",
      "生物",
      "地理",
      "历史",
      "思想政治",
      "信息科技",
      "心理健康",
      "音乐",
      "美术",
      "体育",
      "综合实践",
      "通用技术",
    ]);
  });

  it("lets an uncovered lesson-diagnosis subject use the shared manual textbook path", async () => {
    const user = userEvent.setup();
    vi.mocked(getHaiTextbookCatalog).mockResolvedValue([]);
    renderAt("/hai/work/lesson-diagnosis");

    await screen.findByRole("form", { name: "教案诊断设置" });
    await user.selectOptions(screen.getByRole("combobox", { name: /学段/ }), "小学");
    await user.selectOptions(screen.getByRole("combobox", { name: /学科/ }), "英语");
    expect(await screen.findByText(/当前学段与学科暂未收录内置教材/)).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "年级" }), "四年级");
    await user.type(screen.getByRole("textbox", { name: "册次 / 教材" }), "上册");
    await user.type(screen.getByRole("textbox", { name: "单元" }), "Unit 1");
    await user.type(screen.getByRole("textbox", { name: /课题/ }), "My school");
    await user.type(screen.getByRole("textbox", { name: /教材内容/ }), "本课教材内容");
    await user.click(screen.getByText(/粘贴正文（也可用上方/));
    await user.type(screen.getByRole("textbox", { name: /教案正文/ }), "教学目标：理解并运用本课词汇。");
    await user.click(screen.getByRole("button", { name: "提交教案诊断任务" }));

    expect(submitHaiWork).toHaveBeenCalledWith(
      expect.objectContaining({
        toolSlug: "lesson-diagnosis",
        input: expect.objectContaining({ subject: "英语", grade: "四年级", textbook_content: "本课教材内容" }),
      }),
    );
  });

  it("rejects segment-optimization when current design and files are both empty", async () => {
    const user = userEvent.setup();
    renderAt("/hai/work/segment-optimization");

    await screen.findByRole("form", { name: "环节优化设置" });
    await user.selectOptions(screen.getByRole("combobox", { name: /学科/ }), "语文");
    await user.selectOptions(await screen.findByRole("combobox", { name: "年级" }), "7年级");
    await user.selectOptions(screen.getByRole("combobox", { name: "册次 / 教材" }), "上册");
    await user.selectOptions(screen.getByRole("combobox", { name: "单元" }), "第一单元 少年有梦");
    await user.selectOptions(screen.getByRole("combobox", { name: "课题" }), "第一课 开启初中生活");
    await user.selectOptions(screen.getByRole("combobox", { name: /要优化的环节/ }), "课程导入");
    await user.click(screen.getByText(/粘贴正文（也可用上方/));
    await user.type(screen.getByRole("textbox", { name: /希望优化后达成什么效果/ }), "暴露前概念");
    await user.click(screen.getByRole("button", { name: /提交环节优化任务/ }));

    expect(await screen.findByText("请粘贴当前环节设计，或上传环节设计文件。")).toBeInTheDocument();
  });

  it("only exposes the four currently supported segment types", async () => {
    renderAt("/hai/work/segment-optimization");

    const segmentSelect = await screen.findByRole("combobox", { name: /要优化的环节/ });
    expect(Array.from(segmentSelect.querySelectorAll("option")).map((option) => option.textContent).filter((label) => label !== "请选择")).toEqual([
      "课程导入",
      "问题链",
      "任务活动",
      "评价反馈",
    ]);
    expect(screen.queryByRole("option", { name: "教师讲解" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "合作探究" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "练习迁移" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "课堂总结" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "其他" })).not.toBeInTheDocument();
  });

  it("uses the same textbook hierarchy for teaching design", async () => {
    const user = userEvent.setup();
    renderAt("/hai/work/teaching-design");

    await screen.findByRole("form", { name: "研发教学方案设置" });
    await user.selectOptions(await screen.findByRole("combobox", { name: "年级" }), "7年级");
    await user.selectOptions(screen.getByRole("combobox", { name: "册次 / 教材" }), "上册");
    await user.selectOptions(screen.getByRole("combobox", { name: "单元" }), "第一单元 少年有梦");
    await user.selectOptions(screen.getByRole("combobox", { name: "课题" }), "第一课 开启初中生活");
    expect(screen.getByRole("combobox", { name: /框题（可选/ })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("设计类型"), "backwards-design");
    await user.type(screen.getByRole("textbox", { name: /课时 \/ 范围/ }), "6课时");
    await user.type(screen.getByLabelText("描述你的教学需求"), "学生能够解释单元核心概念并迁移应用。 ");
    await user.click(screen.getByRole("button", { name: "提交研发教学方案任务" }));

    expect(submitHaiWork).toHaveBeenCalledWith(
      expect.objectContaining({
        toolSlug: "teaching-design",
        input: expect.objectContaining({
          grade: "7年级",
          volume: "上册",
          unit: "第一单元 少年有梦",
          topic: "第一课 开启初中生活",
          collection_slug: "junior-politics-grade-7-volume-1-2024",
          unit_route_number: "1",
          lesson_route_number: "1",
          design_type: "backwards-design",
        }),
      }),
    );
  });
  it("collects one full unit without requiring lesson or frame fields", async () => {
    vi.mocked(getHaiWorkTools).mockResolvedValueOnce([...tools, { slug: "unit-learning-design", name: "大单元教学", is_enabled: true, surface_mode: "work" } as HaiFeatureModule]);
    renderAt("/hai/work/unit-learning-design");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "提交大单元教学任务" }));
    expect(screen.getByText("请选择重构范围。")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "单元内重构" }));
    await user.selectOptions(screen.getByLabelText("教材 1 · 年级 / 册次"), "junior-politics-grade-7-volume-1-2024");
    await user.click(screen.getByRole("radio", { name: "第一单元 少年有梦" }));
    expect(screen.queryByLabelText("课题")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "提交大单元教学任务" }));
    expect(submitHaiWork).toHaveBeenCalledWith(expect.objectContaining({ toolSlug: "unit-learning-design", input: expect.objectContaining({ reconstruction_scope: "within-unit", textbook_selections: [{ collection_slug: "junior-politics-grade-7-volume-1-2024", units: [{ unit_number: 1 }] }] }) }));
  });

  it("collects partial lessons across same-book units and clears the selection on scope changes", async () => {
    const row = (await defaultGetHaiTextbookCatalog("初中", "道德与法治"))[0];
    vi.mocked(getHaiTextbookCatalog).mockResolvedValueOnce([row, { ...row, unit_route_number: 2, unit_label: "第二单元", unit_title: "成长", lesson_route_number: 2, lesson_label: "第二课", lesson_title: "学习" }]);
    vi.mocked(getHaiWorkTools).mockResolvedValueOnce([...tools, { slug: "unit-learning-design", name: "大单元教学", is_enabled: true, surface_mode: "work" } as HaiFeatureModule]);
    renderAt("/hai/work/unit-learning-design");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: "教材内重构" }));
    await user.selectOptions(screen.getByLabelText("教材 1 · 年级 / 册次"), row.collection_slug);
    await user.click(screen.getByRole("checkbox", { name: "第一单元 少年有梦" }));
    await user.click(screen.getByRole("checkbox", { name: "第二单元 成长" }));
    await user.click(screen.getAllByRole("checkbox", { name: /完整单元/ })[0]);
    await user.click(screen.getByRole("checkbox", { name: "第一课 开启初中生活" }));
    await user.click(screen.getByRole("button", { name: "提交大单元教学任务" }));
    expect(submitHaiWork).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ textbook_selections: [{ collection_slug: row.collection_slug, units: [{ unit_number: 1, lessons: [{ lesson_number: 1 }] }, { unit_number: 2 }] }] }) }));
  });

  it("requires two distinct textbooks and resets old books when the scope or subject changes", async () => {
    const row = (await defaultGetHaiTextbookCatalog("初中", "道德与法治"))[0];
    vi.mocked(getHaiTextbookCatalog).mockResolvedValueOnce([row, { ...row, collection_slug: "book-2", grade_label: "8年级", collection_title: "八上" }]);
    vi.mocked(getHaiWorkTools).mockResolvedValueOnce([...tools, { slug: "unit-learning-design", name: "大单元教学", is_enabled: true, surface_mode: "work" } as HaiFeatureModule]);
    renderAt("/hai/work/unit-learning-design");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: "跨教材重构" }));
    await user.selectOptions(screen.getByLabelText("教材 1 · 年级 / 册次"), row.collection_slug);
    await user.click(screen.getByRole("checkbox", { name: "第一单元 少年有梦" }));
    await user.click(screen.getByRole("button", { name: "提交大单元教学任务" }));
    expect(screen.getByText("跨教材重构请至少选择两本教材。")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "添加另一本教材" }));
    await user.selectOptions(screen.getByLabelText("教材 2 · 年级 / 册次"), "book-2");
    await user.click(screen.getAllByRole("checkbox", { name: "第一单元 少年有梦" })[1]);
    await user.click(screen.getByRole("radio", { name: "单元内重构" }));
    expect(screen.queryByLabelText("教材 2 · 年级 / 册次")).not.toBeInTheDocument();
    expect(screen.getByLabelText("教材 1 · 年级 / 册次")).toHaveValue("");
    await user.selectOptions(screen.getByLabelText("学科"), "数学");
    expect(screen.getByLabelText("教材 1 · 年级 / 册次")).toHaveValue("");
  });

});
