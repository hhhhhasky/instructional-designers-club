-- ============================================================================
-- 课程分类表优化迁移
-- 目标：创建/优化 course_categories 表，自动填充 sort_order 字段
-- ============================================================================

-- ============================================================================
-- 第一部分：创建 course_categories 表（如果不存在）
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_categories (
  -- 主键
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 分类名称（唯一）
  name TEXT NOT NULL UNIQUE,
  
  -- 分类描述
  description TEXT,
  
  -- 显示顺序（核心字段）
  sort_order INTEGER NOT NULL DEFAULT 0,
  
  -- 是否启用
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 第二部分：创建索引以提升查询性能
-- ============================================================================

-- 分类名称索引（用于快速查找）
CREATE INDEX IF NOT EXISTS idx_course_categories_name 
ON course_categories(name);

-- 显示顺序索引（用于排序查询）
CREATE INDEX IF NOT EXISTS idx_course_categories_sort_order 
ON course_categories(sort_order);

-- 启用状态索引（用于筛选启用的分类）
CREATE INDEX IF NOT EXISTS idx_course_categories_is_active 
ON course_categories(is_active);

-- 复合索引：启用状态 + 显示顺序（用于前端分类列表查询）
CREATE INDEX IF NOT EXISTS idx_course_categories_active_sort 
ON course_categories(is_active, sort_order) 
WHERE is_active = TRUE;

-- ============================================================================
-- 第三部分：添加字段注释
-- ============================================================================

COMMENT ON TABLE course_categories IS '课程分类表（学习营分类）';
COMMENT ON COLUMN course_categories.id IS '分类唯一标识';
COMMENT ON COLUMN course_categories.name IS '分类名称（唯一）';
COMMENT ON COLUMN course_categories.description IS '分类描述';
COMMENT ON COLUMN course_categories.sort_order IS '显示顺序（数字越小越靠前）';
COMMENT ON COLUMN course_categories.is_active IS '是否启用（前端只显示启用的分类）';
COMMENT ON COLUMN course_categories.created_at IS '创建时间';
COMMENT ON COLUMN course_categories.updated_at IS '更新时间';

-- ============================================================================
-- 第四部分：创建触发器函数 - 自动更新 updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_course_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_course_categories_updated_at ON course_categories;
CREATE TRIGGER trigger_update_course_categories_updated_at
  BEFORE UPDATE ON course_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_course_categories_updated_at();

-- ============================================================================
-- 第五部分：从 courses 表提取现有分类并自动填充
-- ============================================================================

-- 从 courses 表中提取所有唯一的分类名称，并插入到 course_categories 表
-- 使用 ON CONFLICT DO NOTHING 避免重复插入
INSERT INTO course_categories (name, sort_order, is_active, created_at, updated_at)
SELECT DISTINCT
  category AS name,
  -- 自动填充 sort_order：按字母顺序排序
  ROW_NUMBER() OVER (ORDER BY category) AS sort_order,
  TRUE AS is_active,
  NOW() AS created_at,
  NOW() AS updated_at
FROM courses
WHERE 
  category IS NOT NULL 
  AND category != ''
  AND status = 'published'
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 第六部分：优化现有数据的 sort_order
-- ============================================================================

-- 如果 course_categories 表中已有数据但 sort_order 不连续或为0
-- 重新分配 sort_order（按字母顺序）
WITH ranked_categories AS (
  SELECT 
    id,
    name,
    ROW_NUMBER() OVER (ORDER BY name) AS new_sort_order
  FROM course_categories
  WHERE is_active = TRUE
)
UPDATE course_categories
SET sort_order = ranked_categories.new_sort_order
FROM ranked_categories
WHERE course_categories.id = ranked_categories.id;

-- ============================================================================
-- 第七部分：创建辅助函数 - 验证分类数据完整性
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_course_categories()
RETURNS TABLE(
  validation_type TEXT,
  category_name TEXT,
  issue_description TEXT
) AS $$
BEGIN
  -- 检查 courses 表中使用但未在 course_categories 中定义的分类
  RETURN QUERY
  SELECT 
    'missing_in_categories'::TEXT AS validation_type,
    c.category AS category_name,
    '课程使用了此分类，但 course_categories 表中未定义'::TEXT AS issue_description
  FROM (
    SELECT DISTINCT category
    FROM courses
    WHERE category IS NOT NULL AND category != '' AND status = 'published'
  ) c
  LEFT JOIN course_categories cc ON c.category = cc.name
  WHERE cc.name IS NULL;

  -- 检查 course_categories 表中定义但未在 courses 中使用的分类
  RETURN QUERY
  SELECT 
    'unused_category'::TEXT AS validation_type,
    cc.name AS category_name,
    '分类已定义但没有课程使用'::TEXT AS issue_description
  FROM course_categories cc
  LEFT JOIN (
    SELECT DISTINCT category
    FROM courses
    WHERE category IS NOT NULL AND category != '' AND status = 'published'
  ) c ON cc.name = c.category
  WHERE c.category IS NULL AND cc.is_active = TRUE;

  -- 检查 sort_order 重复的分类
  RETURN QUERY
  SELECT 
    'duplicate_sort_order'::TEXT AS validation_type,
    cc.name AS category_name,
    '多个分类使用了相同的 sort_order: ' || cc.sort_order::TEXT AS issue_description
  FROM course_categories cc
  WHERE cc.sort_order IN (
    SELECT sort_order
    FROM course_categories
    WHERE is_active = TRUE
    GROUP BY sort_order
    HAVING COUNT(*) > 1
  )
  AND cc.is_active = TRUE
  ORDER BY cc.sort_order, cc.name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_course_categories() IS '验证课程分类数据完整性，返回所有数据问题';

-- ============================================================================
-- 第八部分：创建辅助函数 - 自动修复分类数据
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_fix_course_categories()
RETURNS TABLE(
  action_type TEXT,
  category_name TEXT,
  action_description TEXT
) AS $$
BEGIN
  -- 1. 从 courses 表中提取缺失的分类并插入
  INSERT INTO course_categories (name, sort_order, is_active, created_at, updated_at)
  SELECT DISTINCT
    c.category AS name,
    (SELECT COALESCE(MAX(sort_order), 0) + ROW_NUMBER() OVER (ORDER BY c.category)
     FROM course_categories) AS sort_order,
    TRUE AS is_active,
    NOW() AS created_at,
    NOW() AS updated_at
  FROM (
    SELECT DISTINCT category
    FROM courses
    WHERE category IS NOT NULL AND category != '' AND status = 'published'
  ) c
  LEFT JOIN course_categories cc ON c.category = cc.name
  WHERE cc.name IS NULL
  ON CONFLICT (name) DO NOTHING
  RETURNING 
    'added_missing_category'::TEXT AS action_type,
    name AS category_name,
    '从 courses 表中提取并添加缺失的分类'::TEXT AS action_description;

  -- 2. 禁用未使用的分类（而不是删除）
  UPDATE course_categories cc
  SET is_active = FALSE, updated_at = NOW()
  WHERE cc.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM courses c
    WHERE c.category = cc.name AND c.status = 'published'
  )
  RETURNING 
    'disabled_unused_category'::TEXT AS action_type,
    name AS category_name,
    '禁用未使用的分类'::TEXT AS action_description;

  -- 3. 修复重复的 sort_order
  WITH ranked_categories AS (
    SELECT 
      id,
      name,
      ROW_NUMBER() OVER (ORDER BY sort_order, name) AS new_sort_order
    FROM course_categories
    WHERE is_active = TRUE
  )
  UPDATE course_categories cc
  SET sort_order = rc.new_sort_order, updated_at = NOW()
  FROM ranked_categories rc
  WHERE cc.id = rc.id AND cc.sort_order != rc.new_sort_order
  RETURNING 
    'fixed_sort_order'::TEXT AS action_type,
    cc.name AS category_name,
    '修复重复的 sort_order'::TEXT AS action_description;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_fix_course_categories() IS '自动修复课程分类数据问题';

-- ============================================================================
-- 第九部分：创建 RPC 函数 - 获取分类统计信息
-- ============================================================================

CREATE OR REPLACE FUNCTION get_category_stats()
RETURNS TABLE(
  category_name TEXT,
  course_count BIGINT,
  sort_order INTEGER,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cc.name AS category_name,
    COUNT(c.id) AS course_count,
    cc.sort_order,
    cc.is_active
  FROM course_categories cc
  LEFT JOIN courses c ON cc.name = c.category AND c.status = 'published'
  GROUP BY cc.id, cc.name, cc.sort_order, cc.is_active
  ORDER BY cc.sort_order, cc.name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_category_stats() IS '获取每个分类的课程数量统计';

-- ============================================================================
-- 第十部分：创建视图 - 分类与课程关联视图
-- ============================================================================

CREATE OR REPLACE VIEW v_category_course_mapping AS
SELECT 
  cc.id AS category_id,
  cc.name AS category_name,
  cc.sort_order AS category_sort_order,
  cc.is_active AS category_is_active,
  c.id AS course_id,
  c.title AS course_title,
  c.membership_type,
  c.sort_order AS course_sort_order,
  c.status AS course_status
FROM course_categories cc
LEFT JOIN courses c ON cc.name = c.category
ORDER BY cc.sort_order, c.sort_order;

COMMENT ON VIEW v_category_course_mapping IS '分类与课程关联视图，用于快速查询分类下的所有课程';

-- ============================================================================
-- 第十一部分：执行数据验证和自动修复
-- ============================================================================

-- 执行自动修复
DO $$
DECLARE
  fix_result RECORD;
BEGIN
  RAISE NOTICE '开始自动修复课程分类数据...';
  
  FOR fix_result IN SELECT * FROM auto_fix_course_categories()
  LOOP
    RAISE NOTICE '操作: % | 分类: % | 描述: %', 
      fix_result.action_type, 
      fix_result.category_name, 
      fix_result.action_description;
  END LOOP;
  
  RAISE NOTICE '自动修复完成！';
END $$;

-- 执行数据验证
DO $$
DECLARE
  validation_result RECORD;
  has_issues BOOLEAN := FALSE;
BEGIN
  RAISE NOTICE '开始验证课程分类数据...';
  
  FOR validation_result IN SELECT * FROM validate_course_categories()
  LOOP
    has_issues := TRUE;
    RAISE WARNING '问题类型: % | 分类: % | 描述: %', 
      validation_result.validation_type, 
      validation_result.category_name, 
      validation_result.issue_description;
  END LOOP;
  
  IF NOT has_issues THEN
    RAISE NOTICE '数据验证通过，没有发现问题！';
  ELSE
    RAISE NOTICE '数据验证完成，发现上述问题。';
  END IF;
END $$;

-- ============================================================================
-- 第十二部分：显示最终统计信息
-- ============================================================================

DO $$
DECLARE
  total_categories INTEGER;
  active_categories INTEGER;
  total_courses INTEGER;
BEGIN
  -- 统计分类数量
  SELECT COUNT(*) INTO total_categories FROM course_categories;
  SELECT COUNT(*) INTO active_categories FROM course_categories WHERE is_active = TRUE;
  
  -- 统计课程数量
  SELECT COUNT(*) INTO total_courses FROM courses WHERE status = 'published';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '课程分类表优化完成！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '总分类数: %', total_categories;
  RAISE NOTICE '启用分类数: %', active_categories;
  RAISE NOTICE '已发布课程数: %', total_courses;
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- 使用说明
-- ============================================================================

-- 1. 查询所有分类及其课程数量：
--    SELECT * FROM get_category_stats();

-- 2. 验证分类数据完整性：
--    SELECT * FROM validate_course_categories();

-- 3. 自动修复分类数据问题：
--    SELECT * FROM auto_fix_course_categories();

-- 4. 查询分类与课程关联：
--    SELECT * FROM v_category_course_mapping WHERE category_is_active = TRUE;

-- 5. 手动调整某个分类的显示顺序：
--    UPDATE course_categories SET sort_order = 1 WHERE name = '建构主义学习营';

-- 6. 禁用某个分类：
--    UPDATE course_categories SET is_active = FALSE WHERE name = '旧分类';

-- 7. 重新排序所有分类（按字母顺序）：
--    WITH ranked AS (
--      SELECT id, ROW_NUMBER() OVER (ORDER BY name) AS new_order
--      FROM course_categories WHERE is_active = TRUE
--    )
--    UPDATE course_categories SET sort_order = ranked.new_order
--    FROM ranked WHERE course_categories.id = ranked.id;
