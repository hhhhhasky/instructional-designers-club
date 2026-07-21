// HAI 每日优化闭环 - 数据导出
//
// 用 service role key 拉取指定日期范围内、带 trace 的 assistant 回复，
// 输出 JSON 到 docs/hai-optimization-runs/<run_date>.json，供 Claude 逐条评估。
//
// 用法：
//   node scripts/hai-daily-export.mjs                # 今天 00:00 ~ 现在
//   node scripts/hai-daily-export.mjs --date 2026-07-04      # 指定日（全天）
//   node scripts/hai-daily-export.mjs --since 2026-07-03 --until 2026-07-05
//
// 退出码：0=有数据已导出 / 0且打印"无活动"=区间内无提问 / 1=出错

import { readFileSync } from "node:fs";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
loadEnv(".env");
loadEnv(".env.upload");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SECRET_KEY (check .env / .env.upload).");
}

// ---------- 解析参数 → {sinceIso, untilIso, runDate} ----------
function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const date = get("date");
  const since = get("since");
  const until = get("until");

  // runDate = 评估归属的本地日期（用于输出文件名 & 幂等）
  const todayLocal = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
  let runDate;
  let sinceIso, untilIso;

  if (date) {
    runDate = date;
    sinceIso = `${date}T00:00:00+08:00`;
    untilIso = `${date}T23:59:59+08:00`;
  } else if (since || until) {
    runDate = since || todayLocal;
    sinceIso = since ? `${since}T00:00:00+08:00` : undefined;
    untilIso = until ? `${until}T23:59:59+08:00` : new Date().toISOString();
  } else {
    // 默认：今天（本地）00:00 ~ 现在
    runDate = todayLocal;
    sinceIso = `${todayLocal}T00:00:00+08:00`;
    untilIso = new Date().toISOString();
  }
  return { sinceIso, untilIso, runDate };
}

const { sinceIso, untilIso, runDate } = parseArgs();
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- 拉取带 trace 的 assistant 消息 ----------
let query = supabase
  .from("hai_messages")
  .select("id, conversation_id, user_id, content, metadata, created_at")
  .eq("role", "assistant")
  .order("created_at", { ascending: true });

if (sinceIso) query = query.gte("created_at", sinceIso);
if (untilIso) query = query.lte("created_at", untilIso);

const { data: assistantMsgs, error } = await query;
if (error) throw error;

// 只保留有 trace 的（trace 是评估的输入；没有 trace 的视为可观察但不在评分范围）
const turns = (assistantMsgs ?? [])
  .filter((m) => m.metadata && m.metadata.hai_context_trace)
  .map((m, idx) => {
    const t = m.metadata.hai_context_trace;
    return {
      turn_index: idx + 1,
      message_id: m.id,
      conversation_id: m.conversation_id,
      user_id: m.user_id,
      created_at: m.created_at,
      question: t.question ?? null,
      final_answer: m.content ?? t.final_answer ?? "",
      draft_answer: t.draft_answer ?? null,
      trace: t,
    };
  });

const outDir = join(ROOT, "docs", "hai-optimization-runs");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `${runDate}.json`);

if (turns.length === 0) {
  // 仍写一份空记录，便于幂等判断"这一天已检查过、确实无活动"
  writeFileSync(outPath, JSON.stringify({ run_date: runDate, since: sinceIso, until: untilIso, turns: [], empty: true }, null, 2));
  console.log(`无活动，跳过。区间 ${sinceIso ?? "(-)"} ~ ${untilIso} 内无带 trace 的 assistant 消息。已写入 ${outPath}`);
  process.exit(0);
}

const payload = {
  run_date: runDate,
  since: sinceIso,
  until: untilIso,
  turns_count: turns.length,
  turns,
};
writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(`导出 ${turns.length} 条轮次 → ${outPath}`);

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
