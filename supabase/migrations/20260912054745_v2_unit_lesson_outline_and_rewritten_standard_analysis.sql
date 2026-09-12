-- 教学通识课 V2：目录由 Module → Unit → Lesson 收敛为 Unit → Lesson，
-- 并按六份重写脚本更新“课标分析”单元的课程正文、评估与知识卡。

begin;

create or replace function private.v2_can_access_unit(p_unit_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select private.v2_user_has_access()
    and exists (
      select 1 from public.v2_course_units u
      where u.id = p_unit_id and u.status = 'published' and u.is_active
    );
$$;

create or replace function private.v2_can_access_lesson(p_lesson_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select private.v2_user_has_access()
    and exists (
      select 1 from public.v2_course_lessons l
      join public.v2_course_units u on u.id = l.unit_id
      where l.id = p_lesson_id and l.status = 'published'
        and u.status = 'published' and u.is_active
    );
$$;

create or replace function private.v2_can_access_block(p_block_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select private.v2_user_has_access()
    and exists (
      select 1
      from public.v2_assessment_blocks b
      left join public.v2_course_lessons l on l.id = b.lesson_id
      left join public.v2_course_units lu on lu.id = l.unit_id
      left join public.v2_course_units uu on uu.id = b.unit_id
      where b.id = p_block_id and b.status = 'published'
        and ((l.id is not null and l.status = 'published' and lu.status = 'published' and lu.is_active)
          or (uu.id is not null and uu.status = 'published' and uu.is_active))
    );
$$;

create or replace function public.v2_publish_lesson_admin(p_lesson_id uuid)
returns public.v2_course_lessons
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_lesson public.v2_course_lessons;
begin
  if (select auth.uid()) is null or not (select private.v2_can_manage()) then
    raise exception 'Only active V2 managers can publish lessons' using errcode = '42501';
  end if;

  update public.v2_course_units units
  set status = 'published', is_active = true
  from public.v2_course_lessons lessons
  where lessons.id = p_lesson_id and units.id = lessons.unit_id;

  update public.v2_course_lessons
  set status = 'published', published_at = coalesce(published_at, now())
  where id = p_lesson_id
  returning * into saved_lesson;

  if saved_lesson.id is null then
    raise exception 'V2 lesson not found' using errcode = 'P0002';
  end if;

  return saved_lesson;
end;
$$;

-- BEGIN GENERATED IMPORT FUNCTION
create or replace function public.v2_import_course_workbook(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  unit_value jsonb;
  lesson_value jsonb;
  resource_value jsonb;
  card_value jsonb;
  assessment_value jsonb;
  item_value jsonb;
  option_value jsonb;
  unit_id uuid;
  lesson_id uuid;
  block_id uuid;
  item_id uuid;
  dictionary_id uuid;
  objective_json jsonb;
  item_type_key text;
  option_keys text[];
  unit_count integer := 0;
  lesson_count integer := 0;
  resource_count integer := 0;
  card_count integer := 0;
  assessment_count integer := 0;
  item_count integer := 0;
begin
  if caller_id is null or not (select private.v2_can_manage()) then
    raise exception 'Only active V2 managers can import course workbooks' using errcode = '42501';
  end if;

  if p_payload is null or jsonb_typeof(p_payload -> 'units') <> 'array' or jsonb_array_length(p_payload -> 'units') = 0 then
    raise exception 'Workbook import requires at least one unit' using errcode = '22023';
  end if;

    for unit_value in select value from jsonb_array_elements(p_payload -> 'units') loop
      if length(btrim(coalesce(unit_value ->> 'slug', ''))) = 0 or length(btrim(coalesce(unit_value ->> 'title', ''))) = 0 then
        raise exception 'Unit slug and title cannot be blank' using errcode = '23514';
      end if;
      insert into public.v2_course_units (slug, title, description_markdown, sort_order, status, is_active)
      values ('unit-' || gen_random_uuid(), btrim(unit_value ->> 'title'), nullif(unit_value ->> 'description_markdown', ''), coalesce((unit_value ->> 'sort_order')::integer, unit_count), 'draft', true)
      returning id into unit_id;
      unit_count := unit_count + 1;

      for lesson_value in select value from jsonb_array_elements(coalesce(unit_value -> 'lessons', '[]'::jsonb)) loop
        if length(btrim(coalesce(lesson_value ->> 'lesson_key', ''))) = 0 or length(btrim(coalesce(lesson_value ->> 'lesson_title', ''))) = 0 then
          raise exception 'Lesson key and title cannot be blank' using errcode = '23514';
        end if;

        dictionary_id := null;
        if nullif(lesson_value ->> 'lesson_type_key', '') is not null then
          select items.id into dictionary_id
          from public.v2_dictionary_items items
          join public.v2_dictionary_groups groups on groups.id = items.group_id
          where groups.key = 'lesson_type' and items.key = lesson_value ->> 'lesson_type_key' and items.is_active and groups.is_active;
          if dictionary_id is null then raise exception 'Invalid lesson type key: %', lesson_value ->> 'lesson_type_key' using errcode = '23503'; end if;
        end if;

        select coalesce(jsonb_agg(jsonb_build_object(
          'id', 'objective-' || objective_row.ordinality,
          'text', btrim(coalesce(objective_row.value ->> 'text', '')),
          'type_id', objective_type.id
        ) order by objective_row.ordinality), '[]'::jsonb)
        into objective_json
        from jsonb_array_elements(coalesce(lesson_value -> 'objectives', '[]'::jsonb)) with ordinality objective_row(value, ordinality)
        left join public.v2_dictionary_items objective_type on objective_type.key = nullif(objective_row.value ->> 'type_key', '')
          and objective_type.is_active
          and objective_type.group_id = (select groups.id from public.v2_dictionary_groups groups where groups.key = 'objective_type' and groups.is_active limit 1);

        if exists (
          select 1
          from jsonb_array_elements(coalesce(lesson_value -> 'objectives', '[]'::jsonb)) objective_row
          where length(btrim(coalesce(objective_row.value ->> 'text', ''))) = 0
        ) then
          raise exception 'Objective text cannot be blank' using errcode = '23514';
        end if;
        if exists (
          select 1
          from jsonb_array_elements(coalesce(lesson_value -> 'objectives', '[]'::jsonb)) objective_row
          where nullif(objective_row.value ->> 'type_key', '') is not null
            and not exists (
              select 1 from public.v2_dictionary_items items
              join public.v2_dictionary_groups groups on groups.id = items.group_id
              where groups.key = 'objective_type' and groups.is_active and items.is_active and items.key = objective_row.value ->> 'type_key'
            )
        ) then
          raise exception 'Invalid objective type key' using errcode = '23503';
        end if;

        insert into public.v2_course_lessons (
          unit_id, slug, title, subtitle, description, lesson_type_id, duration_minutes, credits,
          sort_order, membership_type, is_trial, status, challenge_title, challenge_markdown,
          objectives, success_criteria_markdown, takeaway_markdown, body_markdown
        ) values (
          unit_id, nullif(btrim(coalesce(lesson_value ->> 'lesson_slug', '')), ''), btrim(lesson_value ->> 'lesson_title'),
          nullif(lesson_value ->> 'subtitle', ''), nullif(lesson_value ->> 'description', ''), dictionary_id,
          nullif(lesson_value ->> 'duration_minutes', '')::integer, coalesce(nullif(lesson_value ->> 'credits', '')::numeric, 0),
          coalesce((lesson_value ->> 'sort_order')::integer, lesson_count), nullif(lesson_value ->> 'membership_type', ''),
          coalesce((lesson_value ->> 'is_trial')::boolean, false), 'draft', nullif(lesson_value ->> 'challenge_title', ''),
          nullif(lesson_value ->> 'challenge_markdown', ''), objective_json, nullif(lesson_value ->> 'success_criteria_markdown', ''),
          nullif(lesson_value ->> 'takeaway_markdown', ''), nullif(lesson_value ->> 'body_markdown', '')
        ) returning id into lesson_id;
        lesson_count := lesson_count + 1;

        for resource_value in select value from jsonb_array_elements(coalesce(lesson_value -> 'resources', '[]'::jsonb)) loop
          dictionary_id := null;
          if nullif(resource_value ->> 'resource_type_key', '') is not null then
            select items.id into dictionary_id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'resource_type' and items.key = resource_value ->> 'resource_type_key' and items.is_active and groups.is_active;
            if dictionary_id is null then raise exception 'Invalid resource type key: %', resource_value ->> 'resource_type_key' using errcode = '23503'; end if;
          end if;
          if nullif(resource_value ->> 'usage_type_key', '') is not null then
            select items.id into dictionary_id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'resource_usage' and items.key = resource_value ->> 'usage_type_key' and items.is_active and groups.is_active;
            if dictionary_id is null then raise exception 'Invalid resource usage key: %', resource_value ->> 'usage_type_key' using errcode = '23503'; end if;
          end if;
          if length(btrim(coalesce(resource_value ->> 'external_url', ''))) = 0 then raise exception 'Resource URL cannot be blank' using errcode = '23514'; end if;
          if lower(btrim(resource_value ->> 'external_url')) not like 'http://%' and lower(btrim(resource_value ->> 'external_url')) not like 'https://%' then raise exception 'Resource URL must use http or https' using errcode = '22023'; end if;
          insert into public.v2_lesson_resources (lesson_id, resource_type_id, usage_type_id, title, description, external_url, is_downloadable, sort_order, is_active, metadata)
          values (
            lesson_id,
            (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'resource_type' and items.key = nullif(resource_value ->> 'resource_type_key', '') and items.is_active and groups.is_active),
            (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'resource_usage' and items.key = nullif(resource_value ->> 'usage_type_key', '') and items.is_active and groups.is_active),
            nullif(resource_value ->> 'title', ''), nullif(resource_value ->> 'description', ''), btrim(resource_value ->> 'external_url'), coalesce((resource_value ->> 'is_downloadable')::boolean, false), coalesce((resource_value ->> 'sort_order')::integer, resource_count), true, '{}'::jsonb
          );
          resource_count := resource_count + 1;
        end loop;

        for card_value in select value from jsonb_array_elements(coalesce(lesson_value -> 'cards', '[]'::jsonb)) loop
          if length(btrim(coalesce(card_value ->> 'title', ''))) = 0 or length(btrim(coalesce(card_value ->> 'content_markdown', ''))) = 0 then raise exception 'Knowledge card title and content cannot be blank' using errcode = '23514'; end if;
          if nullif(card_value ->> 'card_type_key', '') is not null and not exists (select 1 from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'knowledge_card_type' and groups.is_active and items.is_active and items.key = card_value ->> 'card_type_key') then
            raise exception 'Invalid knowledge card type key: %', card_value ->> 'card_type_key' using errcode = '23503';
          end if;
          insert into public.v2_lesson_knowledge_cards (lesson_id, card_type_id, title, content_markdown, sort_order, is_active)
          values (
            lesson_id,
            (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'knowledge_card_type' and items.key = nullif(card_value ->> 'card_type_key', '') and items.is_active and groups.is_active),
            btrim(card_value ->> 'title'), card_value ->> 'content_markdown', coalesce((card_value ->> 'sort_order')::integer, card_count), true
          );
          card_count := card_count + 1;
        end loop;

        for assessment_value in select value from jsonb_array_elements(coalesce(lesson_value -> 'assessments', '[]'::jsonb)) loop
          if length(btrim(coalesce(assessment_value ->> 'key', ''))) = 0 or length(btrim(coalesce(assessment_value ->> 'title', ''))) = 0 then raise exception 'Assessment key and title cannot be blank' using errcode = '23514'; end if;
          if nullif(assessment_value ->> 'assessment_type_key', '') is not null and not exists (select 1 from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'assessment_type' and groups.is_active and items.is_active and items.key = assessment_value ->> 'assessment_type_key') then
            raise exception 'Invalid assessment type key: %', assessment_value ->> 'assessment_type_key' using errcode = '23503';
          end if;
          insert into public.v2_assessment_blocks (lesson_id, assessment_type_id, title, instructions_markdown, required, estimated_minutes, sort_order, status)
          values (
            lesson_id,
            (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'assessment_type' and items.key = nullif(assessment_value ->> 'assessment_type_key', '') and items.is_active and groups.is_active),
            btrim(assessment_value ->> 'title'), nullif(assessment_value ->> 'instructions_markdown', ''), coalesce((assessment_value ->> 'required')::boolean, false), nullif(assessment_value ->> 'estimated_minutes', '')::integer, coalesce((assessment_value ->> 'sort_order')::integer, assessment_count), 'draft'
          ) returning id into block_id;
          assessment_count := assessment_count + 1;

          for item_value in select value from jsonb_array_elements(coalesce(assessment_value -> 'items', '[]'::jsonb)) loop
            dictionary_id := (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'item_type' and items.key = nullif(item_value ->> 'item_type_key', '') and items.is_active and groups.is_active);
            if nullif(item_value ->> 'item_type_key', '') is not null and dictionary_id is null then raise exception 'Invalid item type key: %', item_value ->> 'item_type_key' using errcode = '23503'; end if;
            select items.key into item_type_key from public.v2_dictionary_items items where items.id = dictionary_id;
            if length(btrim(coalesce(item_value ->> 'prompt_markdown', ''))) = 0 then raise exception 'Assessment prompt cannot be blank' using errcode = '23514'; end if;
            if jsonb_typeof(item_value -> 'rubric') not in ('null', 'object') then raise exception 'Assessment rubric must be an object' using errcode = '22023'; end if;
            if item_type_key in ('single_choice', 'multiple_choice', 'true_false') and (jsonb_array_length(coalesce(item_value -> 'options', '[]'::jsonb)) < 2 or jsonb_typeof(item_value -> 'answer_key') <> 'object' or jsonb_array_length(coalesce(item_value -> 'answer_key' -> 'correct', '[]'::jsonb)) = 0) then
              raise exception 'Choice items require at least two options and a correct answer' using errcode = '23514';
            end if;
            if nullif(item_value ->> 'grading_mode_key', '') is not null and not exists (select 1 from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'grading_mode' and groups.is_active and items.is_active and items.key = item_value ->> 'grading_mode_key') then
              raise exception 'Invalid grading mode key: %', item_value ->> 'grading_mode_key' using errcode = '23503';
            end if;
            insert into public.v2_assessment_items (assessment_block_id, item_type_id, grading_mode_id, prompt_markdown, case_markdown, max_score, rubric, sort_order, is_required)
            values (
              block_id, dictionary_id,
              (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'grading_mode' and items.key = nullif(item_value ->> 'grading_mode_key', '') and items.is_active and groups.is_active),
              btrim(item_value ->> 'prompt_markdown'), nullif(item_value ->> 'case_markdown', ''), nullif(item_value ->> 'max_score', '')::numeric, item_value -> 'rubric', coalesce((item_value ->> 'sort_order')::integer, item_count), coalesce((item_value ->> 'is_required')::boolean, true)
            ) returning id into item_id;
            item_count := item_count + 1;
            for option_value in select value from jsonb_array_elements(coalesce(item_value -> 'options', '[]'::jsonb)) loop
              insert into public.v2_assessment_options (item_id, option_key, option_text, sort_order)
              values (item_id, btrim(option_value ->> 'key'), btrim(option_value ->> 'text'), coalesce((option_value ->> 'sort_order')::integer, 0));
            end loop;
            if item_value -> 'answer_key' is not null then
              insert into private.v2_assessment_keys (item_id, answer_key, scoring_config)
              values (item_id, item_value -> 'answer_key', '{}'::jsonb);
            end if;
          end loop;
        end loop;
      end loop;
  end loop;

  return jsonb_build_object(
    'unit_count', unit_count,
    'lesson_count', lesson_count,
    'resource_count', resource_count,
    'card_count', card_count,
    'assessment_count', assessment_count,
    'item_count', item_count
  );
end;
$$;

revoke all on function public.v2_import_course_workbook(jsonb) from public, anon;
grant execute on function public.v2_import_course_workbook(jsonb) to authenticated;
-- END GENERATED IMPORT FUNCTION

drop policy if exists v2_modules_manager on public.v2_course_modules;
drop policy if exists v2_modules_read_published on public.v2_course_modules;
drop policy if exists v2_modules_select on public.v2_course_modules;
drop policy if exists v2_modules_insert on public.v2_course_modules;
drop policy if exists v2_modules_update on public.v2_course_modules;
drop policy if exists v2_modules_delete on public.v2_course_modules;
drop function if exists private.v2_can_access_module(uuid);

drop index if exists public.v2_course_units_module_sort_idx;
alter table public.v2_course_units drop column if exists module_id;
drop table if exists public.v2_course_modules;

comment on table public.v2_course_units is '教学通识课 V2 一级目录（Unit）；单课通过 unit_id 归属单元。';



-- BEGIN GENERATED STANDARD ANALYSIS DATA
insert into public.v2_course_units (
  id, slug, title, description_markdown, unit_type_id, sort_order, status, is_active
) values (
  '9a110000-0000-4000-8000-000000000010',
  'standard-analysis',
  '课标分析',
  '以单元为基本单位，按“单元概括—找课程目标—找课程内容—找课程学业评价—概括总结”完成可回溯的课标分析。',
  (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'unit_type' and items.key = 'foundation' limit 1),
  10,
  'published',
  true
)
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  description_markdown = excluded.description_markdown,
  unit_type_id = excluded.unit_type_id,
  sort_order = excluded.sort_order,
  status = excluded.status,
  is_active = excluded.is_active,
  updated_at = now();

delete from public.v2_course_lessons
where id = '9a110000-0000-4000-8001-000000000007';

delete from public.v2_assessment_blocks
where id in (
  '9a110000-0000-4000-8101-000000000001'::uuid,
  '9a110000-0000-4000-8102-000000000001'::uuid,
  '9a110000-0000-4000-8101-000000000002'::uuid,
  '9a110000-0000-4000-8102-000000000002'::uuid,
  '9a110000-0000-4000-8101-000000000003'::uuid,
  '9a110000-0000-4000-8102-000000000003'::uuid,
  '9a110000-0000-4000-8101-000000000004'::uuid,
  '9a110000-0000-4000-8102-000000000004'::uuid,
  '9a110000-0000-4000-8101-000000000005'::uuid,
  '9a110000-0000-4000-8102-000000000005'::uuid,
  '9a110000-0000-4000-8101-000000000006'::uuid,
  '9a110000-0000-4000-8102-000000000006'::uuid,
  '9a110000-0000-4000-8101-000000000007'::uuid,
  '9a110000-0000-4000-8102-000000000007'::uuid
)
and not exists (
  select 1 from public.v2_submission_attempts attempts
  where attempts.assessment_block_id = v2_assessment_blocks.id
);

update public.v2_assessment_blocks
set status = 'archived', updated_at = now()
where id in (
  '9a110000-0000-4000-8101-000000000001'::uuid,
  '9a110000-0000-4000-8102-000000000001'::uuid,
  '9a110000-0000-4000-8101-000000000002'::uuid,
  '9a110000-0000-4000-8102-000000000002'::uuid,
  '9a110000-0000-4000-8101-000000000003'::uuid,
  '9a110000-0000-4000-8102-000000000003'::uuid,
  '9a110000-0000-4000-8101-000000000004'::uuid,
  '9a110000-0000-4000-8102-000000000004'::uuid,
  '9a110000-0000-4000-8101-000000000005'::uuid,
  '9a110000-0000-4000-8102-000000000005'::uuid,
  '9a110000-0000-4000-8101-000000000006'::uuid,
  '9a110000-0000-4000-8102-000000000006'::uuid,
  '9a110000-0000-4000-8101-000000000007'::uuid,
  '9a110000-0000-4000-8102-000000000007'::uuid
);

update public.v2_lesson_resources
set is_active = false, updated_at = now()
where id = '9a110000-0000-4000-8003-000000000005';

do $seed$
declare
  lesson_value jsonb;
  card_value jsonb;
  assessment_value jsonb;
  item_value jsonb;
  option_value jsonb;
  lesson_id uuid;
  block_id uuid;
  item_id uuid;
  first_card_id uuid;
  card_index integer;
  assessment_index integer;
  item_index integer;
begin
  for lesson_value in select value from jsonb_array_elements('[{"id":"9a110000-0000-4000-8001-000000000001","slug":"standard-analysis-01","title":"为什么要分析课标？","subtitle":"课标分析会改变哪些备课判断？","description":"课标分析会改变哪些备课判断？","lesson_type_key":"concept","duration_minutes":10,"credits":1,"sort_order":10,"is_trial":true,"challenge_title":"课标分析会改变哪些备课判断？","challenge_markdown":"一条被郑重写进教案的课标依据，究竟是真的改变了你的目标或教材重点，还是只是一句**正确但无用**的口号？","objectives":[{"id":"l1-o1","text":"说出课标分析的两项直接作用，制定教学目标和研读校准教材重点"},{"id":"l1-o2","text":"结合日常课与公开课两个场景，说出课标怎样为教学判断提供依据。"}],"success_criteria_markdown":"- 能说出课标分析的**两项直接作用**，制定教学目标和研读校准教材重点；\n- 能结合日常课与公开课，说明课标怎样为教学判断提供依据。","takeaway_markdown":"### 课标分析的两把尺子\n\n第一把尺子校准单元目标的方向、范围与程度。第二把尺子校准对教材的解读，识别核心内容、支撑材料与呈现方式。落到场景上，日常课可以用**试题与课标对齐**的方式以评定教，公开课引用课标原文，让教学判断有权威依据。","body_markdown":"### 先回答一个最前置的问题\n\n这是咱们课标分析单元的第一课。第一课不讲方法，先回答一个最前置的问题，**我们为什么要去读课标、分析课标？**\n\n我先猜一下你备课时的日常状态。翻得最多的是教材和教参，课标大概率在书架上落灰。为什么？因为课标给人的感觉太抽象、太宏观了。它定义的是学生学完三年、六年、九年之后应该是什么样。而你现在手里攥着的，是一个单元、一节课、四十分钟。一个在管九年后的事，一个在管这四十分钟的事，颗粒度差得太远，所以你会觉得，它指导不了我这节课，索性不看。\n\n这个感受很真实，但问题恰恰出在这里。**为什么要分析课标**，这一关如果没想清楚，后面所有的方法你都学不进去、用不起来。所以这节课，我们就把这个问题讲透。\n\n> **本课核心问题**　++课标究竟怎样改变一位教师的备课判断？++\n\n### 从教学设计框架看课标的两个直接作用\n\n先站在整个教学设计的框架上看。当你从零开始研发一节课、写一份教案时，课标在哪些环节发挥作用？\n\n**第一个作用，帮你制定教学目标。**教学目标不能拍脑袋，得有依据。依据从哪里来？最权威、最不容置疑的那一个，就是课标。你想把学生带到哪里，教完这个单元学生应该到达哪里，这个终点的最高依据，就是课标。\n\n**第二个作用，帮你研读教材。**很多老师习惯了**教教材**，但我要提醒你，教材只是落实课标的一种手段。你翻开手边这本书，里面无非是情境、问题、案例、任务、活动、例题和练习，把它们整合到一起，全都是为了落实课标。既然教材是手段，它就不是唯一的，完全可以用别的例子、别的题目去替换教材里的内容。所以拿到教材，你要问自己，我只是在教这两页纸吗？不是。教这两页纸，是为了达成课标在这个学段对学生的培养要求。课标是课程的**北极星**，定的是大方向，教材只是通向这个方向的一种手段，哪怕是核心手段。理解了这一层，读课标就能帮你校准对教材的解读。你对教材重点的理解一旦跑偏，回到课标，就能把它扳回来。\n\n> **两项直接作用**　课标既帮助我们**制定教学目标**，也帮助我们**研读并校准教材重点**。\n\n### 回到两个真实场景\n\n框架说完了，再落到两个大家都经历过的场景，日常课和公开课。\n\n#### 日常课，用评价反查课标要求\n\n先说日常课。日常课老师确实不怎么翻课标，理由还是那句话，太宏观。但你注意，有升学任务的老师，比如带中考、高考的，其实天天都在**以评定教**，看考试怎么考，倒推教学的重点难点。那么问题来了，考试命题的依据是什么？是教材吗？不是。命题最核心的基准是课标，试题一定不会超出课标的范畴。这就给了我们一个特别实的抓手。把试题和课标放在一起对齐，看这道题是怎么考察课标里那条要求的，再反推我的课堂上该怎么落实它。你看，这样一倒推，宏观的课标就跟你的日常课接上头了。\n\n#### 公开课，让教学判断有据可循\n\n再说公开课，这就更重要了。上公开课、说课、做教学阐释，你都要说教材、说目标、说课标，也就是说明你的教学依据。评委问你，这节课的重难点、核心目标，为什么这么定？你怎么回答？你总不能说我个人觉得，我凭经验。判断不能靠主观臆断，得有实打实、客观、权威的文本证据，而最大的证据之一，就是课标。你引用的是课标原文，你的依据就有了几乎无法被辩驳的效力，因为它就是国家对这门课程定下的最大方向。\n\n还有，2022 版新课标里写了教学提示，课标其实已经提示了你，要达成这个目标，这节课大致可以用什么环节、什么教法去上。这些又是你后续做教学设计、定教法学法时的依据。所以评委再问起，你把课标原文亮出来，就是最硬的回答。\n\n> **最终判断**　++课标分析的价值不在于引用的多不多，而在于它是否真正改变了目标、教材重点或教学依据。++","cards":[{"title":"课标分析的两把尺子","content_markdown":"第一把尺子校准单元目标的方向、范围与程度。第二把尺子校准对教材的解读，识别核心内容、支撑材料与呈现方式。落到场景上，日常课可以用**试题与课标对齐**的方式以评定教，公开课引用课标原文，让教学判断有权威依据。"}],"pretest":[{"type_key":"single_choice","grading_mode_key":"auto","prompt_markdown":"有老师说，课标定义的是学生九年之后的样子，太宏观了，指导不了我这节课四十分钟。这一看法最主要的问题是什么？","rubric":null,"options":[{"key":"A","text":"说法没错，日常课确实用不上课标。","sort_order":10},{"key":"B","text":"忽略了课标正是制定教学目标和解读教材的最高依据。","sort_order":20},{"key":"C","text":"应该先把课标全文背熟，再开始备课。","sort_order":30},{"key":"D","text":"课标只对命题人员有用，与教师无关。","sort_order":40}],"answer_key":{"correct":["B"]}}],"posttest":[{"type_key":"single_choice","grading_mode_key":"auto","prompt_markdown":"下列哪一组最完整地概括了课标分析对备课的两项直接作用？","rubric":null,"options":[{"key":"A","text":"制定教学目标；研读并校准教材重点","sort_order":10},{"key":"B","text":"规定教学环节；指定教法学法","sort_order":20},{"key":"C","text":"界定考试范围；编写教材","sort_order":30},{"key":"D","text":"替代教参；替代学情分析","sort_order":40}],"answer_key":{"correct":["A"]}},{"type_key":"true_false","grading_mode_key":"auto","prompt_markdown":"中考试题的命题基准主要是教材，而不是课标。","rubric":null,"options":[{"key":"T","text":"正确","sort_order":10},{"key":"F","text":"错误","sort_order":20}],"answer_key":{"correct":["F"]}},{"type_key":"short_answer","grading_mode_key":"manual","prompt_markdown":"评公开课时，评委问你这节课的重难点为什么这么定。为什么不能只回答我个人觉得？课标在其中扮演什么角色？","rubric":{"criteria":["答出教学判断需要客观、权威的文本依据，不能靠主观臆断，并能说明课标是国家定的最高方向，引用课标原文能让依据难以辩驳，即达标。"]},"options":[],"answer_key":null}]},{"id":"9a110000-0000-4000-8001-000000000002","slug":"standard-analysis-02","title":"课标是什么：国家规定的课程基本要求","subtitle":"什么是课程标准？","description":"什么是课程标准？","lesson_type_key":"concept","duration_minutes":10,"credits":1,"sort_order":20,"is_trial":false,"challenge_title":"什么是课程标准？","challenge_markdown":"拿到任何一个学科的课程标准，你都知道它每个部分的作用是什么。三大板块各回答什么问题，课程内容里的三个概念各管什么。","objectives":[{"id":"l2-o1","text":"用自己的话说出课程标准的性质，说清课标、教材、教案三层的分工"},{"id":"l2-o2","text":"说清课程目标、课程内容、学业质量三个部分各自回答什么问题"},{"id":"l2-o3","text":"区分课程内容中的内容要求、学业要求和教学提示。"}],"success_criteria_markdown":"- 能说清课程目标、课程内容、学业质量三个部分分别回答什么问题；\n- 能区分并解释内容要求、学业要求和教学提示的作用；\n- 能说清课标、教材、教案的三层分工，并按**课标定尺度、教材作承载、教案作安排**的顺序作出判断。","takeaway_markdown":"### 课标的核心结构\n\n课标由三大板块构成。课程目标回答学完这门课学生要发生什么变化，以核心素养为导向。课程内容回答学生要学什么，内含内容要求（学什么）、学业要求（学到什么程度）、教学提示（怎么教）。学业质量回答学完一个学段怎样判断学生学得怎么样。\n\n### 课标—教材—教案三层关系\n\n课标规定课程基本方向、内容范围和质量要求。教材依据课标组织具体内容，是承载。教案结合学生与课时作具体安排。判断顺序是先用课标定方向，再看用教材做落实，最后用教案做决策。","body_markdown":"### 这节课要回答什么\n\n上一节课我们讲了为什么要分析课标，这节课解决下一个基础问题，课标到底是什么？\n\n先把名字说全。课标，全称叫课程标准，是国家对一门课程作出的基本规定。\n\n它和教材回答的不是同一个问题。你翻开教材，教材回答的是，这一册书具体编了什么。而课标站在更高一层，回答的是，这门课到底要培养什么样的学生？学生要学习哪些内容？最终要学到什么程度？\n\n所以记住一句话。++课标规定的不是某一节课怎么上，而是一门课程的基本边界和质量标准。++哪个学校、哪个老师、用哪套教材，都得在这条边界里教。\n\n### 先分清课标、教材、教案\n\n既然课标和教材回答的问题不一样，我们干脆把备课里最常打交道的三个东西放在一起，看清楚各自管哪一层。\n\n课标在最上层，是国家定的，一门课程的基本方向、内容范围和质量要求，全国一个标准。\n\n教材在中间，是依据课标编出来的具体承载。它把课标的要求，落实成一册书里的单元、课文、例题和练习。所以同一份课标，可以有多种不同版本的教材，这就是**一纲多本**。\n\n教案在最下层，是教师自己的安排，面对自己班上的学生、这四十分钟，具体怎么教。\n\n三者的判断顺序由此就定下来了。先用课标定尺度，再看教材作承载，最后才到教案作决策。顺序一旦颠倒，比如从教材倒推课标，判断就失去了上位依据。\n\n> **三层分工**　++课标定尺度，教材作承载，教案作安排。++\n\n### 你手里的新课标是哪个版本\n\n平时大家挂在嘴边的新课标，主要指 2022 年发布的义务教育各科课程标准（2022 年版），从 2022 年秋季学期开始执行。\n\n现在你看到的 2025 年修订版，正式名称里会带上**2022 年版 2025 年修订**这样的标注。\n\n这个命名本身就说明了它的性质。2025 修订版不是推翻 2022 版重新建一套，而是在 2022 版基本框架上做的修订和更新。2022 版确立的核心素养、课程目标、课程内容、学业质量这套基本结构，都延续了下来。所以你手边不管是哪个年份的版本，读法都是一样的，都可以照着下面讲的框架去看。\n\n### 教师最该读的三个部分\n\n把一本课标拆开看，内容很多，但教师最需要读透的是三个部分。\n\n**第一个部分，课程目标。**它回答的是，学完这门课程，学生最终要发生什么变化。2022 版课标特别强调核心素养，所以课程目标已经不只是记住哪些知识，而是学生经过几年学习，应该形成怎样的价值观、品格和关键能力。\n\n**第二个部分，课程内容。**它回答的是，为了达到这些目标，学生到底要学什么。这里面最值得你注意的是三个概念，内容要求、学业要求、教学提示。\n\n内容要求，回答**学什么**。这个学段、这个主题里，哪些知识、观念、技能和经验属于课程规定的学习内容。\n\n学业要求，回答**学到什么程度**。同样一个知识点，仅仅知道、能够解释、能够分析，还是能在新情境里解决问题，要求完全不同。学业要求实际上给课程内容规定了学习结果的水平。\n\n教学提示，回答**怎么教**。为了让学生学好这些内容、达到这些要求，通常需要经历什么样的学习活动。注意，它不是一份现成教案，只是给出了这一类内容比较典型的学习方式和活动方向。\n\n这也是 2022 版课标一个很重要的变化。它不再只列知识清单，而是把内容、学习结果、学习过程连成了一条线。教育部发布 2022 版课标时，也明确把这三者概括为**教什么、教到什么程度、怎么教**。\n\n**第三个部分，学业质量。**它回答的是，学完一个学段，我们怎么判断学生到底学得怎么样。所以课标里的评价不只是出什么考试题，而是在给整门课程规定质量尺度。学生达到什么表现，才说明课程目标真正实现了。\n\n### 一句话记住课标\n\n最后，如果一定要用一句话解释课标，我会这样说。课标就是国家为一门课程规定的**目标、内容和质量标准**。\n\n它告诉我们，这门课要把学生带到哪里，中间要学什么，走到什么程度才算真正学会。\n\n> **一句话定义**　++课标是国家为一门课程规定的目标、内容和质量标准。++","cards":[{"title":"课标的核心结构","content_markdown":"课标由三大板块构成。课程目标回答学完这门课学生要发生什么变化，以核心素养为导向。课程内容回答学生要学什么，内含内容要求（学什么）、学业要求（学到什么程度）、教学提示（怎么教）。学业质量回答学完一个学段怎样判断学生学得怎么样。"},{"title":"课标—教材—教案三层关系","content_markdown":"课标规定课程基本方向、内容范围和质量要求。教材依据课标组织具体内容，是承载。教案结合学生与课时作具体安排。判断顺序是先用课标定方向，再看用教材做落实，最后用教案做决策。"}],"pretest":[{"type_key":"single_choice","grading_mode_key":"auto","prompt_markdown":"以下哪句话最准确？","rubric":null,"options":[{"key":"A","text":"课标按每一课规定教师必须使用的教学流程。","sort_order":10},{"key":"B","text":"教材就是课标的逐字展开。","sort_order":20},{"key":"C","text":"课标规定基本方向、内容范围和质量要求，教材作具体承载，教案面向具体学生作安排。","sort_order":30},{"key":"D","text":"教材出现的内容都应成为单元重点。","sort_order":40}],"answer_key":{"correct":["C"]}}],"posttest":[{"type_key":"true_false","grading_mode_key":"auto","prompt_markdown":"只要教材中出现某项内容，就能证明它是该单元的课标重点。","rubric":null,"options":[{"key":"T","text":"正确","sort_order":10},{"key":"F","text":"错误","sort_order":20}],"answer_key":{"correct":["F"]}},{"type_key":"single_choice","grading_mode_key":"auto","prompt_markdown":"内容要求、学业要求、教学提示分别回答的问题是：","rubric":null,"options":[{"key":"A","text":"教什么／教到什么程度／怎么教","sort_order":10},{"key":"B","text":"教到什么程度／教什么／怎么教","sort_order":20},{"key":"C","text":"怎么教／教什么／教到什么程度","sort_order":30},{"key":"D","text":"教什么／怎么教／教到什么程度","sort_order":40}],"answer_key":{"correct":["A"]}},{"type_key":"short_answer","grading_mode_key":"manual","prompt_markdown":"请用不超过 80 字说明课标、教材、教案的关系。","rubric":{"criteria":["同时包含课标给标准、教材作承载、教案作具体安排，且没有把三者等同，即达标。"]},"options":[],"answer_key":null}]},{"id":"9a110000-0000-4000-8001-000000000003","slug":"standard-analysis-03","title":"如何阅读分析课标：五步定位法","subtitle":"怎样用五步法阅读分析课标，找到备课所需的依据？","description":"怎样用五步法阅读分析课标，找到备课所需的依据？","lesson_type_key":"method","duration_minutes":18,"credits":1.5,"sort_order":30,"is_trial":false,"challenge_title":"怎样用五步法阅读分析课标，找到备课所需的依据？","challenge_markdown":"选一节你要上的公开课课题，然后按照本课流程，摘取课标中与你要授课的单元最密切相关的内容。","objectives":[{"id":"l3-o1","text":"按单元概括 → 找课程目标 → 找课程内容 → 找课程学业评价 → 概括总结的五步，完成一个单元的课标分析"},{"id":"l3-o2","text":"顺着不同学科课标的目录结构查找，而不是拿课题全文搜索"}],"success_criteria_markdown":"- 能初步概括备课单元的学科核心要素，获取阅读课标的基本线索；\n- 能清晰区分课标核心三部分的功能和作用；\n- 能在课标的课程内容章节筛选你备课需要的内容；","takeaway_markdown":"### 课标分析五步法\n\n1、**单元概括**，先用**主题＋核心要素**抓准对标对象；\n2、**找课程目标**，读到素养在本学段的具体表现；\n3、**找课程内容**，顺着学科目录定位学什么、学到什么程度、怎样学；\n4、**找课程学业评价**，用学业质量校准综合表现；\n5、**概括总结**，形成一段可回溯的单元课标定位。","body_markdown":"### 读课标真正的难点：你不知道自己找没找对\n\n新老师读课标最大的吐槽就是，我这节课在课标里没写啊！我读啥？\n\n教材里明明有这一课、这一框，你翻开课标，怎么找都找不到对应的段落。这时候人容易走向两个极端。\n\n一种，直接躺平。觉得课标太宏观，跟备课没关系，往抽屉里一塞，再也不看。另一种，更勤奋，也更危险——全都要全都读，和教材有相同的词，就复制粘贴。\n\n问题出在哪？出在你对课标的理解就是错的。**课标从来不是按教材的一课一框来写的。**它按学段、内容领域、学习主题、任务群、核心素养这些更大的结构来组织。教材是把课程要求具体化以后做出来的学习材料——所以课标的语言和教材的语言，本来就不是一一对应的。你拿教材的词去课标里搜，搜到的相同词语，很多只是巧合。\n\n所以分析一个单元，第一件事不是搜索，是先回答一个更基础的问题——**我手里这个单元，在课标里到底属于哪一块？**\n\n定位错了，后面摘再多原文都是白干。\n\n我们把阅读分析课标分成五步：\n\n1. **单元概括**，把教材单元压缩成核心要素，确定对标线索；\n2. **找课程目标**，找到素养在本学段的具体表现；\n3. **找课程内容**，顺着学科自己的结构定位，解答学什么、学到什么程度、怎样学；\n4. **找课程学业评价**，用学业质量校准方向是否准确；\n5. **概括总结**，形成一段可回溯的单元课标定位。\n\n每一步都配判断标准。跟着走完，你的定位就不再靠运气。\n\n### 第一步：单元概括\n\n先说结论：不要拿一节课去对课标，而是拿一个单元去找它在课标里的位置。\n\n那为什么我明明只上一课时，却要以单元为单位去读课标呢？\n\n因为课标涵盖的是整个学段最终要培养的目标，它必然是一张全景地图；而单课时的视角是微观的。课标不可能以单课时为单位来编写，也不可能与每一个课时完全对应，这是不可能的。\n\n那么，我们应该以什么样的“焦距”或单位去读课标，才能使颗粒度匹配呢？以单元为单位是比较合适的，因为一个单元通常围绕一个主题或学科核心要素组织内容，而这个学科要素基本上能与课标中的某些具体表述直接对应，比如内容要求，或是核心素养中某个学段的要求。\n\n因此，当你抽到一节课时，第一步不要拿着课题去硬对课标里的内容，你永远对不上。如果你强行对应，会觉得差距巨大，感觉这节课根本落实不了——但这可能是一个月甚至更长时间要落实的内容。\n\n所以，要以单元为基本单位去读课标，这样才能读懂。\n\n那具体怎么做呢？既然要以单元作为最小颗粒度去读课标，第一步就是通读单元教材。不需要精读，精读是教材分析干的事，这个环节通读单元教材即可。\n\n看三个地方——教材目录、单元导语，还有这个单元主要安排了哪些学习内容和任务。\n\n然后问自己三个问题：\n- 这个单元到底在讨论什么大问题？\n- 学生学完，主要应该认识什么、理解什么、会处理什么？\n- 整个单元反复出现的概念、能力、任务和价值议题是什么？\n\n这三个问题答完，你会得到一组词。这组词就是**学科要素**——你后面进课标找位置的对标线索。不要提前做教材分析，通读快速抓住核心即可。\n\n比如语文。一个单元全是议论性文章，我不会拿几篇课文的题目去搜课标。我先把单元压缩成几个更稳定的要素——观点与材料、论证关系、作者立场、思辨性阅读、表达观点。这些词不一定原封不动出现在课标里，但足够帮我判断该进哪个任务群、看哪个学段的要求。\n\n道德与法治也一样。教材有个框题叫「遵守社会规则」，我不会去搜这六个字。我会想——这一框背后真正讨论的是什么？规则意识、社会秩序、规则与自由、法治观念、公共生活。这些才是跟课标同一个语言层级的东西。\n\n数学同理。「全等三角形」四个字直接去搜，你只会把课标读成知识目录。往下多想一层——这个单元还涉及图形关系、判定方法、几何推理、证明意识。这时候再打开课标，方向就清楚多了。\n\n记住这句话——**你不是在课标里找课题的题目，而是要把教材用语转译成更上位的课标用语。**这一点想清楚，全文搜索带来的误判会少掉一大半。\n\n核心要素提炼多少个？**3—6 个**即可。少了怕你漏，多了线索就散了。\n\n### 第二步：找课程目标\n\n定位完单元主题，先进课标的课程目标章节，通常是第三章。\n\n课程目标不回答这节课教什么。它回答的是学生经过一个阶段的学习，应该形成什么样的核心素养。\n\n先看本学科核心素养有哪些。语文是文化自信、语言运用、思维能力、审美创造。英语是语言能力、文化意识、思维品质、学习能力。历史是唯物史观、时空观念、史料实证、历史解释、家国情怀。道德与法治是政治认同、道德修养、法治观念、健全人格、责任意识。\n\n但是，这里有个坑，几乎人人踩。\n\n很多老师读到这里就停了。分析一个语文单元，最后写一句「本单元培养学生的思维能力和语言运用能力」。\n\n这话错吗？没错。有用吗？没有。因为**几乎所有语文单元都可以这么说**。这句话等于没说。\n\n真正要做的，是继续往下读，这个核心素养在当前学段，到底表现成什么样。有些学科还会把素养拆成更具体的子维度，子维度往往比素养总名称有用得多。\n\n拿英语来说。语言能力在学段目标里会从「感知与积累、习得与建构、表达与交流」展开；思维品质会从「观察与辨析、归纳与推断、批判与创新」展开。到了这一层，单元和课标的关系才开始变具体。\n\n我用七年级英语举个例子，把这一步走完整。\n\n人教版七年级下册 Unit 1 Animal Friends。只看教材表面，你会看到动物名称、描述动物的词汇、表达喜好的句型。把整个单元看完，你会发现它真正装着几类任务——获取和整理动物信息；描述动物并说明喜欢的理由；理解动物与文化、生态的关系；还有关爱动物、保护动物的行动。\n\n这时候进课程目标，我不会把英语四项素养机械抄一遍。我会去读三级学段目标，一条一条跟单元任务对。\n\n语言能力——关注读懂主题相关简短语篇、提取归纳关键信息、描述事物、表达观点。为什么是这些？因为教材里真有大量获取动物信息、描述动物、解释理由的任务。\n\n文化意识——关注从简短语篇中获取归纳文化信息、作出判断，感悟人文精神和社会责任。因为这个单元已经不是在教动物词汇了，它碰到了动物和文化、生态、人的责任。\n\n思维品质——关注判断句段逻辑关系、多角度分析问题、依据材料作出判断。教材里有比较不同动物特征、解释为什么要保护动物的任务，这些表现就有载体。\n\n学习能力——关注整理学习内容、选择信息组织策略、合作完成任务。\n\n注意，我不能为了凑齐四项素养，把每一项下面所有子维度全摘进来。判断标准就一条——**教材有没有内容来落实它？没有，就不写。**\n\n所以课程目标定位，不是给单元贴素养标签。**是把素养一路读到本学段的具体表现，然后找出这个单元真正能推动发展的那部分。**\n\n做完以后问自己一句：我现在摘下来的，是一个宏观的素养名称，还是这个素养在本学段、这个单元里的具体表现？如果还是几个四字词语——你没定位到位，回去重读。\n\n### 第三步：找课程内容\n\n接下来进课程内容。这一步错得最多。\n\n为什么？因为**不同学科课标的组织方式差得非常远**。你拿一种查找方法套所有学科，必然出错。\n\n所以我打开一本新的学科课标，第一件事不是搜索，是看目录。先搞清楚这门学科按什么结构组织内容——有的按学段，有的按内容领域，有的按照大观念，有的按任务群，有的按主题，有的几条轴一起用。\n\n结构都没搞清楚就全文搜索，你摘出来的往往是「看起来相关、适用范围完全不同」的内容。\n\n由于不同课标的课程内容差异较大，下面我列举六个学科不同的例子，来示范如何阅读课程内容部分。\n\n**道德与法治**——先分学段，再进主题。课标课程内容先按学段展开，学段里再呈现道德教育、生命安全与健康教育、法治教育、中华优秀传统文化与革命传统教育、国情教育这些主题。比如统编八年级上册第二单元「维护社会秩序」——我不会搜这六个字。先判断年级：八年级，第四学段。再判断主题：跟道德教育、法治教育相关。进主题里继续读。\n\n**数学**——先分小学初中，再进领域。数与代数、图形与几何、统计与概率、综合与实践，领域里再呈现对应学段的内容要求、学业要求和教学提示。分析全等三角形，我的路径是——初中部分 → 图形与几何 → 第四学段 → 三角形。\n\n**语文**——学习任务群。基础型、发展型、拓展型。分析议论性文章单元，我先判断它属于哪个任务群——核心任务是读议论文、分析观点和材料、进行论证和表达，那大概率贴着「思辨性阅读与表达」。进任务群，读第四学段的学习内容和教学提示，同时回看课程目标里的第四学段要求。课程目标和课程内容，就这么接上了。\n\n**英语**——六要素加级别。课程内容由主题、语篇、语言知识、文化知识、语言技能、学习策略六个要素构成，按一级、二级、三级呈现。英语分析最忌讳的结局，就是最后只剩词汇和语法。还拿 Animal Friends 说——课程目标那一步我已经确定了相关表现，这里进课程内容：先看主题，它跟「人与自然」下的自然生态、环境保护明显相关；再看语篇——动物园指令是一种语篇，日常对话是一种语篇，动物信息卡、大象社交媒体帖子、说明文、地图，又是不同类型的语篇。为什么要判断语篇？因为不同语篇，学生用的阅读和表达方式不一样。然后围绕单元真正要完成的任务筛选语言知识和文化知识——获取动物信息、解释为什么喜欢、说明动物为什么重要、提出保护行动，能支撑这些任务的知识才重点定位。再看七年级对应的语言技能——整体理解、提取梳理关键信息、判断逻辑关系、口头交流、简单书面表达。最后看学习策略、三级教学提示和学业质量。定位完，你得到的不是「动物词汇、一般现在时」这种知识清单，而是主题、语篇、知识、技能、文化、策略共同构成的单元定位。\n\n**历史**——按学习主题。中国古代史、中国近代史、中国现代史、世界古代史……先进入对应历史时期，再在这个主题里连续看内容要求、学业要求、教学提示。\n\n**生物学**——按学习主题。生物体的结构层次、植物的生活……进了相关学习主题，同样连续读三类要求。\n\n找到正确位置，还没完。课程内容板块里通常有三类非常重要的信息——**内容要求、学业要求、教学提示**。\n\n不同学科栏目设置不完全一样：有的课标三类同时呈现，有的设内容要求和教学提示、再由后面的学业质量呈现综合要求。以你手边课标的目录为准，别跟我的说法较劲。\n\n但从理解上，这三类信息回答的是三个不同的问题。\n\n内容要求——学生要学什么。学业要求——学生大概要学到什么程度。教学提示——要形成这种理解和能力，学生通常要经历什么学习过程。\n\n这三样不能割裂着看。我找到一条内容要求，不会马上复制粘贴宣布收工。我会继续往后读——学生只是要知道这个知识，还是要理解它？能复述就行，还是要能解释、分析、比较、判断？要不要在新情境里运用？这是在找**学习深度**。再看教学提示——课标有没有强调通过调查、讨论、探究、实验、阅读、比较、实践活动来学？这些信息告诉你，课标期待的不是把知识讲给学生听，是让学生通过活动形成理解。\n\n比如同样是学规则。内容要求只说认识社会规则，你还不知道要多深。继续看学业要求，可能会发现——学生要能结合生活情境理解规则和秩序的关系，分析遵守规则的重要性。再看教学提示，可能会发现——课标建议联系真实生活情境、公共生活案例开展学习。到这时候，这条课程内容的含义才算完整。\n\n> **连成三句话**　学生要学什么。学生最终要做到什么。为了做到这一点，学生应该经历什么。\n\n这三句话，比单独摘一段课标原文值钱。\n\n### 第四步：找课程学业评价\n\n课程目标、课程内容都定位完，还差一步——看学业质量。\n\n学业质量描述的是学生完成一个学段课程学习后的**综合表现**。记住，它不是给你这个单元写的，更不能直接抄成一节课的学习目标。它站在远处，给你看终点。\n\n所以读学业质量，我不整段复制。我找三样东西——学生最终在什么类型的情境里表现所学；学生要综合运用哪些知识、方法和核心素养；这些表现里，哪些跟我当前这个单元最接近。\n\n然后反过来审自己前面的分析。\n\n如果我的单元分析最后只剩几个知识点，而学业质量明显要求学生在真实情境里综合运用知识解释现象、分析问题、作出判断——那我的定位**太窄了**，回去重定位。\n\n反过来，如果我把一个普通单元说得特别宏大，仿佛一个单元要扛起整个学段所有核心素养——学业质量会把它拉回来。**一个单元不是整个学段，它只是帮助学生走向学段终点的一段路。**\n\n学业质量最大的作用，不是给单元再堆一堆要求。**是校准方向。**看看目标-内容-评估三者是否在大方向上一致。\n\n### 第五步：概括总结\n\n将以上四步所摘取的课标的内容进行归纳总结，回答以下三个问题：\n- 核心内容：这个单元最重要的知识是什么？\n- 核心学习：学生必须经历什么？\n- 核心发展：最终希望学生形成什么能力或素养？\n\n至此，我们就完成了课标分析这个教学设计环节。\n\n### 五步走完，落点是一张报告表\n\n这五步不用死记。每一步都有固定的填空句式，第五课会把它们整理成一张可以直接填写的**课标分析报告表**。你按顺序填完，一份可保存、可复核的课标分析就完成了。\n\n这套方法最终解决的，是判断你到底有没有找到正确的内容。\n\n真正的准确分析，是你能讲清楚，这个单元在整个课程体系里站在哪，指向什么素养表现，要学什么，学到什么程度，在整个学段的发展里扛哪一段任务。\n\n这才叫读懂了课标。","cards":[{"title":"课标分析五步法","content_markdown":"1、**单元概括**，先用**主题＋核心要素**抓准对标对象；\n2、**找课程目标**，读到素养在本学段的具体表现；\n3、**找课程内容**，顺着学科目录定位学什么、学到什么程度、怎样学；\n4、**找课程学业评价**，用学业质量校准综合表现；\n5、**概括总结**，形成一段可回溯的单元课标定位。"}],"pretest":[{"type_key":"single_choice","grading_mode_key":"auto","prompt_markdown":"当你拿到一节课并准备阅读课标时，第一步会做什么？","rubric":null,"options":[{"key":"A","text":"阅读课标的核心素养章节，了解本课的核心目标","sort_order":10},{"key":"B","text":"阅读教材中本节课所在的单元，并归纳本单元的核心学科要素","sort_order":20},{"key":"C","text":"阅读课标的课程内容章节，并寻找本节课的课题名称","sort_order":30},{"key":"D","text":"阅读课标中的学业质量标准，了解如何评价","sort_order":40}],"answer_key":{"correct":["B"]}}],"posttest":[{"type_key":"short_answer","grading_mode_key":"manual","prompt_markdown":"把找课程学业评价、单元概括、概括总结、找课程内容、找课程目标排成合理顺序。","rubric":null,"options":[],"answer_key":null},{"type_key":"open_task","grading_mode_key":"manual","prompt_markdown":"选择自己的一个教材单元，写出主题、3—5 个核心要素和一条符合本学科课标的摘取步骤。","rubric":{"criteria":["对象是单元而非孤立课题；核心要素包含概念/能力/任务中的至少两类；路径包含学段或级别及学科特有索引轴，即达标。"]},"options":[],"answer_key":null}]},{"id":"9a110000-0000-4000-8001-000000000004","slug":"standard-analysis-04","title":"分类示范：先辨结构类型，再走五步","subtitle":"课程内容有多种结构类型，怎样认对类型、走对五步？","description":"课程内容有多种结构类型，怎样认对类型、走对五步？","lesson_type_key":"case","duration_minutes":20,"credits":2,"sort_order":40,"is_trial":false,"challenge_title":"课程内容有多种结构类型，怎样认对类型、走对五步？","challenge_markdown":"先判断自己学科的课标属于哪种结构类型，对照本课示范走完五步。再换一个不同类型的学科，只凭目录结构说出它的类型和五步路线。","objectives":[{"id":"l4-o1","text":"说出课程内容的五种结构类型，并判断自己学科的课标属于哪一种"},{"id":"l4-o2","text":"按本学科类型的入口路径，用五步法完成一个单元的课标定位。"}],"success_criteria_markdown":"- 能判断自己学科课程内容的结构类型，说对该类型的入口动作；\n- 五步顺序完整，课程目标、课程内容、学业质量三处位置功能不混淆；\n- 单元方向能由课标依据推出。","takeaway_markdown":"### 课标课程内容的结构类型\n\n课程内容有五种组织方式。主题＋学段（数学、道德与法治）、学习任务群（语文）、要素＋级别（英语）、学科观念统领（生物学、物理、化学、科学）、板块递进（历史、地理）。类型决定入口，五步决定顺序：单元概括 → 找课程目标 → 找课程内容 → 找课程学业评价 → 概括总结。","body_markdown":"### 课程内容不止一种组织方式\n\n学到这里，五步定位法你已经学完了。但打开自己学科的课标，新的困惑可能马上出现。为什么数学课标要先进**图形与几何**领域，语文要判断学习任务群，英语要面对六个要素，历史却是一段一段时期排下来？难道每换一门学科，就要重新学一套方法？\n\n> **不是**　++入口各不相同，是因为各学科组织课程内容的**结构类型**不同。类型变，五步不变。++\n\n课标不是按教材目录编的，也不存在全学科统一的目录。每门学科按自己的学科逻辑组织课程内容，于是出现了几种很不一样的结构类型。先把它们认全。\n\n| 结构类型 | 长什么样 | 代表学科 | 入口动作 |\n| --- | --- | --- | --- |\n| 主题＋学段 | 主题与学段两条轴交叉，主题跨学段螺旋上升 | 数学、道德与法治 | 定准两条轴，交叉定位 |\n| 学习任务群 | 按语言运用任务分群，群内再分学段 | 语文 | 先判断任务群，再读对应学段 |\n| 要素＋级别 | 六类内容要素按级别呈现 | 英语 | 先定级别，再逐项对照要素 |\n| 学科观念统领 | 核心主题下以大观念组织内容 | 生物学、物理、化学、科学 | 找到所属主题，顺观念往下读 |\n| 板块递进 | 按时序或空间尺度切成大板块 | 历史、地理 | 先选对板块，连读三类要求 |\n\n接下来，每种类型讲清楚它长什么样、怎么进入，再用一个真实单元示范五步法怎么走。你重点看与自己学科相同的类型，其余类型快速对照即可。\n\n### 类型一：主题＋学段，两条轴交叉定位\n\n数学、道德与法治都属于这一类，手里握着**主题**和**学段**两条轴。数学课标先分数与代数、图形与几何、统计与概率、综合与实践四个领域，领域里再分主题，主题按学段呈现，同一组主题跨学段螺旋上升，小学叫数与运算，初中变成数与式、方程与不等式、函数。道德与法治的轴序反过来，先分学段，每学段里再呈现道德教育、法治教育、国情教育这些主题。轴的先后因学科而异，共同点是，**两条轴都定准，交叉点才是你的位置**。\n\n#### 数学，在领域与学段的交叉点上\n\n**单元概括。**八年级**全等三角形**，压缩出来是全等、对应边、对应角、判定方法这组概念，还有讲道理、有依据地表达这条任务线。\n\n**找课程目标。**进入课程目标，与这组要素直接相关的是推理能力和几何直观。继续读第四学段的具体表现，比如经历从合情推理到演绎推理的过程，能依据条件说明结论成立的原因。\n\n**找课程内容。**数学课标是主题＋学段的典型。我的路径是初中部分 → **图形与几何** → **图形的性质** → **三角形**，领域轴与学段轴的交叉点就是要去的位置。内容要求确实列出若干全等判定事实，但学业要求和教学提示反复出现**得到、验证、证明、逻辑和推理**这些词。这时我会作出一个关键判断。**SAS、ASA、SSS 不是三句等待背诵的口诀，而是学生学习如何从条件推出结论、如何用依据表达判断的载体。**\n\n**找课程学业评价。**学业质量要求学生在情境中依据规则和事实进行演绎推理，说明结论的依据。对照这条终点表现，单元方向应当指向一条**从条件到结论、从依据到表达**的推理主线。\n\n**概括总结。**本单元围绕全等三角形，指向推理能力，学生经历从条件到结论、从依据到表达的推理过程，逐步学会用依据表达判断，为学段终点的演绎推理表现打基础。\n\n### 类型二：学习任务群，先选群再进学段\n\n这一类是语文专属。语文课标把课程内容按语言运用任务分成三层，基础型、发展型、拓展型，共六个学习任务群。基础型是语言文字积累与梳理，发展型里有实用性阅读与交流、文学阅读与创意表达、思辨性阅读与表达，拓展型是整本书阅读和跨学科学习。每个任务群内部再按学段列出学习内容和教学提示。入口动作是**先判断单元属于哪个任务群，再进群读对应学段**。\n\n#### 语文，把学段目标与学习任务群交叉起来\n\n**单元概括。**九年级思辨与创造单元，我不会搜索每篇课文的标题，而是把单元压缩成**观点、材料、论证、质疑和有依据表达**这组核心要素。\n\n**找课程目标。**带着这组要素进入第四学段目标，读到的是具体表现。**区分观点与材料、发现二者联系并作出判断**，有中心、有条理、有依据地表达。\n\n**找课程内容。**语文课标按学习任务群组织课程内容。这个单元贴着发展型任务群中的**思辨性阅读与表达**。进入任务群读第四学段的学习内容和教学提示，同时回看课程目标里的学段要求，两处相互印证。任务群强调比较、推断、质疑和重证据表达。\n\n**找课程学业评价。**学业质量进一步要求**解释观点与材料的联系**。三处连成一条清楚的进阶线，**从区分，到解释，再到有依据的判断与表达。**\n\n**概括总结。**本单元围绕议论性阅读与表达，指向思维能力和语言运用，学生在辨析观点与材料的过程中，学会有依据地判断和表达。\n\n### 类型三：要素＋级别，先定级别再走要素\n\n这一类是英语专属。英语课标的课程内容由**主题、语篇、语言知识、文化知识、语言技能、学习策略**六个要素构成，按一级、二级、三级呈现，级别对应学段。入口动作是**先定级别，再按六个要素逐项对照**，先看主题落在哪里，再看语篇类型，最后围绕单元任务定位知识、技能和策略。\n\n#### 英语，在主题统领下连接六类内容要素\n\n**单元概括。**Animal Friends 单元，压缩出四组任务。获取和组织动物信息，表达喜好理由，理解动物与文化及生态的关系，提出保护动物的行动。\n\n**找课程目标。**这一步不是查动物词汇和语法，而是进入四项核心素养的三级要求，判断哪些表现能被教材真实承载。语言能力里的获取梳理信息、描述事物、表达观点，文化意识里的人文精神与社会责任，都有真实载体。\n\n**找课程内容。**英语课标按级别和六个要素组织课程内容。进入三级内容，先看主题，落在**人与自然**下的动物保护；再看语篇，对话、信息卡、帖子、说明文各是不同类型；然后围绕单元任务定位语言知识、文化知识、语言技能和学习策略。这样，what、where、why、because 和名词复数就回到了它们应有的位置。**它们是完成介绍、解释和判断的语言支撑，不是单元学习的终点。**\n\n**找课程学业评价。**学业质量看三级终点，要求学生在熟悉的情境中围绕主题获取信息、进行简单交流并表达基本观点。对照来看，单元方向是围绕动物话题的理解与表达，不是一课一词的积累。\n\n**概括总结。**本单元围绕动物朋友这一主题，指向语言能力和文化意识，学生在多类语篇中获取信息、说明喜好、表达保护行动，为三级学业质量的综合表现打基础。\n\n### 类型四：学科观念统领，主题里藏着概念体系\n\n生物学、物理、化学、科学属于这一类，用学科自己的核心观念组织内容。生物学、物理、化学在初中才开课，内容不再切分学段。物理是五个一级主题，物质、运动和相互作用、能量、实验探究、跨学科实践。化学是五个学习主题，科学探究与化学实验、物质的性质与应用、物质的组成与结构、物质的化学变化、化学与社会跨学科实践。生物学按学习主题组织，主题的内容要求以**学科大观念**统领，从大概念到重要概念，再到具体条目。科学则是十三个学科核心概念，每个概念下的学习内容再按学段展开。入口动作是**找到单元所属的主题，顺着观念体系往下读**。\n\n#### 生物学，顺着学科观念走进植物的生活\n\n**单元概括。**面对七年级下册**植物的生活**单元，我先不打开课标，只看教材。种子萌发、植株生长、蒸腾作用、光合作用这些核心概念反复出现，观察、实验、探究是主要学习任务，背后还立着一条结构与功能相统一的观念。\n\n**找课程目标。**进入课程目标，生命观念里的物质与能量观、基于证据的科学思维和探究实践，都能被这个单元持续承载。我不会停在生命观念四个字上，而是继续读七年级学段的具体表现，比如能说出结构与功能相适应的实例，能依据现象作出推断。\n\n**找课程内容。**生物学课标按学习主题组织课程内容，主题的内容要求不是零散的知识点清单，而是用学科观念统领，大概念下面是重要概念，再往下才是具体条目。进入**植物的生活**主题，顺着观念往下读，再把内容要求、学业要求和教学提示放在一起连读。内容要求列出概念，学业要求规定学生要能运用概念解释现象，教学提示建议通过栽培、实验等活动学习。\n\n**找课程学业评价。**再看学业质量，看学段终点要求学生在什么情境中综合运用什么。比如在真实情境中运用结构与功能观解释常见生命现象。这提醒我，单元方向不能停在记住名词。\n\n**概括总结。**几个部分连起来，单元方向从零散知识变成一句完整的话。**理解生命过程与物质能量关系，运用知识解释实际现象，并以证据探究影响因素。**\n\n### 类型五：板块递进，先选对板块\n\n历史和地理属于这一类。学科按自己的宏观框架把内容切成大板块。历史按时间切成中国古代史、中国近代史、中国现代史、世界古代史、世界近代史、世界现代史六个板块，另设跨学科主题学习。地理按空间尺度从远到近，排成宇宙中的地球、地球的表层、认识世界、认识中国等主题，地理工具与地理实践两条主线贯穿。每个板块内部连续呈现内容要求、学业要求和教学提示。入口动作是**先判断单元属于哪个板块，直接进板块连读三类要求**。\n\n#### 历史，在中国近代史板块里定位辛亥革命\n\n**单元概括。**八年级上册讲辛亥革命的单元，我先压缩出一条线索，民族危机加深，革命思想传播，武昌起义，中华民国建立，背后是一个大问题，旧制度的出路在哪里。\n\n**找课程目标。**进入课程目标，时空观念和历史解释的学段表现与这条线索直接对应，把事件放回具体的时序中，说明革命发生的原因，评述它的影响。家国情怀也有真实载体，近代仁人志士的探索本身就是素材。\n\n**找课程内容。**历史课标按板块组织内容。辛亥革命明确属于**中国近代史**板块，直接进板块，连读其中的内容要求、学业要求和教学提示。板块就是入口，不需要拿课题全文搜索。\n\n**找课程学业评价。**再看学业质量，它要求学生能在特定的时空框架下讲述史事，运用史料说明问题，形成自己的历史解释。对照这条终点表现，单元方向就不能停在背事件、时间和人名。\n\n**概括总结。**本单元围绕辛亥革命，指向时空观念与历史解释，学生在具体时序中理解革命的起因与影响，学会用史料支撑判断。\n\n### 类型决定入口，五步决定顺序\n\n五种类型走下来，你应该已经发现，专家走的始终是同样五步。单元概括定对象，课程目标定素养表现，课程内容定学什么和怎么学，学业评价校准学段终点，概括总结收口成一句单元方向。\n\n所以，拿到任何一门学科的课标，先翻目录认类型。认出它是哪一种结构，入口就清楚了。五步，一步都不会少。路径随类型变化，五步顺序始终稳定。","cards":[{"title":"课标课程内容的结构类型","content_markdown":"课程内容有五种组织方式。主题＋学段（数学、道德与法治）、学习任务群（语文）、要素＋级别（英语）、学科观念统领（生物学、物理、化学、科学）、板块递进（历史、地理）。类型决定入口，五步决定顺序：单元概括 → 找课程目标 → 找课程内容 → 找课程学业评价 → 概括总结。"}],"pretest":[{"type_key":"single_choice","grading_mode_key":"auto","prompt_markdown":"下列教材单元与课程内容入口的匹配，正确的是哪一项？","rubric":null,"options":[{"key":"A","text":"数学全等三角形→只全文搜索全等。","sort_order":10},{"key":"B","text":"语文议论性单元→发展型学习任务群思辨性阅读与表达＋第四学段。","sort_order":20},{"key":"C","text":"英语 Animal Friends→先查语法项目，匹配后停止。","sort_order":30},{"key":"D","text":"道德与法治维护社会秩序→不分学段读取全部法治教育。","sort_order":40}],"answer_key":{"correct":["B"]}}],"posttest":[{"type_key":"short_answer","grading_mode_key":"manual","prompt_markdown":"把下列学科与其课程内容的结构类型对应起来。数学、语文、英语、生物学、历史；主题＋学段、学习任务群、要素＋级别、学科观念统领、板块递进。","rubric":null,"options":[],"answer_key":null},{"type_key":"open_task","grading_mode_key":"manual","prompt_markdown":"先判断自己学科的课标属于哪种结构类型，再按五步写出入口。单元概括看什么，找课程目标从哪里进，找课程内容从哪个入口进，找课程学业评价在哪里，概括总结写什么。","rubric":{"criteria":["类型判断正确，入口轴符合该类型（学段/任务群/级别/观念/板块）；五步顺序完整，三处课标位置功能不混淆，即达标。"]},"options":[],"answer_key":null}]},{"id":"9a110000-0000-4000-8001-000000000005","slug":"standard-analysis-05","title":"核心工具：课标分析报告","subtitle":"怎样用一张五步报告表，把课标分析做成可保存、可复核的成品？","description":"怎样用一张五步报告表，把课标分析做成可保存、可复核的成品？","lesson_type_key":"practice","duration_minutes":18,"credits":1.5,"sort_order":50,"is_trial":false,"challenge_title":"怎样用一张五步报告表，把课标分析做成可保存、可复核的成品？","challenge_markdown":"使用自己的真实教材单元，把报告表五行填空全部填完，形成一份**单元课标分析报告**最小可用稿。","objectives":[{"id":"l5-o1","text":"说出报告表五行与五步的对应关系，以及每一步的填空句式要回到课标哪里取证"},{"id":"l5-o2","text":"按本学科路径表找到进入课程内容的正确位置"},{"id":"l5-o3","text":"用五步报告表完成一个真实教材单元的课标分析，做到每一空有出处。"}],"success_criteria_markdown":"- 五行填空全部完成，句式完整，顺序没有颠倒；\n- 找课程目标、找课程内容、找课程学业评价三行都有真实课标位置支撑；\n- 没有用猜测或别处文字补齐空缺，未单列处已注明；\n- 最后一行合成一句完整的单元方向，每个关键词都能回到前面几行的出处。","takeaway_markdown":"### 课标分析报告表（五步 SOP）\n\n单元概括定对象 → 找课程目标定素养表现 → 找课程内容定学什么与怎么学 → 找课程学业评价定学段终点 → 概括总结合成单元方向。每一空有出处，最后一行落成一句可回溯的单元方向。","body_markdown":"### 为什么需要一张报告表\n\n前面四节课，你学完了五步定位法，认了课程内容的五种结构类型，也看了每种类型下的完整示范。但如果这些判断最后仍然散落在笔记、划线和聊天记录里，它们就进不了真实备课，也没法让同伴复核。\n\n这一课不再讲新方法，而是把五步沉淀成一张可以直接填写的**课标分析报告表**。你不需要再琢磨从哪里开始，按表从上往下填，就能得到一份可保存、可复核的分析稿。\n\n### 报告表长什么样\n\n报告表只有五行，对应五步。每一步给你两样东西，一是这一步要做什么，二是可以直接填空的句式。\n\n| 步骤 | 你要做的 | 填空句式 |\n| --- | --- | --- |\n| 一、单元概括 | 不打开课标，只看教材目录、单元导语和主要任务 | 本单元主要讨论__________。学生需要认识、理解或解决__________。反复出现的核心概念包括__________。最重要的学习任务或能力动作包括__________。 |\n| 二、找课程目标 | 从核心素养读到子维度，再读到对应学段的具体表现 | 本单元主要指向__________核心素养中的__________表现。之所以这样判断，是因为教材安排了__________任务，学生需要完成__________行为。 |\n| 三、找课程内容 | 按本学科目录进入正确位置，连读内容要求、学业要求和教学提示 | 课标要求学生学习__________。学生大致需要做到__________。课标建议学生通过__________类型的活动形成这种表现。 |\n| 四、找课程学业评价 | 读学业质量，只摘与本单元直接相关的综合表现 | 本学段最终要求学生在__________情境中综合运用__________。本单元能够为其中__________这一表现打基础。 |\n| 五、概括总结 | 把前四步合成一段单元方向 | 本单元在____学段主要指向____核心素养中的____具体表现。围绕____内容，学生主要学习____，需要达到____，并通过____等活动逐步形成____。 |\n\n第三行怎么进入，取决于你学科课标的结构类型。对照第四课的五类结构，先认类型，再按下表找到你这门学科的入口。\n\n| 结构类型 | 学科 | 优先定位路径 |\n| --- | --- | --- |\n| 主题＋学段 | 数学 | 学段（小学或初中）→ 内容领域 → 主题 → 具体内容 |\n| 主题＋学段 | 道德与法治 | 学段 → 主题 |\n| 学习任务群 | 语文 | 学习任务群 → 对应学段 |\n| 要素＋级别 | 英语 | 级别 → 主题 → 语篇 → 六要素 |\n| 学科观念统领 | 生物学 | 学习主题 → 学科大观念 → 内容要求、学业要求、教学提示 |\n| 学科观念统领 | 物理 | 一级主题 → 内容要求、学业要求、教学提示 |\n| 学科观念统领 | 化学 | 学习主题 → 内容要求、学业要求、教学提示 |\n| 学科观念统领 | 科学 | 学科核心概念 → 学段 → 内容要求、学业要求、教学提示 |\n| 板块递进 | 历史 | 历史板块 → 内容要求、学业要求、教学提示 |\n| 板块递进 | 地理 | 主题板块 → 内容要求、学业要求、教学提示 |\n\n### 怎么使用这张表\n\n三条使用规则。\n\n**第一，从上往下填，顺序不要颠倒。**第一行只看教材，后面四行才打开课标。概括在前，取证在后。先打开课标再回头找线索，很容易变成拿课标词语反套教材。\n\n**第二，每个空都要有出处。**第二行到第四行的每一个空，都要能说出它来自课标的哪个部分、哪个位置。某学科课标没有单列学业要求，就在对应位置注明**本课标未单列**，不要从别处拼一段文字来补齐。\n\n**第三，最后一行是结论。**前四行攒的是证据，第五行要把它们合成一句完整的单元方向。写完从上往下读一遍，结论里的每个关键词都能在上面几行找到出处，这张表才算填完。\n\n> **一表五步**　++单元概括、找课程目标、找课程内容、找课程学业评价、概括总结。每一空有出处，每一行可回溯。++\n\n按这张表填完，你手里的就不再是一堆划线，而是一份可以带进备课讨论的课标分析报告。","cards":[{"title":"课标分析报告表（五步 SOP）","content_markdown":"单元概括定对象 → 找课程目标定素养表现 → 找课程内容定学什么与怎么学 → 找课程学业评价定学段终点 → 概括总结合成单元方向。每一空有出处，最后一行落成一句可回溯的单元方向。"}],"pretest":[{"type_key":"single_choice","grading_mode_key":"auto","prompt_markdown":"以下哪项最能区分摘抄集合和分析报告？","rubric":null,"options":[{"key":"A","text":"摘录文字越多越好。","sort_order":10},{"key":"B","text":"表格填得越满越好。","sort_order":20},{"key":"C","text":"原文有出处，每条概括有依据，综合结论能由前面的证据推出。","sort_order":30},{"key":"D","text":"综合结论只需写落实核心素养。","sort_order":40}],"answer_key":{"correct":["C"]}}],"posttest":[{"type_key":"true_false","grading_mode_key":"auto","prompt_markdown":"某学科课标没有单独设置学业要求，可以从其他位置找一段文字补齐这一行。","rubric":null,"options":[{"key":"T","text":"正确","sort_order":10},{"key":"F","text":"错误","sort_order":20}],"answer_key":{"correct":["F"]}},{"type_key":"open_task","grading_mode_key":"manual","prompt_markdown":"用报告表完成自己教材单元的课标分析，并为第二至四行的每条概括标注课标出处，格式为章节路径或页码。","rubric":{"criteria":["五行齐全、顺序正确、每一空可回溯到课标位置，即达标。"]},"options":[],"answer_key":null}]},{"id":"9a110000-0000-4000-8001-000000000006","slug":"standard-analysis-06","title":"核心小结：把课标分析走成闭环","subtitle":"离开示例后，能否独立复述并执行五步闭环？","description":"离开示例后，能否独立复述并执行五步闭环？","lesson_type_key":"concept","duration_minutes":8,"credits":1,"sort_order":60,"is_trial":false,"challenge_title":"离开示例后，能否独立复述并执行五步闭环？","challenge_markdown":"在不查看前面课程的情况下，补全**单元概括、找课程目标、找课程内容、找课程学业评价、概括总结**的闭环，并用它快速分析评价一份自己写的课标分析报告。","objectives":[{"id":"l6-o1","text":"复述单元概括 → 找课程目标 → 找课程内容 → 找课程学业评价 → 概括总结的完整工作流"},{"id":"l6-o2","text":"用第五课的报告表回查自己的课标分析，确认每一空有出处"}],"success_criteria_markdown":"- 五步顺序正确；\n- 能说明**课程目标、课程内容、学业质量**三个部分在五步中各自的作用；\n- 能用一句话概括自己的单元方向。","takeaway_markdown":"### 课标分析五步闭环\n\n单元概括 → 找课程目标 → 找课程内容 → 找课程学业评价 → 概括总结。先单元、后单课。每一空有出处，结论必须可回溯，分析止步于上位方向，不越界替代后续设计。","body_markdown":"### 回到本单元最初的问题\n\n现在，请暂时放下前面五节课中的案例，回到你最初可能遇到的那个问题。面对一份课标和一个教材单元，我到底应该从哪里开始，又应该得到什么结果？如果你能够独立回答这个问题，课标分析的方法才真正属于你。\n\n### 第一步，单元概括\n\n整个过程的起点不是搜索，而是单元概括。你先阅读教材目录、单元导语和主要任务，把一个单元压缩成主题与核心要素。这样做，是因为课标通常以学段、领域、主题或任务群规定一段学习的发展方向，而不是为每一个课题准备同名句子。先单元、后单课，是我们进入课标时最重要的尺度意识。\n\n### 第二步，找课程目标\n\n带着主题和核心要素进入课程目标。这里最容易犯的错误，是停在宏观的核心素养名称上。要继续往下读，读到子维度，再读到本学段的具体表现，然后只保留教材真实能承载的那部分。课程目标给的是方向和终点，不是让你抄一遍素养清单。\n\n### 第三步，找课程内容\n\n接下来进入课程内容，判断主要教什么、学到什么程度、怎样学。这一步必须顺着本学科真实的目录结构查找，先看清这门课标按什么组织内容，再进入正确位置，连读内容要求、学业要求和教学提示。定位完，教什么、学到什么程度、怎样学，三个答案都要落到课标原文上。\n\n### 第四步，找课程学业评价\n\n然后打开学业质量。它呈现学段结束时的综合表现，不是给这个单元写的，而是站在远处给你看终点。用它检查两件事。单元方向是不是只剩知识点、定得太浅，或者反过来定得太大、一个单元扛起了整个学段。学业质量的作用是校准，让目标、内容和大方向保持一致。\n\n### 第五步，概括总结\n\n最后，把前四步的所得合成一段单元方向，写进第五课的报告表。写完后再反向检查一遍，结论里的每个关键词都要能说出来自课标哪个部分，别人能沿你记录的章节路径回到原文。能够完成这次回查，报告才真正闭环。\n\n> **本单元方法链**　++单元概括 → 找课程目标 → 找课程内容 → 找课程学业评价 → 概括总结。先单元、后单课，每一步都留下可回溯的出处。++\n\n确定单元方向之后，我们才回到教材内部，判断不同单课分别承担铺垫、形成、深化还是应用的作用，而不是让每一课重复承担整个单元的全部要求。\n\n### 记住课标分析的边界\n\n还要记住本单元的边界。课标分析可以告诉你课程为什么这样要求、这个单元应当指向哪里、教材中什么值得重点关注，却不能直接替你决定某一种教学流程，也不能替代教材分析、学情分析、目标撰写、活动设计和评价设计。你现在完成的是后续设计的上位依据，而不是整份教案。\n\n接下来，请重新打开你在第五课完成的报告，用一分钟说出自己的单元方向。如果你不仅能说出结论，还能解释自己为什么走这条目录路径、为什么保留这些依据、每个判断怎样得到课标原文支持，那么你已经完成了从**读过课标**到**会用课标判断**的转变。","cards":[{"title":"课标分析五步闭环","content_markdown":"单元概括 → 找课程目标 → 找课程内容 → 找课程学业评价 → 概括总结。先单元、后单课。每一空有出处，结论必须可回溯，分析止步于上位方向，不越界替代后续设计。"}],"pretest":[{"type_key":"short_answer","grading_mode_key":"manual","prompt_markdown":"请凭记忆补全这条工作链。单元概括 → ________ → ________ → ________ → 概括总结。","rubric":null,"options":[],"answer_key":null}],"posttest":[{"type_key":"single_choice","grading_mode_key":"auto","prompt_markdown":"以下哪份产出已经完成本单元要求？","rubric":null,"options":[{"key":"A","text":"一份摘录全部核心素养的文档","sort_order":10},{"key":"B","text":"一份五步齐全、每一空有出处、结论可回溯到证据的单元课标分析报告","sort_order":20},{"key":"C","text":"一份直接由课标生成的课堂活动流程","sort_order":30},{"key":"D","text":"一张教材知识点清单","sort_order":40}],"answer_key":{"correct":["B"]}},{"type_key":"open_task","grading_mode_key":"manual","prompt_markdown":"用本单元在本学段主要指向……围绕……帮助学生在……条件下达到……表现这个句式概括自己的单元方向。","rubric":{"criteria":["方向、内容、条件、程度四部分至少三项清楚，且能回到前面课标证据，即达标。"]},"options":[],"answer_key":null}]}]'::jsonb) loop
    lesson_id := (lesson_value ->> 'id')::uuid;

    insert into public.v2_course_lessons (
      id, unit_id, slug, title, subtitle, description, lesson_type_id, duration_minutes, credits,
      sort_order, membership_type, is_trial, status, published_at, challenge_title, challenge_markdown,
      objectives, success_criteria_markdown, takeaway_markdown, body_markdown
    ) values (
      lesson_id,
      '9a110000-0000-4000-8000-000000000010',
      lesson_value ->> 'slug',
      lesson_value ->> 'title',
      lesson_value ->> 'subtitle',
      lesson_value ->> 'description',
      (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'lesson_type' and items.key = lesson_value ->> 'lesson_type_key' limit 1),
      (lesson_value ->> 'duration_minutes')::integer,
      (lesson_value ->> 'credits')::numeric,
      (lesson_value ->> 'sort_order')::integer,
      'plus',
      (lesson_value ->> 'is_trial')::boolean,
      'published',
      now(),
      lesson_value ->> 'challenge_title',
      lesson_value ->> 'challenge_markdown',
      lesson_value -> 'objectives',
      lesson_value ->> 'success_criteria_markdown',
      lesson_value ->> 'takeaway_markdown',
      lesson_value ->> 'body_markdown'
    )
    on conflict (id) do update set
      unit_id = excluded.unit_id,
      slug = excluded.slug,
      title = excluded.title,
      subtitle = excluded.subtitle,
      description = excluded.description,
      lesson_type_id = excluded.lesson_type_id,
      duration_minutes = excluded.duration_minutes,
      credits = excluded.credits,
      sort_order = excluded.sort_order,
      membership_type = excluded.membership_type,
      is_trial = excluded.is_trial,
      status = excluded.status,
      published_at = coalesce(public.v2_course_lessons.published_at, excluded.published_at),
      challenge_title = excluded.challenge_title,
      challenge_markdown = excluded.challenge_markdown,
      objectives = excluded.objectives,
      success_criteria_markdown = excluded.success_criteria_markdown,
      takeaway_markdown = excluded.takeaway_markdown,
      body_markdown = excluded.body_markdown,
      updated_at = now();

    card_index := 0;
    for card_value in select value from jsonb_array_elements(lesson_value -> 'cards') loop
      card_index := card_index + 1;
      if card_index = 1 then
        first_card_id := ('9a110000-0000-4000-8002-' || lpad(((lesson_value ->> 'sort_order')::integer / 10)::text, 12, '0'))::uuid;
        insert into public.v2_lesson_knowledge_cards (id, lesson_id, card_type_id, title, content_markdown, sort_order, is_active)
        values (
          first_card_id,
          lesson_id,
          (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'knowledge_card_type' and items.key = 'concept' limit 1),
          card_value ->> 'title',
          card_value ->> 'content_markdown',
          card_index * 10,
          true
        )
        on conflict (id) do update set
          lesson_id = excluded.lesson_id,
          card_type_id = excluded.card_type_id,
          title = excluded.title,
          content_markdown = excluded.content_markdown,
          sort_order = excluded.sort_order,
          is_active = excluded.is_active,
          updated_at = now();
      else
        insert into public.v2_lesson_knowledge_cards (lesson_id, card_type_id, title, content_markdown, sort_order, is_active)
        values (
          lesson_id,
          (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'knowledge_card_type' and items.key = 'concept' limit 1),
          card_value ->> 'title',
          card_value ->> 'content_markdown',
          card_index * 10,
          true
        );
      end if;
    end loop;

    assessment_index := 0;
    for assessment_value in
      select jsonb_build_object('type_key', 'pretest', 'title', '课前诊断', 'items', lesson_value -> 'pretest')
      union all
      select jsonb_build_object('type_key', 'posttest', 'title', '达标检测', 'items', lesson_value -> 'posttest')
    loop
      assessment_index := assessment_index + 1;
      insert into public.v2_assessment_blocks (
        lesson_id, unit_id, assessment_type_id, title, instructions_markdown,
        required, estimated_minutes, sort_order, status
      ) values (
        lesson_id,
        null,
        (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'assessment_type' and items.key = assessment_value ->> 'type_key' limit 1),
        assessment_value ->> 'title',
        case when assessment_value ->> 'type_key' = 'pretest' then '先凭已有经验作答，不影响完课。' else '完成正文后作答，检查本课目标是否达成。' end,
        true,
        case when assessment_value ->> 'type_key' = 'pretest' then 2 else 5 end,
        assessment_index * 10,
        'published'
      ) returning id into block_id;

      item_index := 0;
      for item_value in select value from jsonb_array_elements(assessment_value -> 'items') loop
        item_index := item_index + 1;
        insert into public.v2_assessment_items (
          assessment_block_id, item_type_id, grading_mode_id, prompt_markdown,
          max_score, rubric, sort_order, is_required
        ) values (
          block_id,
          (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'item_type' and items.key = item_value ->> 'type_key' limit 1),
          (select items.id from public.v2_dictionary_items items join public.v2_dictionary_groups groups on groups.id = items.group_id where groups.key = 'grading_mode' and items.key = item_value ->> 'grading_mode_key' limit 1),
          item_value ->> 'prompt_markdown',
          1,
          item_value -> 'rubric',
          item_index * 10,
          true
        ) returning id into item_id;

        for option_value in select value from jsonb_array_elements(item_value -> 'options') loop
          insert into public.v2_assessment_options (item_id, option_key, option_text, sort_order)
          values (item_id, option_value ->> 'key', option_value ->> 'text', (option_value ->> 'sort_order')::integer);
        end loop;

        if item_value -> 'answer_key' is not null and jsonb_typeof(item_value -> 'answer_key') = 'object' then
          insert into private.v2_assessment_keys (item_id, answer_key, scoring_config)
          values (item_id, item_value -> 'answer_key', '{"points_per_correct":1}'::jsonb);
        end if;
      end loop;
    end loop;
  end loop;
end;
$seed$;
-- END GENERATED STANDARD ANALYSIS DATA

commit;
