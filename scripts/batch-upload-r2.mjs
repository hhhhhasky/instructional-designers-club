#!/usr/bin/env node

import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { readdir, stat, readFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join as pathJoin } from 'node:path';

// ==================== 加载 .env.upload ====================
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = pathJoin(__dirname, '..', '.env.upload');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

// ==================== 配置 ====================
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'course-videos';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
const SUPABASE_URL = 'https://isjflmyhbvdlmcsaewbq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

// ==================== 获取 R2 已有文件 ====================
async function getExistingR2Keys() {
  const keys = new Set();
  let cont;
  do {
    const res = await r2.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      ContinuationToken: cont,
    }));
    if (res.Contents) res.Contents.forEach(o => keys.add(o.Key));
    cont = res.NextContinuationToken;
  } while (cont);
  return keys;
}

// ==================== 获取课程列表 ====================
async function getCourses() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/courses?select=id,title,video_url,membership_type&status=eq.published&order=sort_order.asc`,
    { headers: { apikey: SUPABASE_KEY } }
  );
  if (!res.ok) throw new Error(`获取课程失败: ${res.status}`);
  return res.json();
}

// ==================== 匹配逻辑 ====================
function normalize(str) {
  return str.replace(/[\s\-_.,;:!?()（）【】《》''""　\[\]\/\\+：，。、·]/g, '').toLowerCase();
}

function matchFileToCourse(filename, courses) {
  const name = basename(filename, extname(filename));
  // 去掉 【Pro】 前缀用于匹配
  const cleanName = name.replace(/^【pro】/i, '').trim();

  // 提取文件名中的数字（用于序号匹配）
  const numMatch = cleanName.match(/(\d{1,2})/);

  // 0. 序号 + 系列名匹配（优先级最高）
  if (numMatch) {
    const fileNum = parseInt(numMatch[1], 10);
    const numIdx = cleanName.indexOf(numMatch[1]);
    const seriesBefore = normalize(cleanName.substring(0, numIdx));
    const seriesAfter = normalize(cleanName.substring(numIdx + numMatch[1].length));

    // 提取关键词（2字以上子串）
    function extractKeywords(s) {
      const kws = [];
      for (let len = Math.min(s.length, 6); len >= 2; len--) {
        for (let i = 0; i <= s.length - len; i++) {
          kws.push(s.substring(i, i + len));
        }
      }
      return kws;
    }

    const beforeKws = seriesBefore.length >= 2 ? extractKeywords(seriesBefore) : [];
    const afterKws = seriesAfter.length >= 2 ? extractKeywords(seriesAfter) : [];

    let bestMatch = null, bestScore = 0;
    for (const c of courses) {
      const titleNorm = normalize(c.title);
      const titleNumMatch = c.title.match(/(\d{1,2})/);
      if (!titleNumMatch) continue;
      const titleNum = parseInt(titleNumMatch[1], 10);
      if (titleNum !== fileNum) continue;

      let score = 0;
      // 完整系列名匹配
      if (seriesBefore.length > 1 && titleNorm.includes(seriesBefore)) score += 5;
      if (seriesAfter.length > 1 && titleNorm.includes(seriesAfter)) score += 3;
      // 关键词匹配（越长权重越高）
      for (const kw of beforeKws) {
        if (titleNorm.includes(kw)) score += kw.length >= 4 ? 4 : kw.length >= 3 ? 2 : 1;
      }
      for (const kw of afterKws) {
        if (titleNorm.includes(kw)) score += kw.length >= 4 ? 3 : 1;
      }
      if (score > bestScore) { bestScore = score; bestMatch = c; }
    }
    if (bestMatch && bestScore >= 1) return bestMatch;
  }

  // 1. 精确匹配
  for (const c of courses) {
    const cleanTitle = c.title.replace(/^\d+\s*\|\s*/, '').replace(/^\d+-/, '').trim();
    if (normalize(cleanName) === normalize(cleanTitle)) return c;
  }

  // 2. 包含匹配
  for (const c of courses) {
    const nt = normalize(c.title);
    const nn = normalize(cleanName);
    if (nt.length > 2 && (nt.includes(nn) || nn.includes(nt))) return c;
  }

  // 3. 去掉序号后再匹配（仅对无数字编号的文件使用）
  if (!numMatch) {
    const noNum = cleanName.replace(/^[\d\-]+/, '').trim();
    for (const c of courses) {
      const nt = normalize(c.title).replace(/^[\d\-|]+/, '');
      const nn = normalize(noNum);
      if (nt.length > 2 && (nt.includes(nn) || nn.includes(nt))) return c;
    }
  }

  // 4. 关键词交叉匹配
  const keywords = cleanName.split(/[：:、，,]/).map(s => normalize(s).replace(/^[\d\-【】\[\]]+/, '').trim()).filter(k => k.length > 1);
  for (const c of courses) {
    const titleNorm = normalize(c.title);
    const hits = keywords.filter(k => titleNorm.includes(k)).length;
    if (hits >= 2) return c;
  }

  // 5. CC → ClaudeCode 别名
  const nameWithAlias = normalize(cleanName).replace(/cc/g, 'claudecode');
  for (const c of courses) {
    const ct = normalize(c.title).replace(/cc/gi, 'claudecode').replace(/^\d+-/, '');
    if (ct.length > 3 && (ct.includes(nameWithAlias) || nameWithAlias.includes(ct))) return c;
  }

  // 6. bigram 相似度
  const filterChars = (s) => [...s].filter(ch => !/[\d\s\-_.,;:!?()（）【】《》''""　：，、]/.test(ch)).join('');
  const fn = filterChars(normalize(cleanName).replace(/cc/gi, 'claudecode'));
  if (fn.length >= 4) {
    const fileBigrams = new Set();
    for (let i = 0; i < fn.length - 1; i++) fileBigrams.add(fn.substring(i, i + 2));
    let bestCourse = null, bestRatio = 0;
    for (const c of courses) {
      // 如果文件有数字序号，跳过序号不一致的课程（避免系列内串匹配）
      if (numMatch) {
        const cNumMatch = c.title.match(/(\d{1,2})/);
        if (cNumMatch && parseInt(cNumMatch[1], 10) !== parseInt(numMatch[1], 10)) continue;
      }
      const ct = filterChars(normalize(c.title).replace(/cc/gi, 'claudecode').replace(/^\d+[-|]/, ''));
      if (ct.length < 4) continue;
      let hits = 0;
      for (const bg of fileBigrams) { if (ct.includes(bg)) hits++; }
      const ratio = hits / fileBigrams.size;
      if (hits >= 2 && ratio > bestRatio) { bestRatio = ratio; bestCourse = c; }
    }
    if (bestCourse && bestRatio >= 0.4) return bestCourse;
  }

  return null;
}

// ==================== 上传 + 更新数据库 ====================
async function uploadAndUpdate(filePath, r2Key, course) {
  const fileBuffer = await readFile(filePath);
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: r2Key,
    Body: fileBuffer,
    ContentType: 'video/mp4',
  }));
  // 对中文文件名做 URL encode
  const encodedKey = r2Key.split('/').map(s => encodeURIComponent(s)).join('/');
  const publicUrl = `${R2_PUBLIC_URL}/${encodedKey}`;

  // 更新 Supabase
  const res = await fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${course.id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ video_url: publicUrl }),
  });
  if (!res.ok) throw new Error(`数据库更新失败: ${res.status} ${await res.text()}`);
  return publicUrl;
}

// ==================== 主流程 ====================
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const plusDir = '/Users/apple/Downloads/俱乐部课程/PLUS压缩';
  const proDir = '/Users/apple/Downloads/俱乐部课程/PRO压缩';

  console.log('\n🎬 视频上传工具（保留原始文件名）\n');
  if (dryRun) console.log('🔍 试运行模式\n');

  // 获取现有数据
  const [existingKeys, courses] = await Promise.all([
    getExistingR2Keys(),
    getCourses(),
  ]);
  console.log(`📦 R2 已有: ${existingKeys.size} 个文件`);
  console.log(`📚 数据库课程: ${courses.length} 门\n`);

  // 按文件夹分组处理
  const folders = [
    { dir: proDir, label: 'PRO', filter: 'pro' },
    { dir: plusDir, label: 'PLUS', filter: 'plus' },
  ];

  let totalUploaded = 0, totalSkipped = 0, totalUnmatched = 0, totalFailed = 0;

  for (const { dir, label, filter } of folders) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`📁 ${label} 视频目录`);
    console.log('═'.repeat(50));

    let files;
    try {
      files = await readdir(dir);
    } catch (e) {
      console.log(`  ⚠️  目录不存在或无法读取: ${dir}`);
      continue;
    }

    const videoFiles = files.filter(f => /\.(mp4|webm|mov)$/i.test(f) && !f.startsWith('.'));
    // 过滤出对应会员类型的课程
    const typeCourses = filter === 'pro'
      ? courses.filter(c => c.membership_type === 'pro')
      : courses.filter(c => c.membership_type !== 'pro'); // plus + free

    console.log(`  视频文件: ${videoFiles.length} 个 | ${label} 课程: ${typeCourses.length} 门\n`);

    for (const file of videoFiles) {
      const filePath = join(dir, file);
      const fstat = await stat(filePath);
      if (!fstat.isFile()) continue;

      const sizeMB = (fstat.size / 1024 / 1024).toFixed(1);

      // 检查是否已在 R2
      if (existingKeys.has(file)) {
        console.log(`  ⏭️  已存在: ${file} (${sizeMB}MB)`);
        totalSkipped++;
        continue;
      }

      // 匹配课程
      const course = matchFileToCourse(file, typeCourses);
      if (!course) {
        console.log(`  ⚠️  未匹配: ${file} (${sizeMB}MB)`);
        totalUnmatched++;
        continue;
      }

      if (dryRun) {
        console.log(`  ✅ ${file} (${sizeMB}MB) → ${course.title}`);
        const encodedKey = encodeURIComponent(file);
        console.log(`     URL: ${R2_PUBLIC_URL}/${encodedKey}`);
        totalUploaded++;
      } else {
        try {
          console.log(`  ⬆️  ${file} (${sizeMB}MB) → ${course.title}`);
          const url = await uploadAndUpdate(filePath, file, course);
          console.log(`  ✅ 完成: ${url}`);
          totalUploaded++;
          existingKeys.add(file); // 避免重复上传
        } catch (err) {
          console.log(`  ❌ 失败: ${err.message}`);
          totalFailed++;
        }
      }
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📊 总计: 上传 ${totalUploaded} | 跳过(已存在) ${totalSkipped} | 未匹配 ${totalUnmatched} | 失败 ${totalFailed}`);
  console.log('═'.repeat(50));

  if (!dryRun && totalUploaded > 0) console.log('\n🎉 上传完成！');
}

main().catch(err => { console.error('💥', err); process.exit(1); });
