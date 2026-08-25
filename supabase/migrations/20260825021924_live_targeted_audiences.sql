-- Live 定向广播与学员标签。
-- 房间 Broadcast 继续只发送 question_id；题目内容和提交权限由 RLS 按当前用户受众匹配控制。

begin;

alter table public.questions
  add column if not exists audience_mode text not null default 'all';

alter table public.questions
  drop constraint if exists questions_audience_mode_check;

alter table public.questions
  add constraint questions_audience_mode_check
  check (audience_mode in ('all', 'targeted'));

comment on column public.questions.audience_mode is
  'Live 题目受众：all=全部房间学员；targeted=指定学员或匹配标签的学员';

create table if not exists public.live_participant_tags (
  live_id uuid not null,
  user_id uuid not null,
  tag text not null,
  created_at timestamptz not null default now(),
  primary key (live_id, user_id, tag),
  foreign key (live_id, user_id)
    references public.live_participants (live_id, user_id)
    on delete cascade,
  constraint live_participant_tags_tag_check
    check (tag = btrim(tag) and length(tag) between 1 and 32)
);

create table if not exists public.live_question_target_users (
  question_id uuid not null references public.questions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (question_id, user_id)
);

create table if not exists public.live_question_target_tags (
  question_id uuid not null references public.questions (id) on delete cascade,
  tag text not null,
  primary key (question_id, tag),
  constraint live_question_target_tags_tag_check
    check (tag = btrim(tag) and length(tag) between 1 and 32)
);

create index if not exists live_participant_tags_live_tag_idx
  on public.live_participant_tags (live_id, tag, user_id);

create index if not exists live_question_target_users_user_idx
  on public.live_question_target_users (user_id, question_id);

create index if not exists live_question_target_tags_tag_idx
  on public.live_question_target_tags (tag, question_id);

alter table public.live_participant_tags enable row level security;
alter table public.live_question_target_users enable row level security;
alter table public.live_question_target_tags enable row level security;

revoke all on table public.live_participant_tags from anon, authenticated;
revoke all on table public.live_question_target_users from anon, authenticated;
revoke all on table public.live_question_target_tags from anon, authenticated;

grant select on table public.live_participant_tags to authenticated;
grant select on table public.live_question_target_users to authenticated;
grant select on table public.live_question_target_tags to authenticated;

drop policy if exists "live admin read participant tags" on public.live_participant_tags;
create policy "live admin read participant tags"
  on public.live_participant_tags
  for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "live admin read target users" on public.live_question_target_users;
create policy "live admin read target users"
  on public.live_question_target_users
  for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "live admin read target tags" on public.live_question_target_tags;
create policy "live admin read target tags"
  on public.live_question_target_tags
  for select
  to authenticated
  using ((select public.is_admin()));

create or replace function public.live_can_access_question(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      (select public.is_admin())
      or exists (
        select 1
        from public.questions question
        join public.live_sessions live on live.id = question.live_id
        where question.id = p_question_id
          and live.status = 'live'
          and live.current_question_id = question.id
          and (
            question.audience_mode = 'all'
            or exists (
              select 1
              from public.live_question_target_users target_user
              where target_user.question_id = question.id
                and target_user.user_id = (select auth.uid())
            )
            or exists (
              select 1
              from public.live_question_target_tags target_tag
              join public.live_participant_tags participant_tag
                on participant_tag.live_id = question.live_id
               and participant_tag.user_id = (select auth.uid())
               and participant_tag.tag = target_tag.tag
              where target_tag.question_id = question.id
            )
          )
      )
    );
$$;

comment on function public.live_can_access_question(uuid) is
  'Live：当前登录用户是否为当前直播题的目标受众；管理员始终可读';

revoke all on function public.live_can_access_question(uuid) from public;
revoke all on function public.live_can_access_question(uuid) from anon;
grant execute on function public.live_can_access_question(uuid) to authenticated;

drop policy if exists "participants read current question" on public.questions;
create policy "participants read targeted current question"
  on public.questions
  for select
  to authenticated
  using ((select public.live_can_access_question(questions.id)));

drop policy if exists "participants read revealed key" on public.question_keys;
create policy "participants read targeted revealed key"
  on public.question_keys
  for select
  to authenticated
  using (
    (select public.live_can_access_question(question_keys.question_id))
    and exists (
      select 1
      from public.questions question
      join public.live_sessions live on live.id = question.live_id
      where question.id = question_keys.question_id
        and live.question_state = 'revealed'
    )
  );

drop policy if exists "participants insert own responses" on public.responses;
create policy "targeted participants insert own responses"
  on public.responses
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.live_can_access_question(responses.question_id))
    and exists (
      select 1
      from public.questions question
      join public.live_sessions live on live.id = question.live_id
      where question.id = responses.question_id
        and live.question_state = 'answering'
    )
  );

drop policy if exists "participants update own responses" on public.responses;
create policy "targeted participants update own responses"
  on public.responses
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (select public.live_can_access_question(responses.question_id))
    and exists (
      select 1
      from public.questions question
      join public.live_sessions live on live.id = question.live_id
      where question.id = responses.question_id
        and live.question_state = 'answering'
    )
  );

create or replace function public.get_live_admin_participants(p_live_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception '仅管理员可读取 Live 学员标签' using errcode = '42501';
  end if;

  if not exists (select 1 from public.live_sessions live where live.id = p_live_id) then
    raise exception 'Live 房间不存在' using errcode = 'P0002';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', participant.user_id,
        'nickname', profile.nickname,
        'joined_at', participant.joined_at,
        'last_seen_at', participant.last_seen_at,
        'tags', coalesce(tag_list.tags, '[]'::jsonb)
      )
      order by participant.last_seen_at desc, profile.nickname asc
    ),
    '[]'::jsonb
  )
    into v_result
  from public.live_participants participant
  join public.profiles profile on profile.id = participant.user_id
  left join lateral (
    select jsonb_agg(participant_tag.tag order by participant_tag.tag) as tags
    from public.live_participant_tags participant_tag
    where participant_tag.live_id = participant.live_id
      and participant_tag.user_id = participant.user_id
  ) tag_list on true
  where participant.live_id = p_live_id;

  return v_result;
end;
$$;

comment on function public.get_live_admin_participants(uuid) is
  'Live 管理端：读取场次参与者昵称、进入时间与人工标签';

revoke all on function public.get_live_admin_participants(uuid) from public;
revoke all on function public.get_live_admin_participants(uuid) from anon;
grant execute on function public.get_live_admin_participants(uuid) to authenticated;

create or replace function public.set_live_participant_tags(
  p_live_id uuid,
  p_user_id uuid,
  p_tags text[]
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tags text[];
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception '仅管理员可维护 Live 学员标签' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.live_participants participant
    where participant.live_id = p_live_id
      and participant.user_id = p_user_id
  ) then
    raise exception '该学员尚未进入当前 Live 房间' using errcode = '23503';
  end if;

  select coalesce(array_agg(normalized.tag order by normalized.tag), array[]::text[])
    into v_tags
  from (
    select distinct btrim(source.tag) as tag
    from unnest(coalesce(p_tags, array[]::text[])) source(tag)
    where length(btrim(source.tag)) between 1 and 32
  ) normalized;

  if cardinality(v_tags) > 12 then
    raise exception '每位学员最多设置 12 个标签' using errcode = '22023';
  end if;

  delete from public.live_participant_tags participant_tag
  where participant_tag.live_id = p_live_id
    and participant_tag.user_id = p_user_id;

  insert into public.live_participant_tags (live_id, user_id, tag)
  select p_live_id, p_user_id, source.tag
  from unnest(v_tags) source(tag);

  return v_tags;
end;
$$;

comment on function public.set_live_participant_tags(uuid, uuid, text[]) is
  'Live 管理端：原子替换某位场次参与者的人工标签';

revoke all on function public.set_live_participant_tags(uuid, uuid, text[]) from public;
revoke all on function public.set_live_participant_tags(uuid, uuid, text[]) from anon;
grant execute on function public.set_live_participant_tags(uuid, uuid, text[]) to authenticated;

create or replace function public.set_live_question_audience(
  p_question_id uuid,
  p_audience_mode text,
  p_user_ids uuid[],
  p_tags text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_live_id uuid;
  v_status text;
  v_current_question_id uuid;
  v_question_state text;
  v_user_ids uuid[];
  v_tags text[];
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception '仅管理员可设置 Live 题目受众' using errcode = '42501';
  end if;

  if p_audience_mode not in ('all', 'targeted') then
    raise exception '题目受众模式无效' using errcode = '22023';
  end if;

  select question.live_id, live.status, live.current_question_id, live.question_state
    into v_live_id, v_status, v_current_question_id, v_question_state
  from public.questions question
  join public.live_sessions live on live.id = question.live_id
  where question.id = p_question_id;

  if not found then
    raise exception 'Live 题目不存在' using errcode = 'P0002';
  end if;

  if v_status = 'ended'
    or (v_current_question_id = p_question_id and v_question_state <> 'waiting') then
    raise exception '当前题已进入互动，不能修改发送对象' using errcode = '42501';
  end if;

  select coalesce(array_agg(source.user_id order by source.user_id), array[]::uuid[])
    into v_user_ids
  from (select distinct unnest(coalesce(p_user_ids, array[]::uuid[])) as user_id) source
  where source.user_id is not null;

  select coalesce(array_agg(normalized.tag order by normalized.tag), array[]::text[])
    into v_tags
  from (
    select distinct btrim(source.tag) as tag
    from unnest(coalesce(p_tags, array[]::text[])) source(tag)
    where length(btrim(source.tag)) between 1 and 32
  ) normalized;

  if cardinality(v_user_ids) > 200 or cardinality(v_tags) > 12 then
    raise exception '单题最多指定 200 位学员和 12 个标签' using errcode = '22023';
  end if;

  if p_audience_mode = 'targeted'
    and cardinality(v_user_ids) = 0
    and cardinality(v_tags) = 0 then
    raise exception '定向题目至少选择一位学员或一个标签' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_user_ids) target_user(user_id)
    where not exists (
      select 1
      from public.live_participants participant
      where participant.live_id = v_live_id
        and participant.user_id = target_user.user_id
    )
  ) then
    raise exception '指定学员尚未进入当前 Live 房间' using errcode = '23503';
  end if;

  update public.questions
  set audience_mode = p_audience_mode
  where id = p_question_id;

  delete from public.live_question_target_users where question_id = p_question_id;
  delete from public.live_question_target_tags where question_id = p_question_id;

  if p_audience_mode = 'targeted' then
    insert into public.live_question_target_users (question_id, user_id)
    select p_question_id, source.user_id from unnest(v_user_ids) source(user_id);

    insert into public.live_question_target_tags (question_id, tag)
    select p_question_id, source.tag from unnest(v_tags) source(tag);
  end if;

  return jsonb_build_object(
    'audience_mode', p_audience_mode,
    'user_ids', case when p_audience_mode = 'targeted' then to_jsonb(v_user_ids) else '[]'::jsonb end,
    'tags', case when p_audience_mode = 'targeted' then to_jsonb(v_tags) else '[]'::jsonb end
  );
end;
$$;

comment on function public.set_live_question_audience(uuid, text, uuid[], text[]) is
  'Live 管理端：原子设置题目的全部或定向受众；指定学员与标签按并集匹配';

revoke all on function public.set_live_question_audience(uuid, text, uuid[], text[]) from public;
revoke all on function public.set_live_question_audience(uuid, text, uuid[], text[]) from anon;
grant execute on function public.set_live_question_audience(uuid, text, uuid[], text[]) to authenticated;

create or replace function public.get_live_room_audience_summary(p_live_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_current_question_id uuid;
  v_audience_mode text;
  v_joined_count integer;
  v_targeted_count integer := 0;
  v_answered_count integer := 0;
  v_can_access boolean := false;
begin
  if v_user_id is null then
    raise exception '请先登录后查看 Live 数据' using errcode = '42501';
  end if;

  select live.current_question_id, question.audience_mode
    into v_current_question_id, v_audience_mode
  from public.live_sessions live
  left join public.questions question on question.id = live.current_question_id
  where live.id = p_live_id
    and live.status = 'live';

  if not found then
    raise exception 'Live 房间未开放' using errcode = '42501';
  end if;

  select count(*)::integer
    into v_joined_count
  from public.live_participants participant
  where participant.live_id = p_live_id;

  if v_current_question_id is not null then
    v_can_access := (select public.live_can_access_question(v_current_question_id));

    select count(*)::integer
      into v_targeted_count
    from public.live_participants participant
    where participant.live_id = p_live_id
      and (
        v_audience_mode = 'all'
        or exists (
          select 1
          from public.live_question_target_users target_user
          where target_user.question_id = v_current_question_id
            and target_user.user_id = participant.user_id
        )
        or exists (
          select 1
          from public.live_question_target_tags target_tag
          join public.live_participant_tags participant_tag
            on participant_tag.live_id = p_live_id
           and participant_tag.user_id = participant.user_id
           and participant_tag.tag = target_tag.tag
          where target_tag.question_id = v_current_question_id
        )
      );

    if v_can_access then
      select count(*)::integer
        into v_answered_count
      from public.responses response
      where response.question_id = v_current_question_id;
    else
      v_current_question_id := null;
      v_targeted_count := 0;
    end if;
  end if;

  return jsonb_build_object(
    'live_id', p_live_id,
    'current_question_id', v_current_question_id,
    'joined_count', v_joined_count,
    'targeted_count', v_targeted_count,
    'answered_count', v_answered_count
  );
end;
$$;

comment on function public.get_live_room_audience_summary(uuid) is
  'Live：学员可读的进行中房间匿名人数摘要；非当前题目标受众不返回题号与答题数据';

revoke all on function public.get_live_room_audience_summary(uuid) from public;
revoke all on function public.get_live_room_audience_summary(uuid) from anon;
grant execute on function public.get_live_room_audience_summary(uuid) to authenticated;

-- 安全补强：已答后若被移出当前题受众，也不能继续回读该题匿名分布。
create or replace function public.get_live_participant_results(p_question_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_question_type text;
  v_question_options jsonb;
  v_answered_count integer;
  v_options jsonb;
begin
  if v_user_id is null then
    raise exception '请先登录后查看答题统计' using errcode = '42501';
  end if;

  if not (select public.live_can_access_question(p_question_id)) then
    raise exception '当前直播题未向你发布' using errcode = '42501';
  end if;

  select question.type, question.options
    into v_question_type, v_question_options
  from public.questions question
  join public.live_sessions live on live.id = question.live_id
  where question.id = p_question_id
    and live.status = 'live'
    and live.current_question_id = question.id;

  if not found then
    raise exception '当前直播题不可用' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.responses response
    where response.question_id = p_question_id
      and response.user_id = v_user_id
  ) then
    raise exception '提交答案后才能查看匿名统计' using errcode = '42501';
  end if;

  select count(*)::integer
    into v_answered_count
  from public.responses response
  where response.question_id = p_question_id;

  if v_question_type = 'true_false' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', option_count.option_id,
          'label', option_count.option_label,
          'count', option_count.response_count,
          'percentage', case
            when v_answered_count = 0 then 0
            else round(option_count.response_count::numeric * 100 / v_answered_count, 1)
          end
        ) order by option_count.option_position
      ),
      '[]'::jsonb
    )
      into v_options
    from (
      select
        option_source.option_position,
        option_source.option_id,
        option_source.option_label,
        count(response.*) filter (
          where response.answer = to_jsonb(option_source.option_value)
        )::integer as response_count
      from (
        values
          (1, 'true'::text, '正确'::text, true),
          (2, 'false'::text, '错误'::text, false)
      ) as option_source(option_position, option_id, option_label, option_value)
      left join public.responses response
        on response.question_id = p_question_id
      group by
        option_source.option_position,
        option_source.option_id,
        option_source.option_label,
        option_source.option_value
    ) option_count;
  else
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', option_count.option_id,
          'label', option_count.option_label,
          'count', option_count.response_count,
          'percentage', case
            when v_answered_count = 0 then 0
            else round(option_count.response_count::numeric * 100 / v_answered_count, 1)
          end
        ) order by option_count.option_position
      ),
      '[]'::jsonb
    )
      into v_options
    from (
      select
        option_source.option_position,
        option_source.option_id,
        option_source.option_label,
        count(response.*) filter (
          where response.answer = to_jsonb(option_source.option_id)
            or (
              jsonb_typeof(response.answer) = 'array'
              and response.answer ? option_source.option_id
            )
        )::integer as response_count
      from (
        select
          option_row.ordinality::integer as option_position,
          option_row.value ->> 'id' as option_id,
          coalesce(nullif(option_row.value ->> 'text', ''), option_row.value ->> 'id') as option_label
        from jsonb_array_elements(v_question_options) with ordinality as option_row(value, ordinality)
        where jsonb_typeof(option_row.value) = 'object'
          and nullif(option_row.value ->> 'id', '') is not null
      ) option_source
      left join public.responses response
        on response.question_id = p_question_id
      group by
        option_source.option_position,
        option_source.option_id,
        option_source.option_label
    ) option_count;
  end if;

  return jsonb_build_object(
    'question_id', p_question_id,
    'answered_count', v_answered_count,
    'options', v_options
  );
end;
$$;

comment on function public.get_live_participant_results(uuid) is
  'Live：当前题目标受众中的已答学员读取匿名选项人数与占比';

revoke all on function public.get_live_participant_results(uuid) from public;
revoke all on function public.get_live_participant_results(uuid) from anon;
grant execute on function public.get_live_participant_results(uuid) to authenticated;

commit;
