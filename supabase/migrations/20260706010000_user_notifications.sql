-- ============================================================
-- 教学设计师俱乐部 - 站内通知系统
-- 创建时间: 2025-07-06
-- 说明: user_notifications 表、通知查询/已读 RPC、
--       管理操作 RPC 追加通知写入逻辑
-- ============================================================

-- ==================== 1. user_notifications 表 ====================

CREATE TABLE IF NOT EXISTS "public"."user_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "user_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL DEFAULT '',
    "link" "text",
    "is_read" boolean NOT NULL DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);

COMMENT ON TABLE "public"."user_notifications" IS '用户个人通知（管理员操作触发）';
COMMENT ON COLUMN "public"."user_notifications"."type" IS '通知类型: credit_reward | credit_deduct | level_change | banned | unbanned';
COMMENT ON COLUMN "public"."user_notifications"."title" IS '通知标题';
COMMENT ON COLUMN "public"."user_notifications"."body" IS '通知正文';
COMMENT ON COLUMN "public"."user_notifications"."link" IS '可选跳转链接';

CREATE INDEX IF NOT EXISTS "idx_user_notifications_user_id"
    ON "public"."user_notifications" USING "btree" ("user_id", "is_read", "created_at" DESC);

-- RLS：用户可读自己的通知
ALTER TABLE "public"."user_notifications" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
    ON "public"."user_notifications" FOR SELECT
    TO authenticated
    USING ("user_id" = "auth"."uid"());

CREATE POLICY "Users can update own notifications"
    ON "public"."user_notifications" FOR UPDATE
    TO authenticated
    USING ("user_id" = "auth"."uid"());

-- ==================== 2. 获取我的通知 ====================

CREATE OR REPLACE FUNCTION "public"."get_my_notifications"()
RETURNS json
LANGUAGE "plpgsql"
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO v_result
  FROM (
    SELECT id, type, title, body, link, is_read, created_at
    FROM user_notifications
    WHERE user_id = auth.uid()
    ORDER BY is_read ASC, created_at DESC
    LIMIT 30
  ) t;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

COMMENT ON FUNCTION "public"."get_my_notifications"()
  IS '当前用户获取自己的通知（最近30条，未读优先）';

GRANT EXECUTE ON FUNCTION "public"."get_my_notifications"()
  TO authenticated;

-- ==================== 3. 批量标记已读 ====================

CREATE OR REPLACE FUNCTION "public"."mark_notifications_read"(
    p_ids uuid[]
)
RETURNS void
LANGUAGE "plpgsql"
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_notifications
  SET is_read = true
  WHERE user_id = auth.uid() AND id = ANY(p_ids);
END;
$$;

COMMENT ON FUNCTION "public"."mark_notifications_read"(uuid[])
  IS '批量标记通知为已读';

GRANT EXECUTE ON FUNCTION "public"."mark_notifications_read"(uuid[])
  TO authenticated;

-- ==================== 4. 获取未读数量 ====================

CREATE OR REPLACE FUNCTION "public"."get_unread_notification_count"()
RETURNS integer
LANGUAGE "plpgsql"
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM user_notifications
  WHERE user_id = auth.uid() AND is_read = false;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION "public"."get_unread_notification_count"()
  IS '获取当前用户未读通知数量';

GRANT EXECUTE ON FUNCTION "public"."get_unread_notification_count"()
  TO authenticated;

-- ==================== 5. 修改 admin_adjust_bonus_credits（加通知写入） ====================

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

  -- 写入通知
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
  IS '管理员手动调整学员奖励学分（正数加分/负数扣分），写入审计日志和用户通知';

GRANT EXECUTE ON FUNCTION "public"."admin_adjust_bonus_credits"(uuid, numeric, text)
  TO authenticated;

-- ==================== 6. 修改 admin_update_user_access_level（加通知写入 + 修复返回值） ====================

CREATE OR REPLACE FUNCTION "public"."admin_update_user_access_level"(
    p_user_id uuid,
    p_new_level text
)
RETURNS json
LANGUAGE "plpgsql"
SECURITY DEFINER
AS $$
DECLARE
  v_old_level text;
  v_title text;
  v_body text;
  v_result json;
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

  -- 获取旧等级
  SELECT access_level::text INTO v_old_level
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  -- 更新等级
  UPDATE public.profiles
  SET access_level = p_new_level::public.access_level
  WHERE id = p_user_id;

  -- 写入通知
  IF p_new_level = 'banned' OR (p_new_level = 'free' AND v_old_level = 'banned') THEN
    -- 这些情况暂不处理，未来可扩展
    NULL;
  ELSIF p_new_level = 'free' AND v_old_level IN ('plus', 'pro') THEN
    v_title := '你的会员等级已变更';
    v_body := '你的等级已从 ' || upper(v_old_level) || ' 调整为 Free';
  ELSE
    v_title := '你的会员等级已升级';
    v_body := '你的等级已从 ' || upper(v_old_level) || ' 升级为 ' || upper(p_new_level);
  END IF;

  IF v_title IS NOT NULL THEN
    INSERT INTO public.user_notifications (user_id, type, title, body, link)
    VALUES (p_user_id, 'level_change', v_title, v_body, '/learning');
  END IF;

  -- 返回结果
  SELECT json_build_object(
    'id', p_user_id,
    'access_level', p_new_level
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION "public"."admin_update_user_access_level"(uuid, text)
  IS '管理员修改用户等级（free/plus/pro），禁止修改自己，写入用户通知';

GRANT EXECUTE ON FUNCTION "public"."admin_update_user_access_level"(uuid, text)
  TO authenticated;
