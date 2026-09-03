import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const migrationPath = process.argv[2] ? resolve(process.argv[2]) : null;
if (!migrationPath) throw new Error("请提供已由 supabase migration new 创建的迁移路径。");

const seedDir = join(repoRoot, "supabase/seed-data");
const seedFiles = readdirSync(seedDir)
  .filter((name) => name.endsWith("-public-lesson-design-work-skill.json"))
  .sort();

if (seedFiles.length !== 18) {
  throw new Error(`预期 18 个学科 Skill 快照，实际为 ${seedFiles.length} 个。`);
}

const outputContract = {
  format: "public_lesson_markdown_v2",
  required_sections: [
    "课程基本信息", "课标分析", "教材分析", "学情分析", "教学目标",
    "教学重难点", "教学流程", "教学评估", "板书设计",
  ],
  lesson_flow_required: [
    "设计意图", "对应目标", "核心问题", "核心任务", "教师活动/教学活动", "评估方式", "过渡语",
  ],
  lesson_flow_table_columns: [
    "对应目标", "核心问题", "核心任务", "教师活动/教学活动", "评估方式",
  ],
  rubric_columns: {
    primary: ["评价维度", "合格（1分）", "良好（2分）", "优秀（3分）"],
    secondary: ["评价维度", "新手（1分）", "入门（2分）", "熟练（3分）", "专家（4分）"],
  },
};

const payloads = seedFiles.map((name) => {
  const payload = JSON.parse(readFileSync(join(seedDir, name), "utf8"));
  if (JSON.stringify(payload.output_contract) !== JSON.stringify(outputContract)) {
    throw new Error(`${name} 的输出契约未统一。`);
  }
  return payload;
});

const fallbackPrompt = `你是一名中国学校公开课设计教研员。依据用户提供的教材证据和学情约束，设计一节可实施、可展示、可评价的公开课。

只输出 Markdown，不输出 JSON。严格使用九个二级标题：课程基本信息、课标分析、教材分析、学情分析、教学目标、教学重难点、教学流程、教学评估、板书设计。课程信息用表格，并使用“册次”。义务教育阶段区分 2022 年版课标，高中阶段区分 2017 年版课标；无可核验依据时不引用具体表述。教学目标只写 3—4 项。教学流程设 5—6 个环节，每环按“设计意图＋五列表格＋过渡语”输出，五列为对应目标、核心问题、核心任务、教师活动/教学活动、评估方式，过渡语放在最后。复杂任务的量规以评价维度为首列，小学设三个档位分值列，中学设四个档位分值列，要点直接写在交叉单元格中。

公开课亮点必须来自学生真实学习与可观察证据。未知教材、课标、班情、数据或外部事实不得编造。教具、资源、安全、伦理和版权只在学科与任务确有需要时简洁写入相应环节，不另设章。`;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

for (const skillSlug of ["subject-lesson-design-empty-fallback"]) {
  payloads.push({
    skill_slug: skillSlug,
    source_skill_name: skillSlug,
    version_label: "quality-v2",
    snapshot_hash: sha256(JSON.stringify({ fallbackPrompt, outputContract })),
    instructions: fallbackPrompt,
    input_contract: {
      required: ["stage", "subject", "grade", "volume", "unit", "topic"],
      textbook: "exact_match_or_user_material",
    },
    output_contract: outputContract,
    source_metadata: {
      source_kind: "repository_migration_payload",
      source_skill_hash: sha256(fallbackPrompt),
    },
    references: [],
  });
}

const encodedPayloads = Buffer.from(JSON.stringify(payloads), "utf8").toString("base64");
const migration = `begin;

do $$
declare
  v_payloads jsonb := convert_from(decode('${encodedPayloads}', 'base64'), 'UTF8')::jsonb;
  v_payload jsonb;
  v_skill_id uuid;
  v_version_id uuid;
begin
  for v_payload in select value from jsonb_array_elements(v_payloads)
  loop
    select id into v_skill_id
    from public.hai_work_skills
    where slug = v_payload->>'skill_slug';

    if v_skill_id is null then
      raise exception 'Work Skill 不存在：%', v_payload->>'skill_slug';
    end if;

    if exists (
      select 1 from public.hai_work_skill_versions
      where skill_id = v_skill_id
        and version_label = v_payload->>'version_label'
        and status in ('published', 'archived')
    ) then
      raise exception '同名 Work Skill 版本已冻结：% %', v_payload->>'skill_slug', v_payload->>'version_label';
    end if;

    update public.hai_work_skill_versions
    set status = 'archived', updated_at = now()
    where skill_id = v_skill_id and status = 'published';

    insert into public.hai_work_skill_versions (
      skill_id, version_label, status, prompt_template, default_prompt_template,
      input_contract, output_contract, snapshot_hash, source_metadata, published_at
    ) values (
      v_skill_id,
      v_payload->>'version_label',
      'draft',
      v_payload->>'instructions',
      v_payload->>'instructions',
      v_payload->'input_contract',
      v_payload->'output_contract',
      v_payload->>'snapshot_hash',
      v_payload->'source_metadata',
      null
    )
    on conflict (skill_id, version_label) do update set
      status = 'draft',
      prompt_template = excluded.prompt_template,
      default_prompt_template = excluded.default_prompt_template,
      input_contract = excluded.input_contract,
      output_contract = excluded.output_contract,
      snapshot_hash = excluded.snapshot_hash,
      source_metadata = excluded.source_metadata,
      published_at = null,
      updated_at = now()
    returning id into v_version_id;

    delete from public.hai_work_skill_references where skill_version_id = v_version_id;

    insert into public.hai_work_skill_references (
      skill_version_id, path, name, description, media_type, content,
      content_hash, load_mode, max_chars, sort_order, metadata
    )
    select
      v_version_id, item.path, item.name, item.description, item.media_type,
      item.content, item.content_hash, item.load_mode, item.max_chars,
      item.sort_order, item.metadata
    from jsonb_to_recordset(v_payload->'references') as item(
      path text, name text, description text, media_type text, content text,
      content_hash text, load_mode text, max_chars integer, sort_order integer,
      metadata jsonb
    );

    update public.hai_work_skill_versions
    set status = 'published', published_at = now(), updated_at = now()
    where id = v_version_id;
  end loop;

  perform public.hai_recompute_work_module_enabled('subject-lesson-design');
end;
$$;

commit;
`;

writeFileSync(migrationPath, migration);
console.log(`已写入 ${payloads.length} 个 Skill 版本：${basename(migrationPath)}`);
