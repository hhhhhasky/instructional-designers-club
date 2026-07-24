import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [
  versionLabel,
  expectedPublishedLabel,
  expectedPublishedSnapshotHash,
  migrationTimestamp,
] = process.argv.slice(2);

const safeLabel = /^[a-zA-Z0-9._-]+$/;
const safeTimestamp = /^\d{14}$/;
const safeHash = /^[a-f0-9]{32}$/;

if (
  !safeLabel.test(versionLabel ?? "") ||
  !safeLabel.test(expectedPublishedLabel ?? "") ||
  !safeHash.test(expectedPublishedSnapshotHash ?? "") ||
  !safeTimestamp.test(migrationTimestamp ?? "")
) {
  throw new Error(
    "Usage: node scripts/generate-hai-consultation-migration.mjs <version> <expected-published-version> <expected-snapshot-md5> <YYYYMMDDHHMMSS>",
  );
}

const root = process.cwd();
const sourceDir = resolve(
  root,
  "supabase",
  "skill-sources",
  "hai-consultation",
  versionLabel,
);
const outputPath = resolve(
  root,
  "supabase",
  "migrations",
  `${migrationTimestamp}_hai_consultation_${versionLabel}_published_snapshot.sql`,
);

const references = [
  {
    variable: "v_decision_rules",
    delimiter: "decision_rules",
    path: "references/decision-rules.md",
    name: "HAI 教学决策规则",
    description:
      "只供内部诊断使用的信息充分性、必要性、适配性、学习机制、目标、因果与验证规则；不向用户展示检查链。",
    loadMode: "always",
    maxChars: 16000,
    sortOrder: 0,
    kind: "internal_decision_rules",
  },
  {
    variable: "v_expression_rules",
    delimiter: "expression_rules",
    path: "references/conversation-expression.md",
    name: "HAI Chat 对话表达规则",
    description:
      "按直接判断、条件判断或必要追问控制自然表达；每轮常驻加载。",
    loadMode: "always",
    maxChars: 12000,
    sortOrder: 5,
    kind: "external_expression",
  },
  {
    variable: "v_method_cards",
    delimiter: "method_cards",
    path: "references/method-cards.md",
    name: "35 张课程方法卡索引",
    description:
      "四类咨询的方法卡检索索引；完整结构化方法卡仍由 HAI 运行时按题注入。",
    loadMode: "on_demand",
    maxChars: 12000,
    sortOrder: 10,
    kind: "method_index",
  },
  {
    variable: "v_evaluation_rubric",
    delimiter: "evaluation_rubric",
    path: "references/evaluation-rubric.md",
    name: `HAI Chat ${versionLabel} 验收规则`,
    description:
      "分别检查响应方式、教学判断、范围边界与外在表达质量；只用于离线或后台评估。",
    loadMode: "evaluation_only",
    maxChars: 12000,
    sortOrder: 20,
    kind: "evaluation",
  },
];

function readText(relativePath) {
  const content = readFileSync(resolve(sourceDir, relativePath), "utf8");
  if (!content.trim()) {
    throw new Error(`${relativePath} is empty`);
  }
  return content;
}

function dollarQuote(label, content) {
  const delimiter = `$${label}_${versionLabel}$`;
  if (content.includes(delimiter)) {
    throw new Error(`Source content contains SQL delimiter ${delimiter}`);
  }
  return `${delimiter}${content}${delimiter}`;
}

function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

const instructions = readText("SKILL.md");
const referenceContents = new Map(
  references.map((reference) => [reference.path, readText(reference.path)]),
);

const declarations = references
  .map(
    (reference) =>
      `  ${reference.variable} text := ${dollarQuote(
        reference.delimiter,
        referenceContents.get(reference.path),
      )};`,
  )
  .join("\n");

const referenceRows = references
  .map(
    (reference) => `  (
    v_version_id,
    ${sqlString(reference.path)},
    ${sqlString(reference.name)},
    ${sqlString(reference.description)},
    'text/markdown',
    ${reference.variable},
    md5(${reference.variable}),
    ${sqlString(reference.loadMode)},
    ${reference.maxChars},
    ${reference.sortOrder},
    jsonb_build_object('kind', ${sqlString(reference.kind)}, 'version', ${sqlString(versionLabel)})
  )`,
  )
  .join(",\n");

const sql = `begin;

-- Publish the repository copy of HAI Chat Skill ${versionLabel} as one immutable
-- database snapshot. Abort if production no longer matches the downloaded
-- ${expectedPublishedLabel} baseline, so concurrent admin edits cannot be overwritten.
do $migration$
declare
  v_skill_id uuid;
  v_version_id uuid;
  v_previous_version_id uuid;
  v_previous_version_label text;
  v_previous_snapshot_hash text;
  v_module_id uuid;
  v_instructions text := ${dollarQuote("skill", instructions)};
${declarations}
  v_reference_config jsonb := jsonb_build_object(
    'include_method_index', true,
    'method_card_limit', 6,
    'memory_enabled', true,
    'max_reference_count', 4,
    'max_reference_chars', 28000
  );
  v_manifest jsonb;
  v_reference_fingerprint text;
  v_reference_count integer;
begin
  select id into v_skill_id
  from public.hai_chat_skills
  where slug = 'hai-consultation'
  for update;

  if v_skill_id is null then
    raise exception 'hai-consultation Chat Skill 不存在。';
  end if;

  if exists (
    select 1
    from public.hai_chat_skill_versions
    where skill_id = v_skill_id and version_label = ${sqlString(versionLabel)}
  ) then
    raise exception 'hai-consultation ${versionLabel} 已存在，不能覆盖不可变版本。';
  end if;

  select id, version_label, snapshot_hash
  into v_previous_version_id, v_previous_version_label, v_previous_snapshot_hash
  from public.hai_chat_skill_versions
  where skill_id = v_skill_id
    and status = 'published'
  order by created_at desc
  limit 1
  for update;

  if v_previous_version_id is null
    or v_previous_version_label <> ${sqlString(expectedPublishedLabel)}
    or v_previous_snapshot_hash <> ${sqlString(expectedPublishedSnapshotHash)} then
    raise exception
      'hai-consultation 远端 published 基线已变化（当前版本 %，snapshot %），停止发布 ${versionLabel}。',
      coalesce(v_previous_version_label, '<none>'),
      coalesce(v_previous_snapshot_hash, '<none>');
  end if;

  select id into v_module_id
  from public.hai_feature_modules
  where slug = 'hai-chat';

  if v_module_id is null then
    raise exception 'hai-chat 模块不存在。';
  end if;

  update public.hai_chat_skills
  set
    name = '哈老师教学决策咨询',
    description = '优先直接或条件性判断教学分析、设计、研发与实施问题；只追问会改变答案的变量，完整成果转入 HAI Work。',
    source_path = ${sqlString(`/Users/apple/vibe coding project/俱乐部官网/supabase/skill-sources/hai-consultation/${versionLabel}/SKILL.md`)},
    is_enabled = true,
    updated_at = now()
  where id = v_skill_id;

  insert into public.hai_chat_skill_versions (
    skill_id,
    version_label,
    status,
    instructions,
    default_instructions,
    reference_config
  ) values (
    v_skill_id,
    ${sqlString(versionLabel)},
    'draft',
    v_instructions,
    v_instructions,
    v_reference_config
  )
  returning id into v_version_id;

  insert into public.hai_chat_skill_references (
    skill_version_id,
    path,
    name,
    description,
    media_type,
    content,
    content_hash,
    load_mode,
    max_chars,
    sort_order,
    metadata
  ) values
${referenceRows};

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'path', path,
      'name', name,
      'description', description,
      'media_type', media_type,
      'content_hash', content_hash,
      'content_chars', length(content),
      'load_mode', load_mode,
      'max_chars', max_chars,
      'sort_order', sort_order,
      'metadata', metadata
    ) order by sort_order, path), '[]'::jsonb),
    coalesce(string_agg(concat_ws(':',
      path,
      content_hash,
      load_mode,
      max_chars::text,
      sort_order::text,
      media_type,
      md5(name || E'\\n' || description || E'\\n' || metadata::text)
    ), E'\\n' order by sort_order, path), ''),
    count(*)::integer
  into v_manifest, v_reference_fingerprint, v_reference_count
  from public.hai_chat_skill_references
  where skill_version_id = v_version_id;

  if v_reference_count <> 4 then
    raise exception 'hai-consultation ${versionLabel} reference 数量异常：%', v_reference_count;
  end if;

  update public.hai_chat_skill_versions
  set status = 'archived', updated_at = now()
  where skill_id = v_skill_id
    and status = 'published'
    and id <> v_version_id;

  update public.hai_chat_skill_versions
  set
    status = 'published',
    published_at = now(),
    snapshot_manifest = v_manifest,
    snapshot_hash = md5(
      v_instructions || E'\\n--reference-config--\\n' ||
      v_reference_config::text || E'\\n--references--\\n' ||
      v_reference_fingerprint
    ),
    reference_count = v_reference_count,
    updated_at = now()
  where id = v_version_id;

  insert into public.hai_chat_skill_bindings (
    module_id,
    skill_id,
    is_enabled
  ) values (
    v_module_id,
    v_skill_id,
    true
  )
  on conflict (module_id) do update
  set
    skill_id = excluded.skill_id,
    is_enabled = true,
    updated_at = now();
end;
$migration$;

commit;
`;

writeFileSync(outputPath, sql, { encoding: "utf8", flag: "wx" });

const hashes = {
  instructions_md5: createHash("md5").update(instructions).digest("hex"),
  references: Object.fromEntries(
    references.map((reference) => [
      reference.path,
      createHash("md5")
        .update(referenceContents.get(reference.path))
        .digest("hex"),
    ]),
  ),
};

console.log(JSON.stringify({ outputPath, hashes }, null, 2));
