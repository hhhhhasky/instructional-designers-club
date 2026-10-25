begin;

-- The purchase packages retain their own discounted prices. This is the
-- administrator's explicit base conversion for per-call service charges.
update public.hai_runtime_settings set value='0.01'::jsonb,default_value='0.01'::jsonb,label='每积分基础金额',description='服务计费的金额与积分基础换算；购买套餐可有独立优惠价。',updated_at=now()
where key='points.cny_per_point';
insert into public.hai_runtime_settings(key,label,description,category,value,default_value,value_type,min_value,max_value,step,unit,enabled)
values
 ('points.web_search_cny_per_1000','每1000次成功检索费用','成功返回非空结果才计费；失败、超时、无结果不计费。','积分与套餐','5','5','number',0,10000,0.01,'元/1000次',true),
 ('points.web_fetch_cny_per_1000','每1000次成功抓取费用','成功取得非空网页正文才计费；失败、超时、无正文不计费。','积分与套餐','5','5','number',0,10000,0.01,'元/1000次',true)
on conflict(key) do nothing;

create table public.hai_web_tool_calls (
 run_id uuid not null references public.hai_work_runs(id),
 request_id text not null,
 user_id uuid not null references public.profiles(id),
 tool_kind text not null check(tool_kind in ('search','fetch')),
 request_number integer not null check(request_number>0),
 unit_cost_cny numeric not null check(unit_cost_cny>=0),
 points numeric not null check(points>=0),
 created_at timestamptz not null default now(),
 primary key(run_id,tool_kind,request_number)
);
create index hai_web_tool_calls_request on public.hai_web_tool_calls(request_id,user_id);
alter table public.hai_web_tool_calls enable row level security;
revoke all on public.hai_web_tool_calls from public,anon,authenticated;
grant select on public.hai_web_tool_calls to authenticated;
grant all on public.hai_web_tool_calls to service_role;
create policy hai_web_tool_calls_read on public.hai_web_tool_calls for select to authenticated
using(user_id=auth.uid() or public.is_admin());

create function public.hai_update_web_tool_prices(p_search_cny numeric,p_fetch_cny numeric) returns void
language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 if auth.uid() is null or not coalesce(public.is_admin(),false) then raise exception '仅管理员可以修改检索计费。'; end if;
 if p_search_cny is null or p_fetch_cny is null or p_search_cny not between 0 and 10000 or p_fetch_cny not between 0 and 10000 then raise exception '费用必须在0至10000元之间。'; end if;
 update public.hai_runtime_settings set value=to_jsonb(case key when 'points.web_search_cny_per_1000' then p_search_cny else p_fetch_cny end),enabled=true,updated_at=now()
 where key in ('points.web_search_cny_per_1000','points.web_fetch_cny_per_1000');
 get diagnostics changed = row_count;
 if changed<>2 then raise exception '检索计费配置未完整安装。'; end if;
end; $$;
revoke all on function public.hai_update_web_tool_prices(numeric,numeric) from public,anon;
grant execute on function public.hai_update_web_tool_prices(numeric,numeric) to authenticated;

-- Reuse the existing request reservation and wallet. Snapshot prices when a
-- new retrieval first starts; retries keep those prices and the receipt keys.
create function public.hai_prepare_web_tool_billing(p_run_id uuid,p_lease_token uuid) returns void
language plpgsql security definer set search_path='' as $$
declare j public.hai_work_jobs%rowtype; r public.hai_work_runs%rowtype; res public.hai_request_reservations%rowtype;
 prices jsonb; cny numeric; search_cny numeric; fetch_cny numeric; extra bigint; previous bigint; others bigint; balance bigint; current_reserved bigint;
begin
 select * into strict j from public.hai_work_jobs where run_id=p_run_id for update;
 select * into strict r from public.hai_work_runs where id=p_run_id for update;
 if r.status<>'running' or j.phase='complete' or p_lease_token is null or j.lease_token is distinct from p_lease_token or j.lease_until is null or j.lease_until<=now()
   or j.payload->'caseRetrieval'->>'billing_version' is distinct from '1' then raise exception '检索计费执行权已失效。'; end if;
 prices:=j.payload->'caseBilling';
 if prices is null then
   cny:=public.hai_runtime_numeric('points.cny_per_point',0.01);
   search_cny:=public.hai_runtime_numeric('points.web_search_cny_per_1000',5)/1000;
   fetch_cny:=public.hai_runtime_numeric('points.web_fetch_cny_per_1000',5)/1000;
   if cny<=0 or search_cny<0 or fetch_cny<0 then raise exception '金额与积分配置不正确。'; end if;
   prices:=jsonb_build_object('cny_per_point',cny,'search_cny',search_cny,'fetch_cny',fetch_cny,'search_points',search_cny/cny,'fetch_points',fetch_cny/cny);
   update public.hai_work_jobs set payload=jsonb_set(payload,'{caseBilling}',prices) where run_id=p_run_id;
 end if;
 -- Follow the ordinary reservation's lock order: quota lock, reservation, wallet.
 perform pg_advisory_xact_lock(hashtextextended('hai_usage_gate',0));
 select * into strict res from public.hai_request_reservations where request_id=r.client_request_id and user_id=r.user_id for update;
 if res.status<>'active' then raise exception '任务积分预留已失效。'; end if;
 if res.metadata->>'quota_mode'='points' then
   extra:=ceil(((prices->>'search_points')::numeric*(j.payload->'caseRetrieval'->>'searches')::integer
          +(prices->>'fetch_points')::numeric*(j.payload->'caseRetrieval'->>'pages')::integer)
          *public.hai_runtime_numeric('points.tokens_per_point',1000))::bigint;
   previous:=case when j.payload->'caseBilling' is null then 0 else ceil(coalesce((res.metadata->>'web_tool_reserved_points')::numeric,0)*public.hai_runtime_numeric('points.tokens_per_point',1000))::bigint end;
   current_reserved:=coalesce((res.metadata->>'points_reserved_equivalent_tokens')::bigint,0);
   select balance_tokens into strict balance from public.hai_point_wallets where user_id=r.user_id for update;
   select coalesce(sum((metadata->>'points_reserved_equivalent_tokens')::bigint),0) into others from public.hai_request_reservations
   where user_id=r.user_id and request_id<>r.client_request_id and status='active' and expires_at>now();
   if balance-others<current_reserved-previous+extra then raise exception '积分不足以支付本轮检索与抓取。'; end if;
   update public.hai_request_reservations set metadata=metadata||jsonb_build_object('web_tool_reserved_tokens',extra,'web_tool_reserved_points',(prices->>'search_points')::numeric*(j.payload->'caseRetrieval'->>'searches')::integer+(prices->>'fetch_points')::numeric*(j.payload->'caseRetrieval'->>'pages')::integer,'points_reserved_equivalent_tokens',current_reserved-previous+extra)
   where id=res.id;
 end if;
end; $$;
revoke all on function public.hai_prepare_web_tool_billing(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hai_prepare_web_tool_billing(uuid,uuid) to service_role;

-- A receipt represents a successful nonempty provider response, not an attempt
-- or the number of returned results. A normal primary key makes retries safe.
create function public.hai_record_web_tool_success(p_run_id uuid,p_lease_token uuid,p_tool_kind text,p_request_number integer) returns void
language plpgsql security definer set search_path='' as $$
declare j public.hai_work_jobs%rowtype; r public.hai_work_runs%rowtype; prices jsonb; request_count integer;
begin
 select * into strict j from public.hai_work_jobs where run_id=p_run_id for update;
 select * into strict r from public.hai_work_runs where id=p_run_id for update;
 if r.status<>'running' or j.phase='complete' or p_lease_token is null or j.lease_token is distinct from p_lease_token or j.lease_until is null or j.lease_until<=now()
   or j.payload->'caseRetrieval'->>'billing_version' is distinct from '1' or j.payload->'caseBilling' is null then raise exception '检索计费执行权已失效。'; end if;
 if p_tool_kind is null or p_tool_kind not in ('search','fetch') then raise exception '未知检索服务类型。'; end if;
 request_count:=coalesce((j.payload->'caseState'->>case when p_tool_kind='search' then 'searches' else 'reads' end)::integer,0);
 if p_request_number is null or p_request_number<1 or p_request_number<>request_count then raise exception '检索成功记录与请求次数不匹配。'; end if;
 prices:=j.payload->'caseBilling';
 insert into public.hai_web_tool_calls(run_id,request_id,user_id,tool_kind,request_number,unit_cost_cny,points)
 values(r.id,r.client_request_id,r.user_id,p_tool_kind,p_request_number,(prices->>(p_tool_kind||'_cny'))::numeric,(prices->>(p_tool_kind||'_points'))::numeric)
 on conflict(run_id,tool_kind,request_number) do nothing;
end; $$;
revoke all on function public.hai_record_web_tool_success(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.hai_record_web_tool_success(uuid,uuid,text,integer) to service_role;

CREATE OR REPLACE FUNCTION public.hai_finalize_usage(p_request_id text, p_status text, p_input_tokens integer, p_output_tokens integer, p_route text DEFAULT 'hai-chat'::text, p_entity_type text DEFAULT NULL::text, p_entity_id uuid DEFAULT NULL::uuid, p_duration_ms integer DEFAULT NULL::integer, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reservation public.hai_request_reservations%rowtype;
  v_wallet public.hai_point_wallets%rowtype;
  v_status text := case when p_status in ('completed', 'failed', 'cached') then p_status else 'failed' end;
  v_input integer := greatest(0, coalesce(p_input_tokens, 0));
  v_output integer := greatest(0, coalesce(p_output_tokens, 0));
  v_charge_tokens bigint := 0;
  v_calculated_charge_tokens bigint := 0;
  v_tokens_per_point integer := greatest(1, public.hai_runtime_numeric('points.tokens_per_point', 1000)::integer);
  v_flash_hit numeric := greatest(0, public.hai_runtime_numeric('points.flash_cache_hit_multiplier', 0.033));
  v_flash_miss numeric := greatest(0, public.hai_runtime_numeric('points.flash_cache_miss_multiplier', 1));
  v_flash_output numeric := greatest(0, public.hai_runtime_numeric('points.flash_output_multiplier', 3));
  v_pro_hit numeric := greatest(0, public.hai_runtime_numeric('points.pro_cache_hit_multiplier', 0.1));
  v_pro_miss numeric := greatest(0, public.hai_runtime_numeric('points.pro_cache_miss_multiplier', 3));
  v_pro_output numeric := greatest(0, public.hai_runtime_numeric('points.pro_output_multiplier', 9));
  v_model text;
  v_model_call_count integer := 0;
  v_all_provider_usage boolean := false;
  v_actual_input_tokens bigint := 0;
  v_actual_output_tokens bigint := 0;
  v_actual_raw_tokens bigint := 0;
  v_billing_source text := 'estimated';
  v_web_points numeric := 0;
  v_web_cost numeric := 0;
  v_web_tokens bigint := 0;
  v_web_searches integer := 0;
  v_web_fetches integer := 0;
  v_event_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if auth.uid() is null then
    raise exception '请先登录。';
  end if;

  select * into v_reservation
  from public.hai_request_reservations
  where request_id = p_request_id
  for update;

  if v_reservation.id is null or v_reservation.status <> 'active' then
    return;
  end if;

  if v_reservation.user_id <> auth.uid() and not coalesce(public.is_admin(), false) then
    raise exception '无权限结算其他用户的 HAI 请求。';
  end if;

  if jsonb_typeof(v_reservation.metadata -> 'billing_multipliers') = 'object' then
    v_flash_hit := greatest(0, coalesce(
      nullif(v_reservation.metadata -> 'billing_multipliers' ->> 'flash_cache_hit', '')::numeric,
      v_flash_hit
    ));
    v_flash_miss := greatest(0, coalesce(
      nullif(v_reservation.metadata -> 'billing_multipliers' ->> 'flash_cache_miss', '')::numeric,
      v_flash_miss
    ));
    v_flash_output := greatest(0, coalesce(
      nullif(v_reservation.metadata -> 'billing_multipliers' ->> 'flash_output', '')::numeric,
      v_flash_output
    ));
    v_pro_hit := greatest(0, coalesce(
      nullif(v_reservation.metadata -> 'billing_multipliers' ->> 'pro_cache_hit', '')::numeric,
      v_pro_hit
    ));
    v_pro_miss := greatest(0, coalesce(
      nullif(v_reservation.metadata -> 'billing_multipliers' ->> 'pro_cache_miss', '')::numeric,
      v_pro_miss
    ));
    v_pro_output := greatest(0, coalesce(
      nullif(v_reservation.metadata -> 'billing_multipliers' ->> 'pro_output', '')::numeric,
      v_pro_output
    ));
  end if;

  if v_status in ('completed', 'cached')
    and v_reservation.metadata ->> 'quota_mode' = 'points' then
    select
      count(*)::integer,
      coalesce(bool_and(call.usage_status = 'provider'), false),
      coalesce(sum(call.prompt_tokens), 0)::bigint,
      coalesce(sum(call.completion_tokens), 0)::bigint,
      coalesce(sum(call.total_tokens), 0)::bigint,
      coalesce(ceil(sum(
        coalesce(call.cache_hit_tokens, 0)::numeric
          * case when lower(call.model) like '%pro%' then v_pro_hit else v_flash_hit end
        + coalesce(call.cache_miss_tokens, 0)::numeric
          * case when lower(call.model) like '%pro%' then v_pro_miss else v_flash_miss end
        + coalesce(call.completion_tokens, 0)::numeric
          * case when lower(call.model) like '%pro%' then v_pro_output else v_flash_output end
      )), 0)::bigint
    into
      v_model_call_count,
      v_all_provider_usage,
      v_actual_input_tokens,
      v_actual_output_tokens,
      v_actual_raw_tokens,
      v_calculated_charge_tokens
    from public.hai_model_calls call
    where call.request_id = p_request_id
      and call.status = 'completed';

    if v_model_call_count > 0 and v_all_provider_usage then
      v_billing_source := 'provider';
    else
      v_model := lower(coalesce(
        nullif(v_reservation.metadata ->> 'model', ''),
        nullif(p_metadata ->> 'model', ''),
        'deepseek-v4-flash'
      ));
      v_actual_input_tokens := v_input;
      v_actual_output_tokens := v_output;
      v_actual_raw_tokens := v_input::bigint + v_output::bigint;
      v_calculated_charge_tokens := ceil(
        v_input::numeric * case when v_model like '%pro%' then v_pro_miss else v_flash_miss end
        + v_output::numeric * case when v_model like '%pro%' then v_pro_output else v_flash_output end
      )::bigint;
    end if;

    -- Only server-recorded successful calls owned by this reservation count.
    select coalesce(sum(points),0),coalesce(sum(unit_cost_cny),0),
      count(*) filter(where tool_kind='search'),count(*) filter(where tool_kind='fetch')
    into v_web_points,v_web_cost,v_web_searches,v_web_fetches
    from public.hai_web_tool_calls where request_id=p_request_id and user_id=v_reservation.user_id;
    v_web_tokens:=ceil(v_web_points*v_tokens_per_point)::bigint;
    v_calculated_charge_tokens:=v_calculated_charge_tokens+v_web_tokens;
    v_event_metadata:=v_event_metadata||jsonb_build_object('web_tool_points',v_web_points,'web_tool_cost_cny',v_web_cost,'web_search_successes',v_web_searches,'web_fetch_successes',v_web_fetches);

    select * into v_wallet
    from public.hai_point_wallets
    where user_id = v_reservation.user_id
    for update;

    v_charge_tokens := least(v_wallet.balance_tokens, v_calculated_charge_tokens);
    update public.hai_point_wallets
    set
      balance_tokens = balance_tokens - v_charge_tokens,
      total_consumed_tokens = total_consumed_tokens + v_charge_tokens
    where user_id = v_reservation.user_id;

    insert into public.hai_point_transactions (
      user_id, transaction_type, token_delta, points_delta,
      tokens_per_point, request_id, reason, metadata
    )
    values (
      v_reservation.user_id, 'usage', -v_charge_tokens,
      -round(v_charge_tokens::numeric / v_tokens_per_point, 2),
      v_tokens_per_point, p_request_id, 'HAI 使用扣减',
      jsonb_build_object(
        'route', coalesce(nullif(p_route, ''), v_reservation.route),
        'billing_mode', 'weighted_equivalent_v1',
        'billing_source', v_billing_source,
        'billed_equivalent_tokens', v_charge_tokens,
        'calculated_equivalent_tokens', v_calculated_charge_tokens,
        'web_tool_points', v_web_points,
        'web_tool_cost_cny', v_web_cost,
        'web_search_successes', v_web_searches,
        'web_fetch_successes', v_web_fetches,
        'actual_tokens', v_actual_raw_tokens,
        'actual_input_tokens', v_actual_input_tokens,
        'actual_output_tokens', v_actual_output_tokens,
        'flash_cache_hit_multiplier', v_flash_hit,
        'flash_cache_miss_multiplier', v_flash_miss,
        'flash_output_multiplier', v_flash_output,
        'pro_cache_hit_multiplier', v_pro_hit,
        'pro_cache_miss_multiplier', v_pro_miss,
        'pro_output_multiplier', v_pro_output
      )
    );
    v_event_metadata := v_event_metadata || jsonb_build_object(
      'billing_mode', 'weighted_equivalent_v1',
      'billing_source', v_billing_source,
      'points_charged_tokens', v_charge_tokens,
      'calculated_equivalent_tokens', v_calculated_charge_tokens,
      'tokens_per_point', v_tokens_per_point
    );
  end if;

  update public.hai_request_reservations
  set
    status = case when v_status in ('completed', 'cached') then 'completed' else 'failed' end,
    actual_input_tokens = v_input,
    actual_output_tokens = v_output,
    completed_at = now()
  where request_id = p_request_id;

  insert into public.hai_usage_events (
    user_id, request_id, event_type, route, status,
    entity_type, entity_id, input_tokens, output_tokens,
    total_tokens, duration_ms, metadata
  )
  values (
    v_reservation.user_id,
    p_request_id,
    case
      when v_status = 'cached' then 'hai.request.cached'
      when v_status = 'completed' then 'hai.request.completed'
      else 'hai.request.failed'
    end,
    coalesce(nullif(p_route, ''), v_reservation.route),
    v_status, p_entity_type, p_entity_id, v_input, v_output,
    v_input + v_output, p_duration_ms, v_event_metadata
  );
end;
$function$;

commit;

