import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getHaiAccessStatus, getHaiTextbookCatalog, getHaiWorkTools, type HaiFeatureModule, streamHaiWork } from "@/db/hai-api";
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
  streamHaiWork: vi.fn(),
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
    expect(screen.getByRole("button", { name: "开始教案诊断" })).toBeDisabled();
    expect(screen.getByLabelText("上传补充材料")).toBeDisabled();
    expect(streamHaiWork).not.toHaveBeenCalled();
  });

  it("shows all four enabled work tools", async () => {
    renderAt("/hai/work");

    expect((await screen.findAllByRole("link", { name: /教案诊断/ })).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /环节优化/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /公开课设计/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /研发教学方案/ }).length).toBeGreaterThan(0);
    expect(screen.getByText("覆盖不同学科的公开课设计入口")).toBeInTheDocument();
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

    await screen.findByText("先把本课信息交给 HAI");
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
    await user.click(screen.getByRole("button", { name: "开始公开课设计" }));

    expect(streamHaiWork).toHaveBeenCalledWith(
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
      expect.any(Object),
    );
    expect(vi.mocked(streamHaiWork).mock.calls[0]?.[0].input).not.toHaveProperty("lesson_type");
  });

  it("supports mathematics from the built-in textbook catalog", async () => {
    const user = userEvent.setup();
    renderAt("/hai/work/subject-lesson-design");

    await screen.findByText("先把本课信息交给 HAI");
    await user.selectOptions(screen.getByRole("combobox", { name: "学科" }), "数学");
    await user.selectOptions(await screen.findByRole("combobox", { name: "年级" }), "7年级");
    await user.selectOptions(screen.getByRole("combobox", { name: "册次 / 教材" }), "上册");
    await user.selectOptions(screen.getByRole("combobox", { name: "单元" }), "第一单元 有理数");
    await user.selectOptions(screen.getByRole("combobox", { name: "课题" }), "第一课 正数和负数");
    expect(screen.queryByRole("radio", { name: /任务式/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "开始公开课设计" }));

    expect(streamHaiWork).toHaveBeenCalledWith(
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
      expect.any(Object),
    );
    expect(vi.mocked(streamHaiWork).mock.calls[0]?.[0].input).not.toHaveProperty("lesson_type");
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

    await screen.findByText("先把本课信息交给 HAI");
    await user.selectOptions(screen.getByRole("combobox", { name: "学科" }), "英语");
    const gradeField = await screen.findByRole("textbox", { name: "年级" });
    expect(screen.getByText(/当前学段与学科暂未收录内置教材/)).toBeInTheDocument();
    await user.type(gradeField, "八年级");
    await user.type(screen.getByRole("textbox", { name: "册次 / 教材" }), "上册");
    await user.type(screen.getByRole("textbox", { name: "单元" }), "Unit 1");
    await user.type(screen.getByRole("textbox", { name: /课题/ }), "My school");
    await user.type(screen.getByRole("textbox", { name: /教材内容/ }), "本课教材内容");
    await user.click(screen.getByRole("button", { name: "开始公开课设计" }));

    expect(streamHaiWork).toHaveBeenCalledWith(
      expect.objectContaining({
        toolSlug: "subject-lesson-design",
        input: expect.objectContaining({ subject: "英语", grade: "八年级", topic: "My school", teaching_mode: "" }),
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

    await screen.findByText("先把这份教案交给 HAI");
    await user.selectOptions(screen.getByRole("combobox", { name: /学科/ }), "语文");
    await user.selectOptions(await screen.findByRole("combobox", { name: "年级" }), "7年级");
    await user.selectOptions(screen.getByRole("combobox", { name: "册次 / 教材" }), "上册");
    await user.selectOptions(screen.getByRole("combobox", { name: "单元" }), "第一单元 少年有梦");
    await user.selectOptions(screen.getByRole("combobox", { name: "课题" }), "第一课 开启初中生活");
    await user.type(screen.getByRole("textbox", { name: /教案正文/ }), "教学目标：理解父爱。教学环节：教师讲解。教学评价：课堂提问。");
    await user.click(screen.getByRole("button", { name: "开始教案诊断" }));

    expect(await screen.findByTestId("task-page")).toBeInTheDocument();
    expect(streamHaiWork).toHaveBeenCalledWith(
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
      expect.any(Object),
    );
  });

  it("shows the shared Work subject list even when a textbook is not yet catalogued", async () => {
    const user = userEvent.setup();
    renderAt("/hai/work/lesson-diagnosis");

    await screen.findByText("先把这份教案交给 HAI");
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
      "数学",
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

    await screen.findByText("先把这份教案交给 HAI");
    await user.selectOptions(screen.getByRole("combobox", { name: /学段/ }), "小学");
    await user.selectOptions(screen.getByRole("combobox", { name: /学科/ }), "英语");
    expect(await screen.findByText(/当前学段与学科暂未收录内置教材/)).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "年级" }), "四年级");
    await user.type(screen.getByRole("textbox", { name: "册次 / 教材" }), "上册");
    await user.type(screen.getByRole("textbox", { name: "单元" }), "Unit 1");
    await user.type(screen.getByRole("textbox", { name: /课题/ }), "My school");
    await user.type(screen.getByRole("textbox", { name: /教材内容/ }), "本课教材内容");
    await user.type(screen.getByRole("textbox", { name: /教案正文/ }), "教学目标：理解并运用本课词汇。");
    await user.click(screen.getByRole("button", { name: "开始教案诊断" }));

    expect(streamHaiWork).toHaveBeenCalledWith(
      expect.objectContaining({
        toolSlug: "lesson-diagnosis",
        input: expect.objectContaining({ subject: "英语", grade: "四年级", textbook_content: "本课教材内容" }),
      }),
      expect.any(Object),
    );
  });

  it("rejects segment-optimization when current design and files are both empty", async () => {
    const user = userEvent.setup();
    renderAt("/hai/work/segment-optimization");

    await screen.findByText("先把这一环节交给 HAI");
    await user.selectOptions(screen.getByRole("combobox", { name: /学科/ }), "语文");
    await user.selectOptions(await screen.findByRole("combobox", { name: "年级" }), "7年级");
    await user.selectOptions(screen.getByRole("combobox", { name: "册次 / 教材" }), "上册");
    await user.selectOptions(screen.getByRole("combobox", { name: "单元" }), "第一单元 少年有梦");
    await user.selectOptions(screen.getByRole("combobox", { name: "课题" }), "第一课 开启初中生活");
    await user.selectOptions(screen.getByRole("combobox", { name: /要优化的环节/ }), "课程导入");
    await user.type(screen.getByRole("textbox", { name: /希望优化后达成什么效果/ }), "暴露前概念");
    await user.click(screen.getByRole("button", { name: /开始环节优化/ }));

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

    await screen.findByText("先把设计目标交给 HAI");
    await user.selectOptions(await screen.findByRole("combobox", { name: "年级" }), "7年级");
    await user.selectOptions(screen.getByRole("combobox", { name: "册次 / 教材" }), "上册");
    await user.selectOptions(screen.getByRole("combobox", { name: "单元" }), "第一单元 少年有梦");
    await user.selectOptions(screen.getByRole("combobox", { name: "课题" }), "第一课 开启初中生活");
    expect(screen.getByRole("combobox", { name: /框题（可选/ })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /单元逆向规划/ }));
    await user.type(screen.getByRole("textbox", { name: /课时 \/ 范围/ }), "6课时");
    await user.type(screen.getByRole("textbox", { name: /预期成果 \/ 任务说明/ }), "学生能够解释单元核心概念并迁移应用。 ");
    await user.click(screen.getByRole("button", { name: "开始研发教学方案" }));

    expect(streamHaiWork).toHaveBeenCalledWith(
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
      expect.any(Object),
    );
  });
});
