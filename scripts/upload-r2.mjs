#!/usr/bin/env node

/**
 * 课程视频上传到 Cloudflare R2 + 同步 Supabase 数据库
 *
 * 用法: node scripts/upload-r2.mjs <视频文件夹> [--dry-run]
 *
 * 环境变量（通过 .env.upload 或命令行设置）：
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME (默认 course-videos)
 *   R2_PUBLIC_URL
 *   SUPABASE_URL, SUPABASE_ANON_KEY
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readdir, stat, readFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

// ==================== 配置 ====================

const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov']);

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'course-videos';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');

const SUPABASE_URL = 'https://isjflmyhbvdlmcsaewbq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzamZsbXloYnZkbG1jc2Fld2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5ODk2NDcsImV4cCI6MjA5NDU2NTY0N30.LqAxPxpP4qwrtBu4yPxDosFHZC4QkF1volyfWnrg3o0';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

const missing = [];
if (!R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
if (!R2_PUBLIC_URL) missing.push('R2_PUBLIC_URL');
if (missing.length > 0) {
  console.error('❌ 缺少环境变量:', missing.join(', '));
  process.exit(1);
}

// ==================== 初始化 R2 客户端 ====================

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

// ==================== 获取课程列表（REST API，避免 supabase-js 兼容问题） ====================

async function getCourses(membershipType) {
  const filter = membershipType ? `&membership_type=eq.${membershipType}` : '';
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/courses?select=id,title,video_url&status=eq.published${filter}&order=sort_order.asc`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
  );
  if (!res.ok) throw new Error(`获取课程失败: ${res.status}`);
  return res.json();
}

// ==================== 匹配视频到课程 ====================

function normalize(str) {
  return str.replace(/[\s\-_.,;:!?()（）【】《》''""　【】\[\]]/g, '').toLowerCase();
}

function matchVideo(filename, courses) {
  const name = basename(filename, extname(filename));

  // 精确标题匹配（去掉前缀 【Pro】）
  const cleanName = name.replace(/^【pro】/i, '');

  for (const c of courses) {
    if (normalize(cleanName) === normalize(c.title)) return c;
  }

  // 部分匹配
  for (const c of courses) {
    const nt = normalize(c.title);
    const nn = normalize(cleanName);
    if (nt.includes(nn) || nn.includes(nt)) return c;
  }

  // 去掉数字编号再匹配
  const noNum = cleanName.replace(/^[\d\-]+/, '');
  for (const c of courses) {
    const nt = normalize(c.title).replace(/^[\d\-]+/, '');
    const nn = normalize(noNum);
    if (nt.includes(nn) || nn.includes(nt)) return c;
  }

  // 关键词交叉匹配：提取文件名中的关键词，逐个检查
  const keywords = cleanName.split(/[：:、，,]/).map(s => normalize(s).replace(/^[\d\-【】\[\]]+/, '').trim()).filter(k => k.length > 1);
  for (const c of courses) {
    const titleNorm = normalize(c.title);
    const hitCount = keywords.filter(k => titleNorm.includes(k)).length;
    if (hitCount >= 2) return c;
  }

  return null;
}

// 手动映射：文件名关键词 → 课程标题关键词（自动匹配无法覆盖的情况）
const MANUAL_ALIASES = {
  'cc': 'claudecode',
  'claudecode': 'claudecode',
  'claudemd': 'claudemd',
  'token': 'token',
};

function matchVideoWithAliases(filename, courses) {
  // 先用标准匹配
  const match = matchVideo(filename, courses);
  if (match) return match;

  // 用别名再试一次
  const name = normalize(basename(filename, extname(filename)).replace(/^【pro】/i, ''));
  const titleNorm = normalize(name)
    .replace(/cc/g, 'claudecode')
    .replace(/\s+/g, '');

  for (const c of courses) {
    const ct = normalize(c.title).replace(/\s+/g, '');
    if (ct.includes(titleNorm) || titleNorm.includes(ct)) return c;
  }

  // 更宽松的关键词匹配
  const fileKeywords = normalize(name).replace(/cc/g, 'claudecode').split(/[：:、，,]/).map(s => s.trim()).filter(k => k.length > 1);
  for (const c of courses) {
    const ct = normalize(c.title).replace(/cc/g, 'claudecode');
    const hitCount = fileKeywords.filter(k => ct.includes(k)).length;
    if (hitCount >= 1 && fileKeywords.some(k => ct.includes(k))) return c;
  }

  // 最终兜底：去掉停用词后，提取 2 字子串找最佳匹配
  const stopWords = new Set('的了是我你他她它们和与等也都能会要在有就不么这个那怎么办为什么如何用可被让从到得着过很已经所因为如果所以但是虽然而且或者以及一些一种一个'.split(''));
  const filterChars = (s) => [...s].filter(ch => !stopWords.has(ch) && !/[\d\s\-_.,;:!?]/.test(ch)).join('');
  const fn = filterChars(normalize(name).replace(/cc/gi, 'claudecode'));
  if (fn.length >= 4) {
    const fileBigrams = new Set();
    for (let i = 0; i < fn.length - 1; i++) fileBigrams.add(fn.substring(i, i + 2));
    let bestCourse = null, bestRatio = 0;
    for (const c of courses) {
      const ct = filterChars(normalize(c.title).replace(/cc/gi, 'claudecode'));
      if (ct.length < 4) continue;
      let hits = 0;
      for (const bg of fileBigrams) {
        if (ct.includes(bg)) hits++;
      }
      const ratio = hits / fileBigrams.size;
      if (hits >= 2 && ratio > bestRatio) {
        bestRatio = ratio;
        bestCourse = c;
      }
    }
    if (bestCourse && bestRatio >= 0.4) return bestCourse;
  }

  return null;
}

// ==================== 上传到 R2 ====================

async function uploadToR2(filePath, key) {
  const fileBuffer = await readFile(filePath);
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: 'video/mp4',
  }));
  return `${R2_PUBLIC_URL}/${key}`;
}

// ==================== 更新数据库 ====================

async function updateVideoUrl(courseId, url) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/courses?id=eq.${courseId}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ video_url: url }),
    }
  );
  if (!res.ok) throw new Error(`更新数据库失败: ${res.status} ${await res.text()}`);
}

// ==================== 主流程 ====================

async function main() {
  const videoDir = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  const membershipType = process.argv.find(a => a.startsWith('--type='))?.split('=')[1] || null;

  if (!videoDir) {
    console.error('❌ 用法: node scripts/upload-r2.mjs <视频文件夹> [--dry-run] [--type=pro]');
    process.exit(1);
  }

  console.log(`\n🎬 课程视频上传工具 (R2 + Supabase REST)\n`);
  console.log(`📁 视频目录: ${videoDir}`);
  console.log(`☁️  R2: ${R2_BUCKET_NAME}`);
  if (dryRun) console.log('🔍 试运行模式\n');
  else console.log('');

  const files = await readdir(videoDir);
  const videoFiles = files.filter(f => VIDEO_EXTENSIONS.has(extname(f).toLowerCase()));
  console.log(`📊 找到 ${videoFiles.length} 个视频文件`);

  const courses = await getCourses(membershipType);
  console.log(`📚 数据库 ${membershipType ? membershipType + ' ' : ''}课程: ${len(courses)} 门\n`);

  let matched = 0, unmatched = 0, uploaded = 0, failed = 0;
  const results = [];

  for (const file of videoFiles) {
    const filePath = join(videoDir, file);
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) continue;

    const course = matchVideoWithAliases(file, courses);
    if (!course) {
      console.log(`  ⚠️  未匹配: ${file}`);
      unmatched++;
      continue;
    }

    const ext = extname(file);
    const key = `${course.id}${ext}`;
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;
    const sizeMB = (fileStat.size / 1024 / 1024).toFixed(1);

    matched++;
    if (dryRun) {
      console.log(`  ✅ ${file} → ${course.title} (${sizeMB}MB)`);
      console.log(`     URL: ${publicUrl}`);
      uploaded++;
    } else {
      try {
        console.log(`  ⬆️  上传: ${file} (${sizeMB}MB) → ${course.title}`);
        await uploadToR2(filePath, key);
        await updateVideoUrl(course.id, publicUrl);
        console.log(`  ✅ 完成: ${publicUrl}`);
        uploaded++;
      } catch (err) {
        console.log(`  ❌ 失败: ${err.message}`);
        failed++;
      }
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`📊 结果: 匹配 ${matched} | 未匹配 ${unmatched} | 成功 ${uploaded} | 失败 ${failed}`);
  console.log('═'.repeat(50));

  if (unmatched > 0) console.log('\n💡 未匹配的文件请检查文件名是否与课程标题对应');
  if (!dryRun && uploaded > 0) console.log('\n🎉 上传完成！');
}

main().catch(err => { console.error('💥', err); process.exit(1); });

function len(arr) { return arr.length; }
