-- ============================================================
-- Course questions and replies
-- Created: 2026-06-23
--
-- v1 scope:
-- - Course-detail Q&A only, no forum routes.
-- - Plain text questions and one-level replies.
-- - Anonymous display option.
-- - Preset course-system tags seeded from active course categories.
-- ============================================================

begin;

create table if not exists public.course_question_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tag_type text not null default 'course_system'
    check (tag_type in ('course_system')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.course_question_tags is 'Preset tags for course Q&A. v1 only supports course-system tags.';

create table if not exists public.course_questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  is_anonymous boolean not null default false,
  status text not null default 'visible'
    check (status in ('visible', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.course_questions is 'Course-detail questions posted by authenticated course members.';

create table if not exists public.course_question_replies (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.course_questions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  is_anonymous boolean not null default false,
  status text not null default 'visible'
    check (status in ('visible', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.course_question_replies is 'One-level replies for course questions.';

create table if not exists public.course_question_tag_links (
  question_id uuid not null references public.course_questions(id) on delete cascade,
  tag_id uuid not null references public.course_question_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (question_id, tag_id)
);

create index if not exists idx_course_questions_course_status_created
  on public.course_questions(course_id, status, created_at desc);
create index if not exists idx_course_questions_author
  on public.course_questions(author_id);
create index if not exists idx_course_question_replies_question_status_created
  on public.course_question_replies(question_id, status, created_at asc);
create index if not exists idx_course_question_replies_author
  on public.course_question_replies(author_id);
create index if not exists idx_course_question_tags_active_sort
  on public.course_question_tags(is_active, sort_order, name);

drop trigger if exists update_course_question_tags_updated_at on public.course_question_tags;
create trigger update_course_question_tags_updated_at
  before update on public.course_question_tags
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists update_course_questions_updated_at on public.course_questions;
create trigger update_course_questions_updated_at
  before update on public.course_questions
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists update_course_question_replies_updated_at on public.course_question_replies;
create trigger update_course_question_replies_updated_at
  before update on public.course_question_replies
  for each row
  execute function public.update_updated_at_column();

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
      join public.profiles p on p.id = (select auth.uid())
      where c.id = p_course_id
        and c.status = 'published'
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
    );
$$;

comment on function public.can_access_course(uuid) is 'Returns true when the current authenticated user can access a published course, or is admin.';

create or replace function public.course_questions_feed(p_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.can_access_course(p_course_id) then
    raise exception 'Permission denied: course access required';
  end if;

  select coalesce(jsonb_agg(question_row order by (question_row->>'created_at')::timestamptz desc), '[]'::jsonb)
    into v_result
  from (
    select jsonb_build_object(
      'id', q.id,
      'course_id', q.course_id,
      'author_id', q.author_id,
      'body', q.body,
      'is_anonymous', q.is_anonymous,
      'status', q.status,
      'created_at', q.created_at,
      'updated_at', q.updated_at,
      'author_display_name', case when q.is_anonymous then '匿名' else coalesce(p.nickname, '学员') end,
      'tags', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', t.id,
          'slug', t.slug,
          'name', t.name,
          'tag_type', t.tag_type,
          'sort_order', t.sort_order,
          'is_active', t.is_active
        ) order by t.sort_order, t.name)
        from public.course_question_tag_links qtl
        join public.course_question_tags t on t.id = qtl.tag_id
        where qtl.question_id = q.id
          and t.is_active = true
      ), '[]'::jsonb),
      'replies', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', r.id,
          'question_id', r.question_id,
          'author_id', r.author_id,
          'body', r.body,
          'is_anonymous', r.is_anonymous,
          'status', r.status,
          'created_at', r.created_at,
          'updated_at', r.updated_at,
          'author_display_name', case when r.is_anonymous then '匿名' else coalesce(rp.nickname, '学员') end
        ) order by r.created_at asc)
        from public.course_question_replies r
        left join public.profiles rp on rp.id = r.author_id
        where r.question_id = q.id
          and r.status = 'visible'
      ), '[]'::jsonb)
    ) as question_row
    from public.course_questions q
    left join public.profiles p on p.id = q.author_id
    where q.course_id = p_course_id
      and q.status = 'visible'
  ) rows;

  return v_result;
end;
$$;

comment on function public.course_questions_feed(uuid) is 'Course Q&A feed with privacy-aware display names and visible replies.';

alter table public.course_question_tags enable row level security;
alter table public.course_questions enable row level security;
alter table public.course_question_replies enable row level security;
alter table public.course_question_tag_links enable row level security;

drop policy if exists "course_question_tags select active" on public.course_question_tags;
drop policy if exists "course_question_tags admin all" on public.course_question_tags;
drop policy if exists "course_questions select visible with access" on public.course_questions;
drop policy if exists "course_questions insert own with access" on public.course_questions;
drop policy if exists "course_questions update admin" on public.course_questions;
drop policy if exists "course_questions delete admin" on public.course_questions;
drop policy if exists "course_question_replies select visible with access" on public.course_question_replies;
drop policy if exists "course_question_replies insert own with access" on public.course_question_replies;
drop policy if exists "course_question_replies update admin" on public.course_question_replies;
drop policy if exists "course_question_replies delete admin" on public.course_question_replies;
drop policy if exists "course_question_tag_links select visible with access" on public.course_question_tag_links;
drop policy if exists "course_question_tag_links insert own question" on public.course_question_tag_links;
drop policy if exists "course_question_tag_links delete admin" on public.course_question_tag_links;

create policy "course_question_tags select active"
  on public.course_question_tags for select
  to authenticated
  using (is_active = true or (select public.is_admin()));

create policy "course_question_tags admin all"
  on public.course_question_tags for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "course_questions select visible with access"
  on public.course_questions for select
  to authenticated
  using (
    ((status = 'visible') and public.can_access_course(course_id))
    or (select public.is_admin())
  );

create policy "course_questions insert own with access"
  on public.course_questions for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and status = 'visible'
    and public.can_access_course(course_id)
  );

create policy "course_questions update admin"
  on public.course_questions for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "course_questions delete admin"
  on public.course_questions for delete
  to authenticated
  using ((select public.is_admin()));

create policy "course_question_replies select visible with access"
  on public.course_question_replies for select
  to authenticated
  using (
    (
      status = 'visible'
      and exists (
        select 1
        from public.course_questions q
        where q.id = question_id
          and q.status = 'visible'
          and public.can_access_course(q.course_id)
      )
    )
    or (select public.is_admin())
  );

create policy "course_question_replies insert own with access"
  on public.course_question_replies for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and status = 'visible'
    and exists (
      select 1
      from public.course_questions q
      where q.id = question_id
        and q.status = 'visible'
        and public.can_access_course(q.course_id)
    )
  );

create policy "course_question_replies update admin"
  on public.course_question_replies for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "course_question_replies delete admin"
  on public.course_question_replies for delete
  to authenticated
  using ((select public.is_admin()));

create policy "course_question_tag_links select visible with access"
  on public.course_question_tag_links for select
  to authenticated
  using (
    exists (
      select 1
      from public.course_questions q
      where q.id = question_id
        and (
          ((q.status = 'visible') and public.can_access_course(q.course_id))
          or (select public.is_admin())
        )
    )
  );

create policy "course_question_tag_links insert own question"
  on public.course_question_tag_links for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.course_questions q
      where q.id = question_id
        and q.author_id = (select auth.uid())
        and q.status = 'visible'
    )
  );

create policy "course_question_tag_links delete admin"
  on public.course_question_tag_links for delete
  to authenticated
  using ((select public.is_admin()));

revoke all on table public.course_question_tags from anon, authenticated;
revoke all on table public.course_questions from anon, authenticated;
revoke all on table public.course_question_replies from anon, authenticated;
revoke all on table public.course_question_tag_links from anon, authenticated;

grant select on table public.course_question_tags to authenticated;
grant select, insert, update, delete on table public.course_questions to authenticated;
grant select, insert, update, delete on table public.course_question_replies to authenticated;
grant select, insert, delete on table public.course_question_tag_links to authenticated;

revoke execute on function public.can_access_course(uuid) from public, anon;
revoke execute on function public.course_questions_feed(uuid) from public, anon;
grant execute on function public.can_access_course(uuid) to authenticated;
grant execute on function public.course_questions_feed(uuid) to authenticated;

insert into public.course_question_tags (slug, name, tag_type, sort_order, is_active)
select
  'course-category-' || cc.id::text as slug,
  cc.name,
  'course_system',
  cc.sort_order,
  true
from public.course_categories cc
where cc.is_active = true
on conflict (slug) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

commit;
