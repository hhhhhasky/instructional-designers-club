begin;

insert into public.hai_runtime_settings
  (key, label, description, category, value, default_value, value_type, min_value, max_value, step, options, unit)
values
  ('context.orchestrator_enabled', '启用上下文编排', '开启后，HAI 单聊会先做意图识别、记忆选择、问题重构、诊断框架选择和检索规划，再生成回答。关闭后回退到旧 Prompt + 记忆 + RAG 拼接链路。', '上下文编排', to_jsonb(true), to_jsonb(true), 'boolean', null, null, null, '[]'::jsonb, null),
  ('orchestrator.case_max', '案例库上限', '每轮回答最多注入的本地案例库样例数量。案例优先用于校准判断和回答结构。', '上下文编排', to_jsonb(3), to_jsonb(3), 'integer', 0, 8, 1, '[]'::jsonb, 'cases'),
  ('orchestrator.method_max', '方法库上限', '每轮回答最多召回的方法库/哈老师方法论片段数量。', '上下文编排', to_jsonb(2), to_jsonb(2), 'integer', 0, 8, 1, '[]'::jsonb, 'chunks'),
  ('orchestrator.theory_max', '理论库上限', '每轮回答最多召回的理论支撑片段数量。理论只做支撑，不应压过案例和方法。', '上下文编排', to_jsonb(1), to_jsonb(1), 'integer', 0, 5, 1, '[]'::jsonb, 'chunks'),
  ('orchestrator.expression_max', '表达库上限', '每轮回答最多注入的哈老师表达句式数量，用于生成阶段的表达校准。', '上下文编排', to_jsonb(5), to_jsonb(5), 'integer', 0, 12, 1, '[]'::jsonb, 'phrases'),
  ('evaluator.enabled', '启用回答质检', '开启后，HAI 会先生成初稿，再用确定性质检器检查判断、重构、泛泛建议、操作性、风格、边界和不确定性处理。', '质检', to_jsonb(true), to_jsonb(true), 'boolean', null, null, null, '[]'::jsonb, null),
  ('evaluator.pass_score', '质检通过分', '回答质检达到该分数且问题数量不超过阈值时直接输出，否则触发一次重写。', '质检', to_jsonb(78), to_jsonb(78), 'integer', 0, 100, 1, '[]'::jsonb, 'score'),
  ('evaluator.max_rewrites', '最大重写次数', '质检不通过时最多自动重写的次数。MVP 阶段建议保持 1，避免无限循环和高延迟。', '质检', to_jsonb(1), to_jsonb(1), 'integer', 0, 1, 1, '[]'::jsonb, 'times')
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
