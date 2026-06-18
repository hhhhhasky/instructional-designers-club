import { createClient } from '@supabase/supabase-js';

const oldClient = createClient(
  'https://backend.appmiaoda.com/projects/supabase248069794908123136',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMDc4NTcxNjQ4LCJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwic3ViIjoiYW5vbiJ9.pFgXvnN1ofqaDqBw79B1zoxJiPxiN-EtRdSh02vG6mk'
);

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return `E'${String(str).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
}

function arrayToSql(arr) {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return `ARRAY[]::text[]`;
  const items = arr.map(item => `'${item.replace(/'/g, "''")}'`).join(', ');
  return `ARRAY[${items}]::text[]`;
}

async function exportInsertSQL() {
  console.log('正在从旧数据库读取数据...\n');

  const [catRes, courseRes, visRes] = await Promise.all([
    oldClient.from('course_categories').select('*').order('sort_order'),
    oldClient.from('courses').select('*').order('sort_order'),
    oldClient.from('visitor_stats').select('*').order('id'),
  ]);

  const categories = catRes.data || [];
  const courses = courseRes.data || [];
  const visitors = visRes.data || [];

  console.log(`course_categories: ${categories.length} 条`);
  console.log(`courses: ${courses.length} 条`);
  console.log(`visitor_stats: ${visitors.length} 条`);

  let sql = '-- ============================================================\n';
  sql += '-- 数据迁移 SQL\n';
  sql += `-- 导出时间: ${new Date().toISOString()}\n`;
  sql += '-- ============================================================\n\n';

  // 1. 先临时关闭 RLS 允许写入
  sql += '-- 临时关闭 RLS\n';
  sql += 'ALTER TABLE "public"."course_categories" DISABLE ROW LEVEL SECURITY;\n';
  sql += 'ALTER TABLE "public"."courses" DISABLE ROW LEVEL SECURITY;\n';
  sql += 'ALTER TABLE "public"."visitor_stats" DISABLE ROW LEVEL SECURITY;\n\n';

  // 2. course_categories
  sql += `-- 课程分类 (${categories.length} 条)\n`;
  for (const r of categories) {
    sql += `INSERT INTO "public"."course_categories" ("id","name","description","sort_order","created_at","updated_at","is_active","applicable_audience","applicable_scenarios","content_types") VALUES (\n`;
    sql += `  '${r.id}', ${escapeSql(r.name)}, ${escapeSql(r.description)}, ${r.sort_order}, '${r.created_at}', '${r.updated_at}', ${r.is_active}, ${arrayToSql(r.applicable_audience)}, ${arrayToSql(r.applicable_scenarios)}, ${arrayToSql(r.content_types)}\n`;
    sql += `);\n`;
  }
  sql += '\n';

  // 3. courses
  sql += `-- 课程 (${courses.length} 条)\n`;
  for (const r of courses) {
    sql += `INSERT INTO "public"."courses" ("id","title","description","instructor","category_id","category","level","duration","credits","status","image_url","video_url","meeting_url","sort_order","view_count","created_at","updated_at","membership_type","is_trial") VALUES (\n`;
    sql += `  '${r.id}', ${escapeSql(r.title)}, ${escapeSql(r.description)}, ${escapeSql(r.instructor)}, ${r.category_id ? `'${r.category_id}'` : 'NULL'}, ${escapeSql(r.category)}, '${r.level}', ${r.duration}, ${r.credits}, '${r.status}', ${escapeSql(r.image_url)}, ${escapeSql(r.video_url)}, ${escapeSql(r.meeting_url)}, ${r.sort_order}, ${r.view_count}, '${r.created_at}', '${r.updated_at}', '${r.membership_type}', ${r.is_trial}\n`;
    sql += `);\n`;
  }
  sql += '\n';

  // 4. visitor_stats (identity 列用 OVERRIDING)
  sql += `-- 访客统计 (${visitors.length} 条)\n`;
  for (const r of visitors) {
    sql += `INSERT INTO "public"."visitor_stats" ("id","visitor_uuid","visit_count","first_visit_at","last_visit_at") OVERRIDING SYSTEM VALUE VALUES (\n`;
    sql += `  ${r.id}, '${r.visitor_uuid}', ${r.visit_count}, '${r.first_visit_at}', '${r.last_visit_at}'\n`;
    sql += `);\n`;
  }
  sql += '\n';

  // 5. 重新开启 RLS
  sql += '-- 重新开启 RLS\n';
  sql += 'ALTER TABLE "public"."course_categories" ENABLE ROW LEVEL SECURITY;\n';
  sql += 'ALTER TABLE "public"."courses" ENABLE ROW LEVEL SECURITY;\n';
  sql += 'ALTER TABLE "public"."visitor_stats" ENABLE ROW LEVEL SECURITY;\n\n';

  // 6. 重置 visitor_stats 的序列值
  sql += '-- 重置 visitor_stats 的序列值\n';
  const maxId = visitors.length > 0 ? Math.max(...visitors.map(v => v.id)) : 1;
  sql += `SELECT setval('"public"."visitor_stats_id_seq"', ${maxId}, true);\n`;

  const fs = await import('fs');
  const outputPath = 'supabase/migrations/20240517_data_import.sql';
  fs.writeFileSync(outputPath, sql, 'utf-8');
  console.log(`\nSQL 已写入: ${outputPath}`);
  console.log('请在 Supabase SQL Editor 中执行此文件内容');
}

exportInsertSQL().catch(console.error);
