begin;

alter table public.hai_feature_modules
  add column if not exists default_top_p numeric(3, 2) default null check (default_top_p is null or (default_top_p >= 0 and default_top_p <= 1)),
  add column if not exists reasoning_effort text default 'high' check (reasoning_effort in ('high', 'max')),
  add column if not exists response_format text not null default 'text' check (response_format in ('text', 'json_object')),
  add column if not exists stop_sequences text[] not null default '{}'::text[],
  add column if not exists history_message_limit integer not null default 20 check (history_message_limit >= 0 and history_message_limit <= 80),
  add column if not exists memory_limit integer not null default 20 check (memory_limit >= 0 and memory_limit <= 80),
  add column if not exists material_match_count integer not null default 8 check (material_match_count >= 0 and material_match_count <= 50),
  add column if not exists knowledge_match_count integer not null default 6 check (knowledge_match_count >= 0 and knowledge_match_count <= 50);

insert into public.hai_runtime_settings
  (key, label, description, category, value, default_value, value_type, min_value, max_value, step, options, unit)
values
  ('retrieval.material_chunk_max_chars', '素材片段长度', '每个用户素材片段注入提示词时保留的最大字符数。', '检索', to_jsonb(1800), to_jsonb(1800), 'integer', 200, 6000, 100, '[]'::jsonb, 'chars'),
  ('retrieval.knowledge_chunk_max_chars', '知识片段长度', '每个知识库片段注入提示词时保留的最大字符数。', '检索', to_jsonb(1400), to_jsonb(1400), 'integer', 200, 6000, 100, '[]'::jsonb, 'chars'),
  ('context.memory_enabled', '启用用户记忆', '是否把用户长期记忆注入 HAI 提示词。', '上下文', to_jsonb(true), to_jsonb(true), 'boolean', null, null, null, '[]'::jsonb, null),
  ('retrieval.material_enabled', '启用用户素材检索', '是否检索并注入用户上传或沉淀素材。', '检索', to_jsonb(true), to_jsonb(true), 'boolean', null, null, null, '[]'::jsonb, null),
  ('retrieval.knowledge_enabled', '启用知识库检索', '是否检索并注入 HAI 共享知识库。', '检索', to_jsonb(true), to_jsonb(true), 'boolean', null, null, null, '[]'::jsonb, null),
  ('observability.log_config_snapshot', '记录参数快照', '是否在消息与用量日志中记录本次调用的模型、采样、上下文和检索配置。', '观测', to_jsonb(true), to_jsonb(true), 'boolean', null, null, null, '[]'::jsonb, null),
  ('chat.roundtable_min_temperature', '圆桌最低温度', '圆桌模式在模块温度较低时使用的最低 temperature。', '生成', to_jsonb(0.35), to_jsonb(0.35), 'number', 0, 2, 0.01, '[]'::jsonb, null)
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  default_value = excluded.default_value,
  value_type = excluded.value_type,
  min_value = excluded.min_value,
  max_value = excluded.max_value,
  step = excluded.step,
  options = excluded.options,
  unit = excluded.unit;

commit;
