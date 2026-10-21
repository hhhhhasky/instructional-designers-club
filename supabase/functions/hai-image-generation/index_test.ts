import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { S3Client } from "npm:@aws-sdk/client-s3@3.1048.0";
import { stub } from "https://deno.land/std@0.224.0/testing/mock.ts";

// Exercise the real handler and Supabase clients with in-memory HTTP transport.
// No provider POST, R2 upload, database mutation or points spend leaves this test.
Deno.test("image handler submits once and collects asynchronously without a worker or generation deadline", async (test) => {
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
  const rows: Row[] = [];
  const task = { id: taskId, user_id: userId, title: "test" };
  let posts = 0,
    providerQueries = 0,
    failedSettlements = 0,
    completedSettlements = 0;
  let storageWrites = 0;
  let failStorage = false;
  let failReceiptSave = false;
  const storageStub = stub(S3Client.prototype, "send", async () => {
    storageWrites++;
    if (failStorage) throw new Error("R2 temporarily unavailable");
    return {};
  });
  let providerMode:
    | "queued"
    | "missing"
    | "completed"
    | "rejected"
    | "lost"
    | "no-id"
    | "failed"
    | "limited" = "queued";
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
        assertStringIncludes(body.prompt, "学科：思想政治");
        assertStringIncludes(body.prompt, "暖金");
        assertStringIncludes(body.prompt, "调整参考图配色");
        posts++;
        if (providerMode === "lost") {
          throw new TypeError("connection lost after submit");
        }
        if (providerMode === "no-id") {
          return Response.json({ status: "queued" });
        }
        return providerMode === "rejected"
          ? new Response("Bad Request", { status: 400 })
          : Response.json({ id: "provider-original", status: "queued" });
      }
      providerQueries++;
      if (providerMode === "limited") {
        return Response.json({ error: "rate limited" }, {
          status: 429,
          headers: { "Retry-After": "60" },
        });
      }
      if (providerMode === "failed") {
        return Response.json({
          status: "failed",
          error: { message: "private provider failure" },
        });
      }
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
        (!row.delivery_deadline_at ||
          Date.now() < Date.parse(row.delivery_deadline_at)) &&
        row.r2_key
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
        if (failReceiptSave && body.provider_task_id === "provider-original") {
          failReceiptSave = false;
          return Response.json(
            { message: "database temporarily unavailable" },
            { status: 500 },
          );
        }
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
    subject: "思想政治",
    style: "红金山河",
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
    await test.step("rejects an unknown subject before saving or spending", async () => {
      const invalid = await request({ ...input, subject: "unknown" });
      assertEquals(invalid.http, 400);
      assertEquals(rows.length, 0);
      assertEquals(posts, 0);
    });
    await test.step("returns a durable provider ID without polling or waiting for the generated image", async () => {
      const first = await request(input);
      assertEquals(first.http, 202);
      assertEquals(first.body.run.provider_task_id, "provider-original");
      assertEquals(first.body.run.delivery_deadline_at, null);
      assertEquals(first.body.run.metadata.execution_mode, "provider_async");
      assertEquals(first.body.run.metadata.subject, "思想政治");
      assertEquals(first.body.run.provider_response, undefined);
      assertEquals(providerQueries, 0);
      assertEquals(storageWrites, 0);
      assertEquals(completedSettlements, 0);
      const replay = await request(input);
      assertEquals(replay.body.run.id, first.body.run.id);
      assertEquals(posts, 1);
    });
    await test.step("one status request makes one provider query and can resume well after 150 seconds", async () => {
      rows[0].created_at = new Date(Date.now() - 600_000).toISOString();
      const before = providerQueries;
      const pending = await request({ action: "status", runId: rows[0].id });
      assertEquals(pending.http, 202);
      assertEquals(pending.body.run.status, "running");
      assertEquals(providerQueries, before + 1);
      providerMode = "completed";
      const collected = await request({ action: "status", runId: rows[0].id });
      assertEquals(Boolean(collected.body.run.r2_key), true);
      assertEquals(collected.body.run.metadata.phase, "awaiting_delivery");
      assertEquals(completedSettlements, 0);
      const beforeSavedQuery = providerQueries;
      await request({ action: "status", runId: rows[0].id });
      assertEquals(providerQueries, beforeSavedQuery);
      assertEquals(storageWrites, 1);
      await request({ action: "acknowledge", runId: rows[0].id });
      await request({ action: "acknowledge", runId: rows[0].id });
      assertEquals(completedSettlements, 1);
    });
    await test.step("historical deadlines still close old runs without retrieving or charging late images", async () => {
      const expired: Row = {
        ...rows[0],
        id: crypto.randomUUID(),
        client_request_id: "legacy",
        status: "running",
        r2_key: null,
        image_url: null,
        metadata: {},
        delivery_deadline_at: new Date(Date.now() - 1).toISOString(),
      };
      rows.push(expired);
      const before = providerQueries;
      const closed = await request({ action: "status", runId: expired.id });
      assertEquals(closed.body.run.status, "failed");
      assertEquals(closed.body.run.failure_detail, undefined);
      assertEquals(providerQueries, before);
      assertEquals(
        (await request({ action: "download", runId: expired.id })).http,
        409,
      );
      assertEquals(completedSettlements, 1);
    });
    await test.step("missing tasks and rate limits stay pending; Retry-After suppresses early provider queries", async () => {
      providerMode = "missing";
      const submitted = await request({
        ...input,
        clientRequestId: "recoverable",
      });
      const row = rows.find((x) => x.id === submitted.body.run.id)!;
      let pending = await request({ action: "status", runId: row.id });
      assertEquals(pending.body.run.status, "running");
      assertEquals(pending.body.run.error_message, null);
      assertEquals(row.metadata.last_error.response.http_status, 404);
      row.metadata.next_poll_at = null;
      providerMode = "limited";
      pending = await request({ action: "status", runId: row.id });
      assertEquals(pending.body.run.status, "running");
      assertEquals(
        Date.parse(row.metadata.next_poll_at) > Date.now() + 59_000,
        true,
      );
      const before = providerQueries;
      await request({ action: "status", runId: row.id });
      assertEquals(providerQueries, before);
      row.metadata.next_poll_at = null;
      providerMode = "completed";
      const result = await request({ action: "status", runId: row.id });
      assertEquals(Boolean(result.body.run.r2_key), true);
    });
    await test.step("a lost POST receipt recovers via the saved business ID without resubmitting", async () => {
      providerMode = "lost";
      const before = posts;
      const submitted = await request({ ...input, clientRequestId: "lost" });
      assertEquals(submitted.http, 202);
      assertStringIncludes(submitted.body.run.provider_task_id, "hai-image-");
      assertEquals(submitted.body.run.metadata.phase, "provider_submit_unconfirmed");
      assertEquals(submitted.body.run.metadata.submit_error.message, "提交回执暂未收到，结果尚未确认；正在查询原任务，本次图片积分尚未扣除。");
      rows.find((x) => x.id === submitted.body.run.id)!.metadata.phase = "provider_generation";
      providerMode = "missing";
      const unconfirmed = await request({
        action: "status",
        runId: submitted.body.run.id,
      });
      assertEquals(unconfirmed.body.run.metadata.phase, "provider_submit_unconfirmed");
      assertEquals(unconfirmed.body.run.metadata.submit_error.message, "提交回执暂未收到，结果尚未确认；正在查询原任务，本次图片积分尚未扣除。");
      assertEquals(unconfirmed.body.run.status, "running");
      assertEquals(posts, before + 1);
      rows.find((x) => x.id === submitted.body.run.id)!.metadata.next_poll_at = null;
      providerMode = "completed";
      const result = await request({
        action: "status",
        runId: submitted.body.run.id,
      });
      assertEquals(Boolean(result.body.run.r2_key), true);
      assertEquals(posts, before + 1);
    });
    await test.step("a successful response without a task ID is also shown as unconfirmed", async () => {
      providerMode = "no-id";
      const submitted = await request({ ...input, clientRequestId: "no-id" });
      assertEquals(submitted.http, 202);
      assertEquals(submitted.body.run.metadata.phase, "provider_submit_unconfirmed");
      assertStringIncludes(submitted.body.run.provider_task_id, "hai-image-");
    });
    await test.step("a database outage saving the receipt retains the pre-saved business ID", async () => {
      providerMode = "queued";
      failReceiptSave = true;
      const submitted = await request({
        ...input,
        clientRequestId: "receipt-db-outage",
      });
      assertEquals(submitted.body.run.status, "running");
      assertStringIncludes(submitted.body.run.provider_task_id, "hai-image-");
      const before = posts;
      providerMode = "completed";
      const result = await request({
        action: "status",
        runId: submitted.body.run.id,
      });
      assertEquals(Boolean(result.body.run.r2_key), true);
      assertEquals(posts, before);
    });
    await test.step("R2 interruptions retain the source URL and retry storage without another generation or query", async () => {
      providerMode = "completed";
      const submitted = await request({
        ...input,
        clientRequestId: "storage-retry",
      });
      failStorage = true;
      const pending = await request({
        action: "status",
        runId: submitted.body.run.id,
      });
      assertEquals(pending.body.run.status, "running");
      assertEquals(Boolean(pending.body.run.source_url), true);
      const row = rows.find((x) => x.id === submitted.body.run.id)!;
      row.metadata.next_poll_at = null;
      const before = providerQueries;
      failStorage = false;
      const result = await request({ action: "status", runId: row.id });
      assertEquals(Boolean(result.body.run.r2_key), true);
      assertEquals(providerQueries, before);
    });
    await test.step("explicit provider failures and rejected submissions close without charging or leaking details", async () => {
      for (const mode of ["failed", "rejected"] as const) {
        providerMode = mode;
        const submitted = await request({ ...input, clientRequestId: mode });
        const result = await request({
          action: "status",
          runId: submitted.body.run.id,
        });
        assertEquals(result.body.run.status, "failed");
        assertEquals(
          result.body.run.error_message,
          "本次生成失败，本轮未扣积分，请再次尝试。",
        );
        assertEquals(result.body.run.failure_detail, undefined);
        assertEquals(result.body.run.provider_response, undefined);
      }
      assertEquals(completedSettlements, 1);
      assertEquals(failedSettlements, 3);
    });
    await test.step("another owner's run cannot be read, collected, acknowledged or downloaded", async () => {
      const foreign = {
        ...rows[0],
        id: crypto.randomUUID(),
        user_id: crypto.randomUUID(),
      };
      rows.push(foreign);
      const before = providerQueries;
      for (const action of ["status", "acknowledge", "download"]) {
        assertEquals((await request({ action, runId: foreign.id })).http, 404);
      }
      assertEquals(providerQueries, before);
    });
  } finally {
    serveStub.restore();
    fetchStub.restore();
    storageStub.restore();
    for (const [name, value] of Object.entries(previousEnv)) {
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
});
