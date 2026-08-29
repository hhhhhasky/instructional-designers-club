import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getHaiAccessStatus } from "@/db/hai-api";
import HaiPointsPage from "@/pages/HaiPointsPage";

vi.mock("@/components/layout/Header", () => ({ default: () => <div data-testid="global-header" /> }));
vi.mock("@/components/common/Footer", () => ({ default: () => <div data-testid="global-footer" /> }));
vi.mock("@/components/common/PageMeta", () => ({ default: () => null }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}));
vi.mock("@/db/hai-api", () => ({ getHaiAccessStatus: vi.fn() }));

describe("HAI points purchase page", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(getHaiAccessStatus).mockResolvedValue({
      access: { authenticated: true, allowed: true, quota_mode: "points", membership_level: "plus" },
      usage: {
        quota_mode: "points",
        membership_level: "plus",
        daily_used: 0,
        weekly_used: 0,
        daily_limit: 0,
        weekly_limit: 0,
        current_points: 15,
        consumed_points: 5,
        point_packages: [
          { points: 25, price_cny: 18 },
          { points: 500, price_cny: 299 },
        ],
        wecom_qr_url: "/哈老师企微二维码.png",
      },
    });
  });

  it("shows configured package prices, balance and QR without exposing Token conversion", async () => {
    render(
      <MemoryRouter initialEntries={["/hai/points"]}>
        <HaiPointsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("15 积分")).toBeInTheDocument();
    expect(screen.getByText("已消耗 5 积分")).toBeInTheDocument();
    expect(screen.getByText("25 积分")).toBeInTheDocument();
    expect(screen.getByText("500 积分")).toBeInTheDocument();
    expect(screen.getByText("¥18")).toBeInTheDocument();
    expect(screen.getByText("¥299")).toBeInTheDocument();
    expect(screen.queryByText(/Token/i)).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "企业微信购买二维码" })).toHaveAttribute("src", "/哈老师企微二维码.png");
  });

  it("shows package points and prices saved by the frontend-only admin editor", async () => {
    window.localStorage.setItem("hai-local-point-packages", JSON.stringify([
      { points: 10, price: 12 },
      { points: 100, price: 108 },
    ]));

    render(
      <MemoryRouter initialEntries={["/hai/points"]}>
        <HaiPointsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("10 积分")).toBeInTheDocument();
    expect(screen.getByText("100 积分")).toBeInTheDocument();
    expect(screen.getByText("¥12")).toBeInTheDocument();
    expect(screen.getByText("¥108")).toBeInTheDocument();
    expect(screen.queryByText("¥18")).not.toBeInTheDocument();
  });

  it("allows an internal beta user to buy while keeping the purchased wallet separate", async () => {
    vi.mocked(getHaiAccessStatus).mockResolvedValueOnce({
      access: { authenticated: true, allowed: true, quota_mode: "internal", quota_policy_key: "beta" },
      usage: {
        quota_mode: "internal",
        policy_key: "beta",
        daily_used: 100,
        weekly_used: 500,
        daily_limit: 30000,
        weekly_limit: 150000,
        current_points: 1495,
        consumed_points: 5,
        wallet_points: 20,
        wallet_consumed_points: 0,
      },
    });

    render(
      <MemoryRouter initialEntries={["/hai/points"]}>
        <HaiPointsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("20 积分")).toBeInTheDocument();
    expect(screen.getByText(/当前使用内测额度/)).toBeInTheDocument();
    expect(screen.getByText("100 积分")).toBeInTheDocument();
  });

  it("shows packages to a logged-in user even before HAI access is enabled", async () => {
    vi.mocked(getHaiAccessStatus).mockResolvedValueOnce({
      access: { authenticated: true, allowed: false, reason: "HAI 权限未开通" },
      usage: {
        quota_mode: "none",
        daily_used: 0,
        weekly_used: 0,
        daily_limit: 0,
        weekly_limit: 0,
        wallet_points: 0,
        wallet_consumed_points: 0,
      },
    });

    render(
      <MemoryRouter initialEntries={["/hai/points"]}>
        <HaiPointsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("可先购买积分；使用 HAI 前仍需由后台开通权限或升级会员。")).toBeInTheDocument();
    expect(screen.getByText("10 积分")).toBeInTheDocument();
    expect(screen.queryByText(/仅面向/)).not.toBeInTheDocument();
  });

  it("does not restore fallback packages when all configured packages are disabled", async () => {
    vi.mocked(getHaiAccessStatus).mockResolvedValueOnce({
      access: { authenticated: true, allowed: true, quota_mode: "points", membership_level: "plus" },
      usage: {
        quota_mode: "points",
        daily_used: 0,
        weekly_used: 0,
        daily_limit: 0,
        weekly_limit: 0,
        point_packages: [],
      },
    });

    render(
      <MemoryRouter initialEntries={["/hai/points"]}>
        <HaiPointsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("暂无可购买套餐，请联系管理员。")).toBeInTheDocument();
    expect(screen.queryByText("10 积分")).not.toBeInTheDocument();
  });
});

describe("HAI points wallet migration contract", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260829045719_hai_points_wallet.sql"),
    "utf8",
  );
  const privilegeSql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260829053947_hai_points_wallet_privilege_hardening.sql"),
    "utf8",
  );
  const ownershipSql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260829054242_hai_finalize_usage_ownership_guard.sql"),
    "utf8",
  );
  const universalPurchaseSql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260829060046_hai_points_universal_purchase_and_display.sql"),
    "utf8",
  );
  const membershipGrantSql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260829082605_hai_membership_2015plus_points_grant.sql"),
    "utf8",
  );
  const adminSource = readFileSync(
    resolve(process.cwd(), "src/components/admin/HaiManagementSection.tsx"),
    "utf8",
  );

  it("uses the corrected 100 Token per point default and disables the free tier and invites", () => {
    expect(sql).toContain("15 万 Token ÷ 1500 积分 = 100 Token/积分");
    expect(sql).toContain("'points.tokens_per_point'");
    expect(sql).toContain("to_jsonb(100::integer)");
    expect(sql).toContain("update public.hai_quota_policies set enabled = false where key = 'free'");
    expect(sql).toContain("update public.hai_invite_codes set status = 'disabled'");
    expect(sql).toContain("revoke execute on function public.hai_redeem_invite_code");
  });

  it("keeps internal quotas ahead of membership points and charges completed point requests once", () => {
    expect(sql).toContain("v_access.access_source = 'admin'");
    expect(sql).toContain("v_quota_mode := 'internal'");
    expect(sql).toContain("metadata ->> 'quota_mode' = 'points'");
    expect(sql).toContain("v_reservation.status <> 'active'");
    expect(sql).toContain("transaction_type, token_delta, points_delta");
    expect(sql).toContain("create or replace function public.hai_admin_add_points");
  });

  it("enables RLS and exposes only read access to wallet tables", () => {
    expect(sql).toContain("alter table public.hai_point_wallets enable row level security");
    expect(sql).toContain("alter table public.hai_point_transactions enable row level security");
    expect(sql).toContain("grant select on public.hai_point_wallets, public.hai_point_transactions to authenticated");
    expect(sql).not.toMatch(/grant\s+(insert|update|delete)[^;]*hai_point_wallets/i);
    expect(privilegeSql).toContain("revoke all on table public.hai_point_wallets from public, anon");
    expect(privilegeSql).toContain("from authenticated");
    expect(privilegeSql).toContain("grant select on table public.hai_point_wallets");
  });

  it("prevents one authenticated user from finalizing another user's reservation", () => {
    expect(ownershipSql).toContain("v_reservation.user_id <> auth.uid()");
    expect(ownershipSql).toContain("无权限结算其他用户的 HAI 请求");
    expect(ownershipSql).toContain("v_reservation.status <> 'active'");
  });

  it("supports universal purchase while preserving Plus/Pro-only newcomer gifts and internal priority", () => {
    expect(universalPurchaseSql).toContain("if v_access_level in ('plus', 'pro') and v_wallet.newcomer_granted_at is null");
    expect(universalPurchaseSql).toContain("v_quota_mode := 'internal'");
    expect(universalPurchaseSql).toContain("'wallet_points'");
    expect(universalPurchaseSql).toContain("'current_points', case");
    expect(universalPurchaseSql).not.toContain("仅可为 Plus 或 Pro 用户增加 HAI 积分");
  });

  it("configures editable packages and the supplied enterprise WeChat QR code", () => {
    expect(universalPurchaseSql).toContain("'points.package_1_points'");
    expect(universalPurchaseSql).toContain("'points.package_1_price_cny'");
    expect(universalPurchaseSql).toContain("'points.package_3_points'");
    expect(universalPurchaseSql).toContain("'point_packages', v_point_packages");
    expect(universalPurchaseSql).toContain("'/哈老师企微二维码.png'");
    expect(adminSource).toContain('title="积分与套餐设置"');
    expect(adminSource).toContain("前端套餐显示");
    expect(adminSource).toContain("保存显示");
  });

  it("requires the admin to change membership first and manually grant newcomer points exactly once", () => {
    expect(membershipGrantSql).toContain("create or replace function public.hai_admin_grant_newcomer_points");
    expect(membershipGrantSql).toContain("if v_access_level not in ('plus', 'pro')");
    expect(membershipGrantSql).toContain("请先将用户等级调整为 Plus 或 Pro");
    expect(membershipGrantSql).toContain("on conflict (user_id) do nothing");
    expect(membershipGrantSql).toContain("不能重复发放");
    expect(membershipGrantSql).toContain("'source', 'manual_admin'");
    expect(membershipGrantSql).not.toContain("Existing Plus/Pro accounts receive the one-time 1000-point grant now");
    expect(adminSource).toContain("先手动调整会员等级，再单独发放首次 HAI 积分");
    expect(adminSource).toContain('supabase.rpc("hai_admin_grant_newcomer_points"');
    expect(adminSource).toContain("请先完成第 1 步：仅 Plus / Pro 可领取首次赠送");
    expect(adminSource).toContain("按手机号或用户名筛选积分用户");
    expect(adminSource).toContain("按会员等级筛选积分用户");
  });
});
