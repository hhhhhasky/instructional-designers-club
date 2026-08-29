begin;

-- 2015Plus keeps access to the legacy course system only. It does not receive
-- the HAI newcomer grant and cannot open V2; a purchased point balance unlocks
-- HAI without granting any V2 benefit.
alter type public.access_level add value if not exists 'plus2015' after 'plus';

create table if not exists public.hai_membership_point_grants (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  granted_tokens bigint not null default 0 check (granted_tokens >= 0),
  granted_points integer not null default 0 check (granted_points >= 0),
  tokens_per_point integer not null default 100 check (tokens_per_point > 0),
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  notified_at timestamptz
);

alter table public.hai_membership_point_grants enable row level security;

revoke all on table public.hai_membership_point_grants from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.hai_membership_point_grants from authenticated;
grant select on table public.hai_membership_point_grants to authenticated;

drop policy if exists "hai membership point grants own or admin read" on public.hai_membership_point_grants;
create policy "hai membership point grants own or admin read"
  on public.hai_membership_point_grants for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Preserve one-time semantics for accounts that received a newcomer gift
-- before this manual two-step workflow was introduced. This records existing
-- grants only; it does not credit any new points or send a new notification.
insert into public.hai_membership_point_grants (
  user_id,
  granted_tokens,
  granted_points,
  tokens_per_point,
  granted_at,
  notified_at
)
select
  wallet.user_id,
  wallet.newcomer_grant_tokens,
  round(wallet.newcomer_grant_tokens::numeric / ratio.tokens_per_point)::integer,
  ratio.tokens_per_point,
  wallet.newcomer_granted_at,
  wallet.newcomer_granted_at
from public.hai_point_wallets wallet
cross join lateral (
  select greatest(1, public.hai_runtime_numeric('points.tokens_per_point', 100)::integer) as tokens_per_point
) ratio
where wallet.newcomer_granted_at is not null
on conflict (user_id) do nothing;

-- Preserve the original 100-token accounting while making the user-facing
-- benefit exactly 1000 points. 1000 points = 100000 tokens internally.
update public.hai_runtime_settings
set
  label = '每积分对应 Token（仅内部计费）',
  description = '1000 积分首次赠送对应 100000 Token 实际消耗额度。',
  category = '积分与套餐'
where key = 'points.tokens_per_point';

insert into public.hai_runtime_settings (
  key, label, description, category, value, default_value, value_type,
  min_value, max_value, step, unit, enabled
)
values
  (
    'points.newcomer_grant_points', 'Plus/Pro 首次赠送积分',
    'Plus 和 Pro 用户一次性赠送的积分数量；2015Plus 不享受首次赠送。',
    '积分与套餐', to_jsonb(1000::integer), to_jsonb(1000::integer), 'integer',
    0, 1000000, 1, '积分', true
  )
on conflict (key) do nothing;

-- Any existing account can own points. Creating a wallet never grants points:
-- the administrator must first set the membership level and then explicitly
-- run the one-time newcomer grant for an eligible Plus/Pro account.
create or replace function public.hai_ensure_points_wallet(p_user_id uuid)
returns public.hai_point_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access_level text;
  v_wallet public.hai_point_wallets%rowtype;
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

  return v_wallet;
end;
$$;

revoke execute on function public.hai_ensure_points_wallet(uuid) from public, anon, authenticated;

create or replace function public.hai_admin_grant_newcomer_points(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access_level text;
  v_gift_points integer := greatest(
    0,
    public.hai_runtime_numeric('points.newcomer_grant_points', 1000)::integer
  );
  v_tokens_per_point integer := greatest(
    1,
    public.hai_runtime_numeric('points.tokens_per_point', 100)::integer
  );
  v_gift_tokens bigint;
  v_granted_user_id uuid;
  v_wallet public.hai_point_wallets%rowtype;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Permission denied: admin only';
  end if;

  select access_level::text
  into v_access_level
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception '用户不存在';
  end if;
  if v_access_level not in ('plus', 'pro') then
    raise exception '请先将用户等级调整为 Plus 或 Pro，再发放首次积分';
  end if;
  if v_gift_points <= 0 then
    raise exception '首次赠送积分当前为 0，请先在 HAI 配置中设置';
  end if;

  v_wallet := public.hai_ensure_points_wallet(p_user_id);
  if v_wallet.newcomer_granted_at is not null then
    raise exception '该用户已发放过首次 HAI 积分，不能重复发放';
  end if;

  v_gift_tokens := v_gift_points::bigint * v_tokens_per_point;

  insert into public.hai_membership_point_grants (
    user_id,
    granted_tokens,
    granted_points,
    tokens_per_point,
    granted_by,
    notified_at
  )
  values (
    p_user_id,
    v_gift_tokens,
    v_gift_points,
    v_tokens_per_point,
    auth.uid(),
    now()
  )
  on conflict (user_id) do nothing
  returning user_id into v_granted_user_id;

  if v_granted_user_id is null then
    raise exception '该用户已发放过首次 HAI 积分，不能重复发放';
  end if;

  update public.hai_point_wallets
  set
    balance_tokens = balance_tokens + v_gift_tokens,
    total_credited_tokens = total_credited_tokens + v_gift_tokens,
    newcomer_grant_tokens = v_gift_tokens,
    newcomer_granted_at = now(),
    updated_at = now()
  where user_id = p_user_id
  returning * into v_wallet;

  insert into public.hai_point_transactions (
    user_id,
    transaction_type,
    token_delta,
    points_delta,
    tokens_per_point,
    reason,
    metadata,
    created_by
  )
  values (
    p_user_id,
    'newcomer_gift',
    v_gift_tokens,
    v_gift_points,
    v_tokens_per_point,
    'HAI 开放，首次赠送积分',
    jsonb_build_object(
      'membership_level', v_access_level,
      'campaign', 'hai_opening_newcomer_points',
      'source', 'manual_admin'
    ),
    auth.uid()
  );

  insert into public.user_notifications (user_id, type, title, body, link)
  values (
    p_user_id,
    'credit_reward',
    'HAI 开放',
    '已赠送 ' || v_gift_points || ' 积分，用完即可购买积分继续使用。',
    '/hai/chat'
  );

  return jsonb_build_object(
    'user_id', p_user_id,
    'membership_level', v_access_level,
    'granted_points', v_gift_points,
    'current_points', round(v_wallet.balance_tokens::numeric / v_tokens_per_point, 2),
    'granted_at', v_wallet.newcomer_granted_at
  );
end;
$$;

revoke execute on function public.hai_admin_grant_newcomer_points(uuid) from public, anon;
grant execute on function public.hai_admin_grant_newcomer_points(uuid) to authenticated;

-- HAI access remains Plus/Pro only for the membership path. A plus2015 user
-- gains HAI solely through a positive wallet balance, which means points must
-- have been purchased or manually credited; grant-only setup does not unlock.
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
      select 1
      from public.profiles profile
      left join public.hai_point_wallets wallet on wallet.user_id = profile.id
      where profile.id = p_user_id
        and (
          (profile.access_level::text in ('plus', 'pro'))
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
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_access public.hai_user_access%rowtype;
  v_access_level text;
  v_wallet public.hai_point_wallets%rowtype;
begin
  if v_user_id is null then
    return jsonb_build_object('authenticated', false, 'allowed', false, 'reason', '请先登录。');
  end if;

  if coalesce(public.is_admin(), false) then
    select * into v_access from public.hai_user_access where user_id = v_user_id;
    return jsonb_build_object(
      'authenticated', true, 'allowed', true, 'is_admin', true,
      'status', 'admin', 'quota_mode', 'internal',
      'quota_policy_key', coalesce(v_access.quota_policy_key, 'beta')
    );
  end if;

  select * into v_access from public.hai_user_access where user_id = v_user_id;
  select access_level::text into v_access_level from public.profiles where id = v_user_id;

  if v_access.user_id is not null and v_access.access_source = 'admin' then
    if v_access.status <> 'active' or (v_access.expires_at is not null and v_access.expires_at <= now()) then
      return jsonb_build_object(
        'authenticated', true, 'allowed', false, 'is_admin', false,
        'status', case when v_access.status <> 'active' then v_access.status else 'expired' end,
        'quota_mode', 'internal',
        'reason', '你的 HAI 内测资格当前不可用。'
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

  if v_access_level = 'plus2015' then
    v_wallet := public.hai_ensure_points_wallet(v_user_id);
    if v_wallet.balance_tokens > 0 then
      return jsonb_build_object(
        'authenticated', true, 'allowed', true, 'is_admin', false,
        'status', 'active', 'quota_mode', 'points',
        'membership_level', v_access_level,
        'quota_policy_key', 'plus2015'
      );
    end if;
    return jsonb_build_object(
      'authenticated', true, 'allowed', false, 'is_admin', false,
      'status', 'needs_points', 'quota_mode', 'none',
      'membership_level', v_access_level,
      'reason', '2015Plus 可购买 HAI 积分后使用；当前积分余额为 0。'
    );
  end if;

  return jsonb_build_object(
    'authenticated', true, 'allowed', false, 'is_admin', false,
    'reason', 'HAI 面向 Plus、Pro 和后台开通的内测用户开放；2015Plus 可购买积分后使用。'
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

-- Record exact actual token consumption per request and persist the converted
-- point charge in the wallet and ledger. 100 Token = 1 point by current rule.
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
        'actual_tokens', v_input + v_output,
        'actual_input_tokens', v_input,
        'actual_output_tokens', v_output
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

-- V2 remains limited to Plus/Pro (and admin/editor). The wallet purchase path
-- deliberately does not grant V2; 2015Plus must not receive it.
create or replace function private.v2_user_has_access()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select (select auth.uid()) is not null
    and (
      exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid())
          and p.role in ('admin', 'editor')
          and p.status = 'active'
      )
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid())
          and p.status = 'active'
          and p.access_level::text in ('plus', 'pro')
      )
      or exists (
        select 1
        from public.v2_course_access a
        where a.user_id = (select auth.uid())
          and a.status = 'active'
          and (a.starts_at is null or a.starts_at <= now())
          and (a.expires_at is null or a.expires_at > now())
      )
    );
$$;

revoke execute on function private.v2_user_has_access() from public, anon;
grant execute on function private.v2_user_has_access() to authenticated;

revoke execute on function public.hai_has_access(uuid) from public, anon;
revoke execute on function public.hai_access_status() from public, anon;
revoke execute on function public.hai_check_and_reserve_usage(text, text, integer, integer, jsonb) from public, anon;
revoke execute on function public.hai_finalize_usage(text, text, integer, integer, text, text, uuid, integer, jsonb) from public, anon;
revoke execute on function public.hai_usage_summary(uuid) from public, anon;
revoke execute on function public.hai_admin_add_points(uuid, integer, text) from public, anon;

grant execute on function public.hai_has_access(uuid) to authenticated;
grant execute on function public.hai_access_status() to authenticated;
grant execute on function public.hai_check_and_reserve_usage(text, text, integer, integer, jsonb) to authenticated;
grant execute on function public.hai_finalize_usage(text, text, integer, integer, text, text, uuid, integer, jsonb) to authenticated;
grant execute on function public.hai_usage_summary(uuid) to authenticated;
grant execute on function public.hai_admin_add_points(uuid, integer, text) to authenticated;

-- Keep V1 教学通识课 access for plus2015: the protected content entitlement
-- treats plus2015 as Plus for V1; V2 uses its explicit allow-list above.
create or replace function public.can_access_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(public.is_admin(), false)
    or exists (
      select 1
      from public.courses c
      where c.id = p_course_id
        and c.status = 'published'
        and (
          c.membership_type = 'free'
          or c.is_trial = true
          or exists (
            select 1
            from public.profiles p
            where p.id = (select auth.uid())
              and p.status = 'active'
              and (
                case p.access_level::text
                  when 'free' then 0
                  when 'plus2015' then 1
                  when 'plus' then 1
                  when 'pro' then 2
                end
              ) >= (
                case c.membership_type
                  when 'free' then 0
                  when 'plus' then 1
                  when 'pro' then 2
                end
              )
          )
        )
    );
$$;

create or replace function public.admin_update_user_access_level(
  p_user_id uuid,
  p_new_level text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_level text;
  v_title text;
  v_body text;
  v_result json;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Permission denied: admin only';
  end if;
  if p_new_level not in ('free', 'plus', 'plus2015', 'pro') then
    raise exception 'Invalid access_level: %', p_new_level;
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Cannot modify own access level';
  end if;

  select access_level::text into v_old_level
  from public.profiles
  where id = p_user_id;
  if not found then
    raise exception '用户不存在';
  end if;

  update public.profiles
  set access_level = p_new_level::public.access_level
  where id = p_user_id;

  v_title := '你的会员等级已变更';
  v_body := '你的等级已从 ' || upper(v_old_level) || ' 调整为 ' || upper(p_new_level);
  insert into public.user_notifications (user_id, type, title, body, link)
  values (p_user_id, 'level_change', v_title, v_body, '/learning');

  select json_build_object('id', p_user_id, 'access_level', p_new_level)
  into v_result;
  return v_result;
end;
$$;

revoke execute on function public.can_access_course(uuid) from public, anon;
grant execute on function public.can_access_course(uuid) to authenticated, service_role;
revoke execute on function public.admin_update_user_access_level(uuid, text) from public, anon;
grant execute on function public.admin_update_user_access_level(uuid, text) to authenticated;

commit;
