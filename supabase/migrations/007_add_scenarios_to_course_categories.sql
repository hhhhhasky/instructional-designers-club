-- 为 course_categories 表添加场景关联字段

-- 1. 添加 scenarios 字段（存储该分类关联的场景 ID 数组）
ALTER TABLE course_categories
ADD COLUMN scenarios TEXT[] DEFAULT '{}';

-- 2. 添加 tags_summary 字段（存储该分类的标签摘要，JSONB 格式）
ALTER TABLE course_categories
ADD COLUMN tags_summary JSONB DEFAULT '{}';

-- 3. 添加字段注释
COMMENT ON COLUMN course_categories.scenarios IS '该分类关联的场景 ID 数组，如 ["open-class", "daily-class", "innovative-teacher", "parent"]';
COMMENT ON COLUMN course_categories.tags_summary IS '该分类的标签摘要，格式如 {"内容类型": "理论深度", "适用场景": "教学设计", "难度级别": "进阶"}';

-- 4. 为现有分类填充场景数据（根据 course_series_tags 表）

-- 公开课场景
UPDATE course_categories
SET scenarios = ARRAY['open-class']
WHERE name IN ('学情分析', '教学目标', '任务情境设计', 'AI 通识课');

-- 日常课场景
UPDATE course_categories
SET scenarios = array_append(COALESCE(scenarios, '{}'), 'daily-class')
WHERE name IN ('讲授法', '学情分析', '教学目标', '罗森海因教学原理');

-- 创新教育老师场景（暂时为空，后续可添加）
-- UPDATE course_categories
-- SET scenarios = array_append(COALESCE(scenarios, '{}'), 'innovative-teacher')
-- WHERE name IN ('AI工具', 'AI科普', 'ClaudeCode教程');

-- 家长场景（暂时为空，后续可添加）
-- UPDATE course_categories
-- SET scenarios = array_append(COALESCE(scenarios, '{}'), 'parent')
-- WHERE name IN ('免费课', 'AI 通识课');

-- 5. 创建函数：自动同步标签到 tags_summary
CREATE OR REPLACE FUNCTION sync_category_tags_summary()
RETURNS TRIGGER AS $$
BEGIN
  -- 当标签表有变化时，更新对应分类的 tags_summary
  UPDATE course_categories
  SET tags_summary = (
    SELECT jsonb_object_agg(category_type, tag_name)
    FROM course_series_tags
    WHERE category_id = NEW.category_id
    AND is_active = true
  )
  WHERE id = NEW.category_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. 创建触发器：标签变化时自动同步
DROP TRIGGER IF EXISTS trigger_sync_category_tags_summary ON course_series_tags;
CREATE TRIGGER trigger_sync_category_tags_summary
  AFTER INSERT OR UPDATE OR DELETE ON course_series_tags
  FOR EACH ROW
  EXECUTE FUNCTION sync_category_tags_summary();

-- 7. 初始化现有分类的 tags_summary
UPDATE course_categories cc
SET tags_summary = (
  SELECT jsonb_object_agg(cst.category_type, cst.tag_name)
  FROM course_series_tags cst
  WHERE cst.category_id = cc.id
  AND cst.is_active = true
  GROUP BY cst.category_id
)
WHERE EXISTS (
  SELECT 1 FROM course_series_tags
  WHERE category_id = cc.id
);

-- 8. 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_course_categories_scenarios ON course_categories USING GIN (scenarios);
CREATE INDEX IF NOT EXISTS idx_course_categories_tags_summary ON course_categories USING GIN (tags_summary);

-- 9. 验证数据（可选，仅用于测试）
-- SELECT 
--   name,
--   scenarios,
--   tags_summary
-- FROM course_categories
-- WHERE scenarios IS NOT NULL AND array_length(scenarios, 1) > 0
-- ORDER BY name;
