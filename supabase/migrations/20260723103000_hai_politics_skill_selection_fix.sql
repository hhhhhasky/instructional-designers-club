begin;

-- The published specialist must participate in criteria-based selection. It was
-- accidentally marked as the module fallback, while the empty-criteria legacy
-- skill was marked as a specialist, causing every public-lesson run to bypass
-- the versioned references.
update public.hai_work_skills
set
  is_fallback = false,
  is_enabled = true,
  priority = 100,
  match_criteria = jsonb_build_object(
    'subjects', jsonb_build_array('道德与法治', '思想政治', '思政'),
    'lesson_types', jsonb_build_array('公开课'),
    'teaching_modes', jsonb_build_array('案例式', '议题式', '任务式')
  ),
  updated_at = now()
where slug = 'politics-public-lesson'
  and module_slug = 'subject-lesson-design';

update public.hai_work_skills
set
  is_fallback = true,
  is_enabled = true,
  priority = 0,
  updated_at = now()
where slug = 'subject-lesson-design-general'
  and module_slug = 'subject-lesson-design';

commit;
