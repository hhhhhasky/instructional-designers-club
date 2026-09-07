begin;

alter table public.hai_image_generation_runs
  add column if not exists optimized_prompt text,
  add column if not exists prompt_optimizer_model text,
  add column if not exists prompt_optimizer_provider text,
  add column if not exists prompt_optimizer_usage jsonb not null default '{}'::jsonb,
  add column if not exists prompt_optimizer_duration_ms integer,
  add column if not exists prompt_optimizer_error text;

comment on column public.hai_image_generation_runs.optimized_prompt is 'DeepSeek 优化后的最终生图提示词';
comment on column public.hai_image_generation_runs.prompt_optimizer_usage is '提示词优化阶段的供应商用量摘要';

commit;
