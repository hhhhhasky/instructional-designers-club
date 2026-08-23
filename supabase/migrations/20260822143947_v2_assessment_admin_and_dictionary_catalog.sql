-- V2 课程编辑补齐：标准字典目录、评估题原子保存、Lesson 发布父级联动。
-- 仅修改 v2_ 对象，不修改 V1 课程系统。

begin;

insert into public.v2_dictionary_groups (key, name, description, sort_order, is_active)
values
  ('unit_type', '单元类型', '对应 v2_course_units.unit_type_id', 10, true),
  ('lesson_type', '单课类型', '对应 v2_course_lessons.lesson_type_id', 20, true),
  ('objective_type', '教学目标类型', '对应 v2_course_lessons.objectives[].type_id', 30, true),
  ('resource_type', '资源类型', '对应 v2_lesson_resources.resource_type_id', 40, true),
  ('resource_usage', '资源用途', '对应 v2_lesson_resources.usage_type_id', 50, true),
  ('knowledge_card_type', '知识卡类型', '对应 v2_lesson_knowledge_cards.card_type_id', 60, true),
  ('assessment_type', '评估区块类型', '对应 v2_assessment_blocks.assessment_type_id', 70, true),
  ('item_type', '试题类型', '对应 v2_assessment_items.item_type_id', 80, true),
  ('grading_mode', '评分方式', '对应 v2_assessment_items.grading_mode_id', 90, true)
on conflict (key) do nothing;

with presets(group_key, item_key, label, english_name, sort_order) as (
  values
    ('unit_type', 'foundation', '基础建构', 'Foundation', 10),
    ('unit_type', 'practice', '实践应用', 'Practice', 20),
    ('unit_type', 'integration', '综合迁移', 'Integration', 30),
    ('lesson_type', 'concept', '概念课', 'Concept lesson', 10),
    ('lesson_type', 'method', '方法课', 'Method lesson', 20),
    ('lesson_type', 'case', '案例课', 'Case lesson', 30),
    ('lesson_type', 'practice', '实践课', 'Practice lesson', 40),
    ('objective_type', 'knowledge', '知识理解', 'Knowledge and understanding', 10),
    ('objective_type', 'skill', '技能应用', 'Skill and application', 20),
    ('objective_type', 'attitude', '态度与价值', 'Attitude and value', 30),
    ('objective_type', 'transfer', '迁移与创造', 'Transfer and creation', 40),
    ('resource_type', 'video', '视频', 'Video', 10),
    ('resource_type', 'audio', '音频', 'Audio', 20),
    ('resource_type', 'image', '图片', 'Image', 30),
    ('resource_type', 'pdf', 'PDF', 'PDF', 40),
    ('resource_type', 'document', '文档', 'Document', 50),
    ('resource_type', 'presentation', '演示文稿', 'Presentation', 60),
    ('resource_type', 'link', '外部链接', 'External link', 70),
    ('resource_usage', 'primary', '主要内容', 'Primary content', 10),
    ('resource_usage', 'supplement', '补充资料', 'Supplement', 20),
    ('resource_usage', 'reference', '参考资料', 'Reference', 30),
    ('resource_usage', 'template', '任务模板', 'Template', 40),
    ('knowledge_card_type', 'concept', '核心概念', 'Core concept', 10),
    ('knowledge_card_type', 'principle', '核心原理', 'Principle', 20),
    ('knowledge_card_type', 'method', '方法步骤', 'Method', 30),
    ('knowledge_card_type', 'example', '示例', 'Example', 40),
    ('knowledge_card_type', 'checklist', '检查清单', 'Checklist', 50),
    ('assessment_type', 'pretest', '前测', 'Pre-assessment', 10),
    ('assessment_type', 'practice', '课中练习', 'Practice', 20),
    ('assessment_type', 'posttest', '后测', 'Post-assessment', 30),
    ('assessment_type', 'authentic_task', '真实任务', 'Authentic task', 40),
    ('item_type', 'single_choice', '单选题', 'Single choice', 10),
    ('item_type', 'multiple_choice', '多选题', 'Multiple choice', 20),
    ('item_type', 'true_false', '判断题', 'True or false', 30),
    ('item_type', 'short_answer', '简答题', 'Short answer', 40),
    ('item_type', 'open_task', '开放性真实任务', 'Open authentic task', 50),
    ('grading_mode', 'auto', '自动评分', 'Automatic grading', 10),
    ('grading_mode', 'manual', '教师批阅', 'Manual review', 20),
    ('grading_mode', 'hybrid', '自动与教师混合', 'Hybrid grading', 30)
)
insert into public.v2_dictionary_items (
  group_id,
  key,
  label,
  metadata,
  sort_order,
  is_active
)
select
  groups.id,
  presets.item_key,
  presets.label,
  jsonb_build_object('english_name', presets.english_name, 'system_preset', true),
  presets.sort_order,
  true
from presets
join public.v2_dictionary_groups groups on groups.key = presets.group_key
on conflict (group_id, key) do nothing;

create or replace function public.v2_publish_lesson_admin(p_lesson_id uuid)
returns public.v2_course_lessons
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_lesson public.v2_course_lessons;
begin
  if (select auth.uid()) is null or not (select private.v2_can_manage()) then
    raise exception 'Only active V2 managers can publish lessons' using errcode = '42501';
  end if;

  update public.v2_course_modules modules
  set status = 'published', is_active = true
  from public.v2_course_units units
  join public.v2_course_lessons lessons on lessons.unit_id = units.id
  where lessons.id = p_lesson_id
    and modules.id = units.module_id;

  update public.v2_course_units units
  set status = 'published', is_active = true
  from public.v2_course_lessons lessons
  where lessons.id = p_lesson_id
    and units.id = lessons.unit_id;

  update public.v2_course_lessons
  set status = 'published', published_at = coalesce(published_at, now())
  where id = p_lesson_id
  returning * into saved_lesson;

  if saved_lesson.id is null then
    raise exception 'V2 lesson not found' using errcode = 'P0002';
  end if;

  return saved_lesson;
end;
$$;

create or replace function public.v2_save_assessment_item_admin(
  p_item_id uuid,
  p_assessment_block_id uuid,
  p_item_type_id uuid,
  p_grading_mode_id uuid,
  p_prompt_markdown text,
  p_case_markdown text,
  p_max_score numeric,
  p_rubric jsonb,
  p_sort_order integer,
  p_is_required boolean,
  p_options jsonb,
  p_answer_key jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_item_id uuid;
  item_type_key text;
begin
  if (select auth.uid()) is null or not (select private.v2_can_manage()) then
    raise exception 'Only active V2 managers can save assessment items' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_prompt_markdown, ''))) = 0 then
    raise exception 'Assessment prompt cannot be blank' using errcode = '23514';
  end if;

  if jsonb_typeof(coalesce(p_options, '[]'::jsonb)) <> 'array' then
    raise exception 'Assessment options must be an array' using errcode = '22023';
  end if;

  if p_rubric is not null and jsonb_typeof(p_rubric) <> 'object' then
    raise exception 'Assessment rubric must be an object' using errcode = '22023';
  end if;

  select items.key into item_type_key
  from public.v2_dictionary_items items
  join public.v2_dictionary_groups groups on groups.id = items.group_id
  where items.id = p_item_type_id and groups.key = 'item_type' and items.is_active;

  if p_item_type_id is not null and item_type_key is null then
    raise exception 'Invalid assessment item type' using errcode = '23503';
  end if;

  if item_type_key in ('single_choice', 'multiple_choice', 'true_false') then
    if jsonb_array_length(coalesce(p_options, '[]'::jsonb)) < 2 then
      raise exception 'Choice items require at least two options' using errcode = '23514';
    end if;
    if p_answer_key is null
      or jsonb_typeof(p_answer_key) <> 'object'
      or jsonb_typeof(p_answer_key -> 'correct') <> 'array'
      or jsonb_array_length(p_answer_key -> 'correct') = 0 then
      raise exception 'Choice items require a private correct answer' using errcode = '23514';
    end if;
  end if;

  if p_item_id is null then
    insert into public.v2_assessment_items (
      assessment_block_id, item_type_id, grading_mode_id, prompt_markdown,
      case_markdown, max_score, rubric, sort_order, is_required
    )
    values (
      p_assessment_block_id, p_item_type_id, p_grading_mode_id, p_prompt_markdown,
      nullif(p_case_markdown, ''), p_max_score, p_rubric, p_sort_order, p_is_required
    )
    returning id into saved_item_id;
  else
    update public.v2_assessment_items
    set item_type_id = p_item_type_id,
        grading_mode_id = p_grading_mode_id,
        prompt_markdown = p_prompt_markdown,
        case_markdown = nullif(p_case_markdown, ''),
        max_score = p_max_score,
        rubric = p_rubric,
        sort_order = p_sort_order,
        is_required = p_is_required
    where id = p_item_id and assessment_block_id = p_assessment_block_id
    returning id into saved_item_id;
  end if;

  if saved_item_id is null then
    raise exception 'V2 assessment item not found' using errcode = 'P0002';
  end if;

  delete from public.v2_assessment_options where item_id = saved_item_id;

  insert into public.v2_assessment_options (item_id, option_key, option_text, sort_order)
  select
    saved_item_id,
    btrim(option_value ->> 'key'),
    btrim(option_value ->> 'text'),
    coalesce((option_value ->> 'sort_order')::integer, option_ordinality::integer - 1)
  from jsonb_array_elements(coalesce(p_options, '[]'::jsonb))
    with ordinality as option_rows(option_value, option_ordinality)
  where length(btrim(coalesce(option_value ->> 'key', ''))) > 0
    and length(btrim(coalesce(option_value ->> 'text', ''))) > 0;

  if p_answer_key is null then
    delete from private.v2_assessment_keys where item_id = saved_item_id;
  else
    insert into private.v2_assessment_keys (item_id, answer_key, scoring_config)
    values (saved_item_id, p_answer_key, '{}'::jsonb)
    on conflict (item_id) do update
      set answer_key = excluded.answer_key,
          scoring_config = excluded.scoring_config;
  end if;

  return saved_item_id;
end;
$$;

create or replace function public.v2_get_assessment_key_admin(p_item_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.v2_can_manage()) then
    raise exception 'Only active V2 managers can read assessment keys' using errcode = '42501';
  end if;

  return (
    select keys.answer_key
    from private.v2_assessment_keys keys
    where keys.item_id = p_item_id
  );
end;
$$;

revoke all on function public.v2_publish_lesson_admin(uuid) from public, anon;
revoke all on function public.v2_save_assessment_item_admin(uuid, uuid, uuid, uuid, text, text, numeric, jsonb, integer, boolean, jsonb, jsonb) from public, anon;
revoke all on function public.v2_get_assessment_key_admin(uuid) from public, anon;
grant execute on function public.v2_publish_lesson_admin(uuid) to authenticated;
grant execute on function public.v2_save_assessment_item_admin(uuid, uuid, uuid, uuid, text, text, numeric, jsonb, integer, boolean, jsonb, jsonb) to authenticated;
grant execute on function public.v2_get_assessment_key_admin(uuid) to authenticated;

commit;
