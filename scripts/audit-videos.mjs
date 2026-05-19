#!/usr/bin/env node

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join as pathJoin } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(pathJoin(__dirname, '..', '.env.upload'), 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});

const R2_BASE = 'https://pub-9a448aa9778a401c912a9e3ac046e252.r2.dev';
const SUPABASE_URL = 'https://isjflmyhbvdlmcsaewbq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  // 1. 获取 R2 所有文件
  const r2Keys = new Set();
  let cont;
  do {
    const res = await r2.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME, ContinuationToken: cont }));
    if (res.Contents) res.Contents.forEach(o => r2Keys.add(o.Key));
    cont = res.NextContinuationToken;
  } while (cont);

  // 2. 获取所有课程
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/courses?select=id,title,video_url,membership_type&status=eq.published&order=sort_order.asc`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const courses = await res.json();

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║         课程视频状态诊断报告                      ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`\nR2 文件: ${r2Keys.size} 个 | 数据库课程: ${courses.length} 门\n`);

  const broken = [], test = [], ok = [], noVideo = [];

  for (const c of courses) {
    const vu = c.video_url;
    if (!vu) { noVideo.push(c); continue; }
    const key = decodeURIComponent(vu.replace(R2_BASE + '/', ''));
    if (key.includes('test-video') || key.includes('test-streams')) { test.push({ ...c, r2_key: key }); continue; }
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(key);
    if (!r2Keys.has(key)) { broken.push({ ...c, r2_key: key, isUUID }); }
    else { ok.push(c); }
  }

  // R2 孤儿文件
  const allReferenced = new Set();
  for (const c of courses) {
    if (c.video_url) allReferenced.add(decodeURIComponent(c.video_url.replace(R2_BASE + '/', '')));
  }
  const orphaned = [...r2Keys].filter(k => !allReferenced.has(k));

  // 汇总
  console.log('── 汇总 ──');
  console.log(`  ✅ 视频正常: ${ok.length}`);
  console.log(`  ❌ 链接断裂（R2 无此文件）: ${broken.length}`);
  console.log(`  🧪 测试视频（需替换）: ${test.length}`);
  console.log(`  ⬜ 无视频: ${noVideo.length}`);
  console.log(`  🔍 R2 孤儿文件（未被引用）: ${orphaned.length}`);

  // 按类型分组
  for (const type of ['pro', 'plus', 'free']) {
    const label = type.toUpperCase();
    const b = broken.filter(c => c.membership_type === type);
    const t = test.filter(c => c.membership_type === type);
    const n = noVideo.filter(c => c.membership_type === type);
    if (b.length === 0 && t.length === 0 && n.length === 0) continue;
    console.log(`\n\n════════ ${label} ════════`);
    if (b.length > 0) {
      console.log(`\n  ❌ 链接断裂 (${b.length}):`);
      for (const c of b) console.log(`     ${c.isUUID ? '[UUID]' : '[?]'} ${c.title}\n          → 数据库指向: ${c.r2_key}`);
    }
    if (t.length > 0) {
      console.log(`\n  🧪 测试视频 (${t.length}):`);
      for (const c of t) console.log(`     ${c.title} (${c.membership_type})\n          → ${c.r2_key}`);
    }
    if (n.length > 0) {
      console.log(`\n  ⬜ 无视频 (${n.length}):`);
      for (const c of n) console.log(`     ${c.title}`);
    }
  }

  if (orphaned.length > 0) {
    console.log('\n\n════════ R2 孤儿文件 ════════');
    for (const k of orphaned) console.log(`  ${k}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
