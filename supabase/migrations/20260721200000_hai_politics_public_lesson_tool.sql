begin;

-- 首版学科设计先收束到用户已有方法与资料最成熟的思政公开课场景。
-- 保留原 slug，避免破坏已有任务、产物和 Skill 关联。
update public.hai_feature_modules
set
  name = '思政公开课设计',
  short_label = '思政公开课',
  description = '依据教材正文和真实学情，匹配已发布的思政 Skill，让价值议题、学习任务、课堂活动与评价证据形成完整闭环。',
  input_schema = '[
    {"name":"stage","label":"学段","type":"text","required":true},
    {"name":"subject","label":"学科","type":"text","required":true,"default":"思想政治","readonly":true},
    {"name":"unit","label":"单元","type":"text","required":true},
    {"name":"topic","label":"课题","type":"text","required":true},
    {"name":"lesson_type","label":"课型","type":"text","required":true,"default":"公开课","readonly":true},
    {"name":"textbook_content","label":"教材正文","type":"textarea","required":false}
  ]'::jsonb,
  updated_at = now()
where slug = 'subject-lesson-design'
  and surface_mode = 'work';

update public.hai_work_skills
set
  name = case slug
    when 'subject-lesson-design-general' then '思政公开课基础设计'
    when 'politics-public-lesson' then '思政公开课专属设计'
    else name
  end,
  description = case slug
    when 'subject-lesson-design-general' then '专属 Skill 尚未发布时使用的材料边界型思政公开课设计能力。'
    when 'politics-public-lesson' then '用于承载正式思政公开课 Skill 与配套资料的专属能力。'
    else description
  end,
  updated_at = now()
where slug in ('subject-lesson-design-general', 'politics-public-lesson');

commit;
