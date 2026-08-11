import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const kind = String(process.argv[2] || "").trim();
const textbookPath = resolve(import.meta.dirname, "../supabase/seed-data/hai-sizheng-textbooks.json");
const casePath = resolve(import.meta.dirname, "../supabase/seed-data/hai-politics-cases.json");

if (kind === "textbooks") {
  const payload = JSON.parse(readFileSync(textbookPath, "utf8"));
  const slug = String(process.argv[3] || "").trim();
  const batch = slug
    ? {
        collections: payload.collections.filter((item) => item.slug === slug),
        sections: payload.sections.filter((item) => item.collection_slug === slug),
      }
    : payload;
  if (batch.collections.length === 0 || batch.sections.length === 0) throw new Error(`教材集合不存在或没有分段：${slug || "全部"}`);
  const json = JSON.stringify(batch);
  if (json.includes("$textbooks$")) throw new Error("教材数据与 SQL 分隔符冲突。");
  process.stdout.write(`select public.hai_import_textbook_payload($textbooks$${json}$textbooks$::jsonb);`);
} else if (kind === "cases") {
  const payload = JSON.parse(readFileSync(casePath, "utf8"));
  const json = JSON.stringify(payload);
  if (json.includes("$politics_cases$")) throw new Error("案例数据与 SQL 分隔符冲突。");
  process.stdout.write(`select public.hai_import_politics_case_payload($politics_cases$${json}$politics_cases$::jsonb);`);
} else {
  throw new Error("用法：node scripts/render-hai-sizheng-seed-sql.mjs textbooks [collection_slug] | cases");
}
