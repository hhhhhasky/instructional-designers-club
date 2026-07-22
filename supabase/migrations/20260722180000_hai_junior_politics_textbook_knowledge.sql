begin;

-- Canonical, cross-Skill textbook knowledge. Each row is one independently
-- retrievable frame (框题); Skill references keep only method and routing rules.
create table if not exists public.hai_textbook_collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  stage text not null,
  subject text not null,
  publisher text not null default '',
  edition_family text not null default '',
  edition_label text not null,
  grade_level integer not null check (grade_level between 1 and 12),
  grade_label text not null,
  volume text not null check (volume in ('上册', '下册', '全一册')),
  effective_from date,
  effective_to date,
  publication_status text not null default 'current',
  verification_status text not null default 'source_declared_current',
  requires_confirmation boolean not null default false,
  content_type text not null default 'knowledge_summary',
  source_type text not null default 'user_provided_teacher_summary',
  source_file_name text not null default '',
  source_note text not null default '',
  source_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hai_textbook_sections (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.hai_textbook_collections(id) on delete cascade,
  section_key text not null unique,
  unit_number integer not null check (unit_number > 0),
  unit_label text not null,
  unit_title text not null,
  lesson_number integer not null check (lesson_number > 0),
  lesson_label text not null,
  lesson_title text not null,
  frame_number integer not null check (frame_number > 0),
  frame_label text not null,
  frame_title text not null,
  section_path text not null,
  content_type text not null default 'knowledge_summary',
  content_markdown text not null,
  content_text text not null,
  knowledge_point_count integer not null default 0 check (knowledge_point_count >= 0),
  char_count integer not null default 0 check (char_count >= 0),
  sort_order integer not null default 0,
  content_hash text not null,
  verification_status text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (collection_id, unit_number, lesson_number, frame_number)
);

comment on table public.hai_textbook_collections is
  'Canonical textbook metadata shared across HAI tools and Skills; content is not injected globally.';
comment on table public.hai_textbook_sections is
  'Independently retrievable textbook knowledge summaries separated by unit, lesson and frame.';

create index if not exists idx_hai_textbook_collections_route
  on public.hai_textbook_collections(stage, subject, grade_level, volume, is_active);
create index if not exists idx_hai_textbook_sections_route
  on public.hai_textbook_sections(collection_id, unit_number, lesson_number, frame_number, is_active);
create index if not exists idx_hai_textbook_sections_titles_trgm
  on public.hai_textbook_sections using gin
  ((unit_title || ' ' || lesson_title || ' ' || frame_title) extensions.gin_trgm_ops);

drop trigger if exists update_hai_textbook_collections_updated_at on public.hai_textbook_collections;
create trigger update_hai_textbook_collections_updated_at
  before update on public.hai_textbook_collections
  for each row execute function public.update_updated_at_column();
drop trigger if exists update_hai_textbook_sections_updated_at on public.hai_textbook_sections;
create trigger update_hai_textbook_sections_updated_at
  before update on public.hai_textbook_sections
  for each row execute function public.update_updated_at_column();

alter table public.hai_textbook_collections enable row level security;
alter table public.hai_textbook_sections enable row level security;

grant select, insert, update, delete on public.hai_textbook_collections to authenticated;
grant select, insert, update, delete on public.hai_textbook_sections to authenticated;
grant all on public.hai_textbook_collections, public.hai_textbook_sections to service_role;

drop policy if exists "hai_textbook_collections admin manage" on public.hai_textbook_collections;
create policy "hai_textbook_collections admin manage"
  on public.hai_textbook_collections for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
drop policy if exists "hai_textbook_sections admin manage" on public.hai_textbook_sections;
create policy "hai_textbook_sections admin manage"
  on public.hai_textbook_sections for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create or replace function public.hai_list_textbook_catalog(
  p_stage text default null,
  p_subject text default null
)
returns table (
  collection_slug text,
  collection_title text,
  stage text,
  subject text,
  grade_level integer,
  grade_label text,
  volume text,
  edition_label text,
  publication_status text,
  verification_status text,
  requires_confirmation boolean,
  unit_number integer,
  unit_label text,
  unit_title text,
  lesson_number integer,
  lesson_label text,
  lesson_title text,
  frame_number integer,
  frame_label text,
  frame_title text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    collection.slug,
    collection.title,
    collection.stage,
    collection.subject,
    collection.grade_level,
    collection.grade_label,
    collection.volume,
    collection.edition_label,
    collection.publication_status,
    collection.verification_status,
    collection.requires_confirmation,
    section.unit_number,
    section.unit_label,
    section.unit_title,
    section.lesson_number,
    section.lesson_label,
    section.lesson_title,
    section.frame_number,
    section.frame_label,
    section.frame_title
  from public.hai_textbook_collections collection
  join public.hai_textbook_sections section on section.collection_id = collection.id
  where collection.is_active = true
    and section.is_active = true
    and (nullif(trim(p_stage), '') is null or collection.stage = trim(p_stage))
    and (
      nullif(trim(p_subject), '') is null
      or collection.subject = trim(p_subject)
      or (trim(p_subject) in ('思想政治', '思政') and collection.subject = '道德与法治')
    )
  order by collection.grade_level, collection.volume desc,
    section.unit_number, section.lesson_number, section.frame_number;
$$;

create or replace function public.hai_match_textbook_sections(
  p_stage text,
  p_subject text,
  p_grade_level integer default null,
  p_volume text default null,
  p_unit_query text default null,
  p_lesson_query text default null,
  p_frame_query text default null,
  p_match_count integer default 12
)
returns table (
  section_id uuid,
  collection_id uuid,
  collection_slug text,
  collection_title text,
  edition_label text,
  publication_status text,
  verification_status text,
  requires_confirmation boolean,
  grade_level integer,
  grade_label text,
  volume text,
  unit_number integer,
  unit_label text,
  unit_title text,
  lesson_number integer,
  lesson_label text,
  lesson_title text,
  frame_number integer,
  frame_label text,
  frame_title text,
  section_path text,
  content_type text,
  content_markdown text,
  source_hash text,
  content_hash text,
  score real
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    section.id,
    collection.id,
    collection.slug,
    collection.title,
    collection.edition_label,
    collection.publication_status,
    section.verification_status,
    collection.requires_confirmation,
    collection.grade_level,
    collection.grade_label,
    collection.volume,
    section.unit_number,
    section.unit_label,
    section.unit_title,
    section.lesson_number,
    section.lesson_label,
    section.lesson_title,
    section.frame_number,
    section.frame_label,
    section.frame_title,
    section.section_path,
    section.content_type,
    section.content_markdown,
    collection.source_hash,
    section.content_hash,
    (
      case when p_grade_level is not null and collection.grade_level = p_grade_level then 4 else 0 end +
      case when nullif(trim(p_volume), '') is not null and collection.volume = trim(p_volume) then 3 else 0 end +
      case when nullif(trim(p_unit_query), '') is not null and
        (section.unit_label || ' ' || section.unit_title) ilike '%' || trim(p_unit_query) || '%' then 4 else 0 end +
      case when nullif(trim(p_lesson_query), '') is not null and
        (section.lesson_label || ' ' || section.lesson_title) ilike '%' || trim(p_lesson_query) || '%' then 6 else 0 end +
      case when nullif(trim(p_frame_query), '') is not null and
        (section.frame_label || ' ' || section.frame_title) ilike '%' || trim(p_frame_query) || '%' then 8 else 0 end +
      similarity(
        section.unit_label || ' ' || section.unit_title || ' ' ||
        section.lesson_label || ' ' || section.lesson_title || ' ' ||
        section.frame_label || ' ' || section.frame_title,
        concat_ws(' ', p_unit_query, p_lesson_query, p_frame_query)
      )
    )::real as score
  from public.hai_textbook_sections section
  join public.hai_textbook_collections collection on collection.id = section.collection_id
  where collection.is_active = true
    and section.is_active = true
    and collection.stage = trim(p_stage)
    and (
      collection.subject = trim(p_subject)
      or (trim(p_subject) in ('思想政治', '思政') and collection.subject = '道德与法治')
    )
    and (p_grade_level is null or collection.grade_level = p_grade_level)
    and (nullif(trim(p_volume), '') is null or collection.volume = trim(p_volume))
    and (
      nullif(trim(p_unit_query), '') is null
      or (section.unit_label || ' ' || section.unit_title) ilike '%' || trim(p_unit_query) || '%'
      or similarity(section.unit_label || ' ' || section.unit_title, trim(p_unit_query)) >= 0.25
    )
    and (
      nullif(trim(p_lesson_query), '') is null
      or (section.lesson_label || ' ' || section.lesson_title) ilike '%' || trim(p_lesson_query) || '%'
      or similarity(section.lesson_label || ' ' || section.lesson_title, trim(p_lesson_query)) >= 0.25
    )
    and (
      nullif(trim(p_frame_query), '') is null
      or (section.frame_label || ' ' || section.frame_title) ilike '%' || trim(p_frame_query) || '%'
      or similarity(section.frame_label || ' ' || section.frame_title, trim(p_frame_query)) >= 0.25
    )
  order by score desc, section.sort_order
  limit least(greatest(p_match_count, 1), 32);
$$;

revoke all on function public.hai_list_textbook_catalog(text, text) from public, anon;
grant execute on function public.hai_list_textbook_catalog(text, text) to authenticated, service_role;
revoke all on function public.hai_match_textbook_sections(text, text, integer, text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.hai_match_textbook_sections(text, text, integer, text, text, text, text, integer) to service_role;

-- Textbook rows are imported idempotently from the reviewed JSON artifact.

update public.hai_feature_modules
set input_schema = '[{"name":"stage","label":"学段","type":"text","required":true,"default":"初中","readonly":true},{"name":"subject","label":"学科","type":"text","required":true,"default":"道德与法治","readonly":true},{"name":"grade","label":"年级","type":"select","required":true},{"name":"volume","label":"册次","type":"select","required":true},{"name":"unit","label":"单元","type":"select","required":true},{"name":"topic","label":"课题","type":"select","required":true},{"name":"frame","label":"框题","type":"select","required":false},{"name":"lesson_type","label":"课型","type":"text","required":true,"default":"公开课","readonly":true},{"name":"textbook_content","label":"补充教材内容","type":"textarea","required":false}]'::jsonb,
  updated_at = now()
where slug = 'subject-lesson-design';

commit;
