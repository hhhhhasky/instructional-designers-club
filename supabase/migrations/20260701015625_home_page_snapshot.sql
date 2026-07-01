-- ============================================================
-- Home page public snapshot
-- Created: 2026-07-01
--
-- Purpose:
-- Collapse the public home page's many read-only Data API requests into one
-- RPC payload. The function is SECURITY INVOKER and reads only data already
-- visible to anon/authenticated roles through existing RLS policies, except
-- member count which continues to use public.public_member_count().
-- ============================================================

begin;

create or replace function public.home_page_snapshot(
  latest_course_days integer default 60,
  announcement_limit integer default 8,
  latest_course_limit integer default 4,
  activity_limit integer default 20,
  home_course_limit integer default 4
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with
  site_rows as (
    select
      coalesce(jsonb_object_agg(section_key, to_jsonb(site_content)), '{}'::jsonb) as data,
      max(updated_at) as updated_at
    from public.site_content
    where section_key = any(array[
      'hero',
      'introduction',
      'club_values',
      'founder',
      'stats',
      'members',
      'testimonials',
      'faq'
    ])
  ),
  member_rows as (
    select
      coalesce(jsonb_agg(to_jsonb(member_profiles) order by sort_order asc), '[]'::jsonb) as data,
      max(updated_at) as updated_at
    from public.member_profiles
    where is_active = true
  ),
  testimonial_rows as (
    select
      coalesce(jsonb_agg(to_jsonb(testimonials) order by sort_order asc), '[]'::jsonb) as data,
      max(updated_at) as updated_at
    from public.testimonials
    where is_active = true
  ),
  faq_rows as (
    select
      coalesce(jsonb_agg(to_jsonb(faqs) order by sort_order asc), '[]'::jsonb) as data,
      max(updated_at) as updated_at
    from public.faqs
    where is_active = true
  ),
  course_base as (
    select
      id,
      title,
      description,
      category,
      image_url,
      membership_type,
      is_trial,
      duration,
      status,
      created_at,
      updated_at,
      sort_order
    from public.courses
    where status = 'published'
  ),
  course_stats as (
    select
      count(*)::integer as course_count,
      coalesce(sum(duration), 0)::integer as total_minutes,
      max(updated_at) as updated_at
    from course_base
  ),
  category_stats as (
    select
      count(*)::integer as camp_count,
      max(updated_at) as updated_at
    from public.course_categories
    where is_active = true
  ),
  latest_courses as (
    select
      coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.created_at desc), '[]'::jsonb) as data
    from (
      select *
      from course_base
      where created_at >= now() - make_interval(days => greatest(latest_course_days, 0))
      order by created_at desc nulls last
      limit latest_course_limit
    ) row_data
  ),
  free_courses as (
    select
      coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.sort_order asc nulls last), '[]'::jsonb) as data
    from (
      select *
      from course_base
      where membership_type = 'free' or is_trial = true
      order by sort_order asc nulls last
      limit home_course_limit
    ) row_data
  ),
  plus_courses as (
    select
      coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.sort_order asc nulls last), '[]'::jsonb) as data
    from (
      select *
      from course_base
      where membership_type = 'plus'
      order by sort_order asc nulls last
      limit home_course_limit
    ) row_data
  ),
  pro_courses as (
    select
      coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.sort_order asc nulls last), '[]'::jsonb) as data
    from (
      select *
      from course_base
      where membership_type = 'pro'
      order by sort_order asc nulls last
      limit home_course_limit
    ) row_data
  ),
  announcement_rows as (
    select
      coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.is_pinned desc, row_data.published_at desc), '[]'::jsonb) as data,
      max(row_data.updated_at) as updated_at
    from (
      select *
      from public.announcements
      where is_active = true
        and (expires_at is null or expires_at > now())
      order by is_pinned desc, published_at desc
      limit announcement_limit
    ) row_data
  ),
  activity_rows as (
    select
      coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.start_time asc nulls last, row_data.sort_order asc), '[]'::jsonb) as data,
      max(row_data.updated_at) as updated_at
    from (
      select *
      from public.activities
      where is_active = true
      order by start_time asc nulls last, sort_order asc
      limit activity_limit
    ) row_data
  ),
  stats_override as (
    select (site_rows.data -> 'stats' -> 'data' ->> 'member_count')::integer as member_count
    from site_rows
    where jsonb_typeof(site_rows.data -> 'stats' -> 'data' -> 'member_count') = 'number'
  )
select jsonb_build_object(
  'site_content', site_rows.data,
  'member_profiles', member_rows.data,
  'testimonials', testimonial_rows.data,
  'faqs', faq_rows.data,
  'announcements', announcement_rows.data,
  'latest_courses', latest_courses.data,
  'activities', activity_rows.data,
  'home_courses', jsonb_build_object(
    'free', free_courses.data,
    'plus', plus_courses.data,
    'pro', pro_courses.data
  ),
  'stats_counts', jsonb_build_object(
    'camps', coalesce(category_stats.camp_count, 0),
    'courses', coalesce(course_stats.course_count, 0),
    'totalMinutes', coalesce(course_stats.total_minutes, 0),
    'members', coalesce((select member_count from stats_override), public.public_member_count(), 0)
  ),
  'generated_at', now(),
  'source_updated_at', greatest(
    coalesce(site_rows.updated_at, 'epoch'::timestamptz),
    coalesce(member_rows.updated_at, 'epoch'::timestamptz),
    coalesce(testimonial_rows.updated_at, 'epoch'::timestamptz),
    coalesce(faq_rows.updated_at, 'epoch'::timestamptz),
    coalesce(course_stats.updated_at, 'epoch'::timestamptz),
    coalesce(category_stats.updated_at, 'epoch'::timestamptz),
    coalesce(announcement_rows.updated_at, 'epoch'::timestamptz),
    coalesce(activity_rows.updated_at, 'epoch'::timestamptz)
  )
)
from site_rows
cross join member_rows
cross join testimonial_rows
cross join faq_rows
cross join course_stats
cross join category_stats
cross join latest_courses
cross join free_courses
cross join plus_courses
cross join pro_courses
cross join announcement_rows
cross join activity_rows;
$$;

comment on function public.home_page_snapshot(integer, integer, integer, integer, integer)
  is 'Public read-only homepage snapshot used to collapse first-screen Supabase requests.';

revoke execute on function public.home_page_snapshot(integer, integer, integer, integer, integer) from public;
grant execute on function public.home_page_snapshot(integer, integer, integer, integer, integer) to anon, authenticated;

commit;
