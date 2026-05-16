-- 009_merge_tags_to_categories.sql
-- 将 course_series_tags 表的数据合并到 course_categories 表中

-- ============================================================================
-- 步骤 1: 在 course_categories 表中添加新字段
-- ============================================================================

ALTER TABLE course_categories
ADD COLUMN IF NOT EXISTS applicable_audience TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS applicable_scenarios TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS content_types TEXT[] DEFAULT '{}';

COMMENT ON COLUMN course_categories.applicable_audience IS '适用人群（数组）';
COMMENT ON COLUMN course_categories.applicable_scenarios IS '适用场景（数组）';
COMMENT ON COLUMN course_categories.content_types IS '内容类型（数组）';

-- ============================================================================
-- 步骤 2: 迁移数据 - 从 course_series_tags 提取数据到 course_categories
-- ============================================================================

-- 更新适用人群
UPDATE course_categories cc
SET applicable_audience = (
  SELECT array_agg(DISTINCT cst.tag_name ORDER BY cst.tag_name)
  FROM course_series_tags cst
  WHERE cst.category_id = cc.id
    AND cst.category_type = '适用人群'
    AND cst.is_active = true
)
WHERE EXISTS (
  SELECT 1 FROM course_series_tags cst
  WHERE cst.category_id = cc.id
    AND cst.category_type = '适用人群'
    AND cst.is_active = true
);

-- 更新适用场景
UPDATE course_categories cc
SET applicable_scenarios = (
  SELECT array_agg(DISTINCT cst.tag_name ORDER BY cst.tag_name)
  FROM course_series_tags cst
  WHERE cst.category_id = cc.id
    AND cst.category_type = '适用场景'
    AND cst.is_active = true
)
WHERE EXISTS (
  SELECT 1 FROM course_series_tags cst
  WHERE cst.category_id = cc.id
    AND cst.category_type = '适用场景'
    AND cst.is_active = true
);

-- 更新内容类型
UPDATE course_categories cc
SET content_types = (
  SELECT array_agg(DISTINCT cst.tag_name ORDER BY cst.tag_name)
  FROM course_series_tags cst
  WHERE cst.category_id = cc.id
    AND cst.category_type = '内容类型'
    AND cst.is_active = true
)
WHERE EXISTS (
  SELECT 1 FROM course_series_tags cst
  WHERE cst.category_id = cc.id
    AND cst.category_type = '内容类型'
    AND cst.is_active = true
);

-- ============================================================================
-- 步骤 3: 删除相关触发器
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_sync_category_tags_summary ON course_series_tags;
DROP TRIGGER IF EXISTS trigger_update_course_series_tags_updated_at ON course_series_tags;

-- ============================================================================
-- 步骤 4: 删除相关函数
-- ============================================================================

DROP FUNCTION IF EXISTS sync_category_tags_summary() CASCADE;
DROP FUNCTION IF EXISTS update_course_series_tags_updated_at() CASCADE;

-- ============================================================================
-- 步骤 5: 删除 course_series_tags 表
-- ============================================================================

DROP TABLE IF EXISTS course_series_tags CASCADE;

-- ============================================================================
-- 步骤 6: 删除不再需要的字段
-- ============================================================================

-- 删除 tags_summary 字段（已被新字段取代）
ALTER TABLE course_categories DROP COLUMN IF EXISTS tags_summary;

-- ============================================================================
-- 步骤 7: 创建索引以优化查询性能
-- ============================================================================

-- 为数组字段创建 GIN 索引，支持数组包含查询
CREATE INDEX IF NOT EXISTS idx_course_categories_applicable_audience 
ON course_categories USING GIN (applicable_audience);

CREATE INDEX IF NOT EXISTS idx_course_categories_applicable_scenarios 
ON course_categories USING GIN (applicable_scenarios);

CREATE INDEX IF NOT EXISTS idx_course_categories_content_types 
ON course_categories USING GIN (content_types);

-- ============================================================================
-- 步骤 8: 验证数据迁移结果
-- ============================================================================

-- 查看迁移后的数据
SELECT 
  name,
  applicable_audience,
  applicable_scenarios,
  content_types,
  scenarios
FROM course_categories
ORDER BY name;

-- 统计数据
SELECT 
  COUNT(*) as total_categories,
  COUNT(*) FILTER (WHERE applicable_audience IS NOT NULL AND array_length(applicable_audience, 1) > 0) as with_audience,
  COUNT(*) FILTER (WHERE applicable_scenarios IS NOT NULL AND array_length(applicable_scenarios, 1) > 0) as with_scenarios,
  COUNT(*) FILTER (WHERE content_types IS NOT NULL AND array_length(content_types, 1) > 0) as with_content_types
FROM course_categories;
