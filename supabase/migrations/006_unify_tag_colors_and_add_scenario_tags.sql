-- 统一标签颜色并添加场景标签

-- ============================================
-- 第一步：统一现有标签的颜色
-- ============================================

-- 统一"内容类型"标签颜色为 purple（紫色）
UPDATE course_series_tags
SET tag_color = 'purple'
WHERE category_type = '内容类型';

-- 统一"适用场景"标签颜色为 blue（蓝色）
UPDATE course_series_tags
SET tag_color = 'blue'
WHERE category_type = '适用场景';

-- 统一"难度级别"标签颜色为 orange（橙色）
UPDATE course_series_tags
SET tag_color = 'orange'
WHERE category_type = '难度级别';

-- ============================================
-- 第二步：添加缺失的"难度级别"标签
-- ============================================

-- 为没有"难度级别"标签的分类添加标签

-- 任务情境设计 - 进阶
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '难度级别', '进阶', 'orange', 3 
FROM course_categories 
WHERE name = '任务情境设计'
AND NOT EXISTS (
  SELECT 1 FROM course_series_tags 
  WHERE category_id = course_categories.id 
  AND category_type = '难度级别'
);

-- 免费课 - 基础
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '难度级别', '基础', 'orange', 3 
FROM course_categories 
WHERE name = '免费课'
AND NOT EXISTS (
  SELECT 1 FROM course_series_tags 
  WHERE category_id = course_categories.id 
  AND category_type = '难度级别'
);

-- 学习科学入门 - 进阶
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '难度级别', '进阶', 'orange', 3 
FROM course_categories 
WHERE name = '学习科学入门'
AND NOT EXISTS (
  SELECT 1 FROM course_series_tags 
  WHERE category_id = course_categories.id 
  AND category_type = '难度级别'
);

-- 建构主义 - 进阶
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '难度级别', '进阶', 'orange', 3 
FROM course_categories 
WHERE name = '建构主义'
AND NOT EXISTS (
  SELECT 1 FROM course_series_tags 
  WHERE category_id = course_categories.id 
  AND category_type = '难度级别'
);

-- 教学目标 - 基础
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '难度级别', '基础', 'orange', 3 
FROM course_categories 
WHERE name = '教学目标'
AND NOT EXISTS (
  SELECT 1 FROM course_series_tags 
  WHERE category_id = course_categories.id 
  AND category_type = '难度级别'
);

-- 罗森海因教学原理 - 进阶
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '难度级别', '进阶', 'orange', 3 
FROM course_categories 
WHERE name = '罗森海因教学原理'
AND NOT EXISTS (
  SELECT 1 FROM course_series_tags 
  WHERE category_id = course_categories.id 
  AND category_type = '难度级别'
);

-- 认知负荷理论 - 进阶
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '难度级别', '进阶', 'orange', 3 
FROM course_categories 
WHERE name = '认知负荷理论'
AND NOT EXISTS (
  SELECT 1 FROM course_series_tags 
  WHERE category_id = course_categories.id 
  AND category_type = '难度级别'
);

-- 讲授法 - 进阶
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '难度级别', '进阶', 'orange', 3 
FROM course_categories 
WHERE name = '讲授法'
AND NOT EXISTS (
  SELECT 1 FROM course_series_tags 
  WHERE category_id = course_categories.id 
  AND category_type = '难度级别'
);

-- ============================================
-- 第三步：添加"场景-公开课"标签（统一颜色：teal 青绿色）
-- ============================================

-- 学情分析 - 场景-公开课
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '场景-公开课', '公开课', 'teal', 4 
FROM course_categories 
WHERE name = '学情分析';

-- 教学目标 - 场景-公开课
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '场景-公开课', '公开课', 'teal', 4 
FROM course_categories 
WHERE name = '教学目标';

-- 任务情境设计 - 场景-公开课
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '场景-公开课', '公开课', 'teal', 4 
FROM course_categories 
WHERE name = '任务情境设计';

-- AI 通识课 - 场景-公开课
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '场景-公开课', '公开课', 'teal', 4 
FROM course_categories 
WHERE name = 'AI 通识课';

-- ============================================
-- 第四步：添加"场景-日常课"标签（统一颜色：indigo 靛蓝色）
-- ============================================

-- 讲授法 - 场景-日常课
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '场景-日常课', '日常课', 'indigo', 5 
FROM course_categories 
WHERE name = '讲授法';

-- 学情分析 - 场景-日常课
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '场景-日常课', '日常课', 'indigo', 5 
FROM course_categories 
WHERE name = '学情分析';

-- 教学目标 - 场景-日常课
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '场景-日常课', '日常课', 'indigo', 5 
FROM course_categories 
WHERE name = '教学目标';

-- 罗森海因教学原理 - 场景-日常课
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '场景-日常课', '日常课', 'indigo', 5 
FROM course_categories 
WHERE name = '罗森海因教学原理';

-- ============================================
-- 第五步：为"内容-理论"分类添加统一标签
-- ============================================
-- 注意：建构主义、学习科学入门、认知负荷理论已经有"内容类型：理论深度"标签
-- 这里不需要额外添加，只需确保颜色统一（已在第一步完成）

-- ============================================
-- 第六步：添加注释说明
-- ============================================

COMMENT ON COLUMN course_series_tags.category_type IS '分类维度，如"内容类型"（紫色）、"适用场景"（蓝色）、"难度级别"（橙色）、"场景-公开课"（青绿色）、"场景-日常课"（靛蓝色）';

-- ============================================
-- 验证：查看更新后的标签数据
-- ============================================

-- 可以运行以下查询验证结果（仅用于测试，不会在迁移中执行）
-- SELECT 
--   cc.name as category_name,
--   cst.category_type,
--   cst.tag_name,
--   cst.tag_color,
--   cst.sort_order
-- FROM course_series_tags cst
-- JOIN course_categories cc ON cst.category_id = cc.id
-- ORDER BY cc.name, cst.sort_order;
