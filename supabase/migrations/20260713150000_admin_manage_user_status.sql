-- 管理后台：允许管理员停用或恢复普通会员账号。
-- 保护边界：仅管理员可调用；不能修改自己；不能停用其他管理员。

create or replace function public.admin_update_user_status(
  p_user_id uuid,
  p_new_status text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role public.user_role;
  v_result json;
begin
  if not public.is_admin() then
    raise exception 'Permission denied: admin only';
  end if;

  if p_new_status not in ('active', 'banned') then
    raise exception 'Invalid user status: %', p_new_status;
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Cannot modify own account status';
  end if;

  select role into v_target_role
  from public.profiles
  where id = p_user_id;

  if not found then
    raise exception '用户不存在';
  end if;

  if v_target_role = 'admin' then
    raise exception '不能在会员维护页停用管理员账号';
  end if;

  update public.profiles
  set status = p_new_status::public.user_status,
      updated_at = now()
  where id = p_user_id;

  select json_build_object(
    'id', p_user_id,
    'status', p_new_status,
    'updated_at', now()
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.admin_update_user_status(uuid, text)
  is '管理员停用或恢复普通会员账号，禁止修改自己或其他管理员';

revoke execute on function public.admin_update_user_status(uuid, text) from public, anon;
grant execute on function public.admin_update_user_status(uuid, text) to authenticated;
