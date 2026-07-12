import { DeleteObjectCommand, PutObjectCommand, S3Client } from "npm:@aws-sdk/client-s3@3.1048.0";
import { createClient } from "npm:@supabase/supabase-js@2.103.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const maxFileSize = 1024 * 1024 * 1024;

const extensionTypes: Record<string, { mimeType: string; fileType: string }> = {
  mp4: { mimeType: "video/mp4", fileType: "video" },
  mov: { mimeType: "video/quicktime", fileType: "video" },
  mp3: { mimeType: "audio/mpeg", fileType: "audio" },
  m4a: { mimeType: "audio/mp4", fileType: "audio" },
  wav: { mimeType: "audio/wav", fileType: "audio" },
  doc: { mimeType: "application/msword", fileType: "document" },
  docx: {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileType: "document",
  },
  md: { mimeType: "text/markdown", fileType: "document" },
  markdown: { mimeType: "text/markdown", fileType: "document" },
  txt: { mimeType: "text/plain", fileType: "document" },
  pdf: { mimeType: "application/pdf", fileType: "document" },
  jpg: { mimeType: "image/jpeg", fileType: "image" },
  jpeg: { mimeType: "image/jpeg", fileType: "image" },
  png: { mimeType: "image/png", fileType: "image" },
  webp: { mimeType: "image/webp", fileType: "image" },
  gif: { mimeType: "image/gif", fileType: "image" },
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

function normalizeFileName(name: string) {
  return name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").slice(0, 180) || "course-file";
}

function getFileInfo(file: File) {
  const safeName = normalizeFileName(file.name);
  const extension = safeName.split(".").pop()?.toLowerCase() || "";
  const info = extensionTypes[extension];
  if (!info) {
    throw new Response("unsupported", { status: 415 });
  }
  return {
    safeName,
    extension,
    mimeType: file.type && file.type !== "application/octet-stream" ? file.type : info.mimeType,
    fileType: info.fileType,
  };
}

function encodeContentDisposition(fileName: string) {
  return `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

async function requireAdmin(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { error: jsonResponse({ error: "请先登录管理员账号" }, 401) };
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
    return { error: jsonResponse({ error: "仅管理员可以管理课程文件" }, 403) };
  }

  return { supabase };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const supabase = auth.supabase;

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      if (body.action !== "delete") {
        return jsonResponse({ error: "未知的文件操作" }, 400);
      }
      const attachmentId = String(body.attachmentId || "").trim();
      if (!attachmentId) return jsonResponse({ error: "缺少附件 ID" }, 400);

      const { data: attachment, error: attachmentError } = await supabase
        .from("course_attachments")
        .select("id, storage_key")
        .eq("id", attachmentId)
        .single();
      if (attachmentError || !attachment) {
        return jsonResponse({ error: "附件不存在" }, 404);
      }

      const { client, bucket } = getR2Client();
      await client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: attachment.storage_key,
      }));

      const { error: deleteError } = await supabase
        .from("course_attachments")
        .delete()
        .eq("id", attachmentId);
      if (deleteError) throw deleteError;

      return jsonResponse({ ok: true }, 200);
    }

    const formData = await request.formData();
    const courseId = String(formData.get("courseId") || "").trim();
    const file = formData.get("file");
    if (!courseId) return jsonResponse({ error: "缺少课程 ID" }, 400);
    if (!(file instanceof File)) return jsonResponse({ error: "请选择要上传的文件" }, 400);
    if (file.size > maxFileSize) return jsonResponse({ error: "单个课程文件不能超过 1GB" }, 413);

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .single();
    if (courseError || !course) return jsonResponse({ error: "课程不存在" }, 404);

    let fileInfo: ReturnType<typeof getFileInfo>;
    try {
      fileInfo = getFileInfo(file);
    } catch (error) {
      if (error instanceof Response && error.status === 415) {
        return jsonResponse({ error: "仅支持 MP4、音频、Word、Markdown、PDF 和常见图片文件" }, 415);
      }
      throw error;
    }

    const { client, bucket, publicUrl } = getR2Client();
    const now = new Date();
    const key = [
      "course-files",
      courseId,
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, "0"),
      `${crypto.randomUUID()}-${fileInfo.safeName}`,
    ].join("/");

    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: new Uint8Array(await file.arrayBuffer()),
      ContentType: fileInfo.mimeType,
      ContentDisposition: encodeContentDisposition(fileInfo.safeName),
      CacheControl: fileInfo.fileType === "image"
        ? "public, max-age=31536000, immutable"
        : "private, max-age=0, must-revalidate",
    }));

    const { data: latest, error: latestError } = await supabase
      .from("course_attachments")
      .select("sort_order")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: false })
      .limit(1);
    if (latestError) throw latestError;

    const nextSortOrder = ((latest?.[0]?.sort_order as number | null | undefined) ?? -1) + 1;
    const { data: attachment, error: insertError } = await supabase
      .from("course_attachments")
      .insert({
        course_id: courseId,
        file_name: fileInfo.safeName,
        file_url: `${publicUrl}/${key}`,
        storage_key: key,
        mime_type: fileInfo.mimeType,
        file_size: file.size,
        file_type: fileInfo.fileType,
        sort_order: nextSortOrder,
        is_active: true,
      })
      .select()
      .single();
    if (insertError) throw insertError;

    return jsonResponse({ attachment }, 200);
  } catch (error) {
    console.error("upload-course-file failed", error);
    return jsonResponse({ error: "课程文件操作失败，请稍后重试" }, 500);
  }
});
