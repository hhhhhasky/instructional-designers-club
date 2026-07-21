import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, selectMock } = vi.hoisted(() => {
  const select = vi.fn();
  return {
    fromMock: vi.fn(() => ({ select })),
    selectMock: select,
  };
});

vi.mock("@/db/supabase", () => ({
  supabase: { from: fromMock },
}));

import { getAdminMaintenanceSnapshot } from "@/db/admin-operations";

describe("admin maintenance snapshot", () => {
  beforeEach(() => {
    fromMock.mockClear();
    selectMock.mockReset();
    selectMock.mockImplementation(() => ({
      eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
    }));
  });

  it("counts rows through the public id column instead of selecting protected fields", async () => {
    await expect(getAdminMaintenanceSnapshot()).resolves.toEqual({
      published_courses: 1,
      draft_courses: 1,
      active_members: 1,
      banned_members: 1,
      visible_questions: 1,
      pending_resets: 1,
      active_content: 3,
      open_hai_alerts: 1,
    });

    expect(selectMock).toHaveBeenCalledTimes(10);
    for (const [columns, options] of selectMock.mock.calls) {
      expect(columns).toBe("id");
      expect(options).toEqual({ count: "exact", head: true });
    }
  });
});
