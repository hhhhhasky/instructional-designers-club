begin;

-- HAI Plus / Pro users now consume a one-time newcomer gift and purchased
-- points. Explicit admin beta access keeps the existing daily/weekly policy
-- and always takes precedence over the membership label.

create table if not exists public.hai_point_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance_tokens bigint not null default 0 check (balance_tokens >= 0),
  total_credited_tokens bigint not null default 0 check (total_credited_tokens >= 0),
  total_consumed_tokens bigint not null default 0 check (total_consumed_tokens >= 0),
  newcomer_grant_tokens bigint not null default 0 check (newcomer_grant_tokens >= 0),
  newcomer_granted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hai_point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  transaction_type text not null check (
    transaction_type in ('newcomer_gift', 'admin_add', 'purchase', 'usage', 'refund')
  ),
  token_delta bigint not null,
  points_delta numeric(14, 2) not null,
  tokens_per_point integer not null check (tokens_per_point > 0),
  request_id text unique,
  reason text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_hai_point_transactions_user_created
  on public.hai_point_transactions(user_id, created_at desc);

alter table public.hai_point_wallets enable row level security;
alter table public.hai_point_transactions enable row level security;

grant select on public.hai_point_wallets, public.hai_point_transactions to authenticated;

create policy "hai point wallets own or admin read"
  on public.hai_point_wallets for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "hai point transactions own or admin read"
  on public.hai_point_transactions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop trigger if exists update_hai_point_wallets_updated_at on public.hai_point_wallets;
create trigger update_hai_point_wallets_updated_at
  before update on public.hai_point_wallets
  for each row execute function public.update_updated_at_column();

insert into public.hai_runtime_settings (
  key, label, description, category, value, default_value, value_type,
  min_value, max_value, step, unit, enabled
)
values
  (
    'points.tokens_per_point', '每积分对应 Token',
    '积分与 Token 的统一换算比例。15 万 Token ÷ 1500 积分 = 100 Token/积分。',
    '积分与额度', to_jsonb(100::integer), to_jsonb(100::integer), 'integer',
    1, 1000000, 1, 'Token/积分', true
  ),
  (
    'points.cny_per_point', '每积分售价',
    '积分购买页用于计算套餐价格；当前为建议初始售价，可由运营调整。',
    '积分与额度', to_jsonb(0.10::numeric), to_jsonb(0.10::numeric), 'number',
    0.01, 10000, 0.01, '元/积分', true
  ),
  (
    'points.newcomer_plus_tokens', 'Plus 新人赠送 Token',
    'Plus 用户首次获得 HAI 权限时一次性赠送，用完即止。',
    '积分与额度', to_jsonb(150000::integer), to_jsonb(150000::integer), 'integer',
    0, 1000000000, 1000, 'Token', true
  ),
  (
    'points.newcomer_pro_tokens', 'Pro 新人赠送 Token',
    'Pro 用户首次获得 HAI 权限时一次性赠送，用完即止。',
    '积分与额度', to_jsonb(300000::integer), to_jsonb(300000::integer), 'integer',
    0, 1000000000, 1000, 'Token', true
  ),
  (
    'points.wecom_qr_url', '企业微信二维码地址',
    '积分购买页展示的企业微信二维码图片地址。请替换为正式企微二维码。',
    '积分与额度', to_jsonb('/images/hai/hai-register-qr.png'::text),
    to_jsonb('/images/hai/hai-register-qr.png'::text), 'string',
    null, null, null, null, true
  )
on conflict (key) do nothing;

-- Free is no longer a HAI quota tier. Plus / Pro policy rows remain available
-- for per-request and concurrency limits, but their daily/weekly values are no
-- longer consulted by the points path.
update public.hai_quota_policies set enabled = false where key = 'free';
update public.hai_invite_codes set status = 'disabled' where status = 'active';
revoke execute on function public.hai_redeem_invite_code(text) from public, anon, authenticated;

create or replace function public.hai_runtime_numeric(p_key text, p_fallback numeric)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when enabled and jsonb_typeof(value) = 'number' then (value #>> '{}')::numeric
        else null
      end
      from public.hai_runtime_settings
      where key = p_key
    ),
    p_fallback
  );
$$;

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

  if v_access_level not in ('plus', 'pro') then
    return v_wallet;
  end if;

  insert into public.hai_point_wallets(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_wallet
  from public.hai_point_wallets
  where user_id = p_user_id
  for update;

  if v_wallet.newcomer_granted_at is null then
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

revoke execute on function public.hai_runtime_numeric(text, numeric) from public, anon, authenticated;
revoke execute on function public.hai_ensure_points_wallet(uuid) from public, anon, authenticated;

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
    when coalesce(public.is_admin(), false) then true
    when exists (
      select 1 from public.hai_user_access access
      where access.user_id = p_user_id and access.access_source = 'admin'
    ) then exists (
      select 1 from public.hai_user_access access
      where access.user_id = p_user_id
        and access.access_source = 'admin'
        and access.status = 'active'
        and (access.expires_at is null or access.expires_at > now())
    )
    else exists (
      select 1 from public.profiles profile
      where profile.id = p_user_id and profile.access_level::text in ('plus', 'pro')
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
  v_access public.hai_user_access%rowtype;
  v_access_level text;
  v_is_admin boolean;
  v_wallet public.hai_point_wallets%rowtype;
begin
  if v_user_id is null then
    return jsonb_build_object('authenticated', false, 'allowed', false, 'reason', '请先登录。');
  end if;

  v_is_admin := coalesce(public.is_admin(), false);
  select * into v_access from public.hai_user_access where user_id = v_user_id;
  select access_level::text into v_access_level from public.profiles where id = v_user_id;

  if v_is_admin then
    return jsonb_build_object(
      'authenticated', true, 'allowed', true, 'is_admin', true,
      'status', 'admin', 'quota_mode', 'internal',
      'quota_policy_key', coalesce(v_access.quota_policy_key, 'beta')
    );
  end if;

  -- An explicit admin beta row always overrides the Plus / Pro label,
  -- including paused, revoked and expired states.
  if v_access.user_id is not null and v_access.access_source = 'admin' then
    if v_access.status <> 'active' then
      return jsonb_build_object(
        'authenticated', true, 'allowed', false, 'is_admin', false,
        'status', v_access.status, 'quota_mode', 'internal',
        'reason', '你的 HAI 内测资格当前不可用。'
      );
    end if;
    if v_access.expires_at is not null and v_access.expires_at <= now() then
      return jsonb_build_object(
        'authenticated', true, 'allowed', false, 'is_admin', false,
        'status', 'expired', 'quota_mode', 'internal',
        'reason', '你的 HAI 内测资格已到期。'
      );
    end if;
    return jsonb_build_object(
      'authenticated', true, 'allowed', true, 'is_admin', false,
      'status', v_access.status, 'quota_mode', 'internal',
      'quota_policy_key', coalesce(v_access.quota_policy_key, 'beta'),
      'expires_at', v_access.expires_at
    );
  end if;

  if v_access_level in ('plus', 'pro') then
    v_wallet := public.hai_ensure_points_wallet(v_user_id);
    return jsonb_build_object(
      'authenticated', true, 'allowed', true, 'is_admin', false,
      'status', 'active', 'quota_mode', 'points',
      'membership_level', v_access_level,
      'quota_policy_key', v_access_level
    );
  end if;

  return jsonb_build_object(
    'authenticated', true, 'allowed', false, 'is_admin', false,
    'reason', 'HAI 面向 Plus、Pro 和后台开通的内测用户开放，请联系管理员开通权限。'
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
  v_tokens_per_point integer := greatest(1, public.hai_runtime_numeric('points.tokens_per_point', 100)::integer);
begin
  if v_user_id is null then
    return jsonb_build_object('allowed', false, 'reason', '请先登录。', 'code', 'unauthenticated');
  end if;

  if not public.hai_has_access(v_user_id) then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'HAI 面向 Plus、Pro 和后台开通的内测用户开放。',
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
    v_policy_key := v_access_level;
  end if;

  select * into v_policy
  from public.hai_quota_policies
  where key = v_policy_key and enabled = true;

  if v_policy.key is null and v_quota_mode = 'internal' then
    select * into v_policy from public.hai_quota_policies
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
    select coalesce(sum(estimated_input_tokens + estimated_output_tokens), 0)::bigint
      into v_reserved_tokens
    from public.hai_request_reservations
    where user_id = v_user_id and status = 'active' and expires_at > now()
      and metadata ->> 'quota_mode' = 'points';

    if v_wallet.balance_tokens - v_reserved_tokens < v_estimated_total then
      return jsonb_build_object(
        'allowed', false,
        'reason', '积分不足，请购买积分后继续使用。',
        'code', 'points_insufficient',
        'balance_tokens', v_wallet.balance_tokens,
        'available_tokens', greatest(0, v_wallet.balance_tokens - v_reserved_tokens),
        'current_points', round(v_wallet.balance_tokens::numeric / v_tokens_per_point, 2),
        'required_points', round(v_estimated_total::numeric / v_tokens_per_point, 2)
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
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('quota_mode', v_quota_mode)
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
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('quota_mode', v_quota_mode)
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
  v_tokens_per_point integer := greatest(1, public.hai_runtime_numeric('points.tokens_per_point', 100)::integer);
  v_event_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  select * into v_reservation
  from public.hai_request_reservations
  where request_id = p_request_id
  for update;

  if v_reservation.id is null or v_reservation.status <> 'active' then
    return;
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
  v_tokens_per_point integer := greatest(1, public.hai_runtime_numeric('points.tokens_per_point', 100)::integer);
  v_cny_per_point numeric := greatest(0, public.hai_runtime_numeric('points.cny_per_point', 0.10));
  v_qr_url text;
begin
  if v_target is null then
    return jsonb_build_object('quota_mode', 'none', 'daily_used', 0, 'weekly_used', 0);
  end if;
  if v_target <> auth.uid() and not coalesce(public.is_admin(), false) then
    raise exception '无权限查看该用户 HAI 用量。';
  end if;

  select * into v_access from public.hai_user_access where user_id = v_target;
  select access_level::text into v_access_level from public.profiles where id = v_target;

  if coalesce(public.is_admin(), false) and v_target = auth.uid()
    or (v_access.user_id is not null and v_access.access_source = 'admin') then
    v_quota_mode := 'internal';
    v_policy_key := coalesce(v_access.quota_policy_key, 'beta');
  elsif v_access_level in ('plus', 'pro') then
    v_quota_mode := 'points';
    v_policy_key := v_access_level;
  else
    return jsonb_build_object('quota_mode', 'none', 'daily_used', 0, 'weekly_used', 0);
  end if;

  select * into v_policy from public.hai_quota_policies
  where key = v_policy_key and enabled = true;
  if v_policy.key is null and v_quota_mode = 'internal' then
    select * into v_policy from public.hai_quota_policies where key = 'beta' and enabled = true;
  end if;

  if v_quota_mode = 'points' then
    v_wallet := public.hai_ensure_points_wallet(v_target);
    select case
      when enabled and jsonb_typeof(value) = 'string' then value #>> '{}'
      else null
    end into v_qr_url
    from public.hai_runtime_settings where key = 'points.wecom_qr_url';

    return jsonb_build_object(
      'quota_mode', 'points',
      'policy_key', coalesce(v_policy.key, v_policy_key),
      'membership_level', v_access_level,
      'daily_used', 0, 'weekly_used', 0, 'daily_limit', 0, 'weekly_limit', 0,
      'balance_tokens', v_wallet.balance_tokens,
      'total_credited_tokens', v_wallet.total_credited_tokens,
      'total_consumed_tokens', v_wallet.total_consumed_tokens,
      'current_points', round(v_wallet.balance_tokens::numeric / v_tokens_per_point, 2),
      'credited_points', round(v_wallet.total_credited_tokens::numeric / v_tokens_per_point, 2),
      'consumed_points', round(v_wallet.total_consumed_tokens::numeric / v_tokens_per_point, 2),
      'newcomer_grant_points', round(v_wallet.newcomer_grant_tokens::numeric / v_tokens_per_point, 2),
      'tokens_per_point', v_tokens_per_point,
      'cny_per_point', v_cny_per_point,
      'wecom_qr_url', coalesce(v_qr_url, '/images/hai/hai-register-qr.png'),
      'single_request_token_limit', coalesce(v_policy.single_request_token_limit, 0),
      'max_output_tokens', coalesce(v_policy.max_output_tokens, 4096)
    );
  end if;

  select coalesce(sum(coalesce(total_tokens, 0)), 0)::bigint into v_day_used
  from public.hai_usage_events
  where user_id = v_target and status in ('completed', 'cached')
    and created_at >= date_trunc('day', now());
  select coalesce(sum(coalesce(total_tokens, 0)), 0)::bigint into v_week_used
  from public.hai_usage_events
  where user_id = v_target and status in ('completed', 'cached')
    and created_at >= date_trunc('week', now());

  return jsonb_build_object(
    'quota_mode', 'internal',
    'policy_key', coalesce(v_policy.key, v_policy_key),
    'daily_used', v_day_used,
    'weekly_used', v_week_used,
    'daily_limit', coalesce(v_policy.daily_token_limit, 0),
    'weekly_limit', coalesce(v_policy.weekly_token_limit, 0),
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
  v_access_level text;
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

  select access_level::text into v_access_level from public.profiles where id = p_user_id;
  if v_access_level is null then raise exception '用户不存在'; end if;
  if v_access_level not in ('plus', 'pro') then
    raise exception '仅可为 Plus 或 Pro 用户增加 HAI 积分';
  end if;

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

revoke execute on function public.hai_has_access(uuid) from public, anon;
revoke execute on function public.hai_access_status() from public, anon;
revoke execute on function public.hai_check_and_reserve_usage(text, text, integer, integer, jsonb) from public, anon;
revoke execute on function public.hai_finalize_usage(text, text, integer, integer, text, text, uuid, integer, jsonb) from public, anon;
revoke execute on function public.hai_usage_summary(uuid) from public, anon;

grant execute on function public.hai_has_access(uuid) to authenticated;
grant execute on function public.hai_access_status() to authenticated;
grant execute on function public.hai_check_and_reserve_usage(text, text, integer, integer, jsonb) to authenticated;
grant execute on function public.hai_finalize_usage(text, text, integer, integer, text, text, uuid, integer, jsonb) to authenticated;
grant execute on function public.hai_usage_summary(uuid) to authenticated;

commit;
