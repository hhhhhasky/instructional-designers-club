#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { completeTextbookPayload, validateHaiTextbookPayload } from "./hai-textbook-payload.mjs";

const inputPath = path.resolve(process.argv[2] || "supabase/seed-data/hai-sizheng-textbooks.json");
const outputPath = path.resolve(process.argv[3] || inputPath);
const source = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const payload = completeTextbookPayload({
  ...source,
  schemaVersion: "hai-textbook-v2",
  generatedAt: source.generated_at || new Date().toISOString(),
});
validateHaiTextbookPayload(payload, { source: outputPath });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: outputPath, collections: payload.collections.length, sections: payload.sections.length, links: payload.links.length }, null, 2));
