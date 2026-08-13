begin;

-- Work 的四个功能都允许在 Skill 开发尚未完成时继续运行。
-- 已有专属 Skill / 学科壳按更高 specificity 优先；只有没有匹配项时，
-- 才使用各功能的通用空壳 fallback。
insert into public.hai_work_skills (
  slug,
  module_slug,
  name,
  description,
  match_criteria,
  priority,
  is_fallback,
  is_enabled
)
values (
  'subject-lesson-design-empty-fallback',
  'subject-lesson-design',
  '公开课设计空 Skill',
  '公开课设计的通用空壳。没有匹配到学科专属 Skill 时，依据教材证据和通用输出要求继续生成。',
  '{}'::jsonb,
  -10000,
  true,
  true
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  match_criteria = excluded.match_criteria,
  priority = excluded.priority,
  is_fallback = true,
  is_enabled = true,
  updated_at = now();

insert into public.hai_work_skill_versions (
  skill_id,
  version_label,
  status,
  prompt_template,
  default_prompt_template,
  input_contract,
  output_contract,
  published_at
)
select
  skill.id,
  'empty-v1',
  'published',
  '',
  '',
  '{}'::jsonb,
  '{}'::jsonb,
  now()
from public.hai_work_skills skill
where skill.slug = 'subject-lesson-design-empty-fallback'
on conflict (skill_id, version_label) do nothing;

commit;
