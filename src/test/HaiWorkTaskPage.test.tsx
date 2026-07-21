import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getHaiWorkTaskDetail, streamHaiWork } from "@/db/hai-api";
import HaiWorkTaskPage from "@/pages/HaiWorkTaskPage";

const { stableUser, detail } = vi.hoisted(() => ({
  stableUser: { id: "user-1" },
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
        input_snapshot: { stage: "初中", subject: "语文", topic: "背影", lesson_plan: "教案", material_ids: [] },
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

vi.mock("@/components/layout/Header", () => ({ default: () => null }));
vi.mock("@/components/common/PageMeta", () => ({ default: () => null }));
vi.mock("@/components/common/MarkdownRenderer", () => ({ default: ({ content }: { content: string }) => <div>{content}</div> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: stableUser, loading: false }) }));
vi.mock("@/db/hai-api", () => ({
  getHaiWorkTaskDetail: vi.fn().mockResolvedValue(detail),
  getHaiWorkTasks: vi.fn().mockResolvedValue([detail.task]),
  archiveHaiWorkTask: vi.fn(),
  streamHaiWork: vi.fn(),
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

describe("HAI Work task page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("restores the latest durable artifact and version navigation", async () => {
    renderPage();

    expect(await screen.findByText("# 第二版诊断")).toBeInTheDocument();
    expect(screen.getAllByText("版本 v2").length).toBeGreaterThan(0);
    expect(screen.getByText("通用 Skill 模式")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复制产物" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下载 Markdown" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打印或另存 PDF" })).toBeInTheDocument();
  });

  it("creates a child artifact when revising the selected version", async () => {
    const user = userEvent.setup();
    vi.mocked(streamHaiWork).mockImplementation(async (_payload, handlers) => {
      handlers.onEvent({ type: "done", taskId: "task-1", runId: "run-3", artifactId: "artifact-3", versionNumber: 3 });
    });
    renderPage();
    await screen.findByText("# 第二版诊断");

    await user.type(screen.getByPlaceholderText(/把导入压缩到 3 分钟/), "让建议更具体");
    await user.click(screen.getByRole("button", { name: "生成新版本" }));

    expect(streamHaiWork).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-1",
        parentArtifactId: "artifact-2",
        revisionInstruction: "让建议更具体",
      }),
      expect.any(Object),
    );
    expect(getHaiWorkTaskDetail).toHaveBeenCalledTimes(2);
  });
});
