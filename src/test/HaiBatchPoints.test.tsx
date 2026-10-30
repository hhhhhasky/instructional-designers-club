import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HaiBatchPoints from "@/components/admin/hai/HaiBatchPoints";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), products: vi.fn() }));
vi.mock("@/db/supabase", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/db/admin-api", () => ({ getAdminCourseAccessProducts: mocks.products }));

describe("课程用户批量积分", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.products.mockResolvedValue([{ code: "daofa-textbook", name: "道法教材解读课" }, { code: "teacher-ai", name: "教师 AI 课" }]);
    mocks.rpc.mockImplementation((name: string) => Promise.resolve(name === "hai_admin_course_point_users" ? { data: [
      { id: "a", nickname: "小王", phone: "123", points: 30 },
      { id: "b", nickname: "小李", phone: "456", points: 50 },
    ], error: null } : { data: { count: 2 }, error: null }));
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });
  it("按课程筛选、搜索并选择用户，确认后批量扣分", async () => {
    render(<HaiBatchPoints />);
    fireEvent.change(await screen.findByLabelText("课程权限"), { target: { value: "daofa-textbook" } });
    await screen.findByText(/小王/);
    fireEvent.change(screen.getByLabelText("批量搜索用户"), { target: { value: "123" } });
    fireEvent.click(screen.getByLabelText("全选当前筛选结果"));
    expect(screen.getByText(/已选 1 人/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("批量搜索用户"), { target: { value: "" } });
    fireEvent.click(within(screen.getByText(/小李/).closest("label")!).getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("积分操作"), { target: { value: "deduct" } });
    fireEvent.change(screen.getByLabelText("每人积分数量"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("批量调整原因"), { target: { value: "更正赠送" } });
    fireEvent.click(screen.getByRole("button", { name: "调整选中用户" }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("hai_admin_batch_adjust_points", { p_user_ids: ["a", "b"], p_points: -10, p_reason: "更正赠送" }));
    expect(await screen.findByText(/已为 2 位用户每人扣除 10 积分/)).toBeInTheDocument();
  });
  it("切换课程清空选择，操作失败保留选择并提示核对", async () => {
    render(<HaiBatchPoints />);
    await screen.findByRole("option", { name: "道法教材解读课" });
    fireEvent.change(screen.getByLabelText("课程权限"), { target: { value: "daofa-textbook" } });
    await screen.findByText(/小王/);
    fireEvent.click(screen.getByLabelText("全选当前筛选结果"));
    fireEvent.change(screen.getByLabelText("课程权限"), { target: { value: "teacher-ai" } });
    await waitFor(() => expect(screen.getByText(/已选 0 人/)).toBeInTheDocument());
    await screen.findByText(/小王/);
    fireEvent.click(screen.getByLabelText("全选当前筛选结果"));
    fireEvent.change(screen.getByLabelText("每人积分数量"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("批量调整原因"), { target: { value: "赠送" } });
    mocks.rpc.mockImplementationOnce(() => Promise.resolve({ data: null, error: { message: "余额不足" } }));
    fireEvent.click(screen.getByRole("button", { name: "调整选中用户" }));
    expect(await screen.findByText(/余额不足/)).toBeInTheDocument();
    expect(screen.getByText(/已选 2 人/)).toBeInTheDocument();
  });
});
