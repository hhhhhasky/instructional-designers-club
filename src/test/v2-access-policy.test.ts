import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canAccessV2 } from "@/lib/v2-access";
import type { Profile } from "@/types/types";

const migrationPath = path.resolve("supabase/migrations/20260912071445_fix_v2_cascade_delete_and_admin_only_access.sql");

function profile(role: Profile["role"], accessLevel: Profile["access_level"], status: Profile["status"] = "active") {
  return { role, access_level: accessLevel, status };
}

describe("V2 当前访问策略", () => {
  it("只允许 active admin，所有会员等级和 editor 均不能单独获得权限", () => {
    expect(canAccessV2(profile("admin", "free"))).toBe(true);
    expect(canAccessV2(profile("member", "plus"))).toBe(false);
    expect(canAccessV2(profile("member", "pro"))).toBe(false);
    expect(canAccessV2(profile("member", "free"))).toBe(false);
    expect(canAccessV2(profile("member", "plus2015"))).toBe(false);
    expect(canAccessV2(profile("admin", "pro", "banned"))).toBe(false);
  });

  it("数据库迁移把访问和管理函数统一为 admin-only", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    expect(sql).toContain("create or replace function private.v2_can_manage()");
    expect(sql).toContain("create or replace function private.v2_user_has_access()");
    expect(sql.match(/p\.role = 'admin'/g)).toHaveLength(2);
    expect(sql).not.toContain("p.access_level::text in ('plus', 'pro')");
    expect(sql).not.toContain("from public.v2_course_access a");
  });
});

describe("V2 删除级联", () => {
  it("删除试题时会同步删除答案，不再由 RESTRICT 阻断 Unit 删除", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/foreign key \(item_id\)[\s\S]*references public\.v2_assessment_items\(id\)[\s\S]*on delete cascade;/);
    expect(sql).not.toContain("on delete restrict");
  });
});
