import { readStoredImage, verifyStoredImageAccessSignature } from "../_shared/hai_image_generation.ts";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "access-control-allow-headers": "content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";
  const expiresAt = Number(url.searchParams.get("expires") || "0");
  const signature = url.searchParams.get("signature") || "";
  if (!(await verifyStoredImageAccessSignature(key, expiresAt, signature))) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    const file = await readStoredImage(key);
    return new Response(request.method === "HEAD" ? null : file.bytes.buffer, {
      headers: {
        ...corsHeaders,
        "content-type": file.contentType,
        "content-length": String(file.bytes.byteLength),
        "cache-control": "private, max-age=300",
        "content-disposition": "inline",
      },
    });
  } catch (error) {
    console.error("hai-image-reference failed", error instanceof Error ? error.message : "unknown error");
    return new Response("Reference image unavailable", { status: 404, headers: corsHeaders });
  }
});
