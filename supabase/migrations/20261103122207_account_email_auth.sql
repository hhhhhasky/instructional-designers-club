-- Limit password checks in the legacy mailbox-binding flow.
create schema if not exists private;
create table if not exists private.phone_login_attempts (
  phone text primary key,
  attempts integer not null,
  window_start timestamptz not null
);
revoke all on private.phone_login_attempts from public, anon, authenticated;

create or replace function public.reserve_phone_login_attempt(p_phone text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_attempts integer;
begin
  if p_phone !~ '^1[3-9][0-9]{9}$' then return false; end if;
  insert into private.phone_login_attempts as attempts(phone, attempts, window_start)
  values (p_phone, 1, now())
  on conflict (phone) do update set
    attempts = case when attempts.window_start < now() - interval '15 minutes' then 1 else attempts.attempts + 1 end,
    window_start = case when attempts.window_start < now() - interval '15 minutes' then now() else attempts.window_start end
  returning attempts into v_attempts;
  return v_attempts <= 15;
end;
$$;
revoke all on function public.reserve_phone_login_attempt(text) from public, anon, authenticated;
grant execute on function public.reserve_phone_login_attempt(text) to service_role;

create or replace function public.clear_phone_login_attempts(p_phone text)
returns void language sql security definer set search_path = ''
as $$ delete from private.phone_login_attempts where phone = p_phone $$;
revoke all on function public.clear_phone_login_attempts(text) from public, anon, authenticated;
grant execute on function public.clear_phone_login_attempts(text) to service_role;

-- Legacy accounts prove control of a new mailbox before changing Auth email.
-- Codes are stored as a keyed digest; the raw code exists only in the email.
create table if not exists private.email_binding_challenges (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  code_digest text not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);
revoke all on private.email_binding_challenges from public, anon, authenticated;

create or replace function public.start_legacy_email_binding(p_user uuid, p_email text, p_digest text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare affected integer;
begin
  insert into private.email_binding_challenges as c(user_id, email, code_digest)
  values (p_user, p_email, p_digest)
  on conflict (user_id) do update set email = excluded.email, code_digest = excluded.code_digest,
    attempts = 0, created_at = now(), consumed_at = null
  where c.created_at < now() - interval '1 minute';
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;
revoke all on function public.start_legacy_email_binding(uuid, text, text) from public, anon, authenticated;
grant execute on function public.start_legacy_email_binding(uuid, text, text) to service_role;

create or replace function public.consume_legacy_email_binding(p_user uuid, p_digest text)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_email text;
begin
  update private.email_binding_challenges set attempts = attempts + 1,
    consumed_at = case when code_digest = p_digest then now() else null end
  where user_id = p_user and consumed_at is null and attempts < 5
    and created_at > now() - interval '10 minutes'
  returning case when code_digest = p_digest then email else null end into v_email;
  return v_email;
end;
$$;
revoke all on function public.consume_legacy_email_binding(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_legacy_email_binding(uuid, text) to service_role;
