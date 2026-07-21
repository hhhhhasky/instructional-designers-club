// HAI 每日优化闭环 - prompt 落地写入（唯一 DB 写入口）
//
// 把评估后议定的 prompt 改动写入 hai_orchestrator_prompt_configs（热生效），
// 并在 hai_optimization_log 留痕。所有 prompt 改动必须走这里，保证可审计。
//
// 用法（三种，任选）：
//   1) 命令行单条：
//        node scripts/hai-apply-prompt-config.mjs --key style_pack --reason "..." --file path/to/new.md
//        node scripts/hai-apply-prompt-config.mjs --key style_pack --reason "..." --inline "新内容"
//   2) 批量 JSON 文件（推荐，由每日循环产出）：
//        node scripts/hai-apply-prompt-config.mjs --batch path/to/changes.json --run-date 2026-07-05
//        changes.json = [{ key, reason, file? } | { key, reason, inline? }]
//   3) 仅预览不写：加 --dry-run
//
// hai_optimization_log 表若尚未建（migration 未跑），留痕会失败但不阻塞 prompt 写入，仅告警。

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
loadEnv(".env");
loadEnv(".env.upload");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SECRET_KEY (check .env / .env.upload).");
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const get = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const batchPath = get("batch");
const runDate = get("run-date") || new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });

// ---------- 组装变更列表 ----------
let changes; // [{key, reason, content}]
if (batchPath) {
  const raw = JSON.parse(readFileSync(join(ROOT, batchPath), "utf8"));
  changes = raw.map((c) => resolveContent(c));
} else {
  const key = get("key");
  if (!key) {
    console.error("用法：--batch <file>  或  --key <key> --reason <text> (--file <path> | --inline <text>)");
    process.exit(1);
  }
  changes = [resolveContent({ key, reason: get("reason") || "(no reason)", file: get("file"), inline: get("inline") })];
}

function resolveContent(c) {
  let content;
  if (c.file) content = readFileSync(join(ROOT, c.file), "utf8");
  else if (c.inline != null) content = c.inline;
  else throw new Error(`变更 ${c.key} 缺少 file/inline 内容`);
  return { key: c.key, reason: c.reason || "(no reason)", content };
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- 校验 key 存在 & 预览旧值 ----------
const keys = [...new Set(changes.map((c) => c.key))];
const { data: existing, error: existErr } = await supabase
  .from("hai_orchestrator_prompt_configs")
  .select("key, label, content")
  .in("key", keys);
if (existErr) throw existErr;
const existingMap = new Map((existing ?? []).map((r) => [r.key, r]));
const missing = keys.filter((k) => !existingMap.has(k));
if (missing.length) {
  console.error(`以下 key 在 hai_orchestrator_prompt_configs 中不存在，已中止：${missing.join(", ")}`);
  console.error(`可用 key 见该表，或通过 migration 新增。`);
  process.exit(1);
}

console.log(`\n=== ${dryRun ? "[DRY-RUN] " : ""}拟落地 ${changes.length} 处改动 (run_date=${runDate}) ===`);
for (const c of changes) {
  const old = existingMap.get(c.key);
  console.log(`\n- key: ${c.key}  (${old.label})`);
  console.log(`  reason: ${c.reason}`);
  console.log(`  旧内容长度: ${(old.content || "").length}  →  新内容长度: ${c.content.length}`);
}

if (dryRun) {
  console.log("\n[DRY-RUN] 未写入。去掉 --dry-run 实际落地。");
  process.exit(0);
}

// ---------- 写入（每条一次 update，便于逐条报错）----------
const applied = [];
for (const c of changes) {
  const { error } = await supabase
    .from("hai_orchestrator_prompt_configs")
    .update({ content: c.content, updated_at: new Date().toISOString() })
    .eq("key", c.key);
  if (error) {
    console.error(`写入失败 key=${c.key}: ${error.message}`);
    process.exit(1);
  }
  applied.push({ key: c.key, reason: c.reason, applied_at: new Date().toISOString() });
  console.log(`✓ 已写入 ${c.key}`);
}

// ---------- 留痕到 hai_optimization_log ----------
const { error: logErr } = await supabase.from("hai_optimization_log").upsert(
  {
    run_date: runDate,
    changes_applied: applied,
  },
  { onConflict: "run_date" },
);
if (logErr) {
  console.warn(`⚠️ prompt 已写入，但留痕到 hai_optimization_log 失败：${logErr.message}`);
  console.warn(`  可能是 migration 20260705220000_hai_optimization_log.sql 尚未执行。请补跑后手动追加日志。`);
} else {
  console.log(`✓ 已留痕 hai_optimization_log (run_date=${runDate})`);
}

function loadEnv(file) {
  try {
    const content = readFileSync(join(ROOT, file), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // 可选 env 文件，忽略
  }
}
