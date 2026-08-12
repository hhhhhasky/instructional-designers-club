begin;

-- The v2 importer initially compared lesson_number while resolving a lesson's
-- unit parent. Unit sections intentionally use lesson_number = 0, so every
-- valid lesson was rejected as parentless. Only frame children need the
-- lesson_number comparison.
do $$
declare
  v_definition text;
  v_old text := $old$and (child->>'section_level' = 'unit' or parent->>'lesson_number' = child->>'lesson_number')$old$;
  v_new text := $new$and (child->>'section_level' <> 'frame' or parent->>'lesson_number' = child->>'lesson_number')$new$;
begin
  select pg_get_functiondef('public.hai_import_textbook_payload(jsonb)'::regprocedure)
  into v_definition;

  if position(v_old in v_definition) = 0 then
    raise exception 'Expected parent validation clause was not found';
  end if;

  execute replace(v_definition, v_old, v_new);
end;
$$;

commit;
