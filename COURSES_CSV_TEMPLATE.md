# 课程数据CSV导入模板

## ✅ 数据库已清空

所有课程数据已从数据库中删除，当前courses表为空，准备接收新的CSV数据。

---

## 📋 CSV文件格式要求

### 必填字段

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `title` | 文本 | 课程名称 | "什么是教学设计？" |

### 可选字段

| 字段名 | 类型 | 说明 | 示例 | 默认值 |
|--------|------|------|------|--------|
| `description` | 文本 | 课程描述 | "教学设计101Course科普入门课程" | null |
| `instructor` | 文本 | 讲师名称 | "俱乐部团队" | null |
| `category` | 文本 | 课程分类 | "官方推荐" | null |
| `level` | 枚举 | 难度级别 | "入门" / "初级" / "中级" / "高级" | "入门" |
| `semester` | 文本 | 学期 | "2025年11月" | null |
| `duration` | 整数 | 课程时长（分钟） | 60 | 60 |
| `credits` | 数字 | 学分 | 1.0 | 0.0 |
| `status` | 枚举 | 课程状态 | "draft" / "published" / "archived" | "draft" |
| `image_url` | 文本 | 课程配图URL | "https://..." | null |
| `video_url` | 文本 | 视频链接 | "https://..." | null |
| `meeting_url` | 文本 | 会议链接 | "https://meeting.tencent.com/..." | null |
| `sort_order` | 整数 | 排序顺序 | 1 | 0 |

### 自动生成字段（无需在CSV中提供）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | UUID | 课程唯一标识（自动生成） |
| `category_id` | UUID | 分类ID（可选，如果需要关联分类表） |
| `view_count` | 整数 | 浏览次数（默认0） |
| `created_at` | 时间戳 | 创建时间（自动生成） |
| `updated_at` | 时间戳 | 更新时间（自动生成） |

---

## 📝 CSV文件示例

### 示例1：最简CSV（仅必填字段）

```csv
title
什么是教学设计？
教学设计全景图
罗森海因共读
```

### 示例2：完整CSV（包含所有常用字段）

```csv
title,description,instructor,category,level,semester,duration,credits,status,image_url,meeting_url,sort_order
什么是教学设计？,教学设计101Course科普入门课程,俱乐部团队,官方推荐,入门,2025年11月,60,1.0,published,https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800,https://meeting.tencent.com/crm/KwPoZX4qdf,1
教学设计全景图,全面介绍教学设计的知识体系和实践框架,俱乐部团队,官方推荐,初级,2025年11月,90,1.5,published,https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800,https://meeting.tencent.com/crm/l71reXm95,2
罗森海因共读,高效能教学：罗森海因教学原理实践,罗森海因,必修课,中级,2025年10月,240,4.0,published,https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800,https://pan.baidu.com/s/16jMTzko5t4ZuXtSicW4Nqw?pwd=nju6,3
```

---

## 🎯 字段详细说明

### 1. level（难度级别）

**允许的值：**
- `入门`：适合完全没有基础的学员
- `初级`：需要一定基础知识
- `中级`：需要较好的基础和实践经验
- `高级`：需要深厚的理论基础和丰富的实践经验

**注意事项：**
- 必须使用中文
- 区分大小写
- 如果不提供，默认为"入门"

### 2. status（课程状态）

**允许的值：**
- `draft`：草稿状态，不对外显示
- `published`：已发布，对外显示
- `archived`：已归档，不再显示

**注意事项：**
- 必须使用英文小写
- 如果不提供，默认为"draft"
- 建议导入时使用"published"以便立即显示

### 3. duration（课程时长）

**说明：**
- 单位：分钟
- 类型：整数
- 示例：60（表示60分钟，即1小时）

**常用值：**
- 60：1小时
- 90：1.5小时
- 120：2小时
- 180：3小时
- 240：4小时

### 4. credits（学分）

**说明：**
- 类型：数字（可以有小数）
- 示例：1.0, 1.5, 2.0, 4.0

**建议：**
- 1小时课程：1.0学分
- 1.5小时课程：1.5学分
- 2小时课程：2.0学分
- 以此类推

### 5. sort_order（排序顺序）

**说明：**
- 类型：整数
- 用途：控制课程在列表中的显示顺序
- 数字越小，排序越靠前

**建议：**
- 从1开始编号
- 按重要性或学习顺序排序
- 预留间隔（如1, 10, 20, 30），方便后续插入新课程

### 6. URL字段

**image_url（课程配图）：**
- 支持的格式：HTTPS链接
- 建议尺寸：800x600或更高
- 示例：`https://images.unsplash.com/photo-xxx?w=800`

**video_url（视频链接）：**
- 支持的平台：任何视频平台
- 示例：`https://www.youtube.com/watch?v=xxx`

**meeting_url（会议链接）：**
- 支持的平台：腾讯会议、Zoom等
- 示例：`https://meeting.tencent.com/crm/xxx`

---

## 📊 CSV文件准备建议

### 1. 编码格式

**推荐：** UTF-8（支持中文）

**如何设置：**
- Excel：另存为CSV时选择"CSV UTF-8（逗号分隔）"
- Google Sheets：下载为CSV时自动使用UTF-8
- 文本编辑器：保存时选择UTF-8编码

### 2. 字段分隔符

**推荐：** 逗号（,）

**注意事项：**
- 如果字段内容包含逗号，需要用双引号包裹
- 示例：`"课程描述，包含逗号"`

### 3. 换行符

**推荐：** LF（\n）或CRLF（\r\n）

**注意事项：**
- Windows：通常使用CRLF
- Mac/Linux：通常使用LF
- 两种格式都支持

### 4. 空值处理

**方法1：** 留空
```csv
title,description,instructor
课程1,,讲师1
```

**方法2：** 不包含该列
```csv
title,instructor
课程1,讲师1
```

### 5. 特殊字符处理

**双引号：**
- 如果字段内容包含双引号，需要转义
- 方法：使用两个双引号
- 示例：`"他说：""你好"""`

**换行：**
- 如果字段内容包含换行，需要用双引号包裹
- 示例：
```csv
title,description
课程1,"第一行
第二行"
```

---

## 🔧 导入方法

### 方法1：使用Supabase Dashboard（推荐）

1. 登录Supabase Dashboard
2. 选择项目
3. 进入"Table Editor"
4. 选择"courses"表
5. 点击"Insert" → "Import data from CSV"
6. 上传CSV文件
7. 映射字段（确保CSV列名与数据库字段名匹配）
8. 点击"Import"

### 方法2：使用SQL批量插入

如果您提供CSV文件，我可以帮您生成SQL插入语句。

**示例SQL：**
```sql
INSERT INTO courses (title, description, instructor, category, level, semester, duration, credits, status, image_url, meeting_url, sort_order)
VALUES 
  ('什么是教学设计？', '教学设计101Course科普入门课程', '俱乐部团队', '官方推荐', '入门', '2025年11月', 60, 1.0, 'published', 'https://...', 'https://...', 1),
  ('教学设计全景图', '全面介绍教学设计的知识体系', '俱乐部团队', '官方推荐', '初级', '2025年11月', 90, 1.5, 'published', 'https://...', 'https://...', 2);
```

### 方法3：使用前端上传功能

我可以为您创建一个CSV上传页面，支持：
- 拖拽上传CSV文件
- 自动解析CSV内容
- 预览数据
- 批量导入到数据库

---

## ✅ 数据验证

导入后，您可以使用以下SQL验证数据：

```sql
-- 查看所有课程
SELECT * FROM courses ORDER BY sort_order;

-- 统计课程数量
SELECT COUNT(*) as total FROM courses;

-- 按分类统计
SELECT category, COUNT(*) as count 
FROM courses 
GROUP BY category 
ORDER BY count DESC;

-- 按难度级别统计
SELECT level, COUNT(*) as count 
FROM courses 
GROUP BY level 
ORDER BY 
  CASE level
    WHEN '入门' THEN 1
    WHEN '初级' THEN 2
    WHEN '中级' THEN 3
    WHEN '高级' THEN 4
  END;

-- 查看已发布的课程
SELECT title, category, level, status 
FROM courses 
WHERE status = 'published' 
ORDER BY sort_order;
```

---

## 🎯 下一步

### 选项1：直接提供CSV文件

请将您的CSV文件内容发送给我，我会：
1. 验证数据格式
2. 生成SQL插入语句
3. 执行导入
4. 验证导入结果

### 选项2：使用Supabase Dashboard

您可以直接在Supabase Dashboard中导入CSV文件：
1. 准备好CSV文件（参考上面的格式）
2. 登录Supabase Dashboard
3. 使用Import功能导入

### 选项3：创建上传页面

我可以为您创建一个专门的CSV上传页面，支持：
- 可视化上传
- 数据预览
- 错误检查
- 一键导入

---

## 📞 需要帮助？

如果您在准备CSV文件时遇到任何问题，请随时告诉我：

1. **格式问题**：我可以帮您调整CSV格式
2. **字段映射**：我可以帮您确定哪些字段是必需的
3. **数据转换**：我可以帮您将现有数据转换为正确的格式
4. **批量导入**：我可以帮您执行SQL导入

---

## 📋 快速检查清单

导入前请确认：

- [ ] CSV文件使用UTF-8编码
- [ ] 第一行是列名（字段名）
- [ ] `title`字段不为空
- [ ] `level`字段值为：入门/初级/中级/高级（如果提供）
- [ ] `status`字段值为：draft/published/archived（如果提供）
- [ ] `duration`和`sort_order`是整数（如果提供）
- [ ] `credits`是数字（如果提供）
- [ ] URL字段是有效的HTTPS链接（如果提供）
- [ ] 没有多余的空行
- [ ] 特殊字符已正确转义

---

## 🎉 准备就绪

数据库已清空，随时可以接收您的CSV文件！

请提供您的CSV文件，我会立即帮您导入。
