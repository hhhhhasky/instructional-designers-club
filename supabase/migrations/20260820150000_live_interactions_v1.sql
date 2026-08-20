-- Live 实时互动 V1
-- 边界：数据库保存事实，Broadcast 只做状态通知，Presence 只表示当前在线。

-- 1. live_sessions：房间身份与当前课堂状态。
create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  room_code text unique,
  title text not null,
  status text not null,
  current_question_id uuid,
  question_state text not null,
  constraint live_sessions_status_check check (status in ('draft', 'live', 'ended')),
  constraint live_sessions_question_state_check check (question_state in ('waiting', 'answering', 'closed', 'revealed')),
  constraint live_sessions_room_code_check check (room_code is null or room_code ~ '^[0-9]{6}$'),
  constraint live_sessions_title_not_blank_check check (length(btrim(title)) > 0)
);

create index if not exists live_sessions_status_room_code_idx
  on public.live_sessions (status, room_code);

-- 2. questions：预设题与临时题使用同一结构。
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.live_sessions (id) on delete cascade,
  position integer not null check (position > 0),
  title text not null,
  type text not null,
  content text not null,
  options jsonb not null default '[]'::jsonb,
  constraint questions_live_position_unique unique (live_id, position),
  constraint questions_type_check check (type in ('single_choice', 'multiple_choice', 'true_false')),
  constraint questions_title_not_blank_check check (length(btrim(title)) > 0),
  constraint questions_content_not_blank_check check (length(btrim(content)) > 0),
  constraint questions_options_array_check check (jsonb_typeof(options) = 'array')
);

create index if not exists questions_live_position_idx
  on public.questions (live_id, position);

-- 3. question_keys：答案独立保存，未公布前对学员不可读。
create table if not exists public.question_keys (
  question_id uuid primary key references public.questions (id) on delete cascade,
  correct_answer jsonb not null
);

-- 4. responses：一个用户一道题只保存当前答案。
create table if not exists public.responses (
  question_id uuid not null references public.questions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  answer jsonb not null,
  answered_at timestamptz not null default now(),
  primary key (question_id, user_id)
);

create index if not exists responses_question_idx
  on public.responses (question_id);

-- live_sessions.current_question_id 需等 questions 建立后再补循环外键。
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'live_sessions_current_question_id_fkey'
      and conrelid = 'public.live_sessions'::regclass
  ) then
    alter table public.live_sessions
      add constraint live_sessions_current_question_id_fkey
      foreign key (current_question_id) references public.questions (id)
      on delete set null;
  end if;
end
$$;

alter table public.live_sessions enable row level security;
alter table public.questions enable row level security;
alter table public.question_keys enable row level security;
alter table public.responses enable row level security;

-- live_sessions：学员只读进行中的房间，管理员读写全部。
drop policy if exists "live admin full access" on public.live_sessions;
create policy "live admin full access"
  on public.live_sessions
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "authenticated read live sessions" on public.live_sessions;
create policy "authenticated read live sessions"
  on public.live_sessions
  for select
  to authenticated
  using (status = 'live');

-- questions：学员只能读取当前题；管理员可管理题库。
drop policy if exists "live admin read questions" on public.questions;
create policy "live admin read questions"
  on public.questions
  for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "live admin insert questions" on public.questions;
create policy "live admin insert questions"
  on public.questions
  for insert
  to authenticated
  with check (
    (select public.is_admin())
    and exists (
      select 1 from public.live_sessions live
      where live.id = live_id and live.status <> 'ended'
    )
  );

drop policy if exists "live admin update questions" on public.questions;
create policy "live admin update questions"
  on public.questions
  for update
  to authenticated
  using (
    (select public.is_admin())
    and not exists (
      select 1 from public.live_sessions live
      where live.id = questions.live_id
        and (
          live.status = 'ended'
          or (live.current_question_id = questions.id and live.question_state <> 'waiting')
        )
    )
  )
  with check (
    (select public.is_admin())
    and exists (
      select 1 from public.live_sessions live
      where live.id = live_id and live.status <> 'ended'
    )
  );

drop policy if exists "live admin delete questions" on public.questions;
create policy "live admin delete questions"
  on public.questions
  for delete
  to authenticated
  using (
    (select public.is_admin())
    and not exists (
      select 1 from public.live_sessions live
      where live.id = questions.live_id
        and (
          live.status = 'ended'
          or live.current_question_id = questions.id
        )
    )
  );

drop policy if exists "participants read current question" on public.questions;
create policy "participants read current question"
  on public.questions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.live_sessions live
      where live.id = questions.live_id
        and live.status = 'live'
        and live.current_question_id = questions.id
    )
  );

-- question_keys：只有公布后才对学员可读。
drop policy if exists "live admin read keys" on public.question_keys;
create policy "live admin read keys"
  on public.question_keys
  for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "live admin insert keys" on public.question_keys;
create policy "live admin insert keys"
  on public.question_keys
  for insert
  to authenticated
  with check (
    (select public.is_admin())
    and not exists (
      select 1 from public.live_sessions live
      join public.questions question on question.live_id = live.id
      where question.id = question_keys.question_id
        and live.status = 'ended'
    )
  );

drop policy if exists "live admin update keys" on public.question_keys;
create policy "live admin update keys"
  on public.question_keys
  for update
  to authenticated
  using (
    (select public.is_admin())
    and not exists (
      select 1 from public.live_sessions live
      join public.questions question on question.live_id = live.id
      where question.id = question_keys.question_id
        and (
          live.status = 'ended'
          or live.current_question_id = question.id
        )
    )
  )
  with check (
    (select public.is_admin())
    and not exists (
      select 1 from public.live_sessions live
      join public.questions question on question.live_id = live.id
      where question.id = question_keys.question_id
        and (
          live.status = 'ended'
          or live.current_question_id = question.id
        )
    )
  );

drop policy if exists "live admin delete keys" on public.question_keys;
create policy "live admin delete keys"
  on public.question_keys
  for delete
  to authenticated
  using (
    (select public.is_admin())
    and not exists (
      select 1 from public.live_sessions live
      join public.questions question on question.live_id = live.id
      where question.id = question_keys.question_id
        and (
          live.status = 'ended'
          or live.current_question_id = question.id
        )
    )
  );

drop policy if exists "participants read revealed key" on public.question_keys;
create policy "participants read revealed key"
  on public.question_keys
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.live_sessions live
      join public.questions question on question.live_id = live.id
      where question.id = question_keys.question_id
        and live.status = 'live'
        and live.current_question_id = question.id
        and live.question_state = 'revealed'
    )
  );

-- responses：学员只能读取/提交/修改自己的答案；写入只允许当前 answering 题。
drop policy if exists "live admin read responses" on public.responses;
create policy "live admin read responses"
  on public.responses
  for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "participants read own responses" on public.responses;
create policy "participants read own responses"
  on public.responses
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "participants insert own responses" on public.responses;
create policy "participants insert own responses"
  on public.responses
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.questions question
      join public.live_sessions live on live.id = question.live_id
      where question.id = responses.question_id
        and live.status = 'live'
        and live.current_question_id = question.id
        and live.question_state = 'answering'
    )
  );

drop policy if exists "participants update own responses" on public.responses;
create policy "participants update own responses"
  on public.responses
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.questions question
      join public.live_sessions live on live.id = question.live_id
      where question.id = responses.question_id
        and live.status = 'live'
        and live.current_question_id = question.id
        and live.question_state = 'answering'
    )
  );

-- Realtime Authorization：学员可收 Broadcast、可发 Presence；只有管理员可发 Broadcast。
drop policy if exists "live participants listen realtime" on realtime.messages;
create policy "live participants listen realtime"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and exists (
      select 1 from public.live_sessions live
      where live.status = 'live'
        and ('live:' || live.id::text) = (select realtime.topic())
    )
  );

drop policy if exists "live participants and host send realtime" on realtime.messages;
create policy "live participants and host send realtime"
  on realtime.messages
  for insert
  to authenticated
  with check (
    (
      realtime.messages.extension = 'presence'
      and exists (
        select 1 from public.live_sessions live
        where live.status = 'live'
          and ('live:' || live.id::text) = (select realtime.topic())
      )
    )
    or (
      realtime.messages.extension in ('broadcast', 'presence')
      and (select public.is_admin())
      and exists (
        select 1 from public.live_sessions live
        where ('live:' || live.id::text) = (select realtime.topic())
      )
    )
  );

-- response_changed：只广播题号，不广播 user_id 或答案。
create or replace function public.live_broadcast_response_changed()
returns trigger
language plpgsql
security definer
set search_path = public, realtime
as $$
declare
  live_id uuid;
begin
  select q.live_id into live_id
  from public.questions q
  where q.id = new.question_id;

  if live_id is not null then
    perform realtime.send(
      jsonb_build_object(
        'event', 'response_changed',
        'payload', jsonb_build_object('question_id', new.question_id)
      ),
      'response_changed',
      'live:' || live_id::text,
      true
    );
  end if;

  return new;
end;
$$;

comment on function public.live_broadcast_response_changed() is
  'Live V1：答案写入后向本房间广播仅含题号的变更通知';

drop trigger if exists live_response_changed on public.responses;
create trigger live_response_changed
  after insert or update on public.responses
  for each row execute function public.live_broadcast_response_changed();
