begin;

-- R13: the unified semantic router now owns intent recognition, problem
-- rewriting and diagnostic-module selection in one compact prompt. Keep the
-- former editable prompt blocks for reference, but stop presenting them as
-- active runtime layers because their content is no longer injected.

update public.hai_orchestrator_prompt_configs
set enabled = false,
    description = case
      when description like '%R13%' then description
      else description || '（R13 已由精简统一 semantic router 接管，资料保留但不再注入）'
    end,
    updated_at = now()
where key in (
  'intent_classifier_prompt',
  'problem_rewriter_prompt',
  'diagnostic_router_prompt'
);

commit;
