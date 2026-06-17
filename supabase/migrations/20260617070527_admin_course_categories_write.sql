-- Allow the admin course form to create and maintain course categories.
-- Existing public read policy stays unchanged.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.course_categories'::regclass
      and conname = 'course_categories_name_key'
  ) then
    alter table public.course_categories
      add constraint course_categories_name_key unique (name);
  end if;
end $$;

drop policy if exists "Admin can insert course_categories" on public.course_categories;
create policy "Admin can insert course_categories"
  on public.course_categories
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admin can update course_categories" on public.course_categories;
create policy "Admin can update course_categories"
  on public.course_categories
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
