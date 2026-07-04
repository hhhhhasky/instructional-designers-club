import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const VERSION_LABEL = "ask-han-consultant-standard-2026-07-04";
const MIGRATION_PATH = join(
  ROOT,
  "supabase",
  "migrations",
  "20260704172000_hai_ask_han_consultant_standard_prompt.sql",
);

loadEnv(".env");
loadEnv(".env.upload");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const [systemPrompt, developerPrompt, responseContract] = extractPromptBlocks(MIGRATION_PATH);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
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

if (
  current?.version_label === VERSION_LABEL &&
  current.system_prompt === systemPrompt &&
  current.developer_prompt === developerPrompt &&
  current.response_contract === responseContract
) {
  console.log(`Published ask-han prompt already up to date: ${VERSION_LABEL}`);
  process.exit(0);
}

const { error: archiveError } = await supabase
  .from("hai_prompt_versions")
  .update({ status: "archived", updated_at: new Date().toISOString() })
  .eq("module_id", module.id)
  .eq("status", "published");

if (archiveError) throw archiveError;

const { error: deleteError } = await supabase
  .from("hai_prompt_versions")
  .delete()
  .eq("module_id", module.id)
  .eq("version_label", VERSION_LABEL);

if (deleteError) throw deleteError;

const { error: insertError } = await supabase
  .from("hai_prompt_versions")
  .insert({
    module_id: module.id,
    version_label: VERSION_LABEL,
    status: "published",
    system_prompt: systemPrompt,
    developer_prompt: developerPrompt,
    response_contract: responseContract,
    published_at: new Date().toISOString(),
  });

if (insertError) throw insertError;

console.log(`Published ask-han prompt: ${VERSION_LABEL}`);

function extractPromptBlocks(path) {
  const sql = readFileSync(path, "utf8");
  const blocks = [...sql.matchAll(/\$prompt\$\n?([\s\S]*?)\n?\$prompt\$/g)].map((match) => match[1].trim());
  if (blocks.length !== 3) {
    throw new Error(`Expected 3 prompt blocks in ${path}, found ${blocks.length}.`);
  }
  return blocks;
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
