-- HAI 每日自我优化闭环的结构化留痕表。
-- 由 scripts/hai-apply-prompt-config.mjs 在每次落地时写入;
-- docs/项目需求与开发进展.md 是当前人类可读项目台账；详细质量证据保存在 docs/hai-quality-runs/。

create table if not exists public.hai_optimization_log (
  id uuid primary key default gen_random_uuid(),
  -- 评估归属日本地日期（YYYY-MM-DD），用于幂等去重
  run_date date not null,
  -- 当日评估的对话轮次数
  turns_evaluated integer not null default 0,
  -- 当日发现的问题（数组：{dimension, severity, turn_id, summary, target_layer}）
  issues_found jsonb not null default '[]'::jsonb,
  -- 已自动写入 hai_orchestrator_prompt_configs 的改动（数组：{key, reason, applied_at}）
  changes_applied jsonb not null default '[]'::jsonb,
  -- 仅记录、未自动写入的待确认改动（高风险）
  changes_pending jsonb not null default '[]'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists hai_optimization_log_run_date_idx
  on public.hai_optimization_log (run_date);

comment on table public.hai_optimization_log is
  'HAI 每日自我优化闭环的留痕表：每个评估日一行，记录评估范围、问题、已落地与待确认改动。';
