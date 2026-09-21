import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canAccessCourse } from "@/lib/access-control";
import {
  COURSE_ACCESS_PRODUCTS,
  getMembershipCourseAccessCodes,
} from "@/lib/course-entitlements";

describe("course entitlement model", () => {
  it("uses stable codes and keeps V2 non-grantable", () => {
    expect(COURSE_ACCESS_PRODUCTS.map((product) => product.code)).toEqual([
      "teaching-general-v1",
      "teaching-general-v2",
      "teacher-ai",
      "daofa-textbook",
    ]);
    expect(COURSE_ACCESS_PRODUCTS.find((product) => product.code === "teaching-general-v2")?.grantable).toBe(false);
  });

  it("maps legacy memberships without granting V2", () => {
    expect(getMembershipCourseAccessCodes("plus2025")).toEqual(["teaching-general-v1"]);
    expect(getMembershipCourseAccessCodes("plus")).toEqual(["teaching-general-v1"]);
    expect(getMembershipCourseAccessCodes("pro")).toEqual(["teaching-general-v1", "teacher-ai"]);
    expect(getMembershipCourseAccessCodes("free")).toEqual([]);
    expect(getMembershipCourseAccessCodes("pro")).not.toContain("teaching-general-v2");
  });

  it("supports precise combinations of direct course permissions", () => {
    const access = ["teaching-general-v1", "daofa-textbook"] as const;
    expect(canAccessCourse(access, "teaching-general-v1")).toBe(true);
    expect(canAccessCourse(access, "daofa-textbook")).toBe(true);
    expect(canAccessCourse(access, "teacher-ai")).toBe(false);
    expect(canAccessCourse(access, "teaching-general-v2")).toBe(false);
  });
});

describe("course entitlement migration contract", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260921083014_decouple_course_entitlements_and_hai_points.sql"),
    "utf8",
  );

  it("stores products, compatibility mappings and direct user grants separately", () => {
    expect(sql).toContain("create table public.course_access_products");
    expect(sql).toContain("create table public.membership_course_access");
    expect(sql).toContain("create table public.user_course_entitlements");
    expect(sql).toContain("('teaching-general-v2', '教学通识课 V2', '暂仅管理员可访问', 'published', false");
    expect(sql).not.toContain("('pro', 'teaching-general-v2')");
  });

  it("authorizes protected content from either mapping or a direct grant", () => {
    expect(sql).toContain("from public.membership_course_access m");
    expect(sql).toContain("from public.user_course_entitlements e");
    expect(sql).toContain("e.status = 'active'");
    expect(sql).toContain("e.expires_at is null or e.expires_at > now()");
  });

  it("lets every active account open HAI and gates consumption on points", () => {
    expect(sql).toContain("where p.id = p_user_id and p.status = 'active'");
    expect(sql).toContain("'can_consume', v_wallet.balance_tokens > 0");
    expect(sql).toContain("if v_wallet.balance_tokens <= 0");
    expect(sql).not.toContain("profile.access_level::text in ('plus', 'pro')");
  });
});
