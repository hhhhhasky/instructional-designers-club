begin;

-- The stable public route is the textbook collection plus numeric hierarchy.
-- section_key remains an internal historical identifier and is deliberately
-- not used by the catalog client or the Work retrieval path.
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
  frame_section_key text,
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
    unit_section.section_key,
    section.lesson_number,
    section.lesson_label,
    section.lesson_title,
    lesson_section.section_key,
    section.frame_number,
    section.frame_label,
    section.frame_title,
    case when section.section_level = 'frame' then section.section_key else null end,
    section.unit_number,
    section.lesson_number,
    case when section.section_level = 'frame' then section.frame_number else null end
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

create or replace function public.hai_get_textbook_sections_by_route(
  p_collection_slug text,
  p_unit_number integer,
  p_lesson_number integer,
  p_frame_number integer default null
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
  from public.hai_textbook_sections section
  join public.hai_textbook_collections collection on collection.id = section.collection_id
  where collection.slug = trim(p_collection_slug)
    and collection.is_active = true
    and section.is_active = true
    and section.unit_number = p_unit_number
    and (
      section.section_level = 'unit'
      or (
        section.section_level = 'lesson'
        and section.lesson_number = p_lesson_number
      )
      or (
        section.section_level = 'frame'
        and section.lesson_number = p_lesson_number
        and section.frame_number = p_frame_number
        and p_frame_number is not null
        and p_frame_number > 0
      )
    )
  order by case section.section_level when 'unit' then 0 when 'lesson' then 1 else 2 end,
    section.sort_order;
$$;

revoke all on function public.hai_get_textbook_sections_by_route(text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.hai_get_textbook_sections_by_route(text, integer, integer, integer)
  to service_role;

commit;
