import { PutObjectCommand, S3Client } from "npm:@aws-sdk/client-s3";
import { createClient } from "npm:@supabase/supabase-js@2.103.1";
import { getSupabasePublishableKey, getSupabaseSecretKey } from "../_shared/supabase-keys.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const maxFileSize = 2 * 1024 * 1024 * 1024;
const supportedExtensions = new Set(["mp4", "mov", "mp3", "m4a", "wav", "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "jpg", "jpeg", "png", "webp", "gif"]);

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function r2() {
  const accountId = Deno.env.get("R2_ACCOUNT_ID");
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const bucket = Deno.env.get("R2_BUCKET_NAME") || "course-videos";
  const publicUrl = Deno.env.get("R2_PUBLIC_URL")?.replace(/\/$/, "");
  if (!accountId || !accessKeyId || !secretAccessKey || !publicUrl) throw new Error("R2 environment is not configured");
  return { client: new S3Client({ region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } }), bucket, publicUrl };
}

function safeName(name: string) {
  return name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").slice(0, 180) || "resource";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return response({ error: "请先登录管理员账号" }, 401);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("Supabase environment is not configured");
    const viewer = createClient(supabaseUrl, getSupabasePublishableKey(), { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await viewer.auth.getUser();
    if (authError || !user) return response({ error: "无效的身份验证令牌" }, 401);
    const { data: profile } = await viewer.from("profiles").select("role, status").eq("id", user.id).single();
    if (!profile || profile.status !== "active" || !["admin", "editor"].includes(profile.role)) return response({ error: "需要管理员或编辑权限" }, 403);
    const formData = await request.formData();
    const lessonId = String(formData.get("lessonId") || "").trim();
    const file = formData.get("file");
    if (!lessonId || !(file instanceof File)) return response({ error: "缺少 lessonId 或 file 参数" }, 400);
    if (file.size === 0 || file.size > maxFileSize) return response({ error: "文件为空或超过 2GB 限制" }, 413);
    const name = safeName(file.name);
    const extension = name.split(".").pop()?.toLowerCase() || "";
    if (!supportedExtensions.has(extension)) return response({ error: "不支持的 V2 资源格式" }, 415);
    const service = createClient(supabaseUrl, getSupabaseSecretKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: lesson } = await service.from("v2_course_lessons").select("id").eq("id", lessonId).single();
    if (!lesson) return response({ error: "V2 Lesson 不存在" }, 404);
    const { client, bucket, publicUrl } = r2();
    const resourceType = file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : file.type.startsWith("image/") ? "image" : "attachment";
    const key = `course-v2/${lessonId}/${resourceType}/${new Date().getUTCFullYear()}/${crypto.randomUUID()}-${name}`;
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: new Uint8Array(await file.arrayBuffer()), ContentType: file.type || "application/octet-stream", ContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(name)}`, CacheControl: "public, max-age=31536000, immutable" }));
    const { data: resource, error: insertError } = await service.from("v2_lesson_resources").insert({ lesson_id: lessonId, storage_provider: "r2", storage_key: key, external_url: `${publicUrl}/${key}`, title: name, file_name: name, mime_type: file.type || null, file_size: file.size, is_downloadable: resourceType === "attachment", is_active: true }).select("*").single();
    if (insertError) throw insertError;
    return response({ resource }, 200);
  } catch (error) {
    console.error("upload-v2-resource failed", error);
    return response({ error: error instanceof Error ? error.message : "V2 资源上传失败" }, 500);
  }
});
