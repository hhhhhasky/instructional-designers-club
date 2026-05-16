/*
# 创建访问统计表

## 1. 新建表
- `visitor_stats`
  - `id` (bigserial, 主键)
  - `visitor_uuid` (uuid, 唯一, 非空) - 访问者唯一标识
  - `visit_count` (integer, 默认1, 非空) - 访问次数
  - `first_visit_at` (timestamptz, 默认now(), 非空) - 首次访问时间
  - `last_visit_at` (timestamptz, 默认now(), 非空) - 最后访问时间

## 2. 安全策略
- 不启用RLS，允许所有人读取统计数据
- 通过RPC函数控制写入权限

## 3. RPC函数
- `record_visit(p_visitor_uuid uuid)` - 记录访问并返回统计数据
  - 如果访问者已存在，增加访问次数并更新最后访问时间
  - 如果访问者不存在，创建新记录
  - 返回总访问人数和总访问次数

## 4. 索引
- 在visitor_uuid上创建唯一索引，提升查询性能
*/

-- 创建访问统计表
CREATE TABLE IF NOT EXISTS visitor_stats (
  id bigserial PRIMARY KEY,
  visitor_uuid uuid UNIQUE NOT NULL,
  visit_count integer DEFAULT 1 NOT NULL,
  first_visit_at timestamptz DEFAULT now() NOT NULL,
  last_visit_at timestamptz DEFAULT now() NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_visitor_stats_uuid ON visitor_stats(visitor_uuid);

-- 创建RPC函数：记录访问并返回统计数据
CREATE OR REPLACE FUNCTION record_visit(p_visitor_uuid uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_unique_visitors integer;
  v_total_visits bigint;
BEGIN
  -- 插入或更新访问记录
  INSERT INTO visitor_stats (visitor_uuid, visit_count, first_visit_at, last_visit_at)
  VALUES (p_visitor_uuid, 1, now(), now())
  ON CONFLICT (visitor_uuid) 
  DO UPDATE SET 
    visit_count = visitor_stats.visit_count + 1,
    last_visit_at = now();
  
  -- 计算统计数据
  SELECT 
    COUNT(DISTINCT visitor_uuid)::integer,
    SUM(visit_count)::bigint
  INTO v_unique_visitors, v_total_visits
  FROM visitor_stats;
  
  -- 返回统计数据
  RETURN json_build_object(
    'unique_visitors', v_unique_visitors,
    'total_visits', v_total_visits
  );
END;
$$;
