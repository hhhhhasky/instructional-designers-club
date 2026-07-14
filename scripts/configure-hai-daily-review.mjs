// 为 HAI 每日复盘配置 Edge secret 与数据库 cron 调用端点。
// 前置：迁移 20260714190000 已应用，Supabase CLI 已 link。
// 用法：node scripts/configure-hai-daily-review.mjs

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
loadEnv(".env");
loadEnv(".env.upload");

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const secret = process.env.HAI_DAILY_REVIEW_SECRET || randomBytes(32).toString("hex");
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("缺少 VITE_SUPABASE_URL/SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY。");
}

const cli = spawnSync("supabase", ["secrets", "set", `HAI_DAILY_REVIEW_SECRET=${secret}`], {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
if (cli.status !== 0) {
  throw new Error(`Supabase Edge secret 写入失败：${cli.stderr || cli.stdout}`);
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error } = await client.from("hai_daily_review_scheduler_config").upsert({
  singleton: true,
  endpoint_url: `${supabaseUrl.replace(/\/$/, "")}/functions/v1/hai-daily-review`,
  auth_secret: secret,
  enabled: true,
  updated_at: new Date().toISOString(),
}, { onConflict: "singleton" });
if (error) throw error;

console.log("✓ HAI 每日复盘 secret 已写入 Edge Function 与数据库定时调用配置。");
console.log("✓ cron: UTC 16:05 / 北京时间次日 00:05，复盘前一自然日。");

function loadEnv(file) {
  try {
    for (const line of readFileSync(join(root, file), "utf8").split(/\r?\n/)) {
      const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // 可选 env 文件。
  }
}
