-- Live 大型数据看板：持久化累计进入人数，同时保持学员端只读匿名聚合。
-- Presence 仍是“当前在线”的唯一口径；本表只保存每人每场一行的首次/最近进入时间。

create table if not exists public.live_participants (
  live_id uuid not null references public.live_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (live_id, user_id),
  constraint live_participants_seen_order_check check (last_seen_at >= joined_at)
);

alter table public.live_participants enable row level security;

revoke all on table public.live_participants from anon, authenticated;
grant select on table public.live_participants to authenticated;

drop policy if exists "live admin read participants" on public.live_participants;
create policy "live admin read participants"
  on public.live_participants
  for select
  to authenticated
  using ((select public.is_admin()));

-- 用历史作答者回填可恢复的最小参与集；无作答的历史进入无法追溯。
insert into public.live_participants (live_id, user_id, joined_at, last_seen_at)
select
  question.live_id,
  response.user_id,
  min(response.answered_at),
  max(response.answered_at)
from public.responses response
join public.questions question on question.id = response.question_id
group by question.live_id, response.user_id
on conflict (live_id, user_id) do update
set
  joined_at = least(public.live_participants.joined_at, excluded.joined_at),
  last_seen_at = greatest(public.live_participants.last_seen_at, excluded.last_seen_at);

-- 答题写入也必须能补记参与者，避免旧客户端或进入记录短暂失败导致看板分母小于已答人数。
create or replace function public.live_track_response_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_live_id uuid;
begin
  select question.live_id
    into v_live_id
  from public.questions question
  where question.id = new.question_id;

  if v_live_id is not null then
    insert into public.live_participants (live_id, user_id, joined_at, last_seen_at)
    values (v_live_id, new.user_id, now(), now())
    on conflict (live_id, user_id) do update
    set last_seen_at = greatest(public.live_participants.last_seen_at, excluded.last_seen_at);
  end if;

  return new;
end;
$$;

comment on function public.live_track_response_participant() is
  'Live：作答成功后补齐场次参与记录，保证看板可对账';

revoke all on function public.live_track_response_participant() from public;
revoke all on function public.live_track_response_participant() from anon, authenticated;

drop trigger if exists live_response_participant_tracking on public.responses;
create trigger live_response_participant_tracking
  after insert or update on public.responses
  for each row execute function public.live_track_response_participant();

create or replace function public.record_live_participant(p_live_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception '请先登录后进入 Live 房间' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.live_sessions live
    where live.id = p_live_id
      and live.status = 'live'
  ) then
    raise exception 'Live 房间未开放' using errcode = '42501';
  end if;

  insert into public.live_participants (live_id, user_id)
  values (p_live_id, v_user_id)
  on conflict (live_id, user_id) do update
  set last_seen_at = greatest(public.live_participants.last_seen_at, now());
end;
$$;

comment on function public.record_live_participant(uuid) is
  'Live：记录当前登录用户进入进行中房间，不记录 Presence 心跳';

revoke all on function public.record_live_participant(uuid) from public;
revoke all on function public.record_live_participant(uuid) from anon;
grant execute on function public.record_live_participant(uuid) to authenticated;

create or replace function public.get_live_room_audience_summary(p_live_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_current_question_id uuid;
  v_joined_count integer;
  v_answered_count integer;
begin
  if v_user_id is null then
    raise exception '请先登录后查看 Live 数据' using errcode = '42501';
  end if;

  select live.current_question_id
    into v_current_question_id
  from public.live_sessions live
  where live.id = p_live_id
    and live.status = 'live';

  if not found then
    raise exception 'Live 房间未开放' using errcode = '42501';
  end if;

  select count(*)::integer
    into v_joined_count
  from public.live_participants participant
  where participant.live_id = p_live_id;

  select count(*)::integer
    into v_answered_count
  from public.responses response
  where response.question_id = v_current_question_id;

  return jsonb_build_object(
    'live_id', p_live_id,
    'current_question_id', v_current_question_id,
    'joined_count', v_joined_count,
    'answered_count', v_answered_count
  );
end;
$$;

comment on function public.get_live_room_audience_summary(uuid) is
  'Live：学员可读的进行中房间匿名人数摘要';

revoke all on function public.get_live_room_audience_summary(uuid) from public;
revoke all on function public.get_live_room_audience_summary(uuid) from anon;
grant execute on function public.get_live_room_audience_summary(uuid) to authenticated;
