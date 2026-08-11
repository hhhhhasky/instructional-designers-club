begin;

-- The reviewed textbook payload is kept in seed-data/hai-sizheng-textbooks.json.
-- It is imported through the existing service-role textbook import RPC.
-- This migration only expands the runtime contract and does not embed large
-- source documents in migration SQL.

alter table public.hai_textbook_collections
  drop constraint if exists hai_textbook_collections_volume_check;
alter table public.hai_textbook_collections
  add constraint hai_textbook_collections_volume_check
  check (length(trim(volume)) > 0);

create table if not exists public.hai_politics_case_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  stage_scope text[] not null default array['小学', '初中', '高中'],
  subject_scope text[] not null default array['道德与法治', '思想政治'],
  source_file_name text not null default '',
  source_hash text not null,
  source_note text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hai_politics_cases (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.hai_politics_case_sources(id) on delete cascade,
  case_key text not null unique,
  title text not null,
  topic_direction text not null default '',
  event_date text not null default '',
  summary text not null,
  classroom_question text not null,
  concepts text[] not null default '{}',
  source_urls text[] not null default '{}',
  content_markdown text not null,
  content_text text not null,
  stage_scope text[] not null default array['小学', '初中', '高中'],
  char_count integer not null default 0 check (char_count >= 0),
  sort_order integer not null default 0,
  content_hash text not null,
  verification_status text not null default 'source_declared_requires_fact_check',
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.hai_politics_case_sources is
  'Reviewed source files for the politics public-lesson case bank; source facts still require teacher verification before classroom use.';
comment on table public.hai_politics_cases is
  'Independently retrievable politics lesson case candidates, separated from Skill instructions and selected at runtime.';

create index if not exists idx_hai_politics_case_sources_route
  on public.hai_politics_case_sources using gin(stage_scope);
create index if not exists idx_hai_politics_cases_route
  on public.hai_politics_cases using gin(stage_scope);
create index if not exists idx_hai_politics_cases_concepts
  on public.hai_politics_cases using gin(concepts);
create index if not exists idx_hai_politics_cases_search
  on public.hai_politics_cases using gin(
    (title || ' ' || topic_direction || ' ' || content_text) extensions.gin_trgm_ops
  );

drop trigger if exists update_hai_politics_case_sources_updated_at on public.hai_politics_case_sources;
create trigger update_hai_politics_case_sources_updated_at
  before update on public.hai_politics_case_sources
  for each row execute function public.update_updated_at_column();
drop trigger if exists update_hai_politics_cases_updated_at on public.hai_politics_cases;
create trigger update_hai_politics_cases_updated_at
  before update on public.hai_politics_cases
  for each row execute function public.update_updated_at_column();

alter table public.hai_politics_case_sources enable row level security;
alter table public.hai_politics_cases enable row level security;

grant select, insert, update, delete on public.hai_politics_case_sources to authenticated;
grant select, insert, update, delete on public.hai_politics_cases to authenticated;
grant all on public.hai_politics_case_sources, public.hai_politics_cases to service_role;

drop policy if exists "hai_politics_case_sources admin manage" on public.hai_politics_case_sources;
create policy "hai_politics_case_sources admin manage"
  on public.hai_politics_case_sources for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
drop policy if exists "hai_politics_cases admin manage" on public.hai_politics_cases;
create policy "hai_politics_cases admin manage"
  on public.hai_politics_cases for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create or replace function public.hai_import_politics_case_payload(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_source_count integer := jsonb_array_length(coalesce(p_payload->'sources', '[]'::jsonb));
  v_case_count integer := jsonb_array_length(coalesce(p_payload->'cases', '[]'::jsonb));
begin
  if v_source_count < 1 or v_case_count < 1 then
    raise exception 'Politics case import payload must contain sources and cases';
  end if;

  insert into public.hai_politics_case_sources (
    slug, title, stage_scope, subject_scope, source_file_name,
    source_hash, source_note, metadata, is_active
  )
  select
    item.slug, item.title, item.stage_scope, item.subject_scope,
    item.source_file_name, item.source_hash, item.source_note,
    item.metadata, true
  from jsonb_to_recordset(p_payload->'sources') as item(
    slug text, title text, stage_scope text[], subject_scope text[],
    source_file_name text, source_hash text, source_note text, metadata jsonb
  )
  on conflict (slug) do update set
    title = excluded.title,
    stage_scope = excluded.stage_scope,
    subject_scope = excluded.subject_scope,
    source_file_name = excluded.source_file_name,
    source_hash = excluded.source_hash,
    source_note = excluded.source_note,
    metadata = excluded.metadata,
    is_active = true,
    updated_at = now();

  insert into public.hai_politics_cases (
    source_id, case_key, title, topic_direction, event_date, summary,
    classroom_question, concepts, source_urls, content_markdown, content_text,
    stage_scope, char_count, sort_order, content_hash, verification_status,
    metadata, is_active
  )
  select
    source.id, item.case_key, item.title, item.topic_direction,
    item.event_date, item.summary, item.classroom_question, item.concepts,
    item.source_urls, item.content_markdown, item.content_text, item.stage_scope,
    item.char_count, item.sort_order, item.content_hash,
    item.verification_status, item.metadata, true
  from jsonb_to_recordset(p_payload->'cases') as item(
    case_key text, source_slug text, title text, topic_direction text,
    event_date text, summary text, classroom_question text, concepts text[],
    source_urls text[], content_markdown text, content_text text,
    stage_scope text[], char_count integer, sort_order integer,
    content_hash text, verification_status text, metadata jsonb
  )
  join public.hai_politics_case_sources source on source.slug = item.source_slug
  on conflict (case_key) do update set
    source_id = excluded.source_id,
    title = excluded.title,
    topic_direction = excluded.topic_direction,
    event_date = excluded.event_date,
    summary = excluded.summary,
    classroom_question = excluded.classroom_question,
    concepts = excluded.concepts,
    source_urls = excluded.source_urls,
    content_markdown = excluded.content_markdown,
    content_text = excluded.content_text,
    stage_scope = excluded.stage_scope,
    char_count = excluded.char_count,
    sort_order = excluded.sort_order,
    content_hash = excluded.content_hash,
    verification_status = excluded.verification_status,
    metadata = excluded.metadata,
    is_active = true,
    updated_at = now();

  update public.hai_politics_cases case_row
  set is_active = false, updated_at = now()
  where case_row.source_id in (
    select source.id
    from public.hai_politics_case_sources source
    where source.slug in (
      select payload_source->>'slug' from jsonb_array_elements(p_payload->'sources') payload_source
    )
  )
  and case_row.case_key not in (
    select payload_case->>'case_key' from jsonb_array_elements(p_payload->'cases') payload_case
  );

  return jsonb_build_object('sources', v_source_count, 'cases', v_case_count);
end;
$$;

create or replace function public.hai_match_politics_cases(
  p_stage text,
  p_subject text,
  p_grade_level integer default null,
  p_unit_query text default null,
  p_lesson_query text default null,
  p_frame_query text default null,
  p_teaching_mode text default null,
  p_match_count integer default 6
)
returns table (
  case_id uuid,
  source_slug text,
  source_file_name text,
  title text,
  topic_direction text,
  event_date text,
  summary text,
  classroom_question text,
  concepts text[],
  source_urls text[],
  content_markdown text,
  content_hash text,
  verification_status text,
  score real
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with query_terms as (
    select nullif(trim(concat_ws(' ', p_unit_query, p_lesson_query, p_frame_query)), '') as value
  )
  select
    item.id,
    source.slug,
    source.source_file_name,
    item.title,
    item.topic_direction,
    item.event_date,
    item.summary,
    item.classroom_question,
    item.concepts,
    item.source_urls,
    item.content_markdown,
    item.content_hash,
    item.verification_status,
    (
      case when trim(coalesce(p_stage, '')) = any(source.stage_scope) then 5 else 0 end +
      case when trim(coalesce(p_subject, '')) = any(source.subject_scope) then 2 else 0 end +
      case when nullif(trim(p_teaching_mode), '') = '案例式' then 2 else 0 end +
      case when query_terms.value is not null and item.topic_direction ilike '%' || query_terms.value || '%' then 8 else 0 end +
      case when query_terms.value is not null then greatest(
        similarity(item.topic_direction || ' ' || item.title || ' ' || item.summary || ' ' || item.classroom_question || ' ' || array_to_string(item.concepts, ' '), query_terms.value) * 8,
        similarity(item.title || ' ' || array_to_string(item.concepts, ' '), coalesce(p_frame_query, '')) * 5
      ) else 0 end
    )::real as score
  from public.hai_politics_cases item
  join public.hai_politics_case_sources source on source.id = item.source_id
  cross join query_terms
  where item.is_active = true
    and source.is_active = true
    and trim(coalesce(p_stage, '')) = any(item.stage_scope)
    and (
      trim(coalesce(p_subject, '')) = any(source.subject_scope)
      or (trim(coalesce(p_subject, '')) in ('思政', '思想政治') and '思想政治' = any(source.subject_scope))
      or (trim(coalesce(p_subject, '')) = '道德与法治' and '道德与法治' = any(source.subject_scope))
    )
  order by score desc, item.sort_order, item.title
  limit least(greatest(coalesce(p_match_count, 6), 1), 12);
$$;

revoke all on function public.hai_import_politics_case_payload(jsonb) from public, anon, authenticated;
grant execute on function public.hai_import_politics_case_payload(jsonb) to service_role;
revoke all on function public.hai_match_politics_cases(text, text, integer, text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.hai_match_politics_cases(text, text, integer, text, text, text, text, integer) to service_role;

update public.hai_feature_modules
set input_schema = '[{"name":"stage","label":"学段","type":"select","required":true,"options":["小学","初中","高中","其他（中职/高职/高校等）"]},{"name":"subject","label":"学科","type":"text","required":true},{"name":"grade","label":"年级","type":"select","required":true},{"name":"volume","label":"册次/教材","type":"select","required":true},{"name":"unit","label":"单元","type":"select","required":true},{"name":"topic","label":"课题","type":"select","required":true},{"name":"frame","label":"框题","type":"select","required":false},{"name":"lesson_type","label":"课型","type":"text","required":true,"default":"公开课","readonly":true},{"name":"textbook_content","label":"补充教材内容","type":"textarea","required":false}]'::jsonb,
  updated_at = now()
where slug = 'subject-lesson-design';

commit;
