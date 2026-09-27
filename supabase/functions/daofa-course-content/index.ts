import { GetObjectCommand, S3Client } from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";
import { createClient } from "npm:@supabase/supabase-js@2.103.1";
import { getSupabasePublishableKey } from "../_shared/supabase-keys.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const signedUrlTtlSeconds = 2 * 60 * 60;

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const token = request.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return jsonResponse({ error: "请先登录" }, 401);

  let lessonId: string;
  try {
    const body = await request.json();
    lessonId = typeof body?.lessonId === "string" ? body.lessonId.trim() : "";
  } catch {
    return jsonResponse({ error: "请求格式不正确" }, 400);
  }
  if (!/^[a-z0-9-]{1,80}$/.test(lessonId)) return jsonResponse({ error: "课程编号不正确" }, 400);

  try {
    const viewer = createClient(requiredEnv("SUPABASE_URL"), getSupabasePublishableKey(), {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await viewer.auth.getUser(token);
    if (authError || !authData.user) return jsonResponse({ error: "请重新登录" }, 401);

    // The table's RLS policy enforces active profile and daofa-textbook access.
    const { data: media, error: mediaError } = await viewer
      .from("daofa_lesson_media")
      .select("storage_key,media_type")
      .eq("lesson_id", lessonId)
      .maybeSingle();
    if (mediaError) throw mediaError;
    if (!media) return jsonResponse({ error: "没有此课程的访问权限或媒体尚未发布" }, 403);

    const r2 = new S3Client({
      region: "auto",
      endpoint: `https://${requiredEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
      },
    });
    const url = await getSignedUrl(r2, new GetObjectCommand({
      Bucket: Deno.env.get("R2_BUCKET_NAME") || "course-videos",
      Key: media.storage_key,
    }), { expiresIn: signedUrlTtlSeconds });
    return jsonResponse({ url, mediaType: media.media_type, expiresIn: signedUrlTtlSeconds }, 200);
  } catch (error) {
    console.error("daofa-course-content failed:", error);
    return jsonResponse({ error: "课程媒体暂时无法加载，请稍后重试" }, 500);
  }
});
