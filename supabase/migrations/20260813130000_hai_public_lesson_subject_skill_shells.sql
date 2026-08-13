begin;

-- 为公开课设计预留主要学科的独立 Skill 壳。
-- 壳必须有 published 版本，才能被 Work 运行层选中；提示词可以为空，
-- 后续由管理员复制为草稿并补充学科专属方法。
with subject_shells(slug, subject_name, aliases, sort_order) as (
  values
    ('subject-lesson-design-chinese', '语文', array['语文']::text[], 10),
    ('subject-lesson-design-mathematics', '数学', array['数学']::text[], 20),
    ('subject-lesson-design-english', '英语', array['英语']::text[], 30),
    ('subject-lesson-design-physics', '物理', array['物理']::text[], 40),
    ('subject-lesson-design-chemistry', '化学', array['化学']::text[], 50),
    ('subject-lesson-design-biology', '生物', array['生物']::text[], 60),
    ('subject-lesson-design-geography', '地理', array['地理']::text[], 70),
    ('subject-lesson-design-history', '历史', array['历史']::text[], 80),
    ('subject-lesson-design-science', '科学', array['科学']::text[], 90),
    ('subject-lesson-design-information-technology', '信息科技', array['信息科技', '信息技术']::text[], 100),
    ('subject-lesson-design-psychology', '心理健康', array['心理健康']::text[], 110),
    ('subject-lesson-design-music', '音乐', array['音乐']::text[], 120),
    ('subject-lesson-design-art', '美术', array['美术']::text[], 130),
    ('subject-lesson-design-physical-education', '体育', array['体育']::text[], 140),
    ('subject-lesson-design-integrated-practice', '综合实践', array['综合实践']::text[], 150),
    ('subject-lesson-design-general-technology', '通用技术', array['通用技术']::text[], 160),
    ('subject-lesson-design-professional', '其他 / 专业课', array['其他 / 专业课', '其他', '专业课']::text[], 170)
)
insert into public.hai_work_skills (
  slug, module_slug, name, description, match_criteria, priority, is_fallback, is_enabled
)
select
  shell.slug,
  'subject-lesson-design',
  shell.subject_name || '公开课设计 Skill',
  '暂为空的学科 Skill 壳。后续可在后台补充该学科的公开课生成提示词与参考资料。',
  jsonb_build_object(
    'subjects', to_jsonb(shell.aliases),
    'lesson_types', jsonb_build_array('公开课')
  ),
  20 + shell.sort_order,
  false,
  true
from subject_shells shell
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  match_criteria = excluded.match_criteria,
  priority = excluded.priority,
  is_fallback = false,
  is_enabled = true,
  updated_at = now();

with subject_shells(slug) as (
  values
    ('subject-lesson-design-chinese'),
    ('subject-lesson-design-mathematics'),
    ('subject-lesson-design-english'),
    ('subject-lesson-design-physics'),
    ('subject-lesson-design-chemistry'),
    ('subject-lesson-design-biology'),
    ('subject-lesson-design-geography'),
    ('subject-lesson-design-history'),
    ('subject-lesson-design-science'),
    ('subject-lesson-design-information-technology'),
    ('subject-lesson-design-psychology'),
    ('subject-lesson-design-music'),
    ('subject-lesson-design-art'),
    ('subject-lesson-design-physical-education'),
    ('subject-lesson-design-integrated-practice'),
    ('subject-lesson-design-general-technology'),
    ('subject-lesson-design-professional')
)
insert into public.hai_work_skill_versions (
  skill_id, version_label, status, prompt_template, default_prompt_template,
  input_contract, output_contract, published_at
)
select
  skill.id,
  'shell-v1',
  'published',
  '',
  '',
  '{}'::jsonb,
  '{}'::jsonb,
  now()
from public.hai_work_skills skill
join subject_shells shell on shell.slug = skill.slug
on conflict (skill_id, version_label) do nothing;

commit;
