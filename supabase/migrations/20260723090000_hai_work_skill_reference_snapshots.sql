begin;

alter table public.hai_work_skill_versions
  add column if not exists snapshot_hash text not null default '',
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

create table if not exists public.hai_work_skill_references (
  id uuid primary key default gen_random_uuid(),
  skill_version_id uuid not null references public.hai_work_skill_versions(id) on delete cascade,
  path text not null,
  name text not null,
  description text not null default '',
  media_type text not null default 'text/markdown',
  content text not null,
  content_hash text not null,
  load_mode text not null default 'always'
    check (load_mode in ('always', 'case', 'issue', 'task', 'evaluation_only')),
  max_chars integer not null default 24000 check (max_chars between 1 and 50000),
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (skill_version_id, path)
);

comment on table public.hai_work_skill_references is
  'Versioned Work Skill source references. Runtime loads common references plus exactly one teaching-mode template.';

create index if not exists idx_hai_work_skill_references_version_order
  on public.hai_work_skill_references(skill_version_id, sort_order, path);

drop trigger if exists update_hai_work_skill_references_updated_at on public.hai_work_skill_references;
create trigger update_hai_work_skill_references_updated_at
  before update on public.hai_work_skill_references
  for each row execute function public.update_updated_at_column();

create or replace function public.hai_protect_work_skill_reference_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.hai_work_skill_versions
  where id = coalesce(new.skill_version_id, old.skill_version_id);

  if v_status in ('published', 'archived') then
    raise exception '已发布或归档的 Work Skill reference 快照不可修改。';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists protect_hai_work_skill_reference_snapshot on public.hai_work_skill_references;
create trigger protect_hai_work_skill_reference_snapshot
  before insert or update or delete on public.hai_work_skill_references
  for each row execute function public.hai_protect_work_skill_reference_snapshot();

create or replace function public.hai_protect_work_skill_version_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status in ('published', 'archived') and (
    new.prompt_template is distinct from old.prompt_template
    or new.input_contract is distinct from old.input_contract
    or new.output_contract is distinct from old.output_contract
    or new.snapshot_hash is distinct from old.snapshot_hash
    or new.source_metadata is distinct from old.source_metadata
  ) then
    raise exception '已发布或归档的 Work Skill 版本快照不可修改。';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_hai_work_skill_version_snapshot on public.hai_work_skill_versions;
create trigger protect_hai_work_skill_version_snapshot
  before update on public.hai_work_skill_versions
  for each row execute function public.hai_protect_work_skill_version_snapshot();

alter table public.hai_work_skill_references enable row level security;

grant select, insert, update, delete on public.hai_work_skill_references to authenticated;
grant all on public.hai_work_skill_references to service_role;

drop policy if exists "hai work skill references admin only" on public.hai_work_skill_references;
create policy "hai work skill references admin only"
  on public.hai_work_skill_references for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create or replace function public.hai_import_work_skill_snapshot(
  p_skill_slug text,
  p_version_label text,
  p_instructions text,
  p_input_contract jsonb,
  p_output_contract jsonb,
  p_snapshot_hash text,
  p_source_metadata jsonb,
  p_references jsonb,
  p_publish boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_skill_id uuid;
  v_module_slug text;
  v_version_id uuid;
  v_existing_status text;
begin
  if current_user <> 'postgres'
    and coalesce(auth.role(), '') <> 'service_role'
    and not coalesce(public.is_admin(), false) then
    raise exception '仅管理员或服务端可以导入 Work Skill 快照。';
  end if;
  if nullif(trim(p_instructions), '') is null then
    raise exception 'SKILL.md 内容不能为空。';
  end if;
  if jsonb_array_length(coalesce(p_references, '[]'::jsonb)) < 1 then
    raise exception 'Work Skill 快照必须包含 references。';
  end if;

  select id, module_slug into v_skill_id, v_module_slug
  from public.hai_work_skills
  where slug = trim(p_skill_slug);
  if v_skill_id is null then raise exception 'Work Skill 不存在：%', p_skill_slug; end if;

  select id, status into v_version_id, v_existing_status
  from public.hai_work_skill_versions
  where skill_id = v_skill_id and version_label = trim(p_version_label);
  if v_existing_status in ('published', 'archived') then
    raise exception '同名 Work Skill 版本已冻结，请使用新的版本标签。';
  end if;

  if v_version_id is null then
    insert into public.hai_work_skill_versions (
      skill_id, version_label, status, prompt_template,
      default_prompt_template, input_contract, output_contract,
      snapshot_hash, source_metadata
    ) values (
      v_skill_id, trim(p_version_label), 'draft', p_instructions,
      p_instructions, coalesce(p_input_contract, '{}'::jsonb),
      coalesce(p_output_contract, '{}'::jsonb), trim(p_snapshot_hash),
      coalesce(p_source_metadata, '{}'::jsonb)
    ) returning id into v_version_id;
  else
    update public.hai_work_skill_versions
    set prompt_template = p_instructions,
        default_prompt_template = p_instructions,
        input_contract = coalesce(p_input_contract, '{}'::jsonb),
        output_contract = coalesce(p_output_contract, '{}'::jsonb),
        snapshot_hash = trim(p_snapshot_hash),
        source_metadata = coalesce(p_source_metadata, '{}'::jsonb),
        updated_at = now()
    where id = v_version_id;
    delete from public.hai_work_skill_references where skill_version_id = v_version_id;
  end if;

  insert into public.hai_work_skill_references (
    skill_version_id, path, name, description, media_type, content,
    content_hash, load_mode, max_chars, sort_order, metadata
  )
  select
    v_version_id, item.path, item.name, item.description,
    item.media_type, item.content, item.content_hash, item.load_mode,
    item.max_chars, item.sort_order, item.metadata
  from jsonb_to_recordset(p_references) as item(
    path text, name text, description text, media_type text,
    content text, content_hash text, load_mode text,
    max_chars integer, sort_order integer, metadata jsonb
  );

  if p_publish then
    update public.hai_work_skill_versions
    set status = 'archived', updated_at = now()
    where skill_id = v_skill_id and status = 'published' and id <> v_version_id;

    update public.hai_work_skill_versions
    set status = 'published', published_at = now(), updated_at = now()
    where id = v_version_id;

    update public.hai_work_skills
    set is_enabled = true,
        description = '完整思政公开课设计 Skill：按案例式、议题式或任务式唯一主导模式生成 40 分钟教学设计。',
        match_criteria = '{"subjects":["道德与法治","思想政治","思政"],"lesson_types":["公开课"],"teaching_modes":["案例式","议题式","任务式"]}'::jsonb,
        updated_at = now()
    where id = v_skill_id;

    perform public.hai_recompute_work_module_enabled(v_module_slug);
  end if;

  return v_version_id;
end;
$$;

revoke all on function public.hai_import_work_skill_snapshot(
  text, text, text, jsonb, jsonb, text, jsonb, jsonb, boolean
) from public, anon, authenticated;
grant execute on function public.hai_import_work_skill_snapshot(
  text, text, text, jsonb, jsonb, text, jsonb, jsonb, boolean
) to service_role;

update public.hai_feature_modules
set input_schema = input_schema ||
  '[{"name":"teaching_mode","label":"教学模式","type":"select","required":true,"options":["案例式","任务式","议题式"]}]'::jsonb,
  updated_at = now()
where slug = 'subject-lesson-design'
  and not input_schema @> '[{"name":"teaching_mode"}]'::jsonb;

commit;
