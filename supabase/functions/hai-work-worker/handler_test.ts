import { handleWorkWorker } from "./handler.ts";
import { normalizeWorkMarkdown } from "../_shared/hai_work_execution.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const secret = "s".repeat(32);
const runId = "10000000-0000-0000-0000-000000000001";
const sample = {
  run_id: runId,
  user_id: "owner",
  task_id: "task",
  client_request_id: "request",
  lease_token: "lease",
  phase: "initial",
  attempts: [],
  payload: {
    prompt: { system: "system", user: "user" },
    module: { slug: "lesson-diagnosis", model_provider_id: null },
    completionOptions: {
      model: "deepseek-v4-flash",
      maxTokens: 4096,
      temperature: 0.2,
      thinkingEnabled: false,
    },
  },
};
const result = {
  output: "# 教案",
  started_at: "2026-10-16T00:00:00Z",
  completed_at: "2026-10-16T00:01:00Z",
  duration_ms: 60000,
  usage: null,
  provider_code: "deepseek",
  reasoning_chars: 0,
  first_reasoning_at: null,
  first_content_at: null,
};
const request = (key = secret) =>
  new Request("https://local/hai-work-worker", {
    method: "POST",
    headers: { "x-hai-work-secret": key, "content-type": "application/json" },
    body: JSON.stringify({ runId }),
  });
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function fixture(job: unknown = sample) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const admin = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: name === "hai_claim_work_job" ? job : true, error: null };
    },
  } as unknown as SupabaseClient;
  let generations = 0;
  let records = 0;
  const dependencies = {
    admin,
    secret,
    generate: async () => {
      generations++;
      return result;
    },
    recordCall: async () => {
      records++;
    },
  };
  return { dependencies, calls, count: () => ({ generations, records }) };
}

Deno.test("worker rejects missing or incorrect scheduler credentials before touching the database", async () => {
  const f = fixture();
  assert(
    (await handleWorkWorker(request("wrong"), f.dependencies)).status === 401,
    "invalid secret accepted",
  );
  assert(
    f.calls.length === 0 && f.count().generations === 0,
    "unauthenticated work executed",
  );
});
Deno.test("duplicate or already completed worker wakeups do not call a model", async () => {
  const f = fixture(null);
  assert(
    (await handleWorkWorker(request(), f.dependencies)).ok,
    "duplicate wakeup failed",
  );
  assert(f.count().generations === 0, "duplicate model call");
});
Deno.test("each worker performs only one model phase and durably checkpoints before dispatching", async () => {
  const f = fixture();
  assert(
    (await handleWorkWorker(request(), f.dependencies)).ok,
    "generation failed",
  );
  assert(f.count().generations === 1, "model called more than once");
  const checkpoint = f.calls.find((c) => c.name === "hai_checkpoint_work_job");
  assert(checkpoint?.args.p_lease_token === "lease", "missing ownership token");
  assert(
    (checkpoint?.args.p_attempt as { markdown: string }).markdown === "# 教案",
    "output not saved",
  );
  assert(
    !f.calls.some((c) => c.name === "hai_finish_work_job"),
    "generation and settlement share an invocation",
  );
  assert(
    f.calls.at(-1)?.name === "hai_dispatch_work_jobs",
    "checkpoint not followed by wakeup",
  );
});
Deno.test("empty-output repair receives its own invocation instead of a second inline model call", async () => {
  const f = fixture({
    ...sample,
    phase: "repair",
    attempts: [{ markdown: "" }],
  });
  assert(
    (await handleWorkWorker(request(), f.dependencies)).ok,
    "repair failed",
  );
  assert(f.count().generations === 1, "repair called model repeatedly");
  const saved = f.calls.find((c) => c.name === "hai_checkpoint_work_job")?.args
    .p_attempt as { attempt: number; purpose: string };
  assert(
    saved.attempt === 2 && saved.purpose === "empty_output_repair",
    "repair history lost",
  );
});
Deno.test("completion retries consume saved output and record usage without calling the model", async () => {
  const f = fixture({
    ...sample,
    phase: "complete",
    attempts: [{ ...result, attempt: 1, markdown: "# 教案" }],
  });
  assert(
    (await handleWorkWorker(request(), f.dependencies)).ok,
    "completion failed",
  );
  assert(
    f.count().generations === 0 && f.count().records === 1,
    "completion regenerated output",
  );
  assert(
    f.calls.some((c) => c.name === "hai_finish_work_job"),
    "atomic settlement not invoked",
  );
});
Deno.test("failed settlement leaves saved output intact for a later worker", async () => {
  const f = fixture({
    ...sample,
    phase: "complete",
    attempts: [{ ...result, attempt: 1, markdown: "# 教案" }],
  });
  const rpc = f.dependencies.admin.rpc.bind(f.dependencies.admin);
  f.dependencies.admin.rpc =
    ((name: string, args: Record<string, unknown>) =>
      name === "hai_finish_work_job"
        ? Promise.resolve({
          data: null,
          error: { message: "synthetic billing outage" },
        })
        : rpc(name, args)) as typeof f.dependencies.admin.rpc;
  assert(
    (await handleWorkWorker(request(), f.dependencies)).status === 500,
    "failed settlement reported success",
  );
  assert(
    f.count().generations === 0,
    "settlement failure regenerated the model",
  );
  assert(
    !f.calls.some((c) => c.name === "hai_checkpoint_work_job"),
    "saved attempt overwritten",
  );
});
Deno.test("a fresh heartbeat extends the claim, and a lost lease cannot save late output", async () => {
  const f = fixture();
  f.dependencies.generate = async () => {
    await new Promise((resolve) => setTimeout(resolve, 12));
    return result;
  };
  const rpc = f.dependencies.admin.rpc.bind(f.dependencies.admin);
  f.dependencies.admin.rpc =
    ((name: string, args: Record<string, unknown>) =>
      name === "hai_heartbeat_work_job"
        ? Promise.resolve({ data: false, error: null })
        : rpc(name, args)) as typeof f.dependencies.admin.rpc;
  assert(
    (await handleWorkWorker(request(), { ...f.dependencies, heartbeatMs: 1 }))
      .status === 500,
    "lost lease accepted",
  );
  assert(
    !f.calls.some((c) => c.name === "hai_checkpoint_work_job"),
    "late output saved after losing lease",
  );
});
Deno.test("normalization preserves markdown but removes model wrappers and thinking", () => {
  assert(
    normalizeWorkMarkdown(
      "```markdown\n【思考】private【/思考】\n# 教案\n正文\n```",
    ) === "# 教案\n正文",
    "normalization changed",
  );
});
