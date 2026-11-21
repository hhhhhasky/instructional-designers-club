import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import StudentListSection from "@/components/admin/StudentListSection";
import {
  adminReplaceUserCourseAccess,
  adminSetUserCourseAccess,
  getAdminCourseAccessProducts,
  getAdminStudentList,
  getAdminUserCourseEntitlements,
} from "@/db/admin-api";

vi.mock("@/db/admin-api", () => ({
  adminReplaceUserCourseAccess: vi.fn(),
  adminSetUserCourseAccess: vi.fn(),
  adminAdjustBonusCredits: vi.fn(),
  adminUpdateUserStatus: vi.fn(),
  getAdminCourseAccessProducts: vi.fn(),
  getAdminStudentList: vi.fn(),
  getAdminUserCourseEntitlements: vi.fn(),
}));

afterEach(() => vi.restoreAllMocks());

const date = "2025-01-01T00:00:00Z";

function mockStudent() {
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
}

it("收回继承的课程权限，保留其他课程并可重新开通", async () => {
  mockStudent();
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

it("管理员可以查看改名后的权限并改为搞定公开课", async () => {
  mockStudent();
  const oldGrant = {
    user_id: "student", product_code: "teaching-general-legacy", status: "active",
    starts_at: date, expires_at: null, notes: "原购买记录",
  } as const;
  vi.mocked(getAdminCourseAccessProducts).mockResolvedValue([
    { code: "teaching-general-legacy", name: "俱乐部 plus 课程", description: "可观看教学通识课 2025 版", status: "published", is_grantable: true, sort_order: 11 },
    { code: "gongding-gongkaike", name: "搞定公开课", description: "可观看教学通识课 2025 版和上线后的搞定公开课新版", status: "published", is_grantable: true, sort_order: 12 },
  ]);
  vi.mocked(getAdminUserCourseEntitlements).mockResolvedValue([oldGrant]);
  vi.mocked(adminReplaceUserCourseAccess).mockResolvedValue([
    { ...oldGrant, product_code: "gongding-gongkaike" },
    { ...oldGrant, status: "denied" },
  ]);
  const user = userEvent.setup();
  render(<StudentListSection />);
  await user.click(await screen.findByRole("button", { name: "更换俱乐部 plus 课程权限" }));
  expect(screen.getByRole("combobox", { name: "选择课程权限" })).toHaveValue("gongding-gongkaike");
  expect(screen.getByRole("textbox", { name: "备注" })).toHaveValue("原购买记录");
  await user.click(screen.getByRole("button", { name: "确认更换" }));

  expect(adminReplaceUserCourseAccess).toHaveBeenCalledWith("student", "teaching-general-legacy", "gongding-gongkaike", "原购买记录");
  expect(await screen.findByRole("button", { name: "收回搞定公开课" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "收回俱乐部 plus 课程" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "收回教学通识课" })).toBeInTheDocument();
});
