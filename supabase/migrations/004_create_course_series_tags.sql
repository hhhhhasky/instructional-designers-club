-- 创建课程系列标签表
CREATE TABLE IF NOT EXISTS course_series_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_name TEXT NOT NULL,  -- 关联到课程系列名称（如"建构主义学习营"）
  category_type TEXT,  -- 分类维度（如"适用场景"、"内容类型"、"难度级别"）
  tag_name TEXT NOT NULL,  -- 标签文本（如"理论深度"、"实践导向"）
  tag_color TEXT DEFAULT 'blue',  -- 标签颜色（如 "blue", "green", "purple", "orange"）
  sort_order INTEGER DEFAULT 0,  -- 排序（数字越小越靠前）
  is_active BOOLEAN DEFAULT true,  -- 是否启用
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_course_series_tags_series_name ON course_series_tags(series_name);
CREATE INDEX IF NOT EXISTS idx_course_series_tags_category_type ON course_series_tags(category_type);
CREATE INDEX IF NOT EXISTS idx_course_series_tags_is_active ON course_series_tags(is_active);
CREATE INDEX IF NOT EXISTS idx_course_series_tags_sort_order ON course_series_tags(sort_order);

-- 创建更新时间触发器
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

-- 插入示例标签数据（Plus 会员课程系列）
INSERT INTO course_series_tags (series_name, category_type, tag_name, tag_color, sort_order) VALUES
-- 建构主义学习营
('建构主义学习营', '内容类型', '理论深度', 'purple', 1),
('建构主义学习营', '适用场景', '教学设计', 'blue', 2),
('建构主义学习营', '难度级别', '进阶', 'orange', 3),

-- 教学目标学习营
('教学目标学习营', '内容类型', '实践导向', 'green', 1),
('教学目标学习营', '适用场景', '课程设计', 'blue', 2),
('教学目标学习营', '难度级别', '基础', 'cyan', 3),

-- 真实任务设计实操营
('真实任务设计实操营', '内容类型', '实操训练', 'green', 1),
('真实任务设计实操营', '适用场景', '项目实战', 'indigo', 2),
('真实任务设计实操营', '难度级别', '进阶', 'orange', 3),

-- 认知负荷理论共读
('认知负荷理论共读', '内容类型', '理论深度', 'purple', 1),
('认知负荷理论共读', '适用场景', '认知科学', 'pink', 2),
('认知负荷理论共读', '难度级别', '进阶', 'orange', 3),

-- 应用学习科学共读
('应用学习科学共读', '内容类型', '理论深度', 'purple', 1),
('应用学习科学共读', '适用场景', '学习科学', 'teal', 2),
('应用学习科学共读', '难度级别', '进阶', 'orange', 3),

-- 罗森海因共读
('罗森海因共读', '内容类型', '理论深度', 'purple', 1),
('罗森海因共读', '适用场景', '教学原理', 'blue', 2),
('罗森海因共读', '难度级别', '进阶', 'orange', 3),

-- 教学设计101Course
('教学设计101Course', '内容类型', '入门科普', 'cyan', 1),
('教学设计101Course', '适用场景', '新手入门', 'green', 2),
('教学设计101Course', '难度级别', '基础', 'cyan', 3),

-- 教学幻象分享
('教学幻象', '内容类型', '案例分析', 'pink', 1),
('教学幻象', '适用场景', '反思提升', 'purple', 2),
('教学幻象', '难度级别', '进阶', 'orange', 3);

-- 设置 RLS 策略（Row Level Security）
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

-- 添加注释
COMMENT ON TABLE course_series_tags IS '课程系列标签表，用于为课程系列添加可配置的分类标签';
COMMENT ON COLUMN course_series_tags.series_name IS '课程系列名称，关联到 courses 表的 category 字段';
COMMENT ON COLUMN course_series_tags.category_type IS '分类维度，如"适用场景"、"内容类型"、"难度级别"';
COMMENT ON COLUMN course_series_tags.tag_name IS '标签文本，如"理论深度"、"实践导向"';
COMMENT ON COLUMN course_series_tags.tag_color IS '标签颜色，如 "blue", "green", "purple", "orange"';
COMMENT ON COLUMN course_series_tags.sort_order IS '排序，数字越小越靠前';
COMMENT ON COLUMN course_series_tags.is_active IS '是否启用，false 时前端不显示';
