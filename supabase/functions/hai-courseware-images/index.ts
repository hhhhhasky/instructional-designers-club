import { loadImagePromptOverrides } from "../_shared/hai_image_prompt_config.ts";
import {
  assertHaiAccess,
  corsHeaders,
  handleCors,
  HttpError,
  jsonResponse,
  finalizeCoursewareImage,
  reserveCoursewareImage,
  requireUser,
} from "../_shared/hai.ts";
import {
  applyCoursewareImage,
  buildCoursewareImagePlan,
  CoursewareImageTaskError,
  generateToApisImage,
  readImageProviderConfig,
  type CoursewareImagePlanItem,
} from "../_shared/hai_courseware_images.ts";
import { hydrateCoursewareImageUrls, persistCoursewareImage, readCoursewareImage, signCoursewareImageUrl } from "../_shared/hai_courseware_image_storage.ts";

type RequestBody = {
  action?: unknown;
  deckId?: unknown;
  slideId?: unknown;
};

type GenerationResult = {
  slideId: string;
  status: "ready" | "failed";
  url?: string;
  error?: string;
};

function cleanError(error: unknown) {
  return (error instanceof Error ? error.message : "图片生成失败。")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 500);
}

async function runPool<T>(items: T[], concurrency: number, task: (item: T) => Promise<void>) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const current = items[cursor++];
      await task(current);
    }
  }));
}

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;
  try {
    if (request.method !== "POST") throw new HttpError(405, "只支持 POST。");
    const auth = await requireUser(request);
    await assertHaiAccess(auth.userClient);
    const body = await request.json().catch(() => ({})) as RequestBody;
    const deckId = String(body.deckId ?? "").trim();
    const action = body.action === "generate" || body.action === "download" ? body.action : "plan";
    const requestedSlideId = String(body.slideId ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(deckId)) throw new HttpError(400, "课件标识不正确。");

    const { data: deck, error } = await auth.admin.from("hai_courseware_decks")
      .select("*")
      .eq("id", deckId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (error) throw new HttpError(500, error.message);
    if (!deck) throw new HttpError(404, "课件不存在或你无权访问。");
    if (deck.status !== "completed" || !deck.deck_spec) throw new HttpError(409, "课件正文尚未生成完成。");

    let deckSpec = deck.deck_spec;
    if (action === "download") {
      if (!requestedSlideId) throw new HttpError(400, "缺少页面标识。");
      const slides = (deckSpec as { slides?: Array<{ slideId?: string; image?: { status?: string; assetKey?: string } }> }).slides ?? [];
      const image = slides.find((slide) => slide.slideId === requestedSlideId)?.image;
      if (image?.status !== "ready" || !image.assetKey) throw new HttpError(404, "本页没有可导出的生成图片。");
      const file = await readCoursewareImage(image.assetKey);
      return new Response(Uint8Array.from(file.bytes).buffer, {
        status: 200,
        headers: { ...corsHeaders, "content-type": file.contentType, "cache-control": "private, max-age=300" },
      });
    }
    const promptOverrides = await loadImagePromptOverrides(auth.admin);
    let plan = buildCoursewareImagePlan(deckSpec, promptOverrides);
    if (action === "plan") {
      let configured = true;
      try {
        readImageProviderConfig();
      } catch {
        configured = false;
      }
      const hydratedSpec = await hydrateCoursewareImageUrls(deckSpec).catch(() => deckSpec);
      return jsonResponse({ plan, configured, deck: { ...deck, deck_spec: hydratedSpec } });
    }

    const config = readImageProviderConfig();
    let items = requestedSlideId
      ? plan.items.filter((item) => item.slideId === requestedSlideId)
      : plan.items.filter((item) => {
        const slides = (deckSpec as { slides?: Array<{ slideId?: string; image?: { status?: string; url?: string } }> }).slides ?? [];
        const slide = slides.find((candidate) => candidate.slideId === item.slideId);
        return slide?.image?.status !== "ready" || !slide.image.url;
      });
    // A generation invocation owns one provider task. The client orchestrates
    // the full deck one slide at a time so every image gets its own wall clock
    // and is persisted before the next request starts. Keep the legacy
    // no-slide-id call safe by processing only the first pending item.
    if (!requestedSlideId && items.length > 1) items = items.slice(0, 1);
    if (requestedSlideId && !items.length) throw new HttpError(400, "该页面不在本套课件的配图规划中。");
    if (!items.length) {
      const hydratedSpec = await hydrateCoursewareImageUrls(deckSpec).catch(() => deckSpec);
      return jsonResponse({ deck: { ...deck, deck_spec: hydratedSpec }, plan, results: [] });
    }

    const results: GenerationResult[] = [];

    const generateOne = async (item: CoursewareImagePlanItem) => {
      const billingRequestId = `${deckId}:${item.slideId}:image`;
      const billingMetadata = {
        deck_id: deckId,
        slide_id: item.slideId,
        pipeline_stage: "image_generation",
        image_count: 1,
        image_unit_cost_cny: 0.105,
        provider: config.provider,
        model: config.model,
      };
      let usageReserved = false;
      try {
        await reserveCoursewareImage({ userClient: auth.userClient, requestId: billingRequestId, route: "hai-courseware-images", metadata: billingMetadata });
        usageReserved = true;
        const generated = await generateToApisImage(config, item, {
          taskId: item.providerTaskId,
        });
        const stored = await persistCoursewareImage({
          sourceUrl: generated.url,
          userId: auth.user.id,
          deckId,
          slideId: item.slideId,
        });
        await finalizeCoursewareImage({ userClient: auth.userClient, requestId: billingRequestId, status: "completed", route: "hai-courseware-images", entityType: "courseware_deck", entityId: deckId, durationMs: null, metadata: billingMetadata });
        deckSpec = applyCoursewareImage(deckSpec, item, {
          status: "ready",
          url: stored.url,
          key: stored.key,
          provider: config.provider,
          model: config.model,
          taskId: generated.taskId,
        });
        results.push({ slideId: item.slideId, status: "ready", url: stored.url });
        return await signCoursewareImageUrl(stored.key).catch(() => undefined);
      } catch (generationError) {
        if (usageReserved) await finalizeCoursewareImage({ userClient: auth.userClient, requestId: billingRequestId, status: "failed", route: "hai-courseware-images", entityType: "courseware_deck", entityId: deckId, durationMs: null, metadata: billingMetadata });
        const message = cleanError(generationError);
        const providerTaskId = generationError instanceof CoursewareImageTaskError
          ? generationError.taskId
          : undefined;
        deckSpec = applyCoursewareImage(deckSpec, item, {
          status: "failed",
          error: message,
          provider: config.provider,
          model: config.model,
          taskId: providerTaskId,
        });
        results.push({ slideId: item.slideId, status: "failed", error: message });
        return undefined;
      }
    };

    const cover = items.find((item) => item.role === "cover");
    if (cover) {
      await generateOne(cover);
      items = items.filter((item) => item.slideId !== cover.slideId);
    }
    await runPool(items, 8, async (item) => {
      await generateOne(item);
    });

    const { data: updated, error: updateError } = await auth.admin.from("hai_courseware_decks")
      .update({ deck_spec: deckSpec })
      .eq("id", deckId)
      .eq("user_id", auth.user.id)
      .select("*")
      .single();
    if (updateError) throw new HttpError(500, updateError.message);
    plan = buildCoursewareImagePlan(deckSpec, promptOverrides);
    const hydratedSpec = await hydrateCoursewareImageUrls(deckSpec).catch(() => deckSpec);
    return jsonResponse({ deck: { ...updated, deck_spec: hydratedSpec }, plan, results });
  } catch (error) {
    if (error instanceof HttpError) return jsonResponse({ error: error.message }, error.status);
    console.error("hai-courseware-images failed", error instanceof Error ? error.message : error);
    return jsonResponse({ error: cleanError(error) }, 500);
  }
});
