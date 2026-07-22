import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dataPath = resolve(
  import.meta.dirname,
  "../supabase/seed-data/sizheng-public-lesson-design-work-skill.json",
);
const payload = JSON.parse(readFileSync(dataPath, "utf8"));
const args = [
  payload.skill_slug,
  payload.version_label,
  payload.instructions,
  payload.input_contract,
  payload.output_contract,
  payload.snapshot_hash,
  payload.source_metadata,
  payload.references,
];
const json = JSON.stringify(args);
if (json.includes("$skillbundle$")) throw new Error("Skill 数据与 SQL 分隔符冲突。");
process.stdout.write(`
with payload as (
  select $skillbundle$${json}$skillbundle$::jsonb as data
)
select public.hai_import_work_skill_snapshot(
  data->>0,
  data->>1,
  data->>2,
  data->3,
  data->4,
  data->>5,
  data->6,
  data->7,
  true
)
from payload;
`.trim());
