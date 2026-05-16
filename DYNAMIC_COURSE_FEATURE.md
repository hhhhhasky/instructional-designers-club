# 课程动态生成功能说明

## 🎯 功能概述

**您想要的功能已经完全实现！** 

当您在后端 `courses` 数据库中添加新的课程信息后，前端课程中心页面会自动生成新的课程卡片，并且可以点击进入对应的课程详情页。

---

## ✅ 已实现的功能

### 1. 动态课程列表

**实现位置：** `src/pages/CoursesPage.tsx`

**功能说明：**
- ✅ 页面加载时自动从 `courses` 表获取所有已发布的课程
- ✅ 使用 `getCourses()` API 动态查询数据库
- ✅ 自动为每门课程生成课程卡片
- ✅ 支持按分类筛选课程

**实现代码：**
```typescript
// 加载课程数据
useEffect(() => {
  const loadData = async () => {
    const [coursesData, categoriesData] = await Promise.all([
      getCourses(),        // 从数据库获取课程
      getCourseCategories() // 从数据库获取分类
    ]);
    setCourses(coursesData);
    setCategories(categoriesData);
  };
  loadData();
}, []);
```

### 2. 动态课程详情页

**实现位置：** `src/pages/CourseDetailPage.tsx`

**功能说明：**
- ✅ 支持动态路由 `/courses/:id`
- ✅ 根据课程ID从数据库获取课程详情
- ✅ 使用 `getCourseById(id)` API 动态查询
- ✅ 自动显示课程的所有信息

**实现代码：**
```typescript
useEffect(() => {
  const loadCourse = async () => {
    // 根据ID获取课程详情
    const courseData = await getCourseById(id);
    setCourse(courseData);
    // 增加浏览次数
    await incrementCourseViewCount(id);
  };
  loadCourse();
}, [id]);
```

### 3. 自动路由生成

**实现位置：** `src/routes.tsx`

**功能说明：**
- ✅ 课程详情页使用动态路由参数 `:id`
- ✅ 任何新课程都可以通过 `/courses/{课程ID}` 访问
- ✅ 无需手动添加路由配置

**路由配置：**
```typescript
{
  path: '/courses/:id',
  element: <CourseDetailPage />
}
```

---

## 📝 如何添加新课程

### 方法1：直接在数据库中添加（推荐用于测试）

**步骤：**

1. **打开 Supabase 数据库管理界面**
   - 进入项目的 Supabase 控制台
   - 选择 "Table Editor"
   - 找到 `courses` 表

2. **点击 "Insert row" 添加新课程**

3. **填写必需字段：**

| 字段 | 类型 | 必填 | 说明 | 示例值 |
|------|------|------|------|--------|
| **title** | VARCHAR | ✅ 是 | 课程标题 | "AI时代的教学设计实践" |
| **description** | TEXT | ⚠️ 建议 | 课程描述 | "深入学习AI辅助教学设计的方法..." |
| **category** | VARCHAR | ⚠️ 建议 | 课程分类 | "建构主义" |
| **level** | ENUM | ⚠️ 建议 | 难度级别 | "入门"/"初级"/"中级"/"高级" |
| **duration** | INTEGER | ⚠️ 建议 | 课程时长（分钟） | 90 |
| **credits** | NUMERIC | ❌ 可选 | 学分 | 2.0 |
| **instructor** | VARCHAR | ❌ 可选 | 讲师姓名 | "张老师" |
| **status** | ENUM | ✅ 是 | 发布状态 | "published" |
| **image_url** | TEXT | ❌ 可选 | 课程封面图 | "https://..." |
| **meeting_url** | TEXT | ⚠️ 建议 | 课程链接 | "https://meeting.tencent.com/..." |
| **sort_order** | INTEGER | ❌ 可选 | 排序顺序 | 10 |

4. **保存后刷新前端页面**
   - 新课程卡片会自动出现在课程中心
   - 点击卡片可以进入课程详情页

### 方法2：使用 SQL 插入（推荐用于批量添加）

**示例SQL：**

```sql
-- 添加单门课程
INSERT INTO courses (
  title,
  description,
  category,
  level,
  duration,
  credits,
  instructor,
  status,
  meeting_url,
  sort_order
) VALUES (
  'AI时代的教学设计实践',
  '深入学习AI辅助教学设计的方法与实践，掌握如何利用AI工具提升教学效果。',
  '建构主义',
  '中级',
  90,
  2.0,
  '张老师',
  'published',
  'https://meeting.tencent.com/crm/example123',
  10
);

-- 批量添加多门课程
INSERT INTO courses (title, description, category, level, duration, status, meeting_url) VALUES
  ('课程1', '描述1', '建构主义', '入门', 60, 'published', 'https://...'),
  ('课程2', '描述2', '认知负荷理论', '初级', 90, 'published', 'https://...'),
  ('课程3', '描述3', '教学目标', '中级', 120, 'published', 'https://...');
```

### 方法3：使用 API 添加（推荐用于生产环境）

**创建课程管理API：**

```typescript
// src/db/api.ts

/**
 * 添加新课程
 * @param courseData 课程数据
 * @returns 新创建的课程
 */
export async function createCourse(courseData: Partial<Course>): Promise<Course | null> {
  try {
    const { data, error } = await supabase
      .from('courses')
      .insert([{
        ...courseData,
        status: 'published', // 默认发布状态
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('创建课程失败:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('创建课程异常:', error);
    return null;
  }
}
```

---

## 🔄 数据流程

### 添加新课程后的完整流程

```
1. 在数据库中添加新课程
   ↓
2. 设置 status = 'published'
   ↓
3. 用户访问课程中心页面
   ↓
4. 前端调用 getCourses() API
   ↓
5. API 查询 courses 表
   WHERE status = 'published'
   ↓
6. 返回所有已发布的课程（包括新课程）
   ↓
7. 前端渲染课程卡片列表
   ↓
8. 用户点击新课程卡片
   ↓
9. 路由跳转到 /courses/{新课程ID}
   ↓
10. 前端调用 getCourseById(id) API
   ↓
11. API 查询课程详情
   ↓
12. 渲染课程详情页
```

---

## 📊 数据库字段说明

### courses 表结构

| 字段名 | 数据类型 | 默认值 | 说明 |
|--------|---------|--------|------|
| **id** | UUID | 自动生成 | 课程唯一标识 |
| **title** | VARCHAR | - | 课程标题（必填） |
| **description** | TEXT | NULL | 课程描述 |
| **instructor** | VARCHAR | NULL | 讲师姓名 |
| **category_id** | UUID | NULL | 分类ID（外键） |
| **category** | VARCHAR | NULL | 分类名称 |
| **level** | ENUM | '入门' | 难度级别 |
| **semester** | VARCHAR | NULL | 学期 |
| **duration** | INTEGER | 60 | 课程时长（分钟） |
| **credits** | NUMERIC | 0.0 | 学分 |
| **status** | ENUM | 'draft' | 发布状态 |
| **image_url** | TEXT | NULL | 课程封面图 |
| **video_url** | TEXT | NULL | 视频链接 |
| **meeting_url** | TEXT | NULL | 会议链接 |
| **sort_order** | INTEGER | 0 | 排序顺序 |
| **view_count** | INTEGER | 0 | 浏览次数 |
| **created_at** | TIMESTAMPTZ | now() | 创建时间 |
| **updated_at** | TIMESTAMPTZ | now() | 更新时间 |

### 重要字段说明

**status（发布状态）：**
- `draft` - 草稿（不显示在前端）
- `published` - 已发布（显示在前端）
- `archived` - 已归档（不显示在前端）

**level（难度级别）：**
- `入门` - 灰色标签
- `初级` - 绿色标签
- `中级` - 蓝色标签
- `高级` - 紫色标签

---

## 🎨 课程卡片显示内容

### 前端自动显示的信息

**课程卡片（CoursesPage）：**
1. ✅ 课程封面图（image_url 或默认图片）
2. ✅ 课程标题（title）
3. ✅ 课程分类（category）- 半透明标签
4. ✅ 难度级别（level）- 彩色标签
5. ✅ 课程时长（duration）- 时钟图标
6. ✅ 课程评分（固定5.0星）
7. ✅ 课程描述（description）- 截断显示

**课程详情页（CourseDetailPage）：**
1. ✅ 课程封面图（大图）
2. ✅ 课程标题
3. ✅ 课程分类标签
4. ✅ 难度级别标签
5. ✅ 课程时长
6. ✅ 课程学分（如果有）
7. ✅ 讲师姓名（如果有）
8. ✅ 课程描述（完整）
9. ✅ 观看课程按钮（meeting_url）
10. ✅ 课程亮点（固定4个）
11. ✅ 适合人群（固定4类）
12. ✅ 温馨提示（如果有meeting_url）

---

## 🔍 验证功能

### 测试步骤

**1. 添加测试课程：**

```sql
INSERT INTO courses (
  title,
  description,
  category,
  level,
  duration,
  credits,
  instructor,
  status,
  meeting_url
) VALUES (
  '测试课程 - AI教学设计',
  '这是一门测试课程，用于验证动态生成功能。',
  '建构主义',
  '中级',
  90,
  2.0,
  '测试讲师',
  'published',
  'https://meeting.tencent.com/crm/test123'
);
```

**2. 刷新课程中心页面：**
- 访问 `/courses`
- 应该能看到新的"测试课程 - AI教学设计"卡片

**3. 点击课程卡片：**
- 点击新课程卡片
- 应该跳转到课程详情页
- 显示完整的课程信息

**4. 验证分类筛选：**
- 点击"建构主义"分类Tab
- 应该能看到新课程

**5. 验证课程详情：**
- 检查所有字段是否正确显示
- 点击"观看课程"按钮
- 应该打开腾讯会议链接

---

## 🚀 高级功能

### 1. 自动刷新（可选）

如果您希望页面自动刷新显示新课程，可以添加轮询功能：

```typescript
// src/pages/CoursesPage.tsx

useEffect(() => {
  const loadData = async () => {
    const [coursesData, categoriesData] = await Promise.all([
      getCourses(),
      getCourseCategories()
    ]);
    setCourses(coursesData);
    setCategories(categoriesData);
  };

  // 初始加载
  loadData();

  // 每30秒自动刷新一次（可选）
  const interval = setInterval(loadData, 30000);

  // 清理定时器
  return () => clearInterval(interval);
}, []);
```

### 2. 课程管理界面（可选）

如果您需要在前端添加课程管理功能，可以创建一个管理页面：

**功能包括：**
- ✅ 添加新课程
- ✅ 编辑课程信息
- ✅ 删除课程
- ✅ 修改发布状态
- ✅ 批量操作

### 3. 实时更新（可选）

使用 Supabase Realtime 实现实时更新：

```typescript
// 订阅 courses 表的变化
useEffect(() => {
  const subscription = supabase
    .channel('courses-changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'courses' },
      (payload) => {
        console.log('课程数据变化:', payload);
        // 重新加载课程列表
        loadData();
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, []);
```

---

## 📋 常见问题

### Q1: 添加新课程后，前端看不到？

**可能原因：**
1. ❌ status 字段不是 'published'
2. ❌ 浏览器缓存未刷新
3. ❌ 数据库连接问题

**解决方法：**
```sql
-- 检查课程状态
SELECT id, title, status FROM courses WHERE title = '您的课程标题';

-- 如果status不是published，更新它
UPDATE courses SET status = 'published' WHERE id = '课程ID';
```

### Q2: 课程详情页显示"课程不存在"？

**可能原因：**
1. ❌ 课程ID不正确
2. ❌ 课程已被删除
3. ❌ status 不是 'published'

**解决方法：**
```sql
-- 检查课程是否存在
SELECT * FROM courses WHERE id = '课程ID';
```

### Q3: 课程卡片显示不完整？

**可能原因：**
1. ⚠️ 某些字段为空（description, image_url等）

**解决方法：**
- 填写完整的课程信息
- 前端会使用默认值显示

### Q4: 如何修改课程信息？

**方法1：在数据库中直接修改**
```sql
UPDATE courses 
SET 
  title = '新标题',
  description = '新描述',
  updated_at = now()
WHERE id = '课程ID';
```

**方法2：创建编辑API**
```typescript
export async function updateCourse(
  courseId: string, 
  updates: Partial<Course>
): Promise<Course | null> {
  const { data, error } = await supabase
    .from('courses')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', courseId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### Q5: 如何删除课程？

**软删除（推荐）：**
```sql
-- 将状态改为archived，不显示在前端
UPDATE courses SET status = 'archived' WHERE id = '课程ID';
```

**硬删除：**
```sql
-- 永久删除课程
DELETE FROM courses WHERE id = '课程ID';
```

---

## ✅ 功能检查清单

### 已实现的功能

- [x] 从数据库动态获取课程列表
- [x] 自动生成课程卡片
- [x] 支持动态路由（/courses/:id）
- [x] 根据ID动态加载课程详情
- [x] 支持按分类筛选课程
- [x] 显示课程的所有信息
- [x] 点击卡片跳转到详情页
- [x] 观看课程按钮跳转到会议链接
- [x] 自动统计浏览次数
- [x] 加载状态显示
- [x] 错误处理
- [x] 空状态处理

### 可选的增强功能

- [ ] 自动刷新课程列表
- [ ] 课程管理界面
- [ ] 实时更新（Realtime）
- [ ] 课程搜索功能
- [ ] 课程排序功能
- [ ] 课程收藏功能
- [ ] 课程评论功能

---

## 🎉 总结

**您想要的功能已经完全实现！**

只需要在 `courses` 数据库表中添加新的课程记录，设置 `status = 'published'`，然后刷新前端页面，就能看到：

1. ✅ 课程中心页面自动显示新的课程卡片
2. ✅ 点击卡片可以进入课程详情页
3. ✅ 课程详情页显示完整的课程信息
4. ✅ 所有功能都是动态的，无需修改代码

**下一步操作：**
1. 在数据库中添加一门测试课程
2. 刷新课程中心页面
3. 验证新课程是否正确显示
4. 点击进入详情页验证功能

如果您需要添加课程管理界面或其他高级功能，请告诉我！

---

**文档版本：** v1.0

**更新时间：** 2025-12-30

**功能状态：** ✅ 已完全实现
