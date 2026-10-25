import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WebToolBillingSettings from "@/components/admin/hai/WebToolBillingSettings";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/db/supabase", () => ({ supabase: { rpc } }));
const settings = [{ key: "points.web_search_cny_per_1000", value: 5 }, { key: "points.web_fetch_cny_per_1000", value: 5 }];
describe("web tool billing settings", () => {
  beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ error: null }); });
  it("shows half a point per successful call with the explicit base conversion", () => {
    render(<WebToolBillingSettings settings={settings} cnyPerPoint={0.01} onSaved={vi.fn()} />);
    expect(screen.getByText("每次成功检索：0.5积分")).toBeInTheDocument();
    expect(screen.getByText("每次成功抓取：0.5积分")).toBeInTheDocument();
  });
  it("saves both prices atomically and updates the preview without changing the conversion", async () => {
    const saved = vi.fn(); render(<WebToolBillingSettings settings={settings} cnyPerPoint={0.01} onSaved={saved} />);
    fireEvent.change(screen.getByLabelText(/每1000次成功检索费用/), { target: { value: "10" } });
    expect(screen.getByText("每次成功检索：1积分")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存检索与抓取单价" }));
    await waitFor(() => expect(saved).toHaveBeenCalledWith(10, 5));
    expect(rpc).toHaveBeenCalledWith("hai_update_web_tool_prices", { p_search_cny: 10, p_fetch_cny: 5 });
  });
  it("does not save negative or blank prices", () => {
    render(<WebToolBillingSettings settings={settings} cnyPerPoint={0.01} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/每1000次成功抓取费用/), { target: { value: "-1" } });
    expect(screen.getByRole("button", { name: "保存检索与抓取单价" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/每1000次成功抓取费用/), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "保存检索与抓取单价" })).toBeDisabled(); expect(rpc).not.toHaveBeenCalled();
  });
  it("retains unsaved values and reports a failed save", async () => {
    rpc.mockResolvedValue({ error: new Error("暂时无法保存") }); const saved = vi.fn();
    render(<WebToolBillingSettings settings={settings} cnyPerPoint={0.01} onSaved={saved} />);
    fireEvent.change(screen.getByLabelText(/每1000次成功抓取费用/), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "保存检索与抓取单价" }));
    expect(await screen.findByRole("status")).toHaveTextContent("暂时无法保存");
    expect(screen.getByLabelText(/每1000次成功抓取费用/)).toHaveValue(8); expect(saved).not.toHaveBeenCalled();
  });
  it("does not pretend to persist prices before database installation", () => {
    render(<WebToolBillingSettings settings={[]} cnyPerPoint={0.01} onSaved={vi.fn()} />);
    expect(screen.getByRole("button", { name: "保存检索与抓取单价" })).toBeDisabled();
    expect(screen.getByText(/数据库检索计费配置尚未安装/)).toBeInTheDocument();
  });
});
