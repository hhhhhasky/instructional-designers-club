begin;

-- Dynamic packages replace the three fixed runtime-setting slots. Marketing
-- values are editable strings so operations can calibrate examples without a
-- code change; purchase calculations still use points and price only.
create table if not exists public.hai_point_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  points integer not null check (points >= 1),
  price_cny numeric(10, 2) not null check (price_cny >= 0.01),
  description text not null default '',
  value_metrics text not null default '',
  is_enabled boolean not null default true,
  is_recommended boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hai_point_packages_points_price_unique unique (points, price_cny)
);

alter table public.hai_point_packages enable row level security;

revoke all on table public.hai_point_packages from public, anon;
grant select on table public.hai_point_packages to authenticated;

drop policy if exists "hai point packages authenticated read" on public.hai_point_packages;
create policy "hai point packages authenticated read"
  on public.hai_point_packages for select to authenticated
  using (is_enabled or (select public.is_admin()));

drop policy if exists "hai point packages admin write" on public.hai_point_packages;
create policy "hai point packages admin write"
  on public.hai_point_packages for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop trigger if exists update_hai_point_packages_updated_at on public.hai_point_packages;
create trigger update_hai_point_packages_updated_at
  before update on public.hai_point_packages
  for each row execute function public.update_updated_at_column();

insert into public.hai_point_packages (
  name, points, price_cny, description, value_metrics,
  is_enabled, is_recommended, sort_order
)
values
  (
    '体验包', 100, 9.90,
    '适合第一次真实体验 HAI 答疑。',
    '约完成 9 次答疑' || chr(10) || '约 1 次 HAI 辅助工作', true, false, 10
  ),
  (
    '备课包', 500, 29.90,
    '适合一个阶段的日常备课和答疑。',
    '约完成 45 次答疑' || chr(10) || '约 5 次 HAI 辅助工作', true, true, 20
  ),
  (
    '学期包', 1000, 49.90,
    '适合高频备课、多轮修改和教案打磨。',
    '约完成 90 次答疑' || chr(10) || '约 10 次 HAI 辅助工作' || chr(10) || '约产出 10 份初稿教案', true, false, 30
  ),
  (
    '团队包', 3000, 129.00,
    '适合备课组合连续使用和完整教研输出。',
    '约完成 270 次答疑' || chr(10) || '约 30 次 HAI 辅助工作' || chr(10) || '约产出 30 份初稿教案', true, false, 40
  )
on conflict (points, price_cny) do nothing;

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

revoke execute on function public.hai_usage_summary(uuid) from public, anon;
grant execute on function public.hai_usage_summary(uuid) to authenticated;

commit;
