import { createClient } from '@supabase/supabase-js';

const oldClient = createClient(
  'https://backend.appmiaoda.com/projects/supabase248069794908123136',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMDc4NTcxNjQ4LCJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwic3ViIjoiYW5vbiJ9.pFgXvnN1ofqaDqBw79B1zoxJiPxiN-EtRdSh02vG6mk'
);

const newClient = createClient(
  'https://isjflmyhbvdlmcsaewbq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzamZsbXloYnZkbG1jc2Fld2JxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk4OTY0NywiZXhwIjoyMDk0NTY1NjQ3fQ.c2neo8xpa4B1A4FJ_sLcEg1jQRLvW1mtijSW36H42UY'
);

async function migrate() {
  console.log('=== 开始数据迁移 ===\n');

  // 1. 迁移 course_categories
  console.log('正在读取 course_categories...');
  const { data: categories, error: catErr } = await oldClient
    .from('course_categories')
    .select('*')
    .order('sort_order');
  if (catErr) { console.error('读取失败:', catErr); return; }
  console.log(`读取到 ${categories.length} 条`);

  console.log('写入新库 course_categories...');
  const { error: catInsertErr } = await newClient
    .from('course_categories')
    .insert(categories);
  if (catInsertErr) { console.error('写入失败:', catInsertErr); }
  else { console.log(`course_categories 迁移成功: ${categories.length} 条\n`); }

  // 2. 迁移 courses
  console.log('正在读取 courses...');
  const { data: courses, error: courseErr } = await oldClient
    .from('courses')
    .select('*')
    .order('sort_order');
  if (courseErr) { console.error('读取失败:', courseErr); return; }
  console.log(`读取到 ${courses.length} 条`);

  console.log('写入新库 courses...');
  const { error: courseInsertErr } = await newClient
    .from('courses')
    .insert(courses);
  if (courseInsertErr) { console.error('写入失败:', courseInsertErr); }
  else { console.log(`courses 迁移成功: ${courses.length} 条\n`); }

  // 3. 迁移 visitor_stats（数据量大，分批处理）
  console.log('正在读取 visitor_stats...');
  const { data: visitors, error: visErr } = await oldClient
    .from('visitor_stats')
    .select('*');
  if (visErr) { console.error('读取失败:', visErr); return; }
  console.log(`读取到 ${visitors.length} 条`);

  const batchSize = 500;
  let visSuccess = 0;
  for (let i = 0; i < visitors.length; i += batchSize) {
    const batch = visitors.slice(i, i + batchSize).map(({ id, ...rest }) => rest);
    const { error: visInsertErr } = await newClient
      .from('visitor_stats')
      .insert(batch);
    if (visInsertErr) {
      console.error(`批次 ${i / batchSize + 1} 写入失败:`, visInsertErr);
    } else {
      visSuccess += batch.length;
    }
  }
  console.log(`visitor_stats 迁移成功: ${visSuccess} 条\n`);

  // 验证
  console.log('=== 验证数据 ===');
  const [catRes, courseRes, visRes] = await Promise.all([
    newClient.from('course_categories').select('id', { count: 'exact', head: true }),
    newClient.from('courses').select('id', { count: 'exact', head: true }),
    newClient.from('visitor_stats').select('id', { count: 'exact', head: true }),
  ]);
  console.log(`新库 course_categories: ${catRes.count} 条`);
  console.log(`新库 courses: ${courseRes.count} 条`);
  console.log(`新库 visitor_stats: ${visRes.count} 条`);
  console.log('\n=== 迁移完成 ===');
}

migrate().catch(console.error);
