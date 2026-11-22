begin;

alter table public.courses add column route_slug text;
alter table public.v2_course_lessons add column route_slug text;

-- A sequence keeps new lesson names unique even when two editors publish the same title.
create sequence public.course_route_slug_number;
revoke all on sequence public.course_route_slug_number from public, anon, authenticated;
grant usage on sequence public.course_route_slug_number to authenticated, service_role;

-- Preserve course edit dates while backfilling navigation metadata.
alter table public.courses disable trigger update_courses_updated_at;
alter table public.v2_course_lessons disable trigger v2_course_lessons_updated_at;

-- Freeze existing routes once. Double hyphens are reserved for disambiguation.
with names as (
  select id, created_at,
    case when access_product_code = 'gongding-gongkaike' and sort_order = 1
      then 'four-levels'
      else coalesce(nullif(trim(both '-' from left(regexp_replace(lower(title), '[^a-z0-9㐀-鿿]+', '-', 'g'), 36)), ''), 'lesson')
    end as slug
  from public.courses
), numbered as (
  select id, slug, row_number() over (partition by slug order by created_at nulls last, id) as occurrence
  from names
)
update public.courses as course
set route_slug = slug || case when occurrence > 1 then '--' || nextval('public.course_route_slug_number'::regclass) else '' end
from numbered
where course.id = numbered.id;

with names as (
  select id, created_at,
    coalesce(nullif(trim(both '-' from left(regexp_replace(lower(coalesce(nullif(slug, ''), title)), '[^a-z0-9㐀-鿿]+', '-', 'g'), 36)), ''), 'lesson') as route_name
  from public.v2_course_lessons
), numbered as (
  select id, route_name, row_number() over (partition by route_name order by created_at nulls last, id) as occurrence
  from names
)
update public.v2_course_lessons as lesson
set route_slug = route_name || case when occurrence > 1 then '--' || nextval('public.course_route_slug_number'::regclass) else '' end
from numbered
where lesson.id = numbered.id;

alter table public.courses enable trigger update_courses_updated_at;
alter table public.v2_course_lessons enable trigger v2_course_lessons_updated_at;

create function private.assign_course_route_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.route_slug := coalesce(
    nullif(trim(both '-' from left(regexp_replace(lower(new.title), '[^a-z0-9㐀-鿿]+', '-', 'g'), 36)), ''),
    'lesson'
  ) || '--' || nextval('public.course_route_slug_number'::regclass);
  return new;
end;
$$;

revoke all on function private.assign_course_route_slug() from public, anon, authenticated;

alter table public.courses
  alter column route_slug set not null,
  add constraint courses_route_slug_key unique (route_slug);
alter table public.v2_course_lessons
  alter column route_slug set not null,
  add constraint v2_course_lessons_route_slug_key unique (route_slug);

create trigger courses_assign_route_slug
before insert on public.courses
for each row execute function private.assign_course_route_slug();

create trigger v2_course_lessons_assign_route_slug
before insert on public.v2_course_lessons
for each row execute function private.assign_course_route_slug();

grant select (route_slug) on public.courses to anon, authenticated;
notify pgrst, 'reload schema';

commit;
