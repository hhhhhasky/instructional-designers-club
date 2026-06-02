import { supabase } from "./supabase";
import type { MembershipType, Course } from "@/types/types";

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
): Promise<void> {
  const { error } = await supabase.rpc("admin_update_user_access_level", {
    p_user_id: userId,
    p_new_level: newLevel,
  });
  if (error) {
    console.error("adminUpdateUserAccessLevel error:", error);
    throw error;
  }
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
): Promise<void> {
  const { error } = await supabase
    .from("courses")
    .update(updates)
    .eq("id", courseId);
  if (error) {
    console.error("adminUpdateCourse error:", error);
    throw error;
  }
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
