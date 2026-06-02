-- ============================================================
-- 教学设计师俱乐部 - 管理后台迁移
-- 创建时间: 2025-06-02
-- 说明: 补充 learning_records 管理员 RLS 策略，
--       创建管理后台所需的聚合 RPC 函数和索引
-- ============================================================

-- ==================== 0. profiles 表增加 role 字段 ====================
-- 注：user_role 枚举已存在（admin/editor/viewer），此处追加 member 值

ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'member';

ALTER TABLE "public"."profiles"
    ADD COLUMN IF NOT EXISTS "role" "public"."user_role" NOT NULL DEFAULT 'member';

COMMENT ON COLUMN "public"."profiles"."role" IS '角色：member(普通用户) / admin(管理员)';

CREATE INDEX IF NOT EXISTS "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");

-- 更新 is_admin() 函数：改查 role = 'admin'（而非 access_level = 'pro'）
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

COMMENT ON FUNCTION "public"."is_admin"() IS '判断当前用户是否为管理员（role=admin）';

-- ==================== 1. RLS 策略补充 ====================

-- learning_records: 管理员可查看所有记录
CREATE POLICY "Admin can view all learning_records"
    ON "public"."learning_records" FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- ==================== 2. 管理后台 RPC 函数 ====================

-- 2.1 会员总览：总数 + 等级分布 + 月度增长
CREATE OR REPLACE FUNCTION "public"."admin_member_overview"()
RETURNS json
LANGUAGE "plpgsql"
SECURITY DEFINER
AS $$
DECLARE
  v_total bigint;
  v_distribution json;
  v_monthly_growth json;
BEGIN
  -- 仅管理员可调用
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin only';
  END IF;

  SELECT COUNT(*) INTO v_total FROM profiles;

  SELECT json_agg(row_to_json(t)) INTO v_distribution
  FROM (
    SELECT access_level, COUNT(*)::int AS count
    FROM profiles
    GROUP BY access_level
    ORDER BY access_level
  ) t;

  SELECT json_agg(row_to_json(t)) INTO v_monthly_growth
  FROM (
    SELECT
      TO_CHAR(created_at, 'YYYY-MM') AS month,
      COUNT(*)::int AS new_members
    FROM profiles
    WHERE created_at >= NOW() - INTERVAL '12 months'
    GROUP BY TO_CHAR(created_at, 'YYYY-MM')
    ORDER BY month
  ) t;

  RETURN json_build_object(
    'total', v_total,
    'distribution', COALESCE(v_distribution, '[]'::json),
    'monthly_growth', COALESCE(v_monthly_growth, '[]'::json)
  );
END;
$$;

COMMENT ON FUNCTION "public"."admin_member_overview"() IS '管理后台：会员总览统计';

GRANT EXECUTE ON FUNCTION "public"."admin_member_overview"() TO authenticated;

-- 2.2 课程排行：观看数 + 学习人数 + 完课率
CREATE OR REPLACE FUNCTION "public"."admin_course_rankings"()
RETURNS json
LANGUAGE "plpgsql"
SECURITY DEFINER
AS $$
DECLARE
  v_rankings json;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin only';
  END IF;

  SELECT json_agg(row_to_json(t)) INTO v_rankings
  FROM (
    SELECT
      c.id,
      c.title,
      c.category,
      c.level,
      c.membership_type,
      COALESCE(c.view_count, 0) AS view_count,
      COUNT(lr.id)::int AS total_learners,
      COUNT(lr.id) FILTER (WHERE lr.status = 'completed')::int AS completed_learners,
      COUNT(lr.id) FILTER (WHERE lr.status = 'in_progress')::int AS active_learners,
      CASE
        WHEN COUNT(lr.id) > 0
        THEN ROUND(
          COUNT(lr.id) FILTER (WHERE lr.status = 'completed')::numeric
          / COUNT(lr.id)::numeric * 100, 1
        )
        ELSE 0
      END AS completion_rate
    FROM courses c
    LEFT JOIN learning_records lr ON lr.course_id = c.id
    WHERE c.status = 'published'
    GROUP BY c.id
    ORDER BY COALESCE(c.view_count, 0) DESC
  ) t;

  RETURN COALESCE(v_rankings, '[]'::json);
END;
$$;

COMMENT ON FUNCTION "public"."admin_course_rankings"() IS '管理后台：课程排行统计';

GRANT EXECUTE ON FUNCTION "public"."admin_course_rankings"() TO authenticated;

-- 2.3 学员名单：带学习汇总
CREATE OR REPLACE FUNCTION "public"."admin_student_list"()
RETURNS json
LANGUAGE "plpgsql"
SECURITY DEFINER
AS $$
DECLARE
  v_students json;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin only';
  END IF;

  SELECT json_agg(row_to_json(t)) INTO v_students
  FROM (
    SELECT
      p.id,
      p.nickname,
      p.phone,
      p.access_level,
      p.status,
      p.created_at,
      MAX(lr.last_watched_at) AS last_active_at,
      COUNT(lr.id) FILTER (WHERE lr.status = 'completed')::int AS completed_courses,
      COUNT(lr.id) FILTER (WHERE lr.status = 'in_progress')::int AS in_progress_courses
    FROM profiles p
    LEFT JOIN learning_records lr ON lr.user_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  ) t;

  RETURN COALESCE(v_students, '[]'::json);
END;
$$;

COMMENT ON FUNCTION "public"."admin_student_list"() IS '管理后台：学员名单（带学习汇总）';

GRANT EXECUTE ON FUNCTION "public"."admin_student_list"() TO authenticated;

-- 2.4 沉默学员统计：零记录 + 不活跃阈值
CREATE OR REPLACE FUNCTION "public"."admin_inactive_students"()
RETURNS json
LANGUAGE "plpgsql"
SECURITY DEFINER
AS $$
DECLARE
  v_zero_record json;
  v_inactive_counts json;
  v_total int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin only';
  END IF;

  SELECT COUNT(*)::int INTO v_total FROM profiles;

  -- 零学习记录的学员
  SELECT json_agg(row_to_json(t)) INTO v_zero_record
  FROM (
    SELECT p.id, p.nickname, p.phone, p.access_level, p.created_at
    FROM profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM learning_records lr WHERE lr.user_id = p.id
    )
    ORDER BY p.created_at DESC
  ) t;

  -- 各不活跃阈值的人数
  SELECT json_agg(row_to_json(t)) INTO v_inactive_counts
  FROM (
    SELECT '30' AS days_threshold, COUNT(*)::int AS count
    FROM profiles p
    WHERE EXISTS (SELECT 1 FROM learning_records lr WHERE lr.user_id = p.id)
      AND NOT EXISTS (
        SELECT 1 FROM learning_records lr
        WHERE lr.user_id = p.id AND lr.last_watched_at >= NOW() - INTERVAL '30 days'
      )
    UNION ALL
    SELECT '60', COUNT(*)::int
    FROM profiles p
    WHERE EXISTS (SELECT 1 FROM learning_records lr WHERE lr.user_id = p.id)
      AND NOT EXISTS (
        SELECT 1 FROM learning_records lr
        WHERE lr.user_id = p.id AND lr.last_watched_at >= NOW() - INTERVAL '60 days'
      )
    UNION ALL
    SELECT '90', COUNT(*)::int
    FROM profiles p
    WHERE EXISTS (SELECT 1 FROM learning_records lr WHERE lr.user_id = p.id)
      AND NOT EXISTS (
        SELECT 1 FROM learning_records lr
        WHERE lr.user_id = p.id AND lr.last_watched_at >= NOW() - INTERVAL '90 days'
      )
  ) t;

  RETURN json_build_object(
    'zero_record_students', COALESCE(v_zero_record, '[]'::json),
    'inactive_counts', COALESCE(v_inactive_counts, '[]'::json),
    'total_members', v_total
  );
END;
$$;

COMMENT ON FUNCTION "public"."admin_inactive_students"() IS '管理后台：沉默学员统计';

GRANT EXECUTE ON FUNCTION "public"."admin_inactive_students"() TO authenticated;

-- ==================== 3. 补充索引 ====================

CREATE INDEX IF NOT EXISTS "idx_learning_records_status"
    ON "public"."learning_records" USING "btree" ("status");

CREATE INDEX IF NOT EXISTS "idx_learning_records_last_watched"
    ON "public"."learning_records" USING "btree" ("last_watched_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_profiles_created_at"
    ON "public"."profiles" USING "btree" ("created_at" DESC);
