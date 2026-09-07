import { assertHaiAccess, finalizeImageGeneration, handleCors, HttpError, jsonResponse, recordHaiModelCall, reserveImageGeneration, requireUser, streamDeepSeek, type HaiProviderUsage } from "../_shared/hai.ts";
import { generateImage, getStoredImageAccessUrl, IMAGE_GENERATION_POINTS, ImageGenerationTaskError, persistImage, persistReferenceImages, publicStoredImageUrl, readImageProviderConfig, readStoredImage, validateStoredReferenceImages, type ImageGenerationSize, type StoredReferenceImage } from "../_shared/hai_image_generation.ts";

const sizes = new Set(["16:9", "1:1", "3:4", "4:3", "9:16"]);
const styles = new Set([
  "卡通", "写真", "3D", "教育扁平插画", "水彩", "杂志拼贴",
  "手绘绘本", "国风水墨", "科技未来", "黏土定格", "扁平信息图", "黑板粉笔", "纸艺拼贴", "漫画分镜",
]);
const types = new Set([
  "概念图", "素材图", "海报", "学习单", "课堂插图", "流程图", "思维导图", "知识卡片", "活动任务卡", "板书设计", "题目讲解图", "课前导入图",
]);
type Body = { action?: unknown; taskId?: unknown; runId?: unknown; parentRunId?: unknown; clientRequestId?: unknown; prompt?: unknown; size?: unknown; style?: unknown; imageType?: unknown; referenceImages?: unknown; referenceRunIds?: unknown };

function clean(value: unknown, fallback = "", limit = 600) { return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) : fallback; }
function errorMessage(error: unknown) { return (error instanceof Error ? error.message : "图片生成失败。").replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 500); }
function composePrompt(prompt: string, size: string, style: string, imageType: string) {
  return [
    "你是教学设计师俱乐部的教学视觉设计师。",
    `图片尺寸：${size}。PPT 艺术风格：${style}。图片用途：${imageType}。`,
    `教学场景提示词：${prompt}`,
    "请服务于课堂、教案、PPT、学习任务或教学传播；画面主体、构图、色彩和信息层级要清晰，适合教师直接使用。若不是海报或学习单，不要在画面内添加大段文字；不要生成 logo、水印或虚构的品牌标识。",
  ].join("\n");
}
function taskTitle(prompt: string) { const value = prompt.replace(/\s+/g, " ").trim(); return value.length > 28 ? `${value.slice(0, 28)}…` : value || "新的图片生成"; }
function taskId(value: unknown) { const id = clean(value, "", 80); return /^[0-9a-f-]{36}$/i.test(id) ? id : ""; }
function taskIds(value: unknown) { return Array.isArray(value) ? value.map(taskId).filter(Boolean).slice(0, 6) : []; }
function parseJson(value: FormDataEntryValue | null) { if (typeof value !== "string" || !value) return undefined; try { return JSON.parse(value) as unknown; } catch { return undefined; } }

async function readRequestBody(request: Request): Promise<{ body: Body; referenceFiles: File[] }> {
  if (request.headers.get("content-type")?.toLowerCase().includes("multipart/form-data")) {
    const form = await request.formData();
    return {
      body: {
        action: form.get("action"),
        taskId: form.get("taskId"),
        runId: form.get("runId"),
        parentRunId: form.get("parentRunId"),
        clientRequestId: form.get("clientRequestId"),
        prompt: form.get("prompt"),
        size: form.get("size"),
        style: form.get("style"),
        imageType: form.get("imageType"),
        referenceRunIds: parseJson(form.get("referenceRunIds")),
      },
      referenceFiles: form.getAll("reference_images").filter((value): value is File => value instanceof File),
    };
  }
  return { body: await request.json().catch(() => ({})) as Body, referenceFiles: [] };
}

class ImagePromptOptimizationError extends Error {
  readonly model: string;
  readonly provider: string;
  readonly durationMs: number;
  readonly usage: HaiProviderUsage | null;

  constructor(message: string, params: { model: string; provider: string; durationMs: number; usage: HaiProviderUsage | null }) {
    super(message);
    this.name = "ImagePromptOptimizationError";
    this.model = params.model;
    this.provider = params.provider;
    this.durationMs = params.durationMs;
    this.usage = params.usage;
  }
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;
  try {
    if (request.method !== "POST") throw new HttpError(405, "只支持 POST。");
    const auth = await requireUser(request);
    await assertHaiAccess(auth.userClient);
    const { body, referenceFiles } = await readRequestBody(request);
    const action = clean(body.action, "generate", 20);
    if (action === "download") {
      const key = clean(body.runId, "", 300);
      if (!key || key.includes("..") || key.startsWith("/")) throw new HttpError(400, "图片标识不正确。");
      const { data: run, error } = await auth.admin.from("hai_image_generation_runs").select("r2_key").eq("id", key).eq("user_id", auth.user.id).maybeSingle();
      if (error) throw new HttpError(500, error.message);
      if (!run?.r2_key) throw new HttpError(404, "图片文件不存在。");
      const file = await readStoredImage(run.r2_key);
      return new Response(file.bytes.buffer, { headers: { "content-type": file.contentType, "cache-control": "private, max-age=300", "access-control-allow-origin": "*" } });
    }
    const prompt = clean(body.prompt, "", 6000);
    const size = clean(body.size, "16:9", 20);
    const style = clean(body.style, "教育扁平插画", 40);
    const imageType = clean(body.imageType, "概念图", 40);
    if (!prompt) throw new HttpError(400, "请输入图片提示词。");
    if (!sizes.has(size) || !styles.has(style) || !types.has(imageType)) throw new HttpError(400, "图片选项不正确，请重新选择。");
    if (referenceFiles.length > 6) throw new HttpError(400, "最多只能上传 6 张参考图片。");
    const clientRequestId = clean(body.clientRequestId, "", 160) || crypto.randomUUID();
    const existing = await auth.admin.from("hai_image_generation_runs").select("*, task:hai_image_generation_tasks(*)").eq("user_id", auth.user.id).eq("client_request_id", clientRequestId).maybeSingle();
    if (existing.error) throw new HttpError(500, existing.error.message);
    if (existing.data?.status === "completed") return jsonResponse({ task: existing.data.task, run: existing.data, replayed: true });
    if (existing.data?.status === "running" || existing.data?.status === "queued") throw new HttpError(409, "这轮图片正在生成，请稍候。");

    const requestedTaskId = taskId(body.taskId);
    let task: Record<string, unknown> | null = null;
    if (requestedTaskId) {
      const result = await auth.admin.from("hai_image_generation_tasks").select("*").eq("id", requestedTaskId).eq("user_id", auth.user.id).maybeSingle();
      if (result.error) throw new HttpError(500, result.error.message);
      if (!result.data) throw new HttpError(404, "图片任务不存在或你无权访问。");
      task = result.data as Record<string, unknown>;
    } else {
      const result = await auth.admin.from("hai_image_generation_tasks").insert({ user_id: auth.user.id, title: taskTitle(prompt) }).select("*").single();
      if (result.error) throw new HttpError(500, result.error.message);
      task = result.data as Record<string, unknown>;
    }
    const composedPrompt = composePrompt(prompt, size, style, imageType);
    let referenceImages: StoredReferenceImage[] = [];
    if (body.referenceImages !== undefined) {
      try {
        referenceImages = validateStoredReferenceImages(body.referenceImages, auth.user.id);
      } catch (error) {
        throw new HttpError(400, error instanceof Error ? error.message : "参考图片标识不正确。");
      }
    }
    const referenceRunIds = taskIds(body.referenceRunIds);
    if (referenceRunIds.length) {
      const previous = await auth.admin.from("hai_image_generation_runs").select("id,r2_key,image_url").in("id", referenceRunIds).eq("task_id", task.id).eq("user_id", auth.user.id).eq("status", "completed");
      if (previous.error) throw new HttpError(500, previous.error.message);
      if ((previous.data ?? []).length !== referenceRunIds.length || (previous.data ?? []).some((item) => !item.r2_key)) throw new HttpError(400, "选择的参考图片不存在或尚未保存完成。");
      referenceImages = [...referenceImages, ...(previous.data ?? []).map((item) => ({
        url: publicStoredImageUrl(String(item.r2_key)),
        key: String(item.r2_key),
        name: "上一轮生成图片",
        contentType: "image/png",
        size: null,
      })) as StoredReferenceImage[]];
    }
    if (referenceImages.length + referenceFiles.length > 6) throw new HttpError(400, "最多只能使用 6 张参考图片。");
    const parentRunId = taskId(body.parentRunId);
    if (parentRunId) {
      const parent = await auth.admin.from("hai_image_generation_runs").select("id").eq("id", parentRunId).eq("task_id", task.id).eq("user_id", auth.user.id).maybeSingle();
      if (parent.error) throw new HttpError(500, parent.error.message);
      if (!parent.data) throw new HttpError(400, "继续生成时的上一轮记录不正确。");
    }
    const result = await auth.admin.from("hai_image_generation_runs").insert({
      task_id: task.id, user_id: auth.user.id, parent_run_id: parentRunId || null,
      client_request_id: clientRequestId, prompt, composed_prompt: composedPrompt, image_size: size, art_style: style, image_type: imageType,
      reference_images: referenceImages,
      metadata: { points: IMAGE_GENERATION_POINTS, input: { prompt, size, style, imageType, prompt_strategy: "pending" } },
    }).select("*").single();
    if (result.error) throw new HttpError(500, result.error.message);
    const run = result.data as Record<string, unknown>;
    const billingMetadata = { task_id: task.id, run_id: run.id, image_size: size, art_style: style, image_type: imageType, points: IMAGE_GENERATION_POINTS };
    let reserved = false;
    const startedAt = Date.now();
    let generatedTaskId: string | undefined;
    let generatedSourceUrl = "";
    let generatedProviderResponse: unknown;
    try {
      await reserveImageGeneration({ userClient: auth.userClient, requestId: clientRequestId, route: "hai-image-generation", metadata: billingMetadata });
      reserved = true;
      await auth.admin.from("hai_image_generation_runs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", run.id).eq("user_id", auth.user.id);
      const config = readImageProviderConfig();
      await auth.admin.from("hai_image_generation_runs").update({ provider: config.provider, model: config.model }).eq("id", run.id).eq("user_id", auth.user.id);
      if (referenceFiles.length) {
        referenceImages = [...referenceImages, ...await persistReferenceImages({ files: referenceFiles, userId: auth.user.id, taskId: String(task.id), runId: String(run.id) })];
        await auth.admin.from("hai_image_generation_runs").update({ reference_images: referenceImages }).eq("id", run.id).eq("user_id", auth.user.id);
      }
      const isImageEdit = referenceImages.length > 0;
      let finalPrompt = prompt;
      if (isImageEdit) {
        // An edit prompt is intentionally kept verbatim. DeepSeek can add
        // new subjects or rewrite the requested change, causing the result
        // to drift too far from the reference image.
        await auth.admin.from("hai_image_generation_runs").update({
          composed_prompt: prompt,
          optimized_prompt: null,
          prompt_optimizer_model: null,
          prompt_optimizer_provider: null,
          prompt_optimizer_usage: {},
          prompt_optimizer_duration_ms: null,
          prompt_optimizer_error: null,
          metadata: { points: IMAGE_GENERATION_POINTS, input: { prompt, size, style, imageType, prompt_strategy: "image_edit_direct" } },
        }).eq("id", run.id).eq("user_id", auth.user.id);
      } else {
        const optimized = await optimizeImagePrompt({
          prompt,
          size,
          style,
          imageType,
          basePrompt: composedPrompt,
          admin: auth.admin,
          userId: auth.user.id,
          requestId: clientRequestId,
          runId: String(run.id),
          referenceImageCount: 0,
        });
        finalPrompt = optimized.prompt;
        await auth.admin.from("hai_image_generation_runs").update({
          composed_prompt: optimized.prompt,
          optimized_prompt: optimized.prompt,
          prompt_optimizer_model: optimized.model,
          prompt_optimizer_provider: optimized.provider,
          prompt_optimizer_usage: optimized.usage || {},
          prompt_optimizer_duration_ms: optimized.durationMs,
          prompt_optimizer_error: null,
          metadata: { points: IMAGE_GENERATION_POINTS, input: { prompt, size, style, imageType, prompt_strategy: "deepseek_optimized" } },
        }).eq("id", run.id).eq("user_id", auth.user.id);
      }
      const referenceImageUrls = await Promise.all(referenceImages.map((image) => getStoredImageAccessUrl(image.key)));
      const generated = await generateImage(config, { prompt: finalPrompt, size: size as ImageGenerationSize, referenceImageUrls });
      generatedTaskId = generated.taskId;
      generatedSourceUrl = generated.url;
      generatedProviderResponse = generated.providerResponse;
      // Persist provider output before downloading it into R2. If the source
      // URL is temporarily unavailable, support can still trace/reconcile
      // the provider task instead of seeing an opaque failed run.
      await auth.admin.from("hai_image_generation_runs").update({
        provider_task_id: generatedTaskId || null,
        source_url: generatedSourceUrl,
        provider_response: generatedProviderResponse || {},
      }).eq("id", run.id).eq("user_id", auth.user.id);
      const stored = await persistImage({ sourceUrl: generated.url, userId: auth.user.id, taskId: String(task.id), runId: String(run.id) });
      const durationMs = Date.now() - startedAt;
      const update = await auth.admin.from("hai_image_generation_runs").update({ status: "completed", provider_task_id: generated.taskId || null, source_url: generated.url, r2_key: stored.key, image_url: stored.url, provider_response: generated.providerResponse || {}, duration_ms: durationMs, completed_at: new Date().toISOString(), error_message: null }).eq("id", run.id).eq("user_id", auth.user.id).select("*").single();
      if (update.error) throw new Error(update.error.message);
      await auth.admin.from("hai_image_generation_tasks").update({ updated_at: new Date().toISOString() }).eq("id", task.id).eq("user_id", auth.user.id);
      await finalizeImageGeneration({ userClient: auth.userClient, requestId: clientRequestId, status: "completed", route: "hai-image-generation", entityId: String(task.id), durationMs, metadata: { ...billingMetadata, provider_task_id: generated.taskId || null, r2_key: stored.key } });
      return jsonResponse({ task, run: update.data, image: { url: stored.url, key: stored.key, width: null, height: null }, points: IMAGE_GENERATION_POINTS });
    } catch (generationError) {
      const providerTaskId = generationError instanceof ImageGenerationTaskError ? generationError.taskId : generatedTaskId;
      const message = errorMessage(generationError);
      const optimizationError = generationError instanceof ImagePromptOptimizationError ? generationError : null;
      const providerError = generationError instanceof ImageGenerationTaskError ? generationError.providerResponse : generatedProviderResponse;
      await auth.admin.from("hai_image_generation_runs").update({
        status: "failed",
        provider_task_id: providerTaskId || null,
        source_url: generatedSourceUrl || null,
        error_message: message,
        prompt_optimizer_model: optimizationError?.model || null,
        prompt_optimizer_provider: optimizationError?.provider || null,
        prompt_optimizer_usage: optimizationError?.usage || {},
        prompt_optimizer_duration_ms: optimizationError?.durationMs || null,
        prompt_optimizer_error: optimizationError ? message : null,
        provider_response: providerError || { error: message },
        duration_ms: Date.now() - startedAt,
        completed_at: new Date().toISOString(),
      }).eq("id", run.id).eq("user_id", auth.user.id);
      if (reserved) await finalizeImageGeneration({ userClient: auth.userClient, requestId: clientRequestId, status: "failed", route: "hai-image-generation", entityId: String(task.id), durationMs: Date.now() - startedAt, metadata: { ...billingMetadata, provider_task_id: providerTaskId || null, error: message } });
      if (generationError instanceof HttpError) throw generationError;
      throw new HttpError(502, message);
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    return jsonResponse({ error: errorMessage(error) }, status);
  }
});

async function optimizeImagePrompt(params: {
  prompt: string;
  size: string;
  style: string;
  imageType: string;
  basePrompt: string;
  admin: Parameters<typeof recordHaiModelCall>[0]["admin"];
  userId: string;
  requestId: string;
  runId: string;
  referenceImageCount: number;
}) {
  const model = Deno.env.get("DEEPSEEK_MODEL") || "deepseek-v4-flash";
  const startedAt = new Date();
  let output = "";
  let usage: HaiProviderUsage | null = null;
  let provider = "deepseek";
  const system = [
    "你是专业的教学视觉生图提示词优化器。",
    "请把用户的简短需求和已选参数，改写成一段可以直接交给文生图模型执行的高质量提示词。",
    "补全主体、场景、构图、视角、层次、色彩、光线、材质和教学使用语境，但不要凭空添加会改变用户意图的具体事实。",
    "必须严格遵守用户选择的图片尺寸、艺术风格和图片类型；海报或学习单需要规划清晰的信息区域，其他图片不要添加大段文字。",
    "只输出最终提示词，不要解释优化过程，不要使用 Markdown、标题、引号或‘优化后的提示词：’等前缀。",
  ].join("\n");
  const user = [
    `用户原始提示词：${params.prompt}`,
    `图片尺寸：${params.size}`,
    `PPT 艺术风格：${params.style}`,
    `图片用途：${params.imageType}`,
    `基础教学约束：${params.basePrompt}`,
  ].join("\n");

  try {
    for await (const token of streamDeepSeek([
      { role: "system", content: system },
      { role: "user", content: user },
    ], {
      model,
      temperature: 0.2,
      maxTokens: 900,
      thinkingEnabled: false,
      userId: params.userId,
      admin: params.admin,
      timeoutMs: 60_000,
      onUsage: (value) => { usage = value; },
      onProviderResolved: (value) => { provider = value; },
    })) output += token;

    const optimizedPrompt = normalizeOptimizedPrompt(output);
    if (!optimizedPrompt) throw new Error("DeepSeek 没有返回有效的优化提示词。");
    const completedAt = new Date();
    await recordHaiModelCall({
      admin: params.admin,
      userId: params.userId,
      requestId: params.requestId,
      callIndex: 1,
      stage: "image_prompt_optimization",
      route: "hai-image-generation",
      entityType: "hai_image_generation_run",
      entityId: params.runId,
      model,
      provider,
      startedAt,
      completedAt,
      status: "completed",
      usage,
        metadata: { run_id: params.runId, image_size: params.size, art_style: params.style, image_type: params.imageType, reference_image_count: params.referenceImageCount },
    });
    return { prompt: optimizedPrompt, model, provider, usage, durationMs: completedAt.getTime() - startedAt.getTime() };
  } catch (error) {
    const completedAt = new Date();
    await recordHaiModelCall({
      admin: params.admin,
      userId: params.userId,
      requestId: params.requestId,
      callIndex: 1,
      stage: "image_prompt_optimization",
      route: "hai-image-generation",
      entityType: "hai_image_generation_run",
      entityId: params.runId,
      model,
      provider,
      startedAt,
      completedAt,
      status: "failed",
      usage,
      metadata: { run_id: params.runId, image_size: params.size, art_style: params.style, image_type: params.imageType, reference_image_count: params.referenceImageCount, error: errorMessage(error) },
    });
    throw new ImagePromptOptimizationError(errorMessage(error), { model, provider, durationMs: completedAt.getTime() - startedAt.getTime(), usage });
  }
}

function normalizeOptimizedPrompt(value: string) {
  return value
    .replace(/^```(?:text|markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^(?:优化后的提示词|最终提示词|prompt)\s*[:：]\s*/i, "")
    .trim()
    .slice(0, 8_000);
}
