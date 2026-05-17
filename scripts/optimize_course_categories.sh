#!/bin/bash

# ============================================================================
# 课程分类表优化 - 快速执行脚本
# ============================================================================

set -e  # 遇到错误立即退出

echo "========================================="
echo "课程分类表优化 - 开始执行"
echo "========================================="

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 步骤1：检查 Supabase 配置
echo -e "${YELLOW}步骤1：检查 Supabase 配置...${NC}"
if [ ! -f "supabase/config.toml" ]; then
  echo -e "${RED}错误：未找到 Supabase 配置文件${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Supabase 配置文件存在${NC}"

# 步骤2：检查迁移文件
echo -e "${YELLOW}步骤2：检查迁移文件...${NC}"
if [ ! -f "supabase/migrations/003_optimize_course_categories.sql" ]; then
  echo -e "${RED}错误：未找到迁移文件${NC}"
  exit 1
fi
echo -e "${GREEN}✓ 迁移文件存在${NC}"

# 步骤3：显示迁移文件信息
echo -e "${YELLOW}步骤3：迁移文件信息${NC}"
echo "文件路径: supabase/migrations/003_optimize_course_categories.sql"
echo "文件大小: $(wc -c < supabase/migrations/003_optimize_course_categories.sql) bytes"
echo "文件行数: $(wc -l < supabase/migrations/003_optimize_course_categories.sql) lines"

# 步骤4：询问是否继续
echo ""
echo -e "${YELLOW}步骤4：确认执行${NC}"
echo "此操作将："
echo "  1. 创建 course_categories 表（如果不存在）"
echo "  2. 添加 sort_order 字段并自动填充"
echo "  3. 从 courses 表提取分类数据"
echo "  4. 创建索引、函数、视图"
echo "  5. 执行数据验证和自动修复"
echo ""
read -p "是否继续执行？(y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}操作已取消${NC}"
  exit 0
fi

# 步骤5：应用迁移
echo -e "${YELLOW}步骤5：应用迁移...${NC}"
echo "执行命令: supabase db push"
echo ""

# 检查是否安装了 Supabase CLI
if ! command -v supabase &> /dev/null; then
  echo -e "${RED}错误：未安装 Supabase CLI${NC}"
  echo "请先安装 Supabase CLI: https://supabase.com/docs/guides/cli"
  exit 1
fi

# 执行迁移
if supabase db push; then
  echo -e "${GREEN}✓ 迁移应用成功${NC}"
else
  echo -e "${RED}✗ 迁移应用失败${NC}"
  exit 1
fi

# 步骤6：验证迁移结果
echo ""
echo -e "${YELLOW}步骤6：验证迁移结果...${NC}"
echo "执行数据验证查询..."

# 创建临时 SQL 文件
cat > /tmp/verify_migration.sql << 'EOF'
-- 验证表结构
SELECT 
  'course_categories 表结构' AS check_type,
  COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_name = 'course_categories';

-- 验证数据
SELECT 
  '分类数据' AS check_type,
  COUNT(*) AS total_count
FROM course_categories;

-- 验证索引
SELECT 
  '索引' AS check_type,
  COUNT(*) AS index_count
FROM pg_indexes
WHERE tablename = 'course_categories';

-- 验证函数
SELECT 
  '函数' AS check_type,
  COUNT(*) AS function_count
FROM pg_proc
WHERE proname IN ('validate_course_categories', 'auto_fix_course_categories', 'get_category_stats');

-- 验证视图
SELECT 
  '视图' AS check_type,
  COUNT(*) AS view_count
FROM pg_views
WHERE viewname = 'v_category_course_mapping';
EOF

# 执行验证查询
echo "验证查询结果："
supabase db execute --file /tmp/verify_migration.sql || echo -e "${YELLOW}注意：验证查询执行失败，请手动验证${NC}"

# 步骤7：显示统计信息
echo ""
echo -e "${YELLOW}步骤7：显示统计信息...${NC}"

cat > /tmp/show_stats.sql << 'EOF'
-- 显示分类统计
SELECT * FROM get_category_stats();
EOF

echo "分类统计："
supabase db execute --file /tmp/show_stats.sql || echo -e "${YELLOW}注意：统计查询执行失败，请手动查询${NC}"

# 步骤8：执行数据验证
echo ""
echo -e "${YELLOW}步骤8：执行数据验证...${NC}"

cat > /tmp/validate_data.sql << 'EOF'
-- 验证分类数据完整性
SELECT * FROM validate_course_categories();
EOF

echo "数据验证结果："
supabase db execute --file /tmp/validate_data.sql || echo -e "${YELLOW}注意：数据验证执行失败，请手动验证${NC}"

# 步骤9：清理临时文件
echo ""
echo -e "${YELLOW}步骤9：清理临时文件...${NC}"
rm -f /tmp/verify_migration.sql /tmp/show_stats.sql /tmp/validate_data.sql
echo -e "${GREEN}✓ 临时文件已清理${NC}"

# 完成
echo ""
echo "========================================="
echo -e "${GREEN}课程分类表优化 - 执行完成！${NC}"
echo "========================================="
echo ""
echo "后续操作："
echo "  1. 查看分类统计: SELECT * FROM get_category_stats();"
echo "  2. 验证数据完整性: SELECT * FROM validate_course_categories();"
echo "  3. 自动修复问题: SELECT * FROM auto_fix_course_categories();"
echo "  4. 查看分类与课程关联: SELECT * FROM v_category_course_mapping;"
echo "  5. 测试前端显示: 访问首页，查看课程分类标签"
echo ""
echo "详细文档: docs/course_categories_optimization.md"
echo ""
