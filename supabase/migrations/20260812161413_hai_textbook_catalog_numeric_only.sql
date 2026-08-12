begin;

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

commit;
