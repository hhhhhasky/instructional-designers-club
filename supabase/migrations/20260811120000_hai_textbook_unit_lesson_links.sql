begin;

-- Extend the canonical textbook rows from the original frame-only model to
-- explicit unit and lesson context rows. Existing politics rows remain
-- section_level = 'frame' and keep their current route unchanged.
alter table public.hai_textbook_sections
  add column if not exists section_level text not null default 'frame';

alter table public.hai_textbook_sections
  drop constraint if exists hai_textbook_sections_lesson_number_check,
  drop constraint if exists hai_textbook_sections_frame_number_check,
  drop constraint if exists hai_textbook_sections_section_level_check;

alter table public.hai_textbook_sections
  add constraint hai_textbook_sections_lesson_number_check check (lesson_number >= 0),
  add constraint hai_textbook_sections_frame_number_check check (frame_number >= 0),
  add constraint hai_textbook_sections_section_level_check
    check (section_level in ('unit', 'lesson', 'frame'));

comment on column public.hai_textbook_sections.section_level is
  'Retrieval granularity: unit background, lesson summary, or existing frame/knowledge point.';

create table if not exists public.hai_textbook_section_links (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.hai_textbook_sections(id) on delete cascade,
  linked_section_id uuid not null references public.hai_textbook_sections(id) on delete cascade,
  relation_type text not null check (relation_type in (
    'unit_to_lesson', 'lesson_to_unit', 'lesson_to_frame', 'frame_to_lesson'
  )),
  created_at timestamptz not null default now(),
  unique (section_id, linked_section_id, relation_type),
  check (section_id <> linked_section_id)
);

comment on table public.hai_textbook_section_links is
  'Explicit bidirectional textbook context links. A lesson retrieval can walk back to its unit background.';

create index if not exists idx_hai_textbook_section_links_source
  on public.hai_textbook_section_links(section_id, relation_type);
create index if not exists idx_hai_textbook_section_links_target
  on public.hai_textbook_section_links(linked_section_id, relation_type);

alter table public.hai_textbook_section_links enable row level security;
grant all on public.hai_textbook_section_links to service_role;
grant select, insert, update, delete on public.hai_textbook_section_links to authenticated;

drop policy if exists "hai_textbook_section_links admin manage" on public.hai_textbook_section_links;
create policy "hai_textbook_section_links admin manage"
  on public.hai_textbook_section_links for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create or replace function public.hai_import_textbook_payload(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_collection_count integer := jsonb_array_length(coalesce(p_payload->'collections', '[]'::jsonb));
  v_section_count integer := jsonb_array_length(coalesce(p_payload->'sections', '[]'::jsonb));
  v_link_count integer := jsonb_array_length(coalesce(p_payload->'links', '[]'::jsonb));
begin
  if v_collection_count < 1 or v_section_count < 1 then
    raise exception 'Textbook import payload must contain collections and sections';
  end if;

  insert into public.hai_textbook_collections (
    slug, title, stage, subject, publisher, edition_family, edition_label,
    grade_level, grade_label, volume, effective_from, publication_status,
    verification_status, requires_confirmation, content_type, source_type,
    source_file_name, source_note, source_hash, metadata, is_active
  )
  select
    item.slug, item.title, item.stage, item.subject, item.publisher,
    item.edition_family, item.edition_label, item.grade_level,
    item.grade_label, item.volume, item.effective_from::date,
    item.publication_status, item.verification_status,
    item.requires_confirmation, item.content_type, item.source_type,
    item.source_file_name, item.source_note, item.source_hash,
    item.metadata, true
  from jsonb_to_recordset(p_payload->'collections') as item(
    slug text, title text, stage text, subject text, publisher text,
    edition_family text, edition_label text, grade_level integer,
    grade_label text, volume text, effective_from text,
    publication_status text, verification_status text,
    requires_confirmation boolean, content_type text, source_type text,
    source_file_name text, source_note text, source_hash text, metadata jsonb
  )
  on conflict (slug) do update set
    title = excluded.title,
    stage = excluded.stage,
    subject = excluded.subject,
    publisher = excluded.publisher,
    edition_family = excluded.edition_family,
    edition_label = excluded.edition_label,
    grade_level = excluded.grade_level,
    grade_label = excluded.grade_label,
    volume = excluded.volume,
    effective_from = excluded.effective_from,
    publication_status = excluded.publication_status,
    verification_status = excluded.verification_status,
    requires_confirmation = excluded.requires_confirmation,
    content_type = excluded.content_type,
    source_type = excluded.source_type,
    source_file_name = excluded.source_file_name,
    source_note = excluded.source_note,
    source_hash = excluded.source_hash,
    metadata = excluded.metadata,
    is_active = true,
    updated_at = now();

  insert into public.hai_textbook_sections (
    collection_id, section_key, section_level, unit_number, unit_label, unit_title,
    lesson_number, lesson_label, lesson_title, frame_number, frame_label,
    frame_title, section_path, content_type, content_markdown, content_text,
    knowledge_point_count, char_count, sort_order, content_hash,
    verification_status, metadata, is_active
  )
  select
    collection.id, item.section_key, coalesce(item.section_level, 'frame'),
    item.unit_number, item.unit_label, item.unit_title,
    item.lesson_number, item.lesson_label, item.lesson_title,
    item.frame_number, item.frame_label, item.frame_title, item.section_path,
    item.content_type, item.content_markdown, item.content_text,
    item.knowledge_point_count, item.char_count, item.sort_order,
    item.content_hash, item.verification_status, item.metadata, true
  from jsonb_to_recordset(p_payload->'sections') as item(
    section_key text, section_level text, collection_slug text, unit_number integer,
    unit_label text, unit_title text, lesson_number integer,
    lesson_label text, lesson_title text, frame_number integer,
    frame_label text, frame_title text, section_path text,
    content_type text, content_markdown text, content_text text,
    knowledge_point_count integer, char_count integer, sort_order integer,
    content_hash text, verification_status text, metadata jsonb
  )
  join public.hai_textbook_collections collection on collection.slug = item.collection_slug
  on conflict (section_key) do update set
    collection_id = excluded.collection_id,
    section_level = excluded.section_level,
    unit_number = excluded.unit_number,
    unit_label = excluded.unit_label,
    unit_title = excluded.unit_title,
    lesson_number = excluded.lesson_number,
    lesson_label = excluded.lesson_label,
    lesson_title = excluded.lesson_title,
    frame_number = excluded.frame_number,
    frame_label = excluded.frame_label,
    frame_title = excluded.frame_title,
    section_path = excluded.section_path,
    content_type = excluded.content_type,
    content_markdown = excluded.content_markdown,
    content_text = excluded.content_text,
    knowledge_point_count = excluded.knowledge_point_count,
    char_count = excluded.char_count,
    sort_order = excluded.sort_order,
    content_hash = excluded.content_hash,
    verification_status = excluded.verification_status,
    metadata = excluded.metadata,
    is_active = true,
    updated_at = now();

  update public.hai_textbook_sections section
  set is_active = false, updated_at = now()
  where section.collection_id in (
    select collection.id
    from public.hai_textbook_collections collection
    where collection.slug in (
      select item->>'slug' from jsonb_array_elements(p_payload->'collections') item
    )
  )
  and section.section_key not in (
    select item->>'section_key' from jsonb_array_elements(p_payload->'sections') item
  );

  delete from public.hai_textbook_section_links link
  where link.section_id in (
    select section.id
    from public.hai_textbook_sections section
    join public.hai_textbook_collections collection on collection.id = section.collection_id
    where collection.slug in (
      select item->>'slug' from jsonb_array_elements(p_payload->'collections') item
    )
  )
  or link.linked_section_id in (
    select section.id
    from public.hai_textbook_sections section
    join public.hai_textbook_collections collection on collection.id = section.collection_id
    where collection.slug in (
      select item->>'slug' from jsonb_array_elements(p_payload->'collections') item
    )
  );

  insert into public.hai_textbook_section_links (section_id, linked_section_id, relation_type)
  select source.id, target.id, item.relation_type
  from jsonb_to_recordset(coalesce(p_payload->'links', '[]'::jsonb)) as item(
    section_key text, linked_section_key text, relation_type text
  )
  join public.hai_textbook_sections source on source.section_key = item.section_key
  join public.hai_textbook_sections target on target.section_key = item.linked_section_key
  on conflict (section_id, linked_section_id, relation_type) do nothing;

  return jsonb_build_object(
    'collections', v_collection_count,
    'sections', v_section_count,
    'links', v_link_count
  );
end;
$$;

revoke all on function public.hai_import_textbook_payload(jsonb) from public, anon, authenticated;
grant execute on function public.hai_import_textbook_payload(jsonb) to service_role;

-- Catalog choices should expose lesson rows and existing frame rows, but not
-- the unit-only background rows as duplicate topics.
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
    and section.section_level in ('lesson', 'frame')
    and (nullif(trim(p_stage), '') is null or collection.stage = trim(p_stage))
    and (
      nullif(trim(p_subject), '') is null
      or collection.subject = trim(p_subject)
      or (trim(p_subject) in ('思想政治', '思政') and collection.subject = '道德与法治')
    )
  order by collection.grade_level, collection.volume desc,
    section.unit_number, section.lesson_number, section.frame_number;
$$;

revoke all on function public.hai_list_textbook_catalog(text, text) from public, anon;
grant execute on function public.hai_list_textbook_catalog(text, text) to authenticated, service_role;

-- Exact lesson/frame retrieval now walks only upward through the explicit
-- child-to-parent links, so a selected lesson receives its unit background.
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
  with candidates as (
    select
      section.id,
      collection.id as collection_id,
      collection.slug as collection_slug,
      collection.title as collection_title,
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
      section.section_level,
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
      and section.section_level in ('lesson', 'frame')
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
  ),
  seed as (
    select *
    from candidates
    order by score desc, section_level, unit_number, lesson_number, frame_number
    limit least(greatest(coalesce(p_match_count, 12), 1), 32)
  ),
  related_ids as (
    select link.linked_section_id as id
    from public.hai_textbook_section_links link
    join seed on seed.id = link.section_id
    where link.relation_type in ('lesson_to_unit', 'frame_to_lesson')
    union
    select parent_link.linked_section_id as id
    from public.hai_textbook_section_links link
    join seed on seed.id = link.section_id
    join public.hai_textbook_section_links parent_link
      on parent_link.section_id = link.linked_section_id
    where link.relation_type = 'frame_to_lesson'
      and parent_link.relation_type = 'lesson_to_unit'
  ),
  chosen as (
    select seed.id, seed.score, false as is_context
    from seed
    union all
    select section.id, (select min(seed.score) from seed) - 0.25, true as is_context
    from public.hai_textbook_sections section
    join related_ids related on related.id = section.id
    where section.is_active = true
  ),
  deduped as (
    select distinct on (id) id, score, is_context
    from chosen
    order by id, is_context
  )
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
    deduped.score::real
  from deduped
  join public.hai_textbook_sections section on section.id = deduped.id
  join public.hai_textbook_collections collection on collection.id = section.collection_id
  order by
    case section.section_level when 'unit' then 0 when 'lesson' then 1 else 2 end,
    section.unit_number, section.lesson_number, section.frame_number,
    deduped.is_context, deduped.score desc;
$$;

revoke all on function public.hai_match_textbook_sections(text, text, integer, text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.hai_match_textbook_sections(text, text, integer, text, text, text, text, integer) to service_role;

commit;
