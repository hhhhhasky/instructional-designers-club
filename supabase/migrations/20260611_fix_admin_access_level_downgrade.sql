-- ============================================================
-- 教学设计师俱乐部 - 修复管理后台会员等级降级
-- 创建时间: 2026-06-11
-- 说明: 重建管理员修改用户等级 RPC，返回落库后的等级，避免降级写入无反馈。
-- ============================================================

DROP FUNCTION IF EXISTS "public"."admin_update_user_access_level"(uuid, text);

CREATE OR REPLACE FUNCTION "public"."admin_update_user_access_level"(
    p_user_id uuid,
    p_new_level text
)
RETURNS json
LANGUAGE "plpgsql"
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Permission denied: admin only';
    END IF;

    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Missing user id';
    END IF;

    IF p_new_level NOT IN ('free', 'plus', 'pro') THEN
        RAISE EXCEPTION 'Invalid access_level: %', p_new_level;
    END IF;

    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot modify own access level';
    END IF;

    UPDATE public.profiles
    SET access_level = p_new_level::public.access_level,
        updated_at = now()
    WHERE id = p_user_id
    RETURNING * INTO v_profile;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found: %', p_user_id;
    END IF;

    RETURN json_build_object(
        'id', v_profile.id,
        'access_level', v_profile.access_level,
        'status', v_profile.status,
        'updated_at', v_profile.updated_at
    );
END;
$$;

COMMENT ON FUNCTION "public"."admin_update_user_access_level"(uuid, text)
  IS '管理员修改用户等级（free/plus/pro），禁止修改自己，并返回更新后的资料摘要';

GRANT EXECUTE ON FUNCTION "public"."admin_update_user_access_level"(uuid, text)
  TO authenticated;
