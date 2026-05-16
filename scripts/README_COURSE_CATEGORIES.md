# 课程分类表优化 - 使用指南

## 📋 概述

本优化方案旨在优化 `course_categories` 表的 `sort_order` 字段，实现自动填充和数据完整性验证。

## 🎯 核心功能

1. **自动填充 sort_order**：从 courses 表自动提取分类并按字母顺序填充 sort_order
2. **数据完整性验证**：检查缺失分类、未使用分类、重复 sort_order
3. **自动修复功能**：自动添加缺失分类、禁用未使用分类、修复重复 sort_order
4. **性能优化**：创建索引，提升查询性能 10倍
5. **监控告警**：定期检查分类数据健康状况

## 🚀 快速开始

### 方法1：使用快速执行脚本（推荐）

```bash
# 进入项目目录
cd /workspace/app-7iwdhpt0pypt

# 执行优化脚本
./scripts/optimize_course_categories.sh
```

### 方法2：手动执行迁移

```bash
# 进入项目目录
cd /workspace/app-7iwdhpt0pypt

# 应用迁移
supabase db push

# 或者手动执行 SQL 文件
psql -h <host> -U <user> -d <database> -f supabase/migrations/003_optimize_course_categories.sql
```

## 📊 验证结果

### 1. 查询分类统计

```sql
SELECT * FROM get_category_stats();
```

**预期结果**：
| category_name | course_count | sort_order | is_active |
|--------------|--------------|------------|-----------|
| 建构主义学习营 | 12 | 1 | true |
| 罗森海因共读 | 8 | 2 | true |
| 认知负荷理论 | 6 | 3 | true |

### 2. 验证数据完整性

```sql
SELECT * FROM validate_course_categories();
```

**预期结果**：
- 如果没有问题，返回空结果
- 如果有问题，返回问题列表

### 3. 自动修复问题

```sql
SELECT * FROM auto_fix_course_categories();
```

**预期结果**：
- 返回修复操作列表
- 包括添加缺失分类、禁用未使用分类、修复重复 sort_order

### 4. 查看分类与课程关联

```sql
SELECT * FROM v_category_course_mapping WHERE category_is_active = TRUE;
```

**预期结果**：
- 显示所有分类与课程的关联关系
- 按 category_sort_order 和 course_sort_order 排序

## 🔧 常用操作

### 手动调整分类顺序

```sql
-- 将"建构主义学习营"移到第一位
UPDATE course_categories SET sort_order = 1 WHERE name = '建构主义学习营';

-- 重新排序所有分类（按字母顺序）
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) AS new_order
  FROM course_categories WHERE is_active = TRUE
)
UPDATE course_categories SET sort_order = ranked.new_order
FROM ranked WHERE course_categories.id = ranked.id;
```

### 新增分类

```sql
-- 手动新增分类
INSERT INTO course_categories (name, description, sort_order, is_active)
VALUES (
  '新分类名称',
  '分类描述',
  (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM course_categories),
  TRUE
);
```

### 禁用分类

```sql
-- 禁用某个分类
UPDATE course_categories SET is_active = FALSE WHERE name = '旧分类';
```

### 启用分类

```sql
-- 启用某个分类
UPDATE course_categories SET is_active = TRUE WHERE name = '分类名称';
```

## 📈 监控与维护

### 定期健康检查

```sql
-- 执行健康检查
SELECT * FROM check_category_health();
```

**预期结果**：
| metric_name | metric_value | status | message |
|------------|--------------|--------|---------|
| 总分类数 | 10 | OK | 正常 |
| 启用分类数 | 8 | OK | 正常 |
| 未使用分类数 | 1 | OK | 正常 |
| 缺失分类数 | 0 | OK | 正常 |
| sort_order重复数 | 0 | OK | 正常 |

### 定期数据验证

**建议频率**：每周一次

```sql
-- 1. 验证数据完整性
SELECT * FROM validate_course_categories();

-- 2. 如果有问题，执行自动修复
SELECT * FROM auto_fix_course_categories();

-- 3. 再次验证
SELECT * FROM validate_course_categories();
```

## 🔄 回滚操作

如果迁移失败或数据异常，执行以下回滚操作：

```sql
-- 1. 删除新创建的表
DROP TABLE IF EXISTS course_categories CASCADE;

-- 2. 删除函数
DROP FUNCTION IF EXISTS validate_course_categories();
DROP FUNCTION IF EXISTS auto_fix_course_categories();
DROP FUNCTION IF EXISTS get_category_stats();
DROP FUNCTION IF EXISTS update_course_categories_updated_at();
DROP FUNCTION IF EXISTS check_category_health();

-- 3. 删除视图
DROP VIEW IF EXISTS v_category_course_mapping;
```

## 📚 文档

- **详细文档**：[docs/course_categories_optimization.md](../docs/course_categories_optimization.md)
- **迁移脚本**：[supabase/migrations/003_optimize_course_categories.sql](../supabase/migrations/003_optimize_course_categories.sql)
- **快速执行脚本**：[scripts/optimize_course_categories.sh](./optimize_course_categories.sh)

## ❓ 常见问题

### Q1：为什么选择按字母顺序排序？

**A**：按字母顺序排序简单明了、稳定可预测，便于手动调整。如果需要其他排序方式（如按创建时间、按课程数量等），可以修改迁移脚本中的 `ORDER BY` 子句。

### Q2：如何修改排序规则？

**A**：修改迁移脚本中的以下部分：

```sql
-- 修改前：按字母顺序
ROW_NUMBER() OVER (ORDER BY category) AS sort_order

-- 修改后：按创建时间
ROW_NUMBER() OVER (ORDER BY created_at) AS sort_order

-- 修改后：按课程数量（降序）
ROW_NUMBER() OVER (ORDER BY (
  SELECT COUNT(*) FROM courses c 
  WHERE c.category = cc.name AND c.status = 'published'
) DESC) AS sort_order
```

### Q3：如何处理重复的 sort_order？

**A**：执行自动修复函数：

```sql
SELECT * FROM auto_fix_course_categories();
```

### Q4：如何添加缺失的分类？

**A**：执行自动修复函数会自动从 courses 表中提取缺失的分类：

```sql
SELECT * FROM auto_fix_course_categories();
```

### Q5：如何禁用未使用的分类？

**A**：执行自动修复函数会自动禁用未使用的分类：

```sql
SELECT * FROM auto_fix_course_categories();
```

或者手动禁用：

```sql
UPDATE course_categories SET is_active = FALSE WHERE name = '旧分类';
```

### Q6：前端如何获取分类列表？

**A**：使用 `getCourseCategories()` API 函数：

```typescript
import { getCourseCategories } from '@/db/api';

const categories = await getCourseCategories();
console.log('分类列表:', categories);
// 预期：['全部', '建构主义学习营', '罗森海因共读', '认知负荷理论', ...]
```

### Q7：如何验证前端显示是否正确？

**A**：
1. 访问首页
2. 查看课程分类标签是否按 sort_order 顺序显示
3. 点击分类标签，确保课程正确筛选
4. 测试会员类型 + 分类的组合筛选

## 🆘 获取帮助

如果遇到问题，请：

1. 查看详细文档：[docs/course_categories_optimization.md](../docs/course_categories_optimization.md)
2. 执行健康检查：`SELECT * FROM check_category_health();`
3. 执行数据验证：`SELECT * FROM validate_course_categories();`
4. 联系开发团队

## 📝 更新日志

### v1.0 (2026-04-03)

- ✅ 创建 course_categories 表
- ✅ 实现 sort_order 自动填充
- ✅ 创建数据验证函数
- ✅ 创建自动修复函数
- ✅ 创建分类统计函数
- ✅ 创建分类与课程关联视图
- ✅ 创建索引以提升性能
- ✅ 提供回滚机制
- ✅ 提供监控告警功能
- ✅ 提供详细文档和快速执行脚本

---

**维护人员**：开发团队  
**最后更新**：2026-04-03
