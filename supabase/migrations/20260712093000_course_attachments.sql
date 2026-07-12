-- Course downloadable attachments backed by Cloudflare R2.

begin;

create table if not exists public.course_attachments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  storage_key text not null unique,
  mime_type text,
  file_size bigint,
  file_type text not null default 'other'
    check (file_type in ('video', 'document', 'image', 'audio', 'other')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  uploaded_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists course_attachments_course_active_sort_idx
  on public.course_attachments(course_id, is_active, sort_order, created_at);

drop trigger if exists update_course_attachments_updated_at on public.course_attachments;
create trigger update_course_attachments_updated_at
  before update on public.course_attachments
  for each row execute function public.update_updated_at_column();

alter table public.course_attachments enable row level security;

drop policy if exists "Published course attachments are readable" on public.course_attachments;
create policy "Published course attachments are readable"
  on public.course_attachments for select
  to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.courses c
      where c.id = course_attachments.course_id
        and c.status = 'published'
    )
  );

drop policy if exists "Admin can select all course attachments" on public.course_attachments;
create policy "Admin can select all course attachments"
  on public.course_attachments for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admin can insert course attachments" on public.course_attachments;
create policy "Admin can insert course attachments"
  on public.course_attachments for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admin can update course attachments" on public.course_attachments;
create policy "Admin can update course attachments"
  on public.course_attachments for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admin can delete course attachments" on public.course_attachments;
create policy "Admin can delete course attachments"
  on public.course_attachments for delete
  to authenticated
  using (public.is_admin());

comment on table public.course_attachments
  is 'Downloadable course attachments stored in Cloudflare R2.';

commit;
