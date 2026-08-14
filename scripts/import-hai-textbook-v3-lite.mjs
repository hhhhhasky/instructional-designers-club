#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
loadEnv(".env");

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
const payloadPath = process.argv[2] || "supabase/seed-data/hai-authoritative-reconstruction-textbooks-v3-lite.json";
const batchSize = numberArgument("--batch-size=", 4);
const sourcePayload = JSON.parse(readFileSync(payloadPath, "utf8"));

if (sourcePayload.schema_version !== "hai-textbook-v3-lite") {
  throw new Error(`Expected hai-textbook-v3-lite payload: ${payloadPath}`);
}
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("缺少 VITE_SUPABASE_URL/SUPABASE_URL 或 SUPABASE_SECRET_KEY。");
}

const batches = splitPayloadByCollection(sourcePayload, batchSize);
const results = [];
for (const [index, batch] of batches.entries()) {
  const data = await importPayload(batch);
  results.push(data);
  console.log(JSON.stringify({
    payload: payloadPath,
    batch: `${index + 1}/${batches.length}`,
    collection_slugs: batch.collections.map((collection) => collection.slug),
    result: data,
  }, null, 2));
}

console.log(JSON.stringify({
  schema_version: sourcePayload.schema_version,
  batches: batches.length,
  collections: sourcePayload.collections.length,
  sections: sourcePayload.sections.length,
  links: sourcePayload.links.length,
  results,
}, null, 2));

function splitPayloadByCollection(source, size) {
  const result = [];
  for (let offset = 0; offset < source.collections.length; offset += size) {
    const collections = source.collections.slice(offset, offset + size);
    const slugs = new Set(collections.map((collection) => collection.slug));
    const sections = source.sections.filter((section) => slugs.has(section.collection_slug));
    const sectionKeys = new Set(sections.map((section) => section.section_key));
    const links = source.links.filter((link) =>
      sectionKeys.has(link.section_key) && sectionKeys.has(link.linked_section_key));
    result.push({
      ...source,
      expected_book_count: collections.length,
      expected_unit_count: sections.filter((section) => section.section_level === "unit").length,
      expected_lesson_count: sections.filter((section) => section.section_level === "lesson").length,
      expected_frame_count: sections.filter((section) => section.section_level === "frame").length,
      expected_section_count: sections.length,
      expected_link_count: links.length,
      collections,
      sections,
      links,
    });
  }
  return result;
}

async function importPayload(batch) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/hai_import_textbook_v3_lite_payload`, {
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
      // Keep gateway text as-is.
    }
    throw new Error(`V3-lite 教材导入失败（HTTP ${response.status}）：${message}`);
  }
  return responseText ? JSON.parse(responseText) : null;
}

function numberArgument(name, fallback) {
  const argument = process.argv.find((item) => item.startsWith(name));
  const value = Number.parseInt(argument?.slice(name.length) || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function loadEnv(file) {
  try {
    for (const line of readFileSync(join(root, file), "utf8").split(/\r?\n/u)) {
      const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/gu, "");
    }
  } catch {
    // Environment may already provide credentials.
  }
}
