import type { Course, MembershipType } from "@/types/types";

export const COURSE_ACCESS_PRODUCTS = [
  {
    code: "teaching-general-v1",
    name: "教学通识课",
    description: "可观看 2025 版，2027 版上架后可观看新版",
    grantable: true,
  },
  {
    code: "teaching-general-legacy",
    name: "教学通识课旧版",
    description: "仅可观看教学通识课 2025 版",
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
  status: "active" | "revoked" | "denied";
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
  // 数据库出现未知 access_level 时回退为无课程权限，避免登录链路抛错。
  return [...(MEMBERSHIP_PRODUCT_MAP[level] ?? [])];
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

export function getEffectiveCourseAccessCodes(
  level: MembershipType,
  entitlements: readonly Pick<UserCourseEntitlement, "product_code" | "status" | "starts_at" | "expires_at">[],
): CourseAccessCode[] {
  const codes = new Set(getMembershipCourseAccessCodes(level));
  const now = Date.now();
  for (const entitlement of entitlements) {
    if (entitlement.status === "denied") {
      codes.delete(entitlement.product_code);
    } else if (
      entitlement.status === "active" &&
      Date.parse(entitlement.starts_at) <= now &&
      (entitlement.expires_at === null || Date.parse(entitlement.expires_at) > now)
    ) {
      codes.add(entitlement.product_code);
    }
  }
  return [...codes];
}

export function courseAccessLabel(code: CourseAccessCode): string {
  return COURSE_ACCESS_PRODUCTS.find((product) => product.code === code)?.name ?? code;
}
