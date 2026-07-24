import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getHaiChatModule,
  getHaiWorkTaskDetail,
  HAI_CHAT_MODULE_SLUG,
  HaiApiError,
  streamHaiChat,
  type HaiFeatureModule,
} from "@/db/hai-api";

const { fromMock, getSessionMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  getSessionMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/db/supabase", () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
    auth: {
      getSession: getSessionMock,
    },
  },
  typedSupabase: {
    from: fromMock,
  },
}));

const haiChatModule = {
  id: "module-hai-chat",
  slug: "hai-chat",
  name: "HAI Chat",
  short_label: "HAI Chat",
  description: "教学咨询",
  icon_key: "bot",
  category: "chat",
  input_schema: [],
  default_model: "test-model",
  default_temperature: 0.25,
  default_max_output_tokens: 2000,
  thinking_enabled: false,
  default_top_p: null,
  reasoning_effort: "high",
  response_format: "text",
  stop_sequences: [],
  history_message_limit: 20,
  memory_limit: 8,
  material_match_count: 0,
  knowledge_match_count: 0,
  sort_order: 1,
  is_enabled: true,
  surface_mode: "chat",
} satisfies HaiFeatureModule;

describe(“HAI Chat module boundary”, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: “access-token” } },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it(“queries only the enabled hai-chat chat module”, async () => {
    const query = createQuery({ data: haiChatModule, error: null });
    fromMock.mockReturnValue(query);

    await expect(getHaiChatModule()).resolves.toEqual(haiChatModule);

    expect(fromMock).toHaveBeenCalledWith(“hai_feature_modules”);
    expect(query.eq).toHaveBeenCalledWith(“surface_mode”, “chat”);
    expect(query.eq).toHaveBeenCalledWith(“slug”, HAI_CHAT_MODULE_SLUG);
    expect(query.eq).toHaveBeenCalledWith(“is_enabled”, true);
    expect(query.order).not.toHaveBeenCalled();
  });

  it(“reports an explicit product error instead of returning an empty module list”, async () => {
    fromMock.mockReturnValue(createQuery({ data: null, error: null }));

    await expect(getHaiChatModule()).rejects.toMatchObject({
      name: “HaiApiError”,
      code: “chat_module_unavailable”,
      message: “HAI Chat 当前未启用，请联系管理员检查模块和已发布 Skill。”,
    });
  });

  it(“distinguishes a module query failure from an unavailable module”, async () => {
    fromMock.mockReturnValue(createQuery({
      data: null,
      error: { message: “network unavailable” },
    }));

    await expect(getHaiChatModule()).rejects.toEqual(expect.objectContaining({
      code: “service_unavailable”,
      detail: “network unavailable”,
    }));
  });

  it(“always sends Chat to hai-chat and surfaces a missing published Skill”, async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: “该 Chat 模块没有可用 Skill，请管理员先发布、启用并绑定 Chat Skill。”,
    }), {
      status: 503,
      headers: { “content-type”: “application/json” },
    }));
    vi.stubGlobal(“fetch”, fetchMock);

    await expect(streamHaiChat(
      { conversationId: null, message: “这节课应该先改哪里？” },
      { onEvent: vi.fn() },
    )).rejects.toThrow(“该 Chat 模块没有可用 Skill，请管理员先发布、启用并绑定 Chat Skill。”);

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toMatchObject({
      conversationId: null,
      message: “这节课应该先改哪里？”,
      moduleSlug: “hai-chat”,
      mode: “chat”,
    });
  });
});

describe("HAI Work task detail reliability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockImplementation((table: string) => {
      if (table === "hai_work_tasks") {
        return createQuery({
          data: {
            id: "task-1",
            user_id: "user-1",
            module_slug: "lesson-diagnosis",
            title: "教案诊断",
            status: "active",
            latest_artifact_id: null,
            created_at: "2026-07-24T00:00:00.000Z",
            updated_at: "2026-07-24T00:00:00.000Z",
            archived_at: null,
          },
          error: null,
        });
      }
      if (table === "hai_work_runs" || table === "hai_work_artifacts") {
        return createQuery({ data: [], error: null });
      }
      throw new Error(`unexpected table: ${table}`);
    });
  });

  it("returns task data even when stale-run cleanup fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "cleanup denied" },
    });

    await expect(getHaiWorkTaskDetail("task-1")).resolves.toMatchObject({
      task: { id: "task-1" },
      runs: [],
      artifacts: [],
    });
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        "[HAI Work] 过期运行状态后台校正失败",
        { taskId: "task-1", message: "cleanup denied" },
      );
    });
    warn.mockRestore();
  });

  it("does not wait for stale-run cleanup before reading the task", async () => {
    rpcMock.mockReturnValue(new Promise(() => undefined));

    await expect(getHaiWorkTaskDetail("task-1")).resolves.toMatchObject({
      task: { id: "task-1" },
    });
  });

  it("turns a missing task into a stable domain error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "hai_work_tasks") {
        return createQuery({
          data: null,
          error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" },
        });
      }
      return createQuery({ data: [], error: null });
    });

    await expect(getHaiWorkTaskDetail("missing-task")).rejects.toEqual(
      expect.objectContaining({
        name: "HaiApiError",
        code: "task_not_found",
        message: "该 HAI Work 任务不存在或你无权访问。",
      } satisfies Partial<HaiApiError>),
    );
  });
});

function createQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
  };
  return query;
}
