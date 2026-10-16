import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  estimateTokens,
  type HaiChatCompletionOptions,
  jsonResponse,
  recordHaiModelCall,
} from "../_shared/hai.ts";
import { getSupabaseSecretKey } from "../_shared/supabase-keys.ts";
import {
  collectWorkModelOutput,
  normalizeWorkMarkdown,
} from "../_shared/hai_work_execution.ts";

type Attempt = Awaited<ReturnType<typeof collectWorkModelOutput>> & {
  markdown: string;
  raw_output: string;
  output_chars: number;
  purpose: string;
  attempt: number;
  estimated_output_tokens: number;
};
type Job = {
  run_id: string;
  user_id: string;
  task_id: string;
  client_request_id: string;
  lease_token: string;
  phase: "initial" | "repair" | "complete";
  attempts: Attempt[];
  payload: {
    prompt: { system: string; user: string };
    module: { slug: string; model_provider_id: string | null };
    completionOptions: HaiChatCompletionOptions;
  };
};

type Dependencies = {
  admin: SupabaseClient;
  secret: string;
  generate: typeof collectWorkModelOutput;
  recordCall: typeof recordHaiModelCall;
  heartbeatMs?: number;
};

async function rpc<T>(
  admin: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data as T;
}

export async function handleWorkWorker(
  request: Request,
  dependencies?: Dependencies,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "只支持 POST。" }, 405);
  }
  const secret = dependencies?.secret ?? Deno.env.get("HAI_WORK_WORKER_SECRET");
  if (
    !secret || secret.length < 32 ||
    request.headers.get("x-hai-work-secret") !== secret
  ) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  // Only create the service client after authenticating the scheduler.
  const admin = dependencies?.admin ??
    createClient(Deno.env.get("SUPABASE_URL")!, getSupabaseSecretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  try {
    const body = await request.json();
    if (
      typeof body.runId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.runId)
    ) {
      return jsonResponse({ error: "任务标识不正确。" }, 400);
    }
    const job = await rpc<Job | null>(admin, "hai_claim_work_job", {
      p_run_id: body.runId,
    });
    if (!job) return jsonResponse({ skipped: true });
    const ownership = { p_run_id: job.run_id, p_lease_token: job.lease_token };
    let heartbeatPending = false;
    let leaseLost = false;
    heartbeat = setInterval(() => {
      if (heartbeatPending || leaseLost) return;
      heartbeatPending = true;
      void rpc<boolean>(admin, "hai_heartbeat_work_job", ownership).then(
        (alive) => {
          if (!alive) leaseLost = true;
        },
      ).catch(() => {
        // A transient DB error isn't proof of lease loss. The checkpoint/finish
        // transaction is authoritative and rejects an expired or replaced lease.
      }).finally(() => {
        heartbeatPending = false;
      });
    }, dependencies?.heartbeatMs ?? 20_000);

    if (job.phase !== "complete") {
      // One bounded model call per invocation; an empty-output repair is another
      // durable phase and receives its own worker invocation and time budget.
      const result = await (dependencies?.generate ?? collectWorkModelOutput)({
        ...job.payload.prompt,
        module: job.payload.module,
        completionOptions: job.payload.completionOptions,
        userId: job.user_id,
        admin,
      });
      if (leaseLost) throw new Error("后台执行权已失效，未保存迟到结果。");
      const attempt: Attempt = {
        ...result,
        markdown: normalizeWorkMarkdown(result.output),
        raw_output: result.output,
        output_chars: result.output.length,
        purpose: job.phase === "initial" ? "initial" : "empty_output_repair",
        attempt: job.attempts.length + 1,
        estimated_output_tokens: estimateTokens(result.output),
      };
      await rpc(admin, "hai_checkpoint_work_job", {
        ...ownership,
        p_attempt: attempt,
      });
    } else {
      // Calls are upserted by (request_id, call_index). A settlement retry reads
      // saved attempts, never regenerates an already checkpointed answer.
      for (const attempt of job.attempts) {
        await (dependencies?.recordCall ?? recordHaiModelCall)({
          admin,
          throwOnError: true,
          userId: job.user_id,
          requestId: job.client_request_id,
          callIndex: attempt.attempt,
          stage: attempt.attempt === 1 ? "work_initial" : "work_repair",
          route: "hai-work",
          entityType: "work_task",
          entityId: job.task_id,
          model: job.payload.completionOptions.model,
          provider: attempt.provider_code,
          startedAt: new Date(attempt.started_at),
          completedAt: new Date(attempt.completed_at),
          status: attempt.error ? "failed" : "completed",
          usage: attempt.usage,
          metadata: { tool_slug: job.payload.module.slug, run_id: job.run_id },
        });
      }
      await rpc(admin, "hai_finish_work_job", ownership);
    }
    // Best effort low-latency wakeup. Cron guarantees another wakeup when this
    // call/HTTP response is lost, including when the browser is already closed.
    await admin.rpc("hai_dispatch_work_jobs");
    return jsonResponse({ accepted: true, runId: job.run_id });
  } catch (error) {
    // Leave the durable job/checkpoint intact. The lease expires; a later claim
    // finalizes saved output or reports an interrupted call without repeating it.
    console.warn(
      "hai-work-worker failed",
      error instanceof Error ? error.message : "unknown",
    );
    return jsonResponse(
      { error: "后台执行暂时中断，系统将校正任务状态。" },
      500,
    );
  } finally {
    if (heartbeat !== undefined) clearInterval(heartbeat);
  }
}
