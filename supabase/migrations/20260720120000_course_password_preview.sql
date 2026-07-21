-- Per-course password preview for Plus / Pro lessons.
-- Password hashes live outside the publicly readable courses table.

begin;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

alter table public.courses
  add column if not exists password_access_enabled boolean not null default false;

comment on column public.courses.password_access_enabled is
  'Whether non-members may unlock this Plus/Pro course with a per-course preview password.';

create table if not exists private.course_access_passwords (
  course_id uuid primary key references public.courses(id) on delete cascade,
  password_hash text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

comment on table private.course_access_passwords is
  'Private bcrypt hashes for per-course preview passwords. Never exposed through public course reads.';

revoke all on schema private from public, anon, authenticated;
revoke all on table private.course_access_passwords from public, anon, authenticated;

create or replace function public.sync_course_password_access_state()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.membership_type not in ('plus', 'pro') then
    delete from private.course_access_passwords where course_id = new.id;
    new.password_access_enabled := false;
  elsif new.password_access_enabled
    and not exists (
      select 1
      from private.course_access_passwords cap
      where cap.course_id = new.id
    ) then
    raise exception 'A password must be configured before enabling password preview access';
  elsif not new.password_access_enabled then
    delete from private.course_access_passwords where course_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_course_password_access_state_trigger on public.courses;
create trigger sync_course_password_access_state_trigger
  before insert or update of membership_type, password_access_enabled
  on public.courses
  for each row
  execute function public.sync_course_password_access_state();

create or replace function public.admin_set_course_access_password(
  p_course_id uuid,
  p_password text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_membership_type text;
  v_password text := btrim(coalesce(p_password, ''));
begin
  if not public.is_admin() then
    raise exception 'Permission denied: admin only';
  end if;

  select membership_type
  into v_membership_type
  from public.courses
  where id = p_course_id
  for update;

  if not found then
    raise exception 'Course not found';
  end if;

  if v_password = '' then
    delete from private.course_access_passwords where course_id = p_course_id;
    update public.courses
    set password_access_enabled = false
    where id = p_course_id;
    return false;
  end if;

  if v_membership_type not in ('plus', 'pro') then
    raise exception 'Password preview is only available for Plus and Pro courses';
  end if;

  if char_length(v_password) < 4 then
    raise exception 'Preview password must contain at least 4 characters';
  end if;

  if octet_length(v_password) > 72 then
    raise exception 'Preview password is too long';
  end if;

  insert into private.course_access_passwords (
    course_id,
    password_hash,
    updated_at,
    updated_by
  )
  values (
    p_course_id,
    extensions.crypt(v_password, extensions.gen_salt('bf', 10)),
    now(),
    auth.uid()
  )
  on conflict (course_id) do update
  set password_hash = excluded.password_hash,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;

  update public.courses
  set password_access_enabled = true
  where id = p_course_id;

  return true;
end;
$$;

comment on function public.admin_set_course_access_password(uuid, text) is
  'Admin-only setter/clearer for a Plus or Pro course preview password. Stores only a bcrypt hash.';

create or replace function public.verify_course_access_password(
  p_course_id uuid,
  p_password text
)
returns boolean
language sql
volatile
security definer
set search_path = public, private, extensions
as $$
  select exists (
    select 1
    from public.courses c
    join private.course_access_passwords cap on cap.course_id = c.id
    where c.id = p_course_id
      and c.status = 'published'
      and c.membership_type in ('plus', 'pro')
      and c.password_access_enabled = true
      and octet_length(coalesce(p_password, '')) between 1 and 72
      and extensions.crypt(btrim(p_password), cap.password_hash) = cap.password_hash
  );
$$;

comment on function public.verify_course_access_password(uuid, text) is
  'Checks a published Plus/Pro course preview password without exposing its hash.';

revoke execute on function public.sync_course_password_access_state() from public, anon, authenticated;
revoke execute on function public.admin_set_course_access_password(uuid, text) from public, anon;
revoke execute on function public.verify_course_access_password(uuid, text) from public;

grant execute on function public.admin_set_course_access_password(uuid, text) to authenticated;
grant execute on function public.verify_course_access_password(uuid, text) to anon, authenticated;

commit;
