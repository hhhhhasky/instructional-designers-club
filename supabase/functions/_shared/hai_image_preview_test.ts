import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { stub } from "https://deno.land/std@0.224.0/testing/mock.ts";
import { getStoredImagePreviewUrl, imagePreviewKey, imageThumbnailServiceUrl } from "./hai_image_generation.ts";

const key = "hai-image-generation/user/task/run.png";
Deno.test("thumbnail service uses the independent Worker without changing website DNS", () => {
  const previous = Deno.env.get("HAI_IMAGE_THUMBNAIL_URL");
  Deno.env.delete("HAI_IMAGE_THUMBNAIL_URL");
  try {
    assertEquals(imageThumbnailServiceUrl(), "https://hai-image-thumbnail.haskychuangke01.workers.dev/thumbnail");
    assertEquals(imagePreviewKey(key), `${key}.preview-640.webp`);
  } finally { if (previous !== undefined) Deno.env.set("HAI_IMAGE_THUMBNAIL_URL", previous); }
});

Deno.test("presigned HEAD uses fetch; Worker generates once, and only private thumbnail URLs are returned", async () => {
  const env = { R2_ACCOUNT_ID: "test-account", R2_ACCESS_KEY_ID: "test-key", R2_SECRET_ACCESS_KEY: "test-secret", R2_BUCKET_NAME: "test-bucket", R2_PUBLIC_URL: "https://media.example.test", HAI_IMAGE_THUMBNAIL_URL: "https://images.example.test" };
  const previous = Object.fromEntries(Object.keys(env).map((name) => [name, Deno.env.get(name)]));
  for (const [name, value] of Object.entries(env)) Deno.env.set(name, value);
  let exists = false, conversions = 0, invalid = false, headStatus = 0;
  const fetchStub = stub(globalThis, "fetch", ((url, init) => {
    const options = init as { method?: string; headers?: Record<string, string>; body?: string; redirect?: string } | undefined;
    if (options?.method === "HEAD") {
      const signed = new URL(String(url));
      assertEquals(signed.pathname, `/${key}.preview-640.webp`);
      assertEquals(signed.searchParams.has("X-Amz-Signature"), true);
      return Promise.resolve(new Response(null, { status: headStatus || (exists ? 200 : 404) }));
    }
    conversions++;
    assertEquals(url, "https://images.example.test/thumbnail");
    assertEquals(options?.method, "POST");
    assertEquals(new Headers(options?.headers).get("authorization"), null);
    const body = JSON.parse(String(options?.body));
    assertEquals(body.key, key);
    const proof = new URL(body.accessUrl);
    assertEquals(proof.pathname, `/${key}`);
    assertEquals(proof.searchParams.get("X-Amz-Expires"), "120");
    assertEquals(proof.searchParams.has("X-Amz-Signature"), true);
    assertEquals(options?.redirect, "error");
    if (invalid) return Promise.resolve(new Response("Hello World", { status: 200 }));
    exists = true;
    return Promise.resolve(new Response(null, { status: 204 }));
  }) as typeof fetch);
  try {
    for (let index = 0; index < 2; index++) {
      const url = new URL(await getStoredImagePreviewUrl(key, 600));
      assertEquals(url.pathname, `/${key}.preview-640.webp`);
      assertEquals(url.searchParams.get("X-Amz-Expires"), "600");
    }
    assertEquals(conversions, 1);
    exists = false; invalid = true;
    await assertRejects(() => getStoredImagePreviewUrl(key, 600), Error, "缩略图暂时不可用");
    headStatus = 403;
    await assertRejects(() => getStoredImagePreviewUrl(key, 600), Error, "缩略图存储暂时不可用");
    assertEquals(conversions, 2);
  } finally {
    fetchStub.restore();
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) Deno.env.delete(name); else Deno.env.set(name, value);
    }
  }
});
