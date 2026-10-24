// HAI private image thumbnail service. Paste this entire file into the Worker editor.
// Authorization is a two-minute, single-object R2 signature issued by the HAI backend.
const SOURCE_HOST = "course-videos.5c8dbf559a0ee7691719bbdfae232038.r2.cloudflarestorage.com";
const MAX_BODY_BYTES = 2048;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const IMAGE_KEY = new RegExp("^hai-image-generation/(" + UUID + ")/" + UUID + "/" + UUID + "\\.(png|jpg|webp)$", "i");

/** @param {number} status @param {string} message */
function failure(status, message) {
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

/** @param {Request} request */
async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty body");
  let size = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("body too large");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export default {
  /** @param {Request} request @param {{ IMAGE_BUCKET: R2Bucket, IMAGES: ImagesBinding }} env */
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && path === "/") {
      return Response.json({ service: "hai-image-thumbnail", version: 3 }, { headers: { "cache-control": "no-store" } });
    }
    if (path !== "/thumbnail") return failure(404, "Not found");
    if (request.method !== "POST") return failure(405, "POST required");
    let key, accessUrl;
    try {
      const body = await readBody(request);
      key = typeof body?.key === "string" ? body.key : "";
      accessUrl = typeof body?.accessUrl === "string" ? body.accessUrl : "";
    } catch { return failure(400, "Invalid request"); }
    if (!accessUrl) return failure(401, "Image authorization required");
    if (!IMAGE_KEY.test(key)) return failure(404, "Image not found");
    let proof;
    try { proof = new URL(accessUrl); } catch { return failure(400, "Invalid authorization URL"); }
    const lifetime = Number(proof.searchParams.get("X-Amz-Expires"));
    if (proof.protocol !== "https:" || proof.hostname !== SOURCE_HOST || proof.port ||
      proof.username || proof.password || proof.hash || proof.pathname !== "/" + key ||
      proof.searchParams.get("X-Amz-Algorithm") !== "AWS4-HMAC-SHA256" ||
      !proof.searchParams.get("X-Amz-Signature") || !Number.isInteger(lifetime) || lifetime <= 0 || lifetime > 120) {
      return failure(403, "Invalid image authorization");
    }
    // R2 verifies the signature, expiry and exact object scope. Do this before
    // checking cached thumbnails; an unsigned request must never reach storage.
    try {
      const verified = await fetch(proof.toString(), {
        method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(10000),
      });
      if (!verified.ok) return failure(verified.status === 404 ? 404 : 401, "Image authorization rejected");
    } catch { return failure(503, "Image authorization unavailable"); }
    const previewKey = key + ".preview-640.webp";
    try {
      if (await env.IMAGE_BUCKET.head(previewKey)) return new Response(null, { status: 204 });
      const original = await env.IMAGE_BUCKET.get(key);
      if (!original) return failure(404, "Image not found");
      if (original.size <= 0 || original.size > MAX_IMAGE_BYTES) {
        await original.body.cancel();
        return failure(413, "Image exceeds processing limit");
      }
      const image = await env.IMAGES.input(original.body)
        .transform({ width: 640, height: 640, fit: "scale-down" })
        .output({ format: "image/webp", quality: 75, anim: false });
      const response = image.response();
      if (!response.ok || !response.body) return failure(502, "Thumbnail conversion failed");
      // R2 requires a known body length. Only buffer the small, bounded
      // thumbnail; the original image remains streamed into Images.
      const thumbnail = await response.arrayBuffer();
      if (!thumbnail.byteLength || thumbnail.byteLength > 2 * 1024 * 1024) return failure(502, "Thumbnail conversion failed");
      await env.IMAGE_BUCKET.put(previewKey, thumbnail, {
        httpMetadata: { contentType: "image/webp", cacheControl: "private, max-age=600" },
      });
      return new Response(null, { status: 204 });
    } catch {
      // Do not log session tokens, object keys or private image bytes.
      console.warn("hai_thumbnail_conversion_failed");
      return failure(502, "Thumbnail conversion failed");
    }
  },
};
