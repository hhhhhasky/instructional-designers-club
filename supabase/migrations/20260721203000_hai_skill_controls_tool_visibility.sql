begin;

create or replace function public.hai_recompute_work_module_enabled(p_module_slug text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
begin
  select exists (
    select 1
    from public.hai_work_skills skill
    join public.hai_work_skill_versions version on version.skill_id = skill.id
    where skill.module_slug = p_module_slug
      and skill.is_enabled = true
      and version.status = 'published'
  ) into v_enabled;

  update public.hai_feature_modules
  set is_enabled = v_enabled, updated_at = now()
  where slug = p_module_slug
    and surface_mode = 'work';

  return v_enabled;
end;
$$;

revoke all on function public.hai_recompute_work_module_enabled(text) from public, anon, authenticated;

create or replace function public.hai_set_work_skill_enabled(
  p_skill_id uuid,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_module_slug text;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception '仅管理员可以启停 Work Skill。';
  end if;

  select module_slug into v_module_slug
  from public.hai_work_skills
  where id = p_skill_id;
  if v_module_slug is null then
    raise exception 'Work Skill 不存在。';
  end if;

  if p_enabled and not exists (
    select 1
    from public.hai_work_skill_versions
    where skill_id = p_skill_id
      and status = 'published'
  ) then
    raise exception '请先发布至少一个 Skill 版本，再启用前端工具。';
  end if;

  update public.hai_work_skills
  set is_enabled = p_enabled, updated_at = now()
  where id = p_skill_id;

  return public.hai_recompute_work_module_enabled(v_module_slug);
end;
$$;

revoke all on function public.hai_set_work_skill_enabled(uuid, boolean) from public, anon;
grant execute on function public.hai_set_work_skill_enabled(uuid, boolean) to authenticated;

create or replace function public.hai_set_work_fallback_skill(p_skill_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_module_slug text;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception '仅管理员可以设置 Work 通用降级 Skill。';
  end if;
  select module_slug into v_module_slug
  from public.hai_work_skills
  where id = p_skill_id;
  if v_module_slug is null then raise exception 'Work Skill 不存在。'; end if;

  if not exists (
    select 1
    from public.hai_work_skill_versions
    where skill_id = p_skill_id
      and status = 'published'
  ) then
    raise exception '请先发布至少一个 Skill 版本，再设为通用降级。';
  end if;

  update public.hai_work_skills
  set is_fallback = false, updated_at = now()
  where module_slug = v_module_slug and id <> p_skill_id and is_fallback = true;

  update public.hai_work_skills
  set is_fallback = true, is_enabled = true, updated_at = now()
  where id = p_skill_id;

  perform public.hai_recompute_work_module_enabled(v_module_slug);
end;
$$;

revoke all on function public.hai_set_work_fallback_skill(uuid) from public, anon;
grant execute on function public.hai_set_work_fallback_skill(uuid) to authenticated;

-- 将既有模块状态一次性同步为“是否存在已发布且启用的 Skill”。
select public.hai_recompute_work_module_enabled(slug)
from public.hai_feature_modules
where surface_mode = 'work';

commit;
