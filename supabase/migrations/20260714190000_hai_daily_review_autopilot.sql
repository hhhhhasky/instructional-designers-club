-- HAI 每日复盘与受控自动迭代。
-- 每天北京时间 00:05（UTC 16:05）复盘前一自然日；定时调用配置由
-- scripts/configure-hai-daily-review.mjs 写入，密钥不进入前端运行时配置。

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table if not exists public.hai_message_feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.hai_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating text not null check (rating in ('up', 'down')),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create index if not exists hai_message_feedback_message_idx
  on public.hai_message_feedback (message_id);
create index if not exists hai_message_feedback_rating_created_idx
  on public.hai_message_feedback (rating, created_at desc);

alter table public.hai_message_feedback enable row level security;

drop policy if exists "hai_message_feedback own or admin" on public.hai_message_feedback;
create policy "hai_message_feedback own or admin"
  on public.hai_message_feedback for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "hai_message_feedback insert own assistant message" on public.hai_message_feedback;
create policy "hai_message_feedback insert own assistant message"
  on public.hai_message_feedback for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.hai_messages message
      where message.id = message_id
        and message.user_id = (select auth.uid())
        and message.role = 'assistant'
    )
  );

drop policy if exists "hai_message_feedback update own" on public.hai_message_feedback;
create policy "hai_message_feedback update own"
  on public.hai_message_feedback for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "hai_message_feedback delete own" on public.hai_message_feedback;
create policy "hai_message_feedback delete own"
  on public.hai_message_feedback for delete to authenticated
  using (user_id = (select auth.uid()));

-- 扩充既有优化日志，使每次运行包含输入范围、评分、候选、发布与回滚快照。
alter table public.hai_optimization_log
  add column if not exists status text not null default 'completed',
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists window_start timestamptz,
  add column if not exists window_end timestamptz,
  add column if not exists average_score numeric(6, 2),
  add column if not exists pass_rate numeric(6, 4),
  add column if not exists low_score_count integer not null default 0,
  add column if not exists positive_feedback_count integer not null default 0,
  add column if not exists negative_feedback_count integer not null default 0,
  add column if not exists dimension_scores jsonb not null default '{}'::jsonb,
  add column if not exists report jsonb not null default '{}'::jsonb,
  add column if not exists candidate_changes jsonb not null default '[]'::jsonb,
  add column if not exists config_snapshot_before jsonb not null default '{}'::jsonb,
  add column if not exists config_snapshot_after jsonb not null default '{}'::jsonb,
  add column if not exists publish_mode text not null default 'none',
  add column if not exists error_message text;

update public.hai_optimization_log
set status = 'completed'
where status is null or status not in ('running', 'completed', 'failed', 'skipped');

alter table public.hai_optimization_log
  drop constraint if exists hai_optimization_log_status_check;
alter table public.hai_optimization_log
  add constraint hai_optimization_log_status_check
  check (status in ('running', 'completed', 'failed', 'skipped'));

alter table public.hai_optimization_log
  drop constraint if exists hai_optimization_log_publish_mode_check;
alter table public.hai_optimization_log
  add constraint hai_optimization_log_publish_mode_check
  check (publish_mode in ('none', 'pending', 'gated_auto', 'manual', 'rolled_back'));

create unique index if not exists hai_optimization_log_run_date_unique_idx
  on public.hai_optimization_log (run_date);

alter table public.hai_optimization_log enable row level security;
drop policy if exists "hai_optimization_log admin read" on public.hai_optimization_log;
create policy "hai_optimization_log admin read"
  on public.hai_optimization_log for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "hai_optimization_log admin write" on public.hai_optimization_log;
create policy "hai_optimization_log admin write"
  on public.hai_optimization_log for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- 只有 postgres/service role 可读。定时器需要明文 secret 发起内部请求，
-- 因此单独存放，不与 authenticated 可读的 hai_runtime_settings 混放。
create table if not exists public.hai_daily_review_scheduler_config (
  singleton boolean primary key default true check (singleton),
  endpoint_url text not null,
  auth_secret text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.hai_daily_review_scheduler_config enable row level security;

revoke all on public.hai_daily_review_scheduler_config from anon, authenticated;
grant all on public.hai_daily_review_scheduler_config to service_role;

insert into public.hai_runtime_settings
  (key, label, value, default_value, value_type, category, description, min_value, max_value, step, options, unit, enabled)
values
  ('daily_review.enabled', '启用每日复盘', 'true'::jsonb, 'true'::jsonb, 'boolean', '每日复盘', '是否执行每日对话复盘。', null, null, null, '[]'::jsonb, null, true),
  ('daily_review.auto_publish_mode', '自动发布模式', '"gated"'::jsonb, '"gated"'::jsonb, 'select', '每日复盘', 'gated 仅自动发布低风险且 A/B 提分的表达层改动；review_only 只生成候选。', null, null, null, '["gated", "review_only"]'::jsonb, null, true),
  ('daily_review.pass_score', '每日复盘通过分', '80'::jsonb, '80'::jsonb, 'number', '每日复盘', '低于此分数的回答进入问题样本。', 60, 95, 1, '[]'::jsonb, '分', true),
  ('daily_review.min_turns_for_publish', '自动发布最小样本', '10'::jsonb, '10'::jsonb, 'integer', '每日复盘', '允许自动发布所需的最小日样本量。', 3, 100, 1, '[]'::jsonb, '轮', true),
  ('daily_review.min_low_score_turns', '稳定低分样本门槛', '3'::jsonb, '3'::jsonb, 'integer', '每日复盘', '形成稳定问题簇并允许自动发布所需的最小低分轮次。', 2, 20, 1, '[]'::jsonb, '轮', true),
  ('daily_review.min_ab_improvement', 'A/B 最低提分', '4'::jsonb, '4'::jsonb, 'number', '每日复盘', '候选回答相对原回答允许自动发布所需的最低平均提分。', 1, 20, 0.5, '[]'::jsonb, '分', true),
  ('daily_review.max_turns', '每日最大评估量', '200'::jsonb, '200'::jsonb, 'integer', '每日复盘', '单次复盘最多评估的回答数，优先保留点踩和近期回答。', 10, 500, 10, '[]'::jsonb, '轮', true)
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  default_value = excluded.default_value,
  value_type = excluded.value_type,
  min_value = excluded.min_value,
  max_value = excluded.max_value,
  step = excluded.step,
  options = excluded.options,
  unit = excluded.unit,
  enabled = true;

create or replace function public.hai_trigger_daily_review()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_config public.hai_daily_review_scheduler_config%rowtype;
  v_request_id bigint;
begin
  select * into v_config
  from public.hai_daily_review_scheduler_config
  where singleton = true and enabled = true;

  if v_config.singleton is null then
    return null;
  end if;

  select net.http_post(
    url := rtrim(v_config.endpoint_url, '/'),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-hai-review-secret', v_config.auth_secret
    ),
    body := jsonb_build_object('trigger', 'cron'),
    timeout_milliseconds := 30000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.hai_trigger_daily_review() from public, anon, authenticated;
grant execute on function public.hai_trigger_daily_review() to postgres, service_role;

do $$
declare
  v_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_job_id from cron.job where jobname = 'hai-daily-review-shanghai-midnight';
    if v_job_id is not null then
      perform cron.unschedule(v_job_id);
    end if;
    perform cron.schedule(
      'hai-daily-review-shanghai-midnight',
      '5 16 * * *',
      'select public.hai_trigger_daily_review();'
    );
  end if;
end;
$$;

comment on table public.hai_message_feedback is '用户对 HAI assistant 消息的点赞/点踩，作为每日复盘的强监督信号。';
comment on table public.hai_daily_review_scheduler_config is 'HAI 每日复盘 Edge Function 的服务端定时调用配置；禁止普通用户读取。';
