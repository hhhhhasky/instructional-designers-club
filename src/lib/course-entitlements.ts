import type { Course, MembershipType } from "@/types/types";

export const COURSE_ACCESS_PRODUCTS = [
  {
    code: "teaching-general-v1",
    name: "教学通识课",
    description: "第一版教学通识课",
    grantable: true,
  },
  {
    code: "teaching-general-v2",
    name: "教学通识课 V2",
    description: "暂仅管理员可访问，不在后台授权列表中展示",
    grantable: false,
  },
  {
    code: "teacher-ai",
    name: "教师 AI 课",
    description: "教师 AI 系列课程",
    grantable: true,
  },
  {
    code: "daofa-textbook",
    name: "道法教材解读课",
    description: "道德与法治教材解读课程",
    grantable: true,
  },
] as const;

export type CourseAccessCode = (typeof COURSE_ACCESS_PRODUCTS)[number]["code"];

export interface CourseAccessProduct {
  code: CourseAccessCode;
  name: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  is_grantable: boolean;
  sort_order: number;
}

export interface UserCourseEntitlement {
  user_id: string;
  product_code: CourseAccessCode;
  status: "active" | "revoked";
  starts_at: string;
  expires_at: string | null;
  notes: string | null;
}

const MEMBERSHIP_PRODUCT_MAP: Record<MembershipType, readonly CourseAccessCode[]> = {
  free: [],
  plus2025: ["teaching-general-v1"],
  plus: ["teaching-general-v1"],
  pro: ["teaching-general-v1", "teacher-ai"],
};

export function getMembershipCourseAccessCodes(level: MembershipType): CourseAccessCode[] {
  return [...MEMBERSHIP_PRODUCT_MAP[level]];
}

export function getCourseAccessCode(
  course: Pick<Course, "access_product_code" | "membership_type">,
): CourseAccessCode | null {
  if (course.access_product_code) return course.access_product_code;
  if (course.membership_type === "pro") return "teacher-ai";
  if (course.membership_type === "plus" || course.membership_type === "plus2025") {
    return "teaching-general-v1";
  }
  return null;
}

export function mergeCourseAccessCodes(
  ...groups: ReadonlyArray<readonly CourseAccessCode[]>
): CourseAccessCode[] {
  return [...new Set(groups.flat())];
}

export function courseAccessLabel(code: CourseAccessCode): string {
  return COURSE_ACCESS_PRODUCTS.find((product) => product.code === code)?.name ?? code;
}
