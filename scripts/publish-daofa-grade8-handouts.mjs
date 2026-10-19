import fs from 'node:fs/promises';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
const env = {};
for (const file of ['.env', '.env.upload']) for (const line of (await fs.readFile(file, 'utf8')).split('\n')) {
  const match = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}
const directory = 'output/daofa-handouts-20261019';
const manifest = JSON.parse(await fs.readFile(`${directory}/manifest.json`, 'utf8'));
if (manifest.length !== 2 || manifest.some(row => !['grade-8-up-handout', 'grade-8-down-handout'].includes(row.lessonId))) throw Error('Unexpected publish targets');
const api = `${env.VITE_SUPABASE_URL}/rest/v1/daofa_lesson_media`;
const headers = { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`, 'Content-Type': 'application/json' };
const filter = '?lesson_id=in.(grade-8-up-handout,grade-8-down-handout)';
const before = await fetch(api + filter, { headers });
if (!before.ok) throw Error(`Read failed: ${before.status}`);
await fs.writeFile(`${directory}/before-publish.json`, JSON.stringify(await before.json(), null, 2));
const r2 = new S3Client({ region: 'auto', endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY } });
for (const row of manifest) {
  const body = await fs.readFile(`${directory}/${row.lessonId.replace('-handout', '')}.html`);
  await r2.send(new PutObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: row.storageKey, Body: body, ContentType: 'text/html; charset=utf-8', CacheControl: 'private, max-age=0, no-store' }));
  const head = await r2.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: row.storageKey }));
  if (head.ContentLength !== body.length) throw Error('Upload length mismatch');
  console.log('Private handout uploaded:', row.lessonId, body.length);
}
// One request writes both rows atomically. Existing video/canvas mappings are untouched.
const rows = manifest.map(row => ({ lesson_id: row.lessonId, storage_key: row.storageKey, media_type: 'canvas', is_active: true }));
const written = await fetch(api + '?on_conflict=lesson_id', { method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(rows) });
if (!written.ok) throw Error(`Publish failed: ${written.status} ${await written.text()}`);
const after = await fetch(api + filter + '&order=lesson_id', { headers });
if (!after.ok) throw Error(`Verify failed: ${after.status}`);
const verified = await after.json();
if (verified.length !== 2 || rows.some(row => !verified.some(actual => actual.lesson_id === row.lesson_id && actual.storage_key === row.storage_key && actual.is_active))) throw Error('Published rows do not match');
await fs.writeFile(`${directory}/published.json`, JSON.stringify(verified, null, 2));
console.log('Verified mappings:', verified);
