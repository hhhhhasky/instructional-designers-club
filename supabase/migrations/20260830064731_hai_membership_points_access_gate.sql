begin;

-- A revoked or expired beta record must not shadow a user's current membership.
-- Beta records remain in place for audit/history, but no longer participate in
-- end-user HAI authorization or quota selection. Administrators keep the
-- internal policy for operational verification; Plus/Pro always use points.

create or replace function public.hai_has_access(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user_id is null then false
    when not (p_user_id = auth.uid() or coalesce(public.is_admin(), false)) then false
    when coalesce(public.is_admin(), false) and p_user_id = auth.uid() then true
    else exists (
      select 1
      from public.profiles profile
      left join public.hai_point_wallets wallet on wallet.user_id = profile.id
      where profile.id = p_user_id
        and (
          profile.access_level::text in ('plus', 'pro')
          or (
            profile.access_level::text = 'plus2015'
            and coalesce(wallet.balance_tokens, 0) > 0
          )
        )
    )
  end;
$$;

create or replace function public.hai_access_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_access_level text;
  v_wallet public.hai_point_wallets%rowtype;
begin
  if v_user_id is null then
    return jsonb_build_object('authenticated', false, 'allowed', false, 'reason', '请先登录。');
  end if;

  if coalesce(public.is_admin(), false) then
    return jsonb_build_object(
      'authenticated', true, 'allowed', true, 'is_admin', true,
      'status', 'admin', 'quota_mode', 'internal',
      'quota_policy_key', 'beta'
    );
  end if;

  select access_level::text into v_access_level
  from public.profiles
  where id = v_user_id;

  if v_access_level in ('plus', 'pro') then
    v_wallet := public.hai_ensure_points_wallet(v_user_id);
    return jsonb_build_object(
      'authenticated', true, 'allowed', true, 'is_admin', false,
      'status', case when v_wallet.balance_tokens > 0 then 'active' else 'needs_points' end,
      'quota_mode', 'points',
      'membership_level', v_access_level,
      'quota_policy_key', v_access_level,
      'can_consume', v_wallet.balance_tokens > 0,
      'reason', case
        when v_wallet.balance_tokens > 0 then null
        else '当前积分余额为 0，可浏览 HAI 页面，购买积分后即可使用。'
      end
    );
  end if;

  -- Preserve the already-sold 2015Plus points entitlement without restoring
  -- beta-based access. A positive purchased/manual wallet remains usable.
  if v_access_level = 'plus2015' then
    v_wallet := public.hai_ensure_points_wallet(v_user_id);
    if v_wallet.balance_tokens > 0 then
      return jsonb_build_object(
        'authenticated', true, 'allowed', true, 'is_admin', false,
        'status', 'active', 'quota_mode', 'points',
        'membership_level', v_access_level,
        'quota_policy_key', 'plus2015',
        'can_consume', true
      );
    end if;
  end if;

  return jsonb_build_object(
    'authenticated', true, 'allowed', false, 'is_admin', false,
    'status', 'membership_required', 'quota_mode', 'none',
    'membership_level', v_access_level,
    'can_consume', false,
    'reason', 'HAI 面向 Plus、Pro 会员开放；开通会员并拥有积分后即可使用。'
  );
end;
$$;

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
      'reason', 'HAI 面向 Plus、Pro 会员开放；开通会员并拥有积分后即可使用。',
      'code', 'access_denied'
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended('hai_usage_gate', 0));

  select access_level::text into v_access_level
  from public.profiles
  where id = v_user_id;

  if coalesce(public.is_admin(), false) then
    v_quota_mode := 'internal';
    v_policy_key := 'beta';
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

    if v_wallet.balance_tokens <= 0
      or v_wallet.balance_tokens - v_reserved_tokens < v_estimated_charge_tokens then
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

create or replace function public.hai_usage_summary(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid := coalesce(p_user_id, auth.uid());
  v_policy public.hai_quota_policies%rowtype;
  v_wallet public.hai_point_wallets%rowtype;
  v_access_level text;
  v_policy_key text;
  v_quota_mode text;
  v_day_used bigint := 0;
  v_week_used bigint := 0;
  v_tokens_per_point integer := greatest(1, public.hai_runtime_numeric('points.tokens_per_point', 1000)::integer);
  v_qr_url text;
  v_point_packages jsonb := '[]'::jsonb;
begin
  if v_target is null then
    return jsonb_build_object('quota_mode', 'none', 'daily_used', 0, 'weekly_used', 0);
  end if;
  if v_target <> auth.uid() and not coalesce(public.is_admin(), false) then
    raise exception '无权限查看该用户 HAI 用量。';
  end if;

  select access_level::text into v_access_level
  from public.profiles
  where id = v_target;
  if v_access_level is null then
    raise exception '用户不存在';
  end if;

  v_wallet := public.hai_ensure_points_wallet(v_target);

  select case
    when enabled and jsonb_typeof(value) = 'string' then value #>> '{}'
    else null
  end into v_qr_url
  from public.hai_runtime_settings where key = 'points.wecom_qr_url';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', package.id,
        'name', package.name,
        'points', package.points,
        'price_cny', package.price_cny,
        'description', package.description,
        'value_metrics', package.value_metrics,
        'is_recommended', package.is_recommended
      ) order by package.sort_order, package.price_cny
    ),
    '[]'::jsonb
  )
  into v_point_packages
  from public.hai_point_packages package
  where package.is_enabled;

  if coalesce(public.is_admin(), false) and v_target = auth.uid() then
    v_quota_mode := 'internal';
    v_policy_key := 'beta';
  elsif v_access_level in ('plus', 'pro') then
    v_quota_mode := 'points';
    v_policy_key := v_access_level;
  elsif v_access_level = 'plus2015' and v_wallet.balance_tokens > 0 then
    v_quota_mode := 'points';
    v_policy_key := 'plus2015';
  else
    v_quota_mode := 'none';
    v_policy_key := null;
  end if;

  if v_policy_key is not null then
    select * into v_policy from public.hai_quota_policies
    where key = v_policy_key and enabled = true;
  end if;
  if v_policy.key is null and v_quota_mode = 'internal' then
    select * into v_policy from public.hai_quota_policies where key = 'beta' and enabled = true;
  end if;
  if v_policy.key is null and v_quota_mode = 'points' then
    select * into v_policy from public.hai_quota_policies where key = 'plus' and enabled = true;
  end if;

  if v_quota_mode = 'internal' then
    select coalesce(sum(coalesce(total_tokens, 0)), 0)::bigint into v_day_used
    from public.hai_usage_events
    where user_id = v_target and status in ('completed', 'cached')
      and created_at >= date_trunc('day', now());
    select coalesce(sum(coalesce(total_tokens, 0)), 0)::bigint into v_week_used
    from public.hai_usage_events
    where user_id = v_target and status in ('completed', 'cached')
      and created_at >= date_trunc('week', now());
  end if;

  return jsonb_build_object(
    'quota_mode', v_quota_mode,
    'policy_key', coalesce(v_policy.key, v_policy_key),
    'membership_level', v_access_level,
    'can_consume', v_quota_mode = 'internal' or (v_quota_mode = 'points' and v_wallet.balance_tokens > 0),
    'daily_used', v_day_used,
    'weekly_used', v_week_used,
    'daily_limit', case when v_quota_mode = 'internal' then coalesce(v_policy.daily_token_limit, 0) else 0 end,
    'weekly_limit', case when v_quota_mode = 'internal' then coalesce(v_policy.weekly_token_limit, 0) else 0 end,
    'balance_tokens', v_wallet.balance_tokens,
    'total_credited_tokens', v_wallet.total_credited_tokens,
    'total_consumed_tokens', v_wallet.total_consumed_tokens,
    'current_points', case
      when v_quota_mode = 'internal' then round(greatest(coalesce(v_policy.weekly_token_limit, 0) - v_week_used, 0)::numeric / v_tokens_per_point, 2)
      else round(v_wallet.balance_tokens::numeric / v_tokens_per_point, 2)
    end,
    'consumed_points', case
      when v_quota_mode = 'internal' then round(v_week_used::numeric / v_tokens_per_point, 2)
      else round(v_wallet.total_consumed_tokens::numeric / v_tokens_per_point, 2)
    end,
    'quota_total_points', case
      when v_quota_mode = 'internal' then round(coalesce(v_policy.weekly_token_limit, 0)::numeric / v_tokens_per_point, 2)
      else round(v_wallet.total_credited_tokens::numeric / v_tokens_per_point, 2)
    end,
    'wallet_points', round(v_wallet.balance_tokens::numeric / v_tokens_per_point, 2),
    'wallet_consumed_points', round(v_wallet.total_consumed_tokens::numeric / v_tokens_per_point, 2),
    'credited_points', round(v_wallet.total_credited_tokens::numeric / v_tokens_per_point, 2),
    'newcomer_grant_points', round(v_wallet.newcomer_grant_tokens::numeric / v_tokens_per_point, 2),
    'point_packages', v_point_packages,
    'wecom_qr_url', coalesce(v_qr_url, '/哈老师企微二维码.png'),
    'single_request_token_limit', coalesce(v_policy.single_request_token_limit, 0),
    'max_output_tokens', coalesce(v_policy.max_output_tokens, 4096)
  );
end;
$$;

revoke execute on function public.hai_has_access(uuid) from public, anon;
revoke execute on function public.hai_access_status() from public, anon;
revoke execute on function public.hai_check_and_reserve_usage(text, text, integer, integer, jsonb) from public, anon;
revoke execute on function public.hai_usage_summary(uuid) from public, anon;

grant execute on function public.hai_has_access(uuid) to authenticated;
grant execute on function public.hai_access_status() to authenticated;
grant execute on function public.hai_check_and_reserve_usage(text, text, integer, integer, jsonb) to authenticated;
grant execute on function public.hai_usage_summary(uuid) to authenticated;

commit;
