-- 清理未使用的数据库表和相关对象
-- 执行前请确保已备份重要数据

-- ============================================
-- 第一步：删除触发器
-- ============================================

-- 删除 course_chapters 相关触发器
DROP TRIGGER IF EXISTS update_course_chapters_updated_at ON course_chapters;

-- 删除 course_details 相关触发器
DROP TRIGGER IF EXISTS log_course_details_changes ON course_details;
DROP TRIGGER IF EXISTS update_course_details_updated_at ON course_details;

-- 删除 course_resources 相关触发器
DROP TRIGGER IF EXISTS update_course_resources_updated_at ON course_resources;

-- ============================================
-- 第二步：删除函数
-- ============================================

-- 删除与未使用表相关的函数
DROP FUNCTION IF EXISTS log_course_changes() CASCADE;
DROP FUNCTION IF EXISTS rollback_course_version(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS update_course_with_version(uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS create_course_with_details(jsonb, jsonb) CASCADE;
DROP FUNCTION IF EXISTS get_course_full_info(uuid) CASCADE;

-- ============================================
-- 第三步：删除表
-- ============================================

-- 删除未使用的表（按依赖关系顺序）
DROP TABLE IF EXISTS course_chapters CASCADE;
DROP TABLE IF EXISTS course_details CASCADE;
DROP TABLE IF EXISTS course_logs CASCADE;
DROP TABLE IF EXISTS course_resources CASCADE;
DROP TABLE IF EXISTS course_versions CASCADE;
DROP TABLE IF EXISTS operation_logs CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================
-- 第四步：清理孤立的索引（如果有）
-- ============================================

-- 查找并删除孤立的索引（可选）
-- 这些索引可能在删除表时已自动删除，此步骤用于确保清理完整

-- ============================================
-- 验证清理结果
-- ============================================

-- 查看剩余的表
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 查看剩余的函数
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- 查看剩余的触发器
SELECT 
  trigger_name,
  event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
