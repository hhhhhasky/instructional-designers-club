import type { Course } from "@/types/types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

function isR2PublicUrl(value: string) {
  try {
    return new URL(value).hostname.endsWith(".r2.dev");
  } catch {
    return false;
  }
}

export function getCourseCoverUrl(courseId: string, imageUrl: string | null | undefined) {
  if (!imageUrl || !isR2PublicUrl(imageUrl)) return imageUrl ?? null;
  const endpoint = new URL("/functions/v1/course-cover", supabaseUrl);
  endpoint.searchParams.set("courseId", courseId);
  return endpoint.toString();
}

export function withProtectedCourseCover<T extends Pick<Course, "id" | "image_url">>(course: T): T {
  const imageUrl = getCourseCoverUrl(course.id, course.image_url);
  return imageUrl === course.image_url ? course : { ...course, image_url: imageUrl };
}
