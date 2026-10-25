import { unitLessonBaseUser } from "../_shared/hai_unit_prompt.ts";
import { caseNeed, initialCaseState, stepCaseRetrieval, DeepSeekCaseWeb, caseEvidenceContext, caseSourceAppendix, type CaseConfig, type CaseState } from "../_shared/hai_case_retrieval.ts";
import { appendUnitReferences, type UnitReferences } from "../_shared/hai_unit_skill.ts";
import { appendLessonReferences, type LessonReferences } from "../_shared/hai_public_lesson.ts";
import { workflowPrompt, parseWorkflowOutput, type WorkWorkflow } from "../_shared/hai_workflow.ts";
import { parseUnitPlan, unitFile, validateUnitDocument, type UnitFile, type UnitLesson } from "../_shared/hai_unit_design.ts";
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
  estimated_input_tokens?: number;
  call_input_tokens?: number;
  call_output_tokens?: number;
  file?: UnitFile;
  unit_plan?: { markdown: string; lessons: UnitLesson[] };
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
    workflow?: WorkWorkflow;
    lessonReferences?: LessonReferences;
    unitReferences?: UnitReferences;
    caseRetrieval?: CaseConfig;
    caseInput?: Record<string, unknown>;
    caseState?: CaseState;
  };
};

type Dependencies = {
  admin: SupabaseClient;
  secret: string;
  generate: typeof collectWorkModelOutput;
  recordCall: typeof recordHaiModelCall;
  heartbeatMs?: number;
  caseWeb?: Pick<DeepSeekCaseWeb, "search" | "read">;
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
      const flow = job.payload.workflow;
      const caseConfig = job.payload.caseRetrieval;
      let caseState = caseConfig && flow?.version === 2 && flow.stage === "result"
        ? initialCaseState(caseNeed(job.payload.caseInput ?? {}, flow), job.payload.caseState) : undefined;
      if (caseConfig && caseState && caseState.phase !== "done") {
        if (caseConfig.billing_version === 1) {
          try { await rpc(admin, "hai_prepare_web_tool_billing", ownership); }
          catch (error) {
            await rpc(admin, "hai_checkpoint_case_retrieval", { ...ownership, p_state: caseState,
              p_error: error instanceof Error ? error.message : "检索积分预留失败。" });
            await admin.rpc("hai_dispatch_work_jobs");
            return jsonResponse({ accepted: true, runId: job.run_id });
          }
        }
        const reserved = structuredClone(caseState);
        // Persist request counts before calling the provider, so an interrupted
        // invocation cannot restore the budget when the teacher retries.
        if (reserved.phase === "search" && reserved.queries.length && reserved.searches < caseConfig.searches && reserved.reads < caseConfig.pages) reserved.searches++;
        if (reserved.phase === "read" && reserved.reads < caseConfig.pages && reserved.candidates.some(c => !reserved.tried_urls.includes(c.url))) reserved.reads++;
        await rpc(admin, "hai_checkpoint_case_retrieval", { ...ownership, p_state: reserved, p_release: false });
        let modelAttempt: Record<string, unknown> | null = null;
        try {
          const providerWeb = dependencies?.caseWeb ?? new DeepSeekCaseWeb(Deno.env.get("HAI_CASE_SEARCH_API_KEY") || Deno.env.get("DEEPSEEK_API_KEY") || "");
          const meteredWeb = {
            search: async (...args: Parameters<DeepSeekCaseWeb["search"]>) => {
              const results = await providerWeb.search(...args);
              if (caseConfig.billing_version === 1 && (results.billable ?? results.length > 0)) {
                await rpc(admin, "hai_record_web_tool_success", { ...ownership, p_tool_kind: "search", p_request_number: reserved.searches });
              }
              return results;
            },
            read: async (...args: Parameters<DeepSeekCaseWeb["read"]>) => {
              const page = await providerWeb.read(...args);
              if (caseConfig.billing_version === 1 && page.content.trim()) {
                await rpc(admin, "hai_record_web_tool_success", { ...ownership, p_tool_kind: "fetch", p_request_number: reserved.reads });
              }
              return page;
            },
          };
          caseState = await stepCaseRetrieval(caseState, caseConfig, meteredWeb,
            async prompt => {
              const value = await (dependencies?.generate ?? collectWorkModelOutput)({ ...prompt,
                module: job.payload.module, completionOptions: { ...job.payload.completionOptions, thinkingEnabled: false, maxTokens: 2400, responseFormat: "json_object" },
                userId: job.user_id, admin });
              modelAttempt = { ...value, purpose: `case_${caseState!.phase}`, attempt: (flow?.attempts?.length ?? 0) + 1,
                call_input_tokens: estimateTokens(prompt.system) + estimateTokens(prompt.user),
                call_output_tokens: estimateTokens(value.output), estimated_input_tokens: estimateTokens(prompt.system) + estimateTokens(prompt.user),
                estimated_output_tokens: estimateTokens(value.output) };
              if (value.error) throw new Error(value.error);
              return value.output;
            });
          if (leaseLost) throw new Error("后台执行权已失效。");
          await rpc(admin, "hai_checkpoint_case_retrieval", { ...ownership, p_state: caseState, p_attempt: modelAttempt,
            p_error: caseState.phase === "failed" ? caseState.gaps.join("；") || "预算内未找到可用案例。" : null });
        } catch (error) {
          await rpc(admin, "hai_checkpoint_case_retrieval", { ...ownership, p_state: reserved, p_attempt: modelAttempt,
            p_error: error instanceof Error ? error.message : "案例检索未完成。" });
        }
        await admin.rpc("hai_dispatch_work_jobs");
        return jsonResponse({ accepted: true, runId: job.run_id });
      }
      const preview = flow && flow.stage !== "result";
      const unitMode = job.payload.module.slug === "unit-learning-design" && !preview;
      const stagePrompt = flow?.version === 2 && flow.stage !== "focus" && job.payload.module.slug === "subject-lesson-design"
        ? appendLessonReferences(job.payload.prompt, job.payload.lessonReferences ?? {}, flow.stage === "mode" ? "mode" : "result")
        : job.payload.prompt;
      const unitRefs = job.payload.unitReferences;
      const unitPhase = preview ? flow.stage === "mode" ? "mode" : "plan" : job.attempts[0]?.unit_plan ? "lesson" : "plan";
      const unitBase = unitRefs && unitPhase === "lesson" ? { ...stagePrompt, user: unitLessonBaseUser(stagePrompt.user) } : stagePrompt;
      const unitPrompt = unitRefs ? appendUnitReferences(unitBase, unitRefs, unitPhase, flow?.selected_mode) : unitBase;
      const basePrompt = flow ? workflowPrompt(unitPrompt, flow, job.payload.module.slug, Boolean(unitRefs)) : unitPrompt;
      const plan = job.attempts[0]?.unit_plan;
      const nextLesson = plan?.lessons[job.attempts.length - 1];
      let prompt = unitMode && plan && nextLesson ? {
        system: unitRefs ? basePrompt.system : `${basePrompt.system}\n\n本阶段只生成一份独立课时教案。输出完整 Markdown，不要 JSON。严格使用本阶段加载的对应模式单课模板八部分结构。目标数量与活动安排依据本课实际内容，不预设固定数量。不要重新生成整体设计。`,
        user: `${basePrompt.user}\n\n## 已确定的单元整体设计\n${plan.markdown}\n\n## 本次课时（第 ${job.attempts.length} 课，共 ${plan.lessons.length} 课）\n${JSON.stringify(nextLesson)}${unitRefs ? "" : `\n\n## 前一课教案（用于承接；不可用同上代替本课正文）\n${job.attempts.length > 1 ? job.attempts[job.attempts.length - 1].file?.markdown ?? "" : "这是第一课，安排起点诊断。"}`}`,
      } : unitMode ? {
        system: basePrompt.system,
        user: `${basePrompt.user}\n\n## 本阶段接口输出要求\n只返回一个 JSON 对象，必须同时有 lessons 和 markdown 两个顶层字段。先写 lessons：按实际课时逐项列出 title、lesson_type、objectives、subtask、subquestion、connection、source_paths；不得只在正文表格中规划课时。再写 markdown：完整单元整体设计正文（含基本信息及七项栏目）。两个字段缺一会导致本次任务失败。只生成整体设计与课时清单，完整课时教案由后续阶段逐份生成。`,
      } : basePrompt;
      if (caseState?.phase === "done") prompt = { ...prompt, user: prompt.user + caseEvidenceContext(caseState) };
      const result = await (dependencies?.generate ?? collectWorkModelOutput)({
        ...prompt,
        module: job.payload.module,
        completionOptions: preview ? { ...job.payload.completionOptions, responseFormat: "json_object" } : unitMode ? {
          ...job.payload.completionOptions,
          responseFormat: plan ? "text" : "json_object",
        } : job.payload.completionOptions,
        userId: job.user_id,
        admin,
      });
      if (leaseLost) throw new Error("后台执行权已失效，未保存迟到结果。");
      const attempt: Attempt = {
        ...result,
        markdown: normalizeWorkMarkdown(result.output) + (!result.error && result.output.trim() && caseState?.phase === "done" ? caseSourceAppendix(caseState) : ""),
        raw_output: result.output,
        output_chars: result.output.length,
        purpose: preview ? `workflow_${flow.stage}` : unitMode ? plan ? "unit_lesson" : "unit_overall" : job.phase === "initial" ? "initial" : "empty_output_repair",
        attempt: job.attempts.length + 1,
        estimated_output_tokens: estimateTokens(result.output),
      };
      attempt.estimated_input_tokens = estimateTokens(prompt.system) + estimateTokens(prompt.user);
      attempt.call_input_tokens = attempt.estimated_input_tokens;
      attempt.call_output_tokens = attempt.estimated_output_tokens;
      if (preview && !attempt.error) {
        try {
          const parsed = parseWorkflowOutput(result.output, flow.stage, job.payload.module.slug);
          await (dependencies?.recordCall ?? recordHaiModelCall)({
            admin, throwOnError: true, userId: job.user_id, requestId: job.client_request_id,
            callIndex: (flow.attempts ?? []).filter((a) => a.purpose !== "confirmed_plan").length + 1,
            stage: "work_initial", route: "hai-work", entityType: "work_task", entityId: job.task_id,
            model: job.payload.completionOptions.model, provider: attempt.provider_code,
            startedAt: new Date(attempt.started_at), completedAt: new Date(attempt.completed_at),
            status: "completed", usage: attempt.usage,
            metadata: { run_id: job.run_id, purpose: attempt.purpose, workflow_revision: flow.revision },
          }).catch(() => {
            // The durable attempt is recorded again before final settlement.
            console.warn("阶段成本记录暂未完成，将在结算前重试。");
          });
          await rpc(admin, "hai_checkpoint_workflow", { ...ownership, p_attempt: attempt, p_result: parsed });
          return jsonResponse({ accepted: true, runId: job.run_id, status: "waiting_confirmation" });
        } catch (error) {
          attempt.error = error instanceof Error ? error.message : "阶段内容保存失败。";
        }
      }
      if (unitMode) {
        attempt.estimated_input_tokens = estimateTokens(prompt.system) + estimateTokens(prompt.user);
        if (!attempt.error) {
          try {
            if (!plan) {
              const parsed = parseUnitPlan(result.output);
              attempt.unit_plan = parsed;
              attempt.file = unitFile("unit", 0, "单元整体设计", parsed.markdown);
              attempt.markdown = parsed.markdown;
            } else {
              if (!nextLesson) throw new Error("课时顺序与整体规划不一致。");
              validateUnitDocument(attempt.markdown, "lesson");
              attempt.file = unitFile("lesson", job.attempts.length, nextLesson.title, attempt.markdown);
            }
          } catch (error) {
            attempt.error = error instanceof Error ? error.message : "大单元教学文档不完整。";
          }
        }
      }
      await rpc(admin, unitMode ? "hai_checkpoint_unit_work_job" : "hai_checkpoint_work_job", {
        ...ownership,
        p_attempt: attempt,
      });
    } else {
      // Calls are upserted by (request_id, call_index). A settlement retry reads
      // saved attempts, never regenerates an already checkpointed answer.
      const allAttempts = [...(job.payload.workflow?.attempts ?? []) as Attempt[], ...job.attempts].filter((attempt) => attempt.purpose !== "confirmed_plan");
      for (const [index, attempt] of allAttempts.entries()) {
        await (dependencies?.recordCall ?? recordHaiModelCall)({
          admin,
          throwOnError: true,
          userId: job.user_id,
          requestId: job.client_request_id,
          callIndex: index + 1,
          stage: job.payload.module.slug === "unit-learning-design" || attempt.attempt === 1 ? "work_initial" : "work_repair",
          route: "hai-work",
          entityType: "work_task",
          entityId: job.task_id,
          model: job.payload.completionOptions.model,
          provider: attempt.provider_code,
          startedAt: new Date(attempt.started_at),
          completedAt: new Date(attempt.completed_at),
          status: attempt.error ? "failed" : "completed",
          usage: attempt.usage,
          metadata: { tool_slug: job.payload.module.slug, run_id: job.run_id, purpose: attempt.purpose, document_index: job.payload.module.slug === "unit-learning-design" ? attempt.attempt - 1 : null },
        });
      }
      await rpc(admin, job.payload.workflow ? "hai_finish_guided_work_job" : job.payload.module.slug === "unit-learning-design" ? "hai_finish_unit_work_job" : "hai_finish_work_job", ownership);
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
