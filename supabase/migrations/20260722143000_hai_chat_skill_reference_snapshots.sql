-- Versioned Chat Skill reference snapshots.
-- A published version freezes SKILL.md, reference files and a deterministic
-- manifest/hash so runtime always loads one complete database snapshot.

alter table public.hai_chat_skill_versions
  add column if not exists snapshot_manifest jsonb not null default '[]'::jsonb,
  add column if not exists snapshot_hash text,
  add column if not exists reference_count integer not null default 0
    check (reference_count >= 0);

create table if not exists public.hai_chat_skill_references (
  id uuid primary key default gen_random_uuid(),
  skill_version_id uuid not null
    references public.hai_chat_skill_versions(id) on delete cascade,
  path text not null check (
    path = btrim(path)
    and path ~ '^references/[A-Za-z0-9._/-]+$'
    and path !~ '(^|/)\.\.?(/|$)'
  ),
  name text not null default '',
  description text not null default '',
  media_type text not null default 'text/plain',
  content text not null,
  content_hash text not null,
  load_mode text not null default 'on_demand'
    check (load_mode in ('always', 'on_demand', 'evaluation_only')),
  max_chars integer not null default 12000 check (max_chars between 500 and 100000),
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(skill_version_id, path),
  check (content_hash = md5(content)),
  check (length(content) <= 200000)
);

create index if not exists idx_hai_chat_skill_references_version
  on public.hai_chat_skill_references(skill_version_id, sort_order, path);

drop trigger if exists update_hai_chat_skill_references_updated_at
  on public.hai_chat_skill_references;
create trigger update_hai_chat_skill_references_updated_at
  before update on public.hai_chat_skill_references
  for each row execute function public.update_updated_at_column();

alter table public.hai_chat_skill_references enable row level security;

grant select, insert, update, delete
  on public.hai_chat_skill_references to authenticated;

drop policy if exists "hai chat skill references admin only"
  on public.hai_chat_skill_references;
create policy "hai chat skill references admin only"
  on public.hai_chat_skill_references for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create or replace function public.hai_protect_chat_skill_reference()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_version_id uuid := case when tg_op = 'DELETE'
    then old.skill_version_id else new.skill_version_id end;
  v_status text;
begin
  select status into v_status
  from public.hai_chat_skill_versions
  where id = v_version_id;

  if v_status is distinct from 'draft' then
    raise exception '已发布或已归档版本的 reference 不可修改，请新建草稿版本。';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.hai_replace_chat_skill_references(
  p_version_id uuid,
  p_references jsonb
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_reference jsonb;
  v_path text;
  v_content text;
  v_count integer;
  v_total_chars bigint;
begin
  if jsonb_typeof(coalesce(p_references, '[]'::jsonb)) <> 'array' then
    raise exception 'references 必须是 JSON 数组。';
  end if;

  select count(*), coalesce(sum(length(value->>'content')), 0)
  into v_count, v_total_chars
  from jsonb_array_elements(coalesce(p_references, '[]'::jsonb));

  if v_count > 64 then
    raise exception '单个 Skill 版本最多保存 64 个 reference 文件。';
  end if;
  if v_total_chars > 1000000 then
    raise exception '单个 Skill 版本的 reference 总内容不能超过 100 万字符。';
  end if;

  delete from public.hai_chat_skill_references
  where skill_version_id = p_version_id;

  for v_reference in
    select value from jsonb_array_elements(coalesce(p_references, '[]'::jsonb))
  loop
    v_path := btrim(coalesce(v_reference->>'path', ''));
    v_content := coalesce(v_reference->>'content', '');
    if v_path = '' or v_path !~ '^references/[A-Za-z0-9._/-]+$'
      or v_path ~ '(^|/)\.\.?(/|$)' then
      raise exception 'reference 路径不合法：%', v_path;
    end if;
    if length(v_content) > 200000 then
      raise exception 'reference 文件 % 超过 20 万字符。', v_path;
    end if;

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
    ) values (
      p_version_id,
      v_path,
      coalesce(nullif(btrim(v_reference->>'name'), ''),
        regexp_replace(v_path, '^.*/', '')),
      coalesce(v_reference->>'description', ''),
      coalesce(nullif(btrim(v_reference->>'media_type'), ''), 'text/plain'),
      v_content,
      md5(v_content),
      coalesce(nullif(btrim(v_reference->>'load_mode'), ''), 'on_demand'),
      greatest(500, least(100000,
        coalesce((v_reference->>'max_chars')::integer, 12000))),
      coalesce((v_reference->>'sort_order')::integer, 0),
      case when jsonb_typeof(v_reference->'metadata') = 'object'
        then v_reference->'metadata' else '{}'::jsonb end
    );
  end loop;
end;
$$;

revoke all on function public.hai_replace_chat_skill_references(uuid, jsonb)
  from public, anon, authenticated;

create or replace function public.hai_save_chat_skill_draft_snapshot(
  p_version_id uuid,
  p_version_label text,
  p_instructions text,
  p_reference_config jsonb,
  p_references jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception '仅管理员可以保存 Chat Skill 草稿。';
  end if;

  select status into v_status
  from public.hai_chat_skill_versions
  where id = p_version_id for update;
  if v_status is null then raise exception 'Chat Skill 版本不存在。'; end if;
  if v_status <> 'draft' then
    raise exception '只有草稿版本可以修改。';
  end if;
  if btrim(coalesce(p_version_label, '')) = '' then
    raise exception '版本标签不能为空。';
  end if;
  if btrim(coalesce(p_instructions, '')) = '' then
    raise exception 'SKILL.md 内容不能为空。';
  end if;
  if jsonb_typeof(coalesce(p_reference_config, '{}'::jsonb)) <> 'object' then
    raise exception 'reference_config 必须是 JSON 对象。';
  end if;

  update public.hai_chat_skill_versions
  set version_label = btrim(p_version_label),
      instructions = p_instructions,
      reference_config = coalesce(p_reference_config, '{}'::jsonb),
      snapshot_manifest = '[]'::jsonb,
      snapshot_hash = null,
      reference_count = 0,
      updated_at = now()
  where id = p_version_id;

  perform public.hai_replace_chat_skill_references(p_version_id, p_references);
end;
$$;

grant execute on function public.hai_save_chat_skill_draft_snapshot(
  uuid, text, text, jsonb, jsonb
) to authenticated;

create or replace function public.hai_import_chat_skill_snapshot(
  p_skill_id uuid,
  p_version_label text,
  p_instructions text,
  p_reference_config jsonb,
  p_references jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version_id uuid;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception '仅管理员可以导入 Chat Skill。';
  end if;
  if not exists (select 1 from public.hai_chat_skills where id = p_skill_id) then
    raise exception 'Chat Skill 不存在。';
  end if;
  if btrim(coalesce(p_version_label, '')) = '' then
    raise exception '版本标签不能为空。';
  end if;
  if btrim(coalesce(p_instructions, '')) = '' then
    raise exception 'SKILL.md 内容不能为空。';
  end if;
  if jsonb_typeof(coalesce(p_reference_config, '{}'::jsonb)) <> 'object' then
    raise exception 'reference_config 必须是 JSON 对象。';
  end if;

  insert into public.hai_chat_skill_versions (
    skill_id,
    version_label,
    status,
    instructions,
    default_instructions,
    reference_config
  ) values (
    p_skill_id,
    btrim(p_version_label),
    'draft',
    p_instructions,
    p_instructions,
    coalesce(p_reference_config, '{}'::jsonb)
  ) returning id into v_version_id;

  perform public.hai_replace_chat_skill_references(v_version_id, p_references);
  return v_version_id;
end;
$$;

grant execute on function public.hai_import_chat_skill_snapshot(
  uuid, text, text, jsonb, jsonb
) to authenticated;

-- Extend the existing publish RPC: calculate the frozen file manifest and the
-- full snapshot hash in the same transaction that changes version status.
create or replace function public.hai_publish_chat_skill_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_skill_id uuid;
  v_status text;
  v_instructions text;
  v_reference_config jsonb;
  v_manifest jsonb;
  v_reference_fingerprint text;
  v_reference_count integer;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception '仅管理员可以发布 Chat Skill。';
  end if;

  select skill_id, status, instructions, reference_config
  into v_skill_id, v_status, v_instructions, v_reference_config
  from public.hai_chat_skill_versions
  where id = p_version_id for update;
  if v_skill_id is null then raise exception 'Chat Skill 版本不存在。'; end if;
  if v_status <> 'draft' then raise exception '只有草稿版本可以发布。'; end if;

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
      md5(name || E'\n' || description || E'\n' || metadata::text)
    ), E'\n'
      order by sort_order, path), ''),
    count(*)::integer
  into v_manifest, v_reference_fingerprint, v_reference_count
  from public.hai_chat_skill_references
  where skill_version_id = p_version_id;

  update public.hai_chat_skill_versions
  set status = 'archived', updated_at = now()
  where skill_id = v_skill_id and status = 'published' and id <> p_version_id;

  update public.hai_chat_skill_versions
  set status = 'published',
      published_at = now(),
      snapshot_manifest = v_manifest,
      snapshot_hash = md5(
        v_instructions || E'\n--reference-config--\n' ||
        v_reference_config::text || E'\n--references--\n' ||
        v_reference_fingerprint
      ),
      reference_count = v_reference_count,
      updated_at = now()
  where id = p_version_id;
end;
$$;

grant execute on function public.hai_publish_chat_skill_version(uuid)
  to authenticated;

-- Backfill the currently published hai-consultation reference index. The
-- structured 35-card runtime library remains separate and is still injected
-- by relevance; this backfill makes the existing SKILL.md reference resolvable.
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
  sort_order
)
select
  version.id,
  'references/method-cards.md',
  '35 张课程方法卡索引',
  'hai-consultation 的方法卡精简索引；完整结构化卡片仍由方法库按题加载。',
  'text/markdown',
  $reference$# 35 张课程方法卡索引

> 完整内容见 `HAI_Skill构建资料总集.md` 第 5.3 节。
> 本文件是精简索引，供 skill 第四步按需检索。需要详细内容时去原始文档读对应卡。

完整索引包含 35 张卡：备课设计总方法、教学设计六要素、教学底层三领域、设计逻辑链、教材四维分析、重难点双来源、策略过程板书、目标三步法、目标质量三检、学情三维洞察、学情质量光谱、学情工具箱、逆向设计、问题链、课堂回应闭环、任务五类型、任务脚本五要素、任务动机钩子、核心增长证据、三题前测与错因、新授课七步、讲练三阶段、复习四阶段、试卷讲评四步、作业反馈四问、一课三层、全员学习证据、质量分析五问、低成本替换、概念归纳、概念演绎、互动讲授循环、备课工作流、反思证据闭环、新教师最低标准。
$reference$,
  md5($reference$# 35 张课程方法卡索引

> 完整内容见 `HAI_Skill构建资料总集.md` 第 5.3 节。
> 本文件是精简索引，供 skill 第四步按需检索。需要详细内容时去原始文档读对应卡。

完整索引包含 35 张卡：备课设计总方法、教学设计六要素、教学底层三领域、设计逻辑链、教材四维分析、重难点双来源、策略过程板书、目标三步法、目标质量三检、学情三维洞察、学情质量光谱、学情工具箱、逆向设计、问题链、课堂回应闭环、任务五类型、任务脚本五要素、任务动机钩子、核心增长证据、三题前测与错因、新授课七步、讲练三阶段、复习四阶段、试卷讲评四步、作业反馈四问、一课三层、全员学习证据、质量分析五问、低成本替换、概念归纳、概念演绎、互动讲授循环、备课工作流、反思证据闭环、新教师最低标准。
$reference$),
  'on_demand',
  12000,
  10
from public.hai_chat_skill_versions version
join public.hai_chat_skills skill on skill.id = version.skill_id
where skill.slug = 'hai-consultation'
  and version.version_label = 'v1'
on conflict (skill_version_id, path) do nothing;

-- The backfill happens before immutability is attached because v1 was already
-- published by the previous migration.
drop trigger if exists protect_hai_chat_skill_reference
  on public.hai_chat_skill_references;
create trigger protect_hai_chat_skill_reference
  before insert or update or delete on public.hai_chat_skill_references
  for each row execute function public.hai_protect_chat_skill_reference();

with published_snapshots as (
  select
    version.id,
    version.instructions,
    version.reference_config,
    coalesce(jsonb_agg(jsonb_build_object(
      'path', reference.path,
      'name', reference.name,
      'description', reference.description,
      'media_type', reference.media_type,
      'content_hash', reference.content_hash,
      'content_chars', length(reference.content),
      'load_mode', reference.load_mode,
      'max_chars', reference.max_chars,
      'sort_order', reference.sort_order,
      'metadata', reference.metadata
    ) order by reference.sort_order, reference.path)
      filter (where reference.id is not null), '[]'::jsonb) as manifest,
    coalesce(string_agg(concat_ws(':',
      reference.path,
      reference.content_hash,
      reference.load_mode,
      reference.max_chars::text,
      reference.sort_order::text,
      reference.media_type,
      md5(reference.name || E'\n' || reference.description || E'\n' ||
        reference.metadata::text)
    ), E'\n'
      order by reference.sort_order, reference.path)
      filter (where reference.id is not null), '') as fingerprint,
    count(reference.id)::integer as reference_count
  from public.hai_chat_skill_versions version
  left join public.hai_chat_skill_references reference
    on reference.skill_version_id = version.id
  where version.status in ('published', 'archived')
  group by version.id
)
update public.hai_chat_skill_versions version
set snapshot_manifest = snapshot.manifest,
    snapshot_hash = md5(
      snapshot.instructions || E'\n--reference-config--\n' ||
      snapshot.reference_config::text || E'\n--references--\n' ||
      snapshot.fingerprint
    ),
    reference_count = snapshot.reference_count
from published_snapshots snapshot
where version.id = snapshot.id;

-- Tighten the original version guard now that reference snapshot columns exist.
create or replace function public.hai_protect_published_chat_skill_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status in ('published', 'archived') and (
    new.skill_id is distinct from old.skill_id
    or new.version_label is distinct from old.version_label
    or new.instructions is distinct from old.instructions
    or new.default_instructions is distinct from old.default_instructions
    or new.reference_config is distinct from old.reference_config
    or new.snapshot_manifest is distinct from old.snapshot_manifest
    or new.snapshot_hash is distinct from old.snapshot_hash
    or new.reference_count is distinct from old.reference_count
    or new.published_at is distinct from old.published_at
  ) then
    raise exception '已发布或已归档的 Chat Skill 快照不可修改，请新建草稿版本。';
  end if;
  if old.status = 'archived' and new.status <> 'archived' then
    raise exception '已归档的 Chat Skill 版本不可恢复或改写。';
  end if;
  if old.status = 'published' and new.status not in ('published', 'archived') then
    raise exception '已发布的 Chat Skill 版本只能由发布流程归档。';
  end if;
  return new;
end;
$$;
