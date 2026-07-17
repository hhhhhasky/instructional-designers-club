begin;

create table if not exists public.hai_method_card_configs (
  id text primary key,
  name text not null,
  aliases text[] not null default '{}',
  course text not null,
  kind text not null check (
    kind in (
      'methodology',
      'framework',
      'method',
      'strategy',
      'consultation_standard'
    )
  ),
  ownership text not null check (
    ownership in (
      'han_course',
      'course_adapted_theory',
      'consultation_calibration'
    )
  ),
  priority integer not null default 50 check (priority between 0 and 100),
  summary text not null default '',
  use_when text[] not null default '{}',
  avoid_when text[] not null default '{}',
  core_judgement text not null default '',
  moves text[] not null default '{}',
  answer_focus text not null default '',
  query_terms text[] not null default '{}',
  intents text[] not null default '{}',
  related text[] not null default '{}',
  source_refs text[] not null default '{}',
  enabled boolean not null default true,
  is_deleted boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

drop trigger if exists update_hai_method_card_configs_updated_at
  on public.hai_method_card_configs;
create trigger update_hai_method_card_configs_updated_at
  before update on public.hai_method_card_configs
  for each row execute function public.update_updated_at_column();

alter table public.hai_method_card_configs enable row level security;

grant select, insert, update, delete
  on public.hai_method_card_configs
  to authenticated, service_role;

drop policy if exists "hai_method_card_configs_admin_read"
  on public.hai_method_card_configs;
create policy "hai_method_card_configs_admin_read"
  on public.hai_method_card_configs
  for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "hai_method_card_configs_admin_write"
  on public.hai_method_card_configs;
create policy "hai_method_card_configs_admin_write"
  on public.hai_method_card_configs
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

comment on table public.hai_method_card_configs is
  'HAI 方法卡数据库覆盖层。无记录时使用代码默认卡；有记录时覆盖、停用或删除默认卡，也可新增动态方法卡。';

commit;
