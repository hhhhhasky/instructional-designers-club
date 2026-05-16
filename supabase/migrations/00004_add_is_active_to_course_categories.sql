-- 添加 is_active 字段到 course_categories 表
ALTER TABLE course_categories 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 添加字段注释
COMMENT ON COLUMN course_categories.is_active IS '是否启用（前端只显示启用的分类）';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_course_categories_is_active ON course_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_course_categories_name ON course_categories(name);
CREATE INDEX IF NOT EXISTS idx_course_categories_sort_order ON course_categories(sort_order);