-- ============================================================
-- HAI workspace integrated into the club website database
-- Created: 2026-07-03
--
-- Design:
-- - Reuse auth.users and public.profiles from the club website.
-- - Keep all HAI product data logically isolated with hai_ prefixes.
-- - Gate v1 with explicit beta access before later Plus/Pro rollout.
-- ============================================================

begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

set search_path = public, extensions;

-- ---------- Access and invite gate ----------

create table if not exists public.hai_invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null default 'HAI 内测邀请',
  quota_policy_key text not null default 'beta',
  max_uses integer not null default 1 check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  status text not null default 'active' check (status in ('active', 'disabled')),
  starts_at timestamptz,
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hai_user_access (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused', 'revoked')),
  access_source text not null default 'admin' check (access_source in ('admin', 'invite', 'membership')),
  invite_code_id uuid references public.hai_invite_codes(id) on delete set null,
  quota_policy_key text not null default 'beta',
  expires_at timestamptz,
  notes text,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Prompt and runtime configuration ----------

create table if not exists public.hai_feature_modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_label text not null,
  description text not null default '',
  icon_key text not null default 'sparkles',
  category text not null default '教研助手',
  input_schema jsonb not null default '[]'::jsonb,
  default_model text not null default 'deepseek-v4-flash',
  default_temperature numeric(3, 2) not null default 0.25 check (default_temperature >= 0 and default_temperature <= 2),
  default_max_output_tokens integer not null default 4096 check (default_max_output_tokens between 256 and 32000),
  thinking_enabled boolean not null default false,
  sort_order integer not null default 0,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hai_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.hai_feature_modules(id) on delete cascade,
  version_label text not null default 'v1',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  system_prompt text not null,
  developer_prompt text not null default '',
  response_contract text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_hai_prompt_versions_one_published
  on public.hai_prompt_versions(module_id)
  where status = 'published';

create table if not exists public.hai_runtime_settings (
  key text primary key,
  label text not null,
  description text not null default '',
  category text not null default 'general',
  value jsonb not null,
  default_value jsonb not null,
  value_type text not null check (value_type in ('number', 'integer', 'boolean', 'string', 'select')),
  min_value numeric,
  max_value numeric,
  step numeric,
  options jsonb not null default '[]'::jsonb,
  unit text,
  enabled boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------- Conversation data ----------

create table if not exists public.hai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '新的 HAI 对话',
  mode text not null default 'chat' check (mode in ('chat', 'roundtable')),
  module_slug text references public.hai_feature_modules(slug) on delete set null,
  summary text,
  context_compressed_until timestamptz,
  context_compressed_at timestamptz,
  roundtable_role_ids text[] not null default '{}'::text[],
  roundtable_phase text not null default 'clarify' check (roundtable_phase in ('clarify', 'diverge', 'converge', 'implement', 'summarize')),
  quality_test_run_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.hai_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null default '',
  citations jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  input_tokens integer,
  output_tokens integer,
  token_estimate integer,
  created_at timestamptz not null default now()
);

create table if not exists public.hai_user_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (
    category in (
      'basic_info',
      'education_philosophy',
      'student_view',
      'teaching_view',
      'teaching_preference',
      'constraint',
      'behavior',
      'vision',
      'challenge'
    )
  ),
  content text not null check (length(trim(content)) > 0),
  confidence numeric(3, 2) default 0.70 check (confidence >= 0 and confidence <= 1),
  source_type text,
  source_id uuid,
  status text not null default 'active' check (status in ('candidate', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Material and knowledge retrieval ----------

create table if not exists public.hai_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.hai_conversations(id) on delete set null,
  title text not null,
  file_name text not null,
  mime_type text,
  storage_path text not null,
  size_bytes bigint,
  kind text not null default 'lesson_material' check (kind in ('lesson_material', 'course_system', 'student_work', 'reflection')),
  status text not null default 'created' check (status in ('created', 'uploaded', 'processing', 'processed', 'processed_no_embedding', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hai_material_chunks (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.hai_materials(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_count integer,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  unique(material_id, chunk_index)
);

create table if not exists public.hai_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type text not null default 'manual',
  topic text not null default 'general',
  visibility text not null default 'shared' check (visibility in ('shared', 'private')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hai_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.hai_knowledge_sources(id) on delete cascade,
  topic text not null default 'general',
  chunk_index integer not null,
  content text not null,
  token_count integer,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  unique(source_id, chunk_index)
);

-- ---------- Usage, quotas, observability ----------

create table if not exists public.hai_quota_policies (
  key text primary key,
  label text not null,
  daily_token_limit integer not null check (daily_token_limit > 0),
  weekly_token_limit integer not null check (weekly_token_limit > 0),
  single_request_token_limit integer not null check (single_request_token_limit > 0),
  max_output_tokens integer not null default 4096 check (max_output_tokens > 0),
  user_concurrency_limit integer not null default 1 check (user_concurrency_limit > 0),
  global_concurrency_limit integer not null default 50 check (global_concurrency_limit > 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hai_request_reservations (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  route text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'failed', 'expired')),
  estimated_input_tokens integer not null default 0 check (estimated_input_tokens >= 0),
  estimated_output_tokens integer not null default 0 check (estimated_output_tokens >= 0),
  actual_input_tokens integer,
  actual_output_tokens integer,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.hai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  request_id text,
  event_type text not null,
  route text not null,
  status text not null check (status in ('started', 'completed', 'failed', 'rejected', 'cached')),
  entity_type text,
  entity_id uuid,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  duration_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.hai_usage_alerts (
  id uuid primary key default gen_random_uuid(),
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  fingerprint text not null,
  title text not null,
  description text not null default '',
  route text,
  user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);

create unique index if not exists idx_hai_usage_alerts_open_fingerprint
  on public.hai_usage_alerts(fingerprint)
  where status = 'open';

create table if not exists public.hai_quality_test_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  mode text not null default 'chat' check (mode in ('chat', 'roundtable', 'mixed')),
  scenario text not null default '',
  objective text,
  status text not null default 'running' check (status in ('running', 'completed', 'archived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ---------- Indexes ----------

create index if not exists idx_hai_invite_codes_status on public.hai_invite_codes(status, expires_at);
create index if not exists idx_hai_user_access_status on public.hai_user_access(status, expires_at);
create index if not exists idx_hai_feature_modules_enabled_sort on public.hai_feature_modules(is_enabled, sort_order);
create index if not exists idx_hai_conversations_user_updated on public.hai_conversations(user_id, archived_at, updated_at desc);
create index if not exists idx_hai_messages_conversation_created on public.hai_messages(conversation_id, created_at);
create index if not exists idx_hai_user_memories_user_status on public.hai_user_memories(user_id, status, updated_at desc);
create index if not exists idx_hai_materials_user_kind on public.hai_materials(user_id, kind, conversation_id, created_at desc);
create index if not exists idx_hai_material_chunks_user_material on public.hai_material_chunks(user_id, material_id, chunk_index);
create index if not exists idx_hai_knowledge_sources_active on public.hai_knowledge_sources(is_active, topic, updated_at desc);
create index if not exists idx_hai_knowledge_chunks_topic on public.hai_knowledge_chunks(topic);
create index if not exists idx_hai_reservations_active_user on public.hai_request_reservations(user_id, status, expires_at);
create index if not exists idx_hai_reservations_active_global on public.hai_request_reservations(status, expires_at);
create index if not exists idx_hai_usage_events_user_created on public.hai_usage_events(user_id, created_at desc);
create index if not exists idx_hai_usage_events_route_status on public.hai_usage_events(route, status, created_at desc);

create index if not exists idx_hai_material_chunks_embedding
  on public.hai_material_chunks using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

create index if not exists idx_hai_knowledge_chunks_embedding
  on public.hai_knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

create index if not exists idx_hai_material_chunks_content_trgm
  on public.hai_material_chunks using gin (content extensions.gin_trgm_ops);

create index if not exists idx_hai_knowledge_chunks_content_trgm
  on public.hai_knowledge_chunks using gin (content extensions.gin_trgm_ops);

-- ---------- updated_at triggers ----------

drop trigger if exists update_hai_invite_codes_updated_at on public.hai_invite_codes;
create trigger update_hai_invite_codes_updated_at
  before update on public.hai_invite_codes
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_hai_user_access_updated_at on public.hai_user_access;
create trigger update_hai_user_access_updated_at
  before update on public.hai_user_access
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_hai_feature_modules_updated_at on public.hai_feature_modules;
create trigger update_hai_feature_modules_updated_at
  before update on public.hai_feature_modules
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_hai_prompt_versions_updated_at on public.hai_prompt_versions;
create trigger update_hai_prompt_versions_updated_at
  before update on public.hai_prompt_versions
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_hai_runtime_settings_updated_at on public.hai_runtime_settings;
create trigger update_hai_runtime_settings_updated_at
  before update on public.hai_runtime_settings
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_hai_conversations_updated_at on public.hai_conversations;
create trigger update_hai_conversations_updated_at
  before update on public.hai_conversations
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_hai_user_memories_updated_at on public.hai_user_memories;
create trigger update_hai_user_memories_updated_at
  before update on public.hai_user_memories
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_hai_materials_updated_at on public.hai_materials;
create trigger update_hai_materials_updated_at
  before update on public.hai_materials
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_hai_knowledge_sources_updated_at on public.hai_knowledge_sources;
create trigger update_hai_knowledge_sources_updated_at
  before update on public.hai_knowledge_sources
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_hai_quota_policies_updated_at on public.hai_quota_policies;
create trigger update_hai_quota_policies_updated_at
  before update on public.hai_quota_policies
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_hai_usage_alerts_updated_at on public.hai_usage_alerts;
create trigger update_hai_usage_alerts_updated_at
  before update on public.hai_usage_alerts
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_hai_quality_test_runs_updated_at on public.hai_quality_test_runs;
create trigger update_hai_quality_test_runs_updated_at
  before update on public.hai_quality_test_runs
  for each row execute function public.update_updated_at_column();

-- ---------- RLS ----------

alter table public.hai_invite_codes enable row level security;
alter table public.hai_user_access enable row level security;
alter table public.hai_feature_modules enable row level security;
alter table public.hai_prompt_versions enable row level security;
alter table public.hai_runtime_settings enable row level security;
alter table public.hai_conversations enable row level security;
alter table public.hai_messages enable row level security;
alter table public.hai_user_memories enable row level security;
alter table public.hai_materials enable row level security;
alter table public.hai_material_chunks enable row level security;
alter table public.hai_knowledge_sources enable row level security;
alter table public.hai_knowledge_chunks enable row level security;
alter table public.hai_quota_policies enable row level security;
alter table public.hai_request_reservations enable row level security;
alter table public.hai_usage_events enable row level security;
alter table public.hai_usage_alerts enable row level security;
alter table public.hai_quality_test_runs enable row level security;

grant select, insert, update, delete on
  public.hai_invite_codes,
  public.hai_user_access,
  public.hai_feature_modules,
  public.hai_prompt_versions,
  public.hai_runtime_settings,
  public.hai_quota_policies,
  public.hai_usage_alerts,
  public.hai_quality_test_runs
to authenticated;

grant select, insert, update, delete on
  public.hai_conversations,
  public.hai_messages,
  public.hai_user_memories,
  public.hai_materials,
  public.hai_material_chunks,
  public.hai_request_reservations,
  public.hai_usage_events
to authenticated;

grant select on public.hai_knowledge_sources, public.hai_knowledge_chunks to authenticated;
grant insert, update, delete on public.hai_knowledge_sources, public.hai_knowledge_chunks to authenticated;

-- Admin policies
create policy "hai_invite_codes admin all"
  on public.hai_invite_codes for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "hai_user_access own or admin read"
  on public.hai_user_access for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "hai_user_access admin write"
  on public.hai_user_access for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "hai_modules readable when enabled"
  on public.hai_feature_modules for select to authenticated
  using (is_enabled = true or (select public.is_admin()));

create policy "hai_modules admin write"
  on public.hai_feature_modules for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "hai_prompts readable when published"
  on public.hai_prompt_versions for select to authenticated
  using (status = 'published' or (select public.is_admin()));

create policy "hai_prompts admin write"
  on public.hai_prompt_versions for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "hai_admin_config_read"
  on public.hai_runtime_settings for select to authenticated
  using ((select public.is_admin()));

create policy "hai_admin_config_write"
  on public.hai_runtime_settings for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "hai_quota_policies admin read"
  on public.hai_quota_policies for select to authenticated
  using ((select public.is_admin()));

create policy "hai_quota_policies admin write"
  on public.hai_quota_policies for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Owner data policies
create policy "hai_conversations own or admin"
  on public.hai_conversations for all to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "hai_messages own or admin"
  on public.hai_messages for all to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "hai_memories own or admin"
  on public.hai_user_memories for all to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "hai_materials own or admin"
  on public.hai_materials for all to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "hai_material_chunks own or admin"
  on public.hai_material_chunks for all to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "hai_reservations own or admin"
  on public.hai_request_reservations for all to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "hai_usage_events own or admin"
  on public.hai_usage_events for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "hai_usage_events insert own"
  on public.hai_usage_events for insert to authenticated
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "hai_alerts admin"
  on public.hai_usage_alerts for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "hai_quality_runs owner or admin"
  on public.hai_quality_test_runs for all to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "hai_knowledge_sources readable"
  on public.hai_knowledge_sources for select to authenticated
  using ((visibility = 'shared' and is_active = true) or (select public.is_admin()));

create policy "hai_knowledge_sources admin write"
  on public.hai_knowledge_sources for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "hai_knowledge_chunks readable"
  on public.hai_knowledge_chunks for select to authenticated
  using (
    exists (
      select 1 from public.hai_knowledge_sources source
      where source.id = hai_knowledge_chunks.source_id
        and source.is_active = true
        and source.visibility = 'shared'
    )
    or (select public.is_admin())
  );

create policy "hai_knowledge_chunks admin write"
  on public.hai_knowledge_chunks for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------- Storage ----------

insert into storage.buckets (id, name, public)
values ('hai-user-materials', 'hai-user-materials', false)
on conflict (id) do nothing;

drop policy if exists "hai material select own" on storage.objects;
drop policy if exists "hai material insert own" on storage.objects;
drop policy if exists "hai material update own" on storage.objects;
drop policy if exists "hai material delete own" on storage.objects;

create policy "hai material select own"
on storage.objects for select to authenticated
using (
  bucket_id = 'hai-user-materials'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
);

create policy "hai material insert own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'hai-user-materials'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
);

create policy "hai material update own"
on storage.objects for update to authenticated
using (
  bucket_id = 'hai-user-materials'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
)
with check (
  bucket_id = 'hai-user-materials'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
);

create policy "hai material delete own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'hai-user-materials'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
);

-- ---------- Helper functions ----------

create or replace function public.hai_has_access(p_user_id uuid default auth.uid())
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
      from public.hai_user_access access
      where access.user_id = p_user_id
        and access.status = 'active'
        and (access.expires_at is null or access.expires_at > now())
    );
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
  v_is_admin boolean;
begin
  if v_user_id is null then
    return jsonb_build_object('authenticated', false, 'allowed', false, 'reason', '请先登录。');
  end if;

  v_is_admin := coalesce(public.is_admin(), false);

  select * into v_access
  from public.hai_user_access
  where user_id = v_user_id;

  if v_is_admin then
    return jsonb_build_object(
      'authenticated', true,
      'allowed', true,
      'is_admin', true,
      'status', 'admin',
      'quota_policy_key', coalesce(v_access.quota_policy_key, 'pro')
    );
  end if;

  if v_access.user_id is null then
    return jsonb_build_object(
      'authenticated', true,
      'allowed', false,
      'is_admin', false,
      'reason', 'HAI 当前仅面向内测用户开放。'
    );
  end if;

  if v_access.status <> 'active' then
    return jsonb_build_object(
      'authenticated', true,
      'allowed', false,
      'is_admin', false,
      'status', v_access.status,
      'reason', '你的 HAI 内测资格当前不可用。'
    );
  end if;

  if v_access.expires_at is not null and v_access.expires_at <= now() then
    return jsonb_build_object(
      'authenticated', true,
      'allowed', false,
      'is_admin', false,
      'status', 'expired',
      'reason', '你的 HAI 内测资格已到期。'
    );
  end if;

  return jsonb_build_object(
    'authenticated', true,
    'allowed', true,
    'is_admin', false,
    'status', v_access.status,
    'quota_policy_key', v_access.quota_policy_key,
    'expires_at', v_access.expires_at
  );
end;
$$;

create or replace function public.hai_redeem_invite_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text := upper(trim(p_code));
  v_invite public.hai_invite_codes%rowtype;
  v_existing_access public.hai_user_access%rowtype;
begin
  if v_user_id is null then
    raise exception '请先登录。';
  end if;

  select * into v_invite
  from public.hai_invite_codes
  where upper(code) = v_code
  for update;

  if v_invite.id is null then
    raise exception '邀请码不存在。';
  end if;
  if v_invite.status <> 'active' then
    raise exception '邀请码已停用。';
  end if;
  if v_invite.starts_at is not null and v_invite.starts_at > now() then
    raise exception '邀请码尚未生效。';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    raise exception '邀请码已过期。';
  end if;

  select * into v_existing_access
  from public.hai_user_access
  where user_id = v_user_id;

  if v_existing_access.invite_code_id = v_invite.id and v_existing_access.status = 'active' then
    return public.hai_access_status();
  end if;

  if v_invite.used_count >= v_invite.max_uses then
    raise exception '邀请码使用次数已满。';
  end if;

  insert into public.hai_user_access (
    user_id,
    status,
    access_source,
    invite_code_id,
    quota_policy_key,
    granted_at
  )
  values (
    v_user_id,
    'active',
    'invite',
    v_invite.id,
    v_invite.quota_policy_key,
    now()
  )
  on conflict (user_id) do update set
    status = 'active',
    access_source = 'invite',
    invite_code_id = excluded.invite_code_id,
    quota_policy_key = excluded.quota_policy_key,
    granted_at = now();

  update public.hai_invite_codes
  set used_count = used_count + 1
  where id = v_invite.id;

  return public.hai_access_status();
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
  v_access_level text;
  v_policy_key text;
  v_estimated_total integer := greatest(0, coalesce(p_estimated_input_tokens, 0)) + greatest(0, coalesce(p_estimated_output_tokens, 0));
  v_day_used integer := 0;
  v_week_used integer := 0;
  v_user_active integer := 0;
  v_global_active integer := 0;
begin
  if v_user_id is null then
    return jsonb_build_object('allowed', false, 'reason', '请先登录。', 'code', 'unauthenticated');
  end if;

  if not public.hai_has_access(v_user_id) then
    return jsonb_build_object('allowed', false, 'reason', 'HAI 当前仅面向内测用户开放。', 'code', 'access_denied');
  end if;

  -- Serialize the cheap gate section so concurrent requests cannot all pass
  -- the same quota/concurrency count before reservations are written.
  perform pg_advisory_xact_lock(hashtextextended('hai_usage_gate', 0));

  select * into v_access from public.hai_user_access where user_id = v_user_id;
  select access_level::text into v_access_level from public.profiles where id = v_user_id;
  v_policy_key := coalesce(v_access.quota_policy_key, v_access_level, 'beta');

  select * into v_policy
  from public.hai_quota_policies
  where key = v_policy_key and enabled = true;

  if v_policy.key is null then
    select * into v_policy
    from public.hai_quota_policies
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

  select coalesce(sum(coalesce(total_tokens, 0)), 0)::integer into v_day_used
  from public.hai_usage_events
  where user_id = v_user_id
    and status in ('completed', 'cached')
    and created_at >= date_trunc('day', now());

  select coalesce(sum(coalesce(total_tokens, 0)), 0)::integer into v_week_used
  from public.hai_usage_events
  where user_id = v_user_id
    and status in ('completed', 'cached')
    and created_at >= date_trunc('week', now());

  if v_day_used + v_estimated_total > v_policy.daily_token_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', '今日 HAI 使用额度已接近上限，请明天再试。',
      'code', 'daily_limit',
      'used', v_day_used,
      'limit', v_policy.daily_token_limit
    );
  end if;

  if v_week_used + v_estimated_total > v_policy.weekly_token_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', '本周 HAI 使用额度已接近上限，请下周再试。',
      'code', 'weekly_limit',
      'used', v_week_used,
      'limit', v_policy.weekly_token_limit
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
      'allowed', false,
      'reason', '你当前已有 HAI 请求正在处理，请等待上一条回复完成。',
      'code', 'user_concurrency_limit',
      'limit', v_policy.user_concurrency_limit
    );
  end if;

  if v_global_active >= v_policy.global_concurrency_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', '当前 HAI 使用人数较多，请稍后重试。',
      'code', 'global_concurrency_limit',
      'limit', v_policy.global_concurrency_limit
    );
  end if;

  insert into public.hai_request_reservations (
    request_id,
    user_id,
    route,
    estimated_input_tokens,
    estimated_output_tokens,
    metadata
  )
  values (
    p_request_id,
    v_user_id,
    p_route,
    greatest(0, coalesce(p_estimated_input_tokens, 0)),
    greatest(0, coalesce(p_estimated_output_tokens, 0)),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (request_id) do update set
    status = 'active',
    expires_at = now() + interval '5 minutes',
    estimated_input_tokens = excluded.estimated_input_tokens,
    estimated_output_tokens = excluded.estimated_output_tokens,
    metadata = excluded.metadata;

  insert into public.hai_usage_events (
    user_id,
    request_id,
    event_type,
    route,
    status,
    input_tokens,
    output_tokens,
    total_tokens,
    metadata
  )
  values (
    v_user_id,
    p_request_id,
    'hai.request.started',
    p_route,
    'started',
    p_estimated_input_tokens,
    p_estimated_output_tokens,
    v_estimated_total,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return jsonb_build_object(
    'allowed', true,
    'request_id', p_request_id,
    'policy_key', v_policy.key,
    'daily_used', v_day_used,
    'daily_limit', v_policy.daily_token_limit,
    'weekly_used', v_week_used,
    'weekly_limit', v_policy.weekly_token_limit,
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
  v_status text := case when p_status in ('completed', 'failed', 'cached') then p_status else 'failed' end;
  v_input integer := greatest(0, coalesce(p_input_tokens, 0));
  v_output integer := greatest(0, coalesce(p_output_tokens, 0));
begin
  select * into v_reservation
  from public.hai_request_reservations
  where request_id = p_request_id
  for update;

  if v_reservation.id is null then
    return;
  end if;

  update public.hai_request_reservations
  set
    status = case when v_status = 'completed' or v_status = 'cached' then 'completed' else 'failed' end,
    actual_input_tokens = v_input,
    actual_output_tokens = v_output,
    completed_at = now()
  where request_id = p_request_id;

  insert into public.hai_usage_events (
    user_id,
    request_id,
    event_type,
    route,
    status,
    entity_type,
    entity_id,
    input_tokens,
    output_tokens,
    total_tokens,
    duration_ms,
    metadata
  )
  values (
    v_reservation.user_id,
    p_request_id,
    case when v_status = 'completed' then 'hai.request.completed' else 'hai.request.failed' end,
    coalesce(nullif(p_route, ''), v_reservation.route),
    v_status,
    p_entity_type,
    p_entity_id,
    v_input,
    v_output,
    v_input + v_output,
    p_duration_ms,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.hai_usage_summary(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_target uuid := coalesce(p_user_id, auth.uid());
  v_access public.hai_user_access%rowtype;
  v_policy public.hai_quota_policies%rowtype;
  v_access_level text;
  v_policy_key text;
  v_day_used integer := 0;
  v_week_used integer := 0;
begin
  if v_target is null then
    return jsonb_build_object('daily_used', 0, 'weekly_used', 0);
  end if;

  if v_target <> auth.uid() and not coalesce(public.is_admin(), false) then
    raise exception '无权限查看该用户 HAI 用量。';
  end if;

  select * into v_access from public.hai_user_access where user_id = v_target;
  select access_level::text into v_access_level from public.profiles where id = v_target;
  v_policy_key := coalesce(v_access.quota_policy_key, v_access_level, 'beta');

  select * into v_policy
  from public.hai_quota_policies
  where key = v_policy_key and enabled = true;
  if v_policy.key is null then
    select * into v_policy from public.hai_quota_policies where key = 'beta';
  end if;

  select coalesce(sum(coalesce(total_tokens, 0)), 0)::integer into v_day_used
  from public.hai_usage_events
  where user_id = v_target
    and status in ('completed', 'cached')
    and created_at >= date_trunc('day', now());

  select coalesce(sum(coalesce(total_tokens, 0)), 0)::integer into v_week_used
  from public.hai_usage_events
  where user_id = v_target
    and status in ('completed', 'cached')
    and created_at >= date_trunc('week', now());

  return jsonb_build_object(
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

create or replace function public.hai_match_material_chunks(
  query_text text,
  match_count integer default 8,
  target_user_id uuid default auth.uid(),
  target_conversation_id uuid default null
)
returns table (
  id uuid,
  material_id uuid,
  title text,
  kind text,
  content text,
  score real,
  metadata jsonb
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    chunk.id,
    material.id as material_id,
    material.title,
    material.kind,
    chunk.content,
    similarity(chunk.content, query_text)::real as score,
    chunk.metadata
  from public.hai_material_chunks chunk
  join public.hai_materials material on material.id = chunk.material_id
  where material.user_id = target_user_id
    and material.status in ('processed', 'processed_no_embedding')
    and (
      target_conversation_id is null
      or material.conversation_id = target_conversation_id
      or material.kind <> 'lesson_material'
    )
  order by
    case when target_conversation_id is not null and material.conversation_id = target_conversation_id then 0 else 1 end,
    similarity(chunk.content, query_text) desc,
    chunk.created_at desc
  limit greatest(1, match_count);
$$;

create or replace function public.hai_match_knowledge_chunks(
  query_text text,
  match_count integer default 6
)
returns table (
  id uuid,
  source_id uuid,
  title text,
  topic text,
  content text,
  score real,
  metadata jsonb
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    chunk.id,
    source.id as source_id,
    source.title,
    chunk.topic,
    chunk.content,
    similarity(chunk.content, query_text)::real as score,
    chunk.metadata
  from public.hai_knowledge_chunks chunk
  join public.hai_knowledge_sources source on source.id = chunk.source_id
  where source.visibility = 'shared'
    and source.is_active = true
  order by similarity(chunk.content, query_text) desc, chunk.created_at desc
  limit greatest(1, match_count);
$$;

grant execute on function public.hai_has_access(uuid) to authenticated;
grant execute on function public.hai_access_status() to authenticated;
grant execute on function public.hai_redeem_invite_code(text) to authenticated;
grant execute on function public.hai_check_and_reserve_usage(text, text, integer, integer, jsonb) to authenticated;
grant execute on function public.hai_finalize_usage(text, text, integer, integer, text, text, uuid, integer, jsonb) to authenticated;
grant execute on function public.hai_usage_summary(uuid) to authenticated;
grant execute on function public.hai_match_material_chunks(text, integer, uuid, uuid) to authenticated;
grant execute on function public.hai_match_knowledge_chunks(text, integer) to authenticated;

-- ---------- Seed v1 defaults ----------

insert into public.hai_quota_policies (
  key,
  label,
  daily_token_limit,
  weekly_token_limit,
  single_request_token_limit,
  max_output_tokens,
  user_concurrency_limit,
  global_concurrency_limit
)
values
  ('beta', '内测用户', 80000, 300000, 50000, 4096, 1, 50),
  ('free', '免费用户', 15000, 50000, 20000, 2048, 1, 30),
  ('plus', 'Plus 会员', 80000, 300000, 50000, 4096, 1, 50),
  ('pro', 'Pro 会员', 160000, 600000, 80000, 8192, 2, 80)
on conflict (key) do update set
  label = excluded.label,
  daily_token_limit = excluded.daily_token_limit,
  weekly_token_limit = excluded.weekly_token_limit,
  single_request_token_limit = excluded.single_request_token_limit,
  max_output_tokens = excluded.max_output_tokens,
  user_concurrency_limit = excluded.user_concurrency_limit,
  global_concurrency_limit = excluded.global_concurrency_limit;

insert into public.hai_feature_modules (
  slug,
  name,
  short_label,
  description,
  icon_key,
  category,
  input_schema,
  default_model,
  default_temperature,
  default_max_output_tokens,
  sort_order
)
values
  (
    'lesson-diagnosis',
    '诊断教案',
    '教案诊断',
    '粘贴一节课的教案或设计思路，HAI 从目标、任务、评价和学生视角指出关键改进点。',
    'clipboard-check',
    '教案诊断',
    '[{"name":"lesson_plan","label":"教案或设计思路","type":"textarea","required":true},{"name":"grade_subject","label":"学段学科","type":"text","required":false}]'::jsonb,
    'deepseek-v4-flash',
    0.20,
    4096,
    10
  ),
  (
    'ask-han',
    '问问哈老师',
    '问问哈老师',
    '面向教学设计、课堂实施、评价与教师成长的问答模式。',
    'message-circle-question',
    '教学问答',
    '[{"name":"question","label":"你的问题","type":"textarea","required":true}]'::jsonb,
    'deepseek-v4-flash',
    0.25,
    4096,
    20
  ),
  (
    'teaching-inspiration',
    '教学灵感',
    '教学灵感',
    '为导入、真实任务、活动重构、评价设计提供可讨论的灵感方向。',
    'lightbulb',
    '灵感生成',
    '[{"name":"topic","label":"课题/知识点","type":"text","required":true},{"name":"need","label":"想找哪类灵感","type":"textarea","required":false}]'::jsonb,
    'deepseek-v4-flash',
    0.55,
    4096,
    30
  )
on conflict (slug) do update set
  name = excluded.name,
  short_label = excluded.short_label,
  description = excluded.description,
  icon_key = excluded.icon_key,
  category = excluded.category,
  input_schema = excluded.input_schema,
  default_model = excluded.default_model,
  default_temperature = excluded.default_temperature,
  default_max_output_tokens = excluded.default_max_output_tokens,
  sort_order = excluded.sort_order,
  is_enabled = true;

insert into public.hai_prompt_versions (module_id, version_label, status, system_prompt, developer_prompt, published_at)
select module.id, 'seed-v1', 'published',
  case module.slug
    when 'lesson-diagnosis' then '你是 HAI，一位面向一线教师的教案诊断教练。你要基于老师提供的一节课，优先诊断目标、任务、评价、学情和课堂推进之间的结构关系。不要输出空泛鼓励，不要替老师写完整教案；先指出最关键的结构问题，再给出可操作的改进方向。'
    when 'ask-han' then '你是 HAI，以“哈老师”的教学设计判断力回应一线教师问题。回答要具体、克制、有判断，不堆术语。优先帮助老师厘清问题背后的教学机制，而不是给泛泛建议。'
    else '你是 HAI，一位教学灵感教练。你要给老师提供可选择、可讨论、能进入课堂设计的灵感方向。每个灵感都要说明它解决什么教学问题，以及可能的使用边界。'
  end,
  '这是占位 Prompt。管理员后续应在后台用正式调试后的 Prompt 发布新版本。模型回答需以中文输出，保持教师可直接理解的表达。',
  now()
from public.hai_feature_modules module
where not exists (
  select 1
  from public.hai_prompt_versions prompt
  where prompt.module_id = module.id
    and prompt.status = 'published'
);

insert into public.hai_runtime_settings
  (key, label, description, category, value, default_value, value_type, min_value, max_value, step, unit)
values
  ('context.window_tokens', '上下文窗口大小', '用于裁剪会话历史的模型上下文窗口。', '上下文', '1000000', '1000000', 'integer', 8000, 2000000, 1000, 'tokens'),
  ('context.warning_remaining_ratio', '低余量提醒阈值', '上下文剩余比例低于该值时提醒用户新开 session。', '上下文', '0.2', '0.2', 'number', 0.05, 0.5, 0.01, 'ratio'),
  ('chat.temperature', '默认发散度', '模块未覆盖时使用的默认 temperature。', '生成', '0.25', '0.25', 'number', 0, 1.5, 0.01, null),
  ('retrieval.material_match_count', '素材召回数量', '每轮最多召回多少个用户素材片段。', '检索', '8', '8', 'integer', 0, 30, 1, 'chunks'),
  ('retrieval.knowledge_match_count', '知识库召回数量', '每轮最多召回多少个 HAI 知识库片段。', '检索', '6', '6', 'integer', 0, 30, 1, 'chunks')
on conflict (key) do nothing;

commit;
