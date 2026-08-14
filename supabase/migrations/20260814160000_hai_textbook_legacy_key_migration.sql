begin;

-- Normalize the 107 legacy-v2 textbook rows into the V3-lite naming contract.
-- The row UUIDs remain unchanged. Old identifiers are retained in metadata so
-- historical task inputs can still be resolved by the route RPC.

create temporary table _hai_textbook_legacy_slug_map (
  collection_id uuid primary key,
  old_slug text not null unique,
  new_slug text not null unique
) on commit drop;

insert into _hai_textbook_legacy_slug_map (collection_id, old_slug, new_slug)
select
  c.id,
  c.slug,
  concat_ws('-',
    case c.stage
      when '小学' then 'primary'
      when '初中' then 'junior'
      when '高中' then 'senior'
      else 'stage'
    end,
    case c.subject
      when '数学' then 'math'
      when '语文' then 'chinese'
      when '英语' then 'english'
      when '科学' then 'science'
      when '道德与法治' then 'politics'
      when '思想政治' then 'politics'
      when '历史' then 'history'
      when '地理' then 'geography'
      when '生物' then 'biology'
      when '物理' then 'physics'
      when '化学' then 'chemistry'
      else 'subject'
    end,
    case
      when c.edition_family in ('统编版', '统编版道德与法治', '统编版普通高中思想政治') then 'tb'
      when c.edition_family = '人教鄂教版' then 'pep-ej'
      when c.edition_family in ('人教版', '人教版/PEP') then 'pep'
      else 'legacy'
    end,
    coalesce(c.edition_year::text, 'legacy'),
    concat('g', lpad(c.grade_level::text, 2, '0')),
    case
      when c.subject = '思想政治' and c.volume like '选择性必修%'
        then concat('v', 4 + substring(c.volume from '[0-9]+')::integer)
      when c.subject = '思想政治' and c.volume like '必修%'
        then concat('v', substring(c.volume from '[0-9]+'))
      when c.volume = '上册' then 'v1'
      when c.volume = '下册' then 'v2'
      when c.volume = '全一册' then 'vfull'
      else concat('v', coalesce(nullif(substring(c.slug from '-([0-9]+)(?:_|-|$)'), ''), '1'))
    end
  )
from public.hai_textbook_collections c
where c.structure_profile = 'legacy-v2';

do $$
begin
  if (select count(*) from _hai_textbook_legacy_slug_map) <> 107 then
    raise exception 'Expected 107 legacy-v2 textbook collections, found %',
      (select count(*) from _hai_textbook_legacy_slug_map);
  end if;

  if exists (
    select 1
    from _hai_textbook_legacy_slug_map map
    join public.hai_textbook_collections existing on existing.slug = map.new_slug
    where existing.id <> map.collection_id
  ) then
    raise exception 'Legacy textbook slug migration conflicts with an existing slug';
  end if;

  if exists (
    select 1
    from _hai_textbook_legacy_slug_map
    group by new_slug
    having count(*) > 1
  ) then
    raise exception 'Legacy textbook slug migration generated duplicate slugs';
  end if;
end;
$$;

create temporary table _hai_textbook_legacy_section_key_map (
  section_id uuid primary key,
  old_section_key text not null unique,
  new_section_key text not null unique
) on commit drop;

insert into _hai_textbook_legacy_section_key_map (section_id, old_section_key, new_section_key)
select
  section.id,
  section.section_key,
  concat(
    slug_map.new_slug,
    '::u', lpad(section.unit_number::text, 2, '0'),
    case section.section_level
      when 'unit' then ''
      when 'lesson' then concat('::l', lpad(section.lesson_number::text, 2, '0'))
      when 'frame' then concat(
        '::l', lpad(section.lesson_number::text, 2, '0'),
        '::f', lpad(section.frame_number::text, 2, '0')
      )
      else ''
    end
  )
from public.hai_textbook_sections section
join _hai_textbook_legacy_slug_map slug_map on slug_map.collection_id = section.collection_id;

do $$
begin
  if exists (
    select 1
    from _hai_textbook_legacy_section_key_map
    where new_section_key !~ '^[a-z0-9]+(-[a-z0-9]+)*::u[0-9]{2}(::l[0-9]{2}(::f[0-9]{2})?)?$'
  ) then
    raise exception 'Legacy textbook section-key migration generated an invalid key';
  end if;

  if exists (
    select 1
    from _hai_textbook_legacy_section_key_map map
    join public.hai_textbook_sections existing on existing.section_key = map.new_section_key
    where existing.id <> map.section_id
  ) then
    raise exception 'Legacy textbook section-key migration conflicts with an existing key';
  end if;
end;
$$;

-- Move both unique identifiers out of the way before assigning their final
-- values. This keeps the migration safe under the existing unique indexes.
update public.hai_textbook_sections section
set section_key = concat('__legacy_section_migration__-', replace(section.id::text, '-', '')),
    updated_at = now()
where exists (
  select 1 from _hai_textbook_legacy_section_key_map map
  where map.section_id = section.id
);

update public.hai_textbook_collections collection
set slug = concat('__legacy_collection_migration__-', replace(collection.id::text, '-', '')),
    updated_at = now()
where exists (
  select 1 from _hai_textbook_legacy_slug_map map
  where map.collection_id = collection.id
);

update public.hai_textbook_collections collection
set slug = slug_map.new_slug,
    metadata = coalesce(collection.metadata, '{}'::jsonb) || jsonb_build_object(
      'legacy_slug', slug_map.old_slug,
      'canonical_naming', 'hai-textbook-v3-lite',
      'canonicalized_at', '2026-08-14'
    ),
    updated_at = now()
from _hai_textbook_legacy_slug_map slug_map
where collection.id = slug_map.collection_id;

update public.hai_textbook_sections section
set section_key = key_map.new_section_key,
    metadata = coalesce(section.metadata, '{}'::jsonb) || jsonb_build_object(
      'legacy_section_key', key_map.old_section_key,
      'canonical_naming', 'hai-textbook-v3-lite',
      'canonicalized_at', '2026-08-14'
    ),
    updated_at = now()
from _hai_textbook_legacy_section_key_map key_map
where section.id = key_map.section_id;

-- From this migration onward, direct table writes cannot introduce mixed
-- Chinese/ASCII identifiers or unpadded route keys.
alter table public.hai_textbook_collections
  drop constraint if exists hai_textbook_collections_slug_ascii_check;
alter table public.hai_textbook_collections
  add constraint hai_textbook_collections_slug_ascii_check
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

alter table public.hai_textbook_sections
  drop constraint if exists hai_textbook_sections_section_key_format_check;
alter table public.hai_textbook_sections
  add constraint hai_textbook_sections_section_key_format_check
  check (section_key ~ '^[a-z0-9]+(-[a-z0-9]+)*::u[0-9]{2}(::l[0-9]{2}(::f[0-9]{2})?)?$');

create or replace function public.hai_validate_textbook_section_key()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_collection_slug text;
  v_expected_key text;
begin
  select slug into v_collection_slug
  from public.hai_textbook_collections
  where id = new.collection_id;

  if v_collection_slug is null then
    raise exception 'Textbook section references an unknown collection: %', new.collection_id;
  end if;

  v_expected_key := concat(
    v_collection_slug,
    '::u', lpad(new.unit_number::text, 2, '0'),
    case new.section_level
      when 'unit' then ''
      when 'lesson' then concat('::l', lpad(new.lesson_number::text, 2, '0'))
      when 'frame' then concat(
        '::l', lpad(new.lesson_number::text, 2, '0'),
        '::f', lpad(new.frame_number::text, 2, '0')
      )
      else ''
    end
  );

  if new.section_key <> v_expected_key then
    raise exception 'Textbook section_key must match its canonical route: expected %, got %',
      v_expected_key, new.section_key;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_hai_textbook_section_key on public.hai_textbook_sections;
create trigger validate_hai_textbook_section_key
  before insert or update of collection_id, section_key, section_level,
    unit_number, lesson_number, frame_number
  on public.hai_textbook_sections
  for each row execute function public.hai_validate_textbook_section_key();

revoke all on function public.hai_validate_textbook_section_key() from public, anon, authenticated;

-- Historical Work inputs may still carry the old collection slug. Resolve it
-- through metadata while always returning the canonical slug to callers.
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
  with resolved_collection as (
    select collection.*
    from public.hai_textbook_collections collection
    where collection.is_active = true
      and (
        collection.slug = trim(p_collection_slug)
        or collection.metadata->>'legacy_slug' = trim(p_collection_slug)
      )
    order by case when collection.slug = trim(p_collection_slug) then 0 else 1 end
    limit 1
  ), selected_lesson as (
    select
      collection.id as collection_id,
      collection.subject,
      lesson.id as lesson_id
    from resolved_collection collection
    join public.hai_textbook_sections lesson
      on lesson.collection_id = collection.id
      and lesson.section_level = 'lesson'
      and lesson.unit_number = p_unit_number
      and lesson.lesson_number = p_lesson_number
      and lesson.is_active = true
  ), selected as (
    select section.id
    from public.hai_textbook_sections section
    join selected_lesson selected on selected.lesson_id = section.id
    where p_frame_number is null
    union
    select section.id
    from public.hai_textbook_sections section
    join selected_lesson selected on selected.collection_id = section.collection_id
    where p_frame_number is not null
      and section.section_level = 'frame'
      and section.unit_number = p_unit_number
      and section.lesson_number = p_lesson_number
      and section.frame_number = p_frame_number
      and section.is_active = true
    union
    select section.id
    from public.hai_textbook_sections section
    join selected_lesson selected on selected.collection_id = section.collection_id
    where selected.subject = '英语'
      and p_frame_number is null
      and section.section_level = 'frame'
      and section.unit_number = p_unit_number
      and section.lesson_number = p_lesson_number
      and section.is_active = true
  ), related_ids as (
    select id from selected
    union
    select unit.id
    from selected_lesson selected
    join public.hai_textbook_sections unit
      on unit.collection_id = selected.collection_id
      and unit.section_level = 'unit'
      and unit.unit_number = p_unit_number
      and unit.is_active = true
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
  join related_ids related on related.id = section.id
  join public.hai_textbook_collections collection on collection.id = section.collection_id
  order by case section.section_level when 'unit' then 0 when 'lesson' then 1 else 2 end,
    section.sort_order;
$$;

revoke all on function public.hai_get_textbook_sections_by_route(text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.hai_get_textbook_sections_by_route(text, integer, integer, integer)
  to service_role;

commit;
