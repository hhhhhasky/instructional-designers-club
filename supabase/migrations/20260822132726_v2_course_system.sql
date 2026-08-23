-- 教学通识课 V2 旁路课程系统
-- 本迁移只创建 v2_ 前缀对象；不修改 V1 课程表、学习记录或旧页面依赖的函数。

begin;

create schema if not exists private;

create or replace function public.v2_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.v2_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('admin', 'editor')
        and p.status = 'active'
    );
$$;

create table if not exists public.v2_dictionary_groups (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_dictionary_groups_key_not_blank check (length(btrim(key)) > 0),
  constraint v2_dictionary_groups_name_not_blank check (length(btrim(name)) > 0)
);

create table if not exists public.v2_dictionary_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.v2_dictionary_groups(id) on delete restrict,
  key text not null,
  label text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, key),
  constraint v2_dictionary_items_key_not_blank check (length(btrim(key)) > 0),
  constraint v2_dictionary_items_label_not_blank check (length(btrim(label)) > 0),
  constraint v2_dictionary_items_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.v2_course_modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description_markdown text,
  sort_order integer not null default 0,
  status text not null default 'draft',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_course_modules_slug_not_blank check (length(btrim(slug)) > 0),
  constraint v2_course_modules_title_not_blank check (length(btrim(title)) > 0),
  constraint v2_course_modules_status_check check (status in ('draft', 'published', 'archived'))
);

create table if not exists public.v2_course_units (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.v2_course_modules(id) on delete cascade,
  slug text not null,
  title text not null,
  description_markdown text,
  unit_type_id uuid references public.v2_dictionary_items(id) on delete set null,
  sort_order integer not null default 0,
  status text not null default 'draft',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, slug),
  constraint v2_course_units_slug_not_blank check (length(btrim(slug)) > 0),
  constraint v2_course_units_title_not_blank check (length(btrim(title)) > 0),
  constraint v2_course_units_status_check check (status in ('draft', 'published', 'archived'))
);

create table if not exists public.v2_course_lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.v2_course_units(id) on delete cascade,
  slug text,
  title text not null,
  subtitle text,
  description text,
  lesson_type_id uuid references public.v2_dictionary_items(id) on delete set null,
  duration_minutes integer,
  sort_order integer not null default 0,
  membership_type text,
  is_trial boolean not null default false,
  status text not null default 'draft',
  published_at timestamptz,
  challenge_title text,
  challenge_markdown text,
  objectives jsonb not null default '[]'::jsonb,
  success_criteria_markdown text,
  takeaway_markdown text,
  body_markdown text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_course_lessons_title_not_blank check (length(btrim(title)) > 0),
  constraint v2_course_lessons_duration_check check (duration_minutes is null or duration_minutes >= 0),
  constraint v2_course_lessons_status_check check (status in ('draft', 'published', 'archived')),
  constraint v2_course_lessons_objectives_array check (jsonb_typeof(objectives) = 'array')
);

create table if not exists public.v2_lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.v2_course_lessons(id) on delete cascade,
  resource_type_id uuid references public.v2_dictionary_items(id) on delete set null,
  usage_type_id uuid references public.v2_dictionary_items(id) on delete set null,
  title text,
  description text,
  storage_provider text,
  storage_key text,
  external_url text,
  file_name text,
  mime_type text,
  file_size bigint,
  is_downloadable boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_lesson_resources_location_check check (storage_key is not null or external_url is not null or (storage_key is null and external_url is null)),
  constraint v2_lesson_resources_file_size_check check (file_size is null or file_size >= 0),
  constraint v2_lesson_resources_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.v2_lesson_knowledge_cards (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.v2_course_lessons(id) on delete cascade,
  card_type_id uuid references public.v2_dictionary_items(id) on delete set null,
  title text not null,
  content_markdown text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_lesson_knowledge_cards_title_not_blank check (length(btrim(title)) > 0)
);

create table if not exists public.v2_assessment_blocks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references public.v2_course_lessons(id) on delete cascade,
  unit_id uuid references public.v2_course_units(id) on delete cascade,
  assessment_type_id uuid references public.v2_dictionary_items(id) on delete set null,
  title text not null,
  instructions_markdown text,
  required boolean not null default false,
  estimated_minutes integer,
  sort_order integer not null default 0,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_assessment_blocks_one_parent check ((lesson_id is not null) <> (unit_id is not null)),
  constraint v2_assessment_blocks_title_not_blank check (length(btrim(title)) > 0),
  constraint v2_assessment_blocks_status_check check (status in ('draft', 'published', 'archived'))
);

create table if not exists public.v2_assessment_items (
  id uuid primary key default gen_random_uuid(),
  assessment_block_id uuid not null references public.v2_assessment_blocks(id) on delete cascade,
  item_type_id uuid references public.v2_dictionary_items(id) on delete set null,
  grading_mode_id uuid references public.v2_dictionary_items(id) on delete set null,
  prompt_markdown text not null,
  case_markdown text,
  max_score numeric,
  rubric jsonb,
  sort_order integer not null default 0,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_assessment_items_prompt_not_blank check (length(btrim(prompt_markdown)) > 0),
  constraint v2_assessment_items_max_score_check check (max_score is null or max_score >= 0)
);

create table if not exists public.v2_assessment_options (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.v2_assessment_items(id) on delete cascade,
  option_key text not null,
  option_text text not null,
  sort_order integer not null default 0,
  unique (item_id, option_key),
  constraint v2_assessment_options_key_not_blank check (length(btrim(option_key)) > 0),
  constraint v2_assessment_options_text_not_blank check (length(btrim(option_text)) > 0)
);

create table if not exists private.v2_assessment_keys (
  item_id uuid primary key references public.v2_assessment_items(id) on delete cascade,
  answer_key jsonb not null,
  scoring_config jsonb not null default '{}'::jsonb,
  constraint v2_assessment_keys_scoring_object check (jsonb_typeof(scoring_config) = 'object')
);

create table if not exists public.v2_submission_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_block_id uuid not null references public.v2_assessment_blocks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempt_no integer not null,
  status text not null default 'draft',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  final_score numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_block_id, user_id, attempt_no),
  constraint v2_submission_attempts_no_check check (attempt_no > 0),
  constraint v2_submission_attempts_status_check check (status in ('draft', 'submitted', 'reviewed', 'revision_required'))
);

create table if not exists public.v2_submission_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.v2_submission_attempts(id) on delete cascade,
  item_id uuid not null references public.v2_assessment_items(id) on delete restrict,
  answer_text text,
  answer_json jsonb,
  attachment_data jsonb not null default '[]'::jsonb,
  auto_score numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, item_id),
  constraint v2_submission_answers_attachments_array check (jsonb_typeof(attachment_data) = 'array')
);

create table if not exists public.v2_manual_reviews (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.v2_submission_attempts(id) on delete cascade,
  answer_id uuid references public.v2_submission_answers(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  review_status text not null default 'reviewed',
  score numeric,
  feedback_markdown text,
  rubric_result jsonb,
  revision_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_manual_reviews_status_check check (review_status in ('reviewed', 'revision_required'))
);

create table if not exists public.v2_learning_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.v2_course_lessons(id) on delete cascade,
  status text not null default 'not_started',
  watch_count integer not null default 0,
  progress numeric not null default 0,
  last_viewed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id),
  constraint v2_learning_records_status_check check (status in ('not_started', 'in_progress', 'completed')),
  constraint v2_learning_records_progress_check check (progress >= 0 and progress <= 100),
  constraint v2_learning_records_watch_count_check check (watch_count >= 0)
);

create table if not exists public.v2_user_saved_cards (
  user_id uuid not null references public.profiles(id) on delete cascade,
  knowledge_card_id uuid not null references public.v2_lesson_knowledge_cards(id) on delete cascade,
  user_note text,
  created_at timestamptz not null default now(),
  primary key (user_id, knowledge_card_id)
);

create table if not exists public.v2_course_access (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'active',
  starts_at timestamptz,
  expires_at timestamptz,
  granted_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_course_access_status_check check (status in ('active', 'suspended')),
  constraint v2_course_access_time_check check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create or replace function private.v2_user_has_access()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select (select auth.uid()) is not null
    and (
      exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid())
          and p.role in ('admin', 'editor')
          and p.status = 'active'
      )
      or exists (
        select 1
        from public.v2_course_access a
        where a.user_id = (select auth.uid())
          and a.status = 'active'
          and (a.starts_at is null or a.starts_at <= now())
          and (a.expires_at is null or a.expires_at > now())
      )
    );
$$;

create index if not exists v2_course_units_module_sort_idx on public.v2_course_units (module_id, sort_order);
create index if not exists v2_course_lessons_unit_sort_idx on public.v2_course_lessons (unit_id, sort_order);
create index if not exists v2_lesson_resources_lesson_sort_idx on public.v2_lesson_resources (lesson_id, sort_order);
create index if not exists v2_knowledge_cards_lesson_sort_idx on public.v2_lesson_knowledge_cards (lesson_id, sort_order);
create index if not exists v2_assessment_blocks_lesson_sort_idx on public.v2_assessment_blocks (lesson_id, sort_order);
create index if not exists v2_assessment_items_block_sort_idx on public.v2_assessment_items (assessment_block_id, sort_order);
create index if not exists v2_submission_attempts_review_idx on public.v2_submission_attempts (status, submitted_at desc);
create index if not exists v2_learning_records_user_updated_idx on public.v2_learning_records (user_id, updated_at desc);

create or replace function private.v2_can_access_module(p_module_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select private.v2_user_has_access()
    and exists (select 1 from public.v2_course_modules m where m.id = p_module_id and m.status = 'published' and m.is_active);
$$;

create or replace function private.v2_can_access_unit(p_unit_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select private.v2_user_has_access()
    and exists (
      select 1 from public.v2_course_units u
      join public.v2_course_modules m on m.id = u.module_id
      where u.id = p_unit_id and u.status = 'published' and u.is_active
        and m.status = 'published' and m.is_active
    );
$$;

create or replace function private.v2_can_access_lesson(p_lesson_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select private.v2_user_has_access()
    and exists (
      select 1 from public.v2_course_lessons l
      join public.v2_course_units u on u.id = l.unit_id
      join public.v2_course_modules m on m.id = u.module_id
      where l.id = p_lesson_id and l.status = 'published'
        and u.status = 'published' and u.is_active
        and m.status = 'published' and m.is_active
    );
$$;

create or replace function private.v2_can_access_block(p_block_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select private.v2_user_has_access()
    and exists (
      select 1 from public.v2_assessment_blocks b
      left join public.v2_course_lessons l on l.id = b.lesson_id
      left join public.v2_course_units lu on lu.id = l.unit_id
      left join public.v2_course_units uu on uu.id = b.unit_id
      left join public.v2_course_modules lm on lm.id = lu.module_id
      left join public.v2_course_modules um on um.id = uu.module_id
      where b.id = p_block_id and b.status = 'published'
        and ((l.id is not null and l.status = 'published' and lu.status = 'published' and lu.is_active and lm.status = 'published' and lm.is_active)
          or (uu.id is not null and uu.status = 'published' and uu.is_active and um.status = 'published' and um.is_active)));
$$;

grant execute on function private.v2_can_manage() to authenticated;
grant execute on function private.v2_user_has_access() to authenticated;
grant execute on function private.v2_can_access_module(uuid) to authenticated;
grant execute on function private.v2_can_access_unit(uuid) to authenticated;
grant execute on function private.v2_can_access_lesson(uuid) to authenticated;
grant execute on function private.v2_can_access_block(uuid) to authenticated;
revoke execute on all functions in schema private from anon;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'v2_dictionary_groups', 'v2_dictionary_items', 'v2_course_modules', 'v2_course_units',
    'v2_course_lessons', 'v2_lesson_resources', 'v2_lesson_knowledge_cards',
    'v2_assessment_blocks', 'v2_assessment_items', 'v2_assessment_options',
    'v2_submission_attempts', 'v2_submission_answers', 'v2_manual_reviews',
    'v2_learning_records', 'v2_user_saved_cards', 'v2_course_access'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
  end loop;
end;
$$;

alter table private.v2_assessment_keys enable row level security;
revoke all on table private.v2_assessment_keys from public, anon, authenticated;

-- 管理端对象：admin/editor 可维护；普通用户只能读取已发布内容。
create policy v2_dictionary_groups_manager on public.v2_dictionary_groups for all to authenticated using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_dictionary_groups_read_active on public.v2_dictionary_groups for select to authenticated using (is_active);
create policy v2_dictionary_items_manager on public.v2_dictionary_items for all to authenticated using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_dictionary_items_read_active on public.v2_dictionary_items for select to authenticated using (is_active and exists (select 1 from public.v2_dictionary_groups g where g.id = group_id and g.is_active));

create policy v2_modules_manager on public.v2_course_modules for all to authenticated using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_modules_read_published on public.v2_course_modules for select to authenticated using (private.v2_can_access_module(id));
create policy v2_units_manager on public.v2_course_units for all to authenticated using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_units_read_published on public.v2_course_units for select to authenticated using (private.v2_can_access_unit(id));
create policy v2_lessons_manager on public.v2_course_lessons for all to authenticated using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_lessons_read_published on public.v2_course_lessons for select to authenticated using (private.v2_can_access_lesson(id));

create policy v2_resources_manager on public.v2_lesson_resources for all to authenticated using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_resources_read_published on public.v2_lesson_resources for select to authenticated using (private.v2_can_access_lesson(lesson_id));
create policy v2_cards_manager on public.v2_lesson_knowledge_cards for all to authenticated using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_cards_read_published on public.v2_lesson_knowledge_cards for select to authenticated using (is_active and private.v2_can_access_lesson(lesson_id));

create policy v2_blocks_manager on public.v2_assessment_blocks for all to authenticated using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_blocks_read_published on public.v2_assessment_blocks for select to authenticated using (private.v2_can_access_block(id));
create policy v2_items_manager on public.v2_assessment_items for all to authenticated using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_items_read_published on public.v2_assessment_items for select to authenticated using (private.v2_can_access_block(assessment_block_id));
create policy v2_options_manager on public.v2_assessment_options for all to authenticated using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_options_read_published on public.v2_assessment_options for select to authenticated using (exists (select 1 from public.v2_assessment_items i where i.id = item_id and private.v2_can_access_block(i.assessment_block_id)));

create policy v2_attempts_manager on public.v2_submission_attempts for all to authenticated using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_attempts_read_own on public.v2_submission_attempts for select to authenticated using (user_id = (select auth.uid()) or private.v2_can_manage());
create policy v2_attempts_insert_own on public.v2_submission_attempts for insert to authenticated with check (user_id = (select auth.uid()) and private.v2_can_access_block(assessment_block_id));
create policy v2_attempts_update_own on public.v2_submission_attempts for update to authenticated using (user_id = (select auth.uid()) and status in ('draft', 'revision_required')) with check (user_id = (select auth.uid()));

create policy v2_answers_manager on public.v2_submission_answers for all to authenticated using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_answers_read_own on public.v2_submission_answers for select to authenticated using (exists (select 1 from public.v2_submission_attempts a where a.id = attempt_id and (a.user_id = (select auth.uid()) or private.v2_can_manage())));
create policy v2_answers_write_own on public.v2_submission_answers for insert to authenticated with check (exists (select 1 from public.v2_submission_attempts a where a.id = attempt_id and a.user_id = (select auth.uid()) and a.status in ('draft', 'revision_required')));
create policy v2_answers_update_own on public.v2_submission_answers for update to authenticated using (exists (select 1 from public.v2_submission_attempts a where a.id = attempt_id and a.user_id = (select auth.uid()) and a.status in ('draft', 'revision_required'))) with check (exists (select 1 from public.v2_submission_attempts a where a.id = attempt_id and a.user_id = (select auth.uid())));

create policy v2_reviews_manager on public.v2_manual_reviews for all to authenticated using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_reviews_read_own on public.v2_manual_reviews for select to authenticated using (exists (select 1 from public.v2_submission_attempts a where a.id = attempt_id and a.user_id = (select auth.uid())));

create policy v2_learning_records_manager on public.v2_learning_records for all to authenticated using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_learning_records_read_own on public.v2_learning_records for select to authenticated using (user_id = (select auth.uid()));
create policy v2_learning_records_insert_own on public.v2_learning_records for insert to authenticated with check (user_id = (select auth.uid()) and private.v2_can_access_lesson(lesson_id));
create policy v2_learning_records_update_own on public.v2_learning_records for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and private.v2_can_access_lesson(lesson_id));

create policy v2_saved_cards_manager on public.v2_user_saved_cards for all to authenticated using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_saved_cards_own on public.v2_user_saved_cards for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and exists (select 1 from public.v2_lesson_knowledge_cards c where c.id = knowledge_card_id and c.is_active and private.v2_can_access_lesson(c.lesson_id)));

create policy v2_access_manager on public.v2_course_access for all to authenticated using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_access_read_own on public.v2_course_access for select to authenticated using (user_id = (select auth.uid()));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'v2_dictionary_groups', 'v2_dictionary_items', 'v2_course_modules', 'v2_course_units',
    'v2_course_lessons', 'v2_lesson_resources', 'v2_lesson_knowledge_cards',
    'v2_assessment_blocks', 'v2_assessment_items', 'v2_assessment_options',
    'v2_submission_attempts', 'v2_submission_answers', 'v2_manual_reviews',
    'v2_learning_records', 'v2_course_access'
  ] loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_updated_at', table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.v2_set_updated_at()', table_name || '_updated_at', table_name);
  end loop;
end;
$$;

commit;
