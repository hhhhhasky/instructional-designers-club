import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminUpdateUserStatus } from "@/db/admin-api";
import { supabase } from "@/db/supabase";

vi.mock("@/db/api", () => ({
  clearAllLearningDataCaches: vi.fn(),
  clearCourseCatalogCache: vi.fn(),
  clearCourseDetailCache: vi.fn(),
  clearHomePageSnapshotCache: vi.fn(),
  clearResourcesCache: vi.fn(),
}));

vi.mock("@/db/supabase", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe("admin user status maintenance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("writes the requested status through the protected RPC", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { id: "member-1", status: "banned", updated_at: "2026-07-13T15:00:00Z" },
      error: null,
    } as never);

    await expect(adminUpdateUserStatus("member-1", "banned")).resolves.toMatchObject({
      id: "member-1",
      status: "banned",
    });
    expect(supabase.rpc).toHaveBeenCalledWith("admin_update_user_status", {
      p_user_id: "member-1",
      p_new_status: "banned",
    });
  });

  it("rejects an inconsistent RPC response", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { id: "member-1", status: "active" },
      error: null,
    } as never);

    await expect(adminUpdateUserStatus("member-1", "banned")).rejects.toThrow("账号状态未更新");
  });
});
