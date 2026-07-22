import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const slug = String(process.argv[2] || "").trim();
if (!slug) throw new Error("请提供教材 collection slug。");

const dataPath = resolve(import.meta.dirname, "../supabase/seed-data/hai-junior-politics-textbooks.json");
const payload = JSON.parse(readFileSync(dataPath, "utf8"));
const collection = payload.collections.find((item) => item.slug === slug);
if (!collection) throw new Error(`教材不存在：${slug}`);

const batch = {
  schema_version: payload.schema_version,
  collections: [collection],
  sections: payload.sections.filter((item) => item.collection_slug === slug),
};
const json = JSON.stringify(batch);
if (json.includes("$textbooks$")) throw new Error("教材数据与 SQL 分隔符冲突。");
process.stdout.write(`select public.hai_import_textbook_payload($textbooks$${json}$textbooks$::jsonb);`);
