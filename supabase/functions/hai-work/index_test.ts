import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { stub } from "https://deno.land/std@0.224.0/testing/mock.ts";

// Run the real HTTP handler and Supabase client; all transport is in-memory.
Deno.test("Work submission acknowledges every tool and revision without waiting for a model", async (test) => {
  const env = {
    SUPABASE_URL: "https://work-db.example.test",
    SUPABASE_SECRET_KEYS: '{"default":"test-secret"}',
    SUPABASE_PUBLISHABLE_KEYS: '{"default":"test-publishable"}',
  };
  const previous = Object.fromEntries(
    Object.keys(env).map((key) => [key, Deno.env.get(key)]),
  );
  const userId = "10000000-0000-4000-8000-000000000001";
  type Row = Record<string, any>;
  const runs = new Map<string, Row>();
  const tasks = new Map<string, Row>();
  const jobs: Row[] = [];
  let ready = true;
  let loseEnqueueResponse = false;
  let reserved = 0;
  let finalized = 0;
  let handler!: (request: Request) => Promise<Response>;
  const serve = stub(
    Deno,
    "serve",
    ((callback: typeof handler) => {
      handler = callback;
      return {};
    }) as unknown as typeof Deno.serve,
  );
  const transport = stub(globalThis, "fetch", async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input
        : input.url,
    );
    if (url.hostname !== "work-db.example.test") {
      throw new Error(`Unexpected external request: ${url.hostname}`);
    }
    const options = init as { body?: unknown; method?: string } | undefined;
    const body = options?.body ? JSON.parse(String(options.body)) : {};
    const name = url.pathname.split("/").at(-1)!;
    if (url.pathname === "/auth/v1/user") {
      return Response.json({
        id: userId,
        aud: "authenticated",
        role: "authenticated",
      });
    }
    if (url.pathname.includes("/rpc/")) {
      switch (name) {
        case "hai_access_status":
          return Response.json({ allowed: true });
        case "hai_work_queue_ready":
          return Response.json(ready);
        case "hai_list_textbook_catalog":
        case "hai_match_politics_cases":
          return Response.json([]);
        case "hai_check_and_reserve_usage":
          reserved++;
          return Response.json({ allowed: true });
        case "hai_finalize_usage":
          finalized++;
          return Response.json(null);
        case "hai_dispatch_work_jobs":
          return Response.json(1);
        case "hai_prepare_work_run": {
          const requestId = body.p_client_request_id;
          if (runs.has(requestId)) {
            return Response.json({ ...runs.get(requestId), replayed: true });
          }
          const taskId = body.p_task_id || crypto.randomUUID();
          tasks.set(taskId, {
            id: taskId,
            module_slug: body.p_module_slug,
            status: "active",
          });
          const row = {
            ...body.p_run,
            id: crypto.randomUUID(),
            task_id: taskId,
            user_id: userId,
            client_request_id: requestId,
            status: "queued",
          };
          runs.set(requestId, row);
          return Response.json({ ...row, replayed: false });
        }
        case "hai_enqueue_work_job": {
          jobs.push(body);
          if (loseEnqueueResponse) {
            throw new TypeError("response lost after commit");
          }
          return Response.json(null);
        }
        default:
          throw new Error(`Unexpected RPC: ${name}`);
      }
    }
    if (name === "hai_work_runs") {
      const requestId = url.searchParams.get("client_request_id")?.replace(
        /^eq\./,
        "",
      );
      if (options?.method === "PATCH") {
        finalized++;
        return Response.json(null);
      }
      return Response.json(
        requestId && runs.has(requestId) ? [runs.get(requestId)] : [],
      );
    }
    if (name === "hai_feature_modules") {
      return Response.json([{
        slug: "tool",
        name: "test",
        default_model: "deepseek-v4-flash",
        default_max_output_tokens: 4096,
        thinking_enabled: false,
      }]);
    }
    if (name === "hai_work_tasks") {
      return Response.json(
        [...tasks.values()].filter((x) =>
          `eq.${x.id}` === url.searchParams.get("id")
        ),
      );
    }
    if (name === "hai_work_artifacts") {
      return Response.json([{
        id: "20000000-0000-4000-8000-000000000001",
        content_markdown: "# 已确认诊断",
        content_json: {},
      }]);
    }
    if (["hai_work_debug_traces", "hai_work_task_materials"].includes(name)) {
      return Response.json(null);
    }
    if (["hai_work_skills", "hai_runtime_settings"].includes(name)) {
      return Response.json([]);
    }
    throw new Error(`Unexpected table: ${name}`);
  });
  const baseInput = {
    stage: "初中",
    subject: "数学",
    grade: "7年级",
    volume: "上册",
    unit: "第一单元",
    topic: "正数和负数",
    textbook_content: "正数和负数的意义。",
    lesson_plan: "原始教案",
    segment_type: "导入",
    current_design: "教师讲解",
    desired_outcome: "学生理解",
    design_type: "单课",
    desired_outcomes: "理解意义",
    unit_duration: "40分钟",
  };
  const call = (body: Row, token = true) =>
    handler(
      new Request("https://local/hai-work", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: "Bearer test-user-token" } : {}),
        },
        body: JSON.stringify({ responseMode: "json", ...body }),
      }),
    );
  try {
    for (const [key, value] of Object.entries(env)) Deno.env.set(key, value);
    await import("./index.ts");
    await test.step("unauthenticated requests are rejected before creating jobs", async () => {
      assertEquals((await call({}, false)).status, 401);
      assertEquals(jobs.length, 0);
    });
    await test.step("all four tools return queued acknowledgements and retain prompts server-side", async () => {
      for (
        const toolSlug of [
          "lesson-diagnosis",
          "segment-optimization",
          "subject-lesson-design",
          "teaching-design",
        ]
      ) {
        const response = await call({
          toolSlug,
          input: baseInput,
          clientRequestId: toolSlug,
        });
        assertEquals(response.status, 202, await response.clone().text());
        const payload = await response.json();
        assertEquals(payload.status, "queued");
        assertEquals(Boolean(payload.taskId && payload.runId), true);
        assertEquals("prompt" in payload, false);
      }
      assertEquals(jobs.length, 4);
      assertEquals(reserved, 4);
      assertEquals(JSON.stringify(jobs).includes("test-user-token"), false);
    });
    await test.step("replaying an in-flight request returns its task without reserving or enqueuing again", async () => {
      const response = await call({
        toolSlug: "lesson-diagnosis",
        input: baseInput,
        clientRequestId: "lesson-diagnosis",
      });
      assertEquals(response.status, 202);
      assertEquals((await response.json()).replayed, true);
      assertEquals(jobs.length, 4);
      assertEquals(reserved, 4);
    });
    await test.step("diagnosis-to-lesson optimization and a long revision both use the same queue", async () => {
      const taskId = runs.get("lesson-diagnosis")!.task_id;
      for (
        const [mode, instruction] of [[
          "lesson-plan-optimization",
          "诊断已确认，生成优化教案",
        ], ["diagnosis", "按这份长文继续追改"]]
      ) {
        const response = await call({
          toolSlug: "lesson-diagnosis",
          input: { ...baseInput, output_mode: mode },
          taskId,
          parentArtifactId: "20000000-0000-4000-8000-000000000001",
          revisionInstruction: instruction,
        });
        assertEquals(response.status, 202);
      }
      assertEquals(jobs.length, 6);
      assertEquals(jobs[4].p_payload.artifactKind, "lesson_plan_optimization");
      assertStringIncludes(jobs[5].p_payload.prompt.user, "按这份长文继续追改");
    });
    await test.step("an unconfigured executor rejects submission before quota is reserved", async () => {
      ready = false;
      const before = reserved;
      assertEquals(
        (await call({ toolSlug: "lesson-diagnosis", input: baseInput })).status,
        503,
      );
      assertEquals(reserved, before);
      ready = true;
    });
    await test.step("lost enqueue acknowledgement never marks an accepted paid job failed", async () => {
      loseEnqueueResponse = true;
      const before = finalized;
      const response = await call({
        toolSlug: "lesson-diagnosis",
        input: baseInput,
        clientRequestId: "lost-ack",
      });
      assertEquals(response.status, 503);
      assertEquals(finalized, before);
      assertEquals(runs.get("lost-ack")!.status, "queued");
      loseEnqueueResponse = false;
    });
    await test.step("previously opened clients get a short ready event instead of a long model stream", async () => {
      const response = await call({
        toolSlug: "lesson-diagnosis",
        input: baseInput,
        responseMode: undefined,
      });
      assertEquals(
        response.headers.get("content-type")?.startsWith("text/event-stream"),
        true,
      );
      assertStringIncludes(await response.text(), '"type":"ready"');
    });
  } finally {
    serve.restore();
    transport.restore();
    for (const [key, value] of Object.entries(previous)) {
      value == null ? Deno.env.delete(key) : Deno.env.set(key, value);
    }
  }
});
