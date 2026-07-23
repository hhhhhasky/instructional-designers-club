begin;

-- HAI Chat 已统一使用已发布并绑定的 Chat Skill。
-- 移除不再生效的上下文编排、语义路由兜底及旧 Prompt 发布数据结构。
delete from public.hai_runtime_settings
where key in (
  'context.orchestrator_enabled',
  'context.orchestrator_method_max',
  'router.llm_fallback_enabled',
  'router.llm_confidence_threshold'
);

update public.hai_runtime_settings
set
  value = to_jsonb('review_only'::text),
  default_value = to_jsonb('review_only'::text),
  updated_at = now()
where key = 'daily_review.auto_publish_mode';

drop table if exists public.hai_orchestrator_prompt_configs;
drop table if exists public.hai_prompt_versions;

commit;
