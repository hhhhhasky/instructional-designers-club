# 数据库表使用情况分析报告

## 📊 分析时间
2025-11-13

## 📋 数据库表总览

| 表名 | 数据量 | 状态 | 说明 |
|-----|-------|------|------|
| courses | 80 | ✅ 使用中 | 核心课程表 |
| course_categories | 16 | ✅ 使用中 | 课程分类表 |
| course_series_tags | 41 | ✅ 使用中 | 课程系列标签表 |
| visitor_stats | 4124 | ✅ 使用中 | 访问统计表 |
| course_chapters | 0 | ❌ 未使用 | 课程章节表（空表） |
| course_details | 0 | ❌ 未使用 | 课程详情表（空表） |
| course_logs | 0 | ❌ 未使用 | 课程日志表（空表） |
| course_resources | 0 | ❌ 未使用 | 课程资源表（空表） |
| course_versions | 0 | ❌ 未使用 | 课程版本表（空表） |
| operation_logs | 3 | ⚠️ 可删除 | 操作日志表（有数据但未使用） |
| profiles | 0 | ❌ 未使用 | 用户配置表（空表） |

## ✅ 正在使用的表（保留）

### 1. courses
- **数据量**: 80 条
- **用途**: 存储所有课程信息
- **代码引用**: 
  - `getCourses()` - 获取所有课程
  - `getCourseById()` - 获取单个课程
  - `getCoursesByCategory()` - 按分类获取课程
  - `getCoursesByMembershipType()` - 按会员类型获取课程
  - `getCoursesByMembershipAndCategory()` - 按会员类型和分类获取课程
  - `getClubStats()` - 获取俱乐部统计数据
  - `incrementCourseViewCount()` - 增加浏览次数
- **关联**: 
  - 外键关联到 course_categories (category 字段)
  - 被 course_series_tags 间接关联

### 2. course_categories
- **数据量**: 16 条
- **用途**: 存储课程分类信息，支持场景筛选
- **代码引用**:
  - `getCourseCategories()` - 获取所有分类
  - `getCategoriesByMembershipType()` - 获取指定会员类型的分类
  - `validateCategoryData()` - 验证分类数据完整性
  - `getClubStats()` - 获取学习营数量
  - `getCourseSeriesTagsByCategoryName()` - 通过分类名称获取标签
  - `getAllCourseSeriesTags()` - 获取所有标签（关联查询）
- **新增字段**:
  - `scenarios` - 场景 ID 数组
  - `tags_summary` - 标签摘要（JSONB）
- **关联**:
  - 被 courses 表引用 (category 字段)
  - 被 course_series_tags 表引用 (category_id 外键)

### 3. course_series_tags
- **数据量**: 41 条
- **用途**: 存储课程系列标签，用于场景筛选功能
- **代码引用**:
  - `getCourseSeriesTagsByCategoryId()` - 通过分类ID获取标签
  - `getCourseSeriesTagsByCategoryName()` - 通过分类名称获取标签
  - `getAllCourseSeriesTags()` - 获取所有标签
  - `getCourseSeriesTagsByType()` - 按类型获取标签
  - `getActiveScenarioTypes()` - 获取活跃的场景类型
- **关联**:
  - 外键关联到 course_categories (category_id)
  - 触发器自动同步到 course_categories.tags_summary

### 4. visitor_stats
- **数据量**: 4124 条
- **用途**: 记录访问统计数据
- **代码引用**:
  - `recordVisit()` - 记录访问（通过 Edge Function 和 RPC）
  - `getVisitorStats()` - 获取统计数据
- **关联**: 独立表，无外键关联

## ❌ 未使用的表（建议删除）

### 1. course_chapters
- **数据量**: 0 条
- **问题**: 
  - 表为空，无任何数据
  - 代码中未引用
  - 有触发器 `update_course_chapters_updated_at` 但无实际用途
- **建议**: 删除

### 2. course_details
- **数据量**: 0 条
- **问题**:
  - 表为空，无任何数据
  - 代码中未引用
  - 有触发器 `log_course_details_changes` 和 `update_course_details_updated_at`
  - 有函数 `log_course_changes()` 但未被调用
- **建议**: 删除

### 3. course_logs
- **数据量**: 0 条
- **问题**:
  - 表为空，无任何数据
  - 代码中未引用
  - 无触发器或函数使用
- **建议**: 删除

### 4. course_resources
- **数据量**: 0 条
- **问题**:
  - 表为空，无任何数据
  - 代码中未引用
  - 有触发器 `update_course_resources_updated_at` 但无实际用途
- **建议**: 删除

### 5. course_versions
- **数据量**: 0 条
- **问题**:
  - 表为空，无任何数据
  - 代码中未引用
  - 有函数 `rollback_course_version()` 和 `update_course_with_version()` 但未被调用
- **建议**: 删除

### 6. profiles
- **数据量**: 0 条
- **问题**:
  - 表为空，无任何数据
  - 代码中未引用
  - 无触发器或函数使用
- **建议**: 删除

### 7. operation_logs
- **数据量**: 3 条
- **问题**:
  - 有少量历史数据（记录了课程的 INSERT/UPDATE 操作）
  - 代码中未引用，未被查询使用
  - 无触发器自动记录新数据
  - 数据已过时（最新记录是 2025-12-30）
- **建议**: 删除（如需审计功能，可以先导出数据）

## 🔧 需要清理的函数

以下函数与未使用的表相关，建议一并删除：

1. `log_course_changes()` - 用于 course_details 表
2. `rollback_course_version()` - 用于 course_versions 表
3. `update_course_with_version()` - 用于 course_versions 表
4. `create_course_with_details()` - 用于 course_details 表
5. `get_course_full_info()` - 用于 course_details 表

## 📈 保留的函数（正在使用）

1. `record_visit()` - 记录访问统计 ✅
2. `increment_course_view_count()` - 增加课程浏览次数 ✅
3. `sync_category_tags_summary()` - 同步标签摘要 ✅
4. `update_course_categories_updated_at()` - 更新分类时间戳 ✅
5. `update_course_series_tags_updated_at()` - 更新标签时间戳 ✅
6. `update_updated_at_column()` - 通用时间戳更新 ✅
7. `auto_fix_course_categories()` - 自动修复分类 ✅
8. `validate_course_categories()` - 验证分类 ✅
9. `get_category_stats()` - 获取分类统计 ✅
10. `get_course_statistics()` - 获取课程统计 ✅
11. `search_courses()` - 搜索课程 ✅
12. `batch_update_courses()` - 批量更新课程 ✅
13. `is_admin()` - 权限检查 ✅
14. `is_editor_or_admin()` - 权限检查 ✅

## 💾 数据备份建议

在删除表之前，建议备份以下表的数据（虽然大部分为空）：

```sql
-- 备份 operation_logs（有3条历史数据）
COPY operation_logs TO '/tmp/operation_logs_backup.csv' CSV HEADER;
```

## 🎯 删除后的数据库结构

删除未使用的表后，数据库将保留以下核心表：

1. **courses** - 课程主表
2. **course_categories** - 课程分类表
3. **course_series_tags** - 课程系列标签表
4. **visitor_stats** - 访问统计表

这4个表构成了完整的课程管理和统计系统，满足当前所有功能需求。

## 📊 预期效果

- **减少表数量**: 从 11 个表减少到 4 个表（减少 64%）
- **减少函数数量**: 从 19 个函数减少到 14 个函数（减少 26%）
- **减少触发器数量**: 从 13 个触发器减少到 5 个触发器（减少 62%）
- **提升维护效率**: 数据库结构更清晰，更易于维护
- **提升查询性能**: 减少不必要的表和索引，提升整体性能
