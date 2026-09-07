import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { generateImage, readImageProviderConfig } from "./hai_image_generation.ts";

Deno.test("image provider config reads the server-side ToAPIs settings", () => {
  const config = readImageProviderConfig((name) => ({
    HAI_COURSEWARE_IMAGE_PROVIDER: "toapis",
    HAI_COURSEWARE_IMAGE_API_KEY: "secret",
    HAI_COURSEWARE_IMAGE_BASE_URL: "https://example.test/images/",
    HAI_COURSEWARE_IMAGE_MODEL: "image-model",
  }[name]));
  assertEquals(config.baseUrl, "https://example.test/images");
  assertEquals(config.model, "image-model");
});

Deno.test("image generation sends the selected size and accepts an immediate provider URL", async () => {
  let request: Record<string, unknown> = {};
  const result = await generateImage(
    { provider: "toapis", apiKey: "secret", baseUrl: "https://example.test/images", model: "image-model" },
    { prompt: "课堂概念图", size: "3:4" },
    {
      fetcher: async (_input, init) => {
        request = JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}"));
        return new Response(JSON.stringify({ data: [{ url: "https://example.test/generated.png" }] }), { status: 200 });
      },
    },
  );
  assertEquals(request.size, "3:4");
  assertEquals(result.url, "https://example.test/generated.png");
  assertStringIncludes(String(request.prompt), "课堂概念图");
});

Deno.test("image generation sends up to six R2 reference URLs to ToAPIs", async () => {
  let request: Record<string, unknown> = {};
  await generateImage(
    { provider: "toapis", apiKey: "secret", baseUrl: "https://example.test/images", model: "image-model" },
    { prompt: "调整配色", size: "1:1", referenceImageUrls: ["https://r2.example/one.png", "https://r2.example/two.png"] },
    {
      fetcher: async (_input, init) => {
        request = JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}"));
        return new Response(JSON.stringify({ data: [{ url: "https://example.test/generated.png" }] }), { status: 200 });
      },
    },
  );
  assertEquals(request.image_urls, ["https://r2.example/one.png", "https://r2.example/two.png"]);
});
