begin;

-- The textbook menu is a deterministic catalog, not a semantic search box.
-- Return stable business keys for every selectable level so the frontend can
-- submit the selected section directly instead of asking the backend to guess
-- from display titles.
drop function if exists public.hai_list_textbook_catalog(text, text);

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
  unit_section_key text,
  lesson_number integer,
  lesson_label text,
  lesson_title text,
  lesson_section_key text,
  frame_number integer,
  frame_label text,
  frame_title text,
  frame_section_key text
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
    unit_section.section_key,
    section.lesson_number,
    section.lesson_label,
    section.lesson_title,
    lesson_section.section_key,
    section.frame_number,
    section.frame_label,
    section.frame_title,
    case when section.section_level = 'frame' then section.section_key else null end
  from public.hai_textbook_collections collection
  join public.hai_textbook_sections section on section.collection_id = collection.id
  left join public.hai_textbook_sections unit_section
    on unit_section.collection_id = section.collection_id
    and unit_section.section_level = 'unit'
    and unit_section.unit_number = section.unit_number
    and unit_section.is_active = true
  left join public.hai_textbook_sections lesson_section
    on lesson_section.collection_id = section.collection_id
    and lesson_section.section_level = 'lesson'
    and lesson_section.unit_number = section.unit_number
    and lesson_section.lesson_number = section.lesson_number
    and lesson_section.is_active = true
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

-- Deterministic retrieval by the selected lesson/frame business key. The
-- selected section is the seed; explicit reverse links bring back its lesson
-- and unit context. No title similarity or score is involved.
create or replace function public.hai_get_textbook_sections_by_key(
  p_collection_slug text,
  p_unit_section_key text,
  p_lesson_section_key text,
  p_frame_section_key text default null
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
  section_level text,
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
  sort_order integer
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with selected as (
    select section.id
    from public.hai_textbook_sections section
    join public.hai_textbook_collections collection on collection.id = section.collection_id
    where collection.slug = trim(p_collection_slug)
      and collection.is_active = true
      and section.is_active = true
      and section.section_key = coalesce(nullif(trim(p_frame_section_key), ''), trim(p_lesson_section_key))
      and section.section_level = case
        when nullif(trim(p_frame_section_key), '') is null then 'lesson'
        else 'frame'
      end
      and (
        section.section_level = 'lesson'
        and exists (
          select 1
          from public.hai_textbook_section_links link
          join public.hai_textbook_sections unit_section on unit_section.id = link.linked_section_id
          where link.section_id = section.id
            and link.relation_type = 'lesson_to_unit'
            and unit_section.section_key = trim(p_unit_section_key)
        )
        or section.section_level = 'frame'
        and exists (
          select 1
          from public.hai_textbook_section_links frame_link
          join public.hai_textbook_sections lesson_section on lesson_section.id = frame_link.linked_section_id
          join public.hai_textbook_section_links lesson_link on lesson_link.section_id = lesson_section.id
          join public.hai_textbook_sections unit_section on unit_section.id = lesson_link.linked_section_id
          where frame_link.section_id = section.id
            and frame_link.relation_type = 'frame_to_lesson'
            and lesson_section.section_key = trim(p_lesson_section_key)
            and lesson_link.relation_type = 'lesson_to_unit'
            and unit_section.section_key = trim(p_unit_section_key)
        )
      )
  ), related_ids as (
    select selected.id
    from selected
    union
    select link.linked_section_id
    from public.hai_textbook_section_links link
    join selected on selected.id = link.section_id
    where link.relation_type = case
      when nullif(trim(p_frame_section_key), '') is null then 'lesson_to_unit'
      else 'frame_to_lesson'
    end
    union
    select parent_link.linked_section_id
    from public.hai_textbook_section_links link
    join selected on selected.id = link.section_id
    join public.hai_textbook_section_links parent_link
      on parent_link.section_id = link.linked_section_id
    where link.relation_type = 'frame_to_lesson'
      and parent_link.relation_type = 'lesson_to_unit'
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
    section.section_level,
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
    section.sort_order
  from related_ids
  join public.hai_textbook_sections section on section.id = related_ids.id
  join public.hai_textbook_collections collection on collection.id = section.collection_id
  where section.is_active = true
  order by case section.section_level when 'unit' then 0 when 'lesson' then 1 else 2 end,
    section.sort_order;
$$;

revoke all on function public.hai_get_textbook_sections_by_key(text, text, text, text) from public, anon, authenticated;
grant execute on function public.hai_get_textbook_sections_by_key(text, text, text, text) to service_role;

commit;
