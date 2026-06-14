// 以管理员身份登录，验证内容表的 RLS 写权限与公开读权限是否就绪。
// 这与网页端管理后台走的完全相同的链路。
// 用法：node scripts/verify-admin-rls.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const envText = readFileSync('.env', 'utf8');
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const PHONE = '17554155945';
const PASSWORD = '123456';
const EMAIL = `${PHONE}@phone.local`; // 与 access-control.ts 的 phoneToFakeEmail 一致

const sb = createClient(url, anonKey, { auth: { persistSession: false } });

console.log('1) 以管理员账号登录...');
const { data: authData, error: authErr } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (authErr) {
  console.log('   ✗ 登录失败：', authErr.message);
  process.exit(1);
}
const uid = authData.user.id;
console.log('   ✓ 登录成功，uid =', uid);

// 确认 admin 角色
const { data: profile } = await sb.from('profiles').select('role, nickname').eq('id', uid).maybeSingle();
console.log('   ✓ 当前角色：', profile?.role, '（', profile?.nickname, '）');
if (profile?.role !== 'admin') {
  console.log('   ✗ 该账号不是管理员，无法测试写权限。');
  process.exit(1);
}

console.log('\n2) 验证管理员「写」权限（临时插入/读取/删除一条 member_profile）...');
const probe = { icon: '🧪', name: '__RLS_PROBE__请删除', description: '权限探测临时数据', sort_order: 99999, is_active: false };
const { data: ins, error: insErr } = await sb.from('member_profiles').insert(probe).select().single();
if (insErr) {
  console.log('   ✗ 写入失败：', insErr.message);
  console.log('   → 说明「admin write member_profiles」RLS 策略缺失，需要执行迁移 SQL 中的策略部分。');
} else {
  console.log('   ✓ 写入成功 id =', ins.id);
  const { data: rd, error: rdErr } = await sb.from('member_profiles').select('id').eq('id', ins.id).maybeSingle();
  console.log(rdErr ? '   ✗ 读回失败：' + rdErr.message : '   ✓ 读回成功');
  const { error: delErr } = await sb.from('member_profiles').delete().eq('id', ins.id);
  console.log(delErr ? '   ✗ 删除失败：' + delErr.message : '   ✓ 删除成功（已清理探测数据）');
  if (!insErr && !rdErr && !delErr) {
    console.log('   ★ 管理员写权限完全就绪。');
  }
}

console.log('\n3) 验证「公开读」权限（anon 读取 site_content）...');
const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const { data: pub, error: pubErr } = await anon.from('site_content').select('section_key').limit(5);
if (pubErr) {
  console.log('   ✗ 公开读失败：', pubErr.message);
} else {
  console.log('   ✓ 公开读成功，可见区块：', pub.map(r => r.section_key).join(', ') || '（空）');
}

console.log('\n4) 各内容表当前行数（管理员视角，含未激活）：');
for (const t of ['site_content','member_profiles','faqs','testimonials','announcements','activities','resources']) {
  const { count } = await sb.from(t).select('*', { count: 'exact', head: true });
  console.log(`   ${t}: ${count ?? 0} 条`);
}
