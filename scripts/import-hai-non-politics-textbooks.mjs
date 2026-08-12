import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { validateHaiTextbookPayload } from "./hai-textbook-payload.mjs";

const root = process.cwd();
loadEnv(".env");

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
const payloadPath = process.argv[2] || "supabase/seed-data/hai-non-politics-textbooks.json";
const payload = JSON.parse(readFileSync(payloadPath, "utf8"));
validateHaiTextbookPayload(payload, { source: payloadPath });
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("缺少 VITE_SUPABASE_URL/SUPABASE_URL 或 SUPABASE_SECRET_KEY。只使用服务端密钥运行此脚本。 ");
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await client.rpc("hai_import_textbook_payload", { p_payload: payload });
if (error) throw new Error(`HAI 教材导入失败：${error.message}`);
console.log(JSON.stringify({ payload: payloadPath, result: data }, null, 2));

function loadEnv(file) {
  try {
    for (const line of readFileSync(join(root, file), "utf8").split(/\r?\n/)) {
      const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Optional env file.
  }
}
