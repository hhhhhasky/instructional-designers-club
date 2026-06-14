// 探测内容表是否已存在于生产数据库（只读，不写任何数据）。
// 用法：node scripts/probe-content-tables.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// 极简 .env 解析（项目未装 dotenv）
const envText = readFileSync('.env', 'utf8');
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const sb = createClient(url, anonKey);

const TABLES = ['site_content', 'member_profiles', 'faqs', 'testimonials', 'announcements', 'activities', 'resources'];

console.log('Supabase URL:', url);
console.log('探测内容表是否存在（公开读权限）...\n');

// 各表用于探测的列：site_content 主键是 section_key（无 id 列），其余表用 id。
const PROBE_COL = { site_content: 'section_key' };

let allExist = true;
for (const t of TABLES) {
  // 用真实 select（而非 head+count）探测，避免不存在的表被误判为"存在0条"
  const col = PROBE_COL[t] ?? 'id';
  const { error, count } = await sb.from(t).select(col, { count: 'exact' }).limit(1);
  if (error) {
    console.log(`✗ ${t}: 不存在或不可读 → ${error.message}`);
    allExist = false;
  } else {
    console.log(`✓ ${t}: 存在，当前 ${count ?? 0} 条`);
  }
}

console.log('\n结论：', allExist ? '所有内容表已就绪，可直接进入后台测试。' : '部分/全部内容表尚未建立，需要先执行迁移 SQL。');
