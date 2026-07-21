import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const VERSION_LABEL = "ask-han-expression-style-2026-07-04";
const MIGRATION_PATH = join(
  ROOT,
  "supabase",
  "migrations",
  "20260704182000_hai_ask_han_expression_style_prompt.sql",
);

loadEnv(".env");
loadEnv(".env.upload");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SECRET_KEY.");
}

const styleAppendix = extractStyleBlock(MIGRATION_PATH);
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: module, error: moduleError } = await supabase
  .from("hai_feature_modules")
  .select("id, slug")
  .eq("slug", "ask-han")
  .single();

if (moduleError) throw moduleError;

const { data: current, error: currentError } = await supabase
  .from("hai_prompt_versions")
  .select("id, version_label, system_prompt, developer_prompt, response_contract")
  .eq("module_id", module.id)
  .eq("status", "published")
  .maybeSingle();

if (currentError) throw currentError;
if (!current) throw new Error("No published ask-han prompt found.");

if (current.version_label === VERSION_LABEL) {
  console.log(`Published ask-han prompt already up to date: ${VERSION_LABEL}`);
  process.exit(0);
}

const nextSystemPrompt = `${current.system_prompt.trim()}\n\n${styleAppendix.trim()}`;

const { error: deleteError } = await supabase
  .from("hai_prompt_versions")
  .delete()
  .eq("module_id", module.id)
  .eq("version_label", VERSION_LABEL);

if (deleteError) throw deleteError;

const { error: archiveError } = await supabase
  .from("hai_prompt_versions")
  .update({ status: "archived", updated_at: new Date().toISOString() })
  .eq("module_id", module.id)
  .eq("status", "published");

if (archiveError) throw archiveError;

const { error: insertError } = await supabase
  .from("hai_prompt_versions")
  .insert({
    module_id: module.id,
    version_label: VERSION_LABEL,
    status: "published",
    system_prompt: nextSystemPrompt,
    developer_prompt: current.developer_prompt,
    response_contract: current.response_contract,
    published_at: new Date().toISOString(),
  });

if (insertError) throw insertError;

console.log(`Published ask-han prompt: ${VERSION_LABEL}`);

function extractStyleBlock(path) {
  const sql = readFileSync(path, "utf8");
  const match = sql.match(/\$style\$\n?([\s\S]*?)\n?\$style\$/);
  if (!match) throw new Error(`Could not find $style$ block in ${path}.`);
  return match[1].trim();
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
    // Optional env file.
  }
}
