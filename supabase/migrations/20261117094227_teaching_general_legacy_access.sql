begin;

insert into public.course_access_products (code, name, description, status, is_grantable, sort_order)
values ('teaching-general-legacy', '教学通识课旧版', '仅可观看教学通识课 2025 版', 'published', true, 11);

update public.course_access_products
set description = '可观看 2025 版，2027 版上架后可观看新版', updated_at = now()
where code = 'teaching-general-v1';

-- The existing lesson product code identifies the 2025 edition. The extra
-- grant is a viewing rule for that edition, not a grant of the standard product.
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
              and c.access_product_code is not null
              and (
                exists (
                  select 1 from public.membership_course_access m
                  where m.access_level = p.access_level
                    and m.product_code = c.access_product_code
                )
                or exists (
                  select 1 from public.user_course_entitlements e
                  where e.user_id = p.id
                    and (
                      e.product_code = c.access_product_code
                      or (c.access_product_code = 'teaching-general-v1' and e.product_code = 'teaching-general-legacy')
                    )
                    and e.status = 'active'
                    and e.starts_at <= now()
                    and (e.expires_at is null or e.expires_at > now())
                )
              )
          )
        )
    );
$$;

commit;
