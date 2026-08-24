-- Live 学员端匿名答题统计。
-- 只允许已提交当前直播题的登录用户读取聚合结果，不暴露原始答案或 user_id。

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
  'Live：已答学员读取当前题的匿名选项人数与占比';

revoke all on function public.get_live_participant_results(uuid) from public;
revoke all on function public.get_live_participant_results(uuid) from anon;
grant execute on function public.get_live_participant_results(uuid) to authenticated;
