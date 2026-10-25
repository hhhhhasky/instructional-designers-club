import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(process.argv[2] || "/Users/apple/.agents/skills/design-learning-units");
const version = process.argv[3] || "v2.1.0-lean-prompts";
const destination = join(root, "supabase/skill-sources/design-learning-units", version);
const paths = ["SKILL.md", ...["references", "assets"].flatMap(folder =>
  readdirSync(join(source, folder)).filter(name => name.endsWith(".md") && (folder !== "references" || name === "mode-selection.md")).sort().map(name => `${folder}/${name}`)
), "agents/openai.yaml"];
const runtime = new Set(paths.filter(path => path.endsWith(".md") && path !== "SKILL.md"));
// The existing Work import API requires these fields; use its existing snapshot
// mechanism without adding any additional publication gate or hash scheme.
const hash = (text) => createHash("sha256").update(text).digest("hex");
const files = paths.map((path) => {
  const original = readFileSync(join(source, path), "utf8");
  // The quality checklist remains in SKILL.md; remove only links to a reference
  // omitted from this lean runtime package.
  const content = path === "SKILL.md" ? original
    .replace("按本文第八部分与 [质量回看](references/quality-criteria.md) 通读整套方案", "按本文第八部分通读整套方案")
    .replace("详细的模式差异见 [质量回看](references/quality-criteria.md)。", "模式差异按对应模板检查。") : original;
  mkdirSync(resolve(destination, path, ".."), { recursive: true });
  writeFileSync(join(destination, path), content);
  return { path, content };
});
const references = files.filter((file) => file.path !== "SKILL.md" && file.path.endsWith(".md")).map((file, index) => ({
  ...file, name: file.content.match(/^#\s+(.+)$/m)?.[1] || file.path,
  description: "四步工作流资料，按阶段与已确认模式读取",
  media_type: file.path.endsWith(".yaml") ? "application/yaml" : "text/markdown",
  content_hash: hash(file.content), load_mode: runtime.has(file.path) ? "always" : "evaluation_only",
  max_chars: [...file.content].length, sort_order: (index + 1) * 10, metadata: { source_package: "design-learning-units" },
}));
const payload = {
  skill_slug: "design-learning-units", version_label: version, instructions: files[0].content,
  snapshot_hash: hash(JSON.stringify(files)),
  input_contract: { required: ["stage", "subject", "reconstruction_scope", "textbook_selections"], reconstruction_scopes: ["within-unit", "within-book", "across-books"], curriculum: "read_database_or_leave_blank", workflow_version: 1, mode_templates: true },
  output_contract: { format: "unit_learning_package", unit_files: 1, lesson_files: "one_per_planned_lesson", unit_sections: "按已确认模式的整体模板", lesson_sections: ["教学内容分析", "学情分析", "教学目标", "教学评价设计", "教学流程设计", "板书设计", "作业设计", "教学反思"] },
  source_metadata: { source_package: "design-learning-units", source_kind: "local_skill", source_file_count: files.length, runtime_reference_count: references.filter((file) => file.load_mode === "always").length },
  references,
};
writeFileSync(join(root, "supabase/seed-data/design-learning-units-work-skill.json"), `${JSON.stringify(payload, null, 2)}\n`);
const json = JSON.stringify(payload);
if (json.includes("$unitbundle$")) throw new Error("SQL delimiter conflict");
// Import as a draft first. The existing publish=true RPC rewrites every Skill's
// match criteria to politics; promote the unit version explicitly in one transaction.
const sql = `begin;
with payload as (select $unitbundle$${json}$unitbundle$::jsonb as data)
select public.hai_import_work_skill_snapshot(data->>'skill_slug',data->>'version_label',data->>'instructions',
data->'input_contract',data->'output_contract',data->>'snapshot_hash',data->'source_metadata',data->'references',false) from payload;
update public.hai_work_skill_versions set status='archived',updated_at=now()
where skill_id=(select id from public.hai_work_skills where slug='design-learning-units') and status='published';
update public.hai_work_skill_versions set status='published',published_at=now(),updated_at=now()
where skill_id=(select id from public.hai_work_skills where slug='design-learning-units')
and version_label='${version.replaceAll("'", "''")}' and status='draft';
update public.hai_work_skills set is_enabled=true,description='按四步流程确认模式与整体设计，交付整体方案和逐课详案。',updated_at=now() where slug='design-learning-units';
select public.hai_recompute_work_module_enabled('unit-learning-design');
commit;\n`;
writeFileSync(join(root, "supabase/seed-data/design-learning-units-work-skill.sql"), sql);
console.log(`已整理 ${files.length} 份源文件，${payload.source_metadata.runtime_reference_count} 份运行资料；版本 ${version}。`);
