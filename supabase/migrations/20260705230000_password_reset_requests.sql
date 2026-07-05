-- ============================================================
-- 教学设计师俱乐部 - 忘记密码（管理员协助重置）
-- 创建时间: 2026-07-05
-- 说明: 用户在登录页点「忘记密码？」提交手机号，写入本表；
--       管理员在 /admin/manage 的「重置申请」Tab 审核并通过后，
--       由 admin-reset-password Edge Function 用 service role 生成临时密码重置。
-- 幂等说明: 使用 IF NOT EXISTS / IF NOT EXISTS 策略，可重复执行。
-- ============================================================

-- ==================== password_reset_requests：密码重置申请 ====================
CREATE TABLE IF NOT EXISTS "public"."password_reset_requests" (
    "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "phone"          character varying(20) NOT NULL,
    "user_id"        uuid,                          -- 批准时由 Edge Function 反查 profiles.id 回填
    "note"           text NOT NULL DEFAULT '',      -- 用户可选填的备注（昵称/入会时间，帮助管理员辨认身份）
    "status"         text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected')),
    "temp_password"  text,                          -- 批准后回填的临时密码，方便管理员二次查看
    "created_at"     timestamptz NOT NULL DEFAULT now(),
    "resolved_at"    timestamptz,                   -- 通过/拒绝的时间
    "resolved_by"    uuid                           -- 处理该申请的管理员 profiles.id
);

COMMENT ON TABLE "public"."password_reset_requests" IS '忘记密码重置申请：用户提交手机号，管理员审核通过后由 Edge Function 重置密码';
COMMENT ON COLUMN "public"."password_reset_requests"."phone" IS '申请重置的手机号';
COMMENT ON COLUMN "public"."password_reset_requests"."user_id" IS '批准时反查到的用户 profiles.id';
COMMENT ON COLUMN "public"."password_reset_requests"."note" IS '用户可选填的备注，帮助管理员辨认身份';
COMMENT ON COLUMN "public"."password_reset_requests"."status" IS '状态：pending(待处理) / approved(已通过) / rejected(已拒绝)';
COMMENT ON COLUMN "public"."password_reset_requests"."temp_password" IS '批准后生成的临时密码（明文），仅管理员可见，用于私信发给用户';
COMMENT ON COLUMN "public"."password_reset_requests"."resolved_by" IS '处理该申请的管理员 profiles.id';

CREATE INDEX IF NOT EXISTS "password_reset_requests_status_created_at_idx"
    ON "public"."password_reset_requests" (status, created_at DESC);

ALTER TABLE "public"."password_reset_requests" ENABLE ROW LEVEL SECURITY;

-- 任何人（含未登录用户）都可以提交重置申请 —— 忘记密码时往往登不上
DROP POLICY IF EXISTS "anyone insert password_reset_requests" ON "public"."password_reset_requests";
CREATE POLICY "anyone insert password_reset_requests"
    ON "public"."password_reset_requests" FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- 仅管理员可读 / 改；用户不能查看或篡改申请（含自己的，避免泄露临时密码处理状态）
DROP POLICY IF EXISTS "admin select password_reset_requests" ON "public"."password_reset_requests";
CREATE POLICY "admin select password_reset_requests"
    ON "public"."password_reset_requests" FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "admin update password_reset_requests" ON "public"."password_reset_requests";
CREATE POLICY "admin update password_reset_requests"
    ON "public"."password_reset_requests" FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
