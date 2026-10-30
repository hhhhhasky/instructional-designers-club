begin;

alter table public.hai_point_transactions drop constraint hai_point_transactions_transaction_type_check;
alter table public.hai_point_transactions add constraint hai_point_transactions_transaction_type_check
  check (transaction_type in ('newcomer_gift', 'admin_add', 'admin_deduct', 'purchase', 'usage', 'refund'));

create or replace function public.hai_admin_course_point_users(p_product_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_rate integer := greatest(1, public.hai_runtime_numeric('points.tokens_per_point', 1000)::integer);
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Permission denied: admin only'; end if;
  if not exists (select 1 from public.course_access_products where code = p_product_code and status = 'published' and is_grantable) then
    raise exception '课程不可用';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname, 'phone', p.phone,
    'points', round(coalesce(w.balance_tokens, 0)::numeric / v_rate, 2)) order by p.nickname, p.id), '[]'::jsonb)
  into v_result from public.profiles p left join public.hai_point_wallets w on w.user_id = p.id
  where p.status = 'active' and (
    exists (select 1 from public.membership_course_access m where m.access_level = p.access_level and m.product_code = p_product_code)
    or exists (select 1 from public.user_course_entitlements e where e.user_id = p.id and e.product_code = p_product_code
      and e.status = 'active' and e.starts_at <= now() and (e.expires_at is null or e.expires_at > now()))
  );
  return v_result;
end $$;

create or replace function public.hai_admin_batch_adjust_points(p_user_ids uuid[], p_points integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_wallet public.hai_point_wallets%rowtype; v_reserved bigint;
  v_rate integer := greatest(1, public.hai_runtime_numeric('points.tokens_per_point', 1000)::integer);
  v_delta bigint; v_count integer;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Permission denied: admin only'; end if;
  if p_user_ids is null or cardinality(p_user_ids) = 0 or array_position(p_user_ids, null) is not null then raise exception '请选择用户'; end if;
  if p_points is null or p_points = 0 then raise exception '积分数量必须大于 0'; end if;
  if nullif(btrim(p_reason), '') is null then raise exception '请填写调整原因'; end if;
  select count(distinct id) into v_count from unnest(p_user_ids) as u(id);
  if v_count <> cardinality(p_user_ids) then raise exception '用户列表存在重复'; end if;
  if (select count(*) from public.profiles where id = any(p_user_ids) and status = 'active') <> v_count then
    raise exception '用户不存在或账号已停用，请刷新后重试';
  end if;
  v_delta := p_points::bigint * v_rate;
  -- Serialize with the existing usage reservation gate and lock wallets in a stable order.
  perform pg_advisory_xact_lock(hashtextextended('hai_usage_gate', 0));
  for v_id in select id from unnest(p_user_ids) as u(id) order by id loop
    perform public.hai_ensure_points_wallet(v_id);
    select * into v_wallet from public.hai_point_wallets where user_id = v_id for update;
    if v_delta < 0 then
      select coalesce(sum(case when metadata ? 'fixed_charge_tokens'
        then (metadata ->> 'fixed_charge_tokens')::bigint
        when metadata ? 'points_reserved_equivalent_tokens'
        then (metadata ->> 'points_reserved_equivalent_tokens')::bigint
        else estimated_input_tokens + estimated_output_tokens end), 0)::bigint into v_reserved
      from public.hai_request_reservations where user_id = v_id and status = 'active' and expires_at > now()
        and metadata ->> 'quota_mode' = 'points';
      if v_wallet.balance_tokens - v_reserved < -v_delta then
        raise exception '至少一位用户可用积分不足或有任务正在占用积分，整批未调整，请刷新后检查';
      end if;
    end if;
    update public.hai_point_wallets set balance_tokens = balance_tokens + v_delta,
      total_credited_tokens = total_credited_tokens + greatest(v_delta, 0)
      where user_id = v_id;
    insert into public.hai_point_transactions(user_id, transaction_type, token_delta, points_delta, tokens_per_point, reason, created_by)
      values (v_id, case when v_delta > 0 then 'admin_add' else 'admin_deduct' end,
        v_delta, p_points, v_rate, btrim(p_reason), auth.uid());
  end loop;
  return jsonb_build_object('count', v_count, 'points_each', p_points);
end $$;

revoke all on function public.hai_admin_course_point_users(text) from public, anon, authenticated;
revoke all on function public.hai_admin_batch_adjust_points(uuid[], integer, text) from public, anon, authenticated;
grant execute on function public.hai_admin_course_point_users(text) to authenticated;
grant execute on function public.hai_admin_batch_adjust_points(uuid[], integer, text) to authenticated;
commit;
