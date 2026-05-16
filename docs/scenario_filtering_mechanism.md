# Plus 课程场景筛选机制详解

## 📋 概述

Plus 课程的场景入口筛选功能通过 **course_series_tags** 表的 **category_type** 字段来判断课程分类是否属于某个场景。

## 🗄️ 涉及的数据库表和字段

### 1. course_series_tags（课程系列标签表）

这是场景筛选的**核心表**，存储每个课程分类的标签信息。

| 字段名 | 类型 | 说明 | 在筛选中的作用 |
|-------|------|------|---------------|
| **id** | UUID | 标签ID（主键） | 唯一标识 |
| **category_id** | UUID | 课程分类ID（外键） | 关联到 course_categories.id |
| **category_type** | TEXT | 标签类型/分类维度 | **筛选的关键字段** |
| **tag_name** | TEXT | 标签名称 | 显示用 |
| **tag_color** | TEXT | 标签颜色 | 显示用 |
| **sort_order** | INTEGER | 排序 | 显示顺序 |
| **is_active** | BOOLEAN | 是否启用 | 筛选时只查询 true 的标签 |
| **created_at** | TIMESTAMP | 创建时间 | 记录用 |
| **updated_at** | TIMESTAMP | 更新时间 | 记录用 |

#### 关键字段：category_type

**category_type** 是场景筛选的核心判断字段，它定义了标签的分类维度。目前系统中的 category_type 包括：

- **内容类型**：理论深度、实践导向、案例分析、工具应用等
- **适用人群**：一线老师、创新教育老师等
- **适用场景**：公开课、日常课、效率提升、通识教育等
- **难度级别**：基础、进阶等
- **场景-公开课**：专门用于"我要准备公开课/赛课"场景筛选
- **场景-日常课**：专门用于"我要准备日常课"场景筛选
- **场景-创新教育**：专门用于"我是创新教育老师"场景筛选（待补充数据）
- **场景-家长**：专门用于"我是家长"场景筛选（待补充数据）

### 2. course_categories（课程分类表）

存储课程分类的基本信息，通过外键被 course_series_tags 引用。

| 字段名 | 类型 | 说明 | 在筛选中的作用 |
|-------|------|------|---------------|
| **id** | UUID | 分类ID（主键） | 被 course_series_tags.category_id 引用 |
| **name** | TEXT | 分类名称 | 显示课程系列名称 |
| **description** | TEXT | 分类描述 | 显示用 |
| **sort_order** | INTEGER | 排序 | 显示顺序 |
| **is_active** | BOOLEAN | 是否启用 | 筛选时只查询 true 的分类 |
| **scenarios** | TEXT[] | 场景ID数组 | 快速查询该分类关联的场景 |
| **tags_summary** | JSONB | 标签摘要 | 自动同步的标签汇总 |
| **created_at** | TIMESTAMP | 创建时间 | 记录用 |
| **updated_at** | TIMESTAMP | 更新时间 | 记录用 |

#### 新增字段：scenarios

**scenarios** 字段是一个 TEXT[] 数组，存储该分类关联的场景 ID（如 ['open-class', 'daily-class']）。这个字段提供了一种快速查询方式，但目前前端筛选逻辑主要使用 course_series_tags 表。

### 3. courses（课程表）

存储具体的课程信息，通过 category 字段关联到 course_categories。

| 字段名 | 类型 | 说明 | 在筛选中的作用 |
|-------|------|------|---------------|
| **category** | TEXT | 课程分类名称 | 关联到 course_categories.name |
| **membership_type** | TEXT | 会员类型 | 筛选 Plus 会员课程 |

## 🔍 筛选逻辑详解

### 前端场景配置

在 `src/pages/CoursesPage.tsx` 中定义了 4 个场景配置：

```typescript
const scenarioConfigs: ScenarioConfig[] = [
  {
    id: 'open-class',
    name: '我要准备公开课/赛课',
    description: '精选适合公开展示的优质课程',
    icon: Presentation,
    color: 'from-teal-500 to-cyan-500',
    bgGradient: 'bg-gradient-to-br from-teal-50 to-cyan-50',
    categoryType: '场景-公开课'  // 对应 course_series_tags.category_type
  },
  {
    id: 'daily-class',
    name: '我要准备日常课',
    description: '日常教学实用技巧与方法',
    icon: FileText,
    color: 'from-indigo-500 to-blue-500',
    bgGradient: 'bg-gradient-to-br from-indigo-50 to-blue-50',
    categoryType: '场景-日常课'  // 对应 course_series_tags.category_type
  },
  {
    id: 'innovative-teacher',
    name: '我是创新教育老师',
    description: '探索前沿教育理念与技术',
    icon: Rocket,
    color: 'from-purple-500 to-pink-500',
    bgGradient: 'bg-gradient-to-br from-purple-50 to-pink-50',
    categoryType: '场景-创新教育'  // 对应 course_series_tags.category_type
  },
  {
    id: 'parent',
    name: '我是家长',
    description: '了解孩子学习与成长',
    icon: Users,
    color: 'from-orange-500 to-amber-500',
    bgGradient: 'bg-gradient-to-br from-orange-50 to-amber-50',
    categoryType: '场景-家长'  // 对应 course_series_tags.category_type
  }
];
```

### 筛选函数

```typescript
// 根据场景筛选分类列表（仅在 Plus 会员时生效）
const getFilteredCategories = (): string[] => {
  // 1. 如果不是 Plus 会员，或者没有选中场景，返回全部分类
  if (selectedMembershipType !== 'plus' || !selectedScenario) {
    return categories;
  }

  // 2. 获取选中场景的配置
  const scenario = scenarioConfigs.find(s => s.id === selectedScenario);
  if (!scenario) {
    return categories;
  }

  // 3. 筛选出包含该场景标签的分类
  return categories.filter(category => {
    const tags = seriesTags[category] || [];  // 获取该分类的所有标签
    return tags.some(tag => tag.category_type === scenario.categoryType);  // 判断是否有匹配的标签
  });
};
```

### 筛选流程图

```
用户点击场景按钮（如"我要准备公开课/赛课"）
    ↓
获取场景配置（categoryType = '场景-公开课'）
    ↓
遍历所有课程分类（categories）
    ↓
对每个分类，获取其标签列表（seriesTags[category]）
    ↓
检查标签列表中是否有 category_type = '场景-公开课' 的标签
    ↓
如果有，保留该分类；如果没有，过滤掉
    ↓
返回筛选后的分类列表
    ↓
页面只显示筛选后的课程系列
```

## 📊 数据示例

### 当前数据库中的场景标签数据

根据查询结果，目前数据库中**没有**以"场景-"开头的 category_type 数据。现有的 category_type 包括：

- **内容类型**：理论深度、实践导向、案例分析、工具应用、知识科普、Agent、入门科普
- **适用人群**：一线老师、创新教育老师
- **适用场景**：效率提升、通识教育、自动化备课、日常课、公开课、新手入门

### 场景筛选需要的数据结构

为了让场景筛选功能正常工作，需要在 course_series_tags 表中添加以下类型的标签：

#### 示例 1：教学目标分类

```sql
-- 为"教学目标"分类添加"场景-公开课"标签
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order, is_active)
VALUES (
  (SELECT id FROM course_categories WHERE name = '教学目标'),
  '场景-公开课',  -- 关键字段
  '公开课',
  'teal',
  10,
  true
);

-- 为"教学目标"分类添加"场景-日常课"标签
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order, is_active)
VALUES (
  (SELECT id FROM course_categories WHERE name = '教学目标'),
  '场景-日常课',  -- 关键字段
  '日常课',
  'indigo',
  11,
  true
);
```

#### 示例 2：AI工具分类

```sql
-- 为"AI工具"分类添加"场景-创新教育"标签
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order, is_active)
VALUES (
  (SELECT id FROM course_categories WHERE name = 'AI工具'),
  '场景-创新教育',  -- 关键字段
  '创新教育',
  'purple',
  10,
  true
);
```

## 🔗 数据关联关系

```
course_series_tags (标签表)
├── category_id (外键) → course_categories.id
├── category_type (筛选关键字段)
│   └── 匹配 scenarioConfigs[].categoryType
└── is_active = true (只查询启用的标签)

course_categories (分类表)
├── id (主键)
├── name (分类名称)
└── scenarios (场景ID数组，可选)

courses (课程表)
├── category → course_categories.name
└── membership_type = 'plus' (Plus会员课程)
```

## 🎯 筛选条件总结

一个课程分类要出现在某个场景的筛选结果中，需要满足以下**所有条件**：

1. **会员类型条件**：
   - 当前选择的会员类型必须是 **Plus**
   - 该分类下有 membership_type = 'plus' 的课程

2. **场景标签条件**：
   - 该分类在 course_series_tags 表中有对应的标签记录
   - 标签的 **category_type** 字段值等于场景配置的 **categoryType**
   - 标签的 **is_active** 字段为 **true**

3. **分类启用条件**：
   - 该分类在 course_categories 表中的 **is_active** 字段为 **true**

## 📝 判断字段总结

| 判断维度 | 数据库表 | 字段名 | 字段值 | 说明 |
|---------|---------|--------|--------|------|
| **场景匹配** | course_series_tags | **category_type** | '场景-公开课'<br>'场景-日常课'<br>'场景-创新教育'<br>'场景-家长' | **核心判断字段** |
| 标签启用 | course_series_tags | is_active | true | 只查询启用的标签 |
| 分类关联 | course_series_tags | category_id | UUID | 外键关联到分类 |
| 分类启用 | course_categories | is_active | true | 只查询启用的分类 |
| 会员类型 | - | selectedMembershipType | 'plus' | 前端状态，只在Plus时生效 |

## 🚀 如何添加新场景

### 步骤 1：在前端添加场景配置

在 `src/pages/CoursesPage.tsx` 的 `scenarioConfigs` 数组中添加新场景：

```typescript
{
  id: 'new-scenario',  // 场景ID
  name: '新场景名称',
  description: '场景描述',
  icon: SomeIcon,
  color: 'from-color-500 to-color-500',
  bgGradient: 'bg-gradient-to-br from-color-50 to-color-50',
  categoryType: '场景-新场景'  // 这个值要与数据库中的 category_type 一致
}
```

### 步骤 2：在数据库中添加场景标签

为相关的课程分类添加对应的场景标签：

```sql
-- 为某个分类添加新场景标签
INSERT INTO course_series_tags (category_id, category_type, tag_name, tag_color, sort_order, is_active)
VALUES (
  (SELECT id FROM course_categories WHERE name = '分类名称'),
  '场景-新场景',  -- 必须与前端 categoryType 一致
  '新场景',
  'blue',
  10,
  true
);
```

### 步骤 3：验证数据

```sql
-- 查询新场景的标签数据
SELECT 
  cst.category_type,
  cst.tag_name,
  cc.name as category_name
FROM course_series_tags cst
LEFT JOIN course_categories cc ON cst.category_id = cc.id
WHERE cst.category_type = '场景-新场景'
  AND cst.is_active = true;
```

## ⚠️ 注意事项

1. **category_type 命名规范**：
   - 场景标签的 category_type 必须以 `场景-` 开头
   - 前端 categoryType 和数据库 category_type 必须完全一致（区分大小写）

2. **数据一致性**：
   - 添加场景标签时，确保 category_id 对应的分类存在
   - 确保 is_active = true，否则不会被筛选

3. **触发器自动同步**：
   - 当 course_series_tags 表有变化时，触发器会自动更新 course_categories.tags_summary
   - 无需手动维护 tags_summary 字段

4. **场景数据缺失**：
   - 如果某个场景没有对应的标签数据，该场景会显示"即将推出"
   - 前端会统计每个场景下的课程系列数量

## 🔧 调试方法

### 查看某个分类的所有标签

```sql
SELECT 
  cst.category_type,
  cst.tag_name,
  cst.is_active
FROM course_series_tags cst
WHERE cst.category_id = (SELECT id FROM course_categories WHERE name = '分类名称')
ORDER BY cst.sort_order;
```

### 查看某个场景的所有分类

```sql
SELECT DISTINCT
  cc.name as category_name,
  cst.tag_name
FROM course_series_tags cst
LEFT JOIN course_categories cc ON cst.category_id = cc.id
WHERE cst.category_type = '场景-公开课'
  AND cst.is_active = true
ORDER BY cc.name;
```

### 查看所有场景标签

```sql
SELECT 
  category_type,
  COUNT(*) as tag_count,
  array_agg(DISTINCT cc.name) as categories
FROM course_series_tags cst
LEFT JOIN course_categories cc ON cst.category_id = cc.id
WHERE category_type LIKE '场景-%'
  AND is_active = true
GROUP BY category_type;
```

## 📚 相关文档

- [数据库结构图](../database_structure.md)
- [数据库分析报告](../database_analysis.md)
- [课程系列标签系统设计](./course_series_tags_design.md)
