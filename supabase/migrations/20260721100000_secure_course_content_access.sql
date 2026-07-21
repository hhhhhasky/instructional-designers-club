-- Enforce course-content authorization at the database/API boundary.
-- Public clients may read published course metadata only. Protected content
-- and attachment URLs are returned exclusively by the course-content Edge Function.

begin;

-- Public format flags preserve catalog badges without exposing content URLs/text.
alter table public.courses
  add column if not exists has_video boolean generated always as (video_url is not null and btrim(video_url) <> '') stored,
  add column if not exists has_audio boolean generated always as (audio_url is not null and btrim(audio_url) <> '') stored,
  add column if not exists has_body boolean generated always as (body is not null and btrim(body) <> '') stored,
  add column if not exists has_essence boolean generated always as (essence is not null and btrim(essence) <> '') stored,
  add column if not exists has_images boolean generated always as (coalesce(cardinality(images), 0) > 0) stored,
  add column if not exists has_meeting boolean generated always as (meeting_url is not null and btrim(meeting_url) <> '') stored;

comment on column public.courses.has_video is 'Public content-format flag; does not expose the protected video URL.';
comment on column public.courses.has_audio is 'Public content-format flag; does not expose the protected audio URL.';
comment on column public.courses.has_body is 'Public content-format flag; does not expose protected Markdown.';
comment on column public.courses.has_essence is 'Public content-format flag; does not expose protected course essence.';
comment on column public.courses.has_images is 'Public content-format flag; does not expose protected image URLs.';
comment on column public.courses.has_meeting is 'Public content-format flag; does not expose the protected meeting URL.';

-- Canonical metadata serializer. Protected fields remain present as null so the
-- frontend can use one Course shape without receiving their underlying values.
create or replace function private.course_metadata_json(p_course public.courses)
returns jsonb
language sql
immutable
security definer
set search_path = public, private
as $$
  select jsonb_build_object(
    'id', p_course.id,
    'title', p_course.title,
    'description', p_course.description,
    'instructor', p_course.instructor,
    'category_id', p_course.category_id,
    'category', p_course.category,
    'level', p_course.level,
    'duration', p_course.duration,
    'credits', p_course.credits,
    'status', p_course.status,
    'membership_type', p_course.membership_type,
    'is_trial', p_course.is_trial,
    'password_access_enabled', p_course.password_access_enabled,
    'image_url', p_course.image_url,
    'video_url', null,
    'audio_url', null,
    'body', null,
    'essence', null,
    'images', '[]'::jsonb,
    'meeting_url', null,
    'plus_lesson_order', p_course.plus_lesson_order,
    'plus_representative', p_course.plus_representative,
    'sort_order', p_course.sort_order,
    'view_count', p_course.view_count,
    'created_at', p_course.created_at,
    'updated_at', p_course.updated_at,
    'has_video', p_course.has_video,
    'has_audio', p_course.has_audio,
    'has_body', p_course.has_body,
    'has_essence', p_course.has_essence,
    'has_images', p_course.has_images,
    'has_meeting', p_course.has_meeting
  );
$$;

revoke execute on function private.course_metadata_json(public.courses) from public, anon, authenticated;

-- Server-side entitlement check used by course content, learning and Q&A paths.
create or replace function public.can_access_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(public.is_admin(), false)
    or exists (
      select 1
      from public.courses c
      where c.id = p_course_id
        and c.status = 'published'
        and (
          c.membership_type = 'free'
          or c.is_trial = true
          or exists (
            select 1
            from public.profiles p
            where p.id = (select auth.uid())
              and p.status = 'active'
              and (
                case p.access_level
                  when 'free' then 0
                  when 'plus' then 1
                  when 'pro' then 2
                end
              ) >= (
                case c.membership_type
                  when 'free' then 0
                  when 'plus' then 1
                  when 'pro' then 2
                end
              )
          )
        )
    );
$$;

comment on function public.can_access_course(uuid) is
  'Server-side course entitlement check for admins, free/trial courses, and active member hierarchy.';

revoke execute on function public.can_access_course(uuid) from public, anon;
grant execute on function public.can_access_course(uuid) to authenticated, service_role;

-- Replace the permissive row policy. Published rows remain queryable only
-- through the explicitly granted metadata columns below; admins may also see
-- non-published metadata while full rows remain available via admin RPCs.
drop policy if exists "Allow public read courses" on public.courses;
drop policy if exists "Published course metadata is readable" on public.courses;
drop policy if exists "Admin can select all courses" on public.courses;

create policy "Published course metadata is readable"
  on public.courses for select
  to anon, authenticated
  using (status = 'published');

create policy "Admin can select all courses"
  on public.courses for select
  to authenticated
  using ((select public.is_admin()));

revoke select on public.courses from public, anon, authenticated;
grant select (
  id,
  title,
  description,
  instructor,
  category_id,
  category,
  level,
  duration,
  credits,
  status,
  membership_type,
  is_trial,
  password_access_enabled,
  image_url,
  plus_lesson_order,
  plus_representative,
  sort_order,
  view_count,
  created_at,
  updated_at,
  has_video,
  has_audio,
  has_body,
  has_essence,
  has_images,
  has_meeting
) on public.courses to anon, authenticated;

-- Public course catalogs contain metadata and format flags only.
create or replace function public.course_catalog_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public, private
as $$
with
  course_rows as (
    select c.*, private.course_metadata_json(c) as metadata
    from public.courses c
    where c.status = 'published'
  ),
  plus_course_rows as (
    select coalesce(jsonb_agg(metadata order by sort_order asc nulls last), '[]'::jsonb) as data,
           max(updated_at) as updated_at
    from course_rows
    where membership_type = 'plus'
  ),
  plus_track_rows as (
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.sort_order asc, row_data.id asc), '[]'::jsonb) as data,
           max(row_data.updated_at) as updated_at
    from (
      select * from public.plus_course_tracks
      where is_active = true
    ) row_data
  ),
  plus_module_rows as (
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.track_id asc, row_data.sort_order asc, row_data.id asc), '[]'::jsonb) as data,
           max(row_data.updated_at) as updated_at
    from (
      select * from public.plus_course_modules
      where is_active = true
    ) row_data
  ),
  plus_category_rows as (
    select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.plus_track_id asc, row_data.sort_order asc, row_data.name asc), '[]'::jsonb) as data,
           max(row_data.updated_at) as updated_at
    from (
      select * from public.course_categories
      where is_active = true and plus_track_id is not null
    ) row_data
  ),
  pro_course_rows as (
    select coalesce(jsonb_agg(metadata order by sort_order asc nulls last), '[]'::jsonb) as data,
           max(updated_at) as updated_at
    from course_rows
    where membership_type = 'pro'
  ),
  pro_category_rows as (
    select coalesce(jsonb_agg(to_jsonb(cc) order by cc.sort_order asc, cc.name asc), '[]'::jsonb) as data,
           max(cc.updated_at) as updated_at
    from public.course_categories cc
    where cc.is_active = true
      and exists (
        select 1 from course_rows c
        where c.membership_type = 'pro' and c.category = cc.name
      )
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

comment on function public.course_catalog_snapshot() is
  'Public Plus/Pro catalog containing metadata and content-format flags only.';

revoke execute on function public.course_catalog_snapshot() from public;
grant execute on function public.course_catalog_snapshot() to anon, authenticated;

-- Course detail snapshot is metadata-only. Full content is deliberately absent
-- even for members so it cannot leak through a cached public RPC response.
create or replace function public.course_detail_snapshot(p_course_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, private
as $$
with
  course_row as (
    select c.*, private.course_metadata_json(c) as metadata
    from public.courses c
    where c.id = p_course_id and c.status = 'published'
    limit 1
  ),
  catalog as (
    select public.course_catalog_snapshot() as data
  ),
  sibling_rows as (
    select coalesce(jsonb_agg(private.course_metadata_json(s) order by s.sort_order asc nulls last), '[]'::jsonb) as data,
           max(s.updated_at) as updated_at
    from public.courses s
    join course_row c on c.membership_type = 'free'
    where s.status = 'published'
      and s.membership_type = 'free'
      and c.category is not null
      and s.category = c.category
  )
select case
  when not exists (select 1 from course_row) then
    jsonb_build_object(
      'course', null,
      'sibling_courses', '[]'::jsonb,
      'generated_at', now(),
      'source_updated_at', null
    )
  when (select membership_type from course_row) in ('plus', 'pro') then
    (select data from catalog) || jsonb_build_object(
      'course', (select metadata from course_row),
      'sibling_courses', '[]'::jsonb
    )
  else
    jsonb_build_object(
      'course', (select metadata from course_row),
      'sibling_courses', sibling_rows.data,
      'generated_at', now(),
      'source_updated_at', greatest(
        coalesce((select updated_at from course_row), 'epoch'::timestamptz),
        coalesce(sibling_rows.updated_at, 'epoch'::timestamptz)
      )
    )
end
from sibling_rows;
$$;

comment on function public.course_detail_snapshot(uuid) is
  'Public metadata-only course detail snapshot. Protected content is served by the course-content Edge Function.';

revoke execute on function public.course_detail_snapshot(uuid) from public;
grant execute on function public.course_detail_snapshot(uuid) to anon, authenticated;

-- Admin-only full-row readers support maintenance without restoring direct
-- protected-column grants to every authenticated account.
create or replace function public.admin_course_detail(p_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Permission denied: admin only';
  end if;

  select to_jsonb(c) into v_result
  from public.courses c
  where c.id = p_course_id;

  return v_result;
end;
$$;

create or replace function public.admin_course_attachments(p_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Permission denied: admin only';
  end if;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.sort_order asc, a.created_at asc), '[]'::jsonb)
  into v_result
  from public.course_attachments a
  where a.course_id = p_course_id;

  return v_result;
end;
$$;

revoke execute on function public.admin_course_detail(uuid) from public, anon;
revoke execute on function public.admin_course_attachments(uuid) from public, anon;
grant execute on function public.admin_course_detail(uuid) to authenticated;
grant execute on function public.admin_course_attachments(uuid) to authenticated;

-- Attachment rows and their permanent R2 URLs are no longer directly readable.
drop policy if exists "Published course attachments are readable" on public.course_attachments;
revoke select on public.course_attachments from public, anon, authenticated;

-- Password verification is now internal to the Edge Function. Removing its
-- public grant prevents bypassing the rate limiter below.
revoke execute on function public.verify_course_access_password(uuid, text) from public, anon, authenticated;
grant execute on function public.verify_course_access_password(uuid, text) to service_role;

create table if not exists private.course_password_attempts (
  course_id uuid not null references public.courses(id) on delete cascade,
  identifier_hash text not null,
  window_started_at timestamptz not null default now(),
  failed_attempts integer not null default 0,
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (course_id, identifier_hash)
);

revoke all on table private.course_password_attempts from public, anon, authenticated;

create or replace function public.course_password_attempt_status(
  p_course_id uuid,
  p_identifier text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_hash text := encode(extensions.digest(coalesce(p_identifier, ''), 'sha256'), 'hex');
  v_blocked_until timestamptz;
begin
  select blocked_until into v_blocked_until
  from private.course_password_attempts
  where course_id = p_course_id and identifier_hash = v_hash;

  return jsonb_build_object(
    'allowed', v_blocked_until is null or v_blocked_until <= now(),
    'retry_after_seconds', case
      when v_blocked_until is not null and v_blocked_until > now()
        then greatest(1, ceil(extract(epoch from (v_blocked_until - now())))::integer)
      else 0
    end
  );
end;
$$;

create or replace function public.record_course_password_attempt(
  p_course_id uuid,
  p_identifier text,
  p_success boolean
)
returns void
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_hash text := encode(extensions.digest(coalesce(p_identifier, ''), 'sha256'), 'hex');
  v_attempts integer;
  v_window_started_at timestamptz;
begin
  if p_success then
    delete from private.course_password_attempts
    where course_id = p_course_id and identifier_hash = v_hash;
    return;
  end if;

  select failed_attempts, window_started_at
  into v_attempts, v_window_started_at
  from private.course_password_attempts
  where course_id = p_course_id and identifier_hash = v_hash
  for update;

  if not found or v_window_started_at < now() - interval '15 minutes' then
    insert into private.course_password_attempts (
      course_id, identifier_hash, window_started_at, failed_attempts, blocked_until, updated_at
    ) values (
      p_course_id, v_hash, now(), 1, null, now()
    )
    on conflict (course_id, identifier_hash) do update
    set window_started_at = excluded.window_started_at,
        failed_attempts = 1,
        blocked_until = null,
        updated_at = now();
    return;
  end if;

  v_attempts := v_attempts + 1;
  update private.course_password_attempts
  set failed_attempts = v_attempts,
      blocked_until = case when v_attempts >= 10 then now() + interval '15 minutes' else blocked_until end,
      updated_at = now()
  where course_id = p_course_id and identifier_hash = v_hash;
end;
$$;

revoke execute on function public.course_password_attempt_status(uuid, text) from public, anon, authenticated;
revoke execute on function public.record_course_password_attempt(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.course_password_attempt_status(uuid, text) to service_role;
grant execute on function public.record_course_password_attempt(uuid, text, boolean) to service_role;

commit;
