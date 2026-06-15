import type {
  Course,
  MembershipType,
  MemberProfile,
  Faq,
  Testimonial,
  Announcement,
  Activity,
  Resource,
  SiteContent,
} from "@/types/types";
import { supabase } from "./supabase";

// ==================== 响应类型 ====================

export interface MemberDistribution {
  access_level: MembershipType;
  count: number;
}

export interface MonthlyGrowth {
  month: string; // "2025-01"
  new_members: number;
}

export interface MemberOverviewData {
  total: number;
  distribution: MemberDistribution[];
  monthly_growth: MonthlyGrowth[];
}

export interface CourseRankingItem {
  id: string;
  title: string;
  category: string | null;
  level: string | null;
  membership_type: MembershipType;
  view_count: number;
  total_learners: number;
  completed_learners: number;
  active_learners: number;
  completion_rate: number; // 0-100
}

export interface StudentItem {
  id: string;
  nickname: string;
  phone: string;
  access_level: MembershipType;
  status: "active" | "banned";
  created_at: string;
  last_active_at: string | null;
  completed_courses: number;
  in_progress_courses: number;
}

export interface AccessLevelUpdateResult {
  id: string;
  access_level: MembershipType;
  status?: StudentItem["status"];
  updated_at?: string;
}

export interface InactiveStudentItem {
  id: string;
  nickname: string;
  phone: string;
  access_level: MembershipType;
  created_at: string;
}

export interface InactiveCount {
  days_threshold: string;
  count: number;
}

export interface InactiveStudentsData {
  zero_record_students: InactiveStudentItem[];
  inactive_counts: InactiveCount[];
  total_members: number;
}

export interface LeaderboardStudentItem {
  id: string;
  nickname: string;
  phone: string;
  access_level: MembershipType;
  status: "active" | "banned";
  created_at: string;
  total_credits: number;
  estimated_watch_minutes: number;
  avg_completion_rate: number; // 0-100
}

// ==================== API 函数 ====================

/**
 * 获取会员总览数据：总数、等级分布、月度增长趋势
 */
export async function getAdminMemberOverview(): Promise<MemberOverviewData> {
  const { data, error } = await supabase.rpc("admin_member_overview");
  if (error) {
    console.error("getAdminMemberOverview error:", error);
    throw error;
  }
  return data;
}

/**
 * 获取课程排行数据：观看数、学习人数、完课率
 */
export async function getAdminCourseRankings(): Promise<CourseRankingItem[]> {
  const { data, error } = await supabase.rpc("admin_course_rankings");
  if (error) {
    console.error("getAdminCourseRankings error:", error);
    throw error;
  }
  return data || [];
}

/**
 * 获取学员名单（含学习汇总）
 */
export async function getAdminStudentList(): Promise<StudentItem[]> {
  const { data, error } = await supabase.rpc("admin_student_list");
  if (error) {
    console.error("getAdminStudentList error:", error);
    throw error;
  }
  return data || [];
}

/**
 * 获取沉默学员数据：零记录学员 + 不活跃统计
 */
export async function getAdminInactiveStudents(): Promise<InactiveStudentsData> {
  const { data, error } = await supabase.rpc("admin_inactive_students");
  if (error) {
    console.error("getAdminInactiveStudents error:", error);
    throw error;
  }
  return data;
}

/**
 * 获取学员排行榜数据：学分、观看时长、课程完成度
 */
export async function getAdminStudentLeaderboard(): Promise<LeaderboardStudentItem[]> {
  const { data, error } = await supabase.rpc("admin_student_leaderboard");
  if (error) {
    console.error("getAdminStudentLeaderboard error:", error);
    throw error;
  }
  return data || [];
}

// ==================== 用户权限管理 ====================

/**
 * 管理员修改用户等级
 */
export async function adminUpdateUserAccessLevel(
  userId: string,
  newLevel: MembershipType
): Promise<AccessLevelUpdateResult> {
  const { data, error } = await supabase.rpc("admin_update_user_access_level", {
    p_user_id: userId,
    p_new_level: newLevel,
  });
  if (error) {
    console.error("adminUpdateUserAccessLevel error:", error);
    throw error;
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result || result.id !== userId || result.access_level !== newLevel) {
    throw new Error("用户等级未更新，请刷新后重试");
  }

  return result as AccessLevelUpdateResult;
}

// ==================== 课程管理 ====================

/**
 * 管理员获取所有课程（含草稿和已归档）
 */
export async function getAdminCourseList(): Promise<Course[]> {
  const { data, error } = await supabase.rpc("admin_course_list");
  if (error) {
    console.error("getAdminCourseList error:", error);
    throw error;
  }
  return data || [];
}

/**
 * 管理员创建课程
 */
export async function adminCreateCourse(
  course: Omit<Course, "id" | "view_count" | "created_at" | "updated_at">
): Promise<Course> {
  const { data, error } = await supabase
    .from("courses")
    .insert(course)
    .select()
    .single();
  if (error) {
    console.error("adminCreateCourse error:", error);
    throw error;
  }
  return data;
}

/**
 * 管理员更新课程
 */
export async function adminUpdateCourse(
  courseId: string,
  updates: Partial<Course>
): Promise<Course> {
  const { data, error } = await supabase
    .from("courses")
    .update(updates)
    .eq("id", courseId)
    .select()
    .single();
  if (error) {
    console.error("adminUpdateCourse error:", error);
    throw error;
  }
  return data;
}

/**
 * 管理员归档课程
 */
export async function adminArchiveCourse(courseId: string): Promise<void> {
  const { error } = await supabase
    .from("courses")
    .update({ status: "archived" })
    .eq("id", courseId);
  if (error) {
    console.error("adminArchiveCourse error:", error);
    throw error;
  }
}

// ==================== 内容运营后台 · 内容管理（R-P0-02） ====================
//
// 约定：所有内容表均启用 RLS——「公开读激活项、管理员读写全部」。
// 下列函数依赖当前登录管理员身份（is_admin()），直接走 PostgREST 即可，
// 与 adminCreateCourse / adminUpdateCourse 保持一致的模式。

type ContentTable =
  | "member_profiles"
  | "faqs"
  | "testimonials"
  | "announcements"
  | "activities"
  | "resources";

interface ContentRowBase {
  id: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/** 管理员读取某内容表的全部记录（含未激活），按 sort_order 排序 */
async function adminContentList<T extends ContentRowBase>(
  table: ContentTable
): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    console.error(`adminContentList(${table}) error:`, error);
    throw error;
  }
  return (data as T[]) ?? [];
}

/** 管理员新建一条内容 */
async function adminContentCreate<T extends Record<string, unknown>>(
  table: ContentTable,
  payload: T
): Promise<T> {
  const { data, error } = await supabase
    .from(table)
    .insert(payload as never)
    .select()
    .single();
  if (error) {
    console.error(`adminContentCreate(${table}) error:`, error);
    throw error;
  }
  return data as T;
}

/** 管理员更新一条内容 */
async function adminContentUpdate(
  table: ContentTable,
  id: string,
  updates: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from(table).update(updates).eq("id", id);
  if (error) {
    console.error(`adminContentUpdate(${table}) error:`, error);
    throw error;
  }
}

/** 管理员切换上下架（软删除/恢复） */
async function adminContentSetActive(
  table: ContentTable,
  id: string,
  isActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from(table)
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) {
    console.error(`adminContentSetActive(${table}) error:`, error);
    throw error;
  }
}

/** 管理员永久删除一条内容（UI 须二次确认） */
async function adminContentDelete(
  table: ContentTable,
  id: string
): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) {
    console.error(`adminContentDelete(${table}) error:`, error);
    throw error;
  }
}

// ---------- site_content：单例区块（按 section_key upsert） ----------

export async function getAdminSiteContentList(): Promise<SiteContent[]> {
  const { data, error } = await supabase
    .from("site_content")
    .select("*")
    .order("section_key", { ascending: true });
  if (error) {
    console.error("getAdminSiteContentList error:", error);
    throw error;
  }
  return (data as SiteContent[]) ?? [];
}

export async function getAdminSiteContent(
  sectionKey: string
): Promise<SiteContent | null> {
  const { data, error } = await supabase
    .from("site_content")
    .select("*")
    .eq("section_key", sectionKey)
    .maybeSingle();
  if (error) {
    console.error("getAdminSiteContent error:", error);
    throw error;
  }
  return (data as SiteContent | null) ?? null;
}

export async function adminUpsertSiteContent(
  sectionKey: string,
  sectionLabel: string,
  data: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from("site_content")
    .upsert(
      { section_key: sectionKey, section_label: sectionLabel, data },
      { onConflict: "section_key" }
    );
  if (error) {
    console.error("adminUpsertSiteContent error:", error);
    throw error;
  }
}

// ---------- member_profiles ----------

export const adminListMemberProfiles = () =>
  adminContentList<MemberProfile>("member_profiles");
export const adminCreateMemberProfile = (p: Omit<MemberProfile, "id" | "created_at" | "updated_at">) =>
  adminContentCreate("member_profiles", p);
export const adminUpdateMemberProfile = (id: string, updates: Partial<MemberProfile>) =>
  adminContentUpdate("member_profiles", id, updates as Record<string, unknown>);
export const adminToggleMemberProfile = (id: string, isActive: boolean) =>
  adminContentSetActive("member_profiles", id, isActive);
export const adminDeleteMemberProfile = (id: string) =>
  adminContentDelete("member_profiles", id);

// ---------- faqs ----------

export const adminListFaqs = () => adminContentList<Faq>("faqs");
export const adminCreateFaq = (p: Omit<Faq, "id" | "created_at" | "updated_at">) =>
  adminContentCreate("faqs", p);
export const adminUpdateFaq = (id: string, updates: Partial<Faq>) =>
  adminContentUpdate("faqs", id, updates as Record<string, unknown>);
export const adminToggleFaq = (id: string, isActive: boolean) =>
  adminContentSetActive("faqs", id, isActive);
export const adminDeleteFaq = (id: string) => adminContentDelete("faqs", id);

// ---------- testimonials ----------

export const adminListTestimonials = () =>
  adminContentList<Testimonial>("testimonials");
export const adminCreateTestimonial = (p: Omit<Testimonial, "id" | "created_at" | "updated_at">) =>
  adminContentCreate("testimonials", p);
export const adminUpdateTestimonial = (id: string, updates: Partial<Testimonial>) =>
  adminContentUpdate("testimonials", id, updates as Record<string, unknown>);
export const adminToggleTestimonial = (id: string, isActive: boolean) =>
  adminContentSetActive("testimonials", id, isActive);
export const adminDeleteTestimonial = (id: string) =>
  adminContentDelete("testimonials", id);

// ---------- announcements ----------

export const adminListAnnouncements = () =>
  adminContentList<Announcement>("announcements");
export const adminCreateAnnouncement = (
  p: Omit<Announcement, "id" | "created_at" | "updated_at">
) => adminContentCreate("announcements", p);
export const adminUpdateAnnouncement = (id: string, updates: Partial<Announcement>) =>
  adminContentUpdate("announcements", id, updates as Record<string, unknown>);
export const adminToggleAnnouncement = (id: string, isActive: boolean) =>
  adminContentSetActive("announcements", id, isActive);
export const adminDeleteAnnouncement = (id: string) =>
  adminContentDelete("announcements", id);

// ---------- activities ----------

export const adminListActivities = () => adminContentList<Activity>("activities");
export const adminCreateActivity = (p: Omit<Activity, "id" | "created_at" | "updated_at">) =>
  adminContentCreate("activities", p);
export const adminUpdateActivity = (id: string, updates: Partial<Activity>) =>
  adminContentUpdate("activities", id, updates as Record<string, unknown>);
export const adminToggleActivity = (id: string, isActive: boolean) =>
  adminContentSetActive("activities", id, isActive);
export const adminDeleteActivity = (id: string) => adminContentDelete("activities", id);

// ---------- resources ----------

export const adminListResources = () => adminContentList<Resource>("resources");
export const adminCreateResource = (p: Omit<Resource, "id" | "created_at" | "updated_at">) =>
  adminContentCreate("resources", p);
export const adminUpdateResource = (id: string, updates: Partial<Resource>) =>
  adminContentUpdate("resources", id, updates as Record<string, unknown>);
export const adminToggleResource = (id: string, isActive: boolean) =>
  adminContentSetActive("resources", id, isActive);
export const adminDeleteResource = (id: string) => adminContentDelete("resources", id);
