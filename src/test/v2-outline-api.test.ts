import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/db/supabase";
import { deleteV2LessonAdmin, deleteV2UnitAdmin } from "@/db/v2-api";

vi.mock("@/db/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe("V2 two-level outline writes", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["unit", "v2_course_units", deleteV2UnitAdmin],
    ["lesson", "v2_course_lessons", deleteV2LessonAdmin],
  ] as const)("deletes a %s through its RLS-protected table", async (_label, table, remove) => {
    const eq = vi.fn().mockResolvedValue({ data: null, error: null });
    const deleteQuery = vi.fn(() => ({ eq }));
    vi.mocked(supabase.from).mockReturnValue({ delete: deleteQuery } as never);

    await remove("target-id");

    expect(supabase.from).toHaveBeenCalledWith(table);
    expect(deleteQuery).toHaveBeenCalledOnce();
    expect(eq).toHaveBeenCalledWith("id", "target-id");
  });

  it("surfaces a failed delete instead of reporting success", async () => {
    const databaseError = { code: "42501", message: "permission denied" };
    vi.mocked(supabase.from).mockReturnValue({
      delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: null, error: databaseError }) })),
    } as never);

    await expect(deleteV2UnitAdmin("unit-id")).rejects.toEqual(databaseError);
  });
});
