create table public.daofa_lesson_media (
  lesson_id text primary key,
  storage_key text not null unique,
  media_type text not null check (media_type in ('video', 'canvas')),
  is_active boolean not null default true
);

alter table public.daofa_lesson_media enable row level security;
revoke all on public.daofa_lesson_media from public, anon, authenticated;
grant select on public.daofa_lesson_media to authenticated;

create policy "daofa media visible to entitled active users"
  on public.daofa_lesson_media
  for select to authenticated
  using (
    is_active
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.status = 'active'
        and (
          p.role = 'admin'
          or exists (
            select 1 from public.membership_course_access m
            where m.access_level = p.access_level
              and m.product_code = 'daofa-textbook'
          )
          or exists (
            select 1 from public.user_course_entitlements e
            where e.user_id = p.id
              and e.product_code = 'daofa-textbook'
              and e.status = 'active'
              and e.starts_at <= now()
              and (e.expires_at is null or e.expires_at > now())
          )
        )
    )
  );

insert into public.daofa_lesson_media (lesson_id, storage_key, media_type) values
  ('introduction', 'daofa-textbook/overview/00-introduction.mp4', 'video'),
  ('standard-to-unit', 'daofa-textbook/overview/01-standard-to-unit.mp4', 'video'),
  ('unit-to-lesson', 'daofa-textbook/overview/02-unit-to-lesson.mp4', 'video'),
  ('alignment-canvas-guide', 'daofa-textbook/overview/03-alignment-canvas-guide.mp4', 'video'),
  ('alignment-canvas', 'daofa-textbook/canvas/alignment-canvas-2026-autumn.html', 'canvas');
