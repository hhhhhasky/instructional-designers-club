begin;

-- Enforce the same textbook payload contract at the database boundary as the
-- local generators/import scripts. Existing rows remain untouched; future
-- imports must be generated as hai-textbook-v2 payloads.
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
  v_invalid_count integer;
begin
  if coalesce(p_payload->>'schema_version', '') <> 'hai-textbook-v2' then
    raise exception 'Textbook payload schema_version must be hai-textbook-v2';
  end if;
  if v_collection_count < 1 or v_section_count < 1 then
    raise exception 'Textbook import payload must contain collections and sections';
  end if;
  if jsonb_typeof(p_payload->'links') <> 'array' then
    raise exception 'Textbook import payload must contain a links array';
  end if;

  select count(*) into v_invalid_count
  from (
    select item->>'slug' as slug
    from jsonb_array_elements(p_payload->'collections') item
    group by item->>'slug'
    having count(*) > 1
  ) duplicate_collections;
  if v_invalid_count > 0 then raise exception 'Textbook payload contains duplicate collection slugs'; end if;

  select count(*) into v_invalid_count
  from (
    select item->>'section_key' as section_key
    from jsonb_array_elements(p_payload->'sections') item
    group by item->>'section_key'
    having count(*) > 1
  ) duplicate_sections;
  if v_invalid_count > 0 then raise exception 'Textbook payload contains duplicate section keys'; end if;

  if exists (
    select 1
    from jsonb_array_elements(p_payload->'sections') item
    where coalesce(item->>'section_level', '') not in ('unit', 'lesson', 'frame')
      or nullif(trim(item->>'section_key'), '') is null
      or nullif(trim(item->>'collection_slug'), '') is null
      or nullif(trim(item->>'unit_label'), '') is null
      or nullif(trim(item->>'unit_title'), '') is null
      or nullif(trim(item->>'section_path'), '') is null
      or nullif(trim(item->>'content_markdown'), '') is null
      or nullif(trim(item->>'content_text'), '') is null
      or (item->>'section_level' = 'unit' and (
        coalesce((item->>'lesson_number')::integer, -1) <> 0
        or coalesce((item->>'frame_number')::integer, -1) <> 0
        or coalesce(item->>'lesson_label', '') <> ''
        or coalesce(item->>'lesson_title', '') <> ''
        or coalesce(item->>'frame_label', '') <> ''
        or coalesce(item->>'frame_title', '') <> ''
      ))
      or (item->>'section_level' = 'lesson' and (
        coalesce((item->>'lesson_number')::integer, 0) <= 0
        or coalesce((item->>'frame_number')::integer, -1) <> 0
        or nullif(trim(item->>'lesson_label'), '') is null
        or nullif(trim(item->>'lesson_title'), '') is null
        or coalesce(item->>'frame_label', '') <> ''
        or coalesce(item->>'frame_title', '') <> ''
      ))
      or (item->>'section_level' = 'frame' and (
        coalesce((item->>'lesson_number')::integer, 0) <= 0
        or coalesce((item->>'frame_number')::integer, 0) <= 0
        or nullif(trim(item->>'lesson_label'), '') is null
        or nullif(trim(item->>'lesson_title'), '') is null
        or nullif(trim(item->>'frame_label'), '') is null
        or nullif(trim(item->>'frame_title'), '') is null
      ))
  ) then
    raise exception 'Textbook payload contains an invalid section shape';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_payload->'sections') section
    where not exists (
      select 1 from jsonb_array_elements(p_payload->'collections') collection
      where collection->>'slug' = section->>'collection_slug'
    )
  ) then
    raise exception 'Textbook section references an unknown collection';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_payload->'links') link
    where coalesce(link->>'relation_type', '') not in ('unit_to_lesson', 'lesson_to_unit', 'lesson_to_frame', 'frame_to_lesson')
      or not exists (select 1 from jsonb_array_elements(p_payload->'sections') section where section->>'section_key' = link->>'section_key')
      or not exists (select 1 from jsonb_array_elements(p_payload->'sections') section where section->>'section_key' = link->>'linked_section_key')
  ) then
    raise exception 'Textbook payload contains an invalid link';
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
          and (child->>'section_level' = 'unit' or parent->>'lesson_number' = child->>'lesson_number')
      )
  ) then
    raise exception 'Textbook payload is missing a parent section';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_payload->'sections') child
    where child->>'section_level' <> 'unit'
      and (
        not exists (
          select 1 from jsonb_array_elements(p_payload->'links') link
          where link->>'section_key' = case when child->>'section_level' = 'lesson'
            then (select parent->>'section_key' from jsonb_array_elements(p_payload->'sections') parent where parent->>'collection_slug' = child->>'collection_slug' and parent->>'unit_number' = child->>'unit_number' and parent->>'section_level' = 'unit' limit 1)
            else (select parent->>'section_key' from jsonb_array_elements(p_payload->'sections') parent where parent->>'collection_slug' = child->>'collection_slug' and parent->>'unit_number' = child->>'unit_number' and parent->>'lesson_number' = child->>'lesson_number' and parent->>'section_level' = 'lesson' limit 1)
            end
            and link->>'linked_section_key' = child->>'section_key'
            and link->>'relation_type' = case when child->>'section_level' = 'lesson' then 'unit_to_lesson' else 'lesson_to_frame' end
        )
        or not exists (
          select 1 from jsonb_array_elements(p_payload->'links') link
          where link->>'section_key' = child->>'section_key'
            and link->>'linked_section_key' = case when child->>'section_level' = 'lesson'
              then (select parent->>'section_key' from jsonb_array_elements(p_payload->'sections') parent where parent->>'collection_slug' = child->>'collection_slug' and parent->>'unit_number' = child->>'unit_number' and parent->>'section_level' = 'unit' limit 1)
              else (select parent->>'section_key' from jsonb_array_elements(p_payload->'sections') parent where parent->>'collection_slug' = child->>'collection_slug' and parent->>'unit_number' = child->>'unit_number' and parent->>'lesson_number' = child->>'lesson_number' and parent->>'section_level' = 'lesson' limit 1)
              end
            and link->>'relation_type' = case when child->>'section_level' = 'lesson' then 'lesson_to_unit' else 'frame_to_lesson' end
        )
      )
  ) then
    raise exception 'Textbook payload is missing a bidirectional parent link';
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
    collection.id, item.section_key, item.section_level, item.unit_number, item.unit_label, item.unit_title,
    item.lesson_number, item.lesson_label, item.lesson_title, item.frame_number, item.frame_label,
    item.frame_title, item.section_path, item.content_type, item.content_markdown, item.content_text,
    item.knowledge_point_count, item.char_count, item.sort_order, item.content_hash,
    item.verification_status, item.metadata, true
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

  return jsonb_build_object('collections', v_collection_count, 'sections', v_section_count, 'links', v_link_count);
end;
$$;

revoke all on function public.hai_import_textbook_payload(jsonb) from public, anon, authenticated;
grant execute on function public.hai_import_textbook_payload(jsonb) to service_role;

commit;
