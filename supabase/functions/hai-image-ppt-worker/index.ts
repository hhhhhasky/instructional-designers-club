import {
  type AuthedRequest,
  createAdminClient,
  estimateTokens,
  type HaiProviderUsage,
  jsonResponse,
  recordHaiModelCall,
  reserveUsage,
  streamDeepSeek,
} from "../_shared/hai.ts";
import {
  extractPptTeachingFlow,
  normalizePptCourse,
  normalizePptPages,
  normalizePptSettings,
  parsePptJson,
  parsePptMarkdown,
  type PptPage,
  pptPagePrompt,
  pptPagesToMarkdown,
  pptStageInstructions,
  record,
} from "../_shared/hai_image_ppt.ts";
import { configuredImageStylePrompt, renderImagePrompt } from "../_shared/hai_image_prompt_catalog.ts";
import { loadImagePromptOverrides } from "../_shared/hai_image_prompt_config.ts";
import { collectResult, generate } from "../hai-image-generation/handler.ts";

export async function handleImagePptWorker(request: Request) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "只支持POST。" }, 405);
  }
  const secret = Deno.env.get("HAI_WORK_WORKER_SECRET");
  if (
    !secret || secret.length < 32 ||
    request.headers.get("x-hai-work-secret") !== secret
  ) return jsonResponse({ error: "Unauthorized" }, 401);
  const admin = createAdminClient();
  let deckId = "";
  let lease = "";
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const r = await admin.rpc(name, args);
    if (r.error) throw Error(r.error.message);
    return r.data;
  };
  try {
    const body = record(await request.json());
    deckId = String(body.deckId ?? "");
    if (!/^[\da-f-]{36}$/i.test(deckId)) {
      return jsonResponse({ error: "课件标识不正确。" }, 400);
    }
    const claimed = await rpc("hai_claim_image_ppt_job", { p_deck_id: deckId });
    if (!claimed) return jsonResponse({ skipped: true });
    const { job, deck, interrupted } = claimed;
    lease = job.lease_token;
    const promptOverrides = await loadImagePromptOverrides(admin);
    const userClient = {
      rpc: (name: string, args: Record<string, unknown>) =>
        admin.rpc("hai_image_ppt_worker_usage", {
          p_deck_id: deckId,
          p_lease: lease,
          p_name: name,
          p_args: args,
        }),
    } as unknown as AuthedRequest["userClient"];
    const auth = {
      user: { id: deck.user_id },
      admin,
      userClient,
      token: "",
    } as AuthedRequest;
    if (job.phase !== "images") {
      let result: Record<string, unknown> = {};
      let failure: string | null = null;
      let output = "";
      let usage: HaiProviderUsage | null = null;
      let model = "";
      let provider = "deepseek";
      const started = new Date();
      let inputTokens = 0;
      let outputTokens = 0;
      try {
        if (interrupted) {
          throw Error("上次规划执行中断，请重试。本次不会自动重复调用模型。");
        }
        const { data: module, error: moduleError } = await admin.from(
          "hai_feature_modules",
        ).select("default_model,model_provider_id,is_enabled").eq(
          "slug",
          "image-generation",
        ).single();
        if (moduleError || !module?.is_enabled) {
          throw Error("图片生成功能暂不可用。");
        }
        model = module.default_model;
        const skill = await admin.from("hai_work_skills").select("id").eq(
          "slug",
          "hai-image-ppt",
        ).eq("is_enabled", true).single();
        if (skill.error || !skill.data) throw Error("图片课件Skill暂不可用。");
        const version = await admin.from("hai_work_skill_versions").select(
          "id,prompt_template",
        ).eq("skill_id", skill.data.id).eq("status", "published").order(
          "created_at",
          { ascending: false },
        ).limit(1).single();
        if (version.error || !version.data) {
          throw Error("图片课件Skill尚未发布。");
        }
        const refs = await admin.from("hai_work_skill_references").select(
          "content",
        ).eq("skill_version_id", version.data.id).order("sort_order");
        if (refs.error) throw refs.error;
        const instructions = pptStageInstructions(
          version.data.prompt_template + "\n\n" +
            (refs.data ?? []).map((r: any) => r.content).join("\n\n"),
          job.phase,
        );
        if (!instructions) throw Error("当前阶段Skill内容为空。");
        deck.skill_version_id = version.data.id;
        let input: string;
        if (job.phase === "outline") {
          const source = record(deck.source_snapshot);
          const originalInput = record(source.input);
          const flow = typeof source.teaching_flow === "string"
            ? source.teaching_flow
            : extractPptTeachingFlow(String(source.markdown || ""));
          input = renderImagePrompt("ppt.outline", {
            subject: source.subject || originalInput.subject || "",
            grade: source.grade || originalInput.grade || "",
            requirements: deck.requirements || "", flow,
          }, promptOverrides);
          if (deck.outline_feedback) {
            input += renderImagePrompt("ppt.feedback", {
              feedback: deck.outline_feedback,
              outline: deck.outline_markdown || pptPagesToMarkdown(deck.outline),
            }, promptOverrides);
          }
        } else {
          input = renderImagePrompt("ppt.settings", {
            style_prompt: configuredImageStylePrompt(deck.art_style, promptOverrides),
            course: JSON.stringify(deck.course),
            outline: deck.outline_markdown || pptPagesToMarkdown(deck.outline),
          }, promptOverrides);
        }
        inputTokens = estimateTokens(instructions + input);
        const maxTokens = job.phase === "outline" ? 16384 : 4096;
        await reserveUsage({
          userClient,
          requestId: job.request_id,
          route: "hai-image-ppt",
          estimatedInputTokens: inputTokens,
          estimatedOutputTokens: maxTokens,
          metadata: { deck_id: deckId, phase: job.phase },
        });
        const allowed = await rpc("hai_start_image_ppt_model", {
          p_deck_id: deckId,
          p_lease: lease,
        });
        if (!allowed) throw Error("规划已被处理。");
        for await (
          const token of streamDeepSeek([{
            role: "system",
            content: instructions,
          }, { role: "user", content: input }], {
            model,
            temperature: 0.25,
            maxTokens,
            thinkingEnabled: false,
            responseFormat: "json_object",
            userId: deck.user_id,
            admin,
            modelProviderId: module.model_provider_id,
            timeoutMs: 140000,
            onUsage: (v) => {
              usage = v;
            },
            onProviderResolved: (v) => {
              provider = v;
            },
          })
        ) output += token;
        outputTokens = estimateTokens(output);
        const parsed = parsePptJson(output);
        const markdown = typeof parsed.outline_markdown === "string"
          ? parsed.outline_markdown.trim()
          : job.phase === "outline"
          ? pptPagesToMarkdown(normalizePptPages(parsed.pages))
          : "";
        result = job.phase === "outline"
          ? {
            course: normalizePptCourse(parsed.course),
            pages: parsePptMarkdown(markdown),
            outline_markdown: markdown,
          }
          : normalizePptSettings(parsed, normalizePptCourse(deck.course));
        // A teacher's name must come from source or explicit user input.
        if (job.phase === "outline") {
          const course = record(result.course);
          const sourceText = JSON.stringify(deck.source_snapshot) +
            deck.requirements + (deck.outline_feedback || "") +
            JSON.stringify(deck.course);
          if (course.teacher && !sourceText.includes(String(course.teacher))) {
            course.teacher = "";
          }
        }
      } catch (error) {
        failure = error instanceof Error ? error.message : "规划失败，请重试。";
      }
      await recordHaiModelCall({
        admin,
        userId: deck.user_id,
        requestId: job.request_id,
        callIndex: 1,
        stage: "courseware_pure_image_planning",
        route: "hai-image-ppt",
        entityType: "image_ppt",
        entityId: deckId,
        model: model || "unknown",
        provider,
        startedAt: started,
        status: failure ? "failed" : "completed",
        usage,
        metadata: { phase: job.phase, skill_version_id: deck.skill_version_id },
      });
      const saved = await rpc("hai_finish_image_ppt_model", {
        p_deck_id: deckId,
        p_lease: lease,
        p_result: result,
        p_error: failure,
        p_usage: {
          input: inputTokens,
          output: outputTokens,
          duration: Date.now() - started.getTime(),
        },
      });
      if (!saved) throw Error("规划结果保存失败，执行权已失效。");
    } else {
      const { data: pages, error } = await admin.from("hai_image_ppt_pages")
        .select("page_id,page_index,current_run_id").eq("deck_id", deckId)
        .order("page_index");
      if (error) throw error;
      const ids = (pages ?? []).map((p) => p.current_run_id).filter(Boolean);
      const runResult = ids.length
        ? await admin.from("hai_image_generation_runs").select("*").in(
          "id",
          ids,
        )
        : { data: [], error: null };
      if (runResult.error) throw runResult.error;
      const runs = runResult.data ?? [];
      const next = (pages ?? []).find((p) => {
        if (
          deck.preview_approved === false && p.page_id !== deck.preview_page_id
        ) return false;
        const r = runs.find((r) => r.id === p.current_run_id);
        return !r || (!r.r2_key && r.status !== "failed");
      });
      let pause: string | null = null;
      if (next) {
        const page = (deck.outline as PptPage[]).find((p) =>
          p.id === next.page_id
        );
        if (!page) throw Error("页面大纲缺失。");
        const prompt = pptPagePrompt(
          page,
          normalizePptSettings(deck.settings, normalizePptCourse(deck.course)),
          next.page_index,
          deck.outline.length,
          promptOverrides,
        );
        const run = await rpc("hai_prepare_image_ppt_page", {
          p_deck_id: deckId,
          p_lease: lease,
          p_page_id: next.page_id,
          p_prompt: prompt,
        });
        if (run.status === "queued") await generate(auth, run, [], [], promptOverrides);
        else if (run.status === "running" && !run.provider_task_id) {
          const r = await userClient.rpc("hai_fail_image_generation_run", {
            p_run_id: run.id,
            p_code: "worker_interrupted",
            p_stage: "provider_submit",
            p_detail: { message: "提交执行中断，请单页重试。" },
          });
          if (r.error) throw r.error;
        } else await collectResult(auth, run);
        const latest = await admin.from("hai_image_generation_runs").select(
          "status,failure_stage,error_message,failure_detail",
        ).eq("id", run.id).single();
        if (latest.error) throw latest.error;
        if (
          latest.data.status === "failed" &&
          latest.data.failure_stage === "quota_reservation"
        ) {
          pause = String(
            record(latest.data.failure_detail).message ||
              "积分或并发额度不足，请稍后继续生成。",
          );
        }
      }
      await rpc("hai_release_image_ppt_job", {
        p_deck_id: deckId,
        p_lease: lease,
        p_error: pause,
      });
    }
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("image ppt worker failed", {
      deckId,
      message: error instanceof Error ? error.message : "unknown",
    });
    if (deckId && lease) {
      await admin.rpc("hai_release_image_ppt_job", {
        p_deck_id: deckId,
        p_lease: lease,
        p_error: "后台执行遇到问题，已保存现有内容，请重试。",
      });
    }
    return jsonResponse({ error: "后台执行失败，已保存现有内容。" }, 500);
  }
}
Deno.serve(handleImagePptWorker);
