-- Notify the original question author when someone else replies in course Q&A.

begin;

create or replace function public.notify_course_question_reply()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_question_author_id uuid;
  v_course_id uuid;
  v_course_title text;
  v_reply_preview text;
begin
  if new.status <> 'visible' then
    return new;
  end if;

  select
    q.author_id,
    q.course_id,
    c.title
  into
    v_question_author_id,
    v_course_id,
    v_course_title
  from public.course_questions q
  join public.courses c on c.id = q.course_id
  where q.id = new.question_id
    and q.status = 'visible';

  if v_question_author_id is null or v_question_author_id = new.author_id then
    return new;
  end if;

  v_reply_preview := left(regexp_replace(trim(new.body), '\s+', ' ', 'g'), 80);

  insert into public.user_notifications (user_id, type, title, body, link)
  values (
    v_question_author_id,
    'course_question_reply',
    '你的课程提问有了新回复',
    '《' || coalesce(v_course_title, '课程') || '》中的提问收到一条回复：' || v_reply_preview,
    '/courses/' || v_course_id::text
  );

  return new;
end;
$$;

comment on function public.notify_course_question_reply()
  is '课程问答回复发布后，给原问题作者写入站内通知；自己回复自己不通知。';

drop trigger if exists notify_course_question_reply_after_insert
  on public.course_question_replies;

create trigger notify_course_question_reply_after_insert
  after insert on public.course_question_replies
  for each row
  execute function public.notify_course_question_reply();

revoke execute on function public.notify_course_question_reply() from public, anon, authenticated;

comment on column public.user_notifications.type
  is '通知类型: credit_reward | credit_deduct | level_change | banned | unbanned | course_question_reply';

commit;
