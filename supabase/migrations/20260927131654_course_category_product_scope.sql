-- A series category belongs to one course product. Its Plus track remains a
-- local chapter mapping for the teaching-general product only.
alter table public.course_categories
  add column access_product_code text references public.course_access_products(code)
    on update cascade on delete restrict;

comment on column public.course_categories.access_product_code is
  '系列课所属课程产品；为空时属于免费课程。';

-- Existing categories are currently used by one product each. Resolve their
-- product from their courses, retaining track-only draft categories.
update public.course_categories cc
set access_product_code = source.access_product_code
from (
  select category_id, min(access_product_code) as access_product_code
  from public.courses
  where category_id is not null and access_product_code is not null
  group by category_id
) source
where cc.id = source.category_id;

update public.course_categories
set access_product_code = 'teaching-general-v1'
where access_product_code is null and plus_track_id is not null;

-- These two empty series already appear beside the Teacher AI web-development
-- series in the existing catalog, but have no course row to infer from yet.
update public.course_categories
set access_product_code = 'teacher-ai'
where access_product_code is null and name in ('网站部署篇', '网站运维篇');

-- Match the two chapters currently defined by the Daofa course outline.
insert into public.course_categories
  (name, description, sort_order, is_active, access_product_code)
select outline.name, outline.description, outline.sort_order, true, 'daofa-textbook'
from (values
  ('总论篇', '从课标到教材的整体地图', 0),
  ('分册解读篇', '一至九年级上下册教材解读', 1)
) as outline(name, description, sort_order)
where not exists (
  select 1 from public.course_categories existing where existing.name = outline.name
);

create index course_categories_product_order_idx
  on public.course_categories (access_product_code, sort_order, name);

-- The existing category RLS policies and grants already restrict writes to
-- admins; the new column uses those same policies.
