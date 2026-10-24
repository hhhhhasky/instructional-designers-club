import {
  applyCoursewareImage,
  buildCoursewareImagePlan,
  generateToApisImage,
  type CoursewareImagePlanItem,
} from "./hai_courseware_images.ts";

function sampleDeck() {
  return {
    schemaVersion: "hai_courseware_deck_v4",
    visualMode: "V2",
    imageStrategy: "smart",
    title: "春",
    visualProfile: {
      illustrationStyle: "柔和的中国风纸艺插画",
      palette: ["嫩绿", "米白", "浅黄"],
      lighting: "春日柔光",
      texture: "纸张肌理",
      realismLevel: "半写实",
      visualKeywords: ["春天", "花草", "树木", "微风"],
    },
    slides: [
      { slideId: "s01", index: 0, function: "F01_COVER", title: "春", components: [{ type: "title", text: "春" }] },
      { slideId: "s02", index: 1, function: "F03_CONTEXT", title: "走进春天", question: "你发现了哪些春天的变化？", components: [{ type: "title", text: "走进春天" }, { type: "image", text: "嫩芽、春花和舒展的树枝" }] },
      { slideId: "s03", index: 2, function: "F10_ACTIVITY", pageFunction: "U09_STUDENT_TASK", title: "任务一", task: "寻找春天的词语", components: [{ type: "title", text: "任务一" }, { type: "task", text: "寻找春天的词语" }] },
      { slideId: "s04", index: 3, function: "F05_CONTENT", title: "品味春风", components: [{ type: "title", text: "品味春风" }] },
      { slideId: "s05", index: 4, function: "F10_ACTIVITY", pageFunction: "U09_STUDENT_TASK", title: "任务二", task: "朗读春景", components: [{ type: "title", text: "任务二" }] },
      { slideId: "s06", index: 5, function: "F12_SUMMARY", title: "总结", components: [{ type: "title", text: "总结" }] },
    ],
  };
}

Deno.test("V2 image plan gives every slide its own full-slide background", () => {
  const plan = buildCoursewareImagePlan(sampleDeck());
  if (plan.total !== 6) throw new Error(`expected 6 planned images, got ${plan.total}`);
  if (plan.items.map((item) => item.role).join(",") !== "cover,content,task,content,task,content") throw new Error("image roles were not planned in slide order");
  if (plan.items.some((item) => `${item.imageType}/${item.fit}` !== "background/cover")) throw new Error("all generated images were not planned as full-slide backgrounds");
  if (plan.items.some((item) => !item.prompt.includes("整页 background") || !item.prompt.includes("16:9 全景背景图"))) throw new Error("background-only image prompt contract is missing");
  if (!plan.items.every((item) => item.prompt.includes("统一画风") && item.prompt.includes("严禁出现文字"))) throw new Error("unified style constraints are missing");
  if (plan.items.some((item) => item.prompt.includes("核心意象") || item.prompt.includes("春天、花草、树木"))) throw new Error("page prompts still force concrete course imagery");
  if (!plan.items[1].prompt.includes("文字安全区")) throw new Error("background text safe zone is missing");
});

Deno.test("minimal V2 image plan still keeps every slide background", () => {
  const deck = { ...sampleDeck(), imageStrategy: "minimal" };
  const plan = buildCoursewareImagePlan(deck);
  if (plan.items.map((item) => item.slideId).join(",") !== "s01,s02,s03,s04,s05,s06") throw new Error("minimal plan removed a required image");
});

Deno.test("ToApis adapter creates an async task and polls it without a cover reference", async () => {
  const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = (init as { body?: unknown } | undefined)?.body;
    calls.push({ url, body: body ? JSON.parse(String(body)) : undefined });
    return url.endsWith("/task-1")
      ? Response.json({ id: "task-1", status: "completed", result: { data: [{ url: "https://images.example/final.png" }] } })
      : Response.json({ id: "task-1", status: "pending" });
  };
  const item = buildCoursewareImagePlan(sampleDeck()).items[1] as CoursewareImagePlanItem;
  const result = await generateToApisImage({ provider: "ToApis", apiKey: "secret", baseUrl: "https://toapis.example/v1/images/generations", model: "gpt-image-2" }, item, {
    fetcher,
    wait: async () => {},
    pollIntervalMs: 1,
    maxWaitMs: 100,
  });
  if (result.url !== "https://images.example/final.png" || calls.length !== 2) throw new Error("async image task did not complete");
  if (calls[0].body?.reference_images) throw new Error("cover reference was forwarded unexpectedly");
  if (calls[0].body?.size !== "16:9" || calls[0].body?.resolution !== "1K") throw new Error("V2 output geometry is incorrect");
});

Deno.test("ToApis adapter can resume an existing provider task without creating a duplicate", async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, method: String((init as { method?: string } | undefined)?.method || "GET") });
    return Response.json({ id: "task-existing", status: "completed", result: { data: [{ url: "https://images.example/resumed.png" }] } });
  };
  const item = buildCoursewareImagePlan(sampleDeck()).items[1] as CoursewareImagePlanItem;
  const result = await generateToApisImage({ provider: "ToApis", apiKey: "secret", baseUrl: "https://toapis.example/v1/images/generations", model: "gpt-image-2" }, item, {
    taskId: "task-existing",
    fetcher,
    wait: async () => {},
    pollIntervalMs: 1,
    maxWaitMs: 100,
  });
  if (result.url !== "https://images.example/resumed.png" || calls.length !== 1 || calls[0].method !== "GET") throw new Error("existing provider task was not resumed");
});

Deno.test("ToApis timeout retains the provider task id for later reconciliation", async () => {
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    return url.endsWith("/task-timeout")
      ? Response.json({ id: "task-timeout", status: "pending" })
      : Response.json({ id: "task-timeout", status: "queued" });
  };
  const item = buildCoursewareImagePlan(sampleDeck()).items[1] as CoursewareImagePlanItem;
  try {
    await generateToApisImage({ provider: "ToApis", apiKey: "secret", baseUrl: "https://toapis.example/v1/images/generations", model: "gpt-image-2" }, item, {
      fetcher,
      wait: async () => {},
      pollIntervalMs: 1,
      maxWaitMs: 2,
    });
    throw new Error("expected timeout");
  } catch (error) {
    if (!(error instanceof Error) || !("taskId" in error) || (error as { taskId?: string }).taskId !== "task-timeout") throw new Error("timeout did not retain provider task id");
  }
});

Deno.test("generated image metadata is kept separate from slide text", () => {
  const deck = sampleDeck();
  const item = buildCoursewareImagePlan(deck).items[0];
  const updated = applyCoursewareImage(deck, item, { status: "ready", url: "https://assets.example/cover.png", provider: "ToApis", model: "gpt-image-2" });
  const slide = (updated.slides as Array<Record<string, unknown>>)[0];
  const image = slide.image as Record<string, unknown>;
  if (image.url !== "https://assets.example/cover.png" || image.type !== "background" || image.fit !== "cover" || slide.title !== "春") throw new Error("image and native text layers were not preserved independently");
});

Deno.test("every planned image is full-bleed regardless of component role", () => {
  const deck = sampleDeck();
  (deck.slides as unknown as Array<Record<string, unknown>>).push({ slideId: "s07", index: 6, function: "F05_CONTENT", layout: "K01_TITLE_BODY", title: "满版", components: [{ type: "title", text: "满版" }, { type: "image", role: "material", variant: "contain", text: "抽象光影" }] });
  const plan = buildCoursewareImagePlan(deck);
  const item = plan.items.find((candidate) => candidate.slideId === "s07");
  if (!item || item.imageType !== "background" || item.fit !== "cover") throw new Error("component image was not simplified to a full-slide background");
});
