begin;

insert into public.hai_quota_policies (
  key,
  label,
  daily_token_limit,
  weekly_token_limit,
  single_request_token_limit,
  max_output_tokens,
  user_concurrency_limit,
  global_concurrency_limit,
  enabled
)
values (
  'internal',
  '内部测试',
  600000,
  2000000,
  120000,
  8192,
  1,
  20,
  true
)
on conflict (key) do update set
  label = excluded.label,
  daily_token_limit = excluded.daily_token_limit,
  weekly_token_limit = excluded.weekly_token_limit,
  single_request_token_limit = excluded.single_request_token_limit,
  max_output_tokens = excluded.max_output_tokens,
  user_concurrency_limit = excluded.user_concurrency_limit,
  global_concurrency_limit = excluded.global_concurrency_limit,
  enabled = excluded.enabled,
  updated_at = now();

commit;
