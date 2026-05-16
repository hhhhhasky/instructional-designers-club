-- 为 courses 表添加会员类型字段
-- 用于区分免费课程、Plus会员课程和Pro会员课程

-- 添加会员类型字段
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS membership_type TEXT DEFAULT 'plus' CHECK (membership_type IN ('free', 'plus', 'pro'));

-- 添加是否试看字段
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE;

-- 添加字段注释
COMMENT ON COLUMN courses.membership_type IS '会员类型：free-免费课程，plus-Plus会员课程，pro-Pro会员课程';
COMMENT ON COLUMN courses.is_trial IS '是否为试看课程（免费试看）';

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_courses_membership_type ON courses(membership_type);
CREATE INDEX IF NOT EXISTS idx_courses_is_trial ON courses(is_trial);

-- 更新现有数据的默认值（可根据实际情况调整）
-- 示例：将所有现有课程设置为Plus会员课程
UPDATE courses 
SET membership_type = 'plus' 
WHERE membership_type IS NULL;
