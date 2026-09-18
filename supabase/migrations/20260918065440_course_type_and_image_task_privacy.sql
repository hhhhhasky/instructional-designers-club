begin;

-- Image generation is a personal workspace. Admin accounts use the same user
-- surface, so they must not inherit an all-users read path here.
drop policy if exists "hai image tasks owner read"
  on public.hai_image_generation_tasks;
create policy "hai image tasks owner read"
  on public.hai_image_generation_tasks
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "hai image runs owner read"
  on public.hai_image_generation_runs;
create policy "hai image runs owner read"
  on public.hai_image_generation_runs
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Keep course format explicit and editable instead of deriving the catalogue
-- filter forever from the current protected media fields. Existing courses are
-- initialized from their current video flag so the rollout preserves intent.
alter table public.courses
  add column if not exists course_type text;

update public.courses
set course_type = case when has_video then 'video' else 'article' end
where course_type is null;

alter table public.courses
  alter column course_type set default 'article',
  alter column course_type set not null,
  drop constraint if exists courses_course_type_check,
  add constraint courses_course_type_check
    check (course_type in ('article', 'video'));

comment on column public.courses.course_type is
  'Catalogue course format: article (图文) or video (视频).';

-- The public catalogue serializer must expose the non-sensitive format field.
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
    'course_type', p_course.course_type,
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

revoke execute on function private.course_metadata_json(public.courses)
  from public, anon, authenticated;

grant select (course_type) on public.courses to anon, authenticated;

commit;
