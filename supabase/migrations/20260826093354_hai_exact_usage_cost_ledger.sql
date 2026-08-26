begin;

-- Exact provider usage is intentionally kept separate from the existing
-- quota-estimate fields. The quota gate still needs a conservative estimate
-- before a provider call starts; this ledger records the provider's final
-- usage after the call finishes.
create table if not exists public.hai_model_pricing (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model_name text not null,
  effective_from timestamptz not null,
  effective_to timestamptz,
  timezone text not null default 'Asia/Shanghai',
  peak_cache_hit_input_per_million numeric(20,8) not null check (peak_cache_hit_input_per_million >= 0),
  peak_cache_miss_input_per_million numeric(20,8) not null check (peak_cache_miss_input_per_million >= 0),
  peak_output_per_million numeric(20,8) not null check (peak_output_per_million >= 0),
  off_peak_cache_hit_input_per_million numeric(20,8) not null check (off_peak_cache_hit_input_per_million >= 0),
  off_peak_cache_miss_input_per_million numeric(20,8) not null check (off_peak_cache_miss_input_per_million >= 0),
  off_peak_output_per_million numeric(20,8) not null check (off_peak_output_per_million >= 0),
  currency text not null default 'CNY',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, model_name, effective_from)
);

create table if not exists public.hai_model_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  request_id text not null,
  call_index integer not null check (call_index > 0),
  stage text not null,
  route text not null,
  entity_type text,
  entity_id uuid,
  provider text not null,
  model text not null,
  provider_request_id text,
  status text not null default 'completed' check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  prompt_tokens integer check (prompt_tokens is null or prompt_tokens >= 0),
  cache_hit_tokens integer check (cache_hit_tokens is null or cache_hit_tokens >= 0),
  cache_miss_tokens integer check (cache_miss_tokens is null or cache_miss_tokens >= 0),
  completion_tokens integer check (completion_tokens is null or completion_tokens >= 0),
  reasoning_tokens integer check (reasoning_tokens is null or reasoning_tokens >= 0),
  visible_output_tokens integer check (visible_output_tokens is null or visible_output_tokens >= 0),
  total_tokens integer check (total_tokens is null or total_tokens >= 0),
  usage_status text not null default 'missing' check (usage_status in ('provider', 'provider_partial', 'missing')),
  price_band text not null default 'unknown' check (price_band in ('peak', 'off_peak', 'unknown')),
  price_snapshot jsonb not null default '{}'::jsonb,
  cache_hit_cost numeric(20,8),
  cache_miss_cost numeric(20,8),
  output_cost numeric(20,8),
  total_cost numeric(20,8),
  currency text not null default 'CNY',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(request_id, call_index)
);

alter table public.hai_usage_events
  add column if not exists actual_prompt_tokens integer,
  add column if not exists actual_cache_hit_tokens integer,
  add column if not exists actual_cache_miss_tokens integer,
  add column if not exists actual_completion_tokens integer,
  add column if not exists actual_reasoning_tokens integer,
  add column if not exists actual_visible_output_tokens integer,
  add column if not exists actual_total_tokens integer,
  add column if not exists actual_cost numeric(20,8),
  add column if not exists actual_currency text,
  add column if not exists actual_usage_status text not null default 'missing';

alter table public.hai_usage_events
  drop constraint if exists hai_usage_events_actual_usage_status_check;

alter table public.hai_usage_events
  add constraint hai_usage_events_actual_usage_status_check
  check (actual_usage_status in ('actual', 'partial', 'missing', 'estimated'));

create index if not exists idx_hai_model_calls_request
  on public.hai_model_calls(request_id, call_index);
create index if not exists idx_hai_model_calls_created_at
  on public.hai_model_calls(created_at desc);
create index if not exists idx_hai_model_calls_user_created_at
  on public.hai_model_calls(user_id, created_at desc);
create index if not exists idx_hai_model_calls_route_created_at
  on public.hai_model_calls(route, created_at desc);
create index if not exists idx_hai_model_pricing_lookup
  on public.hai_model_pricing(provider, model_name, effective_from desc)
  where enabled = true;

alter table public.hai_model_pricing enable row level security;
alter table public.hai_model_calls enable row level security;

grant select on public.hai_model_pricing, public.hai_model_calls to authenticated;
grant insert, update, delete on public.hai_model_pricing to authenticated;

create policy "hai_model_pricing admin read"
  on public.hai_model_pricing for select to authenticated
  using ((select public.is_admin()));

create policy "hai_model_pricing admin write"
  on public.hai_model_pricing for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "hai_model_calls admin read"
  on public.hai_model_calls for select to authenticated
  using ((select public.is_admin()));

-- DeepSeek V4 pricing effective 2026-08-26, in CNY per million tokens.
-- Peak hours are Beijing time weekdays 09:00-12:00 and 14:00-18:00.
insert into public.hai_model_pricing (
  provider,
  model_name,
  effective_from,
  peak_cache_hit_input_per_million,
  peak_cache_miss_input_per_million,
  peak_output_per_million,
  off_peak_cache_hit_input_per_million,
  off_peak_cache_miss_input_per_million,
  off_peak_output_per_million
)
values
  ('deepseek', 'deepseek-v4-flash', '2026-08-26 00:00:00+08', 0.10, 3.00, 9.00, 0.05, 1.50, 4.50),
  ('deepseek', 'deepseek-v4-pro', '2026-08-26 00:00:00+08', 0.30, 9.00, 27.00, 0.15, 4.50, 13.50)
on conflict (provider, model_name, effective_from) do update set
  peak_cache_hit_input_per_million = excluded.peak_cache_hit_input_per_million,
  peak_cache_miss_input_per_million = excluded.peak_cache_miss_input_per_million,
  peak_output_per_million = excluded.peak_output_per_million,
  off_peak_cache_hit_input_per_million = excluded.off_peak_cache_hit_input_per_million,
  off_peak_cache_miss_input_per_million = excluded.off_peak_cache_miss_input_per_million,
  off_peak_output_per_million = excluded.off_peak_output_per_million,
  updated_at = now();

commit;
