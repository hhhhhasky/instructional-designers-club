#!/usr/bin/env node

import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join as pathJoin } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = pathJoin(__dirname, '..', '.env.upload');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'course-videos';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
const SUPABASE_URL = 'https://isjflmyhbvdlmcsaewbq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

// 视频文件名（不含.mp4）→ 课程 ID
const FILE_TO_COURSE = {
  '第1期每周一课：罗森海因01': 'a3fabc9f-165c-4abf-8dcd-aa10cf3f6a52',
  '第2期每周一课：罗森海因02': '56c7a120-f4cc-4869-9f34-4db91ddc5764',
  '第3期每周一课：罗森海因03': 'af9fcb74-c14d-452b-96b4-d11b21c1ca0c',
  '第4期每周一课：罗森海因04': '6ecac81e-6978-4af2-a879-5213bd87192c',
  '第5期每周一课：罗森海因05': '143e7359-2b7d-4d1c-b3db-2fbd55df566a',
  '第6期每周一课：认知负荷理论01': '28362f0d-b871-4589-a0f4-2dec881a344f',
  '第7期每周一课：认知负荷理论02': '385c4bde-6341-4611-9d87-6ff9a76f0492',
  '第8期每周一课：认知负荷理论03': '22008434-2d0f-4579-a3d5-f36b4b8147af',
  '第9期每周一课：认知负荷理论04': 'b95373c3-112e-44cf-9e98-2d3b95d86c56',
  '第10期每周一课：认知负荷理论05': '30ff2322-2b14-4dd0-bbc2-bd039c81009b',
  '第11期每周一课：应用学习科学01': 'f9d20c63-0be1-4a54-9ebd-8da8dc683e2d',
  '第12期每周一课：应用学习科学02': 'fd1a5798-c1b2-44c0-ae70-57c337ca630b',
  '第13期每周一课：应用学习科学03': '5ede0212-127d-4fdb-afc0-400c1762311b',
  '第14期每周一课：应用学习科学04': '71de43a0-bc88-4b9f-8818-59c5fa93ca9b',
  '第15期每周一课：教学设计和备课有什么区别？': '4c36aaa4-2e66-4a18-8f0b-d1d9c6cae516',
  '第16期每周一课：教学目标学习营01': '110a1f3f-0839-4a44-a523-001e93a70f9d',
  '第17期每周一课：教学目标学习营02': '49abd2d3-57b7-416e-8b3c-c39940fe61a2',
  '第18期每周一课：教学目标学习营03': '1d2cea0c-0463-489f-997f-58873003a570',
  '第19期每周一课：教学目标学习营04': 'c53119df-81c2-4f75-8e43-917ca5722e76',
  '第20期每周一课：教学目标学习营05': '30650106-e9ff-4323-8593-262d59efae92',
  '第21期每周一课：CREATE教学设计模型': 'cfb76747-9f27-4805-a45d-b27ee176a364',
  '第22期每周一课：AI时代为什么需要任务导向的教学？': 'd64fb3b1-b1fa-47bb-b50c-8e099faead82',
  '第23期每周一课：深入理解“任务”': '867435a8-bd3d-4c5e-91ae-b80531d86e89',
  '第24期每周一课：KMR设计法': '9baa912f-eac3-4c0f-8c01-ba35a08727e2',
  '第25期每周一课：任务脚本': 'c2e43817-7a67-4787-8aa0-aeb08258c3c5',
  '第26期每周一课：聊聊《教学幻象》': '3b95c3c7-74ae-4522-8979-92c0542927eb',
  '第27期每周一课：建构主义的知识观': 'b4ae2ac6-5594-45e3-a1c3-115953babd46',
  '第28期每周一课：建构主义的学习观': 'd0a16d5e-5857-4768-a7d9-1d47638e8845',
  '第29期每周一课：建构主义的教学观': '12540819-8c54-473d-861b-522d77d30f9c',
  '第30期每周一课：建构主义的教学设计': '6135626f-cb33-43bb-8796-e15b2d806a87',
  '第31期每周一课：拆解得到': '062f90f1-8543-41de-bad0-80fc33624598',
  '第32期每周一课：讲授法01': '1b826283-c273-496e-ac8a-1f9fc1dae9e7',
  '第33期每周一课：讲授法02': '192ef020-4f57-414e-be81-950a3cd48da0',
  '第34期每周一课：讲授法03': '3e50c9e0-bdcf-4824-80d5-e8c61bd01de5',
  '第35期每周一课：讲授法04': 'dc19378e-e644-430f-ae51-5cd52dc91ee8',
  '第36期每周一课：《历久弥新的思想理念》案例分析': '1ad6680e-70bd-4baa-95ae-110d3dd9a25e',
  '第37期每周一课：为什么你需要掌握概念教学？': 'a00c3aa0-5dea-44e4-bc7a-23f47fa530d4',
  '第38期每周一课：重新理解概念': 'd14ba59d-876e-47b5-bc43-1aa47034c2e7',
  '第39期每周一课：如何从教教材变成教概念': '066c8182-11d5-4c9b-b010-207f02882c84',
  '第40课每周一课：归纳策略': '15dadb45-bb36-43bd-99e3-e054734a2845',
  '第41期每周一课：演绎策略': '45ed4d75-4ec8-4a03-a89e-12bee13f9155',
  '第44期每周一课：为什么老师们需要一门新的AI课': '6a3eabcc-8277-46bb-a86f-8a743b90d666',
  '第45期每周一课：AI选型不焦虑': '91070cab-a2e5-4bfa-9535-4997128999c6',
  '第46期每周一课：提示词基本功': '2b12f7b8-4ad1-4352-aa4e-423bc649f2ac',
  '第47期每周一课：AI技术演变史': '777954b5-a00c-48a1-8175-3002d96c7600',
};

async function getExistingR2Keys() {
  const keys = new Set();
  let cont;
  do {
    const res = await r2.send(new ListObjectsV2Command({ Bucket: R2_BUCKET_NAME, ContinuationToken: cont }));
    if (res.Contents) res.Contents.forEach(o => keys.add(o.Key));
    cont = res.NextContinuationToken;
  } while (cont);
  return keys;
}

async function uploadToR2(filePath, r2Key) {
  const fileBuffer = await readFile(filePath);
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: r2Key,
    Body: fileBuffer,
    ContentType: 'video/mp4',
  }));
  const encodedKey = r2Key.split('/').map(s => encodeURIComponent(s)).join('/');
  return `${R2_PUBLIC_URL}/${encodedKey}`;
}

async function updateSupabase(courseId, url) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${courseId}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ video_url: url }),
  });
  if (!res.ok) throw new Error(`数据库更新失败: ${res.status} ${await res.text()}`);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const dir = '/Users/apple/Downloads/俱乐部课程/PLUS压缩';

  console.log('\n🎬 PLUS 视频上传工具（精确映射版）\n');
  if (dryRun) console.log('🔍 试运行模式\n');

  const existingKeys = await getExistingR2Keys();
  console.log(`📦 R2 已有: ${existingKeys.size} 个文件\n`);

  const files = (await readdir(dir)).filter(f => f.endsWith('.mp4') && !f.startsWith('.'));
  console.log(`📁 找到 ${files.length} 个视频文件\n`);

  let uploaded = 0, skipped = 0, unmatched = 0, failed = 0;

  for (const file of files) {
    const name = file.replace(/\.mp4$/, '');
    const courseId = FILE_TO_COURSE[name];
    const filePath = join(dir, file);
    const fstat = await stat(filePath);
    const sizeMB = (fstat.size / 1024 / 1024).toFixed(1);

    if (!courseId) {
      console.log(`  ⚠️  未映射: ${file} (${sizeMB}MB)`);
      unmatched++;
      continue;
    }

    if (existingKeys.has(file)) {
      console.log(`  ⏭️  已存在: ${file} (${sizeMB}MB)`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  ✅ ${file} (${sizeMB}MB) → ${courseId.slice(0, 8)}...`);
      uploaded++;
    } else {
      try {
        console.log(`  ⬆️  上传: ${file} (${sizeMB}MB)`);
        const url = await uploadToR2(filePath, file);
        await updateSupabase(courseId, url);
        console.log(`  ✅ 完成: ${url}`);
        uploaded++;
      } catch (err) {
        console.log(`  ❌ 失败: ${err.message}`);
        failed++;
      }
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📊 上传 ${uploaded} | 跳过 ${skipped} | 未映射 ${unmatched} | 失败 ${failed}`);
  if (!dryRun && uploaded > 0) console.log('\n🎉 上传完成！');
}

main().catch(err => { console.error('💥', err); process.exit(1); });
