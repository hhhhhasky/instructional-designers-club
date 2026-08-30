begin;

-- “subject-lesson-design” is the stable tool identity used by existing tasks.
-- Rename only current display metadata so historical tasks and foreign-key
-- relationships continue to work without a data rewrite.
update public.hai_feature_modules
set
  name = '公开课设计',
  short_label = '公开课',
  description = '依据所选学科教材、真实学情与对应学科 Skill，生成目标、活动和评价证据闭环的完整公开课教学设计。',
  updated_at = now()
where slug = 'subject-lesson-design';

update public.hai_work_skills
set
  name = case slug
    when 'subject-lesson-design-general' then '公开课通用设计'
    when 'politics-public-lesson' then '道德与法治 / 思想政治公开课设计'
    else name
  end,
  description = case slug
    when 'subject-lesson-design-general' then '学科专属 Skill 尚未发布时使用的通用公开课设计能力。'
    when 'politics-public-lesson' then '用于道德与法治、思想政治学科公开课设计及配套资料的专属能力。'
    else description
  end,
  updated_at = now()
where slug in ('subject-lesson-design-general', 'politics-public-lesson');

commit;
