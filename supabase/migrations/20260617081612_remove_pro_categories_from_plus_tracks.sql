-- Pro-only course categories should not appear in the Plus chapter/series map.
-- The Plus hierarchy is only: plus chapter -> Plus course category/series -> Plus lessons.

update public.course_categories cc
set plus_track_id = null
where cc.name in (
  'AI工具',
  'AI工具应用',
  '教育技术',
  'ClaudeCode教程',
  'AI科普'
)
and not exists (
  select 1
  from public.courses c
  where c.category = cc.name
    and c.membership_type = 'plus'
);

notify pgrst, 'reload schema';
