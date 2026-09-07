begin;

insert into public.hai_feature_modules (
  slug, name, short_label, description, icon_key, category, input_schema,
  default_model, default_temperature, default_max_output_tokens,
  thinking_enabled, sort_order, is_enabled, surface_mode
)
values (
  'image-generation', '图片生成', '生图',
  '面向课堂、课件和教学传播场景，根据提示词生成可保存、可下载的图片。',
  'image-plus', 'HAI Work',
  '[{"name":"prompt","label":"提示词","type":"textarea","required":true},{"name":"size","label":"图片尺寸","type":"text","required":false},{"name":"style","label":"PPT 艺术风格","type":"text","required":false},{"name":"image_type","label":"图片类型","type":"text","required":false}]'::jsonb,
  'deepseek-v4-flash', 0.25, 4096, false, 40, true, 'work'
)
on conflict (slug) do update set
  name = excluded.name,
  short_label = excluded.short_label,
  description = excluded.description,
  icon_key = excluded.icon_key,
  category = excluded.category,
  input_schema = excluded.input_schema,
  sort_order = excluded.sort_order,
  is_enabled = true,
  surface_mode = 'work',
  updated_at = now();

create table if not exists public.hai_image_generation_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.hai_image_generation_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.hai_image_generation_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_run_id uuid references public.hai_image_generation_runs(id) on delete set null,
  client_request_id text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  prompt text not null,
  composed_prompt text not null,
  image_size text not null,
  art_style text not null,
  image_type text not null,
  provider text,
  model text,
  provider_task_id text,
  source_url text,
  r2_key text,
  image_url text,
  error_message text,
  provider_response jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  duration_ms integer,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, client_request_id)
);

create index if not exists idx_hai_image_tasks_user_updated
  on public.hai_image_generation_tasks(user_id, status, updated_at desc);
create index if not exists idx_hai_image_runs_task_created
  on public.hai_image_generation_runs(task_id, created_at asc);
create index if not exists idx_hai_image_runs_user_created
  on public.hai_image_generation_runs(user_id, created_at desc);

drop trigger if exists update_hai_image_generation_tasks_updated_at on public.hai_image_generation_tasks;
create trigger update_hai_image_generation_tasks_updated_at
  before update on public.hai_image_generation_tasks
  for each row execute function public.update_updated_at_column();
drop trigger if exists update_hai_image_generation_runs_updated_at on public.hai_image_generation_runs;
create trigger update_hai_image_generation_runs_updated_at
  before update on public.hai_image_generation_runs
  for each row execute function public.update_updated_at_column();

alter table public.hai_image_generation_tasks enable row level security;
alter table public.hai_image_generation_runs enable row level security;
revoke all on public.hai_image_generation_tasks, public.hai_image_generation_runs from anon;
grant select on public.hai_image_generation_tasks, public.hai_image_generation_runs to authenticated;
grant all on public.hai_image_generation_tasks, public.hai_image_generation_runs to service_role;

drop policy if exists "hai image tasks owner read" on public.hai_image_generation_tasks;
create policy "hai image tasks owner read"
  on public.hai_image_generation_tasks for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "hai image runs owner read" on public.hai_image_generation_runs;
create policy "hai image runs owner read"
  on public.hai_image_generation_runs for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create or replace function public.hai_check_and_reserve_image_generation(
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
  v_access public.hai_user_access%rowtype;
  v_policy public.hai_quota_policies%rowtype;
  v_wallet public.hai_point_wallets%rowtype;
  v_access_level text;
  v_quota_mode text;
  v_policy_key text;
  v_tokens_per_point integer := greatest(1, public.hai_runtime_numeric('points.tokens_per_point', 100)::integer);
  v_image_points numeric := 20;
  v_fixed_tokens bigint;
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

  v_fixed_tokens := greatest(1, ceil(v_image_points * v_tokens_per_point));
  perform pg_advisory_xact_lock(hashtextextended('hai_usage_gate', 0));
  select * into v_access from public.hai_user_access where user_id = v_user_id;
  select access_level::text into v_access_level from public.profiles where id = v_user_id;
  if coalesce(public.is_admin(), false)
    or (v_access.user_id is not null and v_access.access_source = 'admin') then
    v_quota_mode := 'internal';
    v_policy_key := coalesce(v_access.quota_policy_key, 'internal');
  else
    v_quota_mode := 'points';
    v_policy_key := v_access_level;
  end if;
  select * into v_policy from public.hai_quota_policies where key = v_policy_key and enabled;
  if v_policy.key is null and v_quota_mode = 'internal' then
    select * into v_policy from public.hai_quota_policies where key = 'internal' and enabled;
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
      and metadata ->> 'billing_mode' = 'image_generation_fixed_v1';
    if v_wallet.balance_tokens - v_reserved_tokens < v_fixed_tokens then
      return jsonb_build_object(
        'allowed', false, 'reason', '积分不足，本次图片生成需要 20 积分。', 'code', 'points_insufficient',
        'current_points', round(v_wallet.balance_tokens::numeric / v_tokens_per_point, 2),
        'required_points', v_image_points
      );
    end if;
  end if;

  v_result := coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
    'quota_mode', v_quota_mode,
    'billing_mode', 'image_generation_fixed_v1',
    'fixed_charge_tokens', v_fixed_tokens,
    'fixed_charge_points', v_image_points,
    'image_unit_points', v_image_points
  );
  insert into public.hai_request_reservations (
    request_id, user_id, route, estimated_input_tokens, estimated_output_tokens, metadata
  ) values (p_request_id, v_user_id, p_route, 0, 0, v_result)
  on conflict (request_id) do update set
    status = 'active', expires_at = now() + interval '5 minutes',
    estimated_input_tokens = 0, estimated_output_tokens = 0, metadata = excluded.metadata;
  insert into public.hai_usage_events (
    user_id, request_id, event_type, route, status, input_tokens, output_tokens, total_tokens, metadata
  ) values (v_user_id, p_request_id, 'hai.image_generation.started', p_route, 'started', 0, 0, 0, v_result);
  return jsonb_build_object(
    'allowed', true, 'request_id', p_request_id, 'quota_mode', v_quota_mode,
    'current_points', case when v_quota_mode = 'points' then round(v_wallet.balance_tokens::numeric / v_tokens_per_point, 2) else null end,
    'required_points', v_image_points
  );
end;
$$;

create or replace function public.hai_finalize_image_generation(
  p_request_id text,
  p_status text,
  p_route text default 'hai-image-generation',
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
  v_user_id uuid := auth.uid();
  v_reservation public.hai_request_reservations%rowtype;
  v_wallet public.hai_point_wallets%rowtype;
  v_tokens_per_point integer := greatest(1, public.hai_runtime_numeric('points.tokens_per_point', 100)::integer);
  v_fixed_tokens bigint;
  v_metadata jsonb;
begin
  if v_user_id is null then raise exception '请先登录。'; end if;
  select * into v_reservation from public.hai_request_reservations
  where request_id = p_request_id and user_id = v_user_id for update;
  if not found then raise exception '用量预留不存在或无权结算。'; end if;
  if v_reservation.status in ('completed', 'failed', 'expired') then return; end if;
  v_metadata := coalesce(v_reservation.metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb);
  v_fixed_tokens := greatest(0, coalesce((v_reservation.metadata ->> 'fixed_charge_tokens')::bigint, 0));
  if p_status = 'completed' and v_reservation.metadata ->> 'quota_mode' = 'points' and v_fixed_tokens > 0 then
    v_wallet := public.hai_ensure_points_wallet(v_user_id);
    if v_wallet.balance_tokens < v_fixed_tokens then raise exception '图片生成积分不足，无法结算。'; end if;
    update public.hai_point_wallets set
      balance_tokens = balance_tokens - v_fixed_tokens,
      total_consumed_tokens = total_consumed_tokens + v_fixed_tokens
    where user_id = v_user_id;
    insert into public.hai_point_transactions (
      user_id, transaction_type, token_delta, points_delta, tokens_per_point, request_id, reason, metadata
    ) values (
      v_user_id, 'usage', -v_fixed_tokens,
      -round(v_fixed_tokens::numeric / v_tokens_per_point, 2), v_tokens_per_point,
      p_request_id, 'HAI 图片生成', v_metadata
    );
  end if;
  update public.hai_request_reservations set
    status = case when p_status = 'completed' then 'completed' else 'failed' end,
    actual_input_tokens = 0, actual_output_tokens = 0,
    completed_at = now(), expires_at = now()
  where request_id = p_request_id and user_id = v_user_id;
  insert into public.hai_usage_events (
    user_id, request_id, event_type, route, status, entity_type, entity_id,
    input_tokens, output_tokens, total_tokens, duration_ms, metadata
  ) values (
    v_user_id, p_request_id, 'hai.image_generation.finished', p_route,
    case when p_status = 'completed' then 'completed' else 'failed' end,
    'hai_image_generation_task', p_entity_id, 0, 0, 0, p_duration_ms, v_metadata
  );
end;
$$;

revoke execute on function public.hai_check_and_reserve_image_generation(text, text, jsonb) from public, anon;
revoke execute on function public.hai_finalize_image_generation(text, text, text, uuid, integer, jsonb) from public, anon;
grant execute on function public.hai_check_and_reserve_image_generation(text, text, jsonb) to authenticated;
grant execute on function public.hai_finalize_image_generation(text, text, text, uuid, integer, jsonb) to authenticated;

commit;
