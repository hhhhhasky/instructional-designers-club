import { GetObjectCommand, S3Client } from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";
import { createClient } from "npm:@supabase/supabase-js@2.103.1";
import { getSupabasePublishableKey, getSupabaseSecretKey } from "../_shared/supabase-keys.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const signedUrlTtlSeconds = 2 * 60 * 60;

type CourseRow = {
  id: string;
  status: string;
  membership_type: "free" | "plus" | "pro";
  is_trial: boolean;
  password_access_enabled?: boolean;
  image_url?: string | null;
  video_url?: string | null;
  audio_url?: string | null;
  body?: string | null;
  essence?: string | null;
  images?: string[] | null;
  [key: string]: unknown;
};

type AttachmentRow = {
  storage_key: string;
  file_url: string;
  [key: string]: unknown;
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function getR2Config() {
  const accountId = getRequiredEnv("R2_ACCOUNT_ID");
  const accessKeyId = getRequiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = getRequiredEnv("R2_SECRET_ACCESS_KEY");
  const bucket = Deno.env.get("R2_BUCKET_NAME") || "course-videos";
  const publicUrl = getRequiredEnv("R2_PUBLIC_URL").replace(/\/$/, "");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return { client, bucket, publicUrl };
}

function getClientIdentifier(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("cf-connecting-ip") || forwarded || "unknown";
}

function extractBearerToken(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim() || null;
}

function r2KeyFromPublicUrl(url: string, publicUrl: string) {
  try {
    const target = new URL(url);
    const base = new URL(`${publicUrl}/`);
    if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname)) return null;
    const encodedKey = target.pathname.slice(base.pathname.length);
    try {
      return decodeURIComponent(encodedKey);
    } catch {
      return encodedKey;
    }
  } catch {
    return null;
  }
}

async function signR2Key(client: S3Client, bucket: string, key: string) {
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: signedUrlTtlSeconds,
  });
}

async function secureUrl(
  value: string | null | undefined,
  r2: ReturnType<typeof getR2Config>,
) {
  if (!value) return value ?? null;
  const key = r2KeyFromPublicUrl(value, r2.publicUrl);
  if (!key) return value;
  return signR2Key(r2.client, r2.bucket, key);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function secureMarkdown(
  value: string | null | undefined,
  r2: ReturnType<typeof getR2Config>,
) {
  if (!value) return value ?? null;
  const matches = Array.from(new Set(
    value.match(new RegExp(`${escapeRegExp(r2.publicUrl)}/[^\\s)>'\"]+`, "g")) || [],
  ));
  let secured = value;
  for (const url of matches) {
    const signed = await secureUrl(url, r2);
    if (signed && signed !== url) secured = secured.replaceAll(url, signed);
  }
  return secured;
}

async function secureCourseMedia(course: CourseRow, r2: ReturnType<typeof getR2Config>) {
  const images = Array.isArray(course.images)
    ? await Promise.all(course.images.map((url) => secureUrl(url, r2)))
    : [];
  return {
    ...course,
    image_url: await secureUrl(course.image_url, r2),
    video_url: await secureUrl(course.video_url, r2),
    audio_url: await secureUrl(course.audio_url, r2),
    body: await secureMarkdown(course.body, r2),
    essence: await secureMarkdown(course.essence, r2),
    images,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
    const courseId = String(payload.courseId || "").trim();
    const password = typeof payload.password === "string" ? payload.password.trim() : "";
    if (!courseId) return jsonResponse({ error: "缺少课程 ID", code: "COURSE_ID_REQUIRED" }, 400);
    if (new TextEncoder().encode(password).byteLength > 72) {
      return jsonResponse({ error: "密码不正确", code: "INVALID_PASSWORD" }, 403);
    }

    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const secretKey = getSupabaseSecretKey();
    const publishableKey = getSupabasePublishableKey();
    const service = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: courseData, error: courseError } = await service
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .maybeSingle();
    if (courseError) throw courseError;
    if (!courseData) return jsonResponse({ error: "课程不存在", code: "COURSE_NOT_FOUND" }, 404);
    const course = courseData as CourseRow;

    let userId: string | null = null;
    let isAdmin = false;
    let hasMemberAccess = false;
    const token = extractBearerToken(request);
    if (token) {
      const { data: userData } = await service.auth.getUser(token);
      userId = userData.user?.id ?? null;
    }
    if (userId && token) {
      const viewer = createClient(supabaseUrl, publishableKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const [{ data: adminData }, { data: accessData }] = await Promise.all([
        viewer.rpc("is_admin"),
        viewer.rpc("can_access_course", { p_course_id: courseId }),
      ]);
      isAdmin = adminData === true;
      hasMemberAccess = accessData === true;
    }

    if (course.status !== "published" && !isAdmin) {
      return jsonResponse({ error: "课程不存在", code: "COURSE_NOT_FOUND" }, 404);
    }

    const isPublicCourse = course.status === "published" &&
      (course.membership_type === "free" || course.is_trial === true);
    let accessSource = isAdmin ? "admin" : hasMemberAccess ? "membership" : isPublicCourse ? "public" : null;

    if (!accessSource && password && course.password_access_enabled) {
      const identifier = getClientIdentifier(request);
      const { data: attemptStatus, error: attemptStatusError } = await service.rpc(
        "course_password_attempt_status",
        { p_course_id: courseId, p_identifier: identifier },
      );
      if (attemptStatusError) throw attemptStatusError;
      if (attemptStatus?.allowed !== true) {
        return jsonResponse({
          error: "密码尝试次数过多，请稍后再试",
          code: "PASSWORD_RATE_LIMITED",
          retry_after_seconds: Number(attemptStatus?.retry_after_seconds || 60),
        }, 429);
      }

      const { data: verified, error: verifyError } = await service.rpc(
        "verify_course_access_password",
        { p_course_id: courseId, p_password: password },
      );
      if (verifyError) throw verifyError;
      await service.rpc("record_course_password_attempt", {
        p_course_id: courseId,
        p_identifier: identifier,
        p_success: verified === true,
      });
      if (verified === true) accessSource = "password";
    }

    if (!accessSource) {
      return jsonResponse({
        error: password ? "密码不正确" : "需要相应会员权限或单课试看密码",
        code: password ? "INVALID_PASSWORD" : "COURSE_ACCESS_REQUIRED",
      }, 403);
    }

    const { data: attachmentData, error: attachmentError } = await service
      .from("course_attachments")
      .select("*")
      .eq("course_id", courseId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (attachmentError) throw attachmentError;

    const r2 = getR2Config();
    const securedCourse = await secureCourseMedia(course, r2);
    const securedAttachments = await Promise.all(
      ((attachmentData || []) as AttachmentRow[]).map(async (attachment) => ({
        ...attachment,
        file_url: await signR2Key(r2.client, r2.bucket, attachment.storage_key),
      })),
    );

    return jsonResponse({
      course: securedCourse,
      attachments: securedAttachments,
      access_source: accessSource,
      media_expires_at: new Date(Date.now() + signedUrlTtlSeconds * 1000).toISOString(),
    }, 200);
  } catch (error) {
    console.error("course-content failed", error);
    return jsonResponse({ error: "课程内容加载失败，请稍后重试", code: "COURSE_CONTENT_FAILED" }, 500);
  }
});
