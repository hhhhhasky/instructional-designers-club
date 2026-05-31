# 课程动态生成功能测试指南

## 🎯 快速测试

### 测试目标

验证在数据库中添加新课程后，前端能够自动显示新的课程卡片和详情页。

---

## 📝 测试步骤

### 步骤1：添加测试课程

**在 Supabase SQL Editor 中执行以下SQL：**

```sql
-- 添加一门测试课程
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
  image_url,
  sort_order
) VALUES (
  '【测试】AI驱动的个性化学习设计',
  '本课程深入探讨如何利用人工智能技术实现个性化学习路径设计，包括学习者画像分析、智能推荐算法、自适应学习系统等核心内容。通过理论讲解与实践案例相结合的方式，帮助教学设计师掌握AI时代的教学设计新方法。',
  '建构主义',
  '中级',
  120,
  3.0,
  '李明教授',
  'published',
  'https://meeting.tencent.com/crm/test-ai-learning-design',
  'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=600&fit=crop',
  100
);

-- 查询刚添加的课程
SELECT 
  id,
  title,
  category,
  level,
  duration,
  status,
  created_at
FROM courses
WHERE title LIKE '%测试%'
ORDER BY created_at DESC
LIMIT 1;
```

**预期结果：**
- ✅ 返回新添加的课程记录
- ✅ status 为 'published'
- ✅ 记录下课程ID（用于后续测试）

---

### 步骤2：验证课程中心页面

**操作：**
1. 打开浏览器，访问课程中心页面：`/courses`
2. 刷新页面（Ctrl+R 或 Cmd+R）

**预期结果：**
- ✅ 页面显示新的课程卡片
- ✅ 卡片标题：「【测试】AI驱动的个性化学习设计」
- ✅ 卡片显示分类标签：「建构主义」
- ✅ 卡片显示难度标签：「中级」（蓝色）
- ✅ 卡片显示时长：「120分钟」
- ✅ 卡片显示课程描述（截断）

**验证截图位置：**
- 课程卡片应该出现在课程列表中
- 如果设置了 sort_order=100，应该排在最后

---

### 步骤3：验证分类筛选

**操作：**
1. 在课程中心页面，点击「建构主义」分类Tab
2. 观察课程列表

**预期结果：**
- ✅ 只显示「建构主义」分类的课程
- ✅ 新添加的测试课程应该在列表中
- ✅ 其他分类的课程被隐藏

---

### 步骤4：验证课程详情页

**操作：**
1. 点击新添加的课程卡片
2. 等待页面跳转

**预期结果：**
- ✅ 跳转到课程详情页：`/courses/{课程ID}`
- ✅ 显示课程封面图
- ✅ 显示课程标题：「【测试】AI驱动的个性化学习设计」
- ✅ 显示分类标签：「建构主义」
- ✅ 显示难度标签：「中级」（蓝色）
- ✅ 显示课程统计信息：
  - 时长：120分钟
  - 学分：3.0学分
  - 讲师：李明教授
- ✅ 显示完整的课程描述
- ✅ 显示「观看课程」按钮（蓝色渐变）
- ✅ 显示课程亮点（4个）
- ✅ 显示适合人群（4类）
- ✅ 显示温馨提示

---

### 步骤5：验证观看课程功能

**操作：**
1. 在课程详情页，点击「观看课程」按钮
2. 在弹出的确认对话框中，点击「确认观看」

**预期结果：**
- ✅ 弹出确认对话框
- ✅ 对话框显示提示信息
- ✅ 点击「确认观看」后，新窗口打开会议链接
- ✅ 链接地址：`https://meeting.tencent.com/crm/test-ai-learning-design`

---

### 步骤6：验证浏览次数统计

**操作：**
1. 在 Supabase SQL Editor 中执行以下SQL：

```sql
-- 查询测试课程的浏览次数
SELECT 
  id,
  title,
  view_count
FROM courses
WHERE title LIKE '%测试%'
ORDER BY created_at DESC
LIMIT 1;
```

**预期结果：**
- ✅ view_count 应该 ≥ 1（每次访问详情页会自动+1）

---

## 🔍 详细验证清单

### 课程卡片验证

- [ ] 课程封面图显示正确
- [ ] 课程标题显示正确
- [ ] 分类标签显示正确（半透明背景）
- [ ] 难度标签显示正确（蓝色）
- [ ] 时长图标和数值显示正确
- [ ] 评分显示（5.0星）
- [ ] 课程描述显示（截断）
- [ ] 鼠标悬停有阴影效果
- [ ] 点击卡片可以跳转

### 课程详情页验证

- [ ] 页面标题正确
- [ ] 返回按钮可用
- [ ] 课程封面图显示正确（大图）
- [ ] 课程标题显示正确
- [ ] 分类标签显示正确
- [ ] 难度标签显示正确
- [ ] 课程时长显示正确
- [ ] 课程学分显示正确
- [ ] 讲师姓名显示正确
- [ ] 课程描述显示完整
- [ ] 观看课程按钮可用
- [ ] 课程亮点显示（4个）
- [ ] 适合人群显示（4类）
- [ ] 温馨提示显示
- [ ] 浏览更多课程按钮可用

### 交互功能验证

- [ ] 分类Tab点击切换正常
- [ ] 课程卡片点击跳转正常
- [ ] 返回按钮跳转正常
- [ ] 观看课程按钮打开链接正常
- [ ] 浏览更多课程按钮跳转正常
- [ ] 加载状态显示正常
- [ ] 错误状态显示正常

---

## 🧪 批量测试

### 添加多门测试课程

```sql
-- 批量添加5门测试课程
INSERT INTO courses (title, description, category, level, duration, credits, instructor, status, meeting_url, sort_order) VALUES
  (
    '【测试1】认知负荷理论在在线教学中的应用',
    '探讨如何在在线教学环境中应用认知负荷理论，优化教学设计，提升学习效果。',
    '认知负荷理论',
    '初级',
    60,
    1.5,
    '王芳老师',
    'published',
    'https://meeting.tencent.com/crm/test-clt-online',
    101
  ),
  (
    '【测试2】基于罗森海因原理的高效课堂设计',
    '学习罗森海因教学原理的核心要素，掌握高效课堂设计的方法与技巧。',
    '罗森海因教学原理',
    '中级',
    90,
    2.0,
    '张伟教授',
    'published',
    'https://meeting.tencent.com/crm/test-rosenshine',
    102
  ),
  (
    '【测试3】真实任务驱动的项目式学习设计',
    '深入了解项目式学习的设计原则，学习如何设计真实、有意义的学习任务。',
    '真实任务设计',
    '高级',
    150,
    3.5,
    '刘洋博士',
    'published',
    'https://meeting.tencent.com/crm/test-pbl-design',
    103
  ),
  (
    '【测试4】布卢姆教育目标分类学实践指南',
    '系统学习布卢姆教育目标分类学，掌握如何设计不同认知层次的教学目标。',
    '教学目标',
    '入门',
    45,
    1.0,
    '陈静老师',
    'published',
    'https://meeting.tencent.com/crm/test-bloom-taxonomy',
    104
  ),
  (
    '【测试5】学习科学前沿研究与教学应用',
    '介绍学习科学领域的最新研究成果，探讨如何将研究转化为教学实践。',
    '学习科学入门',
    '中级',
    75,
    2.0,
    '赵明教授',
    'published',
    'https://meeting.tencent.com/crm/test-learning-science',
    105
  );

-- 查询所有测试课程
SELECT 
  id,
  title,
  category,
  level,
  duration,
  status
FROM courses
WHERE title LIKE '%测试%'
ORDER BY sort_order;
```

**验证：**
- ✅ 课程中心应该显示6门测试课程（包括之前添加的1门）
- ✅ 每个分类Tab应该显示对应的测试课程
- ✅ 所有课程卡片都可以点击进入详情页

---

## 🗑️ 清理测试数据

### 测试完成后删除测试课程

```sql
-- 方法1：软删除（推荐）
-- 将测试课程状态改为archived，不显示在前端
UPDATE courses 
SET status = 'archived'
WHERE title LIKE '%测试%';

-- 方法2：硬删除
-- 永久删除测试课程
DELETE FROM courses 
WHERE title LIKE '%测试%';

-- 验证删除结果
SELECT COUNT(*) as remaining_test_courses
FROM courses
WHERE title LIKE '%测试%' AND status = 'published';
-- 应该返回 0
```

---

## 📊 性能测试

### 测试大量课程的加载性能

```sql
-- 添加100门测试课程（性能测试）
DO $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..100 LOOP
    INSERT INTO courses (
      title,
      description,
      category,
      level,
      duration,
      status,
      sort_order
    ) VALUES (
      '【性能测试】课程 ' || i,
      '这是第 ' || i || ' 门性能测试课程',
      CASE (i % 9)
        WHEN 0 THEN '建构主义'
        WHEN 1 THEN '认知负荷理论'
        WHEN 2 THEN '罗森海因教学原理'
        WHEN 3 THEN '真实任务设计'
        WHEN 4 THEN '教学目标'
        WHEN 5 THEN '学习科学入门'
        WHEN 6 THEN '重构讲授法'
        WHEN 7 THEN '选修课'
        ELSE '新会员必看'
      END,
      CASE (i % 4)
        WHEN 0 THEN '入门'
        WHEN 1 THEN '初级'
        WHEN 2 THEN '中级'
        ELSE '高级'
      END,
      60 + (i % 5) * 30,
      'published',
      1000 + i
    );
  END LOOP;
END $$;

-- 查询性能测试课程数量
SELECT COUNT(*) as performance_test_courses
FROM courses
WHERE title LIKE '%性能测试%';
```

**验证：**
- ✅ 课程中心页面加载时间 < 2秒
- ✅ 分类筛选响应时间 < 100ms
- ✅ 课程详情页加载时间 < 500ms
- ✅ 页面滚动流畅，无卡顿

**清理性能测试数据：**
```sql
DELETE FROM courses WHERE title LIKE '%性能测试%';
```

---

## ✅ 测试结果记录

### 测试环境

- 浏览器：_____________
- 操作系统：_____________
- 测试时间：_____________

### 测试结果

| 测试项 | 预期结果 | 实际结果 | 状态 |
|--------|---------|---------|------|
| 添加测试课程 | 成功添加 | | ☐ 通过 ☐ 失败 |
| 课程中心显示 | 显示新卡片 | | ☐ 通过 ☐ 失败 |
| 分类筛选 | 正确筛选 | | ☐ 通过 ☐ 失败 |
| 课程详情页 | 正确显示 | | ☐ 通过 ☐ 失败 |
| 观看课程 | 打开链接 | | ☐ 通过 ☐ 失败 |
| 浏览次数 | 自动增加 | | ☐ 通过 ☐ 失败 |
| 批量添加 | 全部显示 | | ☐ 通过 ☐ 失败 |
| 性能测试 | 加载流畅 | | ☐ 通过 ☐ 失败 |

### 问题记录

| 问题描述 | 严重程度 | 解决方案 |
|---------|---------|---------|
| | ☐ 高 ☐ 中 ☐ 低 | |
| | ☐ 高 ☐ 中 ☐ 低 | |
| | ☐ 高 ☐ 中 ☐ 低 | |

---

## 🎉 测试总结

### 功能验证

- [ ] 所有测试项都通过
- [ ] 功能完全符合预期
- [ ] 无严重问题

### 性能验证

- [ ] 加载速度满足要求
- [ ] 交互响应流畅
- [ ] 大量数据下性能良好

### 用户体验

- [ ] 界面美观
- [ ] 操作直观
- [ ] 错误提示友好

---

**测试文档版本：** v1.0

**更新时间：** 2025-12-30

**测试状态：** ☐ 待测试 ☐ 测试中 ☐ 已完成
