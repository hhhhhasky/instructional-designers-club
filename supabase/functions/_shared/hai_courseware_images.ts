import { renderImagePrompt, type ImagePromptOverrides } from "./hai_image_prompt_catalog.ts";

type Raw = Record<string, unknown>;

export type CoursewareImageRole = "cover" | "task" | "content";
export type CoursewareImageType = "background" | "illustration" | "material";
export type CoursewareImageFit = "contain" | "cover";

export type CoursewareImagePlanItem = {
  slideId: string;
  slideIndex: number;
  slideTitle: string;
  slideFunction: string;
  role: CoursewareImageRole;
  requiredBy: "cover" | "task-page" | "model-request" | "enhanced-context" | "pure-image-page";
  sourceDescription: string;
  prompt: string;
  imageType: CoursewareImageType;
  fit: CoursewareImageFit;
  safeZone: "center" | "left";
  subjectPosition: "center" | "right";
  size: "16:9";
  resolution: "1K";
  providerTaskId?: string;
};

export type CoursewareImagePlan = {
  items: CoursewareImagePlanItem[];
  total: number;
  ready: number;
  pending: number;
};

export type ImageProviderConfig = {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type GeneratedProviderImage = {
  taskId?: string;
  url: string;
};

/**
 * Provider tasks are asynchronous. Keep the task id on terminal errors so a
 * later reconciliation can fetch a task that finished after this request
 * stopped waiting.
 */
export class CoursewareImageTaskError extends Error {
  taskId?: string;

  constructor(message: string, taskId?: string) {
    super(message);
    this.name = "CoursewareImageTaskError";
    this.taskId = taskId;
  }
}

function record(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Raw
    : {};
}

function cleanText(value: unknown, fallback = "", limit = 500) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, limit)
    : fallback;
}

function stringList(value: unknown, limit = 8) {
  return Array.isArray(value)
    ? value.map((entry) => cleanText(entry, "", 80)).filter(Boolean).slice(0, limit)
    : [];
}

function imageComponent(slide: Raw) {
  const components = Array.isArray(slide.components) ? slide.components : [];
  return components.map(record).find((component) => component.type === "image");
}

function imageDescription(slide: Raw) {
  const component = imageComponent(slide);
  const visual = record(component?.visual);
  return cleanText(
    slide.imagePrompt || visual.description || component?.text || slide.imageDescription,
    "",
    1200,
  );
}

function slideImage(slide: Raw) {
  return record(slide.image);
}

function unifiedStyle(deck: Raw, overrides: ImagePromptOverrides) {
  const profile = record(deck.visualProfile);
  const palette = stringList(profile.palette, 4).join("、") || "课程主题配色";
  return renderImagePrompt("courseware.style", {
    illustration_style: cleanText(profile.illustrationStyle, "教育主题编辑插画", 120),
    palette, lighting: cleanText(profile.lighting, "柔和", 60),
    texture: cleanText(profile.texture, "细腻克制", 60),
    realism: cleanText(profile.realismLevel, "半写实", 60),
  }, overrides);
}

function planPrompt(deck: Raw, slide: Raw, role: CoursewareImageRole, description: string, overrides: ImagePromptOverrides) {
  const title = cleanText(deck.title, "课堂课件", 120);
  const slideTitle = cleanText(slide.title, "课堂页面", 120);
  const style = unifiedStyle(deck, overrides);
  if (deck.visualMode === "V3" && cleanText(slide.imagePrompt, "", 12000)) {
    return renderImagePrompt("courseware.generated_page", { image_prompt: cleanText(slide.imagePrompt, "", 12000) }, overrides);
  }
  return renderImagePrompt("courseware.background", {
    title, slide_title: slideTitle, page_number: Number(slide.index ?? 0) + 1,
    role: role === "cover" ? "封面" : role === "task" ? "任务页" : "内容页",
    style, description: description || slideTitle,
  }, overrides);
}

function desiredCandidates(deck: Raw) {
  const slides = Array.isArray(deck.slides) ? deck.slides.map(record) : [];
  const candidates: Array<Omit<CoursewareImagePlanItem, "prompt">> = [];
  for (const [position, slide] of slides.entries()) {
    const slideId = cleanText(slide.slideId, `s${String(position + 1).padStart(2, "0")}`, 80);
    const slideIndex = Number.isFinite(Number(slide.index)) ? Number(slide.index) : position;
    const slideTitle = cleanText(slide.title, `第 ${position + 1} 页`, 120);
    const slideFunction = cleanText(slide.function, "F05_CONTENT", 40);
    const component = imageComponent(slide);
    const componentDescription = imageDescription(slide);
    let role: CoursewareImageRole | null = null;
    let requiredBy: CoursewareImagePlanItem["requiredBy"] | null = null;
    if (slideFunction === "F01_COVER" || position === 0) {
      role = "cover";
      requiredBy = "cover";
    } else if (slideFunction === "F10_ACTIVITY" || cleanText(slide.pageFunction).includes("STUDENT_TASK")) {
      role = "task";
      requiredBy = "task-page";
    } else if (deck.visualMode === "V2" || deck.visualMode === "V3") {
      role = "content";
      requiredBy = deck.visualMode === "V3" ? "pure-image-page" : "model-request";
    } else if (component) {
      role = "content";
      requiredBy = "enhanced-context";
    }
    if (!role || !requiredBy) continue;
    candidates.push({
      slideId,
      slideIndex,
      slideTitle,
      slideFunction,
      role,
      requiredBy,
      sourceDescription: componentDescription || cleanText(slide.question || slide.task || slide.body, slideTitle, 1200),
      imageType: "background",
      fit: "cover",
      safeZone: role === "cover" ? "center" : "left",
      subjectPosition: role === "cover" ? "center" : "right",
      size: "16:9",
      resolution: "1K",
      providerTaskId: cleanText(slideImage(slide).providerTaskId, "", 200) || undefined,
    });
  }
  return candidates;
}

export function buildCoursewareImagePlan(deckValue: unknown, overrides: ImagePromptOverrides = {}): CoursewareImagePlan {
  const deck = record(deckValue);
  if (deck.visualMode !== "V2" && deck.visualMode !== "V3") return { items: [], total: 0, ready: 0, pending: 0 };
  const strategy = ["minimal", "smart", "enhanced"].includes(String(deck.imageStrategy))
    ? String(deck.imageStrategy)
    : "smart";
  const candidates = desiredCandidates(deck);
  const required = candidates.filter((item) => item.requiredBy === "cover" || item.requiredBy === "task-page");
  const optional = candidates.filter((item) => !required.includes(item));
  const cap = deck.visualMode === "V2" || deck.visualMode === "V3"
    ? candidates.length
    : strategy === "minimal" ? required.length : strategy === "enhanced" ? 9 : 7;
  const selected = [...required, ...optional.slice(0, Math.max(0, cap - required.length))]
    .sort((left, right) => left.slideIndex - right.slideIndex);
  const slides = Array.isArray(deck.slides) ? deck.slides.map(record) : [];
  const items = selected.map((item) => {
    const slide = slides.find((candidate, index) => cleanText(candidate.slideId, `s${String(index + 1).padStart(2, "0")}`, 80) === item.slideId) ?? {};
    return { ...item, prompt: planPrompt(deck, slide, item.role, item.sourceDescription, overrides) };
  });
  const ready = items.filter((item) => {
    const slide = slides.find((candidate) => cleanText(candidate.slideId) === item.slideId);
    const image = slideImage(slide ?? {});
    return image.status === "ready" && Boolean(cleanText(image.url));
  }).length;
  return { items, total: items.length, ready, pending: items.length - ready };
}

export function readImageProviderConfig(getEnv: (name: string) => string | undefined = (name) => Deno.env.get(name)):
  ImageProviderConfig {
  const config = {
    provider: cleanText(getEnv("HAI_COURSEWARE_IMAGE_PROVIDER"), "", 40),
    apiKey: cleanText(getEnv("HAI_COURSEWARE_IMAGE_API_KEY"), "", 500),
    baseUrl: cleanText(getEnv("HAI_COURSEWARE_IMAGE_BASE_URL"), "", 500).replace(/\/$/, ""),
    model: cleanText(getEnv("HAI_COURSEWARE_IMAGE_MODEL"), "", 120),
  };
  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`生图服务缺少配置：${missing.join("、")}。`);
  if (config.provider.toLowerCase() !== "toapis") throw new Error(`暂不支持生图服务 ${config.provider}。`);
  return config;
}

function providerResultUrl(payload: unknown) {
  const raw = record(payload);
  const result = record(raw.result);
  const arrays = [result.data, raw.data].filter(Array.isArray) as unknown[][];
  for (const list of arrays) {
    const url = cleanText(record(list[0]).url, "", 2000);
    if (url) return url;
  }
  return cleanText(result.url || raw.url, "", 2000);
}

function providerTaskId(payload: unknown) {
  const raw = record(payload);
  return cleanText(raw.id || raw.task_id || raw.taskId, "", 200);
}

function providerStatus(payload: unknown) {
  const raw = record(payload);
  return cleanText(raw.status || record(raw.result).status, "", 40).toLowerCase();
}

async function responseJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const raw = record(payload);
    throw new Error(cleanText(raw.error || raw.message, `生图服务请求失败（${response.status}）。`, 300));
  }
  return payload;
}

export async function generateToApisImage(
  config: ImageProviderConfig,
  item: CoursewareImagePlanItem,
  options: {
    taskId?: string;
    fetcher?: typeof fetch;
    wait?: (milliseconds: number) => Promise<void>;
    pollIntervalMs?: number;
    maxWaitMs?: number;
  } = {},
): Promise<GeneratedProviderImage> {
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  let taskId = cleanText(options.taskId, "", 200);
  if (!taskId) {
    const createPayload: Raw = {
      model: config.model,
      prompt: item.prompt,
      n: 1,
      size: item.size,
      resolution: item.resolution,
      response_format: "url",
    };
    const created = await responseJson(await fetcher(config.baseUrl, {
      method: "POST",
      headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(createPayload),
      signal: AbortSignal.timeout(30_000),
    }));
    const immediateUrl = providerResultUrl(created);
    taskId = providerTaskId(created);
    if (immediateUrl) return { taskId: taskId || undefined, url: immediateUrl };
  }
  if (!taskId) throw new Error("生图服务没有返回任务标识。");
  const pollIntervalMs = options.pollIntervalMs ?? 3000;
  // A single image request has its own Edge Function invocation. Leave a
  // small margin below the roughly 150s platform wall clock for the provider
  // request, polling and R2 persistence performed by the caller.
  const deadline = Date.now() + (options.maxWaitMs ?? 140_000);
  while (Date.now() < deadline) {
    await wait(pollIntervalMs);
    const statusPayload = await responseJson(await fetcher(`${config.baseUrl}/${encodeURIComponent(taskId)}`, {
      headers: { authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(15_000),
    }));
    const url = providerResultUrl(statusPayload);
    if (url) return { taskId, url };
    const status = providerStatus(statusPayload);
    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      throw new CoursewareImageTaskError(
        cleanText(record(statusPayload).error || record(statusPayload).message, "生图任务失败。", 300),
        taskId,
      );
    }
  }
  throw new CoursewareImageTaskError("生图任务等待超时，可稍后继续同步本页。", taskId);
}

export function applyCoursewareImage(
  deckValue: unknown,
  item: CoursewareImagePlanItem,
  result: { status: "ready" | "failed"; url?: string; key?: string; error?: string; provider?: string; model?: string; taskId?: string },
) {
  const deck = record(deckValue);
  const slides = Array.isArray(deck.slides) ? deck.slides : [];
  const slide = slides.map(record).find((candidate) => cleanText(candidate.slideId) === item.slideId);
  if (!slide) return deck;
  slide.image = {
    ...record(slide.image),
    type: item.imageType,
    status: result.status,
    url: result.url,
    alt: item.sourceDescription || item.slideTitle,
    fit: item.fit,
    safeZone: item.safeZone,
    error: result.error,
    provider: result.provider,
    model: result.model,
    assetKey: result.key,
    providerTaskId: result.taskId,
    generatedAt: new Date().toISOString(),
    request: {
      type: item.imageType,
      subject: item.sourceDescription,
      slideFunction: item.slideFunction,
      layout: cleanText(slide.layout, "K01_TITLE_BODY", 80),
      safeZone: item.safeZone,
      subjectPosition: item.subjectPosition,
      aspectRatio: "16:9",
      prompt: item.prompt,
    },
  };
  return deck;
}
