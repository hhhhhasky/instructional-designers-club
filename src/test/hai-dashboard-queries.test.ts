import { describe, expect, it, vi } from "vitest";

const { from, rpc } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/db/supabase", () => ({ supabase: { from }, typedSupabase: { from, rpc } }));
import { getAdminHaiDashboard } from "@/db/hai-analytics";

describe("dashboard requests", () => {
  it("keeps the quality metric without loading Chat, PPT, or Work trace bodies", async () => {
    rpc.mockReturnValue({ single: async () => ({ data: { scored_count: 2, passed_count: 1, score_total: 150 }, error: null }) });
    from.mockImplementation((table: string) => {
      const result = { data: table === "hai_runtime_settings" ? null : [], error: null };
      const query: Record<string, unknown> = {};
      for (const method of ["select", "like", "in", "gte", "eq", "or", "order", "range", "limit", "maybeSingle"]) {
        query[method] = () => query;
      }
      query.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
      return query;
    });
    const dashboard = await getAdminHaiDashboard(30);
    const tables = from.mock.calls.map(([table]) => table);
    expect(rpc).toHaveBeenCalledWith("admin_hai_quality_summary", { p_since: expect.any(String) });
    expect(dashboard.summary).toMatchObject({ quality_average: 75, quality_pass_rate: 50 });
    expect(tables).not.toContain("hai_messages");
    expect(tables).not.toContain("hai_courseware_decks");
    expect(tables).not.toContain("hai_work_runs");
    expect(tables).not.toContain("hai_work_debug_traces");
  });
});
