begin;

-- Points are billed in Flash cache-miss equivalent tokens. The visible point
-- balance stays stable while model, cache and output multipliers determine how
-- quickly that balance is consumed.
insert into public.hai_runtime_settings (
  key, label, description, category, value, default_value, value_type,
  min_value, max_value, step, unit, enabled
)
values
  (
    'points.flash_cache_hit_multiplier', 'Flash 缓存命中倍率',
    'Flash 输入缓存命中 Token 的积分消耗倍率。',
    '积分与套餐', to_jsonb(0.033::numeric), to_jsonb(0.033::numeric), 'number',
    0, 1000, 0.001, '倍', true
  ),
  (
    'points.flash_cache_miss_multiplier', 'Flash 未缓存输入倍率',
    'Flash 未缓存输入 Token 的基准积分消耗倍率。',
    '积分与套餐', to_jsonb(1::numeric), to_jsonb(1::numeric), 'number',
    0, 1000, 0.001, '倍', true
  ),
  (
    'points.flash_output_multiplier', 'Flash 输出倍率',
    'Flash 输出 Token 的积分消耗倍率。',
    '积分与套餐', to_jsonb(3::numeric), to_jsonb(3::numeric), 'number',
    0, 1000, 0.001, '倍', true
  ),
  (
    'points.pro_cache_hit_multiplier', 'Pro 缓存命中倍率',
    'Pro 输入缓存命中 Token 的积分消耗倍率。',
    '积分与套餐', to_jsonb(0.1::numeric), to_jsonb(0.1::numeric), 'number',
    0, 1000, 0.001, '倍', true
  ),
  (
    'points.pro_cache_miss_multiplier', 'Pro 未缓存输入倍率',
    'Pro 未缓存输入 Token 的积分消耗倍率。',
    '积分与套餐', to_jsonb(3::numeric), to_jsonb(3::numeric), 'number',
    0, 1000, 0.001, '倍', true
  ),
  (
    'points.pro_output_multiplier', 'Pro 输出倍率',
    'Pro 输出 Token 的积分消耗倍率。',
    '积分与套餐', to_jsonb(9::numeric), to_jsonb(9::numeric), 'number',
    0, 1000, 0.001, '倍', true
  )
on conflict (key) do nothing;

-- Move the accounting unit from 100 raw Token to 1000 equivalent Token per
-- point without changing any user's visible point balance or history.
do $$
declare
  v_old_tokens_per_point integer := greatest(
    1,
    public.hai_runtime_numeric('points.tokens_per_point', 100)::integer
  );
  v_new_tokens_per_point integer := 1000;
begin
  if v_old_tokens_per_point <> v_new_tokens_per_point then
    update public.hai_point_wallets
    set
      balance_tokens = round(balance_tokens::numeric * v_new_tokens_per_point / v_old_tokens_per_point)::bigint,
      total_credited_tokens = round(total_credited_tokens::numeric * v_new_tokens_per_point / v_old_tokens_per_point)::bigint,
      total_consumed_tokens = round(total_consumed_tokens::numeric * v_new_tokens_per_point / v_old_tokens_per_point)::bigint,
      newcomer_grant_tokens = round(newcomer_grant_tokens::numeric * v_new_tokens_per_point / v_old_tokens_per_point)::bigint,
      updated_at = now();

    update public.hai_point_transactions
    set
      token_delta = round(token_delta::numeric * v_new_tokens_per_point / greatest(tokens_per_point, 1))::bigint,
      tokens_per_point = v_new_tokens_per_point;

    update public.hai_membership_point_grants
    set
      granted_tokens = granted_points::bigint * v_new_tokens_per_point,
      tokens_per_point = v_new_tokens_per_point;

    update public.hai_runtime_settings
    set
      value = to_jsonb(
        round((value #>> '{}')::numeric * v_new_tokens_per_point / v_old_tokens_per_point)::bigint
      ),
      default_value = to_jsonb(
        round((default_value #>> '{}')::numeric * v_new_tokens_per_point / v_old_tokens_per_point)::bigint
      ),
      updated_at = now()
    where key in ('points.newcomer_plus_tokens', 'points.newcomer_pro_tokens');
  end if;

  update public.hai_runtime_settings
  set
    label = '每积分对应等价 Token（仅内部计费）',
    description = '每 1 积分对应的 Flash 未缓存输入等价 Token；用户端不展示。',
    category = '积分与套餐',
    value = to_jsonb(v_new_tokens_per_point),
    default_value = to_jsonb(v_new_tokens_per_point),
    updated_at = now()
  where key = 'points.tokens_per_point';
end;
$$;

create or replace function public.hai_admin_update_point_billing_config(
  p_tokens_per_point integer,
  p_flash_cache_hit_multiplier numeric,
  p_flash_cache_miss_multiplier numeric,
  p_flash_output_multiplier numeric,
  p_pro_cache_hit_multiplier numeric,
  p_pro_cache_miss_multiplier numeric,
  p_pro_output_multiplier numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_tokens_per_point integer;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Permission denied: admin only';
  end if;
  if p_tokens_per_point is null or p_tokens_per_point < 1 or p_tokens_per_point > 1000000 then
    raise exception '每积分对应等价 Token 必须在 1 到 1000000 之间';
  end if;
  if p_flash_cache_hit_multiplier is null or p_flash_cache_hit_multiplier < 0 or p_flash_cache_hit_multiplier > 1000
    or p_flash_cache_miss_multiplier is null or p_flash_cache_miss_multiplier < 0 or p_flash_cache_miss_multiplier > 1000
    or p_flash_output_multiplier is null or p_flash_output_multiplier < 0 or p_flash_output_multiplier > 1000
    or p_pro_cache_hit_multiplier is null or p_pro_cache_hit_multiplier < 0 or p_pro_cache_hit_multiplier > 1000
    or p_pro_cache_miss_multiplier is null or p_pro_cache_miss_multiplier < 0 or p_pro_cache_miss_multiplier > 1000
    or p_pro_output_multiplier is null or p_pro_output_multiplier < 0 or p_pro_output_multiplier > 1000 then
    raise exception '积分消耗倍率必须在 0 到 1000 之间';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('hai_points_billing_config', 0));
  v_old_tokens_per_point := greatest(
    1,
    public.hai_runtime_numeric('points.tokens_per_point', 1000)::integer
  );

  if v_old_tokens_per_point <> p_tokens_per_point then
    update public.hai_point_wallets
    set
      balance_tokens = round(balance_tokens::numeric * p_tokens_per_point / v_old_tokens_per_point)::bigint,
      total_credited_tokens = round(total_credited_tokens::numeric * p_tokens_per_point / v_old_tokens_per_point)::bigint,
      total_consumed_tokens = round(total_consumed_tokens::numeric * p_tokens_per_point / v_old_tokens_per_point)::bigint,
      newcomer_grant_tokens = round(newcomer_grant_tokens::numeric * p_tokens_per_point / v_old_tokens_per_point)::bigint,
      updated_at = now();

    update public.hai_point_transactions
    set
      token_delta = round(token_delta::numeric * p_tokens_per_point / greatest(tokens_per_point, 1))::bigint,
      tokens_per_point = p_tokens_per_point;

    update public.hai_membership_point_grants
    set
      granted_tokens = granted_points::bigint * p_tokens_per_point,
      tokens_per_point = p_tokens_per_point;

    update public.hai_runtime_settings
    set
      value = to_jsonb(
        round((value #>> '{}')::numeric * p_tokens_per_point / v_old_tokens_per_point)::bigint
      ),
      default_value = to_jsonb(
        round((default_value #>> '{}')::numeric * p_tokens_per_point / v_old_tokens_per_point)::bigint
      ),
      updated_at = now()
    where key in ('points.newcomer_plus_tokens', 'points.newcomer_pro_tokens');
  end if;

  update public.hai_runtime_settings setting
  set
    value = source.value,
    enabled = true,
    updated_at = now()
  from (
    values
      ('points.tokens_per_point', to_jsonb(p_tokens_per_point)),
      ('points.flash_cache_hit_multiplier', to_jsonb(p_flash_cache_hit_multiplier)),
      ('points.flash_cache_miss_multiplier', to_jsonb(p_flash_cache_miss_multiplier)),
      ('points.flash_output_multiplier', to_jsonb(p_flash_output_multiplier)),
      ('points.pro_cache_hit_multiplier', to_jsonb(p_pro_cache_hit_multiplier)),
      ('points.pro_cache_miss_multiplier', to_jsonb(p_pro_cache_miss_multiplier)),
      ('points.pro_output_multiplier', to_jsonb(p_pro_output_multiplier))
  ) as source(key, value)
  where setting.key = source.key;

  return jsonb_build_object(
    'tokens_per_point', p_tokens_per_point,
    'flash_cache_hit_multiplier', p_flash_cache_hit_multiplier,
    'flash_cache_miss_multiplier', p_flash_cache_miss_multiplier,
    'flash_output_multiplier', p_flash_output_multiplier,
    'pro_cache_hit_multiplier', p_pro_cache_hit_multiplier,
    'pro_cache_miss_multiplier', p_pro_cache_miss_multiplier,
    'pro_output_multiplier', p_pro_output_multiplier
  );
end;
$$;

revoke execute on function public.hai_admin_update_point_billing_config(
  integer, numeric, numeric, numeric, numeric, numeric, numeric
) from public, anon;
grant execute on function public.hai_admin_update_point_billing_config(
  integer, numeric, numeric, numeric, numeric, numeric, numeric
) to authenticated;

create or replace function public.hai_check_and_reserve_usage(
  p_request_id text,
  p_route text,
  p_estimated_input_tokens integer,
  p_estimated_output_tokens integer default 4096,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_access public.hai_user_access%rowtype;
  v_policy public.hai_quota_policies%rowtype;
  v_wallet public.hai_point_wallets%rowtype;
  v_access_level text;
  v_policy_key text;
  v_quota_mode text;
  v_estimated_total integer := greatest(0, coalesce(p_estimated_input_tokens, 0)) + greatest(0, coalesce(p_estimated_output_tokens, 0));
  v_day_used bigint := 0;
  v_week_used bigint := 0;
  v_reserved_tokens bigint := 0;
  v_user_active integer := 0;
  v_global_active integer := 0;
  v_tokens_per_point integer := greatest(1, public.hai_runtime_numeric('points.tokens_per_point', 1000)::integer);
  v_model text := lower(coalesce(nullif(p_metadata ->> 'model', ''), 'deepseek-v4-flash'));
  v_flash_hit numeric := greatest(0, public.hai_runtime_numeric('points.flash_cache_hit_multiplier', 0.033));
  v_flash_miss numeric := greatest(0, public.hai_runtime_numeric('points.flash_cache_miss_multiplier', 1));
  v_flash_output numeric := greatest(0, public.hai_runtime_numeric('points.flash_output_multiplier', 3));
  v_pro_hit numeric := greatest(0, public.hai_runtime_numeric('points.pro_cache_hit_multiplier', 0.1));
  v_pro_miss numeric := greatest(0, public.hai_runtime_numeric('points.pro_cache_miss_multiplier', 3));
  v_pro_output numeric := greatest(0, public.hai_runtime_numeric('points.pro_output_multiplier', 9));
  v_input_multiplier numeric;
  v_output_multiplier numeric;
  v_estimated_charge_tokens bigint;
  v_reservation_metadata jsonb;
begin
  if v_user_id is null then
    return jsonb_build_object('allowed', false, 'reason', '请先登录。', 'code', 'unauthenticated');
  end if;

  if not public.hai_has_access(v_user_id) then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'HAI 面向 Plus、Pro 和后台开通的内测用户开放；2015Plus 可购买积分后使用。',
      'code', 'access_denied'
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended('hai_usage_gate', 0));

  select * into v_access from public.hai_user_access where user_id = v_user_id;
  select access_level::text into v_access_level from public.profiles where id = v_user_id;

  if coalesce(public.is_admin(), false)
    or (v_access.user_id is not null and v_access.access_source = 'admin') then
    v_quota_mode := 'internal';
    v_policy_key := coalesce(v_access.quota_policy_key, 'beta');
  else
    v_quota_mode := 'points';
    v_policy_key := case when v_access_level = 'plus2015' then 'plus2015' else v_access_level end;
  end if;

  select * into v_policy
  from public.hai_quota_policies
  where key = v_policy_key and enabled = true;

  if v_policy.key is null and v_quota_mode = 'internal' then
    select * into v_policy from public.hai_quota_policies
    where key = 'beta' and enabled = true;
  end if;
  if v_policy.key is null and v_quota_mode = 'points' then
    select * into v_policy from public.hai_quota_policies
    where key = 'plus' and enabled = true;
  end if;

  if v_policy.key is null then
    return jsonb_build_object('allowed', false, 'reason', 'HAI 用量策略未配置。', 'code', 'quota_policy_missing');
  end if;

  if v_estimated_total > v_policy.single_request_token_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', '本次输入过长，请减少材料或新开一个更聚焦的 session。',
      'code', 'single_request_limit',
      'limit', v_policy.single_request_token_limit,
      'estimated_total', v_estimated_total
    );
  end if;

  if v_model like '%pro%' then
    v_input_multiplier := v_pro_miss;
    v_output_multiplier := v_pro_output;
  else
    v_input_multiplier := v_flash_miss;
    v_output_multiplier := v_flash_output;
  end if;
  v_estimated_charge_tokens := ceil(
    greatest(0, coalesce(p_estimated_input_tokens, 0))::numeric * v_input_multiplier
    + greatest(0, coalesce(p_estimated_output_tokens, 0))::numeric * v_output_multiplier
  )::bigint;
  v_reservation_metadata := coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
    'quota_mode', v_quota_mode,
    'billing_mode', 'weighted_equivalent_v1',
    'points_reserved_equivalent_tokens', v_estimated_charge_tokens,
    'tokens_per_point', v_tokens_per_point,
    'billing_multipliers', jsonb_build_object(
      'flash_cache_hit', v_flash_hit,
      'flash_cache_miss', v_flash_miss,
      'flash_output', v_flash_output,
      'pro_cache_hit', v_pro_hit,
      'pro_cache_miss', v_pro_miss,
      'pro_output', v_pro_output
    )
  );

  update public.hai_request_reservations
  set status = 'expired'
  where status = 'active' and expires_at < now();

  if v_quota_mode = 'internal' then
    select coalesce(sum(coalesce(total_tokens, 0)), 0)::bigint into v_day_used
    from public.hai_usage_events
    where user_id = v_user_id and status in ('completed', 'cached')
      and created_at >= date_trunc('day', now());
    select coalesce(sum(coalesce(total_tokens, 0)), 0)::bigint into v_week_used
    from public.hai_usage_events
    where user_id = v_user_id and status in ('completed', 'cached')
      and created_at >= date_trunc('week', now());

    if v_day_used >= v_policy.daily_token_limit then
      return jsonb_build_object(
        'allowed', false, 'reason', '今日 HAI 使用额度已达上限，请明天再试。',
        'code', 'daily_limit', 'used', v_day_used, 'limit', v_policy.daily_token_limit
      );
    end if;
    if v_week_used >= v_policy.weekly_token_limit then
      return jsonb_build_object(
        'allowed', false, 'reason', '本周 HAI 使用额度已达上限，请下周再试。',
        'code', 'weekly_limit', 'used', v_week_used, 'limit', v_policy.weekly_token_limit
      );
    end if;
  else
    v_wallet := public.hai_ensure_points_wallet(v_user_id);
    select coalesce(sum(
      case
        when metadata ? 'points_reserved_equivalent_tokens'
          then (metadata ->> 'points_reserved_equivalent_tokens')::bigint
        else estimated_input_tokens + estimated_output_tokens
      end
    ), 0)::bigint
    into v_reserved_tokens
    from public.hai_request_reservations
    where user_id = v_user_id and status = 'active' and expires_at > now()
      and metadata ->> 'quota_mode' = 'points';

    if v_wallet.balance_tokens - v_reserved_tokens < v_estimated_charge_tokens then
      return jsonb_build_object(
        'allowed', false,
        'reason', '积分不足，请购买积分后继续使用。',
        'code', 'points_insufficient',
        'balance_tokens', v_wallet.balance_tokens,
        'available_tokens', greatest(0, v_wallet.balance_tokens - v_reserved_tokens),
        'current_points', round(v_wallet.balance_tokens::numeric / v_tokens_per_point, 2),
        'required_points', round(v_estimated_charge_tokens::numeric / v_tokens_per_point, 2)
      );
    end if;
  end if;

  select count(*) into v_user_active
  from public.hai_request_reservations
  where user_id = v_user_id and status = 'active' and expires_at > now();
  select count(*) into v_global_active
  from public.hai_request_reservations
  where status = 'active' and expires_at > now();

  if v_user_active >= v_policy.user_concurrency_limit then
    return jsonb_build_object(
      'allowed', false, 'reason', '你当前已有 HAI 请求正在处理，请等待上一条回复完成。',
      'code', 'user_concurrency_limit', 'limit', v_policy.user_concurrency_limit
    );
  end if;
  if v_global_active >= v_policy.global_concurrency_limit then
    return jsonb_build_object(
      'allowed', false, 'reason', '当前 HAI 使用人数较多，请稍后重试。',
      'code', 'global_concurrency_limit', 'limit', v_policy.global_concurrency_limit
    );
  end if;

  insert into public.hai_request_reservations (
    request_id, user_id, route, estimated_input_tokens,
    estimated_output_tokens, metadata
  )
  values (
    p_request_id, v_user_id, p_route,
    greatest(0, coalesce(p_estimated_input_tokens, 0)),
    greatest(0, coalesce(p_estimated_output_tokens, 0)),
    v_reservation_metadata
  )
  on conflict (request_id) do update set
    status = 'active', expires_at = now() + interval '5 minutes',
    estimated_input_tokens = excluded.estimated_input_tokens,
    estimated_output_tokens = excluded.estimated_output_tokens,
    metadata = excluded.metadata;

  insert into public.hai_usage_events (
    user_id, request_id, event_type, route, status,
    input_tokens, output_tokens, total_tokens, metadata
  )
  values (
    v_user_id, p_request_id, 'hai.request.started', p_route, 'started',
    p_estimated_input_tokens, p_estimated_output_tokens, v_estimated_total,
    v_reservation_metadata
  );

  return jsonb_build_object(
    'allowed', true,
    'request_id', p_request_id,
    'quota_mode', v_quota_mode,
    'policy_key', v_policy.key,
    'daily_used', v_day_used,
    'daily_limit', case when v_quota_mode = 'internal' then v_policy.daily_token_limit else 0 end,
    'weekly_used', v_week_used,
    'weekly_limit', case when v_quota_mode = 'internal' then v_policy.weekly_token_limit else 0 end,
    'current_points', case when v_quota_mode = 'points' then round(v_wallet.balance_tokens::numeric / v_tokens_per_point, 2) else null end,
    'required_points', case when v_quota_mode = 'points' then round(v_estimated_charge_tokens::numeric / v_tokens_per_point, 2) else null end,
    'max_output_tokens', v_policy.max_output_tokens
  );
end;
$$;

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
$$;

revoke execute on function public.hai_finalize_usage(
  text, text, integer, integer, text, text, uuid, integer, jsonb
) from public, anon;
grant execute on function public.hai_finalize_usage(
  text, text, integer, integer, text, text, uuid, integer, jsonb
) to authenticated;

commit;
