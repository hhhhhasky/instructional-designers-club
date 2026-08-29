begin;

-- Historical default privileges expose new public tables more broadly than
-- this wallet API needs. RLS already blocks unauthorized rows; these revokes
-- also narrow the table-level Data API surface to authenticated read-only.
revoke all on table public.hai_point_wallets from public, anon;
revoke all on table public.hai_point_transactions from public, anon;

revoke insert, update, delete, truncate, references, trigger
  on table public.hai_point_wallets, public.hai_point_transactions
  from authenticated;

grant select on table public.hai_point_wallets, public.hai_point_transactions
  to authenticated;

commit;
