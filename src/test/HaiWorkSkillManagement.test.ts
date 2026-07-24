import { describe, expect, it } from "vitest";
import {
  workSkillDeleteBlockReason,
  workSkillEnableBlockReason,
  workVersionDeleteBlockReason,
} from "@/components/admin/HaiWorkSkillManagement";

describe("HAI Work Skill maintenance guards", () => {
  it("requires an enabled Skill to be stopped before deletion", () => {
    expect(workSkillDeleteBlockReason({ is_enabled: true, is_fallback: false })).toContain("先停用");
  });

  it("protects the generic fallback execution path", () => {
    expect(workSkillDeleteBlockReason({ is_enabled: false, is_fallback: true })).toContain("通用降级");
  });

  it("allows deleting an inactive specialist Skill", () => {
    expect(workSkillDeleteBlockReason({ is_enabled: false, is_fallback: false })).toBeNull();
  });

  it("protects the currently published prompt version", () => {
    expect(workVersionDeleteBlockReason({ status: "published" })).toContain("不能直接删除");
    expect(workVersionDeleteBlockReason({ status: "draft" })).toBeNull();
    expect(workVersionDeleteBlockReason({ status: "archived" })).toBeNull();
  });

  it("requires a published version before a Skill can expose its frontend tool", () => {
    expect(workSkillEnableBlockReason(true, [{ status: "draft" }])).toContain("先发布");
    expect(workSkillEnableBlockReason(true, [{ status: "published" }])).toBeNull();
    expect(workSkillEnableBlockReason(false, [])).toBeNull();
  });
});
