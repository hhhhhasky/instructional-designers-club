-- 删除并重新创建自动修复函数
DROP FUNCTION IF EXISTS auto_fix_course_categories();

CREATE OR REPLACE FUNCTION auto_fix_course_categories()
RETURNS TABLE(
  action_type TEXT,
  category_name VARCHAR,
  action_description TEXT
) AS $$
DECLARE
  max_sort_order INTEGER;
BEGIN
  SELECT COALESCE(MAX(sort_order), 0) INTO max_sort_order FROM course_categories;

  RETURN QUERY
  WITH new_categories AS (
    INSERT INTO course_categories (name, sort_order, is_active, created_at, updated_at)
    SELECT DISTINCT
      c.category,
      max_sort_order + ROW_NUMBER() OVER (ORDER BY c.category),
      TRUE,
      NOW(),
      NOW()
    FROM (
      SELECT DISTINCT category
      FROM courses
      WHERE category IS NOT NULL AND category != '' AND status = 'published'
    ) c
    LEFT JOIN course_categories cc ON c.category = cc.name
    WHERE cc.name IS NULL
    ON CONFLICT (name) DO NOTHING
    RETURNING name
  )
  SELECT 
    'added_missing_category'::TEXT,
    name,
    '从 courses 表中提取并添加缺失的分类'::TEXT
  FROM new_categories;

  RETURN QUERY
  WITH disabled_categories AS (
    UPDATE course_categories cc
    SET is_active = FALSE, updated_at = NOW()
    WHERE cc.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM courses c
      WHERE c.category = cc.name AND c.status = 'published'
    )
    RETURNING name
  )
  SELECT 
    'disabled_unused_category'::TEXT,
    name,
    '禁用未使用的分类'::TEXT
  FROM disabled_categories;

  RETURN QUERY
  WITH ranked_categories AS (
    SELECT 
      id,
      name,
      ROW_NUMBER() OVER (ORDER BY sort_order, name) AS new_sort_order
    FROM course_categories
    WHERE is_active = TRUE
  ),
  updated_categories AS (
    UPDATE course_categories cc
    SET sort_order = rc.new_sort_order, updated_at = NOW()
    FROM ranked_categories rc
    WHERE cc.id = rc.id AND cc.sort_order != rc.new_sort_order
    RETURNING cc.name
  )
  SELECT 
    'fixed_sort_order'::TEXT,
    name,
    '修复重复的 sort_order'::TEXT
  FROM updated_categories;
END;
$$ LANGUAGE plpgsql;