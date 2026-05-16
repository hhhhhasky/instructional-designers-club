-- 删除并重新创建验证函数
DROP FUNCTION IF EXISTS validate_course_categories();

CREATE OR REPLACE FUNCTION validate_course_categories()
RETURNS TABLE(
  validation_type TEXT,
  category_name VARCHAR,
  issue_description TEXT
) AS $$
BEGIN
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

  RETURN QUERY
  SELECT 
    'duplicate_sort_order'::TEXT,
    cc.name,
    ('多个分类使用了相同的 sort_order: ' || cc.sort_order::TEXT)::TEXT
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