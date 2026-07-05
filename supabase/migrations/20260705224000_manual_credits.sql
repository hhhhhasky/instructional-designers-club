-- ============================================================
-- 教学设计师俱乐部 - 手动学分管理
-- 创建时间: 2025-07-05
-- 说明: profiles 增加 bonus_credits 列、credit_transactions 审计表、
--       更新已有 RPC、新增学分调整 RPC
-- ============================================================

-- ==================== 1. profiles 增加 bonus_credits ====================

ALTER TABLE "public"."profiles"
    ADD COLUMN IF NOT EXISTS "bonus_credits" numeric(8,1) NOT NULL DEFAULT 0;

COMMENT ON COLUMN "public"."profiles"."bonus_credits" IS '管理员手动奖励的学分（正数加分/负数扣分）';

-- ==================== 2. credit_transactions 审计表 ====================

CREATE TABLE IF NOT EXISTS "public"."credit_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "user_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "amount" numeric(8,1) NOT NULL,
    "reason" "text" NOT NULL DEFAULT '',
    "admin_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id"),
    "created_at" timestamp with time zone DEFAULT "now"()
);

COMMENT ON TABLE "public"."credit_transactions" IS '学分手动调整审计日志';
COMMENT ON COLUMN "public"."credit_transactions"."amount" IS '调整分数：正数加分，负数扣分';
COMMENT ON COLUMN "public"."credit_transactions"."reason" IS '管理员填写的调整原因';
COMMENT ON COLUMN "public"."credit_transactions"."admin_id" IS '执行调整的管理员 ID';

CREATE INDEX IF NOT EXISTS "idx_credit_transactions_user_id"
    ON "public"."credit_transactions" USING "btree" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_credit_transactions_created_at"
    ON "public"."credit_transactions" USING "btree" ("created_at" DESC);

-- RLS：仅管理员可读写
ALTER TABLE "public"."credit_transactions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access credit_transactions"
    ON "public"."credit_transactions" FOR ALL
    TO authenticated
    USING (public.is_admin());

-- ==================== 3. 更新 admin_student_list() ====================

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
      p.bonus_credits,
      MAX(lr.last_watched_at) AS last_active_at,
      COUNT(lr.id) FILTER (WHERE lr.status = 'completed')::int AS completed_courses,
      COUNT(lr.id) FILTER (WHERE lr.status = 'in_progress')::int AS in_progress_courses,
      COALESCE(
        SUM(c.credits) FILTER (WHERE lr.status = 'completed'),
        0
      )::numeric(8,1) + p.bonus_credits AS total_credits
    FROM profiles p
    LEFT JOIN learning_records lr ON lr.user_id = p.id
    LEFT JOIN courses c ON c.id = lr.course_id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  ) t;

  RETURN COALESCE(v_students, '[]'::json);
END;
$$;

COMMENT ON FUNCTION "public"."admin_student_list"()
  IS '管理后台：学员名单（含学习汇总、课程学分、奖励学分、总学分）';

GRANT EXECUTE ON FUNCTION "public"."admin_student_list"()
  TO authenticated;

-- ==================== 4. 更新 admin_student_leaderboard() ====================

CREATE OR REPLACE FUNCTION "public"."admin_student_leaderboard"()
RETURNS json
LANGUAGE "plpgsql"
SECURITY DEFINER
AS $$
DECLARE
  v_leaderboard json;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin only';
  END IF;

  SELECT json_agg(row_to_json(t)) INTO v_leaderboard
  FROM (
    SELECT
      p.id,
      p.nickname,
      p.phone,
      p.access_level,
      p.status,
      p.created_at,
      -- 学分: 课程学分 + 奖励学分
      COALESCE(
        SUM(c.credits) FILTER (WHERE lr.status = 'completed'),
        0
      )::numeric(8,1) + p.bonus_credits AS total_credits,
      -- 观看时长(估算): 课程时长 × 完成百分比，累计所有记录
      COALESCE(
        ROUND(SUM(c.duration::numeric * lr.progress / 100), 1),
        0
      )::numeric(10,1) AS estimated_watch_minutes,
      -- 课程完成度: 所有课程记录的平均 progress
      CASE
        WHEN COUNT(lr.id) > 0
        THEN ROUND(AVG(lr.progress), 1)
        ELSE 0
      END::numeric(5,1) AS avg_completion_rate
    FROM profiles p
    LEFT JOIN learning_records lr ON lr.user_id = p.id
    LEFT JOIN courses c ON c.id = lr.course_id
    GROUP BY p.id, p.nickname, p.phone, p.access_level, p.status, p.created_at
  ) t;

  RETURN COALESCE(v_leaderboard, '[]'::json);
END;
$$;

COMMENT ON FUNCTION "public"."admin_student_leaderboard"()
  IS '管理后台：学员排行榜（学分=课程学分+奖励学分 / 观看时长 / 完成度）';

GRANT EXECUTE ON FUNCTION "public"."admin_student_leaderboard"()
  TO authenticated;

-- ==================== 5. 新增 admin_adjust_bonus_credits() ====================

CREATE OR REPLACE FUNCTION "public"."admin_adjust_bonus_credits"(
    p_user_id uuid,
    p_amount numeric,
    p_reason text
)
RETURNS json
LANGUAGE "plpgsql"
SECURITY DEFINER
AS $$
DECLARE
  v_new_bonus numeric(8,1);
  v_total_credits numeric(8,1);
BEGIN
  -- 权限检查
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin only';
  END IF;

  -- 参数校验
  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION '调整分数不能为 0';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION '调整原因不能为空';
  END IF;

  -- 禁止修改自己
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot modify own credits';
  END IF;

  -- 更新 bonus_credits
  UPDATE public.profiles
  SET bonus_credits = bonus_credits + p_amount
  WHERE id = p_user_id
  RETURNING bonus_credits INTO v_new_bonus;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  -- 写入审计日志
  INSERT INTO public.credit_transactions (user_id, amount, reason, admin_id)
  VALUES (p_user_id, p_amount, trim(p_reason), auth.uid());

  -- 计算总学分（课程学分 + 奖励学分）
  SELECT COALESCE(
    SUM(c.credits) FILTER (WHERE lr.status = 'completed'),
    0
  )::numeric(8,1) + v_new_bonus INTO v_total_credits
  FROM learning_records lr
  LEFT JOIN courses c ON c.id = lr.course_id
  WHERE lr.user_id = p_user_id;

  RETURN json_build_object(
    'id', p_user_id,
    'bonus_credits', v_new_bonus,
    'total_credits', v_total_credits
  );
END;
$$;

COMMENT ON FUNCTION "public"."admin_adjust_bonus_credits"(uuid, numeric, text)
  IS '管理员手动调整学员奖励学分（正数加分/负数扣分），写入审计日志';

GRANT EXECUTE ON FUNCTION "public"."admin_adjust_bonus_credits"(uuid, numeric, text)
  TO authenticated;
