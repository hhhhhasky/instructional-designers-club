begin;

-- The points migration retired the legacy internal/beta branch, but the
-- pure-image reservation function still entered it for administrators. That
-- made an administrator fail before the provider request with
-- "HAI 用量策略未配置".
create or replace function public.hai_check_and_reserve_courseware_image(
  p_request_id text,
  p_route text,
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
  v_quota_mode text := 'points';
  v_tokens_per_point integer := greatest(1, public.hai_runtime_numeric('points.tokens_per_point', 1000)::integer);
  v_cny_per_point numeric := greatest(0, public.hai_runtime_numeric('points.cny_per_point', 0.10));
  v_image_points numeric := greatest(0.01, public.hai_runtime_numeric('points.courseware_image_points', 2));
  v_fixed_tokens bigint := greatest(1, ceil(v_image_points * v_tokens_per_point));
  v_reserved_tokens bigint := 0;
  v_user_active integer := 0;
  v_global_active integer := 0;
  v_result jsonb;
begin
  if v_user_id is null then
    return jsonb_build_object('allowed', false, 'reason', '请先登录。', 'code', 'unauthenticated');
  end if;
  if not public.hai_has_access(v_user_id) then
    return jsonb_build_object('allowed', false, 'reason', 'HAI 面向 Plus、Pro 和后台开通的内测用户开放。', 'code', 'access_denied');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('hai_usage_gate', 0));
  select access_level::text into v_access_level from public.profiles where id = v_user_id;
  v_policy_key := case when v_access_level = 'plus2015' then 'plus2015' else v_access_level end;
  select * into v_policy from public.hai_quota_policies where key = v_policy_key and enabled;
  if v_policy.key is null then
    select * into v_policy from public.hai_quota_policies where key = 'plus' and enabled;
  end if;
  if v_policy.key is null then
    return jsonb_build_object('allowed', false, 'reason', 'HAI 用量策略未配置。', 'code', 'quota_policy_missing');
  end if;

  update public.hai_request_reservations set status = 'expired'
  where status = 'active' and expires_at < now();
  select count(*) into v_user_active from public.hai_request_reservations
  where user_id = v_user_id and status = 'active' and expires_at > now();
  select count(*) into v_global_active from public.hai_request_reservations
  where status = 'active' and expires_at > now();
  if v_user_active >= v_policy.user_concurrency_limit then
    return jsonb_build_object('allowed', false, 'reason', '你当前已有 HAI 请求正在处理，请等待上一条回复完成。', 'code', 'user_concurrency_limit');
  end if;
  if v_global_active >= v_policy.global_concurrency_limit then
    return jsonb_build_object('allowed', false, 'reason', '当前 HAI 使用人数较多，请稍后重试。', 'code', 'global_concurrency_limit');
  end if;

  if v_quota_mode = 'points' then
    v_wallet := public.hai_ensure_points_wallet(v_user_id);
    select coalesce(sum(coalesce((metadata ->> 'fixed_charge_tokens')::bigint, 0)), 0)
      into v_reserved_tokens
    from public.hai_request_reservations
    where user_id = v_user_id and status = 'active' and expires_at > now()
      and metadata ->> 'billing_mode' = 'courseware_image_fixed_v1';
    if v_wallet.balance_tokens - v_reserved_tokens < v_fixed_tokens then
      return jsonb_build_object(
        'allowed', false, 'reason', '积分不足，请购买积分后继续使用。', 'code', 'points_insufficient',
        'current_points', round(v_wallet.balance_tokens::numeric / v_tokens_per_point, 2),
        'required_points', round(v_fixed_tokens::numeric / v_tokens_per_point, 2)
      );
    end if;
  end if;

  v_result := coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
    'quota_mode', v_quota_mode,
    'billing_mode', 'courseware_image_fixed_v1',
    'fixed_charge_tokens', v_fixed_tokens,
    'fixed_charge_points', round(v_fixed_tokens::numeric / v_tokens_per_point, 2),
    'image_unit_points', v_image_points,
    'image_unit_cost_cny', round(v_image_points * v_cny_per_point, 4)
  );
  insert into public.hai_request_reservations (
    request_id, user_id, route, estimated_input_tokens, estimated_output_tokens, metadata
  ) values (p_request_id, v_user_id, p_route, 0, 0, v_result)
  on conflict (request_id) do update set
    status = 'active', expires_at = now() + interval '5 minutes',
    estimated_input_tokens = 0, estimated_output_tokens = 0, metadata = excluded.metadata;
  insert into public.hai_usage_events (
    user_id, request_id, event_type, route, status, input_tokens, output_tokens, total_tokens, metadata
  ) values (v_user_id, p_request_id, 'hai.courseware.image.started', p_route, 'started', 0, 0, 0, v_result);
  return jsonb_build_object(
    'allowed', true, 'request_id', p_request_id, 'quota_mode', v_quota_mode,
    'current_points', case when v_quota_mode = 'points' then round(v_wallet.balance_tokens::numeric / v_tokens_per_point, 2) else null end,
    'required_points', case when v_quota_mode = 'points' then round(v_fixed_tokens::numeric / v_tokens_per_point, 2) else null end
  );
end;
$$;

revoke execute on function public.hai_check_and_reserve_courseware_image(text, text, jsonb) from public, anon;
grant execute on function public.hai_check_and_reserve_courseware_image(text, text, jsonb) to authenticated;

commit;
