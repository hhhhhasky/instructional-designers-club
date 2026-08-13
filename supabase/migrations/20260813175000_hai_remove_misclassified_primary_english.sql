begin;

-- The first idempotent import of the new English payload briefly classified
-- primary volumes as junior. Remove only those exact records; the corrected
-- reviewed-英语-小学-* collections are already present.
delete from public.hai_textbook_collections
where slug in (
  'reviewed-英语-初中-3-1', 'reviewed-英语-初中-3-2',
  'reviewed-英语-初中-4-1', 'reviewed-英语-初中-4-2',
  'reviewed-英语-初中-5-1', 'reviewed-英语-初中-5-2',
  'reviewed-英语-初中-6-1', 'reviewed-英语-初中-6-2'
);

commit;
