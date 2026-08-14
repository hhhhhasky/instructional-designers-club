begin;

-- V3-lite keeps the three physical textbook tables, but makes edition
-- governance, source fidelity, native structure semantics, and future-proof
-- ASCII route keys explicit. Existing V2 slugs/keys are deliberately retained
-- so historical Work snapshots remain interpretable.
alter table public.hai_textbook_collections
  add column if not exists edition_year integer,
  add column if not exists lifecycle_status text not null default 'current',
  add column if not exists is_default boolean not null default false,
  add column if not exists text_fidelity text not null default 'teacher_summary',
  add column if not exists structure_profile text not null default 'legacy-v2';

alter table public.hai_textbook_sections
  add column if not exists native_node_type text not null default 'legacy_v2_node',
  add column if not exists native_label text not null default '',
  add column if not exists frame_policy text not null default 'legacy_unclassified';

update public.hai_textbook_collections
set
  edition_year = edition_year,
  lifecycle_status = case publication_status
    when 'provisional' then 'candidate'
    when 'legacy_current' then 'legacy'
    when 'catalogue_summary' then 'catalogue_summary'
    else 'current'
  end,
  is_default = publication_status in ('current', 'catalogue_summary'),
  text_fidelity = case
    when source_type = 'official_public_catalogue' then 'catalogue_summary'
    else 'teacher_summary'
  end,
  structure_profile = 'legacy-v2'
where structure_profile = 'legacy-v2';

update public.hai_textbook_sections
set
  native_node_type = case section_level
    when 'unit' then 'unit'
    when 'lesson' then 'lesson'
    else 'legacy_frame'
  end,
  native_label = coalesce(
    nullif(unit_label, ''),
    nullif(lesson_label, ''),
    nullif(frame_label, '')
  ),
  frame_policy = case
    when section_level = 'frame' then 'legacy_unclassified'
    else 'not_applicable'
  end
where frame_policy = 'legacy_unclassified';

alter table public.hai_textbook_collections
  drop constraint if exists hai_textbook_collections_edition_year_check;
alter table public.hai_textbook_collections
  add constraint hai_textbook_collections_edition_year_check
  check (edition_year is null or edition_year between 2000 and 2100);

alter table public.hai_textbook_collections
  drop constraint if exists hai_textbook_collections_lifecycle_status_check;
alter table public.hai_textbook_collections
  add constraint hai_textbook_collections_lifecycle_status_check
  check (lifecycle_status in ('draft', 'candidate', 'current', 'catalogue_summary', 'legacy', 'retired'));

alter table public.hai_textbook_collections
  drop constraint if exists hai_textbook_collections_text_fidelity_check;
alter table public.hai_textbook_collections
  add constraint hai_textbook_collections_text_fidelity_check
  check (text_fidelity in ('catalogue_summary', 'teacher_summary', 'faithful_reconstruction', 'verbatim'));

alter table public.hai_textbook_sections
  drop constraint if exists hai_textbook_sections_native_node_type_check;
alter table public.hai_textbook_sections
  add constraint hai_textbook_sections_native_node_type_check
  check (native_node_type in (
    'unit', 'chapter', 'section', 'lesson', 'topic', 'frame', 'session',
    'text', 'activity', 'supplement', 'legacy_frame', 'legacy_v2_node'
  ));

alter table public.hai_textbook_sections
  drop constraint if exists hai_textbook_sections_frame_policy_check;
alter table public.hai_textbook_sections
  add constraint hai_textbook_sections_frame_policy_check
  check (frame_policy in (
    'native_printed_frame', 'subject_field_block', 'evidence_block',
    'not_applicable', 'legacy_unclassified'
  ));

create unique index if not exists uq_hai_textbook_collections_default_route
  on public.hai_textbook_collections(stage, subject, grade_level, volume)
  where is_default;

comment on column public.hai_textbook_collections.edition_year is 'Publisher edition/revision year; null only for legacy rows whose source did not declare a year.';
comment on column public.hai_textbook_collections.lifecycle_status is 'Edition lifecycle: draft/candidate/current/catalogue_summary/legacy/retired.';
comment on column public.hai_textbook_collections.is_default is 'Whether this edition is the default catalogue choice for stage+subject+grade+volume.';
comment on column public.hai_textbook_collections.text_fidelity is 'How faithful the stored text is to the printed book.';
comment on column public.hai_textbook_collections.structure_profile is 'Stable structure/parser profile used by the importer and frontend.';
comment on column public.hai_textbook_sections.native_node_type is 'Native pedagogical structure name (unit/chapter/section/lesson/topic/frame/session/text/activity).';
comment on column public.hai_textbook_sections.native_label is 'Display label in the native textbook structure, such as 第1章 or 第1课.';
comment on column public.hai_textbook_sections.frame_policy is 'Explicit semantics for level-three rows; prevents mixing printed frames with generated field/evidence blocks.';

-- V3-lite importer. V2 remains available for rollback/legacy imports, while
-- all newly designed textbooks must pass canonical naming and manifest checks.
create or replace function public.hai_import_textbook_v3_lite_payload(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_schema_version text := coalesce(p_payload->>'schema_version', '');
  v_collection_count integer := jsonb_array_length(coalesce(p_payload->'collections', '[]'::jsonb));
  v_section_count integer := jsonb_array_length(coalesce(p_payload->'sections', '[]'::jsonb));
  v_link_count integer := jsonb_array_length(coalesce(p_payload->'links', '[]'::jsonb));
  v_invalid_count integer;
begin
  if v_schema_version <> 'hai-textbook-v3-lite' then
    raise exception 'V3-lite textbook payload schema_version must be hai-textbook-v3-lite';
  end if;
  if v_collection_count < 1 or v_section_count < 1 then
    raise exception 'V3-lite payload must contain collections and sections';
  end if;
  if jsonb_typeof(p_payload->'links') <> 'array' then
    raise exception 'V3-lite payload must contain a links array';
  end if;

  if coalesce((p_payload->>'expected_book_count')::int, -1) <> v_collection_count then
    raise exception 'V3-lite manifest expected_book_count mismatch';
  end if;
  if coalesce((p_payload->>'expected_section_count')::int, -1) <> v_section_count then
    raise exception 'V3-lite manifest expected_section_count mismatch';
  end if;
  if coalesce((p_payload->>'expected_link_count')::int, -1) <> v_link_count then
    raise exception 'V3-lite manifest expected_link_count mismatch';
  end if;
  if coalesce((p_payload->>'expected_unit_count')::int, -1) <> (
    select count(*) from jsonb_array_elements(p_payload->'sections') x
    where x->>'section_level' = 'unit'
  ) then
    raise exception 'V3-lite manifest expected_unit_count mismatch';
  end if;
  if coalesce((p_payload->>'expected_lesson_count')::int, -1) <> (
    select count(*) from jsonb_array_elements(p_payload->'sections') x
    where x->>'section_level' = 'lesson'
  ) then
    raise exception 'V3-lite manifest expected_lesson_count mismatch';
  end if;
  if coalesce((p_payload->>'expected_frame_count')::int, -1) <> (
    select count(*) from jsonb_array_elements(p_payload->'sections') x
    where x->>'section_level' = 'frame'
  ) then
    raise exception 'V3-lite manifest expected_frame_count mismatch';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_payload->'collections') x
    where x->>'slug' !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      or nullif(trim(x->>'slug'), '') is null
      or nullif(trim(x->>'title'), '') is null
      or nullif(trim(x->>'stage'), '') is null
      or nullif(trim(x->>'subject'), '') is null
      or nullif(trim(x->>'publisher'), '') is null
      or nullif(trim(x->>'edition_family'), '') is null
      or nullif(trim(x->>'edition_label'), '') is null
      or nullif(trim(x->>'grade_label'), '') is null
      or nullif(trim(x->>'volume'), '') is null
      or nullif(trim(x->>'structure_profile'), '') is null
      or x->>'structure_profile' !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      or coalesce((x->>'edition_year')::int, 0) not between 2000 and 2100
      or coalesce(x->>'lifecycle_status', '') not in ('draft', 'candidate', 'current', 'catalogue_summary', 'legacy', 'retired')
      or coalesce(x->>'text_fidelity', '') not in ('catalogue_summary', 'teacher_summary', 'faithful_reconstruction', 'verbatim')
      or jsonb_typeof(x->'is_default') <> 'boolean'
  ) then
    raise exception 'V3-lite payload contains invalid collection metadata';
  end if;

  select count(*) into v_invalid_count
  from (
    select x->>'slug' as slug
    from jsonb_array_elements(p_payload->'collections') x
    group by x->>'slug'
    having count(*) > 1
  ) duplicate_collections;
  if v_invalid_count > 0 then raise exception 'V3-lite payload contains duplicate collection slugs'; end if;

  select count(*) into v_invalid_count
  from (
    select x->>'stage' stage, x->>'subject' subject, (x->>'grade_level')::int grade_level, x->>'volume' volume
    from jsonb_array_elements(p_payload->'collections') x
    group by x->>'stage', x->>'subject', (x->>'grade_level')::int, x->>'volume'
    having count(*) > 1
  ) duplicate_routes;
  if v_invalid_count > 0 then raise exception 'V3-lite payload contains duplicate stage/subject/grade/volume routes'; end if;

  if exists (
    select 1
    from jsonb_array_elements(p_payload->'sections') x
    where coalesce(x->>'section_level', '') not in ('unit', 'lesson', 'frame')
      or nullif(trim(x->>'section_key'), '') is null
      or x->>'section_key' !~ '^[a-z0-9]+(-[a-z0-9]+)*::u[0-9]{2}(::l[0-9]{2}(::f[0-9]{2})?)?$'
      or nullif(trim(x->>'collection_slug'), '') is null
      or nullif(trim(x->>'unit_label'), '') is null
      or nullif(trim(x->>'unit_title'), '') is null
      or nullif(trim(x->>'native_label'), '') is null
      or nullif(trim(x->>'native_node_type'), '') is null
      or coalesce(x->>'native_node_type', '') not in (
        'unit', 'chapter', 'section', 'lesson', 'topic', 'frame', 'session', 'text', 'activity', 'supplement'
      )
      or nullif(trim(x->>'section_path'), '') is null
      or nullif(trim(x->>'content_markdown'), '') is null
      or nullif(trim(x->>'content_text'), '') is null
      or coalesce(x->>'frame_policy', '') not in ('native_printed_frame', 'subject_field_block', 'evidence_block', 'not_applicable')
      or (
        x->>'section_key' <> concat_ws('',
          x->>'collection_slug', '::u', lpad(x->>'unit_number', 2, '0'),
          case when x->>'section_level' = 'unit' then '' else concat('::l', lpad(x->>'lesson_number', 2, '0')) end,
          case when x->>'section_level' = 'frame' then concat('::f', lpad(x->>'frame_number', 2, '0')) else '' end
        )
      )
      or (x->>'section_level' = 'unit' and (
        coalesce((x->>'lesson_number')::int, -1) <> 0
        or coalesce((x->>'frame_number')::int, -1) <> 0
        or coalesce(x->>'lesson_label', '') <> ''
        or coalesce(x->>'lesson_title', '') <> ''
        or coalesce(x->>'frame_label', '') <> ''
        or coalesce(x->>'frame_title', '') <> ''
        or coalesce(x->>'frame_policy', '') <> 'not_applicable'
      ))
      or (x->>'section_level' = 'lesson' and (
        coalesce((x->>'lesson_number')::int, 0) <= 0
        or coalesce((x->>'frame_number')::int, -1) <> 0
        or nullif(trim(x->>'lesson_label'), '') is null
        or nullif(trim(x->>'lesson_title'), '') is null
        or coalesce(x->>'frame_label', '') <> ''
        or coalesce(x->>'frame_title', '') <> ''
        or coalesce(x->>'frame_policy', '') <> 'not_applicable'
      ))
      or (x->>'section_level' = 'frame' and (
        coalesce((x->>'lesson_number')::int, 0) <= 0
        or coalesce((x->>'frame_number')::int, 0) <= 0
        or nullif(trim(x->>'lesson_label'), '') is null
        or nullif(trim(x->>'lesson_title'), '') is null
        or nullif(trim(x->>'frame_label'), '') is null
        or nullif(trim(x->>'frame_title'), '') is null
        or coalesce(x->>'frame_policy', '') = 'not_applicable'
      ))
      or coalesce((x->>'char_count')::int, -1) <> length(x->>'content_text')
      or coalesce(x->>'content_hash', '') <> encode(digest(x->>'content_markdown', 'sha256'), 'hex')
      or coalesce((x->>'sort_order')::int, -1) <> (
        (x->>'unit_number')::int * 10000
        + coalesce((x->>'lesson_number')::int, 0) * 100
        + coalesce((x->>'frame_number')::int, 0)
      )
  ) then
    raise exception 'V3-lite payload contains invalid section shape, key, count, hash, or sort_order';
  end if;

  select count(*) into v_invalid_count
  from (
    select x->>'section_key' section_key
    from jsonb_array_elements(p_payload->'sections') x
    group by x->>'section_key'
    having count(*) > 1
  ) duplicate_sections;
  if v_invalid_count > 0 then raise exception 'V3-lite payload contains duplicate section keys'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_payload->'sections') section
    where not exists (
      select 1 from jsonb_array_elements(p_payload->'collections') collection
      where collection->>'slug' = section->>'collection_slug'
    )
  ) then
    raise exception 'V3-lite section references an unknown collection';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_payload->'links') link
    where coalesce(link->>'relation_type', '') not in ('unit_to_lesson', 'lesson_to_unit', 'lesson_to_frame', 'frame_to_lesson')
      or not exists (select 1 from jsonb_array_elements(p_payload->'sections') section where section->>'section_key' = link->>'section_key')
      or not exists (select 1 from jsonb_array_elements(p_payload->'sections') section where section->>'section_key' = link->>'linked_section_key')
  ) then
    raise exception 'V3-lite payload contains an invalid link';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_payload->'sections') child
    where child->>'section_level' <> 'unit'
      and not exists (
        select 1
        from jsonb_array_elements(p_payload->'sections') parent
        where parent->>'collection_slug' = child->>'collection_slug'
          and parent->>'unit_number' = child->>'unit_number'
          and parent->>'section_level' = case when child->>'section_level' = 'lesson' then 'unit' else 'lesson' end
          and (child->>'section_level' <> 'frame' or parent->>'lesson_number' = child->>'lesson_number')
      )
  ) then
    raise exception 'V3-lite payload is missing a parent section';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_payload->'sections') child
    where child->>'section_level' <> 'unit'
      and (
        not exists (
          select 1 from jsonb_array_elements(p_payload->'links') link
          where link->>'relation_type' = case when child->>'section_level' = 'lesson' then 'unit_to_lesson' else 'lesson_to_frame' end
            and link->>'linked_section_key' = child->>'section_key'
            and link->>'section_key' = (
              select parent->>'section_key'
              from jsonb_array_elements(p_payload->'sections') parent
              where parent->>'collection_slug' = child->>'collection_slug'
                and parent->>'unit_number' = child->>'unit_number'
                and parent->>'section_level' = case when child->>'section_level' = 'lesson' then 'unit' else 'lesson' end
                and (child->>'section_level' <> 'frame' or parent->>'lesson_number' = child->>'lesson_number')
              limit 1
            )
        )
        or not exists (
          select 1 from jsonb_array_elements(p_payload->'links') link
          where link->>'relation_type' = case when child->>'section_level' = 'lesson' then 'lesson_to_unit' else 'frame_to_lesson' end
            and link->>'section_key' = child->>'section_key'
            and link->>'linked_section_key' = (
              select parent->>'section_key'
              from jsonb_array_elements(p_payload->'sections') parent
              where parent->>'collection_slug' = child->>'collection_slug'
                and parent->>'unit_number' = child->>'unit_number'
                and parent->>'section_level' = case when child->>'section_level' = 'lesson' then 'unit' else 'lesson' end
                and (child->>'section_level' <> 'frame' or parent->>'lesson_number' = child->>'lesson_number')
              limit 1
            )
        )
      )
  ) then
    raise exception 'V3-lite payload is missing a bidirectional parent link';
  end if;

  -- A newly imported default edition supersedes only the old default for the
  -- same route. Old rows stay active for audit and direct-link compatibility.
  update public.hai_textbook_collections current_default
  set is_default = false, updated_at = now()
  from jsonb_array_elements(p_payload->'collections') incoming
  where current_default.stage = incoming->>'stage'
    and current_default.subject = incoming->>'subject'
    and current_default.grade_level = (incoming->>'grade_level')::int
    and current_default.volume = incoming->>'volume'
    and current_default.slug <> incoming->>'slug'
    and (incoming->>'is_default')::boolean
    and current_default.is_default;

  insert into public.hai_textbook_collections (
    slug, title, stage, subject, publisher, edition_family, edition_label,
    grade_level, grade_label, volume, effective_from, publication_status,
    verification_status, requires_confirmation, content_type, source_type,
    source_file_name, source_note, source_hash, metadata, is_active,
    edition_year, lifecycle_status, is_default, text_fidelity, structure_profile
  )
  select
    item.slug, item.title, item.stage, item.subject, item.publisher,
    item.edition_family, item.edition_label, item.grade_level,
    item.grade_label, item.volume, item.effective_from::date,
    item.publication_status, item.verification_status,
    item.requires_confirmation, item.content_type, item.source_type,
    item.source_file_name, item.source_note, item.source_hash,
    item.metadata, true,
    item.edition_year, item.lifecycle_status, item.is_default,
    item.text_fidelity, item.structure_profile
  from jsonb_to_recordset(p_payload->'collections') as item(
    slug text, title text, stage text, subject text, publisher text,
    edition_family text, edition_label text, grade_level integer,
    grade_label text, volume text, effective_from text,
    publication_status text, verification_status text,
    requires_confirmation boolean, content_type text, source_type text,
    source_file_name text, source_note text, source_hash text, metadata jsonb,
    edition_year integer, lifecycle_status text, is_default boolean,
    text_fidelity text, structure_profile text
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
    edition_year = excluded.edition_year,
    lifecycle_status = excluded.lifecycle_status,
    is_default = excluded.is_default,
    text_fidelity = excluded.text_fidelity,
    structure_profile = excluded.structure_profile,
    updated_at = now();

  insert into public.hai_textbook_sections (
    collection_id, section_key, section_level, unit_number, unit_label, unit_title,
    lesson_number, lesson_label, lesson_title, frame_number, frame_label,
    frame_title, section_path, content_type, content_markdown, content_text,
    knowledge_point_count, char_count, sort_order, content_hash,
    verification_status, metadata, is_active,
    native_node_type, native_label, frame_policy
  )
  select
    collection.id, item.section_key, item.section_level, item.unit_number,
    item.unit_label, item.unit_title, item.lesson_number, item.lesson_label,
    item.lesson_title, item.frame_number, item.frame_label, item.frame_title,
    item.section_path, item.content_type, item.content_markdown, item.content_text,
    item.knowledge_point_count, item.char_count, item.sort_order, item.content_hash,
    item.verification_status, item.metadata, true,
    item.native_node_type, item.native_label, item.frame_policy
  from jsonb_to_recordset(p_payload->'sections') as item(
    section_key text, section_level text, collection_slug text, unit_number integer,
    unit_label text, unit_title text, lesson_number integer,
    lesson_label text, lesson_title text, frame_number integer,
    frame_label text, frame_title text, section_path text,
    content_type text, content_markdown text, content_text text,
    knowledge_point_count integer, char_count integer, sort_order integer,
    content_hash text, verification_status text, metadata jsonb,
    native_node_type text, native_label text, frame_policy text
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
    native_node_type = excluded.native_node_type,
    native_label = excluded.native_label,
    frame_policy = excluded.frame_policy,
    updated_at = now();

  update public.hai_textbook_sections section
  set is_active = false, updated_at = now()
  where section.collection_id in (
    select collection.id from public.hai_textbook_collections collection
    where collection.slug in (select item->>'slug' from jsonb_array_elements(p_payload->'collections') item)
  )
  and section.section_key not in (select item->>'section_key' from jsonb_array_elements(p_payload->'sections') item);

  delete from public.hai_textbook_section_links link
  where link.section_id in (
    select section.id from public.hai_textbook_sections section
    join public.hai_textbook_collections collection on collection.id = section.collection_id
    where collection.slug in (select item->>'slug' from jsonb_array_elements(p_payload->'collections') item)
  )
  or link.linked_section_id in (
    select section.id from public.hai_textbook_sections section
    join public.hai_textbook_collections collection on collection.id = section.collection_id
    where collection.slug in (select item->>'slug' from jsonb_array_elements(p_payload->'collections') item)
  );

  insert into public.hai_textbook_section_links (section_id, linked_section_id, relation_type)
  select source.id, target.id, item.relation_type
  from jsonb_to_recordset(p_payload->'links') as item(
    section_key text, linked_section_key text, relation_type text
  )
  join public.hai_textbook_sections source on source.section_key = item.section_key
  join public.hai_textbook_sections target on target.section_key = item.linked_section_key
  on conflict (section_id, linked_section_id, relation_type) do nothing;

  return jsonb_build_object(
    'schema_version', v_schema_version,
    'collections', v_collection_count,
    'sections', v_section_count,
    'links', v_link_count
  );
end;
$$;

revoke all on function public.hai_import_textbook_v3_lite_payload(jsonb)
  from public, anon, authenticated;
grant execute on function public.hai_import_textbook_v3_lite_payload(jsonb)
  to service_role;

-- Catalogues expose one default edition per route. Non-default legacy rows
-- remain queryable by their exact slug for historical evidence.
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
  frame_title text,
  unit_route_number integer,
  lesson_route_number integer,
  frame_route_number integer
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
    section.frame_title,
    section.unit_number,
    section.lesson_number,
    case when section.section_level = 'frame' then section.frame_number else null end
  from public.hai_textbook_collections collection
  join public.hai_textbook_sections section on section.collection_id = collection.id
  where collection.is_active = true
    and collection.is_default = true
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

revoke all on function public.hai_list_textbook_catalog(text, text)
  from public, anon;
grant execute on function public.hai_list_textbook_catalog(text, text)
  to authenticated, service_role;

commit;
