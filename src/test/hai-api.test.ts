import { getHaiImageGenerationTasks } from "@/db/hai-image-generation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getHaiConversations,
  getHaiMessages,
  getHaiStarterQuestions,
  getHaiChatModule,
  getHaiWorkTaskDetail,
  getHaiWorkTasks,
  getArchivedHaiWorkTasks,
  HAI_CHAT_MODULE_SLUG,
  HaiApiError,
  saveHaiModelProvider,
  type HaiFeatureModule,
  streamHaiChat,
  submitHaiWork,
} from "@/db/hai-api";

const { fromMock, getUserMock, getSessionMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  getUserMock: vi.fn(),
  getSessionMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/db/supabase", () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
    auth: {
      getUser: getUserMock,
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
  model_provider_id: null,
  surface_mode: "chat",
} satisfies HaiFeatureModule;

describe("HAI Chat module boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("queries only the enabled hai-chat chat module", async () => {
    const query = createQuery({ data: haiChatModule, error: null });
    fromMock.mockReturnValue(query);

    await expect(getHaiChatModule()).resolves.toEqual(haiChatModule);

    expect(fromMock).toHaveBeenCalledWith("hai_feature_modules");
    expect(query.eq).toHaveBeenCalledWith("surface_mode", "chat");
    expect(query.eq).toHaveBeenCalledWith("slug", HAI_CHAT_MODULE_SLUG);
    expect(query.eq).toHaveBeenCalledWith("is_enabled", true);
    expect(query.order).not.toHaveBeenCalled();
  });

  it("reports an explicit product error instead of returning an empty module list", async () => {
    fromMock.mockReturnValue(createQuery({ data: null, error: null }));

    await expect(getHaiChatModule()).rejects.toMatchObject({
      name: "HaiApiError",
      code: "chat_module_unavailable",
      message: "HAI Chat 当前未启用，请联系管理员检查模块和已发布 Skill。",
    });
  });

  it("distinguishes a module query failure from an unavailable module", async () => {
    fromMock.mockReturnValue(createQuery({
      data: null,
      error: { message: "network unavailable" },
    }));

    await expect(getHaiChatModule()).rejects.toEqual(expect.objectContaining({
      code: "service_unavailable",
      detail: "network unavailable",
    }));
  });

  it("always sends Chat to hai-chat and surfaces a missing published Skill", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: "该 Chat 模块没有可用 Skill，请管理员先发布、启用并绑定 Chat Skill。",
    }), {
      status: 503,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(streamHaiChat(
      { conversationId: null, message: "这节课应该先改哪里？" },
      { onEvent: vi.fn() },
    )).rejects.toThrow("该 Chat 模块没有可用 Skill，请管理员先发布、启用并绑定 Chat Skill。");

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toMatchObject({
      conversationId: null,
      message: "这节课应该先改哪里？",
      moduleSlug: "hai-chat",
      mode: "chat",
    });
  });

  it("consumes incremental tokens and answer replacement events", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response([
      'data: {"type":"ready","conversationId":"conversation-1","moduleSlug":"hai-chat"}\n\n',
      'data: {"type":"token","token":"草稿"}\n\n',
      'data: {"type":"replace","content":""}\n\n',
      'data: {"type":"token","token":"最终答案"}\n\n',
      'data: {"type":"done","conversationId":"conversation-1","messageId":"message-1"}\n\n',
    ].join(""), {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const onEvent = vi.fn();

    await streamHaiChat(
      { conversationId: null, message: "这节课应该先改哪里？" },
      { onEvent },
    );

    expect(onEvent.mock.calls.map(([event]) => event)).toEqual([
      { type: "ready", conversationId: "conversation-1", moduleSlug: "hai-chat" },
      { type: "token", token: "草稿" },
      { type: "replace", content: "" },
      { type: "token", token: "最终答案" },
      { type: "done", conversationId: "conversation-1", messageId: "message-1" },
    ]);
  });

  it("requests three personalized starters without creating a chat message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      questions: ["问题一？", "问题二？", "问题三？"],
      personalized: true,
      sourceCount: 5,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getHaiStarterQuestions()).resolves.toEqual({
      questions: ["问题一？", "问题二？", "问题三？"],
      personalized: true,
      sourceCount: 5,
      fallback: false,
    });

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request.body));
    expect(body).toMatchObject({
      action: "starter_questions",
      moduleSlug: "hai-chat",
    });
    expect(body).not.toHaveProperty("message");
  });
});

describe("HAI model provider persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts a new provider without sending an undefined id", async () => {
    const query = createQuery({ data: null, error: null });
    fromMock.mockReturnValue(query);

    await saveHaiModelProvider({
      label: " DeepSeek V4 Pro ",
      model_name: " deepseek-v4-pro ",
      api_key: " secret-key ",
      base_url: " https://api.deepseek.com ",
      is_enabled: true,
      sort_order: 2,
    });

    expect(query.insert).toHaveBeenCalledWith({
      label: "DeepSeek V4 Pro",
      provider_code: "deepseek",
      model_name: "deepseek-v4-pro",
      api_key: "secret-key",
      base_url: "https://api.deepseek.com",
      is_enabled: true,
      sort_order: 2,
    });
    expect(query.upsert).not.toHaveBeenCalled();
  });

  it("does not clear the stored API key when an edit leaves it blank", async () => {
    const query = createQuery({ data: null, error: null });
    fromMock.mockReturnValue(query);

    await saveHaiModelProvider({
      id: "provider-1",
      label: "DeepSeek V4 Pro",
      model_name: "deepseek-v4-pro",
      api_key: "   ",
      base_url: "https://api.deepseek.com",
      is_enabled: true,
      sort_order: 2,
    });

    expect(query.update).toHaveBeenCalledWith({
      label: "DeepSeek V4 Pro",
      provider_code: "deepseek",
      model_name: "deepseek-v4-pro",
      base_url: "https://api.deepseek.com",
      is_enabled: true,
      sort_order: 2,
    });
    expect(query.eq).toHaveBeenCalledWith("id", "provider-1");
  });

  it("turns a duplicate label conflict into an actionable message", async () => {
    const query = createQuery({
      data: null,
      error: {
        code: "23505",
        message: "duplicate key value violates unique constraint",
      },
    });
    fromMock.mockReturnValue(query);

    await expect(saveHaiModelProvider({
      label: "GLM",
      model_name: "glm-5",
      api_key: "secret-key",
      base_url: "https://open.bigmodel.cn/api/paas/v4",
      is_enabled: true,
      sort_order: 0,
    })).rejects.toThrow("配置名称“GLM”已存在，请编辑已有配置或使用不同名称。");
  });
});

describe("HAI Work task detail reliability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
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

describe("HAI Work task tool scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("filters names before the result limit, treating wildcard characters as literal text", async () => {
    const query = createQuery({ data: [], error: null });
    fromMock.mockReturnValue(query);
    const expected = String.raw`%50\%\_notes%`;
    await getHaiWorkTasks(undefined, "  50%_notes  ");
    expect(query.ilike).toHaveBeenCalledWith("title", expected);
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    await getArchivedHaiWorkTasks(undefined, "50%_notes");
    expect(query.ilike).toHaveBeenLastCalledWith("title", expected);
    await getHaiImageGenerationTasks("50%_notes");
    expect(query.ilike).toHaveBeenLastCalledWith("title", expected);
  });

  it("scopes active and archived task queries to a selected tool", async () => {
    const query = createQuery({ data: [], error: null });
    fromMock.mockReturnValue(query);

    await getHaiWorkTasks("lesson-diagnosis");
    expect(query.eq).toHaveBeenCalledWith("module_slug", "lesson-diagnosis");

    await getArchivedHaiWorkTasks("segment-optimization");
    expect(query.eq).toHaveBeenCalledWith("module_slug", "segment-optimization");
  });
});

describe("HAI personal data isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin-user" } }, error: null });
  });

  it("scopes the personal conversation list to the current user even for admins", async () => {
    const query = createQuery({ data: [], error: null });
    fromMock.mockReturnValue(query);

    await expect(getHaiConversations("admin-user")).resolves.toEqual([]);

    expect(fromMock).toHaveBeenCalledWith("hai_conversations");
    expect(query.eq).toHaveBeenCalledWith("user_id", "admin-user");
    expect(query.is).toHaveBeenCalledWith("archived_at", null);
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("scopes message reads to both conversation id and current user", async () => {
    const query = createQuery({ data: [], error: null });
    fromMock.mockReturnValue(query);

    await expect(getHaiMessages("conversation-from-sidebar", "admin-user")).resolves.toEqual([]);

    expect(fromMock).toHaveBeenCalledWith("hai_messages");
    expect(query.eq).toHaveBeenCalledWith("conversation_id", "conversation-from-sidebar");
    expect(query.eq).toHaveBeenCalledWith("user_id", "admin-user");
    expect(getUserMock).not.toHaveBeenCalled();
  });
});

describe("HAI Work asynchronous submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({ data: { session: { access_token: "token", user: { id: "owner" } } } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(["lesson-diagnosis", "segment-optimization", "subject-lesson-design", "teaching-design"] as const)("submits %s and returns immediately on a queued acknowledgement", async (toolSlug) => {
    const accepted = { taskId: "task", runId: "run", status: "queued", artifactId: null, error: null, replayed: false };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(accepted, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(submitHaiWork({ toolSlug, input: { topic: "背影" }, clientRequestId: "stable-request" })).resolves.toEqual(accepted);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ toolSlug, clientRequestId: "stable-request", responseMode: "json" });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("recovers the same owner-scoped run after losing the submission response without another POST", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("lost response"));
    vi.stubGlobal("fetch", fetchMock);
    const recovery = createQuery({ data: { id: "run", task_id: "task", status: "running", error_message: null }, error: null });
    fromMock.mockReturnValue(recovery);
    await expect(submitHaiWork({ toolSlug: "lesson-diagnosis", input: {}, clientRequestId: "stable-request" })).resolves.toMatchObject({ runId: "run", status: "running", replayed: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(recovery.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(recovery.eq).toHaveBeenCalledWith("client_request_id", "stable-request");
  });

  it("preserves the original error when the request was never accepted", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ message: "积分不足" }, { status: 429 })));
    fromMock.mockReturnValue(createQuery({ data: null, error: null }));
    await expect(submitHaiWork({ toolSlug: "lesson-diagnosis", input: {}, clientRequestId: "same-request" })).rejects.toThrow("积分不足");
  });
});

function createQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    upsert: vi.fn(() => query),
    eq: vi.fn(() => query),
    ilike: vi.fn(() => query),
    is: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    then: vi.fn((resolve, reject) => Promise.resolve(result).then(resolve, reject)),
  };
  return query;
}
