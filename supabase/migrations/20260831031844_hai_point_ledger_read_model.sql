begin;

-- Expose a user-safe points ledger without returning the internal token
-- accounting fields. Usage normally has a point transaction; terminal usage
-- events without one (including failed requests and historical non-point runs)
-- are represented as zero-point entries for complete reconciliation.
create or replace function public.hai_point_ledger(
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_entries jsonb;
begin
  if v_user_id is null then
    raise exception '请先登录。';
  end if;

  with terminal_usage as (
    select
      event.id,
      event.request_id,
      event.route,
      event.status,
      event.entity_type,
      event.entity_id,
      event.metadata,
      event.created_at
    from public.hai_usage_events event
    where event.user_id = v_user_id
      and event.status in ('completed', 'cached', 'failed')
      and event.event_type <> 'hai.request.started'
  ),
  entries as (
    select
      tx.id::text as id,
      tx.transaction_type,
      tx.points_delta,
      case
        when tx.transaction_type = 'usage' then
          case coalesce(usage.route, tx.metadata ->> 'route')
            when 'hai-chat' then 'HAI Chat 聊天'
            when 'hai-roundtable-chat' then 'HAI 圆桌协作'
            when 'hai-work' then case coalesce(usage.metadata ->> 'tool_slug', tx.metadata ->> 'tool_slug')
              when 'lesson-diagnosis' then 'HAI Work · 教案诊断'
              when 'segment-optimization' then 'HAI Work · 环节优化'
              when 'subject-lesson-design' then 'HAI Work · 公开课设计'
              when 'teaching-design' then 'HAI Work · 研发教学方案'
              else 'HAI Work 协助任务'
            end
            else coalesce(nullif(tx.reason, ''), 'HAI 使用')
          end
        else coalesce(nullif(tx.reason, ''), case tx.transaction_type
          when 'purchase' then '购买积分'
          when 'newcomer_gift' then '会员赠送积分'
          when 'admin_add' then '管理员加分'
          when 'refund' then '使用退款'
          else '积分变动'
        end)
      end as purpose,
      case
        when tx.transaction_type = 'usage' then
          case coalesce(usage.status, 'completed') when 'failed' then 'failed' else 'success' end
        else 'success'
      end as result,
      coalesce(usage.created_at, tx.created_at) as created_at
    from public.hai_point_transactions tx
    left join terminal_usage usage on usage.request_id = tx.request_id
    where tx.user_id = v_user_id

    union all

    select
      ('usage:' || usage.id::text) as id,
      'usage' as transaction_type,
      0::numeric as points_delta,
      case usage.route
        when 'hai-chat' then 'HAI Chat 聊天'
        when 'hai-roundtable-chat' then 'HAI 圆桌协作'
        when 'hai-work' then case usage.metadata ->> 'tool_slug'
          when 'lesson-diagnosis' then 'HAI Work · 教案诊断'
          when 'segment-optimization' then 'HAI Work · 环节优化'
          when 'subject-lesson-design' then 'HAI Work · 公开课设计'
          when 'teaching-design' then 'HAI Work · 研发教学方案'
          else 'HAI Work 协助任务'
        end
        else 'HAI 使用'
      end as purpose,
      case when usage.status = 'failed' then 'failed' else 'success' end as result,
      usage.created_at
    from terminal_usage usage
    where usage.status in ('completed', 'cached', 'failed')
      and not exists (
        select 1
        from public.hai_point_transactions tx
        where tx.user_id = v_user_id
          and tx.request_id = usage.request_id
      )
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', entries.id,
      'transaction_type', entries.transaction_type,
      'points_delta', entries.points_delta,
      'purpose', entries.purpose,
      'result', entries.result,
      'created_at', entries.created_at
    ) order by entries.created_at desc, entries.id desc
  ), '[]'::jsonb)
  into v_entries
  from (select * from entries order by created_at desc, id desc limit v_limit offset v_offset) entries;

  return v_entries;
end;
$$;

revoke execute on function public.hai_point_ledger(integer, integer) from public, anon;
grant execute on function public.hai_point_ledger(integer, integer) to authenticated;

commit;
