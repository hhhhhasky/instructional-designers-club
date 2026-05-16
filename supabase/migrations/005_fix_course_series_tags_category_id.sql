-- 修复课程系列标签表，使用 category_id 关联到 course_categories 表

-- 1. 删除旧表（如果存在）
DROP TABLE IF EXISTS course_series_tags CASCADE;

-- 2. 重新创建标签表，使用 category_id 外键
CREATE TABLE course_series_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES course_categories(id) ON DELETE CASCADE,  -- 关联到 course_categories 表
  category_type TEXT,  -- 分类维度（如"适用场景"、"内容类型"、"难度级别"）
  tag_name TEXT NOT NULL,  -- 标签文本（如"理论深度"、"实践导向"）
  tag_color TEXT DEFAULT 'blue',  -- 标签颜色（如 "blue", "green", "purple", "orange"）
  sort_order INTEGER DEFAULT 0,  -- 排序（数字越小越靠前）
  is_active BOOLEAN DEFAULT true,  -- 是否启用
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 创建索引以提升查询性能
CREATE INDEX idx_course_series_tags_category_id ON course_series_tags(category_id);
CREATE INDEX idx_course_series_tags_category_type ON course_series_tags(category_type);
CREATE INDEX idx_course_series_tags_is_active ON course_series_tags(is_active);
CREATE INDEX idx_course_series_tags_sort_order ON course_series_tags(sort_order);

-- 4. 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_course_series_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_course_series_tags_updated_at
  BEFORE UPDATE ON course_series_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_course_series_tags_updated_at();

-- 5. 插入示例标签数据（使用 course_categories 表中的实际 ID）
-- 先获取各个分类的 ID，然后插入标签

-- 建构主义
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '内容类型', '理论深度', 'purple', 1 FROM course_categories WHERE name = '建构主义'
UNION ALL
SELECT id, '适用场景', '教学设计', 'blue', 2 FROM course_categories WHERE name = '建构主义'
UNION ALL
SELECT id, '难度级别', '进阶', 'orange', 3 FROM course_categories WHERE name = '建构主义';

-- 教学目标
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '内容类型', '实践导向', 'green', 1 FROM course_categories WHERE name = '教学目标'
UNION ALL
SELECT id, '适用场景', '课程设计', 'blue', 2 FROM course_categories WHERE name = '教学目标'
UNION ALL
SELECT id, '难度级别', '基础', 'cyan', 3 FROM course_categories WHERE name = '教学目标';

-- 任务情境设计
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '内容类型', '实操训练', 'green', 1 FROM course_categories WHERE name = '任务情境设计'
UNION ALL
SELECT id, '适用场景', '项目实战', 'indigo', 2 FROM course_categories WHERE name = '任务情境设计'
UNION ALL
SELECT id, '难度级别', '进阶', 'orange', 3 FROM course_categories WHERE name = '任务情境设计';

-- 认知负荷理论
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '内容类型', '理论深度', 'purple', 1 FROM course_categories WHERE name = '认知负荷理论'
UNION ALL
SELECT id, '适用场景', '认知科学', 'pink', 2 FROM course_categories WHERE name = '认知负荷理论'
UNION ALL
SELECT id, '难度级别', '进阶', 'orange', 3 FROM course_categories WHERE name = '认知负荷理论';

-- 学习科学入门
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '内容类型', '理论深度', 'purple', 1 FROM course_categories WHERE name = '学习科学入门'
UNION ALL
SELECT id, '适用场景', '学习科学', 'teal', 2 FROM course_categories WHERE name = '学习科学入门'
UNION ALL
SELECT id, '难度级别', '进阶', 'orange', 3 FROM course_categories WHERE name = '学习科学入门';

-- 罗森海因教学原理
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '内容类型', '理论深度', 'purple', 1 FROM course_categories WHERE name = '罗森海因教学原理'
UNION ALL
SELECT id, '适用场景', '教学原理', 'blue', 2 FROM course_categories WHERE name = '罗森海因教学原理'
UNION ALL
SELECT id, '难度级别', '进阶', 'orange', 3 FROM course_categories WHERE name = '罗森海因教学原理';

-- 免费课
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '内容类型', '入门科普', 'cyan', 1 FROM course_categories WHERE name = '免费课'
UNION ALL
SELECT id, '适用场景', '新手入门', 'green', 2 FROM course_categories WHERE name = '免费课'
UNION ALL
SELECT id, '难度级别', '基础', 'cyan', 3 FROM course_categories WHERE name = '免费课';

-- 讲授法
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '内容类型', '案例分析', 'pink', 1 FROM course_categories WHERE name = '讲授法'
UNION ALL
SELECT id, '适用场景', '反思提升', 'purple', 2 FROM course_categories WHERE name = '讲授法'
UNION ALL
SELECT id, '难度级别', '进阶', 'orange', 3 FROM course_categories WHERE name = '讲授法';

-- AI工具
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '内容类型', '工具应用', 'indigo', 1 FROM course_categories WHERE name = 'AI工具'
UNION ALL
SELECT id, '适用场景', '效率提升', 'cyan', 2 FROM course_categories WHERE name = 'AI工具'
UNION ALL
SELECT id, '难度级别', '基础', 'green', 3 FROM course_categories WHERE name = 'AI工具';

-- ClaudeCode教程
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '内容类型', '技术教程', 'blue', 1 FROM course_categories WHERE name = 'ClaudeCode教程'
UNION ALL
SELECT id, '适用场景', '编程实战', 'indigo', 2 FROM course_categories WHERE name = 'ClaudeCode教程'
UNION ALL
SELECT id, '难度级别', '进阶', 'orange', 3 FROM course_categories WHERE name = 'ClaudeCode教程';

-- AI科普
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order)
SELECT id, '内容类型', '知识科普', 'cyan', 1 FROM course_categories WHERE name = 'AI科普'
UNION ALL
SELECT id, '适用场景', '通识教育', 'green', 2 FROM course_categories WHERE name = 'AI科普'
UNION ALL
SELECT id, '难度级别', '基础', 'cyan', 3 FROM course_categories WHERE name = 'AI科普';

-- 6. 设置 RLS 策略（Row Level Security）
ALTER TABLE course_series_tags ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取标签（公开数据）
CREATE POLICY "Allow public read access to course_series_tags"
  ON course_series_tags
  FOR SELECT
  USING (is_active = true);

-- 只允许认证用户插入、更新、删除（管理后台使用）
CREATE POLICY "Allow authenticated users to manage course_series_tags"
  ON course_series_tags
  FOR ALL
  USING (auth.role() = 'authenticated');

-- 7. 添加注释
COMMENT ON TABLE course_series_tags IS '课程系列标签表，用于为课程系列添加可配置的分类标签';
COMMENT ON COLUMN course_series_tags.category_id IS '课程分类ID，外键关联到 course_categories 表';
COMMENT ON COLUMN course_series_tags.category_type IS '分类维度，如"适用场景"、"内容类型"、"难度级别"';
COMMENT ON COLUMN course_series_tags.tag_name IS '标签文本，如"理论深度"、"实践导向"';
COMMENT ON COLUMN course_series_tags.tag_color IS '标签颜色，如 "blue", "green", "purple", "orange"';
COMMENT ON COLUMN course_series_tags.sort_order IS '排序，数字越小越靠前';
COMMENT ON COLUMN course_series_tags.is_active IS '是否启用，false 时前端不显示';
