-- V2 policy consolidation
-- 将管理员的 FOR ALL 策略拆成单一 SELECT + 写策略，避免同一角色同一动作的
-- 多条 permissive policy 被逐行重复评估；不改变 V2 的授权边界。

begin;

drop policy if exists v2_dictionary_groups_manager on public.v2_dictionary_groups;
drop policy if exists v2_dictionary_groups_read_active on public.v2_dictionary_groups;
create policy v2_dictionary_groups_select on public.v2_dictionary_groups for select to authenticated
  using (private.v2_can_manage() or is_active);
create policy v2_dictionary_groups_insert on public.v2_dictionary_groups for insert to authenticated
  with check (private.v2_can_manage());
create policy v2_dictionary_groups_update on public.v2_dictionary_groups for update to authenticated
  using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_dictionary_groups_delete on public.v2_dictionary_groups for delete to authenticated
  using (private.v2_can_manage());

drop policy if exists v2_dictionary_items_manager on public.v2_dictionary_items;
drop policy if exists v2_dictionary_items_read_active on public.v2_dictionary_items;
create policy v2_dictionary_items_select on public.v2_dictionary_items for select to authenticated
  using (private.v2_can_manage() or (is_active and exists (
    select 1 from public.v2_dictionary_groups g where g.id = group_id and g.is_active
  )));
create policy v2_dictionary_items_insert on public.v2_dictionary_items for insert to authenticated
  with check (private.v2_can_manage());
create policy v2_dictionary_items_update on public.v2_dictionary_items for update to authenticated
  using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_dictionary_items_delete on public.v2_dictionary_items for delete to authenticated
  using (private.v2_can_manage());

drop policy if exists v2_modules_manager on public.v2_course_modules;
drop policy if exists v2_modules_read_published on public.v2_course_modules;
create policy v2_modules_select on public.v2_course_modules for select to authenticated
  using (private.v2_can_manage() or private.v2_can_access_module(id));
create policy v2_modules_insert on public.v2_course_modules for insert to authenticated
  with check (private.v2_can_manage());
create policy v2_modules_update on public.v2_course_modules for update to authenticated
  using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_modules_delete on public.v2_course_modules for delete to authenticated
  using (private.v2_can_manage());

drop policy if exists v2_units_manager on public.v2_course_units;
drop policy if exists v2_units_read_published on public.v2_course_units;
create policy v2_units_select on public.v2_course_units for select to authenticated
  using (private.v2_can_manage() or private.v2_can_access_unit(id));
create policy v2_units_insert on public.v2_course_units for insert to authenticated
  with check (private.v2_can_manage());
create policy v2_units_update on public.v2_course_units for update to authenticated
  using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_units_delete on public.v2_course_units for delete to authenticated
  using (private.v2_can_manage());

drop policy if exists v2_lessons_manager on public.v2_course_lessons;
drop policy if exists v2_lessons_read_published on public.v2_course_lessons;
create policy v2_lessons_select on public.v2_course_lessons for select to authenticated
  using (private.v2_can_manage() or private.v2_can_access_lesson(id));
create policy v2_lessons_insert on public.v2_course_lessons for insert to authenticated
  with check (private.v2_can_manage());
create policy v2_lessons_update on public.v2_course_lessons for update to authenticated
  using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_lessons_delete on public.v2_course_lessons for delete to authenticated
  using (private.v2_can_manage());

drop policy if exists v2_resources_manager on public.v2_lesson_resources;
drop policy if exists v2_resources_read_published on public.v2_lesson_resources;
create policy v2_resources_select on public.v2_lesson_resources for select to authenticated
  using (private.v2_can_manage() or private.v2_can_access_lesson(lesson_id));
create policy v2_resources_insert on public.v2_lesson_resources for insert to authenticated
  with check (private.v2_can_manage());
create policy v2_resources_update on public.v2_lesson_resources for update to authenticated
  using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_resources_delete on public.v2_lesson_resources for delete to authenticated
  using (private.v2_can_manage());

drop policy if exists v2_cards_manager on public.v2_lesson_knowledge_cards;
drop policy if exists v2_cards_read_published on public.v2_lesson_knowledge_cards;
create policy v2_cards_select on public.v2_lesson_knowledge_cards for select to authenticated
  using (private.v2_can_manage() or (is_active and private.v2_can_access_lesson(lesson_id)));
create policy v2_cards_insert on public.v2_lesson_knowledge_cards for insert to authenticated
  with check (private.v2_can_manage());
create policy v2_cards_update on public.v2_lesson_knowledge_cards for update to authenticated
  using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_cards_delete on public.v2_lesson_knowledge_cards for delete to authenticated
  using (private.v2_can_manage());

drop policy if exists v2_blocks_manager on public.v2_assessment_blocks;
drop policy if exists v2_blocks_read_published on public.v2_assessment_blocks;
create policy v2_blocks_select on public.v2_assessment_blocks for select to authenticated
  using (private.v2_can_manage() or private.v2_can_access_block(id));
create policy v2_blocks_insert on public.v2_assessment_blocks for insert to authenticated
  with check (private.v2_can_manage());
create policy v2_blocks_update on public.v2_assessment_blocks for update to authenticated
  using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_blocks_delete on public.v2_assessment_blocks for delete to authenticated
  using (private.v2_can_manage());

drop policy if exists v2_items_manager on public.v2_assessment_items;
drop policy if exists v2_items_read_published on public.v2_assessment_items;
create policy v2_items_select on public.v2_assessment_items for select to authenticated
  using (private.v2_can_manage() or private.v2_can_access_block(assessment_block_id));
create policy v2_items_insert on public.v2_assessment_items for insert to authenticated
  with check (private.v2_can_manage());
create policy v2_items_update on public.v2_assessment_items for update to authenticated
  using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_items_delete on public.v2_assessment_items for delete to authenticated
  using (private.v2_can_manage());

drop policy if exists v2_options_manager on public.v2_assessment_options;
drop policy if exists v2_options_read_published on public.v2_assessment_options;
create policy v2_options_select on public.v2_assessment_options for select to authenticated
  using (private.v2_can_manage() or exists (
    select 1 from public.v2_assessment_items i
    where i.id = item_id and private.v2_can_access_block(i.assessment_block_id)
  ));
create policy v2_options_insert on public.v2_assessment_options for insert to authenticated
  with check (private.v2_can_manage());
create policy v2_options_update on public.v2_assessment_options for update to authenticated
  using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_options_delete on public.v2_assessment_options for delete to authenticated
  using (private.v2_can_manage());

drop policy if exists v2_attempts_manager on public.v2_submission_attempts;
drop policy if exists v2_attempts_read_own on public.v2_submission_attempts;
drop policy if exists v2_attempts_insert_own on public.v2_submission_attempts;
drop policy if exists v2_attempts_update_own on public.v2_submission_attempts;
create policy v2_attempts_select on public.v2_submission_attempts for select to authenticated
  using (private.v2_can_manage() or user_id = (select auth.uid()));
create policy v2_attempts_insert on public.v2_submission_attempts for insert to authenticated
  with check (private.v2_can_manage() or (user_id = (select auth.uid()) and private.v2_can_access_block(assessment_block_id)));
create policy v2_attempts_update on public.v2_submission_attempts for update to authenticated
  using (private.v2_can_manage() or (user_id = (select auth.uid()) and status in ('draft', 'revision_required')))
  with check (private.v2_can_manage() or user_id = (select auth.uid()));
create policy v2_attempts_delete on public.v2_submission_attempts for delete to authenticated
  using (private.v2_can_manage());

drop policy if exists v2_answers_manager on public.v2_submission_answers;
drop policy if exists v2_answers_read_own on public.v2_submission_answers;
drop policy if exists v2_answers_write_own on public.v2_submission_answers;
drop policy if exists v2_answers_update_own on public.v2_submission_answers;
create policy v2_answers_select on public.v2_submission_answers for select to authenticated
  using (private.v2_can_manage() or exists (
    select 1 from public.v2_submission_attempts a where a.id = attempt_id and a.user_id = (select auth.uid())
  ));
create policy v2_answers_insert on public.v2_submission_answers for insert to authenticated
  with check (private.v2_can_manage() or exists (
    select 1 from public.v2_submission_attempts a where a.id = attempt_id and a.user_id = (select auth.uid()) and a.status in ('draft', 'revision_required')
  ));
create policy v2_answers_update on public.v2_submission_answers for update to authenticated
  using (private.v2_can_manage() or exists (
    select 1 from public.v2_submission_attempts a where a.id = attempt_id and a.user_id = (select auth.uid()) and a.status in ('draft', 'revision_required')
  ))
  with check (private.v2_can_manage() or exists (
    select 1 from public.v2_submission_attempts a where a.id = attempt_id and a.user_id = (select auth.uid())
  ));
create policy v2_answers_delete on public.v2_submission_answers for delete to authenticated
  using (private.v2_can_manage());

drop policy if exists v2_reviews_manager on public.v2_manual_reviews;
drop policy if exists v2_reviews_read_own on public.v2_manual_reviews;
create policy v2_reviews_select on public.v2_manual_reviews for select to authenticated
  using (private.v2_can_manage() or exists (
    select 1 from public.v2_submission_attempts a where a.id = attempt_id and a.user_id = (select auth.uid())
  ));
create policy v2_reviews_insert on public.v2_manual_reviews for insert to authenticated
  with check (private.v2_can_manage());
create policy v2_reviews_update on public.v2_manual_reviews for update to authenticated
  using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_reviews_delete on public.v2_manual_reviews for delete to authenticated
  using (private.v2_can_manage());

drop policy if exists v2_learning_records_manager on public.v2_learning_records;
drop policy if exists v2_learning_records_read_own on public.v2_learning_records;
drop policy if exists v2_learning_records_insert_own on public.v2_learning_records;
drop policy if exists v2_learning_records_update_own on public.v2_learning_records;
create policy v2_learning_records_select on public.v2_learning_records for select to authenticated
  using (private.v2_can_manage() or user_id = (select auth.uid()));
create policy v2_learning_records_insert on public.v2_learning_records for insert to authenticated
  with check (private.v2_can_manage() or (user_id = (select auth.uid()) and private.v2_can_access_lesson(lesson_id)));
create policy v2_learning_records_update on public.v2_learning_records for update to authenticated
  using (private.v2_can_manage() or user_id = (select auth.uid()))
  with check (private.v2_can_manage() or (user_id = (select auth.uid()) and private.v2_can_access_lesson(lesson_id)));
create policy v2_learning_records_delete on public.v2_learning_records for delete to authenticated
  using (private.v2_can_manage());

drop policy if exists v2_saved_cards_manager on public.v2_user_saved_cards;
drop policy if exists v2_saved_cards_own on public.v2_user_saved_cards;
create policy v2_saved_cards_all on public.v2_user_saved_cards for all to authenticated
  using (private.v2_can_manage() or user_id = (select auth.uid()))
  with check (private.v2_can_manage() or (user_id = (select auth.uid()) and exists (
    select 1 from public.v2_lesson_knowledge_cards c
    where c.id = knowledge_card_id and c.is_active and private.v2_can_access_lesson(c.lesson_id)
  )));

drop policy if exists v2_access_manager on public.v2_course_access;
drop policy if exists v2_access_read_own on public.v2_course_access;
create policy v2_access_select on public.v2_course_access for select to authenticated
  using (private.v2_can_manage() or user_id = (select auth.uid()));
create policy v2_access_insert on public.v2_course_access for insert to authenticated
  with check (private.v2_can_manage());
create policy v2_access_update on public.v2_course_access for update to authenticated
  using (private.v2_can_manage()) with check (private.v2_can_manage());
create policy v2_access_delete on public.v2_course_access for delete to authenticated
  using (private.v2_can_manage());

commit;
