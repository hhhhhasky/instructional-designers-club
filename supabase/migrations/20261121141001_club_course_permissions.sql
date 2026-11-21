begin;

-- Keep the entitlement key so current grants, denials and membership links retain their meaning.
update public.course_access_products
set name = '俱乐部 plus 课程', description = '可观看教学通识课 2025 版', updated_at = now()
where code = 'teaching-general-legacy';

update public.course_access_products
set description = '可观看教学通识课 2025 版和上线后的搞定公开课新版', updated_at = now()
where code = 'teaching-general-v1';

-- The permission can be assigned before the course itself is published.
insert into public.course_access_products (code, name, description, status, is_grantable, sort_order)
values ('gongding-gongkaike', '搞定公开课', '可观看教学通识课 2025 版和上线后的搞定公开课新版', 'published', true, 12);

create function private.can_view_course_product(
  p_user_id uuid,
  p_access_level public.access_level,
  p_product_code text
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case p_product_code
    when 'teaching-general-v1' then
      private.has_course_product_access(p_user_id, p_access_level, 'teaching-general-v1')
      or private.has_course_product_access(p_user_id, p_access_level, 'teaching-general-legacy')
      or private.has_course_product_access(p_user_id, p_access_level, 'gongding-gongkaike')
    when 'gongding-gongkaike' then
      private.has_course_product_access(p_user_id, p_access_level, 'teaching-general-v1')
      or private.has_course_product_access(p_user_id, p_access_level, 'gongding-gongkaike')
    else private.has_course_product_access(p_user_id, p_access_level, p_product_code)
  end;
$$;

revoke execute on function private.can_view_course_product(uuid, public.access_level, text)
  from public, anon, authenticated;

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
              and private.can_view_course_product(p.id, p.access_level, c.access_product_code)
          )
        )
    );
$$;

-- Return course viewing scopes for the signed-in user. The two permissions
-- offering both courses result in the same scopes and expose no grant details.
create function public.get_my_course_viewing_codes()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array(
    select product.code
    from public.profiles p
    cross join public.course_access_products product
    where p.id = (select auth.uid())
      and p.status = 'active'
      and product.code <> 'teaching-general-legacy'
      and (p.role = 'admin' or private.can_view_course_product(p.id, p.access_level, product.code))
    order by product.sort_order, product.code
  );
$$;

revoke execute on function public.get_my_course_viewing_codes() from public, anon;
grant execute on function public.get_my_course_viewing_codes() to authenticated;

alter policy "published course access products readable"
  on public.course_access_products
  using ((select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and status = 'active'
  )));

alter policy "membership course mappings readable"
  on public.membership_course_access
  using ((select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and status = 'active'
  )));

alter policy "course entitlements own or admin read"
  on public.user_course_entitlements
  using ((select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and status = 'active'
  )));

alter policy "daofa media visible to entitled active users"
  on public.daofa_lesson_media
  using (
    is_active
    and (select array_position(public.get_my_course_viewing_codes(), 'daofa-textbook') is not null)
  );

create function public.admin_replace_user_course_access(
  p_user_id uuid,
  p_previous_product_code text,
  p_product_code text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_access_level public.access_level;
  v_granted jsonb;
  v_revoked jsonb;
begin
  if not exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and status = 'active'
  ) then
    raise exception 'Permission denied: admin only';
  end if;

  select access_level into v_access_level from public.profiles
  where id = p_user_id for no key update;
  if not private.has_course_product_access(p_user_id, v_access_level, p_previous_product_code)
    or private.has_course_product_access(p_user_id, v_access_level, p_product_code) then
    raise exception '学员的课程权限已变更，请刷新后重试';
  end if;

  v_granted := public.admin_set_user_course_access(p_user_id, p_product_code, true, p_notes);
  v_revoked := public.admin_set_user_course_access(p_user_id, p_previous_product_code, false, '后台替换课程权限');
  return jsonb_build_object('granted', v_granted, 'revoked', v_revoked);
end;
$$;

revoke execute on function public.admin_replace_user_course_access(uuid, text, text, text) from public, anon;
grant execute on function public.admin_replace_user_course_access(uuid, text, text, text) to authenticated;

commit;
