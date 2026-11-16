create schema if not exists private;

-- A pending request holds no plaintext email, phone, nickname, or password.
-- The Edge Function supplies keyed digests of the address and the verification code.
create table private.club_signup_attempts (
  address_key text primary key,
  attempt_id uuid not null,
  code_digest text not null,
  created_at timestamptz not null,
  guesses integer not null default 0,
  finishing_until timestamptz
);
create table private.club_signup_mail_limits (
  scope text primary key,
  window_start timestamptz not null,
  attempts integer not null
);
revoke all on private.club_signup_attempts, private.club_signup_mail_limits
  from public, anon, authenticated;

create function public.start_club_email_signup(
  p_address_key text, p_attempt_id uuid, p_code_digest text, p_email text, p_phone text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_now timestamptz := now();
  v_attempt uuid;
begin
  if exists (select 1 from public.profiles where phone = p_phone) then return 'phone_taken'; end if;
  if exists (
    select 1 from auth.users u where u.email = p_email
      and (u.email_confirmed_at is not null or u.phone_confirmed_at is not null
        or (u.raw_app_meta_data->>'provider') is distinct from 'email'
        or coalesce(u.raw_user_meta_data->>'phone', '') !~ '^1[3-9][0-9]{9}$'
        or exists (select 1 from public.profiles where id = u.id))
  ) then return 'email_unavailable'; end if;

  -- Lock the global mail budget before reserving the per-address allowance.
  insert into private.club_signup_mail_limits as limits (scope, window_start, attempts)
  values ('global', v_now, 0)
  on conflict (scope) do update set
    attempts = case when limits.window_start <= v_now - interval '15 minutes' then 0 else limits.attempts end,
    window_start = case when limits.window_start <= v_now - interval '15 minutes' then v_now else limits.window_start end
  returning attempts into v_count;
  if v_count >= 120 then return 'rate_limited'; end if;

  insert into private.club_signup_mail_limits as limits (scope, window_start, attempts)
  values (p_address_key, v_now, 1)
  on conflict (scope) do update set
    attempts = case when limits.window_start <= v_now - interval '15 minutes' then 1 else limits.attempts + 1 end,
    window_start = case when limits.window_start <= v_now - interval '15 minutes' then v_now else limits.window_start end
  returning attempts into v_count;
  if v_count > 5 then return 'rate_limited'; end if;

  -- Invalidate a pending request from the previous signUp flow. A verified
  -- user, or a row with business data, cannot be removed through registration.
  delete from auth.users u where u.email = p_email and u.email_confirmed_at is null and u.phone_confirmed_at is null
    and u.raw_app_meta_data->>'provider' = 'email' and u.raw_user_meta_data->>'phone' ~ '^1[3-9][0-9]{9}$'
    and not exists (select 1 from public.profiles where id = u.id);
  if exists (select 1 from auth.users where email = p_email) then return 'email_unavailable'; end if;

  insert into private.club_signup_attempts as attempts
    (address_key, attempt_id, code_digest, created_at)
  values (p_address_key, p_attempt_id, p_code_digest, v_now)
  on conflict (address_key) do update set
    attempt_id = excluded.attempt_id, code_digest = excluded.code_digest,
    created_at = excluded.created_at, guesses = 0, finishing_until = null
  where attempts.finishing_until is null or attempts.finishing_until <= v_now
  returning attempt_id into v_attempt;
  if v_attempt is null then return 'finishing'; end if;

  update private.club_signup_mail_limits set attempts = attempts + 1 where scope = 'global';
  delete from private.club_signup_attempts where created_at < v_now - interval '15 minutes';
  delete from private.club_signup_mail_limits where window_start < v_now - interval '30 minutes';
  return 'send';
end;
$$;

create function public.claim_club_email_signup(p_address_key text, p_attempt_id uuid, p_code_digest text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_matches boolean;
begin
  -- A newer request changes attempt_id, so a submitted older code cannot
  -- increment the new request's guesses or open a second provisioning call.
  update private.club_signup_attempts set
    guesses = guesses + 1,
    finishing_until = case when code_digest = p_code_digest then now() + interval '2 minutes' end
  where address_key = p_address_key and attempt_id = p_attempt_id
    and created_at > now() - interval '10 minutes' and guesses < 5
    and (finishing_until is null or finishing_until <= now())
  returning code_digest = p_code_digest into v_matches;
  return coalesce(v_matches, false);
end;
$$;

create function public.clear_club_email_signup(p_address_key text, p_attempt_id uuid, p_retry boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_retry then
    update private.club_signup_attempts set finishing_until = null
      where address_key = p_address_key and attempt_id = p_attempt_id;
  else
    delete from private.club_signup_attempts where address_key = p_address_key and attempt_id = p_attempt_id;
  end if;
end;
$$;

revoke execute on function public.start_club_email_signup(text, uuid, text, text, text),
  public.claim_club_email_signup(text, uuid, text), public.clear_club_email_signup(text, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.start_club_email_signup(text, uuid, text, text, text),
  public.claim_club_email_signup(text, uuid, text), public.clear_club_email_signup(text, uuid, boolean)
  to service_role;
