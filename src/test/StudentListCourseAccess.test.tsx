import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import StudentListSection from "@/components/admin/StudentListSection";
import {
  adminSetUserCourseAccess,
  getAdminCourseAccessProducts,
  getAdminStudentList,
  getAdminUserCourseEntitlements,
} from "@/db/admin-api";

vi.mock("@/db/admin-api", () => ({
  adminSetUserCourseAccess: vi.fn(),
  adminAdjustBonusCredits: vi.fn(),
  adminUpdateUserStatus: vi.fn(),
  getAdminCourseAccessProducts: vi.fn(),
  getAdminStudentList: vi.fn(),
  getAdminUserCourseEntitlements: vi.fn(),
}));

afterEach(() => vi.restoreAllMocks());

it("收回继承的课程权限，保留其他课程并可重新开通", async () => {
  const date = "2025-01-01T00:00:00Z";
  vi.mocked(getAdminStudentList).mockResolvedValue([{
    id: "student",
    nickname: "测试学员",
    phone: "13000000000",
    access_level: "pro",
    status: "active",
    created_at: date,
    last_active_at: null,
    completed_courses: 0,
    in_progress_courses: 0,
    total_credits: 0,
    bonus_credits: 0,
  }]);
  vi.mocked(getAdminCourseAccessProducts).mockResolvedValue([
    { code: "teaching-general-v1", name: "教学通识课", description: null, status: "published", is_grantable: true, sort_order: 10 },
    { code: "teacher-ai", name: "教师 AI 课", description: null, status: "published", is_grantable: true, sort_order: 30 },
  ]);
  vi.mocked(getAdminUserCourseEntitlements).mockResolvedValue([]);
  vi.mocked(adminSetUserCourseAccess).mockImplementation(async (user_id, product_code, enabled) => ({
    user_id, product_code, status: enabled ? "active" : "denied", starts_at: date, expires_at: null, notes: null,
  }));
  vi.spyOn(window, "confirm").mockReturnValue(true);

  const user = userEvent.setup();
  render(<StudentListSection />);
  await user.click(await screen.findByRole("button", { name: "收回教师 AI 课" }));
  expect(adminSetUserCourseAccess).toHaveBeenCalledWith("student", "teacher-ai", false, "后台手动收回");
  await waitFor(() => expect(screen.queryByRole("button", { name: "收回教师 AI 课" })).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "收回教学通识课" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "+开通课程" }));
  expect(screen.getByRole("combobox", { name: "选择课程权限" })).toHaveValue("teacher-ai");
  await user.click(screen.getByRole("button", { name: "确认开通" }));
  expect(adminSetUserCourseAccess).toHaveBeenLastCalledWith("student", "teacher-ai", true, "");
  expect(await screen.findByRole("button", { name: "收回教师 AI 课" })).toBeInTheDocument();
});
