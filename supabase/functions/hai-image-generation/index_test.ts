import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { S3Client } from "npm:@aws-sdk/client-s3@3.1048.0";
import { stub } from "https://deno.land/std@0.224.0/testing/mock.ts";

// Exercise the real handler and Supabase clients with in-memory HTTP transport.
// No provider POST, R2 upload, database mutation or points spend leaves this test.
Deno.test("image handler enforces final deadlines and acknowledgement-only settlement", async (test) => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const taskId = "22222222-2222-4222-8222-222222222222";
  type Row = Record<string, any>;
  const env: Record<string, string> = {
    SUPABASE_URL: "https://db.example.test",
    SUPABASE_SECRET_KEYS: JSON.stringify({ default: "test-secret" }),
    SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: "test-publishable" }),
    HAI_COURSEWARE_IMAGE_PROVIDER: "toapis",
    HAI_COURSEWARE_IMAGE_API_KEY: "test-provider-key",
    HAI_COURSEWARE_IMAGE_BASE_URL: "https://provider.example.test/images",
    HAI_COURSEWARE_IMAGE_MODEL: "image-model",
    R2_SECRET_ACCESS_KEY: "test-signature-key",
    R2_ACCOUNT_ID: "test-account",
    R2_ACCESS_KEY_ID: "test-r2-key",
    R2_PUBLIC_URL: "https://image.example.test",
  };
  const previousEnv = Object.fromEntries(
    Object.keys(env).map((name) => [name, Deno.env.get(name)]),
  );
  let handler!: (request: Request) => Promise<Response>;
  const serveStub = stub(
    Deno,
    "serve",
    ((callback: typeof handler) => {
      handler = callback;
      return {};
    }) as unknown as typeof Deno.serve,
  );
  const work: Promise<unknown>[] = [];
  const globals = globalThis as unknown as {
    EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void };
  };
  const previousRuntime = globals.EdgeRuntime;
  globals.EdgeRuntime = {
    waitUntil: (promise) => {
      work.push(promise);
    },
  };
  const rows: Row[] = [];
  const task = { id: taskId, user_id: userId, title: "test" };
  let posts = 0,
    providerQueries = 0,
    failedSettlements = 0,
    completedSettlements = 0;
  let storageWrites = 0;
  const storageStub = stub(S3Client.prototype, "send", async () => {
    storageWrites++;
    return {};
  });
  let resolveReceipt!: (response: Response) => void;
  let startedProvider!: () => void;
  const providerStarted = new Promise<void>((resolve) => {
    startedProvider = resolve;
  });
  let nextReceipt: Promise<Response> | undefined;
  let onProviderPost = () => {};
  const delayedReceipt = new Promise<Response>((resolve) => {
    resolveReceipt = resolve;
  });
  let providerMode: "delayed" | "missing" | "completed" | "rejected" =
    "delayed";
  const fetchStub = stub(globalThis, "fetch", async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const options = init as {
      method?: string;
      body?: unknown;
      headers?: HeadersInit;
    } | undefined;
    const method = options?.method || "GET";
    const body = options?.body ? JSON.parse(String(options.body)) : {};
    if (url.hostname === "provider.example.test") {
      if (method === "POST") {
        posts++;
        startedProvider();
        onProviderPost();
        if (providerMode === "missing") {
          return Response.json({ id: "provider-missing", status: "pending" });
        }
        return providerMode === "rejected"
          ? new Response("Bad Request", { status: 400 })
          : await (nextReceipt || delayedReceipt);
      }
      providerQueries++;
      if (providerMode === "missing") {
        return Response.json({
          code: "task_not_exist",
          message: "生成失败: 任务处理失败",
          data: null,
        }, { status: 404 });
      }
      if (providerMode === "completed") {
        return Response.json({
          id: "provider-late",
          status: "completed",
          result: { data: [{ url: "https://image.example.test/late.png" }] },
        });
      }
      return Response.json({ id: "provider-original", status: "in_progress" });
    }
    if (url.hostname === "image.example.test") {
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/png" },
      });
    }
    if (url.hostname !== "db.example.test") {
      throw new Error(`Unexpected network host: ${url.hostname}`);
    }
    if (url.pathname === "/auth/v1/user") return Response.json({ id: userId });
    if (url.pathname.endsWith("/rpc/hai_access_status")) {
      return Response.json({ allowed: true });
    }
    if (url.pathname.endsWith("/rpc/hai_check_and_reserve_image_generation")) {
      return Response.json({ allowed: true });
    }
    if (url.pathname.endsWith("/rpc/hai_fail_image_generation_run")) {
      const row = rows.find((item) => item.id === body.p_run_id)!;
      if (!["completed", "failed"].includes(row.status)) {
        failedSettlements++;
        Object.assign(row, {
          status: "failed",
          failure_code: body.p_code,
          failure_stage: body.p_stage,
          failure_detail: body.p_detail,
          error_message: "internal provider detail",
        });
      }
      return Response.json(row);
    }
    if (url.pathname.endsWith("/rpc/hai_acknowledge_image_delivery")) {
      const row = rows.find((item) => item.id === body.p_run_id)!;
      if (
        !["completed", "failed"].includes(row.status) &&
        Date.now() < Date.parse(row.delivery_deadline_at) && row.r2_key
      ) {
        completedSettlements++;
        row.status = "completed";
      }
      return Response.json(row);
    }
    if (url.pathname.endsWith("/hai_image_generation_tasks")) {
      return Response.json(method === "GET" ? [task] : task);
    }
    if (url.pathname.endsWith("/hai_image_generation_runs")) {
      if (method === "POST") {
        const row = {
          ...body,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          status: "queued",
          source_url: null,
          r2_key: null,
          provider_response: {},
        };
        rows.push(row);
        return Response.json(row);
      }
      const matching = rows.filter((row) =>
        [...url.searchParams].every(([key, value]) => {
          if (value.startsWith("eq.")) {
            return String(row[key]) === value.slice(3);
          }
          if (value === "is.null") return row[key] == null;
          if (value.startsWith("gt.")) {
            return Date.parse(row[key]) > Date.parse(value.slice(3));
          }
          return true;
        })
      );
      if (method === "PATCH") {
        matching.forEach((row) => Object.assign(row, body));
        return new Headers(options?.headers).get("prefer")?.includes(
            "return=representation",
          )
          ? Response.json(matching[0] || null)
          : new Response(null, { status: 204 });
      }
      return Response.json(matching.map((row) => ({ ...row, task })));
    }
    throw new Error(`Unexpected request: ${method} ${url.pathname}`);
  });
  const request = async (body: Row) => {
    const response = await handler(
      new Request("https://db.example.test/functions/v1/hai-image-generation", {
        method: "POST",
        headers: {
          authorization: "Bearer test-user-token",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
    return { http: response.status, body: await response.json() };
  };
  const input = {
    prompt: "调整参考图配色",
    taskId,
    clientRequestId: "request-original",
    referenceImages: [{
      key: `hai-image-generation/${userId}/reference.png`,
      url:
        `https://image.example.test/hai-image-generation/${userId}/reference.png`,
      name: "参考图",
      contentType: "image/png",
      size: 10,
    }],
  };
  try {
    for (const [name, value] of Object.entries(env)) Deno.env.set(name, value);
    await import("./index.ts");
    await test.step("returns before provider receipt, sends static prompts, and saves without charging", async () => {
      const first = await request(input);
      assertEquals(first.http, 202);
      assertEquals(work.length, 1);
      // Reservation may still be in flight when the response is returned.
      await providerStarted;
      assertEquals(posts, 1);
      assertStringIncludes(rows[0].composed_prompt, "面向学生");
      assertStringIncludes(rows[0].composed_prompt, "企业培训");
      const early = await request({
        action: "status",
        runId: first.body.run.id,
      });
      assertEquals(early.http, 202);
      assertEquals(providerQueries, 0);
      const replay = await request(input);
      assertEquals(replay.body.run.id, first.body.run.id);
      assertEquals(posts, 1);
      resolveReceipt(
        Response.json({
          id: "provider-original",
          data: [{ url: "https://image.example.test/result.png" }],
        }),
      );
      await work[0];
      assertEquals(rows[0].metadata.phase, "awaiting_delivery");
      assertEquals(Boolean(rows[0].r2_key), true);
      assertEquals(completedSettlements, 0);
      const ack = await request({ action: "acknowledge", runId: rows[0].id });
      assertEquals(ack.body.run.status, "completed");
      await request({ action: "acknowledge", runId: rows[0].id });
      assertEquals(completedSettlements, 1);
    });
    await test.step("a deadline is final, returns a uniform error and does not retrieve or charge late images", async () => {
      const expired: Row = {
        ...rows[0],
        id: crypto.randomUUID(),
        client_request_id: "expired-request",
        status: "running",
        r2_key: null,
        image_url: null,
        delivery_deadline_at: new Date(Date.now() - 1).toISOString(),
      };
      rows.push(expired);
      providerMode = "completed";
      const beforeQueries = providerQueries;
      const closed = await request({ action: "status", runId: expired.id });
      assertEquals(closed.body.run.status, "failed");
      assertEquals(
        closed.body.run.error_message,
        "本次生成失败，本轮未扣积分，请再次尝试。",
      );
      assertEquals(closed.body.run.failure_detail, undefined);
      assertEquals(providerQueries, beforeQueries);
      assertEquals(failedSettlements, 1);
      const ack = await request({ action: "acknowledge", runId: expired.id });
      assertEquals(ack.body.run.status, "failed");
      assertEquals(completedSettlements, 1);
      const image = await request({ action: "download", runId: expired.id });
      assertEquals(image.http, 409);
    });
    await test.step("late submission receipts cannot revive a failed run or create a new stored image", async () => {
      providerMode = "delayed";
      let lateResolve!: (response: Response) => void;
      nextReceipt = new Promise((resolve) => {
        lateResolve = resolve;
      });
      let postStarted!: () => void;
      const started = new Promise<void>((resolve) => {
        postStarted = resolve;
      });
      onProviderPost = postStarted;
      const submitted = await request({
        ...input,
        clientRequestId: "late-submission",
      });
      await started;
      const row = rows.find((item) => item.id === submitted.body.run.id)!;
      row.delivery_deadline_at = new Date(Date.now() - 1).toISOString();
      await request({ action: "status", runId: row.id });
      const beforeWrites = storageWrites;
      lateResolve(
        Response.json({
          id: "provider-late",
          data: [{ url: "https://image.example.test/late.png" }],
        }),
      );
      await work[1];
      assertEquals(row.status, "failed");
      assertEquals(Boolean(row.r2_key), false);
      assertEquals(storageWrites, beforeWrites);
      assertEquals(completedSettlements, 1);
      nextReceipt = undefined;
    });
    await test.step("persistent provider 404 consumes only the remaining budget and never resubmits", async () => {
      providerMode = "missing";
      const beforePosts = posts, beforeWrites = storageWrites;
      const submitted = await request({
        ...input,
        clientRequestId: "missing-provider",
        remainingMs: 200,
      });
      assertEquals(submitted.http, 202);
      await work[2];
      const row = rows.find((item) => item.id === submitted.body.run.id)!;
      assertEquals(row.status, "failed");
      assertEquals(row.failure_code, "delivery_timeout");
      assertEquals(row.failure_stage, "provider_generation");
      assertEquals(posts, beforePosts + 1);
      assertEquals(storageWrites, beforeWrites);
      assertEquals(completedSettlements, 1);
    });
    await test.step("a definitive supplier rejection is recorded privately and never charges", async () => {
      providerMode = "rejected";
      const submitted = await request({
        ...input,
        clientRequestId: "request-rejected",
      });
      assertEquals(submitted.http, 202);
      await work[3];
      const failed = await request({
        action: "status",
        runId: submitted.body.run.id,
      });
      assertEquals(failed.body.run.status, "failed");
      assertEquals(
        failed.body.run.error_message,
        "本次生成失败，本轮未扣积分，请再次尝试。",
      );
      const row = rows.find((x) => x.id === submitted.body.run.id)!;
      assertEquals(row.failure_code, "provider_rejected");
      assertEquals(row.failure_detail.http_status, 400);
      assertEquals(failedSettlements, 4);
      assertEquals(completedSettlements, 1);
    });
  } finally {
    serveStub.restore();
    fetchStub.restore();
    storageStub.restore();
    globals.EdgeRuntime = previousRuntime;
    for (const [name, value] of Object.entries(previousEnv)) {
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
});
