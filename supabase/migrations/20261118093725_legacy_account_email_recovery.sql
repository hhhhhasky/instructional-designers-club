-- Keep the existing request list and administrator review. Recovery credentials remain private.
alter table public.password_reset_requests
  add column recovery_email text,
  add column recovery_completed_at timestamptz;

create table private.legacy_recovery_links (
  request_id uuid primary key references public.password_reset_requests(id) on delete cascade,
  token_digest text not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  failed_at timestamptz
);
revoke all on private.legacy_recovery_links from public, anon, authenticated;

-- Old clients may still submit phone/note, never approval fields or a target user ID.
revoke insert on public.password_reset_requests from public, anon, authenticated;
grant insert (phone, note) on public.password_reset_requests to anon, authenticated;
drop policy "anyone insert password_reset_requests" on public.password_reset_requests;
create policy "anyone insert password_reset_requests" on public.password_reset_requests
for insert to anon, authenticated with check (
  status = 'pending' and user_id is null and temp_password is null and resolved_at is null
  and resolved_by is null and recovery_email is null and recovery_completed_at is null
);

create function public.submit_legacy_account_recovery(p_phone text, p_email text, p_note text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_phone !~ '^1[3-9][0-9]{9}$' or p_email is null or length(p_email) > 254
     or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or p_email ~* '@(phone|isd)\.local$' or length(p_note) > 50 then
    raise exception 'invalid request';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('legacy-recovery-phone:' || p_phone, 0));
  perform pg_advisory_xact_lock(hashtextextended('legacy-recovery-email:' || lower(p_email), 0));
  if (select count(*) from public.password_reset_requests where phone = p_phone and created_at > now() - interval '1 hour') >= 3
     or (select count(*) from public.password_reset_requests where recovery_email = lower(p_email) and created_at > now() - interval '1 hour') >= 5 then
    return false;
  end if;
  -- No account lookup here: the public response must not reveal membership.
  insert into public.password_reset_requests(phone, note, recovery_email)
  values(p_phone, coalesce(p_note, ''), lower(p_email));
  return true;
end;
$$;

create function public.prepare_legacy_account_recovery(p_request uuid, p_admin uuid, p_digest text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.password_reset_requests; p public.profiles; v_phone text;
begin
  if not exists(select 1 from public.profiles where id = p_admin and role = 'admin' and status = 'active') then
    return jsonb_build_object('error', '仅管理员可以处理');
  end if;
  select phone into v_phone from public.password_reset_requests where id = p_request;
  perform pg_advisory_xact_lock(hashtextextended('legacy-recovery-phone:' || coalesce(v_phone, ''), 0));
  select * into r from public.password_reset_requests where id = p_request for update;
  if not found or r.recovery_email is null or r.status = 'rejected' or r.recovery_completed_at is not null then
    return jsonb_build_object('error', '申请不存在或已处理');
  end if;
  select * into p from public.profiles where phone = r.phone;
  if not found or p.status <> 'active' or p.role = 'admin' or not exists(
    select 1 from auth.users where id = p.id and email = r.phone || '@phone.local'
    and (banned_until is null or banned_until < now())
  ) then return jsonb_build_object('error', '仅支持尚未绑定邮箱的正常老学员账号；请核对手机号及账号状态'); end if;
  if exists(select 1 from auth.users where lower(email) = r.recovery_email and id <> p.id) then
    return jsonb_build_object('error', '该邮箱已被其他账号使用，请学员更换邮箱后重新申请');
  end if;
  if exists(select 1 from private.legacy_recovery_links l join public.password_reset_requests q on q.id = l.request_id
    where q.phone = r.phone and l.consumed_at is not null and l.failed_at is null and l.consumed_at > now() - interval '10 minutes' and q.recovery_completed_at is null) then
    return jsonb_build_object('error', '上一次操作正在处理，请稍后刷新确认');
  end if;
  if exists(select 1 from private.legacy_recovery_links where request_id = r.id and created_at > now() - interval '1 minute') then
    return jsonb_build_object('error', '发送太频繁，请一分钟后再试');
  end if;
  -- A newer approval invalidates every previous recovery link for this account.
  delete from private.legacy_recovery_links where request_id in
    (select id from public.password_reset_requests where phone = r.phone);
  update public.password_reset_requests set status = 'rejected', resolved_at = now(), resolved_by = p_admin
    where phone = r.phone and id <> r.id and status = 'approved' and recovery_email is not null and recovery_completed_at is null;
  insert into private.legacy_recovery_links(request_id, token_digest) values(r.id, p_digest);
  update public.password_reset_requests set status = 'approved', user_id = p.id, resolved_at = now(), resolved_by = p_admin, temp_password = null where id = r.id;
  return jsonb_build_object('user_id', p.id, 'email', r.recovery_email, 'phone', r.phone);
end;
$$;

create function public.claim_legacy_account_recovery(p_request uuid, p_digest text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.password_reset_requests; v_phone text;
begin
  select phone into v_phone from public.password_reset_requests where id = p_request;
  perform pg_advisory_xact_lock(hashtextextended('legacy-recovery-phone:' || coalesce(v_phone, ''), 0));
  select * into r from public.password_reset_requests where id = p_request for update;
  if not found or r.status <> 'approved' or r.recovery_email is null or r.recovery_completed_at is not null then return null; end if;
  if not exists(select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = r.user_id and p.phone = r.phone and p.status = 'active' and p.role <> 'admin'
    and u.email = r.phone || '@phone.local' and (u.banned_until is null or u.banned_until < now())) then return null; end if;
  update private.legacy_recovery_links set consumed_at = now()
    where request_id = r.id and token_digest = p_digest and consumed_at is null and failed_at is null and created_at > now() - interval '30 minutes';
  if not found then return null; end if;
  return jsonb_build_object('user_id', r.user_id, 'email', r.recovery_email, 'phone', r.phone);
end;
$$;

create function public.finish_legacy_account_recovery(p_request uuid, p_digest text, p_success boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_success then
    update public.password_reset_requests r set recovery_completed_at = now()
    where r.id = p_request and exists(select 1 from private.legacy_recovery_links
      where request_id = r.id and token_digest = p_digest and consumed_at is not null);
  else
    -- A failed Auth call never makes the consumed credential reusable; admin must send a new link.
    update private.legacy_recovery_links set failed_at = now()
      where request_id = p_request and token_digest = p_digest;
  end if;
end;
$$;

revoke all on function public.submit_legacy_account_recovery(text,text,text) from public, anon, authenticated;
revoke all on function public.prepare_legacy_account_recovery(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.claim_legacy_account_recovery(uuid,text) from public, anon, authenticated;
revoke all on function public.finish_legacy_account_recovery(uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.submit_legacy_account_recovery(text,text,text) to service_role;
grant execute on function public.prepare_legacy_account_recovery(uuid,uuid,text) to service_role;
grant execute on function public.claim_legacy_account_recovery(uuid,text) to service_role;
grant execute on function public.finish_legacy_account_recovery(uuid,text,boolean) to service_role;
