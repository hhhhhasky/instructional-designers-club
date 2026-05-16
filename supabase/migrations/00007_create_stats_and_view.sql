-- 创建统计函数
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

COMMENT ON FUNCTION get_category_stats() IS '获取每个分类的课程数量统计';

-- 创建视图
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