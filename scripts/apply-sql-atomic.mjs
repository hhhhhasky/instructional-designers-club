#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
loadEnv(".env");
const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = "isjflmyhbvdlmcsaewbq";
const file = process.argv[2];
if (!file) throw new Error("请提供 SQL 文件路径。");
if (!token) throw new Error("缺少 SUPABASE_ACCESS_TOKEN。");
const sql = fs.readFileSync(path.resolve(file), "utf8");
const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
});
const text = await response.text();
if (!response.ok) throw new Error(`原子 SQL 执行失败（HTTP ${response.status}）：${text.slice(0, 1200)}`);
console.log(text || "原子 SQL 执行成功。");

function loadEnv(fileName) {
  try {
    for (const line of fs.readFileSync(path.join(root, fileName), "utf8").split(/\r?\n/u)) {
      const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/gu, "");
    }
  } catch {
    // Environment may be supplied by CI.
  }
}
