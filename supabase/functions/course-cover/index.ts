import { GetObjectCommand, S3Client } from "npm:@aws-sdk/client-s3@3.1048.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.1048.0";
import { createClient } from "npm:@supabase/supabase-js@2.103.1";
import { getSupabaseSecretKey } from "../_shared/supabase-keys.ts";

const signedUrlTtlSeconds = 6 * 60 * 60;

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function r2KeyFromPublicUrl(value: string, publicUrl: string) {
  try {
    const target = new URL(value);
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

function errorResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      },
    });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const courseId = new URL(request.url).searchParams.get("courseId")?.trim();
    if (!courseId) return errorResponse("Course ID is required", 400);

    const supabase = createClient(
      getRequiredEnv("SUPABASE_URL"),
      getSupabaseSecretKey(),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: course, error } = await supabase
      .from("courses")
      .select("id,image_url")
      .eq("id", courseId)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw error;
    if (!course?.image_url) return errorResponse("Cover not found", 404);

    const accountId = getRequiredEnv("R2_ACCOUNT_ID");
    const publicUrl = getRequiredEnv("R2_PUBLIC_URL").replace(/\/$/, "");
    const key = r2KeyFromPublicUrl(course.image_url, publicUrl);
    if (!key) return errorResponse("Cover is not stored in the protected R2 bucket", 404);

    const r2 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: getRequiredEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: getRequiredEnv("R2_SECRET_ACCESS_KEY"),
      },
    });
    const signedUrl = await getSignedUrl(
      r2,
      new GetObjectCommand({ Bucket: getRequiredEnv("R2_BUCKET_NAME"), Key: key }),
      { expiresIn: signedUrlTtlSeconds },
    );

    return new Response(null, {
      status: 302,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300",
        "Location": signedUrl,
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    console.error("course-cover failed", error);
    return errorResponse("Cover unavailable", 500);
  }
});
