-- ============================================================
-- 教学设计师俱乐部 - 持久化学员总学分
-- 创建时间: 2026-07-06
-- 说明: profiles.total_credits 保存「完课课程学分 + 奖励学分」，
--       由数据库函数和触发器统一维护，前端直接读取该字段。
-- ============================================================

-- ==================== 1. profiles 增加 total_credits ====================

ALTER TABLE "public"."profiles"
    ADD COLUMN IF NOT EXISTS "total_credits" numeric(8,1) NOT NULL DEFAULT 0;

COMMENT ON COLUMN "public"."profiles"."total_credits" IS '用户总学分：已完成课程学分 + 管理员奖励/扣减学分';

-- ==================== 2. 总学分计算与刷新函数 ====================

CREATE OR REPLACE FUNCTION "public"."calculate_user_total_credits"(
    p_user_id uuid,
    p_bonus_credits numeric DEFAULT NULL
)
RETURNS numeric
LANGUAGE "plpgsql"
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bonus numeric(8,1);
  v_course_credits numeric(8,1);
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  IF p_bonus_credits IS NULL THEN
    SELECT COALESCE(bonus_credits, 0)
    INTO v_bonus
    FROM public.profiles
    WHERE id = p_user_id;
  ELSE
    v_bonus := p_bonus_credits;
  END IF;

  SELECT COALESCE(
    SUM(COALESCE(c.credits, 0)) FILTER (WHERE lr.status = 'completed'),
    0
  )::numeric(8,1)
  INTO v_course_credits
  FROM public.learning_records lr
  LEFT JOIN public.courses c ON c.id = lr.course_id
  WHERE lr.user_id = p_user_id;

  RETURN (COALESCE(v_course_credits, 0) + COALESCE(v_bonus, 0))::numeric(8,1);
END;
$$;

COMMENT ON FUNCTION "public"."calculate_user_total_credits"(uuid, numeric)
  IS '计算用户总学分：已完成课程学分 + 奖励/扣减学分';

CREATE OR REPLACE FUNCTION "public"."refresh_user_total_credits"(p_user_id uuid)
RETURNS numeric
LANGUAGE "plpgsql"
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric(8,1);
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  v_total := public.calculate_user_total_credits(p_user_id);

  UPDATE public.profiles
  SET total_credits = v_total
  WHERE id = p_user_id
    AND total_credits IS DISTINCT FROM v_total;

  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION "public"."refresh_user_total_credits"(uuid)
  IS '刷新并保存 profiles.total_credits';

REVOKE EXECUTE ON FUNCTION "public"."calculate_user_total_credits"(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION "public"."refresh_user_total_credits"(uuid) FROM PUBLIC, anon, authenticated;

-- ==================== 3. 触发器：奖励分、学习记录、课程学分变化后自动维护 ====================

CREATE OR REPLACE FUNCTION "public"."set_profile_total_credits_from_bonus"()
RETURNS trigger
LANGUAGE "plpgsql"
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.total_credits := public.calculate_user_total_credits(NEW.id, NEW.bonus_credits);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "set_profile_total_credits_from_bonus_trigger" ON "public"."profiles";
CREATE TRIGGER "set_profile_total_credits_from_bonus_trigger"
  BEFORE INSERT OR UPDATE OF bonus_credits ON "public"."profiles"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."set_profile_total_credits_from_bonus"();

CREATE OR REPLACE FUNCTION "public"."refresh_total_credits_from_learning_record"()
RETURNS trigger
LANGUAGE "plpgsql"
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_user_total_credits(OLD.user_id);
    RETURN OLD;
  END IF;

  PERFORM public.refresh_user_total_credits(NEW.user_id);

  IF TG_OP = 'UPDATE' AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    PERFORM public.refresh_user_total_credits(OLD.user_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "refresh_total_credits_from_learning_record_trigger" ON "public"."learning_records";
CREATE TRIGGER "refresh_total_credits_from_learning_record_trigger"
  AFTER INSERT OR DELETE OR UPDATE OF user_id, course_id, status, progress ON "public"."learning_records"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."refresh_total_credits_from_learning_record"();

CREATE OR REPLACE FUNCTION "public"."refresh_total_credits_from_course_credit"()
RETURNS trigger
LANGUAGE "plpgsql"
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF OLD.credits IS NOT DISTINCT FROM NEW.credits THEN
    RETURN NEW;
  END IF;

  FOR v_user_id IN
    SELECT DISTINCT lr.user_id
    FROM public.learning_records lr
    WHERE lr.course_id = NEW.id
      AND lr.status = 'completed'
  LOOP
    PERFORM public.refresh_user_total_credits(v_user_id);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "refresh_total_credits_from_course_credit_trigger" ON "public"."courses";
CREATE TRIGGER "refresh_total_credits_from_course_credit_trigger"
  AFTER UPDATE OF credits ON "public"."courses"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."refresh_total_credits_from_course_credit"();

-- ==================== 4. 回填历史用户总学分 ====================

UPDATE public.profiles p
SET total_credits = public.calculate_user_total_credits(p.id)
WHERE p.total_credits IS DISTINCT FROM public.calculate_user_total_credits(p.id);

-- ==================== 5. 后台 RPC 改为读取 profiles.total_credits ====================

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
      p.total_credits,
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

COMMENT ON FUNCTION "public"."admin_student_list"()
  IS '管理后台：学员名单（读取 profiles.total_credits 持久化总学分）';

GRANT EXECUTE ON FUNCTION "public"."admin_student_list"()
  TO authenticated;

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
      p.total_credits,
      COALESCE(
        ROUND(SUM(c.duration::numeric * lr.progress / 100), 1),
        0
      )::numeric(10,1) AS estimated_watch_minutes,
      CASE
        WHEN COUNT(lr.id) > 0
        THEN ROUND(AVG(lr.progress), 1)
        ELSE 0
      END::numeric(5,1) AS avg_completion_rate
    FROM profiles p
    LEFT JOIN learning_records lr ON lr.user_id = p.id
    LEFT JOIN courses c ON c.id = lr.course_id
    GROUP BY p.id
  ) t;

  RETURN COALESCE(v_leaderboard, '[]'::json);
END;
$$;

COMMENT ON FUNCTION "public"."admin_student_leaderboard"()
  IS '管理后台：学员排行榜（学分读取 profiles.total_credits）';

GRANT EXECUTE ON FUNCTION "public"."admin_student_leaderboard"()
  TO authenticated;

-- 保留通知逻辑，同时让返回值直接来自 profiles.total_credits。
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
  v_amount_str text;
  v_title text;
  v_type text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin only';
  END IF;

  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION '调整分数不能为 0';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION '调整原因不能为空';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot modify own credits';
  END IF;

  UPDATE public.profiles
  SET bonus_credits = bonus_credits + p_amount
  WHERE id = p_user_id
  RETURNING bonus_credits, total_credits INTO v_new_bonus, v_total_credits;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  INSERT INTO public.credit_transactions (user_id, amount, reason, admin_id)
  VALUES (p_user_id, p_amount, trim(p_reason), auth.uid());

  IF p_amount > 0 THEN
    v_amount_str := '+' || p_amount::text;
    v_title := '管理员奖励了你 ' || v_amount_str || ' 学分';
    v_type := 'credit_reward';
  ELSE
    v_amount_str := p_amount::text;
    v_title := '管理员扣减了你 ' || v_amount_str || ' 学分';
    v_type := 'credit_deduct';
  END IF;

  INSERT INTO public.user_notifications (user_id, type, title, body, link)
  VALUES (
    p_user_id,
    v_type,
    v_title,
    '理由：' || trim(p_reason),
    '/learning'
  );

  RETURN json_build_object(
    'id', p_user_id,
    'bonus_credits', v_new_bonus,
    'total_credits', v_total_credits
  );
END;
$$;

COMMENT ON FUNCTION "public"."admin_adjust_bonus_credits"(uuid, numeric, text)
  IS '管理员手动调整学员奖励学分（正数加分/负数扣分），写入审计日志和用户通知，并返回持久化总学分';

GRANT EXECUTE ON FUNCTION "public"."admin_adjust_bonus_credits"(uuid, numeric, text)
  TO authenticated;
