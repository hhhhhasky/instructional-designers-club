// Deployment step: run only when publishing HAI Work async execution is authorized.
// Sets the Edge worker secret and the service-only database dispatcher config.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const file of ['.env', '.env.upload']) {
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* optional environment file */ }
}
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
if (!url || !serviceKey || !accessToken) throw new Error('缺少 Supabase URL、服务端 key 或 SUPABASE_ACCESS_TOKEN。');
const projectRef = new URL(url).hostname.split('.')[0];
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const existing = await admin.from('hai_work_scheduler_config').select('auth_secret').eq('singleton', true).maybeSingle();
if (existing.error) throw new Error(`读取 Work 调度配置失败：${existing.error.message}`);
const secret = process.env.HAI_WORK_WORKER_SECRET || existing.data?.auth_secret || randomBytes(32).toString('hex');
if (secret.length < 32) throw new Error('HAI_WORK_WORKER_SECRET 至少 32 字符。');
const response = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/secrets`, {
  method: 'POST', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
  body: JSON.stringify([{ name: 'HAI_WORK_WORKER_SECRET', value: secret }]),
});
if (!response.ok) throw new Error(`写入 Work Edge secret 失败（HTTP ${response.status}）。`);
const config = await admin.from('hai_work_scheduler_config').upsert({
  singleton: true, endpoint_url: `${url.replace(/\/$/, '')}/functions/v1/hai-work-worker`, auth_secret: secret, enabled: true,
});
if (config.error) throw new Error(`写入 Work 调度配置失败：${config.error.message}`);
console.log('HAI Work 服务端调度已配置；每 10 秒补发待执行任务。密钥未输出。');
