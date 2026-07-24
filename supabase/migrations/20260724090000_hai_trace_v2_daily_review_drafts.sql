begin;

-- Daily review now produces an immutable, separately reviewable Chat Skill
-- draft. Historical prompt-publishing columns remain readable, but new runs
-- link the exact published baseline and candidate version directly.
alter table public.hai_optimization_log
  add column if not exists baseline_skill_version_id uuid
    references public.hai_chat_skill_versions(id) on delete restrict,
  add column if not exists candidate_skill_version_id uuid
    references public.hai_chat_skill_versions(id) on delete restrict,
  add column if not exists candidate_comparison jsonb not null default '{}'::jsonb;

create unique index if not exists hai_optimization_log_candidate_version_unique
  on public.hai_optimization_log (candidate_skill_version_id)
  where candidate_skill_version_id is not null;

alter table public.hai_optimization_log
  drop constraint if exists hai_optimization_log_publish_mode_check;
alter table public.hai_optimization_log
  add constraint hai_optimization_log_publish_mode_check
  check (
    publish_mode in (
      'none',
      'draft',
      -- Historical values remain valid for already-recorded runs only.
      'pending',
      'gated_auto',
      'manual',
      'rolled_back'
    )
  );

comment on column public.hai_optimization_log.baseline_skill_version_id is
  'The published Chat Skill snapshot evaluated by this daily review.';
comment on column public.hai_optimization_log.candidate_skill_version_id is
  'A separate draft cloned atomically from the baseline; never an in-place published edit.';
comment on column public.hai_optimization_log.candidate_comparison is
  'Per-case baseline/candidate answers, evaluations, and aggregate comparison.';

delete from public.hai_runtime_settings
where key in (
  'daily_review.auto_publish_mode',
  'daily_review.min_turns_for_publish',
  'daily_review.min_ab_improvement'
);

create or replace function public.hai_create_chat_skill_review_draft(
  p_run_date date,
  p_expected_baseline_version_id uuid,
  p_file_changes jsonb,
  p_comparison jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
  v_existing_candidate_id uuid;
  v_baseline public.hai_chat_skill_versions%rowtype;
  v_candidate_id uuid;
  v_version_label text;
  v_change jsonb;
  v_target_path text;
  v_proposed_content text;
  v_change_count integer;
  v_distinct_path_count integer;
begin
  if not (
    coalesce(auth.role() = 'service_role', false)
    or coalesce(public.is_admin(), false)
  ) then
    raise exception '仅每日复盘服务或管理员可以创建 Chat Skill 复盘草稿。';
  end if;

  if jsonb_typeof(coalesce(p_file_changes, '[]'::jsonb)) <> 'array' then
    raise exception 'file_changes 必须是 JSON 数组。';
  end if;
  if jsonb_typeof(coalesce(p_comparison, '{}'::jsonb)) <> 'object' then
    raise exception 'comparison 必须是 JSON 对象。';
  end if;

  select id, candidate_skill_version_id
  into v_log_id, v_existing_candidate_id
  from public.hai_optimization_log
  where run_date = p_run_date
  for update;
  if v_log_id is null then
    raise exception '复盘日志 % 不存在，不能创建草稿。', p_run_date;
  end if;

  -- Idempotency is anchored to one optimization-log row per Shanghai date.
  -- Returning the existing candidate never edits it, regardless of whether an
  -- administrator has since changed or published that candidate.
  if v_existing_candidate_id is not null then
    return jsonb_build_object(
      'created', false,
      'baseline_skill_version_id', (
        select baseline_skill_version_id
        from public.hai_optimization_log
        where id = v_log_id
      ),
      'candidate_skill_version_id', v_existing_candidate_id
    );
  end if;

  select *
  into v_baseline
  from public.hai_chat_skill_versions
  where id = p_expected_baseline_version_id
    and status = 'published'
  for share;
  if v_baseline.id is null then
    raise exception '预期的 Chat Skill 基线不是当前已发布快照。';
  end if;

  if not exists (
    select 1
    from public.hai_feature_modules module
    join public.hai_chat_skill_bindings binding
      on binding.module_id = module.id
    where module.slug = 'ask-han'
      and module.is_enabled = true
      and binding.is_enabled = true
      and binding.skill_id = v_baseline.skill_id
  ) then
    raise exception '预期基线未绑定到启用的 ask-han 模块。';
  end if;

  select count(*), count(distinct value->>'target_path')
  into v_change_count, v_distinct_path_count
  from jsonb_array_elements(coalesce(p_file_changes, '[]'::jsonb));
  if v_change_count < 1 or v_change_count > 2 then
    raise exception '一次复盘必须包含 1 到 2 个文件级候选。';
  end if;
  if v_change_count <> v_distinct_path_count then
    raise exception '同一文件在一次复盘中只能修改一次。';
  end if;

  for v_change in
    select value
    from jsonb_array_elements(p_file_changes)
  loop
    v_target_path := btrim(coalesce(v_change->>'target_path', ''));
    v_proposed_content := coalesce(v_change->>'proposed_content', '');
    if v_target_path <> 'SKILL.md'
      and not exists (
        select 1
        from public.hai_chat_skill_references reference
        where reference.skill_version_id = v_baseline.id
          and reference.path = v_target_path
      ) then
      raise exception '候选文件不存在于已发布基线：%', v_target_path;
    end if;
    if btrim(v_proposed_content) = '' then
      raise exception '候选文件 % 不能为空。', v_target_path;
    end if;
    if length(v_proposed_content) > 200000 then
      raise exception '候选文件 % 超过 20 万字符。', v_target_path;
    end if;
  end loop;

  v_version_label := concat(
    'review-',
    to_char(p_run_date, 'YYYYMMDD'),
    '-',
    left(replace(v_log_id::text, '-', ''), 8)
  );

  insert into public.hai_chat_skill_versions (
    skill_id,
    version_label,
    status,
    instructions,
    default_instructions,
    reference_config,
    created_by
  ) values (
    v_baseline.skill_id,
    v_version_label,
    'draft',
    coalesce(
      (
        select value->>'proposed_content'
        from jsonb_array_elements(p_file_changes)
        where value->>'target_path' = 'SKILL.md'
        limit 1
      ),
      v_baseline.instructions
    ),
    v_baseline.default_instructions,
    v_baseline.reference_config,
    case when auth.role() = 'service_role' then null else auth.uid() end
  )
  returning id into v_candidate_id;

  insert into public.hai_chat_skill_references (
    skill_version_id,
    path,
    name,
    description,
    media_type,
    content,
    content_hash,
    load_mode,
    max_chars,
    sort_order,
    metadata
  )
  select
    v_candidate_id,
    reference.path,
    reference.name,
    reference.description,
    reference.media_type,
    coalesce(change.proposed_content, reference.content),
    md5(coalesce(change.proposed_content, reference.content)),
    reference.load_mode,
    reference.max_chars,
    reference.sort_order,
    reference.metadata
  from public.hai_chat_skill_references reference
  left join lateral (
    select value->>'proposed_content' as proposed_content
    from jsonb_array_elements(p_file_changes)
    where value->>'target_path' = reference.path
    limit 1
  ) change on true
  where reference.skill_version_id = v_baseline.id;

  update public.hai_optimization_log
  set baseline_skill_version_id = v_baseline.id,
      candidate_skill_version_id = v_candidate_id,
      candidate_changes = p_file_changes,
      candidate_comparison = coalesce(p_comparison, '{}'::jsonb),
      publish_mode = 'draft',
      status = 'completed',
      completed_at = now(),
      note = '已生成独立 Chat Skill 复盘草稿；已发布快照未改动，必须人工审查后发布。'
  where id = v_log_id;

  return jsonb_build_object(
    'created', true,
    'baseline_skill_version_id', v_baseline.id,
    'candidate_skill_version_id', v_candidate_id
  );
end;
$$;

revoke all on function public.hai_create_chat_skill_review_draft(
  date, uuid, jsonb, jsonb
) from public, anon;
grant execute on function public.hai_create_chat_skill_review_draft(
  date, uuid, jsonb, jsonb
) to authenticated, service_role;

commit;
