begin;

-- Purchase packages are configured independently so operations can change the
-- displayed point quantity and selling price without exposing the internal
-- Token conversion on user-facing pages. The enabled flag on each package's
-- points setting controls whether that package appears for purchase.
insert into public.hai_runtime_settings (
  key, label, description, category, value, default_value, value_type,
  min_value, max_value, step, unit, enabled
)
values
  (
    'points.package_1_points', '套餐一积分数量',
    '积分购买页第一档套餐包含的积分数量；关闭后该套餐不在前台显示。',
    '积分与套餐', to_jsonb(10::integer), to_jsonb(10::integer), 'integer',
    1, 1000000, 1, '积分', true
  ),
  (
    'points.package_1_price_cny', '套餐一价格',
    '积分购买页第一档套餐的实际售价。',
    '积分与套餐', to_jsonb(1::numeric), to_jsonb(1::numeric), 'number',
    0.01, 1000000, 0.01, '元', true
  ),
  (
    'points.package_2_points', '套餐二积分数量',
    '积分购买页第二档套餐包含的积分数量；关闭后该套餐不在前台显示。',
    '积分与套餐', to_jsonb(100::integer), to_jsonb(100::integer), 'integer',
    1, 1000000, 1, '积分', true
  ),
  (
    'points.package_2_price_cny', '套餐二价格',
    '积分购买页第二档套餐的实际售价。',
    '积分与套餐', to_jsonb(10::numeric), to_jsonb(10::numeric), 'number',
    0.01, 1000000, 0.01, '元', true
  ),
  (
    'points.package_3_points', '套餐三积分数量',
    '积分购买页第三档套餐包含的积分数量；关闭后该套餐不在前台显示。',
    '积分与套餐', to_jsonb(1000::integer), to_jsonb(1000::integer), 'integer',
    1, 1000000, 1, '积分', false
  ),
  (
    'points.package_3_price_cny', '套餐三价格',
    '积分购买页第三档套餐的实际售价。',
    '积分与套餐', to_jsonb(100::numeric), to_jsonb(100::numeric), 'number',
    0.01, 1000000, 0.01, '元', true
  )
on conflict (key) do nothing;

update public.hai_runtime_settings
set
  label = '每积分对应 Token（仅内部计费）',
  description = '仅用于后台扣费和积分折算，不在任何用户前台展示。',
  category = '积分与套餐'
where key = 'points.tokens_per_point';

update public.hai_runtime_settings
set
  label = '积分参考单价',
  description = '仅作为运营参考；购买页以每个套餐单独配置的价格为准。',
  category = '积分与套餐'
where key = 'points.cny_per_point';

update public.hai_runtime_settings
set
  value = to_jsonb('/哈老师企微二维码.png'::text),
  default_value = to_jsonb('/哈老师企微二维码.png'::text),
  label = '企业微信二维码地址',
  description = '积分购买页展示的企业微信二维码图片地址。',
  category = '积分与套餐',
  enabled = true
where key = 'points.wecom_qr_url';

-- Every existing account may own and purchase points. The one-time newcomer
-- grant remains exclusive to Plus/Pro; legacy free accounts start at zero and
-- can receive purchased points without gaining HAI access automatically.
create or replace function public.hai_ensure_points_wallet(p_user_id uuid)
returns public.hai_point_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access_level text;
  v_wallet public.hai_point_wallets%rowtype;
  v_gift_tokens bigint := 0;
  v_tokens_per_point integer := greatest(1, public.hai_runtime_numeric('points.tokens_per_point', 100)::integer);
begin
  select access_level::text into v_access_level
  from public.profiles
  where id = p_user_id;

  if v_access_level is null then
    raise exception '用户不存在';
  end if;

  insert into public.hai_point_wallets(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_wallet
  from public.hai_point_wallets
  where user_id = p_user_id
  for update;

  if v_access_level in ('plus', 'pro') and v_wallet.newcomer_granted_at is null then
    v_gift_tokens := greatest(
      0,
      public.hai_runtime_numeric(
        case when v_access_level = 'pro'
          then 'points.newcomer_pro_tokens'
          else 'points.newcomer_plus_tokens'
        end,
        case when v_access_level = 'pro' then 300000 else 150000 end
      )::bigint
    );

    update public.hai_point_wallets
    set
      balance_tokens = balance_tokens + v_gift_tokens,
      total_credited_tokens = total_credited_tokens + v_gift_tokens,
      newcomer_grant_tokens = v_gift_tokens,
      newcomer_granted_at = now()
    where user_id = p_user_id
    returning * into v_wallet;

    insert into public.hai_point_transactions (
      user_id, transaction_type, token_delta, points_delta,
      tokens_per_point, reason, metadata
    )
    values (
      p_user_id,
      'newcomer_gift',
      v_gift_tokens,
      round(v_gift_tokens::numeric / v_tokens_per_point, 2),
      v_tokens_per_point,
      case when v_access_level = 'pro' then 'Pro 新人一次性赠送' else 'Plus 新人一次性赠送' end,
      jsonb_build_object('membership_level', v_access_level)
    );
  end if;

  return v_wallet;
end;
$$;

revoke execute on function public.hai_ensure_points_wallet(uuid) from public, anon, authenticated;

-- Return point-denominated display values for every quota mode. Internal beta
-- users still consume the daily/weekly token policy; current_points and
-- consumed_points are only the UI conversion of that effective weekly quota.
-- wallet_points remains the separately purchased balance and is not consumed
-- while the internal quota has priority.
create or replace function public.hai_usage_summary(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid := coalesce(p_user_id, auth.uid());
  v_access public.hai_user_access%rowtype;
  v_policy public.hai_quota_policies%rowtype;
  v_wallet public.hai_point_wallets%rowtype;
  v_access_level text;
  v_policy_key text;
  v_quota_mode text;
  v_day_used bigint := 0;
  v_week_used bigint := 0;
  v_qr_url text;
  v_point_packages jsonb := '[]'::jsonb;
begin
  if v_target is null then
    return jsonb_build_object('quota_mode', 'none', 'daily_used', 0, 'weekly_used', 0);
  end if;
  if v_target <> auth.uid() and not coalesce(public.is_admin(), false) then
    raise exception '无权限查看该用户 HAI 用量。';
  end if;

  select * into v_access from public.hai_user_access where user_id = v_target;
  select access_level::text into v_access_level from public.profiles where id = v_target;
  if v_access_level is null then
    raise exception '用户不存在';
  end if;

  v_wallet := public.hai_ensure_points_wallet(v_target);
  select case
    when enabled and jsonb_typeof(value) = 'string' then value #>> '{}'
    else null
  end into v_qr_url
  from public.hai_runtime_settings where key = 'points.wecom_qr_url';

  select coalesce(jsonb_agg(package order by slot), '[]'::jsonb)
  into v_point_packages
  from (
    select
      1 as slot,
      jsonb_build_object(
        'points', greatest(1, public.hai_runtime_numeric('points.package_1_points', 10)::integer),
        'price_cny', greatest(0.01, public.hai_runtime_numeric('points.package_1_price_cny', 1))
      ) as package
    where coalesce((select enabled from public.hai_runtime_settings where key = 'points.package_1_points'), true)
    union all
    select
      2 as slot,
      jsonb_build_object(
        'points', greatest(1, public.hai_runtime_numeric('points.package_2_points', 100)::integer),
        'price_cny', greatest(0.01, public.hai_runtime_numeric('points.package_2_price_cny', 10))
      ) as package
    where coalesce((select enabled from public.hai_runtime_settings where key = 'points.package_2_points'), true)
    union all
    select
      3 as slot,
      jsonb_build_object(
        'points', greatest(1, public.hai_runtime_numeric('points.package_3_points', 1000)::integer),
        'price_cny', greatest(0.01, public.hai_runtime_numeric('points.package_3_price_cny', 100))
      ) as package
    where coalesce((select enabled from public.hai_runtime_settings where key = 'points.package_3_points'), false)
  ) configured_packages;

  if coalesce(public.is_admin(), false) and v_target = auth.uid()
    or (v_access.user_id is not null and v_access.access_source = 'admin') then
    v_quota_mode := 'internal';
    v_policy_key := coalesce(v_access.quota_policy_key, 'beta');
  elsif v_access_level in ('plus', 'pro') then
    v_quota_mode := 'points';
    v_policy_key := v_access_level;
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
    'membership_level', case when v_access_level in ('plus', 'pro') then v_access_level else null end,
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

create or replace function public.hai_admin_add_points(
  p_user_id uuid,
  p_points integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_exists boolean;
  v_wallet public.hai_point_wallets%rowtype;
  v_tokens_per_point integer := greatest(1, public.hai_runtime_numeric('points.tokens_per_point', 100)::integer);
  v_token_delta bigint;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Permission denied: admin only';
  end if;
  if p_points is null or p_points <= 0 then
    raise exception '增加积分必须大于 0';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception '增加积分原因不能为空';
  end if;

  select exists(select 1 from public.profiles where id = p_user_id) into v_user_exists;
  if not v_user_exists then raise exception '用户不存在'; end if;

  v_wallet := public.hai_ensure_points_wallet(p_user_id);
  v_token_delta := p_points::bigint * v_tokens_per_point;

  update public.hai_point_wallets
  set
    balance_tokens = balance_tokens + v_token_delta,
    total_credited_tokens = total_credited_tokens + v_token_delta
  where user_id = p_user_id
  returning * into v_wallet;

  insert into public.hai_point_transactions (
    user_id, transaction_type, token_delta, points_delta,
    tokens_per_point, reason, created_by
  )
  values (
    p_user_id, 'admin_add', v_token_delta, p_points,
    v_tokens_per_point, btrim(p_reason), auth.uid()
  );

  return jsonb_build_object(
    'user_id', p_user_id,
    'added_points', p_points,
    'current_points', round(v_wallet.balance_tokens::numeric / v_tokens_per_point, 2),
    'balance_tokens', v_wallet.balance_tokens,
    'tokens_per_point', v_tokens_per_point
  );
end;
$$;

revoke execute on function public.hai_admin_add_points(uuid, integer, text) from public, anon;
grant execute on function public.hai_admin_add_points(uuid, integer, text) to authenticated;
revoke execute on function public.hai_usage_summary(uuid) from public, anon;
grant execute on function public.hai_usage_summary(uuid) to authenticated;

commit;
