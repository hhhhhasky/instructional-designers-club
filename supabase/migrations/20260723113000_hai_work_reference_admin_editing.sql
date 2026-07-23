begin;

-- Work Skill references are edited only inside a draft version. Saving the
-- prompt, contracts and references through one RPC prevents partial snapshots.
create or replace function public.hai_replace_work_skill_references(
  p_version_id uuid,
  p_references jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_reference jsonb;
  v_path text;
  v_content text;
  v_load_mode text;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception '仅管理员可以编辑 Work Skill reference。';
  end if;

  select status into v_status
  from public.hai_work_skill_versions
  where id = p_version_id;
  if v_status is null then raise exception 'Work Skill 版本不存在。'; end if;
  if v_status <> 'draft' then
    raise exception '已发布或已归档版本只读，请先复制为草稿版本。';
  end if;
  if jsonb_typeof(coalesce(p_references, '[]'::jsonb)) <> 'array' then
    raise exception 'references 必须是 JSON 数组。';
  end if;
  if jsonb_array_length(coalesce(p_references, '[]'::jsonb)) > 64 then
    raise exception '单个 Work Skill 版本最多保存 64 个 reference 文件。';
  end if;
  if coalesce((
    select sum(length(coalesce(value->>'content', '')))
    from jsonb_array_elements(coalesce(p_references, '[]'::jsonb))
  ), 0) > 1000000 then
    raise exception '单个 Work Skill 版本的 reference 总内容不能超过 100 万字符。';
  end if;

  delete from public.hai_work_skill_references
  where skill_version_id = p_version_id;

  for v_reference in
    select value from jsonb_array_elements(coalesce(p_references, '[]'::jsonb))
  loop
    v_path := btrim(coalesce(v_reference->>'path', ''));
    v_content := coalesce(v_reference->>'content', '');
    v_load_mode := coalesce(nullif(btrim(v_reference->>'load_mode'), ''), 'always');
    if v_path = '' or v_path !~ '^references/[^[:cntrl:]\\]+$'
      or position('..' in v_path) > 0 then
      raise exception 'reference 路径不合法：%', v_path;
    end if;
    if length(v_content) > 200000 then
      raise exception 'reference 文件 % 超过 20 万字符。', v_path;
    end if;
    if v_load_mode not in ('always', 'case', 'issue', 'task', 'evaluation_only') then
      raise exception 'reference % 的加载策略不合法：%', v_path, v_load_mode;
    end if;

    insert into public.hai_work_skill_references (
      skill_version_id, path, name, description, media_type, content,
      content_hash, load_mode, max_chars, sort_order, metadata
    ) values (
      p_version_id,
      v_path,
      coalesce(nullif(btrim(v_reference->>'name'), ''),
        regexp_replace(v_path, '^.*/', '')),
      coalesce(v_reference->>'description', ''),
      coalesce(nullif(btrim(v_reference->>'media_type'), ''), 'text/markdown'),
      v_content,
      encode(extensions.digest(v_content, 'sha256'), 'hex'),
      v_load_mode,
      greatest(1, least(coalesce((v_reference->>'max_chars')::integer, 24000), 50000)),
      coalesce((v_reference->>'sort_order')::integer, 0),
      case when jsonb_typeof(v_reference->'metadata') = 'object'
        then v_reference->'metadata' else '{}'::jsonb end
    );
  end loop;
end;
$$;

revoke all on function public.hai_replace_work_skill_references(uuid, jsonb)
  from public, anon;
grant execute on function public.hai_replace_work_skill_references(uuid, jsonb)
  to authenticated;

create or replace function public.hai_save_work_skill_draft_snapshot(
  p_version_id uuid,
  p_version_label text,
  p_instructions text,
  p_input_contract jsonb,
  p_output_contract jsonb,
  p_references jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception '仅管理员可以保存 Work Skill 草稿。';
  end if;
  select status into v_status
  from public.hai_work_skill_versions
  where id = p_version_id;
  if v_status is null then raise exception 'Work Skill 版本不存在。'; end if;
  if v_status <> 'draft' then
    raise exception '已发布或已归档版本只读，请先复制为草稿版本。';
  end if;
  if nullif(btrim(p_version_label), '') is null then
    raise exception '版本标签不能为空。';
  end if;
  if nullif(btrim(p_instructions), '') is null then
    raise exception 'Skill 指令不能为空。';
  end if;
  if jsonb_typeof(coalesce(p_input_contract, '{}'::jsonb)) <> 'object'
    or jsonb_typeof(coalesce(p_output_contract, '{}'::jsonb)) <> 'object' then
    raise exception '输入与输出契约必须是 JSON 对象。';
  end if;

  update public.hai_work_skill_versions
  set version_label = btrim(p_version_label),
      prompt_template = p_instructions,
      input_contract = coalesce(p_input_contract, '{}'::jsonb),
      output_contract = coalesce(p_output_contract, '{}'::jsonb),
      snapshot_hash = '',
      source_metadata = coalesce(source_metadata, '{}'::jsonb) - 'reference_manifest',
      updated_at = now()
  where id = p_version_id;

  perform public.hai_replace_work_skill_references(p_version_id, p_references);
end;
$$;

revoke all on function public.hai_save_work_skill_draft_snapshot(
  uuid, text, text, jsonb, jsonb, jsonb
) from public, anon;
grant execute on function public.hai_save_work_skill_draft_snapshot(
  uuid, text, text, jsonb, jsonb, jsonb
) to authenticated;

create or replace function public.hai_clone_work_skill_version(
  p_skill_id uuid,
  p_version_label text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.hai_work_skill_versions%rowtype;
  v_version_id uuid;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception '仅管理员可以复制 Work Skill 版本。';
  end if;
  if nullif(btrim(p_version_label), '') is null then
    raise exception '版本标签不能为空。';
  end if;

  select * into v_source
  from public.hai_work_skill_versions
  where skill_id = p_skill_id
  order by case status when 'published' then 0 when 'draft' then 1 else 2 end,
    created_at desc
  limit 1;
  if v_source.id is null then raise exception '没有可复制的 Work Skill 版本。'; end if;

  insert into public.hai_work_skill_versions (
    skill_id, version_label, status, prompt_template, default_prompt_template,
    input_contract, output_contract, snapshot_hash, source_metadata, created_by
  ) values (
    p_skill_id, btrim(p_version_label), 'draft', v_source.prompt_template,
    v_source.default_prompt_template, v_source.input_contract,
    v_source.output_contract, '',
    jsonb_build_object('cloned_from_version_id', v_source.id), auth.uid()
  ) returning id into v_version_id;

  insert into public.hai_work_skill_references (
    skill_version_id, path, name, description, media_type, content,
    content_hash, load_mode, max_chars, sort_order, metadata
  )
  select
    v_version_id, path, name, description, media_type, content,
    content_hash, load_mode, max_chars, sort_order, metadata
  from public.hai_work_skill_references
  where skill_version_id = v_source.id
  order by sort_order, path;

  return v_version_id;
end;
$$;

revoke all on function public.hai_clone_work_skill_version(uuid, text)
  from public, anon;
grant execute on function public.hai_clone_work_skill_version(uuid, text)
  to authenticated;

create or replace function public.hai_publish_work_skill_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_skill_id uuid;
  v_module_slug text;
  v_status text;
  v_prompt text;
  v_input_contract jsonb;
  v_output_contract jsonb;
  v_manifest jsonb;
  v_reference_fingerprint text;
  v_reference_count integer;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception '仅管理员可以发布 Work Skill。';
  end if;
  select version.skill_id, skill.module_slug, version.status,
    version.prompt_template, version.input_contract, version.output_contract
  into v_skill_id, v_module_slug, v_status, v_prompt,
    v_input_contract, v_output_contract
  from public.hai_work_skill_versions version
  join public.hai_work_skills skill on skill.id = version.skill_id
  where version.id = p_version_id;
  if v_skill_id is null then raise exception 'Work Skill 版本不存在。'; end if;
  if v_status <> 'draft' then raise exception '只有草稿版本可以发布。'; end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'path', path,
      'name', name,
      'description', description,
      'media_type', media_type,
      'content_hash', content_hash,
      'content_chars', length(content),
      'load_mode', load_mode,
      'max_chars', max_chars,
      'sort_order', sort_order,
      'metadata', metadata
    ) order by sort_order, path), '[]'::jsonb),
    coalesce(string_agg(concat_ws(':',
      path, content_hash, load_mode, max_chars::text, sort_order::text,
      media_type, md5(name || E'\n' || description || E'\n' || metadata::text)
    ), E'\n' order by sort_order, path), ''),
    count(*)::integer
  into v_manifest, v_reference_fingerprint, v_reference_count
  from public.hai_work_skill_references
  where skill_version_id = p_version_id;

  if v_output_contract->>'format' = 'sizheng_public_lesson_v2' and (
    v_reference_count < 6
    or not exists (select 1 from public.hai_work_skill_references where skill_version_id = p_version_id and path = 'references/mode-selection.md')
    or not exists (select 1 from public.hai_work_skill_references where skill_version_id = p_version_id and path = 'references/carrier-selection.md')
    or not exists (select 1 from public.hai_work_skill_references where skill_version_id = p_version_id and path = 'references/output-template.md')
    or not exists (select 1 from public.hai_work_skill_references where skill_version_id = p_version_id and path = 'references/case-mode-v3.md' and load_mode = 'case')
    or not exists (select 1 from public.hai_work_skill_references where skill_version_id = p_version_id and path = 'references/issue-mode-v3.md' and load_mode = 'issue')
    or not exists (select 1 from public.hai_work_skill_references where skill_version_id = p_version_id and path = 'references/task-mode-v3.md' and load_mode = 'task')
  ) then
    raise exception '思政公开课 v2 发布前必须保留公共资料、输出模板及案例/议题/任务三套模式 reference。';
  end if;

  update public.hai_work_skill_versions
  set snapshot_hash = encode(extensions.digest(
        v_prompt || E'\n--input-contract--\n' || v_input_contract::text ||
        E'\n--output-contract--\n' || v_output_contract::text ||
        E'\n--references--\n' || v_reference_fingerprint,
        'sha256'
      ), 'hex'),
      source_metadata = coalesce(source_metadata, '{}'::jsonb) ||
        jsonb_build_object(
          'runtime_reference_count', v_reference_count,
          'reference_manifest', v_manifest,
          'edited_in_admin', true
        ),
      updated_at = now()
  where id = p_version_id;

  update public.hai_work_skill_versions
  set status = 'archived', updated_at = now()
  where skill_id = v_skill_id and status = 'published' and id <> p_version_id;

  update public.hai_work_skill_versions
  set status = 'published', published_at = now(), updated_at = now()
  where id = p_version_id;

  perform public.hai_recompute_work_module_enabled(v_module_slug);
end;
$$;

grant execute on function public.hai_publish_work_skill_version(uuid)
  to authenticated;

commit;
