begin;

-- Replace the single shared newcomer amount with per-level point settings.
-- Old token settings are retained for audit visibility but disabled so they
-- can no longer be mistaken for the active grant source.
insert into public.hai_runtime_settings (
  key, label, description, category, value, default_value, value_type,
  min_value, max_value, step, unit, enabled
)
values
  (
    'points.newcomer_plus_points', 'Plus 首次赠送积分',
    'Plus 用户一次性赠送的积分数量；2015Plus 不享受首次赠送。',
    '积分与套餐', to_jsonb(200::integer), to_jsonb(200::integer), 'integer',
    0, 1000000, 1, '积分', true
  ),
  (
    'points.newcomer_pro_points', 'Pro 首次赠送积分',
    'Pro 用户一次性赠送的积分数量；2015Plus 不享受首次赠送。',
    '积分与套餐', to_jsonb(500::integer), to_jsonb(500::integer), 'integer',
    0, 1000000, 1, '积分', true
  )
on conflict (key) do nothing;

update public.hai_runtime_settings
set
  label = 'Plus/Pro 首次赠送积分（已停用）',
  description = '旧的单档配置已由 Plus/Pro 独立配置替代，仅为历史审计保留。',
  enabled = false,
  updated_at = now()
where key = 'points.newcomer_grant_points';

update public.hai_runtime_settings
set enabled = false, updated_at = now()
where key in ('points.newcomer_plus_tokens', 'points.newcomer_pro_tokens');

create or replace function public.hai_admin_grant_newcomer_points(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access_level text;
  v_gift_points integer := 0;
  v_tokens_per_point integer := greatest(
    1,
    public.hai_runtime_numeric('points.tokens_per_point', 1000)::integer
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

  v_gift_points := greatest(
    0,
    public.hai_runtime_numeric(
      case when v_access_level = 'pro'
        then 'points.newcomer_pro_points'
        else 'points.newcomer_plus_points'
      end,
      case when v_access_level = 'pro' then 500 else 200 end
    )::integer
  );
  if v_gift_points <= 0 then
    raise exception '当前等级首次赠送积分为 0，请先在 HAI 配置中设置';
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

commit;
