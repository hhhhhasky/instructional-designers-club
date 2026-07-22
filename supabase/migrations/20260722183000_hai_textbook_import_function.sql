begin;

create or replace function public.hai_import_textbook_payload(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_collection_count integer := jsonb_array_length(coalesce(p_payload->'collections', '[]'::jsonb));
  v_section_count integer := jsonb_array_length(coalesce(p_payload->'sections', '[]'::jsonb));
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
    collection_id, section_key, unit_number, unit_label, unit_title,
    lesson_number, lesson_label, lesson_title, frame_number, frame_label,
    frame_title, section_path, content_type, content_markdown, content_text,
    knowledge_point_count, char_count, sort_order, content_hash,
    verification_status, metadata, is_active
  )
  select
    collection.id, item.section_key, item.unit_number, item.unit_label,
    item.unit_title, item.lesson_number, item.lesson_label, item.lesson_title,
    item.frame_number, item.frame_label, item.frame_title, item.section_path,
    item.content_type, item.content_markdown, item.content_text,
    item.knowledge_point_count, item.char_count, item.sort_order,
    item.content_hash, item.verification_status, item.metadata, true
  from jsonb_to_recordset(p_payload->'sections') as item(
    section_key text, collection_slug text, unit_number integer,
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

  return jsonb_build_object(
    'collections', v_collection_count,
    'sections', v_section_count
  );
end;
$$;

revoke all on function public.hai_import_textbook_payload(jsonb) from public, anon, authenticated;
grant execute on function public.hai_import_textbook_payload(jsonb) to service_role;

commit;
