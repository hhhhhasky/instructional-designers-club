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
          {
            id: "package-answer",
            name: "体验包",
            points: 25,
            price_cny: 18,
            description: "适合第一次体验。",
            value_metrics: "约完成 2 次答疑\n约 1 次辅助工作",
            is_recommended: false,
          },
          {
            id: "package-work",
            name: "备课包",
            points: 500,
            price_cny: 299,
            description: "适合阶段备课。",
            value_metrics: "约完成 45 次答疑",
            is_recommended: true,
          },
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
    expect(screen.getAllByText("25 积分")).toHaveLength(2);
    expect(screen.getAllByText("500 积分")).toHaveLength(2);
    expect(screen.getAllByText("¥18")).toHaveLength(2);
    expect(screen.getAllByText("¥299")).toHaveLength(2);
    expect(screen.queryByText(/Token/i)).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "企业微信购买二维码" })).toHaveAttribute("src", "/哈老师企微二维码.png");
  });

  it("shows configured package descriptions and value metrics in a comparison table", async () => {
    render(
      <MemoryRouter initialEntries={["/hai/points"]}>
        <HaiPointsPage />
      </MemoryRouter>,
    );

    expect(await screen.findAllByText("体验包")).toHaveLength(2);
    expect(screen.getAllByText("备课包")).toHaveLength(2);
    expect(screen.getAllByText("25 积分")).toHaveLength(2);
    expect(screen.getAllByText("500 积分")).toHaveLength(2);
    expect(screen.getAllByText("¥18")).toHaveLength(2);
    expect(screen.getAllByText("¥299")).toHaveLength(2);
    expect(screen.getAllByText("约完成 2 次答疑")).toHaveLength(2);
    expect(screen.getAllByText("约完成 45 次答疑")).toHaveLength(2);
    expect(screen.getByRole("columnheader", { name: "可完成内容" })).toBeInTheDocument();
  });

  it("keeps the points purchase page compatible with an administrator internal quota", async () => {
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
        point_packages: [{
          id: "internal-package",
          name: "体验包",
          points: 100,
          price_cny: 9.9,
          description: "适合体验。",
          value_metrics: "约完成 9 次答疑",
          is_recommended: false,
        }],
      },
    });

    render(
      <MemoryRouter initialEntries={["/hai/points"]}>
        <HaiPointsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("20 积分")).toBeInTheDocument();
    expect(screen.getByText(/当前使用内测额度/)).toBeInTheDocument();
    expect(screen.getAllByText("100 积分")).toHaveLength(2);
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
        point_packages: [{
          id: "pre-package",
          name: "体验包",
          points: 10,
          price_cny: 1,
          description: "适合体验。",
          value_metrics: "约完成 1 次答疑",
          is_recommended: false,
        }],
      },
    });

    render(
      <MemoryRouter initialEntries={["/hai/points"]}>
        <HaiPointsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("可先购买积分；使用 HAI 前仍需开通 Plus 或 Pro 会员。")).toBeInTheDocument();
    expect(screen.getAllByText("10 积分")).toHaveLength(2);
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
  const weightedBillingSql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260829124258_hai_weighted_equivalent_token_billing.sql"),
    "utf8",
  );
  const splitNewcomerSql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260829150441_hai_split_newcomer_points_by_level.sql"),
    "utf8",
  );
  const pointNotificationSql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260830051812_hai_notify_all_positive_point_credits.sql"),
    "utf8",
  );
  const dynamicPackageSql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260829132153_hai_dynamic_point_packages.sql"),
    "utf8",
  );
  const membershipPointsGateSql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260830064731_hai_membership_points_access_gate.sql"),
    "utf8",
  );
  const adminSource = readFileSync(
    resolve(process.cwd(), "src/components/admin/HaiManagementSection.tsx"),
    "utf8",
  );
  const edgeSources = ["hai-chat", "hai-work", "hai-roundtable-chat"].map((name) => readFileSync(
    resolve(process.cwd(), `supabase/functions/${name}/index.ts`),
    "utf8",
  ));

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

  it("makes membership points authoritative without deleting historical beta records", () => {
    expect(membershipPointsGateSql).toContain("Beta records remain in place for audit/history");
    expect(membershipPointsGateSql).toContain("profile.access_level::text in ('plus', 'pro')");
    expect(membershipPointsGateSql).toContain("'status', case when v_wallet.balance_tokens > 0 then 'active' else 'needs_points' end");
    expect(membershipPointsGateSql).toContain("'can_consume', v_wallet.balance_tokens > 0");
    expect(membershipPointsGateSql).toContain("if v_wallet.balance_tokens <= 0");
    expect(membershipPointsGateSql).not.toContain("v_access.access_source = 'admin'");
    expect(membershipPointsGateSql).not.toContain("你的 HAI 内测资格当前不可用");
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
    expect(adminSource).toContain("购买页套餐管理");
    expect(adminSource).toContain("新增套餐");
    expect(adminSource).toContain('supabase.from("hai_point_packages")');
    expect(adminSource).toContain("可完成内容（每行一条）");
    expect(adminSource).toContain("每 1 积分售价");
    expect(adminSource).toContain("保存金额-积分");
  });

  it("stores dynamic packages with descriptions, value metrics and admin-only writes", () => {
    expect(dynamicPackageSql).toContain("create table if not exists public.hai_point_packages");
    expect(dynamicPackageSql).toContain("description text not null default ''");
    expect(dynamicPackageSql).toContain("value_metrics text not null default ''");
    expect(dynamicPackageSql).toContain("is_recommended boolean not null default false");
    expect(dynamicPackageSql).toContain("constraint hai_point_packages_points_price_unique unique (points, price_cny)");
    expect(dynamicPackageSql).toContain("alter table public.hai_point_packages enable row level security");
    expect(dynamicPackageSql).toContain("grant select on table public.hai_point_packages to authenticated");
    expect(dynamicPackageSql).toContain("using ((select public.is_admin()))");
    expect(dynamicPackageSql).toContain("'约完成 90 次答疑'");
    expect(dynamicPackageSql).toContain("'point_packages', v_point_packages");
    expect(adminSource).toContain("最多保留 8 个套餐");
  });

  it("shows admin-only weighted billing controls while keeping Token conversion off user pages", () => {
    expect(adminSource).toContain("积分消耗规则（等价 Token）");
    expect(adminSource).toContain("每 1 积分对应的基准等价 Token");
    expect(adminSource).toContain("Flash 未缓存输入");
    expect(adminSource).toContain("Pro 输出");
    expect(adminSource).toContain("保存积分消耗规则");
    expect(adminSource).toContain('supabase.rpc("hai_admin_update_point_billing_config"');
    expect(adminSource).toContain("用户现有积分余额不变");
    expect(readFileSync(resolve(process.cwd(), "src/pages/HaiPointsPage.tsx"), "utf8")).not.toContain("Token /");
  });

  it("bills exact provider usage with Flash and Pro cache/input/output multipliers", () => {
    expect(weightedBillingSql).toContain("v_new_tokens_per_point integer := 1000");
    expect(weightedBillingSql).toContain("'points.flash_cache_hit_multiplier'");
    expect(weightedBillingSql).toContain("'points.flash_cache_miss_multiplier'");
    expect(weightedBillingSql).toContain("'points.flash_output_multiplier'");
    expect(weightedBillingSql).toContain("'points.pro_cache_hit_multiplier'");
    expect(weightedBillingSql).toContain("'points.pro_cache_miss_multiplier'");
    expect(weightedBillingSql).toContain("'points.pro_output_multiplier'");
    expect(weightedBillingSql).toContain("from public.hai_model_calls call");
    expect(weightedBillingSql).toContain("call.cache_hit_tokens");
    expect(weightedBillingSql).toContain("call.cache_miss_tokens");
    expect(weightedBillingSql).toContain("call.completion_tokens");
    expect(weightedBillingSql).toContain("'billing_source', v_billing_source");
  });

  it("reserves weighted points, preserves balances when the base changes and sends model metadata", () => {
    expect(weightedBillingSql).toContain("points_reserved_equivalent_tokens");
    expect(weightedBillingSql).toContain("'billing_multipliers', jsonb_build_object");
    expect(weightedBillingSql).toContain("create or replace function public.hai_admin_update_point_billing_config");
    expect(weightedBillingSql).toContain("balance_tokens::numeric * p_tokens_per_point / v_old_tokens_per_point");
    expect(weightedBillingSql).toContain("Permission denied: admin only");
    for (const source of edgeSources) {
      expect(source).toContain("model: completionOptions.model");
      expect(source).toContain("model_provider_id: module.model_provider_id");
    }
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

  it("grants different newcomer points for Plus and Pro", () => {
    expect(splitNewcomerSql).toContain("'points.newcomer_plus_points'");
    expect(splitNewcomerSql).toContain("to_jsonb(200::integer)");
    expect(splitNewcomerSql).toContain("'points.newcomer_pro_points'");
    expect(splitNewcomerSql).toContain("to_jsonb(500::integer)");
    expect(splitNewcomerSql).toContain("then 'points.newcomer_pro_points'");
    expect(splitNewcomerSql).toContain("then 500 else 200 end");
    expect(splitNewcomerSql).toContain("where key = 'points.newcomer_grant_points'");
    expect(adminSource).toContain("newcomerPlusGrantPoints");
    expect(adminSource).toContain("newcomerProGrantPoints");
    expect(adminSource).toContain("积分钱包列表");
    expect(adminSource).toContain("按最近更新排序，仅显示前 12 个");
  });

  it("sends exactly one notification for every positive point ledger entry", () => {
    expect(pointNotificationSql).toContain("create or replace function private.hai_notify_positive_point_transaction");
    expect(pointNotificationSql).toContain("after insert on public.hai_point_transactions");
    expect(pointNotificationSql).toContain("when (new.points_delta > 0)");
    expect(pointNotificationSql).toContain("new.transaction_type = 'newcomer_gift'");
    expect(pointNotificationSql).toContain("new.transaction_type = 'refund'");
    expect(pointNotificationSql).toContain("'HAI 积分到账'");
    expect(pointNotificationSql).toContain("insert into public.user_notifications");
    expect(pointNotificationSql.match(/insert into public\.user_notifications/g)).toHaveLength(1);
    expect(pointNotificationSql).toContain("revoke execute on function private.hai_notify_positive_point_transaction()");
    expect(adminSource).toContain("积分已增加并发送站内通知");
    expect(adminSource).toContain("每次增加成功后都会发送站内通知");
  });
});
