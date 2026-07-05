begin;

update public.hai_feature_modules
set default_top_p = null
where default_top_p is not null
  and default_top_p <= 0;

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.hai_feature_modules'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%default_top_p%'
  loop
    execute format('alter table public.hai_feature_modules drop constraint %I', v_constraint.conname);
  end loop;
end $$;

alter table public.hai_feature_modules
  add constraint hai_feature_modules_default_top_p_check
  check (default_top_p is null or (default_top_p > 0 and default_top_p <= 1));

commit;
