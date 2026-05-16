# 数据库结构图（清理后）

## 📊 核心表结构

```
┌─────────────────────────────────────────────────────────────────┐
│                      教学设计师俱乐部数据库                        │
│                         (4 个核心表)                              │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                         visitor_stats                             │
│                        (访问统计表)                                │
├──────────────────────────────────────────────────────────────────┤
│ • visitor_uuid (PK)      访问者唯一标识                           │
│ • visit_count            访问次数                                 │
│ • first_visit_at         首次访问时间                             │
│ • last_visit_at          最后访问时间                             │
│ • created_at             创建时间                                 │
├──────────────────────────────────────────────────────────────────┤
│ 数据量: 4124 条                                                   │
│ 用途: 记录访问统计数据                                            │
│ 函数: record_visit(), getVisitorStats()                          │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                      course_categories                            │
│                       (课程分类表)                                 │
├──────────────────────────────────────────────────────────────────┤
│ • id (PK)                分类ID                                   │
│ • name                   分类名称                                 │
│ • description            分类描述                                 │
│ • sort_order             排序                                     │
│ • is_active              是否启用                                 │
│ • scenarios              场景ID数组 (TEXT[])                      │
│ • tags_summary           标签摘要 (JSONB)                         │
│ • created_at             创建时间                                 │
│ • updated_at             更新时间                                 │
├──────────────────────────────────────────────────────────────────┤
│ 数据量: 16 条                                                     │
│ 用途: 存储课程分类，支持场景筛选                                   │
│ 函数: getCourseCategories(), getCategoriesByMembershipType()     │
│ 触发器: trigger_update_course_categories_updated_at              │
└──────────────────────────────────────────────────────────────────┘
                                ↑
                                │ (外键: category_id)
                                │
┌──────────────────────────────────────────────────────────────────┐
│                     course_series_tags                            │
│                     (课程系列标签表)                               │
├──────────────────────────────────────────────────────────────────┤
│ • id (PK)                标签ID                                   │
│ • category_id (FK)       分类ID → course_categories.id           │
│ • category_type          分类维度                                 │
│ • tag_name               标签文本                                 │
│ • tag_color              标签颜色                                 │
│ • sort_order             排序                                     │
│ • is_active              是否启用                                 │
│ • created_at             创建时间                                 │
│ • updated_at             更新时间                                 │
├──────────────────────────────────────────────────────────────────┤
│ 数据量: 41 条                                                     │
│ 用途: 存储课程系列标签，用于场景筛选                               │
│ 函数: getCourseSeriesTagsByCategoryId()                          │
│ 触发器: trigger_sync_category_tags_summary (自动同步到            │
│         course_categories.tags_summary)                          │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                          courses                                  │
│                        (课程主表)                                  │
├──────────────────────────────────────────────────────────────────┤
│ • id (PK)                课程ID                                   │
│ • title                  课程标题                                 │
│ • description            课程描述                                 │
│ • instructor             讲师                                     │
│ • category               分类 → course_categories.name            │
│ • category_id            分类ID                                   │
│ • level                  难度级别                                 │
│ • semester               学期                                     │
│ • duration               时长                                     │
│ • credits                学分                                     │
│ • status                 状态 (draft/published/archived)          │
│ • membership_type        会员类型 (free/plus/pro)                 │
│ • is_trial               是否试看                                 │
│ • image_url              封面图片                                 │
│ • video_url              视频链接                                 │
│ • meeting_url            会议链接                                 │
│ • sort_order             排序                                     │
│ • view_count             浏览次数                                 │
│ • created_at             创建时间                                 │
│ • updated_at             更新时间                                 │
├──────────────────────────────────────────────────────────────────┤
│ 数据量: 80 条                                                     │
│ 用途: 存储所有课程信息                                            │
│ 函数: getCourses(), getCourseById(), getCoursesByCategory()      │
│ 触发器: update_courses_updated_at                                │
└──────────────────────────────────────────────────────────────────┘
                                ↑
                                │ (引用: category)
                                │
                    course_categories.name
```

## 🔗 表关系说明

### 1. course_categories ← course_series_tags
- **关系类型**: 一对多
- **外键**: course_series_tags.category_id → course_categories.id
- **级联删除**: ON DELETE CASCADE
- **自动同步**: 触发器自动同步标签到 course_categories.tags_summary

### 2. course_categories ← courses
- **关系类型**: 一对多
- **引用**: courses.category → course_categories.name
- **说明**: 通过分类名称关联，不是外键约束

### 3. visitor_stats
- **关系类型**: 独立表
- **说明**: 无外键关联，独立记录访问统计

## 📈 数据统计

| 表名 | 数据量 | 列数 | 索引数 | 触发器数 |
|-----|-------|------|-------|---------|
| courses | 80 | 20 | 多个 | 1 |
| course_categories | 16 | 9 | 2 (GIN) | 2 |
| course_series_tags | 41 | 9 | 多个 | 4 |
| visitor_stats | 4124 | 5 | 多个 | 0 |

## 🔧 核心函数列表

### 访问统计
- `record_visit(p_visitor_uuid)` - 记录访问并返回统计数据

### 课程查询
- `getCourses()` - 获取所有已发布课程
- `getCourseById(courseId)` - 获取单个课程详情
- `getCoursesByCategory(category)` - 按分类获取课程
- `getCoursesByMembershipType(membershipType)` - 按会员类型获取课程
- `getCoursesByMembershipAndCategory(membershipType, category)` - 按会员类型和分类获取课程
- `search_courses()` - 搜索课程
- `increment_course_view_count(course_id)` - 增加课程浏览次数

### 分类查询
- `getCourseCategories()` - 获取所有分类
- `getCategoriesByMembershipType(membershipType)` - 获取指定会员类型的分类
- `validate_course_categories()` - 验证分类数据完整性
- `auto_fix_course_categories()` - 自动修复分类
- `get_category_stats()` - 获取分类统计

### 标签查询
- `getCourseSeriesTagsByCategoryId(categoryId)` - 通过分类ID获取标签
- `getCourseSeriesTagsByCategoryName(categoryName)` - 通过分类名称获取标签
- `getAllCourseSeriesTags()` - 获取所有标签
- `getCourseSeriesTagsByType(categoryType)` - 按类型获取标签
- `getActiveScenarioTypes()` - 获取活跃的场景类型

### 统计查询
- `getClubStats()` - 获取俱乐部统计数据
- `get_course_statistics()` - 获取课程统计

### 批量操作
- `batch_update_courses()` - 批量更新课程

### 权限检查
- `is_admin()` - 管理员权限检查
- `is_editor_or_admin()` - 编辑者或管理员权限检查

## 🎯 数据流向

### 访问统计流程
```
用户访问 → recordVisit(uuid) → visitor_stats 表
                                    ↓
                            返回统计数据 (unique_visitors, total_visits)
```

### 课程查询流程
```
用户请求 → getCourses() → courses 表 (status = 'published')
                              ↓
                        按 sort_order 排序
                              ↓
                        返回课程列表
```

### 场景筛选流程
```
用户选择场景 → getFilteredCategories()
                    ↓
            查询 course_series_tags (category_type = 场景类型)
                    ↓
            获取匹配的 category_id
                    ↓
            筛选 course_categories
                    ↓
            返回筛选后的分类列表
```

### 标签同步流程
```
course_series_tags 表变化 (INSERT/UPDATE/DELETE)
                    ↓
        触发器 trigger_sync_category_tags_summary
                    ↓
        函数 sync_category_tags_summary()
                    ↓
        自动更新 course_categories.tags_summary (JSONB)
```

## 🔐 安全策略 (RLS)

所有表都启用了行级安全策略 (Row Level Security)，确保数据访问的安全性。

## 📝 备注

- **数据完整性**: 通过外键约束和触发器确保数据一致性
- **性能优化**: 使用 GIN 索引优化 JSONB 和数组字段查询
- **自动同步**: 触发器自动同步标签数据到分类表
- **扩展性**: 预留 scenarios 和 tags_summary 字段支持未来功能扩展
