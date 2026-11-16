-- Supabase keeps the pending signup in auth.users while the email token is valid.
-- Only a confirmed account should have a club profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is null
     or new.email is null
     or new.email ilike '%@isd.local'
     or new.email ilike '%@phone.local' then
    return new;
  end if;

  insert into public.profiles (id, phone, nickname)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'nickname', '学员')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is '邮箱验证通过后创建俱乐部用户资料';
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Keep the INSERT trigger for accounts provisioned with a confirmed email.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create trigger on_auth_user_email_confirmed
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.handle_new_user();

-- The old migration was recorded on the hosted project, but its RPC is missing.
create or replace function public.admin_update_user_status(
  p_user_id uuid,
  p_new_status text
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_role public.user_role;
  v_updated_at timestamptz;
  v_club_ban_until constant timestamptz := '9999-12-31 00:00:00+00';
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  ) then
    raise exception '只有正常使用的管理员账号可以修改会员状态。' using errcode = '42501';
  end if;
  if p_new_status is null or p_new_status not in ('active', 'banned') then
    raise exception '无效的账号状态。' using errcode = '22023';
  end if;
  if p_user_id = auth.uid() then
    raise exception '不能修改自己的账号状态。' using errcode = '42501';
  end if;

  -- Lock in the same order as email confirmation (Auth first, profile second).
  perform 1 from auth.users where id = p_user_id for no key update;
  select role into v_target_role
    from public.profiles where id = p_user_id for no key update;
  if not found then
    raise exception '用户不存在。' using errcode = 'P0002';
  end if;
  if v_target_role = 'admin' then
    raise exception '不能在会员维护页修改管理员账号的状态。' using errcode = '42501';
  end if;

  update public.profiles set status = p_new_status::public.user_status, updated_at = now()
    where id = p_user_id
    returning updated_at into v_updated_at;

  if p_new_status = 'banned' then
    update auth.users set banned_until = v_club_ban_until
      where id = p_user_id and (banned_until is null or banned_until <= now());
    delete from auth.sessions where user_id = p_user_id;
  else
    -- A ban applied directly in Auth should not be cleared by the club UI.
    update auth.users set banned_until = null
      where id = p_user_id and banned_until = v_club_ban_until;
  end if;

  return json_build_object('id', p_user_id, 'status', p_new_status, 'updated_at', v_updated_at);
end;
$$;

comment on function public.admin_update_user_status(uuid, text)
  is '管理员停用或恢复普通会员账号，同步认证封禁并使停用账号的会话无法续期';
revoke execute on function public.admin_update_user_status(uuid, text) from public, anon;
grant execute on function public.admin_update_user_status(uuid, text) to authenticated;
