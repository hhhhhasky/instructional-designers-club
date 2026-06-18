import { supabase } from "@/db/supabase";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function uploadCourseImage(file: File): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("仅支持 JPG、PNG、WebP 或 GIF 图片");
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("图片不能超过 10MB");
  }

  const body = new FormData();
  body.append("file", file);

  const { data, error } = await supabase.functions.invoke("upload-course-image", { body });
  if (error) {
    let message = error.message || "图片上传失败";
    const context = "context" in error ? error.context : undefined;
    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => null) as { error?: string } | null;
      if (payload?.error) message = payload.error;
    }
    throw new Error(message);
  }

  if (!data || typeof data.url !== "string" || !data.url.startsWith("http")) {
    throw new Error("上传成功，但服务端没有返回有效的图片 URL");
  }

  return data.url;
}
