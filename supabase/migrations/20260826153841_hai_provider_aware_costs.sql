begin;

-- Keep provider identity explicit so cost attribution follows the selected
-- backend instead of assuming every OpenAI-compatible endpoint is DeepSeek.
alter table public.hai_model_providers
  add column if not exists provider_code text not null default 'openai_compatible';

update public.hai_model_providers
set provider_code = case
  when lower(base_url) like '%deepseek%' then 'deepseek'
  when lower(base_url) like '%bigmodel%' or lower(base_url) like '%z.ai%' then 'zhipu'
  else coalesce(nullif(provider_code, ''), 'openai_compatible')
end;

alter table public.hai_model_pricing
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- GLM-5.3-Flash token pricing (CNY / million tokens). Zhipu does not publish
-- a separate peak/off-peak multiplier for this API route, so both bands use
-- the same published rates and remain editable as a price snapshot.
insert into public.hai_model_pricing (
  provider,
  model_name,
  effective_from,
  peak_cache_hit_input_per_million,
  peak_cache_miss_input_per_million,
  peak_output_per_million,
  off_peak_cache_hit_input_per_million,
  off_peak_cache_miss_input_per_million,
  off_peak_output_per_million,
  metadata
)
values (
  'zhipu',
  'GLM-5.3-flash',
  '2026-08-26 00:00:00+08',
  2.00,
  8.00,
  28.00,
  2.00,
  8.00,
  28.00,
  jsonb_build_object('source', 'https://bigmodel.cn/pricing', 'peak_policy', 'same_as_standard')
)
on conflict (provider, model_name, effective_from) do update set
  peak_cache_hit_input_per_million = excluded.peak_cache_hit_input_per_million,
  peak_cache_miss_input_per_million = excluded.peak_cache_miss_input_per_million,
  peak_output_per_million = excluded.peak_output_per_million,
  off_peak_cache_hit_input_per_million = excluded.off_peak_cache_hit_input_per_million,
  off_peak_cache_miss_input_per_million = excluded.off_peak_cache_miss_input_per_million,
  off_peak_output_per_million = excluded.off_peak_output_per_million,
  metadata = excluded.metadata,
  updated_at = now();

commit;
