import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateHaiTextbookPayload } from "./hai-textbook-payload.mjs";

const root = process.cwd();
loadEnv(".env");

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
const payloadPath = process.argv[2] || "supabase/seed-data/hai-non-politics-textbooks.json";
const batchSizeArg = process.argv.find((arg) => arg.startsWith("--batch-size="));
const batchSize = Number.parseInt(batchSizeArg?.split("=")[1] || "0", 10);
const payload = JSON.parse(readFileSync(payloadPath, "utf8"));
validateHaiTextbookPayload(payload, { source: payloadPath });
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("缺少 VITE_SUPABASE_URL/SUPABASE_URL 或 SUPABASE_SECRET_KEY。只使用服务端密钥运行此脚本。 ");
}

const payloads = batchSize > 0 ? splitPayloadByCollection(payload, batchSize) : [payload];
const results = [];
for (const [index, batch] of payloads.entries()) {
  validateHaiTextbookPayload(batch, { source: `${payloadPath} batch ${index + 1}` });
  const data = await importPayload(batch);
  results.push(data);
  console.log(JSON.stringify({
    payload: payloadPath,
    batch: `${index + 1}/${payloads.length}`,
    collection_slugs: batch.collections.map((collection) => collection.slug),
    result: data,
  }, null, 2));
}

async function importPayload(batch) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/hai_import_textbook_payload`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_payload: batch }),
  });
  const responseText = await response.text();
  if (!response.ok) {
    let message = responseText;
    try {
      message = JSON.parse(responseText)?.message || responseText;
    } catch {
      // Keep the raw response for non-JSON gateway errors.
    }
    throw new Error(`HAI 教材导入失败（HTTP ${response.status}）：${message}`);
  }
  return responseText ? JSON.parse(responseText) : null;
}

function splitPayloadByCollection(source, size) {
  const batches = [];
  for (let offset = 0; offset < source.collections.length; offset += size) {
    const collections = source.collections.slice(offset, offset + size);
    const slugs = new Set(collections.map((collection) => collection.slug));
    const sections = source.sections.filter((section) => slugs.has(section.collection_slug));
    const sectionKeys = new Set(sections.map((section) => section.section_key));
    const links = source.links.filter((link) =>
      sectionKeys.has(link.section_key) && sectionKeys.has(link.linked_section_key));
    batches.push({
      ...source,
      collections,
      sections,
      links,
    });
  }
  return batches;
}

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
