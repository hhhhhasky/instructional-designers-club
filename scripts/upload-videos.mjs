#!/usr/bin/env node

/**
 * 课程视频批量上传工具（Cloudflare R2 版）
 *
 * 使用方法：
 *   1. 把所有课程视频放到一个文件夹里
 *   2. 设置环境变量（见下方说明）
 *   3. 运行: node scripts/upload-videos.mjs <视频文件夹路径>
 *
 * 必需环境变量：
 *   R2_ACCOUNT_ID        — Cloudflare Account ID（Dashboard 右侧栏）
 *   R2_ACCESS_KEY_ID     — R2 API Token（需先创建，见下方说明）
 *   R2_SECRET_ACCESS_KEY — R2 API Token Secret
 *   R2_BUCKET_NAME       — R2 存储桶名称（如 course-videos）
 *   R2_PUBLIC_URL        — R2 公开访问域名（如 https://pub-xxx.r2.dev 或自定义域名）
 *   SUPABASE_SECRET_KEY — Supabase Secret Key（更新数据库用）
 *
 * R2 API Token 创建方式：
 *   Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create API Token
 *   权限选择: Object Read & Write
 *
 * 文件名匹配规则（优先级从高到低）：
 *   - <课程ID>.mp4           → 精确匹配课程 ID
 *   - <课程ID>_<任意文字>.mp4 → ID 在文件名开头
 *   - <课程标题>.mp4         → 模糊匹配标题（去除空格和特殊字符）
 *
 * 示例：
 *   node scripts/upload-videos.mjs ~/Desktop/course-videos
 *   node scripts/upload-videos.mjs ~/Desktop/course-videos --dry-run
 */

import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { readdir, stat, readFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

// ==================== 配置 ====================

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'course-videos';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // e.g. https://pub-xxx.r2.dev
const SUPABASE_URL = 'https://backend.appmiaoda.com/projects/supabase248069794908123136';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.avi', '.mkv']);

// 检查必需环境变量
const missing = [];
if (!R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
if (!R2_PUBLIC_URL) missing.push('R2_PUBLIC_URL');
if (!SUPABASE_SECRET_KEY) missing.push('SUPABASE_SECRET_KEY');

if (missing.length > 0) {
  console.error('❌ 缺少以下环境变量:\n');
  missing.forEach(k => console.error(`   - ${k}`));
  console.error('\n📝 设置方式:');
  console.error('   export R2_ACCOUNT_ID="你的Cloudflare账号ID"');
  console.error('   export R2_ACCESS_KEY_ID="R2 API Token"');
  console.error('   export R2_SECRET_ACCESS_KEY="R2 API Secret"');
  console.error('   export R2_BUCKET_NAME="course-videos"');
  console.error('   export R2_PUBLIC_URL="https://pub-xxx.r2.dev"');
  console.error('   export SUPABASE_SECRET_KEY="Supabase Secret Key"');
  console.error('\n   然后运行: node scripts/upload-videos.mjs <视频文件夹>');
  process.exit(1);
}

// ==================== 初始化客户端 ====================

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ==================== 检查 R2 存储桶 ====================

async function ensureBucket() {
  console.log('📦 检查 R2 存储桶...');
  try {
    await r2.send(new HeadBucketCommand({ Bucket: R2_BUCKET_NAME }));
    console.log(`✅ 存储桶 "${R2_BUCKET_NAME}" 可访问`);
  } catch (err) {
    console.error(`❌ 无法访问存储桶 "${R2_BUCKET_NAME}": ${err.message}`);
    console.error('   请在 Cloudflare Dashboard → R2 中创建存储桶');
    process.exit(1);
  }
}

// ==================== 获取课程列表 ====================

async function getCourses() {
  const { data, error } = await supabase
    .from('courses')
    .select('id, title, video_url')
    .eq('status', 'published');

  if (error) {
    console.error('❌ 获取课程列表失败:', error.message);
    process.exit(1);
  }

  return data || [];
}

// ==================== 匹配视频文件到课程 ====================

function normalize(str) {
  return str.replace(/[\s\-_.,;:!?()（）【】《》''""　]/g, '').toLowerCase();
}

function matchVideoToCourse(filename, courses) {
  const nameWithoutExt = basename(filename, extname(filename));

  const exactId = courses.find(c => nameWithoutExt === c.id);
  if (exactId) return exactId;

  const prefixId = courses.find(c => nameWithoutExt.startsWith(c.id));
  if (prefixId) return prefixId;

  const containsId = courses.find(c => nameWithoutExt.includes(c.id));
  if (containsId) return containsId;

  const normalized = normalize(nameWithoutExt);
  const titleMatch = courses.find(c => normalize(c.title) === normalized);
  if (titleMatch) return titleMatch;

  const partialMatch = courses.find(c =>
    normalize(c.title).includes(normalized) || normalized.includes(normalize(c.title))
  );
  if (partialMatch) return partialMatch;

  return null;
}

// ==================== 上传到 R2 并更新数据库 ====================

async function uploadVideo(filePath, course, dryRun) {
  const ext = extname(filePath);
  const key = `${course.id}${ext}`;

  if (dryRun) {
    console.log(`  📄 ${basename(filePath)} → ${course.title} (${course.id})`);
    console.log(`     R2 路径: ${key}`);
    return true;
  }

  console.log(`  ⬆️  上传: ${basename(filePath)} → ${course.title}`);

  const fileBuffer = await readFile(filePath);
  const contentType = ext === '.mp4' ? 'video/mp4'
    : ext === '.webm' ? 'video/webm'
    : ext === '.mov' ? 'video/quicktime'
    : 'video/mp4';

  try {
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    }));
  } catch (err) {
    console.error(`  ❌ R2 上传失败: ${err.message}`);
    return false;
  }

  const publicUrl = `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  console.log(`  ✅ 上传成功: ${publicUrl}`);

  const { error: updateError } = await supabase
    .from('courses')
    .update({ video_url: publicUrl })
    .eq('id', course.id);

  if (updateError) {
    console.error(`  ⚠️  上传成功但数据库更新失败: ${updateError.message}`);
    return false;
  }

  console.log(`  ✅ 数据库已更新 video_url`);
  return true;
}

// ==================== 主流程 ====================

async function main() {
  const videoDir = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');

  if (!videoDir) {
    console.error('❌ 请指定视频文件夹路径');
    console.error('   用法: node scripts/upload-videos.mjs <视频文件夹路径>');
    console.error('   试运行: node scripts/upload-videos.mjs <视频文件夹路径> --dry-run');
    process.exit(1);
  }

  console.log('🎬 课程视频批量上传工具（Cloudflare R2）\n');
  console.log(`📁 视频目录: ${videoDir}`);
  console.log(`☁️  R2 存储桶: ${R2_BUCKET_NAME}`);
  console.log(`🌐 公开域名: ${R2_PUBLIC_URL}`);
  if (dryRun) console.log('🔍 试运行模式（不会实际上传）\n');
  else console.log('');

  let files;
  try {
    files = await readdir(videoDir);
  } catch (err) {
    console.error(`❌ 无法读取文件夹: ${err.message}`);
    process.exit(1);
  }

  const videoFiles = files.filter(f => VIDEO_EXTENSIONS.has(extname(f).toLowerCase()));
  if (videoFiles.length === 0) {
    console.error('❌ 文件夹中没有找到视频文件（支持格式: mp4, webm, mov, avi, mkv）');
    process.exit(1);
  }

  console.log(`📊 找到 ${videoFiles.length} 个视频文件\n`);

  if (!dryRun) await ensureBucket();
  const courses = await getCourses();
  console.log(`📚 数据库中共 ${courses.length} 门已发布课程\n`);

  let matched = 0, unmatched = 0, uploaded = 0, failed = 0;

  for (const file of videoFiles) {
    const filePath = join(videoDir, file);
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) continue;

    const course = matchVideoToCourse(file, courses);
    if (!course) {
      console.log(`  ⚠️  未匹配: ${file}`);
      unmatched++;
      continue;
    }

    matched++;
    if (course.video_url && !dryRun) {
      console.log(`  ℹ️  ${course.title} 已有视频，将覆盖更新...`);
    }

    const ok = await uploadVideo(filePath, course, dryRun);
    if (ok) uploaded++;
    else failed++;
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`📊 上传结果:`);
  console.log(`   匹配成功: ${matched}`);
  console.log(`   未匹配:   ${unmatched}`);
  if (!dryRun) {
    console.log(`   上传成功: ${uploaded}`);
    console.log(`   上传失败: ${failed}`);
  }
  console.log('═'.repeat(50));

  if (unmatched > 0) {
    console.log('\n💡 未匹配的视频文件，请重命名为以下格式之一:');
    console.log('   <课程ID>.mp4       — 精确匹配');
    console.log('   <课程ID>_描述.mp4   — ID 开头匹配');
    console.log('   <课程标题>.mp4      — 标题匹配');
    console.log('\n   可用 --dry-run 先试运行查看匹配结果');
  }

  if (!dryRun && uploaded > 0) {
    console.log('\n🎉 上传完成！课程详情页现在可以直接播放视频了');
  }
}

main().catch(err => {
  console.error('💥 程序异常:', err);
  process.exit(1);
});
