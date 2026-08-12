begin;

-- Keep the full trace outside hai_work_runs.  Work owners may read their own
-- run rows, but prompt assembly, retrieved material and model output are
-- operator-only debugging data.
create table if not exists public.hai_work_debug_traces (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.hai_work_runs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  debug_trace jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.hai_work_debug_traces is
  '管理员专用的 HAI Work 完整生成链路快照，不含模型 API 密钥';

alter table public.hai_work_debug_traces enable row level security;

create policy "hai work debug traces admin only"
  on public.hai_work_debug_traces for select to authenticated
  using ((select public.is_admin()));

grant select on public.hai_work_debug_traces to authenticated;

create index if not exists idx_hai_work_debug_traces_created
  on public.hai_work_debug_traces(created_at desc);

commit;
