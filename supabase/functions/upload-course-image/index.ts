import { PutObjectCommand, S3Client } from "npm:@aws-sdk/client-s3@3.1048.0";
import { createClient } from "npm:@supabase/supabase-js@2.103.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const maxImageSize = 10 * 1024 * 1024;

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ error: "请先登录管理员账号" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase environment is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
    if (adminError || !isAdmin) {
      return jsonResponse({ error: "仅管理员可以上传课程图片" }, 403);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonResponse({ error: "请选择图片文件" }, 400);
    }
    const extension = allowedTypes[file.type];
    if (!extension) {
      return jsonResponse({ error: "仅支持 JPG、PNG、WebP 或 GIF 图片" }, 415);
    }
    if (file.size > maxImageSize) {
      return jsonResponse({ error: "图片不能超过 10MB" }, 413);
    }

    const accountId = Deno.env.get("R2_ACCOUNT_ID");
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const bucket = Deno.env.get("R2_BUCKET_NAME") || "course-videos";
    const publicUrl = Deno.env.get("R2_PUBLIC_URL")?.replace(/\/$/, "");
    if (!accountId || !accessKeyId || !secretAccessKey || !publicUrl) {
      throw new Error("R2 environment is not configured");
    }

    const now = new Date();
    const key = [
      "course-images",
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, "0"),
      `${crypto.randomUUID()}.${extension}`,
    ].join("/");
    const r2 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    await r2.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: new Uint8Array(await file.arrayBuffer()),
      ContentType: file.type,
      CacheControl: "public, max-age=31536000, immutable",
    }));

    return jsonResponse({ url: `${publicUrl}/${key}` }, 200);
  } catch (error) {
    console.error("upload-course-image failed", error);
    return jsonResponse({ error: "图片上传失败，请稍后重试" }, 500);
  }
});
