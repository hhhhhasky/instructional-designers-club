import {
  assertHaiAccess,
  handleCors,
  HttpError,
  jsonResponse,
  requireUser,
  reserveImageGeneration,
} from "../_shared/hai.ts";
import {
  composeImageGenerationPrompt,
  getStoredImageAccessUrl,
  IMAGE_FAILURE_MESSAGE,
  IMAGE_GENERATION_POINTS,
  IMAGE_GENERATION_STYLES,
  IMAGE_GENERATION_SUBJECTS,
  IMAGE_GENERATION_TYPES,
  ImageDeliveryTimeout,
  ImageGenerationPending,
  type ImageGenerationSize,
  ImageGenerationTaskError,
  ImageProviderHttpError,
  persistImage,
  persistReferenceImages,
  pollImage,
  publicStoredImageUrl,
  readImageProviderConfig,
  readStoredImage,
  type StoredReferenceImage,
  submitImage,
  validateStoredReferenceImages,
} from "../_shared/hai_image_generation.ts";

type Auth = Awaited<ReturnType<typeof requireUser>>;
type Row = Record<string, any>;
const sizes = new Set(["16:9", "1:1", "3:4", "4:3", "9:16"]);
const subjects = new Set<string>(IMAGE_GENERATION_SUBJECTS);
const styles = new Set<string>(IMAGE_GENERATION_STYLES);
const types = new Set<string>(IMAGE_GENERATION_TYPES);
function clean(value: unknown, fallback = "", limit = 600) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, limit)
    : fallback;
}
function id(value: unknown) {
  const valueId = clean(value, "", 80);
  return /^[0-9a-f-]{36}$/i.test(valueId) ? valueId : "";
}
function ids(value: unknown) {
  return Array.isArray(value) ? value.map(id).filter(Boolean).slice(0, 6) : [];
}
function detail(error: unknown) {
  return {
    message: (error instanceof Error ? error.message : String(error)).replace(
      /Bearer\s+\S+/gi,
      "Bearer [redacted]",
    ).slice(0, 500),
    ...(error instanceof ImageProviderHttpError
      ? { http_status: error.status, response: error.providerResponse }
      : error instanceof ImageGenerationTaskError
      ? { response: error.providerResponse }
      : {}),
  };
}
function publicRun(run: Row) {
  return {
    ...run,
    error_message: run.status === "failed" ? IMAGE_FAILURE_MESSAGE : null,
    failure_detail: undefined,
    failure_code: undefined,
    failure_stage: undefined,
    provider_response: undefined,
  };
}
function response(task: Row, run: Row) {
  return jsonResponse({
    task,
    run: publicRun(run),
    pending: ["running", "queued"].includes(run.status),
  }, ["running", "queued"].includes(run.status) ? 202 : 200);
}
async function load(auth: Auth, runId: string) {
  const r = await auth.admin.from("hai_image_generation_runs").select(
    "*, task:hai_image_generation_tasks(*)",
  ).eq("id", runId).eq("user_id", auth.user.id).maybeSingle();
  if (r.error) throw new HttpError(500, IMAGE_FAILURE_MESSAGE);
  if (!r.data) throw new HttpError(404, "图片记录不存在或无权访问。");
  return r.data as Row;
}
async function fail(
  auth: Auth,
  runId: string,
  code: string,
  stage: string,
  reason: Row = {},
) {
  const r = await auth.userClient.rpc("hai_fail_image_generation_run", {
    p_run_id: runId,
    p_code: code,
    p_stage: stage,
    p_detail: reason,
  });
  if (r.error) throw new Error(r.error.message);
  return r.data as Row;
}
async function save(auth: Auth, run: Row, values: Row) {
  let query = auth.admin.from("hai_image_generation_runs").update(values)
    .eq("id", run.id).eq("user_id", auth.user.id).eq("status", "running");
  if (run.delivery_deadline_at) {
    query = query.gt("delivery_deadline_at", new Date().toISOString());
  }
  const r = await query.select("*").maybeSingle();
  if (r.error) throw new Error(r.error.message);
  if (!r.data) {
    throw new ImageDeliveryTimeout("Run closed or delivery deadline exceeded");
  }
  Object.assign(run, r.data);
}
async function generate(
  auth: Auth,
  run: Row,
  files: File[],
  references: StoredReferenceImage[],
) {
  const deadline = Date.now() + 120_000;
  let phase = "quota_reservation";
  let submittedToProvider = false;
  let lastProviderReceipt:
    | { taskId?: string; providerResponse: unknown }
    | undefined;
  const phaseMetadata = (next: string) => ({ ...run.metadata, phase: next });
  try {
    await reserveImageGeneration({
      userClient: auth.userClient,
      requestId: run.client_request_id,
      route: "hai-image-generation",
      metadata: {
        run_id: run.id,
        task_id: run.task_id,
        image_size: run.image_size,
        art_style: run.art_style,
        subject: run.metadata?.subject || null,
        image_type: run.image_type,
        points: IMAGE_GENERATION_POINTS,
        execution_mode: "provider_async",
      },
    });
    const running = await auth.admin.from("hai_image_generation_runs").update({
      status: "running",
      started_at: new Date().toISOString(),
      metadata: { ...run.metadata, phase: "reference_upload" },
    }).eq("id", run.id).eq("user_id", auth.user.id).eq("status", "queued")
      .select("*").maybeSingle();
    if (running.error) throw new Error(running.error.message);
    if (!running.data) return;
    Object.assign(run, running.data);
    phase = "reference_upload";
    if (Date.now() >= deadline) {
      throw new ImageDeliveryTimeout("Preparation exceeded deadline");
    }
    references = [
      ...references,
      ...await persistReferenceImages({
        files,
        userId: auth.user.id,
        taskId: run.task_id,
        runId: run.id,
        deadlineAt: deadline,
      }),
    ];
    const finalPrompt = composeImageGenerationPrompt(
      run.prompt,
      run.image_size,
      run.art_style,
      run.image_type,
      references.length > 0,
      run.metadata?.subject || "",
    );
    phase = "provider_configuration";
    const config = readImageProviderConfig();
    const businessId = `hai-image-${run.id}`;
    phase = "provider_submit";
    await save(auth, run, {
      reference_images: references,
      composed_prompt: finalPrompt,
      provider: config.provider,
      model: config.model,
      provider_task_id: businessId,
      metadata: phaseMetadata(phase),
    });
    const referenceImageUrls = await Promise.all(
      references.map((image) => getStoredImageAccessUrl(image.key)),
    );
    let result;
    let submitUnconfirmed = false;
    try {
      submittedToProvider = true;
      result = await submitImage(config, {
        prompt: finalPrompt,
        size: run.image_size as ImageGenerationSize,
        referenceImageUrls,
        businessId,
        deadlineAt: deadline,
      });
    } catch (error) {
      if (!(error instanceof ImageGenerationPending)) throw error;
      submitUnconfirmed = true;
      await save(auth, run, {
        provider_response: error.providerResponse || {},
        metadata: {
          ...phaseMetadata(phase),
          submit_error: detail(error),
          last_error: detail(error),
        },
      });
      result = { taskId: businessId, url: undefined, providerResponse: {} };
    }
    submitUnconfirmed ||= result.taskId === businessId && !result.url;
    lastProviderReceipt = result;
    await save(auth, run, {
      provider_task_id: result.taskId || businessId,
      provider_response: result.providerResponse,
      ...(result.url ? { source_url: result.url } : {}),
    });
    // Generation belongs to ToAPIs. A later status request collects the result.
    await save(auth, run, {
      metadata: {
        ...phaseMetadata(
          submitUnconfirmed ? "provider_submit_unconfirmed" : "provider_generation",
        ),
        ...(submitUnconfirmed
          ? { submit_unconfirmed_at: new Date().toISOString() }
          : {}),
      },
    });
    // Saved does not mean delivered: acknowledgement is the only debit path.
  } catch (error) {
    if (
      submittedToProvider && !(error instanceof ImageProviderHttpError) &&
      (!(error instanceof ImageGenerationTaskError) ||
        error instanceof ImageGenerationPending)
    ) {
      // The pre-saved business ID remains queryable even if saving the receipt
      // fails. An accepted paid task must never be closed for a database outage.
      console.warn("hai image receipt persistence deferred", {
        run_id: run.id,
        ...detail(error),
      });
      return;
    }
    const code = error instanceof ImageProviderHttpError
      ? "provider_rejected"
      : error instanceof ImageGenerationTaskError
      ? "provider_failed"
      : `${phase}_failed`;
    console.warn("hai image delivery failed", {
      run_id: run.id,
      code,
      phase,
      ...detail(error),
    });
    const closed = await fail(auth, run.id, code, phase, detail(error));
    if (closed.status === "failed" && lastProviderReceipt?.taskId) {
      // Retain a receipt for auditing without reopening a failed run.
      const audit = await auth.admin.from("hai_image_generation_runs").update({
        provider_task_id: lastProviderReceipt.taskId,
        provider_response: lastProviderReceipt.providerResponse,
      }).eq("id", run.id).eq("user_id", auth.user.id).eq("status", "failed");
      if (audit.error) {
        console.warn("hai image late receipt audit failed", {
          run_id: run.id,
          ...detail(audit.error),
        });
      }
    }
  }
}

async function collectResult(auth: Auth, run: Row) {
  if (run.status !== "running" || !run.provider_task_id || run.r2_key) return;
  if (Date.parse(run.metadata?.next_poll_at || "") > Date.now()) return;
  const deadline = Date.now() + 120_000;
  try {
    if (!run.source_url) {
      const result = await pollImage(
        readImageProviderConfig(),
        run.provider_task_id,
        fetch,
        deadline,
      );
      await save(auth, run, {
        provider_task_id: result.taskId,
        provider_response: result.providerResponse,
        ...(result.url ? { source_url: result.url } : {}),
        ...(result.taskId !== `hai-image-${run.id}` || result.url
          ? { metadata: { ...run.metadata, phase: "provider_generation" } }
          : {}),
      });
    }
    if (!run.source_url) return;
    await save(auth, run, {
      metadata: { ...run.metadata, phase: "r2_persistence" },
    });
    const stored = await persistImage({
      sourceUrl: run.source_url,
      userId: auth.user.id,
      taskId: run.task_id,
      runId: run.id,
      deadlineAt: deadline,
    });
    await save(auth, run, {
      r2_key: stored.key,
      image_url: stored.url,
      duration_ms: Date.now() - Date.parse(run.created_at),
      metadata: { ...run.metadata, phase: "awaiting_delivery" },
    });
  } catch (error) {
    if (
      error instanceof ImageGenerationTaskError &&
      !(error instanceof ImageGenerationPending)
    ) {
      await fail(
        auth,
        run.id,
        "provider_failed",
        "provider_generation",
        detail(error),
      );
    } else {
      // HTTP timeouts, 404/429/5xx and R2 interruptions are retryable reads.
      await save(auth, run, {
        metadata: {
          ...run.metadata,
          ...(run.provider_task_id === `hai-image-${run.id}`
            ? { phase: "provider_submit_unconfirmed" }
            : {}),
          last_error: detail(error),
          next_poll_at: new Date(
            Date.now() +
              Math.max(
                10_000,
                Number(
                  (error instanceof ImageGenerationPending
                    ? error.providerResponse as Row
                    : null)?.retry_after_ms,
                ) || 0,
              ),
          ).toISOString(),
        },
      });
    }
  }
}

export async function handleImageGeneration(
  request: Request,
): Promise<Response> {
  const cors = handleCors(request);
  if (cors) return cors;
  try {
    if (request.method !== "POST") throw new HttpError(405, "只支持 POST。");
    const auth = await requireUser(request);
    await assertHaiAccess(auth.userClient);
    let body: Row, files: File[] = [];
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      body = Object.fromEntries(
        [...form].filter(([, v]) => typeof v === "string"),
      );
      for (const key of ["referenceRunIds", "referenceImages"]) {
        if (typeof body[key] === "string") body[key] = JSON.parse(body[key]);
      }
      files = form.getAll("reference_images").filter((value): value is File =>
        value instanceof File
      );
    } else body = await request.json();
    const action = clean(body.action, "generate", 20);
    if (["status", "download", "acknowledge", "fail"].includes(action)) {
      let run = await load(auth, id(body.runId));
      const task = run.task;
      if (
        ["running", "queued"].includes(run.status) &&
        run.delivery_deadline_at &&
        Date.now() >= Date.parse(run.delivery_deadline_at)
      ) {
        run = await fail(
          auth,
          run.id,
          "delivery_timeout",
          run.metadata?.phase || "delivery",
        );
      }
      if (action === "fail") {
        const stage = clean(body.stage, "delivery", 50);
        run = await fail(
          auth,
          run.id,
          stage === "client_deadline"
            ? "delivery_timeout"
            : "client_delivery_failed",
          run.metadata?.phase || stage,
          { client_stage: stage, last_error: run.metadata?.last_error || null },
        );
        return response(task, run);
      }
      if (action === "acknowledge") {
        const r = await auth.userClient.rpc("hai_acknowledge_image_delivery", {
          p_run_id: run.id,
        });
        if (r.error) throw new Error(r.error.message);
        return response(task, r.data);
      }
      if (action === "download") {
        if (run.status === "failed" || !run.r2_key) {
          throw new HttpError(409, IMAGE_FAILURE_MESSAGE);
        }
        const file = await readStoredImage(
          run.r2_key,
          run.status === "completed"
            ? undefined
            : run.delivery_deadline_at
            ? Date.parse(run.delivery_deadline_at)
            : undefined,
        );
        return new Response(file.bytes.buffer, {
          headers: {
            "content-type": file.contentType,
            "cache-control": "private, max-age=300",
            "access-control-allow-origin": "*",
          },
        });
      }
      if (action === "status") {
        await collectResult(auth, run);
        run = await load(auth, run.id);
      }
      return response(task, run);
    }
    if (action !== "generate") throw new HttpError(400, "图片操作不正确。");
    const prompt = typeof body.prompt === "string"
        ? body.prompt.trim().slice(0, 6000)
        : "",
      size = clean(body.size, "16:9", 20),
      style = clean(body.style, "教育扁平插画", 40),
      imageType = clean(body.imageType, "课件 PPT", 40),
      subject = clean(body.subject, "", 40);
    if (
      !prompt || !sizes.has(size) || !styles.has(style) ||
      !types.has(imageType) || (subject !== "" && !subjects.has(subject))
    ) throw new HttpError(400, "请检查提示词和图片选项。");
    if (files.length > 6) {
      throw new HttpError(400, "最多只能上传 6 张参考图片。");
    }
    const clientRequestId = clean(body.clientRequestId, "", 160) ||
      crypto.randomUUID();
    const existing = await auth.admin.from("hai_image_generation_runs").select(
      "*, task:hai_image_generation_tasks(*)",
    ).eq("user_id", auth.user.id).eq("client_request_id", clientRequestId)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) {
      let run = existing.data;
      if (
        ["running", "queued"].includes(run.status) &&
        Date.now() >= Date.parse(run.delivery_deadline_at)
      ) {
        run = await fail(
          auth,
          run.id,
          "delivery_timeout",
          run.metadata?.phase || "delivery",
        );
      }
      return response(existing.data.task, run);
    }
    let task: Row;
    if (id(body.taskId)) {
      const r = await auth.admin.from("hai_image_generation_tasks").select("*")
        .eq("id", id(body.taskId)).eq("user_id", auth.user.id).maybeSingle();
      if (r.error || !r.data) {
        throw new HttpError(404, "图片任务不存在或无权访问。");
      }
      task = r.data;
    } else {
      const r = await auth.admin.from("hai_image_generation_tasks").insert({
        user_id: auth.user.id,
        title: prompt.slice(0, 28),
      }).select("*").single();
      if (r.error) throw new Error(r.error.message);
      task = r.data;
    }
    let references = validateStoredReferenceImages(
      body.referenceImages,
      auth.user.id,
    );
    const referenceIds = ids(body.referenceRunIds);
    if (referenceIds.length) {
      const r = await auth.admin.from("hai_image_generation_runs").select(
        "id,r2_key",
      ).in("id", referenceIds).eq("task_id", task.id).eq(
        "user_id",
        auth.user.id,
      ).eq("status", "completed");
      if (
        r.error || r.data?.length !== referenceIds.length ||
        r.data.some((item) => !item.r2_key)
      ) throw new HttpError(400, "参考图片不存在或尚未完成。");
      references = [
        ...references,
        ...r.data.map((item) => ({
          url: publicStoredImageUrl(item.r2_key),
          key: item.r2_key,
          name: "上一轮生成图片",
          contentType: "image/png",
          size: null,
        })),
      ];
    }
    if (references.length + files.length > 6) {
      throw new HttpError(400, "最多只能使用 6 张参考图片。");
    }
    const parentRunId = id(body.parentRunId);
    if (parentRunId) {
      const r = await auth.admin.from("hai_image_generation_runs").select("id")
        .eq("id", parentRunId).eq("task_id", task.id).eq(
          "user_id",
          auth.user.id,
        ).maybeSingle();
      if (r.error || !r.data) throw new HttpError(400, "上一轮记录不正确。");
    }
    const r = await auth.admin.from("hai_image_generation_runs").insert({
      task_id: task.id,
      user_id: auth.user.id,
      parent_run_id: parentRunId || null,
      client_request_id: clientRequestId,
      prompt,
      composed_prompt: composeImageGenerationPrompt(
        prompt,
        size,
        style,
        imageType,
        references.length + files.length > 0,
        subject,
      ),
      image_size: size,
      art_style: style,
      image_type: imageType,
      reference_images: references,
      delivery_deadline_at: null,
      metadata: {
        points: IMAGE_GENERATION_POINTS,
        phase: "queued",
        execution_mode: "provider_async",
        prompt_strategy: "static_template",
        subject: subject || null,
        input: { prompt, size, style, imageType, subject: subject || null },
      },
    }).select("*").single();
    if (r.error) throw new Error(r.error.message);
    // Wait only for upload/submission and persist the receipt before responding.
    // No detached Edge worker waits for the third-party generation to finish.
    await generate(auth, r.data, files, references);
    const submitted = await load(auth, r.data.id);
    return response(task, submitted);
  } catch (error) {
    console.warn("hai image request failed", detail(error));
    return jsonResponse({
      error: error instanceof HttpError && error.status < 500
        ? error.message
        : IMAGE_FAILURE_MESSAGE,
    }, error instanceof HttpError ? error.status : 500);
  }
}
