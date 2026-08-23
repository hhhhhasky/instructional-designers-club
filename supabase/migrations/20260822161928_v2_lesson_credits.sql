-- V2 Lesson 学分进入全站统一总学分口径。

alter table public.v2_course_lessons
  add column if not exists credits numeric(8,1) not null default 0;

comment on column public.v2_course_lessons.credits
  is '完成该 V2 Lesson 后计入 profiles.total_credits 的学分';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'v2_course_lessons_credits_check'
      and conrelid = 'public.v2_course_lessons'::regclass
  ) then
    alter table public.v2_course_lessons
      add constraint v2_course_lessons_credits_check check (credits >= 0);
  end if;
end;
$$;

create or replace function public.calculate_user_total_credits(
  p_user_id uuid,
  p_bonus_credits numeric default null
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bonus numeric(8,1);
  v_v1_course_credits numeric(8,1);
  v_v2_lesson_credits numeric(8,1);
begin
  if p_user_id is null then
    return 0;
  end if;

  if p_bonus_credits is null then
    select coalesce(p.bonus_credits, 0)
    into v_bonus
    from public.profiles p
    where p.id = p_user_id;
  else
    v_bonus := p_bonus_credits;
  end if;

  select coalesce(sum(coalesce(c.credits, 0)), 0)::numeric(8,1)
  into v_v1_course_credits
  from public.learning_records lr
  join public.courses c on c.id = lr.course_id
  where lr.user_id = p_user_id
    and lr.status = 'completed';

  select coalesce(sum(coalesce(l.credits, 0)), 0)::numeric(8,1)
  into v_v2_lesson_credits
  from public.v2_learning_records vlr
  join public.v2_course_lessons l on l.id = vlr.lesson_id
  where vlr.user_id = p_user_id
    and vlr.status = 'completed';

  return (
    coalesce(v_v1_course_credits, 0)
    + coalesce(v_v2_lesson_credits, 0)
    + coalesce(v_bonus, 0)
  )::numeric(8,1);
end;
$$;

comment on function public.calculate_user_total_credits(uuid, numeric)
  is '计算用户总学分：V1 完课学分 + V2 Lesson 完课学分 + 奖励/扣减学分';

revoke execute on function public.calculate_user_total_credits(uuid, numeric)
  from public, anon, authenticated;

drop trigger if exists refresh_total_credits_from_v2_learning_record_trigger
  on public.v2_learning_records;

create trigger refresh_total_credits_from_v2_learning_record_trigger
  after insert or delete or update of user_id, lesson_id, status, progress
  on public.v2_learning_records
  for each row
  execute function public.refresh_total_credits_from_learning_record();

create or replace function public.refresh_total_credits_from_v2_lesson_credit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if old.credits is not distinct from new.credits then
    return new;
  end if;

  for v_user_id in
    select distinct vlr.user_id
    from public.v2_learning_records vlr
    where vlr.lesson_id = new.id
      and vlr.status = 'completed'
  loop
    perform public.refresh_user_total_credits(v_user_id);
  end loop;

  return new;
end;
$$;

revoke execute on function public.refresh_total_credits_from_v2_lesson_credit()
  from public, anon, authenticated;

drop trigger if exists refresh_total_credits_from_v2_lesson_credit_trigger
  on public.v2_course_lessons;

create trigger refresh_total_credits_from_v2_lesson_credit_trigger
  after update of credits
  on public.v2_course_lessons
  for each row
  execute function public.refresh_total_credits_from_v2_lesson_credit();

update public.profiles p
set total_credits = public.calculate_user_total_credits(p.id)
where p.total_credits is distinct from public.calculate_user_total_credits(p.id);
