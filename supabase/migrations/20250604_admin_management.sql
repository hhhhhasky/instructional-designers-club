-- ============================================================
-- 教学设计师俱乐部 - 管理后台数据操作迁移
-- 创建时间: 2025-06-04
-- 说明: 课程表管理 RLS 策略、用户等级修改 RPC、课程管理 RPC
-- ============================================================

-- ==================== 1. 课程表管理 RLS 策略 ====================

-- 管理员可插入课程
CREATE POLICY "Admin can insert courses"
    ON "public"."courses" FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

-- 管理员可更新课程
CREATE POLICY "Admin can update courses"
    ON "public"."courses" FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 管理员可删除课程（优先使用归档，保留此处备用）
CREATE POLICY "Admin can delete courses"
    ON "public"."courses" FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ==================== 2. 管理员修改用户等级 ====================

CREATE OR REPLACE FUNCTION "public"."admin_update_user_access_level"(
    p_user_id uuid,
    p_new_level text
)
RETURNS void
LANGUAGE "plpgsql"
SECURITY DEFINER
AS $$
BEGIN
    -- 权限检查
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Permission denied: admin only';
    END IF;

    -- 参数校验
    IF p_new_level NOT IN ('free', 'plus', 'pro') THEN
        RAISE EXCEPTION 'Invalid access_level: %', p_new_level;
    END IF;

    -- 禁止修改自己的等级
    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot modify own access level';
    END IF;

    UPDATE public.profiles
    SET access_level = p_new_level::public.access_level
    WHERE id = p_user_id;
END;
$$;

COMMENT ON FUNCTION "public"."admin_update_user_access_level"(uuid, text)
  IS '管理员修改用户等级（free/plus/pro），禁止修改自己';

GRANT EXECUTE ON FUNCTION "public"."admin_update_user_access_level"(uuid, text)
  TO authenticated;

-- ==================== 3. 管理员获取所有课程 ====================

CREATE OR REPLACE FUNCTION "public"."admin_course_list"()
RETURNS json
LANGUAGE "plpgsql"
SECURITY DEFINER
AS $$
DECLARE
    v_courses json;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Permission denied: admin only';
    END IF;

    SELECT json_agg(row_to_json(t)) INTO v_courses
    FROM (
        SELECT c.*, cc.name AS category_name
        FROM courses c
        LEFT JOIN course_categories cc ON cc.id = c.category_id
        ORDER BY c.sort_order ASC NULLS LAST, c.created_at DESC
    ) t;

    RETURN COALESCE(v_courses, '[]'::json);
END;
$$;

COMMENT ON FUNCTION "public"."admin_course_list"() IS '管理员获取所有课程（含草稿和已归档）';

GRANT EXECUTE ON FUNCTION "public"."admin_course_list"() TO authenticated;
