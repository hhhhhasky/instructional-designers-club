import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://backend.appmiaoda.com/projects/supabase248069794908123136';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMDc4NTcxNjQ4LCJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwic3ViIjoiYW5vbiJ9.pFgXvnN1ofqaDqBw79B1zoxJiPxiN-EtRdSh02vG6mk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function exportData() {
  console.log('正在从旧数据库导出数据...\n');

  // 导出 course_categories
  const { data: categories, error: catError } = await supabase
    .from('course_categories')
    .select('*')
    .order('sort_order');

  if (catError) {
    console.error('导出 course_categories 失败:', catError);
    return;
  }
  console.log(`course_categories: ${categories.length} 条记录`);

  // 导出 courses
  const { data: courses, error: courseError } = await supabase
    .from('courses')
    .select('*')
    .order('sort_order');

  if (courseError) {
    console.error('导出 courses 失败:', courseError);
    return;
  }
  console.log(`courses: ${courses.length} 条记录`);

  // 导出 visitor_stats
  const { data: visitors, error: visitorError } = await supabase
    .from('visitor_stats')
    .select('*');

  if (visitorError) {
    console.error('导出 visitor_stats 失败:', visitorError);
    return;
  }
  console.log(`visitor_stats: ${visitors.length} 条记录`);

  // 生成 INSERT SQL
  let sql = '-- ============================================================\n';
  sql += '-- 数据迁移 SQL - 从旧数据库导出\n';
  sql += '-- ============================================================\n\n';

  // course_categories INSERT
  if (categories.length > 0) {
    sql += '-- 课程分类数据\n';
    for (const row of categories) {
      const vals = [
        `'${row.id}'`,
        escapeSql(row.name),
        row.description ? escapeSql(row.description) : 'NULL',
        row.sort_order,
        row.created_at ? `'${row.created_at}'` : 'now()',
        row.updated_at ? `'${row.updated_at}'` : 'now()',
        row.is_active,
        arrayToSql(row.scenarios),
        arrayToSql(row.applicable_audience),
        arrayToSql(row.applicable_scenarios),
        arrayToSql(row.content_types),
      ];
      sql += `INSERT INTO "public"."course_categories" ("id", "name", "description", "sort_order", "created_at", "updated_at", "is_active", "scenarios", "applicable_audience", "applicable_scenarios", "content_types") VALUES (${vals.join(', ')});\n`;
    }
    sql += '\n';
  }

  // courses INSERT
  if (courses.length > 0) {
    sql += '-- 课程数据\n';
    for (const row of courses) {
      const vals = [
        `'${row.id}'`,
        escapeSql(row.title),
        row.description ? escapeSql(row.description) : 'NULL',
        row.instructor ? escapeSql(row.instructor) : 'NULL',
        row.category_id ? `'${row.category_id}'` : 'NULL',
        row.category ? escapeSql(row.category) : 'NULL',
        `'${row.level}'`,
        row.semester ? escapeSql(row.semester) : 'NULL',
        row.duration,
        row.credits,
        `'${row.status}'`,
        row.image_url ? escapeSql(row.image_url) : 'NULL',
        row.video_url ? escapeSql(row.video_url) : 'NULL',
        row.meeting_url ? escapeSql(row.meeting_url) : 'NULL',
        row.sort_order,
        row.view_count,
        row.created_at ? `'${row.created_at}'` : 'now()',
        row.updated_at ? `'${row.updated_at}'` : 'now()',
        `'${row.membership_type}'`,
        row.is_trial,
      ];
      sql += `INSERT INTO "public"."courses" ("id", "title", "description", "instructor", "category_id", "category", "level", "semester", "duration", "credits", "status", "image_url", "video_url", "meeting_url", "sort_order", "view_count", "created_at", "updated_at", "membership_type", "is_trial") VALUES (${vals.join(', ')});\n`;
    }
    sql += '\n';
  }

  // visitor_stats INSERT
  if (visitors.length > 0) {
    sql += '-- 访客统计数据\n';
    for (const row of visitors) {
      const vals = [
        row.id,
        `'${row.visitor_uuid}'`,
        row.visit_count,
        `'${row.first_visit_at}'`,
        `'${row.last_visit_at}'`,
      ];
      sql += `INSERT INTO "public"."visitor_stats" ("id", "visitor_uuid", "visit_count", "first_visit_at", "last_visit_at") VALUES (${vals.join(', ')});\n`;
    }
    sql += '\n';
  }

  // 写入文件
  const fs = await import('fs');
  const path = await import('path');
  const outputPath = path.resolve('supabase/migrations/20240517_data_migration.sql');
  fs.writeFileSync(outputPath, sql, 'utf-8');
  console.log(`\n数据已导出到: ${outputPath}`);
  console.log(`\n统计:`);
  console.log(`  - course_categories: ${categories.length} 条`);
  console.log(`  - courses: ${courses.length} 条`);
  console.log(`  - visitor_stats: ${visitors.length} 条`);
}

function escapeSql(str) {
  if (!str) return 'NULL';
  return `E'${str.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
}

function arrayToSql(arr) {
  if (!arr || !Array.isArray(arr) || arr.length === 0) {
    return `'{}'::"text"[]`;
  }
  const items = arr.map(item => `"${item.replace(/"/g, '\\"')}"`).join(', ');
  return `ARRAY[${items}]::"text"[]`;
}

exportData().catch(console.error);
