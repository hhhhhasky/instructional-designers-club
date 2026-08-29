begin;

create or replace function public.hai_finalize_usage(
  p_request_id text,
  p_status text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_route text default 'hai-chat',
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_duration_ms integer default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.hai_request_reservations%rowtype;
  v_wallet public.hai_point_wallets%rowtype;
  v_status text := case when p_status in ('completed', 'failed', 'cached') then p_status else 'failed' end;
  v_input integer := greatest(0, coalesce(p_input_tokens, 0));
  v_output integer := greatest(0, coalesce(p_output_tokens, 0));
  v_charge_tokens bigint := 0;
  v_tokens_per_point integer := greatest(1, public.hai_runtime_numeric('points.tokens_per_point', 100)::integer);
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

  if v_status in ('completed', 'cached')
    and v_reservation.metadata ->> 'quota_mode' = 'points' then
    select * into v_wallet
    from public.hai_point_wallets
    where user_id = v_reservation.user_id
    for update;

    v_charge_tokens := least(v_wallet.balance_tokens, (v_input + v_output)::bigint);
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
        'actual_tokens', v_input + v_output
      )
    );
    v_event_metadata := v_event_metadata || jsonb_build_object(
      'points_charged_tokens', v_charge_tokens,
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
$$;

revoke execute on function public.hai_finalize_usage(
  text, text, integer, integer, text, text, uuid, integer, jsonb
) from public, anon;

grant execute on function public.hai_finalize_usage(
  text, text, integer, integer, text, text, uuid, integer, jsonb
) to authenticated;

commit;
