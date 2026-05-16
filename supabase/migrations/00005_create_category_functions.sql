-- 创建触发器函数 - 自动更新 updated_at
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

-- 创建验证函数
CREATE OR REPLACE FUNCTION validate_course_categories()
RETURNS TABLE(
  validation_type TEXT,
  category_name TEXT,
  issue_description TEXT
) AS $$
BEGIN
  -- 检查缺失分类
  RETURN QUERY
  SELECT 
    'missing_in_categories'::TEXT,
    c.category,
    '课程使用了此分类，但 course_categories 表中未定义'::TEXT
  FROM (
    SELECT DISTINCT category
    FROM courses
    WHERE category IS NOT NULL AND category != '' AND status = 'published'
  ) c
  LEFT JOIN course_categories cc ON c.category = cc.name
  WHERE cc.name IS NULL;

  -- 检查未使用分类
  RETURN QUERY
  SELECT 
    'unused_category'::TEXT,
    cc.name,
    '分类已定义但没有课程使用'::TEXT
  FROM course_categories cc
  LEFT JOIN (
    SELECT DISTINCT category
    FROM courses
    WHERE category IS NOT NULL AND category != '' AND status = 'published'
  ) c ON cc.name = c.category
  WHERE c.category IS NULL AND cc.is_active = TRUE;

  -- 检查重复 sort_order
  RETURN QUERY
  SELECT 
    'duplicate_sort_order'::TEXT,
    cc.name,
    '多个分类使用了相同的 sort_order: ' || cc.sort_order::TEXT
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