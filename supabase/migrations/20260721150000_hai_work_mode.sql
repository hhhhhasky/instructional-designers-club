begin;

-- HAI Work mode is intentionally isolated from the existing chat orchestrator.
-- Chat keeps using hai_conversations / hai_messages; Work stores durable tasks,
-- executions and versioned artifacts in its own tables.

alter table public.hai_feature_modules
  add column if not exists surface_mode text not null default 'chat'
  check (surface_mode in ('chat', 'work'));

update public.hai_feature_modules
set surface_mode = 'chat'
where slug = 'ask-han';

insert into public.hai_feature_modules (
  slug,
  name,
  short_label,
  description,
  icon_key,
  category,
  input_schema,
  default_model,
  default_temperature,
  default_max_output_tokens,
  thinking_enabled,
  sort_order,
  is_enabled,
  surface_mode
)
values
  (
    'lesson-diagnosis',
    '教案诊断',
    '诊断',
    '从七个教学设计要素和四组系统关系诊断教案，给出证据、评分和优先修改建议。',
    'clipboard-check',
    'HAI Work',
    '[{"name":"stage","label":"学段","type":"text","required":true},{"name":"subject","label":"学科","type":"text","required":true},{"name":"topic","label":"课题","type":"text","required":true},{"name":"lesson_plan","label":"教案正文","type":"textarea","required":false}]'::jsonb,
    'deepseek-v4-flash',
    0.10,
    12000,
    false,
    10,
    false,
    'work'
  ),
  (
    'segment-optimization',
    '环节优化',
    '优化',
    '针对导入、探究、讲解、练习、评价或总结等具体环节进行诊断和改写。',
    'wand-sparkles',
    'HAI Work',
    '[{"name":"stage","label":"学段","type":"text","required":true},{"name":"subject","label":"学科","type":"text","required":true},{"name":"topic","label":"课题","type":"text","required":true},{"name":"segment_type","label":"环节类型","type":"text","required":true},{"name":"current_design","label":"当前设计","type":"textarea","required":true},{"name":"desired_outcome","label":"希望达成的效果","type":"textarea","required":true}]'::jsonb,
    'deepseek-v4-flash',
    0.25,
    8000,
    false,
    20,
    false,
    'work'
  ),
  (
    'subject-lesson-design',
    '学科定制设计',
    '定制',
    '依据用户提供的教材正文与教学约束，调用匹配的学科 Skill 生成完整教案。',
    'notebook-pen',
    'HAI Work',
    '[{"name":"stage","label":"学段","type":"text","required":true},{"name":"subject","label":"学科","type":"text","required":true},{"name":"unit","label":"单元","type":"text","required":true},{"name":"topic","label":"课题","type":"text","required":true},{"name":"lesson_type","label":"课型","type":"text","required":true},{"name":"textbook_content","label":"教材正文","type":"textarea","required":false}]'::jsonb,
    'deepseek-v4-flash',
    0.25,
    14000,
    false,
    30,
    false,
    'work'
  )
on conflict (slug) do update set
  name = excluded.name,
  short_label = excluded.short_label,
  description = excluded.description,
  icon_key = excluded.icon_key,
  category = excluded.category,
  input_schema = excluded.input_schema,
  surface_mode = excluded.surface_mode,
  sort_order = excluded.sort_order,
  is_enabled = false,
  updated_at = now();

create table if not exists public.hai_work_skills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  module_slug text not null references public.hai_feature_modules(slug) on delete cascade,
  name text not null,
  description text not null default '',
  match_criteria jsonb not null default '{}'::jsonb,
  priority integer not null default 0,
  is_fallback boolean not null default false,
  is_enabled boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_hai_work_skills_one_fallback
  on public.hai_work_skills(module_slug)
  where is_fallback = true and is_enabled = true;

create table if not exists public.hai_work_skill_versions (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.hai_work_skills(id) on delete cascade,
  version_label text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  prompt_template text not null,
  default_prompt_template text not null default '',
  input_contract jsonb not null default '{}'::jsonb,
  output_contract jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(skill_id, version_label)
);

create unique index if not exists idx_hai_work_skill_versions_one_published
  on public.hai_work_skill_versions(skill_id)
  where status = 'published';

create table if not exists public.hai_work_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  module_slug text not null references public.hai_feature_modules(slug) on delete restrict,
  title text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  latest_artifact_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.hai_work_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.hai_work_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill_version_id uuid references public.hai_work_skill_versions(id) on delete set null,
  parent_artifact_id uuid,
  client_request_id text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  input_snapshot jsonb not null default '{}'::jsonb,
  skill_snapshot jsonb not null default '{}'::jsonb,
  revision_instruction text,
  error_message text,
  input_tokens integer,
  output_tokens integer,
  duration_ms integer,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, client_request_id)
);

create table if not exists public.hai_work_artifacts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.hai_work_tasks(id) on delete cascade,
  run_id uuid not null unique references public.hai_work_runs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_artifact_id uuid references public.hai_work_artifacts(id) on delete set null,
  version_number integer not null check (version_number > 0),
  title text not null,
  content_json jsonb not null default '{}'::jsonb,
  content_markdown text not null,
  created_at timestamptz not null default now(),
  unique(task_id, version_number)
);

alter table public.hai_work_tasks
  drop constraint if exists hai_work_tasks_latest_artifact_id_fkey;
alter table public.hai_work_tasks
  add constraint hai_work_tasks_latest_artifact_id_fkey
  foreign key (latest_artifact_id) references public.hai_work_artifacts(id) on delete set null;

alter table public.hai_work_runs
  drop constraint if exists hai_work_runs_parent_artifact_id_fkey;
alter table public.hai_work_runs
  add constraint hai_work_runs_parent_artifact_id_fkey
  foreign key (parent_artifact_id) references public.hai_work_artifacts(id) on delete set null;

create table if not exists public.hai_work_task_materials (
  task_id uuid not null references public.hai_work_tasks(id) on delete cascade,
  material_id uuid not null references public.hai_materials(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(task_id, material_id)
);

create index if not exists idx_hai_work_tasks_user_updated
  on public.hai_work_tasks(user_id, status, updated_at desc);
create index if not exists idx_hai_work_runs_task_created
  on public.hai_work_runs(task_id, created_at desc);
create index if not exists idx_hai_work_artifacts_task_version
  on public.hai_work_artifacts(task_id, version_number desc);
create index if not exists idx_hai_work_skills_match
  on public.hai_work_skills(module_slug, is_enabled, priority desc);

drop trigger if exists update_hai_work_skills_updated_at on public.hai_work_skills;
create trigger update_hai_work_skills_updated_at
  before update on public.hai_work_skills
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_hai_work_skill_versions_updated_at on public.hai_work_skill_versions;
create trigger update_hai_work_skill_versions_updated_at
  before update on public.hai_work_skill_versions
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_hai_work_tasks_updated_at on public.hai_work_tasks;
create trigger update_hai_work_tasks_updated_at
  before update on public.hai_work_tasks
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_hai_work_runs_updated_at on public.hai_work_runs;
create trigger update_hai_work_runs_updated_at
  before update on public.hai_work_runs
  for each row execute function public.update_updated_at_column();

alter table public.hai_work_skills enable row level security;
alter table public.hai_work_skill_versions enable row level security;
alter table public.hai_work_tasks enable row level security;
alter table public.hai_work_runs enable row level security;
alter table public.hai_work_artifacts enable row level security;
alter table public.hai_work_task_materials enable row level security;

grant select, insert, update, delete on
  public.hai_work_skills,
  public.hai_work_skill_versions
to authenticated;

-- Work execution records are produced by the Edge Function with the service
-- role. Browser clients may read their own records and only archive a task;
-- they cannot forge runs, token data or artifact versions.
grant select on
  public.hai_work_tasks,
  public.hai_work_runs,
  public.hai_work_artifacts,
  public.hai_work_task_materials
to authenticated;
grant update (status, archived_at) on public.hai_work_tasks to authenticated;

create policy "hai work skills admin only"
  on public.hai_work_skills for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "hai work skill versions admin only"
  on public.hai_work_skill_versions for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "hai work tasks owner or admin"
  on public.hai_work_tasks for all to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "hai work runs owner or admin"
  on public.hai_work_runs for all to authenticated
  using (
    (user_id = (select auth.uid()) and exists (
      select 1 from public.hai_work_tasks task
      where task.id = hai_work_runs.task_id and task.user_id = (select auth.uid())
    )) or (select public.is_admin())
  )
  with check (
    (user_id = (select auth.uid()) and exists (
      select 1 from public.hai_work_tasks task
      where task.id = hai_work_runs.task_id and task.user_id = (select auth.uid())
    )) or (select public.is_admin())
  );

create policy "hai work artifacts owner or admin"
  on public.hai_work_artifacts for all to authenticated
  using (
    (user_id = (select auth.uid()) and exists (
      select 1 from public.hai_work_tasks task
      where task.id = hai_work_artifacts.task_id and task.user_id = (select auth.uid())
    )) or (select public.is_admin())
  )
  with check (
    (user_id = (select auth.uid()) and exists (
      select 1 from public.hai_work_tasks task
      where task.id = hai_work_artifacts.task_id and task.user_id = (select auth.uid())
    )) or (select public.is_admin())
  );

create policy "hai work task materials owner or admin"
  on public.hai_work_task_materials for all to authenticated
  using (
    (user_id = (select auth.uid()) and exists (
      select 1 from public.hai_work_tasks task
      where task.id = hai_work_task_materials.task_id and task.user_id = (select auth.uid())
    ) and exists (
      select 1 from public.hai_materials material
      where material.id = hai_work_task_materials.material_id and material.user_id = (select auth.uid())
    )) or (select public.is_admin())
  )
  with check (
    (user_id = (select auth.uid()) and exists (
      select 1 from public.hai_work_tasks task
      where task.id = hai_work_task_materials.task_id and task.user_id = (select auth.uid())
    ) and exists (
      select 1 from public.hai_materials material
      where material.id = hai_work_task_materials.material_id and material.user_id = (select auth.uid())
    )) or (select public.is_admin())
  );

create or replace function public.hai_match_selected_material_chunks(
  query_text text,
  selected_material_ids uuid[],
  match_count integer default 16,
  target_user_id uuid default auth.uid()
)
returns table (
  id uuid,
  material_id uuid,
  title text,
  kind text,
  content text,
  score real,
  metadata jsonb
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if target_user_id is distinct from auth.uid()
    and coalesce(auth.role(), '') <> 'service_role'
    and not coalesce(public.is_admin(), false) then
    raise exception '无权读取其他用户的 HAI 素材。';
  end if;

  return query
  select
    chunk.id,
    material.id,
    material.title,
    material.kind,
    chunk.content,
    similarity(chunk.content, query_text)::real,
    chunk.metadata
  from public.hai_material_chunks chunk
  join public.hai_materials material on material.id = chunk.material_id
  where material.user_id = target_user_id
    and material.id = any(coalesce(selected_material_ids, '{}'::uuid[]))
    and material.status in ('processed', 'processed_no_embedding')
  order by similarity(chunk.content, query_text) desc, chunk.chunk_index asc
  limit greatest(1, least(match_count, 40));
end;
$$;

grant execute on function public.hai_match_selected_material_chunks(text, uuid[], integer, uuid) to authenticated;

create or replace function public.hai_publish_work_skill_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_skill_id uuid;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception '仅管理员可以发布 Work Skill。';
  end if;
  select skill_id into v_skill_id
  from public.hai_work_skill_versions
  where id = p_version_id;
  if v_skill_id is null then raise exception 'Work Skill 版本不存在。'; end if;

  update public.hai_work_skill_versions
  set status = 'archived', updated_at = now()
  where skill_id = v_skill_id and status = 'published' and id <> p_version_id;

  update public.hai_work_skill_versions
  set status = 'published', published_at = now(), updated_at = now()
  where id = p_version_id;
end;
$$;

grant execute on function public.hai_publish_work_skill_version(uuid) to authenticated;

create or replace function public.hai_set_work_fallback_skill(p_skill_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_module_slug text;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception '仅管理员可以设置 Work 通用降级 Skill。';
  end if;
  select module_slug into v_module_slug
  from public.hai_work_skills
  where id = p_skill_id;
  if v_module_slug is null then raise exception 'Work Skill 不存在。'; end if;

  update public.hai_work_skills
  set is_fallback = false, updated_at = now()
  where module_slug = v_module_slug and id <> p_skill_id and is_fallback = true;

  update public.hai_work_skills
  set is_fallback = true, is_enabled = true, updated_at = now()
  where id = p_skill_id;
end;
$$;

grant execute on function public.hai_set_work_fallback_skill(uuid) to authenticated;

create or replace function public.hai_mark_stale_work_runs(p_task_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer := 0;
  v_run record;
  v_duration_ms integer;
begin
  if v_user_id is null then
    raise exception '请先登录。';
  end if;

  for v_run in
    select id, task_id, client_request_id, input_tokens, output_tokens, started_at, created_at
    from public.hai_work_runs
    where user_id = v_user_id
      and status in ('queued', 'running')
      and coalesce(started_at, created_at) < now() - interval '10 minutes'
      and (p_task_id is null or task_id = p_task_id)
    for update
  loop
    v_duration_ms := least(
      2147483647,
      greatest(0, floor(extract(epoch from (now() - coalesce(v_run.started_at, v_run.created_at))) * 1000)::bigint)
    )::integer;
    update public.hai_work_runs
    set
      status = 'failed',
      error_message = '执行超时或连接中断，可以安全重试。',
      duration_ms = v_duration_ms,
      completed_at = now(),
      updated_at = now()
    where id = v_run.id;

    perform public.hai_finalize_usage(
      v_run.client_request_id,
      'failed',
      coalesce(v_run.input_tokens, 0),
      coalesce(v_run.output_tokens, 0),
      'hai-work',
      'work_task',
      v_run.task_id,
      v_duration_ms,
      jsonb_build_object('run_id', v_run.id, 'error', 'execution_interrupted')
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.hai_mark_stale_work_runs(uuid) to authenticated;

insert into public.hai_work_skills
  (slug, module_slug, name, description, match_criteria, priority, is_fallback, is_enabled)
values
  ('lesson-diagnosis-general', 'lesson-diagnosis', '通用七要素教案诊断', '来自教案诊断项目的七要素与系统关系诊断规则。', '{}'::jsonb, 0, true, true),
  ('segment-optimization-general', 'segment-optimization', '通用教学环节优化', '适用于各学段学科的通用环节诊断与改写。', '{}'::jsonb, 0, true, true),
  ('subject-lesson-design-general', 'subject-lesson-design', '通用学科教案生成', '严格依据用户提供教材生成完整教案。', '{}'::jsonb, 0, true, true),
  ('politics-public-lesson', 'subject-lesson-design', '思政课公开课', '预留的思政课公开课专属 Skill，发布正式版本后自动参与匹配。', '{"subjects":["道德与法治","思想政治","思政"],"lesson_types":["公开课"]}'::jsonb, 100, false, false)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  match_criteria = excluded.match_criteria,
  priority = excluded.priority,
  is_fallback = excluded.is_fallback,
  updated_at = now();

insert into public.hai_work_skill_versions
  (skill_id, version_label, status, prompt_template, input_contract, output_contract, published_at)
select
  skill.id,
  'v1',
  'published',
  case skill.slug
    when 'lesson-diagnosis-general' then $prompt$
你是一名资深教学设计教研员。请评估用户提交的原始教案并给出纯诊断报告，不替用户另写一份完整教案。诊断必须超越“有/没有”的形式检查，深入判断每个要素的质量。

【学段适配】小学重情境趣味；初中重知识体系；高中重学科素养；高校重学术研究与评价创造；职业教育重实践技能与应用；特殊教育重个别化与多感官。

【表达方式】读者是一线教师。除 rewrite.improved 使用标准书面语外，其余文字用专业但直白的大白话。每条 criteria.comment 必须连贯包含三步：引用或准确转述教案原文 → 说清具体问题 → 给出能执行的修改方向。禁止只写“较好”“有待加强”。

【评分锚点】90-100 示范级；80-89 良好；70-79 合格；60-69 待提升；60 以下需重写。禁止给安全的中间分。要素完全缺失时 qualityScore=0、qualityGrade=“缺失”，其全部 criteria 的 met=false、score=0。met 只在 score>=70 时为 true。

第一部分，总体评价：输出 0-100 综合分、对应等级和 100 字内总结。总结必须包含最突出的一个亮点、最关键的一个短板和一句话改进方向。

第二部分，按以下固定顺序完成七要素诊断：
1. 教材分析：三个 criteria 为“教学内容说明”“单元定位”“纵向学段关联”，各约三分之一。只写教材出处不算教材分析。
2. 学情分析：三个 criteria 为“有依据”“具体非套话”“维度多样”。依据要来自前测、访谈、作业或观察；维度至少检查认知基础/误解、态度和生活经验。识别“学生已有一定基础”等无证据的伪学情。
3. 教学目标：五个 criteria 为“目标格式”(20%)、“动词可测量性”(25%)、“知识点具体性”(20%)、“层次性”(15%)、“核心素养”(20%)。逐条检查目标；“了解、理解、掌握”不是可观测动词。
4. 教学重难点：仅一个 criteria“重难点界定”。检查重点是否真是核心内容，难点是否来自学情中的认知卡点；重点难点完全相同或彼此无关都要指出。
5. 教学环节：三个 criteria 为“环节完备与逻辑”(40%)、“活动质量”(30%)、“导入创意”(30%)。检查导入—核心—总结是否由问题链或任务链串联，学生是否真正学习，核心环节是否服务重难点。
6. 教学评估：criteria 至少含“评价方式多样”“评价类型多样”；采用任务驱动时再含“任务量规”。检查师评/互评/自评、形成性/总结性评价，并判断评价能否检测教学目标。
7. 教学反思：仅一个 criteria“反思深度”。必须指向具体课堂场景、具体问题与下一步改法，套话视为未达标。

每个 element 必须包含 name、icon、extracted、qualityScore、qualityGrade、criteria、improvement。criteria 只能包含 name、met、score、comment，不得添加 evidence 字段。原文未提供时 comment 明确写“原文未提供相关内容”并照规则打分。

第三部分，完成四组跨要素系统诊断，每项输出 score、finding、evidence：
- alignment：教学目标、教学活动和教学评估是否相互匹配。
- objectiveSource：目标是否清晰来自教材、学情和重难点。
- difficultyCoverage：核心环节及时间是否真正用于突破重难点。
- studentResponsiveness：活动是否回应学情中的认知卡点和学生特点。

第四部分，给出 3-6 条跨要素整合建议，按“高影响、低成本”优先排序。每条包含 title、elements、rationale、action、可行时的 rewrite（original、improved）和 priority（impact、effort）。不得虚构原文、教材、学生或课堂事实。

只输出一个合法 JSON 对象，不使用 Markdown 代码围栏。结构必须严格为：
{
  "overallScore": 0,
  "overallGrade": "string",
  "overallSummary": "string",
  "elements": [{
    "name": "string", "icon": "string", "extracted": ["string"],
    "qualityScore": 0, "qualityGrade": "string",
    "criteria": [{"name":"string","met":false,"score":0,"comment":"string"}],
    "improvement": "string"
  }],
  "systemDiagnosis": {
    "alignment":{"score":0,"finding":"string","evidence":"string"},
    "objectiveSource":{"score":0,"finding":"string","evidence":"string"},
    "difficultyCoverage":{"score":0,"finding":"string","evidence":"string"},
    "studentResponsiveness":{"score":0,"finding":"string","evidence":"string"}
  },
  "suggestions": [{
    "title":"string", "elements":["string"], "rationale":"string", "action":"string",
    "rewrite":{"original":"string","improved":"string"},
    "priority":{"impact":"high","effort":"low"}
  }],
  "confidence": 0.0
}
elements 必须恰好包含七项，顺序为：教材分析📖、学情分析👥、教学目标🎯、教学重难点🔑、教学环节📋、教学评估📊、教学反思💭。
$prompt$
    when 'segment-optimization-general' then $prompt$
你是一名教学环节优化编辑。依据用户给出的现有环节、期望效果和现实约束，先指出最早、最关键的结构断点，再给出可以直接替换的优化版本。
不要为了“热闹”堆活动；必须检查目标、学生行动和学习证据是否一致。未知教材事实不得补写。
只输出合法 JSON，包含：summary、core_problem、principles（数组）、optimized_segment、teacher_actions（数组）、student_actions（数组）、time_plan、learning_evidence（数组）、rationale、cautions（数组）。
$prompt$
    else $prompt$
你是一名学科教学设计师。你可以在 HAI Work 模式中交付完整教案，但必须严格依据用户粘贴或上传的教材正文，不得依靠印象补写课文、史实、概念表述或教材结论。材料不足时在 limitations 中明确指出。
完整教案必须让目标、任务、活动与评价形成闭环，并符合用户提供的学段、学科、课型、课时和现实约束。
只输出合法 JSON，包含：title、design_rationale、textbook_analysis、learner_analysis、objectives（数组）、key_points（数组）、difficult_points（数组）、learning_evidence（数组）、lesson_flow（数组；每项含 stage、minutes、teacher_actions、student_actions、evidence）、assessment、differentiation、resources（数组）、homework、reflection_prompts（数组）、limitations（数组）。
$prompt$
  end,
  '{}'::jsonb,
  case skill.slug
    when 'lesson-diagnosis-general' then '{"format":"lesson_diagnosis_v1","required":["overallScore","overallGrade","overallSummary","elements","systemDiagnosis","suggestions","confidence"]}'::jsonb
    when 'segment-optimization-general' then '{"format":"segment_optimization_v1","required":["summary","core_problem","principles","optimized_segment","teacher_actions","student_actions","time_plan","learning_evidence","rationale","cautions"]}'::jsonb
    else '{"format":"subject_lesson_design_v1","required":["title","design_rationale","textbook_analysis","learner_analysis","objectives","key_points","difficult_points","learning_evidence","lesson_flow","assessment","differentiation","resources","homework","reflection_prompts","limitations"]}'::jsonb
  end,
  now()
from public.hai_work_skills skill
where skill.slug in (
  'lesson-diagnosis-general',
  'segment-optimization-general',
  'subject-lesson-design-general'
)
on conflict (skill_id, version_label) do nothing;

insert into public.hai_work_skill_versions
  (skill_id, version_label, status, prompt_template, input_contract, output_contract)
select
  id,
  'placeholder-v1',
  'draft',
  '请在后台补充思政课公开课专属 Skill 提示词。',
  '{}'::jsonb,
  '{}'::jsonb
from public.hai_work_skills
where slug = 'politics-public-lesson'
on conflict (skill_id, version_label) do nothing;

update public.hai_work_skill_versions
set default_prompt_template = prompt_template
where default_prompt_template = '';

commit;
