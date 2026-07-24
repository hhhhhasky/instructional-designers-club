begin;

-- HAI Model Providers: decouple model credentials from hardcoded env vars
-- so admins can add/switch between LLM backends (DeepSeek, OpenAI-compatible, etc.)

create table if not exists public.hai_model_providers (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  model_name text not null,
  api_key text not null,
  base_url text not null,
  is_enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hai_model_providers_label_unique unique (label)
);

-- FK from feature modules to model providers (nullable for backward compat)
alter table public.hai_feature_modules
  add column if not exists model_provider_id uuid
  references public.hai_model_providers(id) on delete set null;

create index if not exists idx_hai_feature_modules_model_provider
  on public.hai_feature_modules(model_provider_id);

-- Auto-update trigger
drop trigger if exists update_hai_model_providers_updated_at on public.hai_model_providers;
create trigger update_hai_model_providers_updated_at
  before update on public.hai_model_providers
  for each row execute function public.update_updated_at_column();

-- RLS: only admins can manage model providers
alter table public.hai_model_providers enable row level security;

drop policy if exists "Admins can manage model providers" on public.hai_model_providers;
create policy "Admins can manage model providers"
  on public.hai_model_providers
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seed default provider referencing env vars (admin fills real key in UI if needed)
insert into public.hai_model_providers (label, model_name, api_key, base_url, sort_order)
values ('DeepSeek (默认)', 'deepseek-v4-flash', 'ENV:DEEPSEEK_API_KEY', 'https://api.deepseek.com', 1)
on conflict (label) do nothing;

commit;
