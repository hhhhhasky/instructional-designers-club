import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { stub } from "https://deno.land/std@0.224.0/testing/mock.ts";
import { PutObjectCommand, S3Client } from "npm:@aws-sdk/client-s3@3.1048.0";
import { validateHeaderValue } from "node:http";
import { generateImage, persistReferenceImages, readImageProviderConfig } from "./hai_image_generation.ts";

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

Deno.test("reference uploads serialize Chinese and emoji filenames into valid R2 HTTP headers", async () => {
  const env = {
    R2_ACCOUNT_ID: "test-account",
    R2_ACCESS_KEY_ID: "test-key",
    R2_SECRET_ACCESS_KEY: "test-secret",
    R2_BUCKET_NAME: "test-bucket",
    R2_PUBLIC_URL: "https://r2.example.test",
  };
  const previousEnv = Object.fromEntries(Object.keys(env).map((name) => [name, Deno.env.get(name)]));
  const requests: { headers: Record<string, string>; path: string }[] = [];
  const client = new S3Client({
    region: "auto",
    endpoint: "https://r2.example.test",
    forcePathStyle: true,
    credentials: { accessKeyId: "test-key", secretAccessKey: "test-secret" },
    maxAttempts: 1,
    requestHandler: {
      handle: (request: { headers: Record<string, string>; path: string }) => {
        // Exercise the SDK's actual serialization and the same header
        // validation used by its Node HTTP transport, without contacting R2.
        for (const [name, value] of Object.entries(request.headers)) validateHeaderValue(name, value);
        requests.push({ headers: request.headers, path: request.path });
        return Promise.resolve({ response: { statusCode: 200, headers: {}, body: new Uint8Array() } });
      },
    },
  });
  const originalSend = client.send.bind(client);
  const sendStub = stub(S3Client.prototype, "send", ((command: PutObjectCommand) => originalSend(command)) as S3Client["send"]);
  try {
    for (const [name, value] of Object.entries(env)) Deno.env.set(name, value);
    const names = ["照片 1.jpg", "课堂🌱素材.png", "reference 100%.png", "", `${"a".repeat(159)}🌱.png`, "line\r\nbreak.png"];
    const stored = await persistReferenceImages({
      files: names.map((name) => new File([new Uint8Array([1, 2, 3])], name, { type: "image/png" })),
      userId: "user-id", taskId: "task-id", runId: "run-id",
    });
    assertEquals(stored.length, names.length);
    assertEquals(requests.length, names.length);
    assertEquals(stored[0].name, "照片 1.jpg");
    assertEquals(stored[1].name, "课堂🌱素材.png");
    assertEquals(stored[3].name, "参考图片");
    for (const [index, request] of requests.entries()) {
      assertEquals(decodeURIComponent(request.headers["x-amz-meta-originalname"]), stored[index].name.toWellFormed());
      assertEquals(request.headers["x-amz-meta-originalnameencoding"], "percent-encoding");
      assertEquals(request.path, `/test-bucket/hai-image-generation/user-id/task-id/references/run-id-${index + 1}.png`);
    }
  } finally {
    sendStub.restore();
    client.destroy();
    for (const [name, value] of Object.entries(previousEnv)) {
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
});
