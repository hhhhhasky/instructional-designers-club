-- ============================================================
-- Course cache snapshots and visit upsert
-- Created: 2026-07-01
--
-- These functions reduce public course-directory/detail request fan-out while
-- preserving existing RLS boundaries. Snapshot functions are SECURITY INVOKER.
-- ============================================================

begin;

create or replace function public.course_catalog_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with
  course_summary as (
    select
      id,
      title,
      description,
      body,
      essence,
      instructor,
      category_id,
      category,
      level,
      duration,
      credits,
      status,
      membership_type,
      is_trial,
      image_url,
      video_url,
      audio_url,
      images,
      plus_lesson_order,
      plus_representative,
      meeting_url,
      sort_order,
      view_count,
      created_at,
      updated_at
    from public.courses
    where status = 'published'
  ),
  plus_course_rows as (
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.sort_order asc nulls last), '[]'::jsonb) as data,
           max(row_data.updated_at) as updated_at
    from (
      select * from course_summary
      where membership_type = 'plus'
      order by sort_order asc nulls last
    ) row_data
  ),
  plus_track_rows as (
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.sort_order asc, row_data.id asc), '[]'::jsonb) as data,
           max(row_data.updated_at) as updated_at
    from (
      select *
      from public.plus_course_tracks
      where is_active = true
      order by sort_order asc, id asc
    ) row_data
  ),
  plus_module_rows as (
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.track_id asc, row_data.sort_order asc, row_data.id asc), '[]'::jsonb) as data,
           max(row_data.updated_at) as updated_at
    from (
      select *
      from public.plus_course_modules
      where is_active = true
      order by track_id asc, sort_order asc, id asc
    ) row_data
  ),
  plus_category_rows as (
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.plus_track_id asc, row_data.sort_order asc, row_data.name asc), '[]'::jsonb) as data,
           max(row_data.updated_at) as updated_at
    from (
      select *
      from public.course_categories
      where is_active = true
        and plus_track_id is not null
      order by plus_track_id asc, sort_order asc, name asc
    ) row_data
  ),
  pro_course_rows as (
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.sort_order asc nulls last), '[]'::jsonb) as data,
           max(row_data.updated_at) as updated_at
    from (
      select * from course_summary
      where membership_type = 'pro'
      order by sort_order asc nulls last
    ) row_data
  ),
  pro_category_rows as (
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.sort_order asc, row_data.name asc), '[]'::jsonb) as data,
           max(row_data.updated_at) as updated_at
    from (
      select cc.*
      from public.course_categories cc
      where cc.is_active = true
        and exists (
          select 1
          from course_summary c
          where c.membership_type = 'pro'
            and c.category = cc.name
        )
      order by cc.sort_order asc, cc.name asc
    ) row_data
  )
select jsonb_build_object(
  'plus_courses', plus_course_rows.data,
  'plus_track_rows', plus_track_rows.data,
  'plus_module_rows', plus_module_rows.data,
  'plus_category_rows', plus_category_rows.data,
  'pro_courses', pro_course_rows.data,
  'pro_category_rows', pro_category_rows.data,
  'generated_at', now(),
  'source_updated_at', greatest(
    coalesce(plus_course_rows.updated_at, 'epoch'::timestamptz),
    coalesce(plus_track_rows.updated_at, 'epoch'::timestamptz),
    coalesce(plus_module_rows.updated_at, 'epoch'::timestamptz),
    coalesce(plus_category_rows.updated_at, 'epoch'::timestamptz),
    coalesce(pro_course_rows.updated_at, 'epoch'::timestamptz),
    coalesce(pro_category_rows.updated_at, 'epoch'::timestamptz)
  )
)
from plus_course_rows
cross join plus_track_rows
cross join plus_module_rows
cross join plus_category_rows
cross join pro_course_rows
cross join pro_category_rows;
$$;

comment on function public.course_catalog_snapshot()
  is 'Public read-only Plus/Pro course catalog snapshot for fast course-list rendering.';

revoke execute on function public.course_catalog_snapshot() from public;
grant execute on function public.course_catalog_snapshot() to anon, authenticated;

create or replace function public.course_detail_snapshot(p_course_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with
  course_row as (
    select *
    from public.courses
    where id = p_course_id
      and status = 'published'
    limit 1
  ),
  course_summary as (
    select
      id,
      title,
      description,
      body,
      essence,
      instructor,
      category_id,
      category,
      level,
      duration,
      credits,
      status,
      membership_type,
      is_trial,
      image_url,
      video_url,
      audio_url,
      images,
      plus_lesson_order,
      plus_representative,
      meeting_url,
      sort_order,
      view_count,
      created_at,
      updated_at
    from public.courses
    where status = 'published'
  ),
  plus_course_rows as (
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.sort_order asc nulls last), '[]'::jsonb) as data,
           max(row_data.updated_at) as updated_at
    from (
      select *
      from course_summary
      where membership_type = 'plus'
        and exists (select 1 from course_row where membership_type = 'plus')
      order by sort_order asc nulls last
    ) row_data
  ),
  plus_track_rows as (
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.sort_order asc, row_data.id asc), '[]'::jsonb) as data,
           max(row_data.updated_at) as updated_at
    from (
      select *
      from public.plus_course_tracks
      where is_active = true
        and exists (select 1 from course_row where membership_type = 'plus')
      order by sort_order asc, id asc
    ) row_data
  ),
  plus_module_rows as (
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.track_id asc, row_data.sort_order asc, row_data.id asc), '[]'::jsonb) as data,
           max(row_data.updated_at) as updated_at
    from (
      select *
      from public.plus_course_modules
      where is_active = true
        and exists (select 1 from course_row where membership_type = 'plus')
      order by track_id asc, sort_order asc, id asc
    ) row_data
  ),
  plus_category_rows as (
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.plus_track_id asc, row_data.sort_order asc, row_data.name asc), '[]'::jsonb) as data,
           max(row_data.updated_at) as updated_at
    from (
      select *
      from public.course_categories
      where is_active = true
        and plus_track_id is not null
        and exists (select 1 from course_row where membership_type = 'plus')
      order by plus_track_id asc, sort_order asc, name asc
    ) row_data
  ),
  pro_course_rows as (
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.sort_order asc nulls last), '[]'::jsonb) as data,
           max(row_data.updated_at) as updated_at
    from (
      select *
      from course_summary
      where membership_type = 'pro'
        and exists (select 1 from course_row where membership_type = 'pro')
      order by sort_order asc nulls last
    ) row_data
  ),
  pro_category_rows as (
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.sort_order asc, row_data.name asc), '[]'::jsonb) as data,
           max(row_data.updated_at) as updated_at
    from (
      select cc.*
      from public.course_categories cc
      where cc.is_active = true
        and exists (select 1 from course_row where membership_type = 'pro')
        and exists (
          select 1
          from course_summary c
          where c.membership_type = 'pro'
            and c.category = cc.name
        )
      order by cc.sort_order asc, cc.name asc
    ) row_data
  ),
  sibling_rows as (
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.sort_order asc nulls last), '[]'::jsonb) as data,
           max(row_data.updated_at) as updated_at
    from (
      select s.*
      from course_summary s
      join course_row c on c.membership_type = s.membership_type
      where c.membership_type = 'free'
        and c.category is not null
        and s.category = c.category
      order by s.sort_order asc nulls last
    ) row_data
  )
select jsonb_build_object(
  'course', (select to_jsonb(c) from course_row c),
  'plus_courses', plus_course_rows.data,
  'plus_track_rows', plus_track_rows.data,
  'plus_module_rows', plus_module_rows.data,
  'plus_category_rows', plus_category_rows.data,
  'pro_courses', pro_course_rows.data,
  'pro_category_rows', pro_category_rows.data,
  'sibling_courses', sibling_rows.data,
  'generated_at', now(),
  'source_updated_at', greatest(
    coalesce((select updated_at from course_row), 'epoch'::timestamptz),
    coalesce(plus_course_rows.updated_at, 'epoch'::timestamptz),
    coalesce(plus_track_rows.updated_at, 'epoch'::timestamptz),
    coalesce(plus_module_rows.updated_at, 'epoch'::timestamptz),
    coalesce(plus_category_rows.updated_at, 'epoch'::timestamptz),
    coalesce(pro_course_rows.updated_at, 'epoch'::timestamptz),
    coalesce(pro_category_rows.updated_at, 'epoch'::timestamptz),
    coalesce(sibling_rows.updated_at, 'epoch'::timestamptz)
  )
)
from plus_course_rows
cross join plus_track_rows
cross join plus_module_rows
cross join plus_category_rows
cross join pro_course_rows
cross join pro_category_rows
cross join sibling_rows;
$$;

comment on function public.course_detail_snapshot(uuid)
  is 'Public read-only course detail snapshot with just the catalog data needed by that course type.';

revoke execute on function public.course_detail_snapshot(uuid) from public;
grant execute on function public.course_detail_snapshot(uuid) to anon, authenticated;

create or replace function public.record_course_visit(p_user_id uuid, p_course_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then
    raise exception 'not allowed';
  end if;

  insert into public.learning_records (
    user_id,
    course_id,
    status,
    watch_count,
    last_watched_at
  )
  values (
    p_user_id,
    p_course_id,
    'in_progress',
    1,
    now()
  )
  on conflict (user_id, course_id) do update
  set
    watch_count = coalesce(public.learning_records.watch_count, 0) + 1,
    last_watched_at = now(),
    updated_at = now();
end;
$$;

comment on function public.record_course_visit(uuid, uuid)
  is 'Authenticated own-user upsert for learning_records course visits.';

revoke execute on function public.record_course_visit(uuid, uuid) from public, anon;
grant execute on function public.record_course_visit(uuid, uuid) to authenticated;

commit;
