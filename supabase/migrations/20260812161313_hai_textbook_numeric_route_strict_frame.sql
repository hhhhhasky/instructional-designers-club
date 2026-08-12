begin;

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
  with route_ok as (
    select exists (
      select 1
      from public.hai_textbook_sections frame
      join public.hai_textbook_collections collection on collection.id = frame.collection_id
      where collection.slug = trim(p_collection_slug)
        and collection.is_active = true
        and frame.is_active = true
        and frame.section_level = 'frame'
        and frame.unit_number = p_unit_number
        and frame.lesson_number = p_lesson_number
        and frame.frame_number = p_frame_number
    ) or p_frame_number is null as valid
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
  from public.hai_textbook_sections section
  join public.hai_textbook_collections collection on collection.id = section.collection_id
  cross join route_ok
  where route_ok.valid
    and collection.slug = trim(p_collection_slug)
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
