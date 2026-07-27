-- Avoid blocking beta users before they actually reach the daily/weekly quota.
-- The reservation still enforces access, single-request size and concurrency.
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
  v_access_level text;
  v_policy_key text;
  v_estimated_total integer := greatest(0, coalesce(p_estimated_input_tokens, 0)) + greatest(0, coalesce(p_estimated_output_tokens, 0));
  v_day_used integer := 0;
  v_week_used integer := 0;
  v_user_active integer := 0;
  v_global_active integer := 0;
begin
  if v_user_id is null then
    return jsonb_build_object('allowed', false, 'reason', '请先登录。', 'code', 'unauthenticated');
  end if;

  if not public.hai_has_access(v_user_id) then
    return jsonb_build_object('allowed', false, 'reason', 'HAI 当前仅面向内测用户开放。', 'code', 'access_denied');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('hai_usage_gate', 0));

  select * into v_access from public.hai_user_access where user_id = v_user_id;
  select access_level::text into v_access_level from public.profiles where id = v_user_id;
  v_policy_key := coalesce(v_access.quota_policy_key, v_access_level, 'beta');

  select * into v_policy
  from public.hai_quota_policies
  where key = v_policy_key and enabled = true;

  if v_policy.key is null then
    select * into v_policy
    from public.hai_quota_policies
    where key = 'beta' and enabled = true;
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

  update public.hai_request_reservations
  set status = 'expired'
  where status = 'active' and expires_at < now();

  select coalesce(sum(coalesce(total_tokens, 0)), 0)::integer into v_day_used
  from public.hai_usage_events
  where user_id = v_user_id
    and status in ('completed', 'cached')
    and created_at >= date_trunc('day', now());

  select coalesce(sum(coalesce(total_tokens, 0)), 0)::integer into v_week_used
  from public.hai_usage_events
  where user_id = v_user_id
    and status in ('completed', 'cached')
    and created_at >= date_trunc('week', now());

  if v_day_used >= v_policy.daily_token_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', '今日 HAI 使用额度已达上限，请明天再试。',
      'code', 'daily_limit',
      'used', v_day_used,
      'limit', v_policy.daily_token_limit
    );
  end if;

  if v_week_used >= v_policy.weekly_token_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', '本周 HAI 使用额度已达上限，请下周再试。',
      'code', 'weekly_limit',
      'used', v_week_used,
      'limit', v_policy.weekly_token_limit
    );
  end if;

  select count(*) into v_user_active
  from public.hai_request_reservations
  where user_id = v_user_id and status = 'active' and expires_at > now();

  select count(*) into v_global_active
  from public.hai_request_reservations
  where status = 'active' and expires_at > now();

  if v_user_active >= v_policy.user_concurrency_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', '你当前已有 HAI 请求正在处理，请等待上一条回复完成。',
      'code', 'user_concurrency_limit',
      'limit', v_policy.user_concurrency_limit
    );
  end if;

  if v_global_active >= v_policy.global_concurrency_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', '当前 HAI 使用人数较多，请稍后重试。',
      'code', 'global_concurrency_limit',
      'limit', v_policy.global_concurrency_limit
    );
  end if;

  insert into public.hai_request_reservations (
    request_id,
    user_id,
    route,
    estimated_input_tokens,
    estimated_output_tokens,
    metadata
  )
  values (
    p_request_id,
    v_user_id,
    p_route,
    greatest(0, coalesce(p_estimated_input_tokens, 0)),
    greatest(0, coalesce(p_estimated_output_tokens, 0)),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (request_id) do update set
    status = 'active',
    expires_at = now() + interval '5 minutes',
    estimated_input_tokens = excluded.estimated_input_tokens,
    estimated_output_tokens = excluded.estimated_output_tokens,
    metadata = excluded.metadata;

  insert into public.hai_usage_events (
    user_id,
    request_id,
    event_type,
    route,
    status,
    input_tokens,
    output_tokens,
    total_tokens,
    metadata
  )
  values (
    v_user_id,
    p_request_id,
    'hai.request.started',
    p_route,
    'started',
    p_estimated_input_tokens,
    p_estimated_output_tokens,
    v_estimated_total,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return jsonb_build_object(
    'allowed', true,
    'request_id', p_request_id,
    'policy_key', v_policy.key,
    'daily_used', v_day_used,
    'daily_limit', v_policy.daily_token_limit,
    'weekly_used', v_week_used,
    'weekly_limit', v_policy.weekly_token_limit,
    'max_output_tokens', v_policy.max_output_tokens
  );
end;
$$;

grant execute on function public.hai_check_and_reserve_usage(text, text, integer, integer, jsonb) to authenticated;
