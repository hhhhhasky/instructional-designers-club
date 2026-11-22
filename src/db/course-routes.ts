import { supabase } from "./supabase";
import type { CourseRouteEntry } from "@/lib/course-paths";

const columns = "id, membership_type, access_product_code, route_slug";

export async function listCourseRoutes(): Promise<CourseRouteEntry[]> {
  const pageSize = 1000;
  const entries: CourseRouteEntry[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from("courses").select(columns)
      .order("id").range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as CourseRouteEntry[];
    entries.push(...page);
    if (page.length < pageSize) return entries;
  }
}

export async function findCourseRoute(key: "id" | "route_slug", value: string) {
  if (key === "id" && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) return null;
  const { data, error } = await supabase.from("courses").select(columns)
    .eq(key, value).maybeSingle();
  if (error) throw error;
  return data as unknown as CourseRouteEntry | null;
}
