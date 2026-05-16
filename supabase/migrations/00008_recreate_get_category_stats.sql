-- 删除并重新创建统计函数
DROP FUNCTION IF EXISTS get_category_stats();

CREATE OR REPLACE FUNCTION get_category_stats()
RETURNS TABLE(
  category_name VARCHAR,
  course_count BIGINT,
  sort_order INTEGER,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cc.name,
    COUNT(c.id),
    cc.sort_order,
    cc.is_active
  FROM course_categories cc
  LEFT JOIN courses c ON cc.name = c.category AND c.status = 'published'
  GROUP BY cc.id, cc.name, cc.sort_order, cc.is_active
  ORDER BY cc.sort_order, cc.name;
END;
$$ LANGUAGE plpgsql;