import { PutObjectCommand, S3Client } from "npm:@aws-sdk/client-s3";
import { createClient } from "npm:@supabase/supabase-js@2.103.1";
import { getSupabasePublishableKey, getSupabaseSecretKey } from "../_shared/supabase-keys.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const maxFileSize = 2 * 1024 * 1024 * 1024; // 2GB

const mediaExtensions: Record<string, { mimeType: string; mediaType: string }> = {
  mp4: { mimeType: "video/mp4", mediaType: "video" },
  mov: { mimeType: "video/quicktime", mediaType: "video" },
  mp3: { mimeType: "audio/mpeg", mediaType: "audio" },
  m4a: { mimeType: "audio/mp4", mediaType: "audio" },
  wav: { mimeType: "audio/wav", mediaType: "audio" },
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getR2Client() {
  const accountId = Deno.env.get("R2_ACCOUNT_ID");
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const bucket = Deno.env.get("R2_BUCKET_NAME") || "course-videos";
  const publicUrl = Deno.env.get("R2_PUBLIC_URL")?.replace(/\/$/, "");
  if (!accountId || !accessKeyId || !secretAccessKey || !publicUrl) {
    throw new Error("R2 environment is not configured");
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return { client, bucket, publicUrl };
}

async function requireAdmin(request: Request): Promise<{ error?: Response; user?: any; profile?: any }> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { error: jsonResponse({ error: "请先登录管理员账号" }, 401) };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    throw new Error("Supabase environment is not configured");
  }
  const supabasePublishableKey = getSupabasePublishableKey();
  const supabaseSecretKey = getSupabaseSecretKey();

  const viewer = createClient(supabaseUrl, supabasePublishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: authError } = await viewer.auth.getUser();
  if (authError || !user) {
    return { error: jsonResponse({ error: "无效的身份验证令牌" }, 401) };
  }

  const { data: profile, error: profileError } = await viewer
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    return { error: jsonResponse({ error: "需要管理员权限" }, 403) };
  }

  return { user, profile };
}

Deno.serve(async (request): Promise<Response> => {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Verify admin permission
  const authResult = await requireAdmin(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const formData = await request.formData();
    const courseId = formData.get("courseId") as string;
    const file = formData.get("file") as File | null;

    if (!courseId || !file) {
      return jsonResponse({ error: "缺少 courseId 或 file 参数" }, 400);
    }

    // Validate file extension
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const mediaInfo = mediaExtensions[extension];
    if (!mediaInfo) {
      return jsonResponse({
        error: `不支持的文件格式：${extension}。仅支持 MP4、MOV、MP3、M4A、WAV`
      }, 415);
    }

    // Validate file size
    if (file.size > maxFileSize) {
      return jsonResponse({ error: `文件过大，最大支持 ${Math.round(maxFileSize / 1024 / 1024 / 1024)}GB` }, 413);
    }

    if (file.size === 0) {
      return jsonResponse({ error: "文件为空" }, 400);
    }

    // Get R2 client
    const { client, bucket, publicUrl } = getR2Client();

    // Generate storage path
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const uuid = crypto.randomUUID();
    const fileName = `${uuid}.${extension}`;
    const storagePath = `course-media/${courseId}/${mediaInfo.mediaType}/${year}/${month}/${fileName}`;

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: storagePath,
      Body: new Uint8Array(await file.arrayBuffer()),
      ContentType: mediaInfo.mimeType,
      CacheControl: "public, max-age=31536000, immutable",
    });

    await client.send(command);

    // Return public URL
    const publicAccessUrl = `${publicUrl}/${storagePath}`;
    return jsonResponse({ url: publicAccessUrl }, 200);

  } catch (error) {
    console.error("Upload course media error:", error);
    return jsonResponse({
      error: error instanceof Error ? error.message : "音视频上传失败，请稍后重试"
    }, 500);
  }
});
