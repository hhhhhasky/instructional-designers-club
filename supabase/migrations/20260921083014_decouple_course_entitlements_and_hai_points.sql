begin;

-- Correct the historical typo without discarding any existing membership data.
do $$
begin
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'access_level' and e.enumlabel = 'plus2015'
  ) and not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'access_level' and e.enumlabel = 'plus2025'
  ) then
    alter type public.access_level rename value 'plus2015' to 'plus2025';
  end if;
end
$$;

create table public.course_access_products (
  code text primary key,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_grantable boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.membership_course_access (
  access_level public.access_level not null,
  product_code text not null references public.course_access_products(code) on update cascade on delete restrict,
  created_at timestamptz not null default now(),
  primary key (access_level, product_code)
);

create table public.user_course_entitlements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_code text not null references public.course_access_products(code) on update cascade on delete restrict,
  status text not null default 'active' check (status in ('active', 'revoked')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  notes text,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_code),
  check (expires_at is null or expires_at > starts_at)
);

create index user_course_entitlements_active_idx
  on public.user_course_entitlements(user_id, product_code)
  where status = 'active';

insert into public.course_access_products (code, name, description, status, is_grantable, sort_order)
values
  ('teaching-general-v1', '教学通识课', '第一版教学通识课', 'published', true, 10),
  ('teaching-general-v2', '教学通识课 V2', '暂仅管理员可访问', 'published', false, 20),
  ('teacher-ai', '教师 AI 课', '教师 AI 系列课程', 'published', true, 30),
  ('daofa-textbook', '道法教材解读课', '道德与法治教材解读课程', 'published', true, 40);

insert into public.membership_course_access (access_level, product_code)
values
  ('plus2025', 'teaching-general-v1'),
  ('plus', 'teaching-general-v1'),
  ('pro', 'teaching-general-v1'),
  ('pro', 'teacher-ai');

alter table public.courses
  add column access_product_code text references public.course_access_products(code) on update cascade on delete restrict;

update public.courses
set access_product_code = case membership_type
  when 'plus' then 'teaching-general-v1'
  when 'pro' then 'teacher-ai'
  else null
end
where access_product_code is null;

comment on column public.courses.access_product_code is
  '课程的稳定授权产品编码；为空时仅免费/试看课可公开访问。';

alter table public.course_access_products enable row level security;
alter table public.membership_course_access enable row level security;
alter table public.user_course_entitlements enable row level security;

revoke all on public.course_access_products, public.membership_course_access, public.user_course_entitlements
  from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on public.course_access_products, public.membership_course_access, public.user_course_entitlements
  from authenticated;
grant select on public.course_access_products, public.membership_course_access, public.user_course_entitlements
  to authenticated;
grant select (access_product_code) on public.courses to anon, authenticated;

create policy "published course access products readable"
  on public.course_access_products for select to authenticated
  using (status = 'published' or (select public.is_admin()));

create policy "membership course mappings readable"
  on public.membership_course_access for select to authenticated
  using (true);

create policy "course entitlements own or admin read"
  on public.user_course_entitlements for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create or replace function public.admin_set_user_course_access(
  p_user_id uuid,
  p_product_code text,
  p_enabled boolean,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.course_access_products%rowtype;
  v_result public.user_course_entitlements%rowtype;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Permission denied: admin only';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Cannot modify own course access';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception '用户不存在';
  end if;

  select * into v_product
  from public.course_access_products
  where code = p_product_code;

  if v_product.code is null or v_product.status <> 'published' or not v_product.is_grantable then
    raise exception '该课程当前不可授权';
  end if;

  insert into public.user_course_entitlements (
    user_id, product_code, status, starts_at, expires_at, notes, granted_by, updated_at
  ) values (
    p_user_id, p_product_code, case when p_enabled then 'active' else 'revoked' end,
    now(), null, nullif(trim(coalesce(p_notes, '')), ''), auth.uid(), now()
  )
  on conflict (user_id, product_code) do update set
    status = excluded.status,
    starts_at = case when p_enabled then now() else public.user_course_entitlements.starts_at end,
    expires_at = null,
    notes = excluded.notes,
    granted_by = auth.uid(),
    updated_at = now()
  returning * into v_result;

  return jsonb_build_object(
    'user_id', v_result.user_id,
    'product_code', v_result.product_code,
    'status', v_result.status,
    'starts_at', v_result.starts_at,
    'expires_at', v_result.expires_at,
    'notes', v_result.notes
  );
end;
$$;

revoke execute on function public.admin_set_user_course_access(uuid, text, boolean, text)
  from public, anon;
grant execute on function public.admin_set_user_course_access(uuid, text, boolean, text)
  to authenticated;

create or replace function public.can_access_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
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
              and c.access_product_code is not null
              and (
                exists (
                  select 1 from public.membership_course_access m
                  where m.access_level = p.access_level
                    and m.product_code = c.access_product_code
                )
                or exists (
                  select 1 from public.user_course_entitlements e
                  where e.user_id = p.id
                    and e.product_code = c.access_product_code
                    and e.status = 'active'
                    and e.starts_at <= now()
                    and (e.expires_at is null or e.expires_at > now())
                )
              )
          )
        )
    );
$$;

revoke execute on function public.can_access_course(uuid) from public, anon;
grant execute on function public.can_access_course(uuid) to authenticated;

create or replace function private.course_metadata_json(p_course public.courses)
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_course.id,
    'title', p_course.title,
    'description', p_course.description,
    'instructor', p_course.instructor,
    'category_id', p_course.category_id,
    'category', p_course.category,
    'level', p_course.level,
    'duration', p_course.duration,
    'credits', p_course.credits,
    'status', p_course.status,
    'membership_type', p_course.membership_type,
    'access_product_code', p_course.access_product_code,
    'course_type', p_course.course_type,
    'is_trial', p_course.is_trial,
    'password_access_enabled', p_course.password_access_enabled,
    'image_url', p_course.image_url,
    'video_url', null,
    'audio_url', null,
    'body', null,
    'essence', null,
    'images', '[]'::jsonb,
    'meeting_url', null,
    'plus_lesson_order', p_course.plus_lesson_order,
    'plus_representative', p_course.plus_representative,
    'sort_order', p_course.sort_order,
    'view_count', p_course.view_count,
    'created_at', p_course.created_at,
    'updated_at', p_course.updated_at,
    'has_video', p_course.has_video,
    'has_audio', p_course.has_audio,
    'has_body', p_course.has_body,
    'has_essence', p_course.has_essence,
    'has_images', p_course.has_images,
    'has_meeting', p_course.has_meeting
  );
$$;

revoke execute on function private.course_metadata_json(public.courses)
  from public, anon, authenticated;

-- HAI access is now account-based. Points, not membership or course access,
-- determine whether a request can consume model capacity.
create or replace function public.hai_has_access(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_user_id is null then false
    when not (p_user_id = auth.uid() or coalesce(public.is_admin(), false)) then false
    else exists (
      select 1 from public.profiles p
      where p.id = p_user_id and p.status = 'active'
    )
  end;
$$;

create or replace function public.hai_access_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet public.hai_point_wallets%rowtype;
begin
  if v_user_id is null then
    return jsonb_build_object('authenticated', false, 'allowed', false, 'can_consume', false, 'reason', '请先登录。');
  end if;
  if not public.hai_has_access(v_user_id) then
    return jsonb_build_object('authenticated', true, 'allowed', false, 'can_consume', false, 'reason', '当前账号不可用。');
  end if;

  v_wallet := public.hai_ensure_points_wallet(v_user_id);
  return jsonb_build_object(
    'authenticated', true,
    'allowed', true,
    'is_admin', coalesce(public.is_admin(), false),
    'status', case when v_wallet.balance_tokens > 0 then 'active' else 'needs_points' end,
    'quota_mode', 'points',
    'quota_policy_key', 'plus',
    'can_consume', v_wallet.balance_tokens > 0,
    'reason', case when v_wallet.balance_tokens > 0 then null else '当前积分余额为 0，请联系管理员添加积分。' end
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
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_policy public.hai_quota_policies%rowtype;
  v_wallet public.hai_point_wallets%rowtype;
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
      'reason', '当前账号不可用。',
      'code', 'access_denied'
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended('hai_usage_gate', 0));

  -- Every user consumes the same points policy. Membership and course
  -- entitlements are deliberately absent from this decision.
  select * into v_policy
  from public.hai_quota_policies
  where key = 'plus' and enabled = true;

  if v_policy.key is null then
    return jsonb_build_object('allowed', false, 'reason', 'HAI 用量策略未配置。', 'code', 'quota_policy_missing');
  end if;

  if greatest(0, coalesce(p_estimated_input_tokens, 0))
    + greatest(0, coalesce(p_estimated_output_tokens, 0))
    > v_policy.single_request_token_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', '本次输入过长，请减少材料或新开一个更聚焦的 session。',
      'code', 'single_request_limit',
      'limit', v_policy.single_request_token_limit
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
    'quota_mode', 'points',
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
      'reason', '积分不足，请联系管理员添加积分后继续使用。',
      'code', 'points_insufficient',
      'balance_tokens', v_wallet.balance_tokens,
      'available_tokens', greatest(0, v_wallet.balance_tokens - v_reserved_tokens),
      'current_points', round(v_wallet.balance_tokens::numeric / v_tokens_per_point, 2),
      'required_points', round(v_estimated_charge_tokens::numeric / v_tokens_per_point, 2)
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
  ) values (
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
  ) values (
    v_user_id, p_request_id, 'hai.request.started', p_route, 'started',
    p_estimated_input_tokens, p_estimated_output_tokens,
    greatest(0, coalesce(p_estimated_input_tokens, 0)) + greatest(0, coalesce(p_estimated_output_tokens, 0)),
    v_reservation_metadata
  );

  return jsonb_build_object(
    'allowed', true,
    'request_id', p_request_id,
    'quota_mode', 'points',
    'policy_key', v_policy.key,
    'daily_used', 0,
    'daily_limit', 0,
    'weekly_used', 0,
    'weekly_limit', 0,
    'current_points', round(v_wallet.balance_tokens::numeric / v_tokens_per_point, 2),
    'required_points', round(v_estimated_charge_tokens::numeric / v_tokens_per_point, 2),
    'max_output_tokens', v_policy.max_output_tokens
  );
end;
$$;

create or replace function public.hai_usage_summary(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid := coalesce(p_user_id, auth.uid());
  v_policy public.hai_quota_policies%rowtype;
  v_wallet public.hai_point_wallets%rowtype;
  v_tokens_per_point integer := greatest(1, public.hai_runtime_numeric('points.tokens_per_point', 1000)::integer);
  v_qr_url text;
  v_point_packages jsonb := '[]'::jsonb;
begin
  if v_target is null then
    return jsonb_build_object('quota_mode', 'none', 'daily_used', 0, 'weekly_used', 0, 'can_consume', false);
  end if;
  if v_target <> auth.uid() and not coalesce(public.is_admin(), false) then
    raise exception '无权限查看该用户 HAI 用量。';
  end if;
  if not exists (select 1 from public.profiles where id = v_target) then
    raise exception '用户不存在';
  end if;

  v_wallet := public.hai_ensure_points_wallet(v_target);
  select * into v_policy from public.hai_quota_policies where key = 'plus' and enabled = true;

  select case when enabled and jsonb_typeof(value) = 'string' then value #>> '{}' else null end
  into v_qr_url from public.hai_runtime_settings where key = 'points.wecom_qr_url';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', package.id, 'name', package.name, 'points', package.points,
    'price_cny', package.price_cny, 'description', package.description,
    'value_metrics', package.value_metrics, 'is_recommended', package.is_recommended
  ) order by package.sort_order, package.price_cny), '[]'::jsonb)
  into v_point_packages
  from public.hai_point_packages package
  where package.is_enabled;

  return jsonb_build_object(
    'quota_mode', 'points',
    'policy_key', coalesce(v_policy.key, 'plus'),
    'can_consume', v_wallet.balance_tokens > 0,
    'daily_used', 0, 'weekly_used', 0, 'daily_limit', 0, 'weekly_limit', 0,
    'balance_tokens', v_wallet.balance_tokens,
    'total_credited_tokens', v_wallet.total_credited_tokens,
    'total_consumed_tokens', v_wallet.total_consumed_tokens,
    'current_points', round(v_wallet.balance_tokens::numeric / v_tokens_per_point, 2),
    'consumed_points', round(v_wallet.total_consumed_tokens::numeric / v_tokens_per_point, 2),
    'quota_total_points', round(v_wallet.total_credited_tokens::numeric / v_tokens_per_point, 2),
    'wallet_points', round(v_wallet.balance_tokens::numeric / v_tokens_per_point, 2),
    'wallet_consumed_points', round(v_wallet.total_consumed_tokens::numeric / v_tokens_per_point, 2),
    'credited_points', round(v_wallet.total_credited_tokens::numeric / v_tokens_per_point, 2),
    'point_packages', v_point_packages,
    'wecom_qr_url', coalesce(v_qr_url, '/哈老师企微二维码.png'),
    'single_request_token_limit', coalesce(v_policy.single_request_token_limit, 0),
    'max_output_tokens', coalesce(v_policy.max_output_tokens, 4096)
  );
end;
$$;

update public.hai_runtime_settings
set enabled = false
where key in (
  'points.newcomer_grant_points',
  'points.newcomer_plus_points',
  'points.newcomer_pro_points'
);

drop function if exists public.hai_admin_grant_newcomer_points(uuid);
revoke execute on function public.admin_update_user_access_level(uuid, text) from authenticated;

revoke execute on function public.hai_has_access(uuid) from public, anon;
revoke execute on function public.hai_access_status() from public, anon;
revoke execute on function public.hai_check_and_reserve_usage(text, text, integer, integer, jsonb) from public, anon;
revoke execute on function public.hai_usage_summary(uuid) from public, anon;
grant execute on function public.hai_has_access(uuid) to authenticated;
grant execute on function public.hai_access_status() to authenticated;
grant execute on function public.hai_check_and_reserve_usage(text, text, integer, integer, jsonb) to authenticated;
grant execute on function public.hai_usage_summary(uuid) to authenticated;

commit;
