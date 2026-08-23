-- V2 标准化试题提交时使用 private 答案键自动评分。

begin;

create or replace function public.v2_submit_attempt(p_attempt_id uuid)
returns public.v2_submission_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  attempt_row public.v2_submission_attempts;
  answer_row record;
  submitted_keys jsonb;
  correct_keys jsonb;
  has_manual_items boolean;
  final_score_value numeric;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into attempt_row
  from public.v2_submission_attempts attempts
  where attempts.id = p_attempt_id
    and attempts.user_id = caller_id
    and attempts.status in ('draft', 'revision_required')
  for update;

  if attempt_row.id is null then
    raise exception 'Editable V2 attempt not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.v2_assessment_items items
    left join public.v2_submission_answers answers
      on answers.item_id = items.id
      and answers.attempt_id = attempt_row.id
    where items.assessment_block_id = attempt_row.assessment_block_id
      and items.is_required
      and answers.id is null
  ) then
    raise exception 'Required assessment answers are missing' using errcode = '23514';
  end if;

  for answer_row in
    select
      answers.id as answer_id,
      answers.answer_text,
      answers.answer_json,
      coalesce(items.max_score, 1) as max_score,
      keys.answer_key
    from public.v2_submission_answers answers
    join public.v2_assessment_items items on items.id = answers.item_id
    left join private.v2_assessment_keys keys on keys.item_id = items.id
    where answers.attempt_id = attempt_row.id
  loop
    if answer_row.answer_key is null then
      update public.v2_submission_answers
      set auto_score = null
      where id = answer_row.answer_id;
      continue;
    end if;

    if jsonb_typeof(answer_row.answer_json) = 'array' then
      select coalesce(jsonb_agg(value order by value), '[]'::jsonb)
      into submitted_keys
      from jsonb_array_elements_text(answer_row.answer_json) values_list(value);
    elsif length(btrim(coalesce(answer_row.answer_text, ''))) > 0 then
      submitted_keys := jsonb_build_array(answer_row.answer_text);
    else
      submitted_keys := '[]'::jsonb;
    end if;

    select coalesce(jsonb_agg(value order by value), '[]'::jsonb)
    into correct_keys
    from jsonb_array_elements_text(answer_row.answer_key -> 'correct') values_list(value);

    update public.v2_submission_answers
    set auto_score = case when submitted_keys = correct_keys then answer_row.max_score else 0 end
    where id = answer_row.answer_id;
  end loop;

  select exists (
    select 1
    from public.v2_assessment_items items
    left join private.v2_assessment_keys keys on keys.item_id = items.id
    where items.assessment_block_id = attempt_row.assessment_block_id
      and keys.item_id is null
  ) into has_manual_items;

  select coalesce(sum(answers.auto_score), 0)
  into final_score_value
  from public.v2_submission_answers answers
  where answers.attempt_id = attempt_row.id;

  update public.v2_submission_attempts
  set status = case when has_manual_items then 'submitted' else 'reviewed' end,
      submitted_at = now(),
      final_score = final_score_value
  where id = attempt_row.id
  returning * into attempt_row;

  return attempt_row;
end;
$$;

revoke all on function public.v2_submit_attempt(uuid) from public, anon;
grant execute on function public.v2_submit_attempt(uuid) to authenticated;

commit;
