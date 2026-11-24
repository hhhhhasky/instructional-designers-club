create function public.admin_course_page(
  p_page integer,
  p_page_size integer,
  p_search text,
  p_status text,
  p_category text,
  p_level text,
  p_product text,
  p_search_products text[]
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_search text := lower(btrim(coalesce(p_search, '')));
  v_result jsonb;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Permission denied: admin only' using errcode = '42501';
  end if;

  with filtered as materialized (
    select c.id, c.title, c.instructor, c.status, c.membership_type,
           c.access_product_code, c.password_access_enabled, c.created_at, c.updated_at,
           c.sort_order
    from public.courses c
    cross join lateral (
      select coalesce(c.access_product_code,
        case c.membership_type when 'pro' then 'teacher-ai'
             when 'plus' then 'teaching-general-v1' else 'free' end) as code
    ) product
    where (p_status is null or c.status::text = p_status)
      and (p_category is null or c.category = p_category)
      and (p_level is null or c.level::text = p_level)
      and (p_product is null or product.code = p_product)
      and (
        v_search = ''
        or strpos(lower(coalesce(c.title, '')), v_search) > 0
        or strpos(lower(coalesce(c.instructor, '')), v_search) > 0
        or strpos(lower(coalesce(c.category, '')), v_search) > 0
        or strpos(lower(coalesce(c.level::text, '')), v_search) > 0
        or product.code = any(p_search_products)
      )
  ), totals as (
    select count(*)::integer as total from filtered
  ), current_page as (
    select total, least(v_page, greatest(1, (total + v_page_size - 1) / v_page_size)) as page
    from totals
  ), items as (
    select * from filtered
    order by sort_order asc nulls last, created_at desc, id
    limit v_page_size
    offset ((select page from current_page) - 1)::bigint * v_page_size
  )
  select jsonb_build_object(
    'items', coalesce(
      (select jsonb_agg(to_jsonb(items) - 'sort_order'
                order by sort_order asc nulls last, created_at desc, id) from items),
      '[]'::jsonb
    ),
    'total', total,
    'page', page,
    'levels', coalesce(
      (select jsonb_agg(distinct level order by level) from public.courses where level is not null),
      '[]'::jsonb
    )
  ) into v_result from current_page;

  return v_result;
end;
$$;

revoke execute on function public.admin_course_page(integer, integer, text, text, text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.admin_course_page(integer, integer, text, text, text, text, text, text[]) to authenticated;

create function public.admin_hai_quality_summary(p_since timestamptz)
returns table(scored_count integer, passed_count integer, score_total double precision)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Permission denied: admin only' using errcode = '42501';
  end if;

  return query
    with recent as (
      select m.metadata
      from public.hai_messages m
      where m.role = 'assistant' and m.created_at >= p_since
      order by m.created_at desc, m.id desc
      limit 20000
    ), evaluations as (
      select case
        when jsonb_typeof(metadata -> 'hai_trace') = 'object' then metadata #> '{hai_trace,evaluation_result}'
        when jsonb_typeof(metadata -> 'hai_skill_trace') = 'object' then metadata #> '{hai_skill_trace,evaluation_result}'
        when jsonb_typeof(metadata -> 'hai_context_trace') = 'object' then metadata #> '{hai_context_trace,evaluation_result}'
      end as value
      from recent
    )
    select count(*)::integer,
           count(*) filter (where value -> 'pass' = 'true'::jsonb)::integer,
           coalesce(sum((value ->> 'score')::double precision), 0)
    from evaluations
    where jsonb_typeof(value -> 'score') = 'number';
end;
$$;

revoke execute on function public.admin_hai_quality_summary(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_hai_quality_summary(timestamptz) to authenticated;
