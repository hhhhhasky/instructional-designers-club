-- ============================================================
-- 教学设计师俱乐部 - 学员排行榜 RPC 函数
-- 创建时间: 2025-06-03
-- 说明: 返回所有学员及其排名指标（学分/观看时长/完成度），
--       前端按等级筛选和排序维度在客户端完成
-- ============================================================

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
      -- 学分: 仅已完成课程的学分之和
      COALESCE(
        SUM(c.credits) FILTER (WHERE lr.status = 'completed'),
        0
      )::numeric(8,1) AS total_credits,
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
  IS '管理后台：学员排行榜（学分/观看时长/完成度）';

GRANT EXECUTE ON FUNCTION "public"."admin_student_leaderboard"()
  TO authenticated;
