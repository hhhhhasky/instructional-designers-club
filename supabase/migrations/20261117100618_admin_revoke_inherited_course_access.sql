begin;

-- Older revoked rows only removed direct grants. A denial also overrides the
-- default from membership, so it is written only for new, explicit removals.
alter table public.user_course_entitlements
  drop constraint user_course_entitlements_status_check;
alter table public.user_course_entitlements
  add constraint user_course_entitlements_status_check
  check (status in ('active', 'revoked', 'denied'));

create function private.has_course_product_access(
  p_user_id uuid,
  p_access_level public.access_level,
  p_product_code text
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (
      select case
        when e.status = 'denied' then false
        when e.status = 'active' and e.starts_at <= now()
          and (e.expires_at is null or e.expires_at > now()) then true
      end
      from public.user_course_entitlements e
      where e.user_id = p_user_id and e.product_code = p_product_code
    ),
    exists (
      select 1 from public.membership_course_access m
      where m.access_level = p_access_level and m.product_code = p_product_code
    )
  );
$$;

revoke execute on function private.has_course_product_access(uuid, public.access_level, text) from public, anon;
grant execute on function private.has_course_product_access(uuid, public.access_level, text) to authenticated;

create or replace function public.admin_set_user_course_access(
  p_user_id uuid,
  p_product_code text,
  p_enabled boolean,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.course_access_products%rowtype;
  v_result public.user_course_entitlements%rowtype;
begin
  if not exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and status = 'active'
  ) then
    raise exception 'Permission denied: admin only';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Cannot modify own course access';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception '用户不存在';
  end if;

  select * into v_product
  from public.course_access_products
  where code = p_product_code;

  if v_product.code is null or (p_enabled and (v_product.status <> 'published' or not v_product.is_grantable)) then
    raise exception '该课程当前不可授权';
  end if;

  insert into public.user_course_entitlements (
    user_id, product_code, status, starts_at, expires_at, notes, granted_by, updated_at
  ) values (
    p_user_id, p_product_code, case when p_enabled then 'active' else 'denied' end,
    now(), null, nullif(trim(coalesce(p_notes, '')), ''), auth.uid(), now()
  )
  on conflict (user_id, product_code) do update set
    status = excluded.status,
    starts_at = case when p_enabled then now() else public.user_course_entitlements.starts_at end,
    expires_at = null,
    notes = excluded.notes,
    granted_by = auth.uid(),
    updated_at = now()
  returning * into v_result;

  return jsonb_build_object(
    'user_id', v_result.user_id,
    'product_code', v_result.product_code,
    'status', v_result.status,
    'starts_at', v_result.starts_at,
    'expires_at', v_result.expires_at,
    'notes', v_result.notes
  );
end;
$$;

revoke execute on function public.admin_set_user_course_access(uuid, text, boolean, text) from public, anon;
grant execute on function public.admin_set_user_course_access(uuid, text, boolean, text) to authenticated;

create or replace function public.can_access_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
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
                private.has_course_product_access(p.id, p.access_level, c.access_product_code)
                or (
                  c.access_product_code = 'teaching-general-v1'
                  and private.has_course_product_access(p.id, p.access_level, 'teaching-general-legacy')
                )
              )
          )
        )
    );
$$;

alter policy "daofa media visible to entitled active users"
  on public.daofa_lesson_media
  using (
    is_active
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.status = 'active'
        and (
          p.role = 'admin'
          or private.has_course_product_access(p.id, p.access_level, 'daofa-textbook')
        )
    )
  );

create or replace function public.hai_admin_course_point_users(p_product_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_rate integer := greatest(1, public.hai_runtime_numeric('points.tokens_per_point', 1000)::integer);
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Permission denied: admin only'; end if;
  if not exists (select 1 from public.course_access_products where code = p_product_code and status = 'published' and is_grantable) then
    raise exception '课程不可用';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname, 'phone', p.phone,
    'points', round(coalesce(w.balance_tokens, 0)::numeric / v_rate, 2)) order by p.nickname, p.id), '[]'::jsonb)
  into v_result from public.profiles p left join public.hai_point_wallets w on w.user_id = p.id
  where p.status = 'active'
    and private.has_course_product_access(p.id, p.access_level, p_product_code);
  return v_result;
end $$;

revoke execute on function public.hai_admin_course_point_users(text) from public, anon;
grant execute on function public.hai_admin_course_point_users(text) to authenticated;

commit;
