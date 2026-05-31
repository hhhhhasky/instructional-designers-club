# 官网课程更新指南

## 整体流程

```
准备视频文件 → 上传视频到 R2 → 拿到视频 URL → 在 Supabase 添加课程记录 → 网站自动显示
```

课程数据存储在 Supabase 数据库中，前端从数据库实时读取，因此**不需要重新部署代码**，只要数据库中的记录正确，网站就会自动更新。

---

## 第一步：上传视频到 Cloudflare R2

### 方法 A：使用上传脚本（推荐）

上传脚本会自动完成两件事：把视频上传到 R2，然后把视频 URL 写入 Supabase 对应的课程记录。

```bash
# 基本用法：上传指定文件夹中的所有视频
node scripts/upload-r2.mjs <视频文件夹路径>

# 试运行（只看匹配结果，不实际上传）
node scripts/upload-r2.mjs <视频文件夹路径> --dry-run

# 只处理 pro 类型的课程
node scripts/upload-r2.mjs <视频文件夹路径> --type=pro
```

**脚本工作原理：**

1. 读取文件夹中的视频文件（支持 `.mp4`、`.webm`、`.mov`）
2. 根据文件名自动匹配 Supabase 中已存在的课程（通过标题相似度匹配）
3. 上传到 R2 存储桶
4. 自动更新数据库中对应课程的 `video_url` 字段

**视频文件命名建议：** 文件名应尽量与课程标题一致，例如课程标题是「初识认知负荷理论」，文件名可以是 `初识认知负荷理论.mp4`。

### 方法 B：手动上传到 Cloudflare Dashboard

1. 登录 Cloudflare Dashboard → R2 → `course-videos` 存储桶
2. 上传视频文件
3. 上传完成后，视频的公开访问 URL 格式为：
   ```
   https://pub-9a448aa9778a401c912a9e3ac046e252.r2.dev/<文件名>
   ```
4. 记下这个 URL，后面添加课程时需要用到

---

## 第二步：在 Supabase 添加课程记录

### 方法 A：通过 Supabase Dashboard（推荐）

1. 登录 Supabase Dashboard：https://supabase.com/dashboard
2. 进入项目 → **Table Editor** → 选择 `courses` 表
3. 点击 **Insert row**，填写以下字段：

### 方法 B：通过 SQL 编辑器

进入 Supabase Dashboard → **SQL Editor**，执行 INSERT 语句（见下方模板）。

---

## 课程字段说明

### 必填字段

| 字段 | 说明 | 示例 |
|------|------|------|
| `id` | 课程唯一标识 | `cognitive-load-advanced` |
| `title` | 课程名称 | `深入认知负荷理论` |
| `membership_type` | 会员等级 | `free` / `plus` / `pro` |
| `status` | 发布状态 | 必须设为 `published` 才会显示 |
| `level` | 难度级别 | `入门` / `初级` / `中级` / `高级` |

### 重要可选字段

| 字段 | 说明 | 示例 |
|------|------|------|
| `description` | 课程描述 | `深入学习认知负荷理论的核心原理` |
| `category` | 所属分类 | `认知负荷理论`（需与 `course_categories` 表匹配） |
| `category_id` | 分类 ID | 对应 `course_categories` 表中的 `id` |
| `duration` | 时长（分钟） | `60` |
| `video_url` | 视频 URL | 上传 R2 后获得的 URL |
| `image_url` | 封面图 URL | `https://...` |
| `meeting_url` | 腾讯会议链接 | `https://meeting.tencent.com/crm/xxxxx` |
| `is_trial` | 是否可试看 | `true` / `false` |
| `sort_order` | 排序序号 | 数字越小越靠前 |
| `instructor` | 讲师 | `哈老师` |
| `credits` | 学分/课时信息 | `2课时` |
| `semester` | 学期 | `2026春` |

---

## SQL 插入模板

```sql
INSERT INTO courses (
  id,
  title,
  description,
  category,
  level,
  duration,
  membership_type,
  status,
  video_url,
  image_url,
  meeting_url,
  is_trial,
  sort_order
) VALUES (
  'course-unique-id',             -- 改为实际课程 ID
  '课程标题',                       -- 改为实际标题
  '课程描述文字',                    -- 改为实际描述
  '分类名称',                       -- 需与 course_categories 表一致
  '中级',                           -- 入门/初级/中级/高级
  60,                              -- 时长（分钟）
  'plus',                          -- free/plus/pro
  'published',                     -- 必须是 published
  'https://pub-...r2.dev/xxx.mp4', -- R2 视频 URL
  'https://封面图URL',               -- 封面图
  'https://meeting.tencent.com/...', -- 腾讯会议链接（可选）
  false,                           -- 是否试看
  100                              -- 排序序号
);
```

---

## 第三步：验证

添加完成后，访问网站确认：

1. **课程列表页**：打开网站的课程中心，确认新课程出现在对应分类下
2. **课程详情页**：点击进入课程详情，确认视频可播放、信息显示正确
3. **会员权限**：确认 `plus` / `pro` 课程需要输入密码才能访问
   - Plus 密码：`739281`
   - Pro 密码：`club2025`

---

## 如果需要添加新的课程分类

新分类需要在 `course_categories` 表中先创建，否则课程无法正确归组显示。

```sql
INSERT INTO course_categories (
  id,
  name,
  description,
  sort_order,
  is_active
) VALUES (
  'category-unique-id',
  '分类名称',
  '分类描述',
  10,       -- 排序序号
  true      -- 是否启用
);
```

---

## 常见问题

### 上传视频时文件名无法自动匹配课程怎么办？

脚本会尝试多种匹配策略（精确匹配、部分匹配、关键词匹配），如果仍然无法匹配，可以：
- 将视频文件名改为与课程标题完全一致
- 或先在 Supabase 手动创建课程记录，再运行脚本

### 如何修改已有课程的信息？

在 Supabase Dashboard → Table Editor → `courses` 表中，找到对应课程直接编辑即可。也可以用 SQL：

```sql
UPDATE courses
SET description = '新的描述',
    video_url = '新的视频URL'
WHERE id = 'course-id';
```

### 如何隐藏/下架一门课程？

将 `status` 改为 `draft`（草稿）或 `archived`（归档），课程就不会在网站上显示了。

### 如何调整课程显示顺序？

修改 `sort_order` 字段，数值越小越靠前。

---

## 相关文件

| 用途 | 路径 |
|------|------|
| 上传脚本 | `scripts/upload-r2.mjs` |
| R2 凭证配置 | `.env.upload` |
| 课程类型定义 | `src/types/types.ts` |
| 课程数据（旧版静态） | `src/data/courses.ts` |
| 课程列表页 | `src/pages/CoursesPage.tsx` |
| 课程详情页 | `src/pages/CourseDetailPage.tsx` |
| 数据库 API | `src/db/api.ts` |
