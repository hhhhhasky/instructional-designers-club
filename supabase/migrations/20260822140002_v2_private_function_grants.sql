-- V2 private helper grants
-- RLS 会调用这些受限 helper，但它们不应成为 anon/PUBLIC 的 RPC 入口。

begin;

revoke execute on function private.v2_can_manage() from public, anon;
revoke execute on function private.v2_user_has_access() from public, anon;
revoke execute on function private.v2_can_access_module(uuid) from public, anon;
revoke execute on function private.v2_can_access_unit(uuid) from public, anon;
revoke execute on function private.v2_can_access_lesson(uuid) from public, anon;
revoke execute on function private.v2_can_access_block(uuid) from public, anon;

grant execute on function private.v2_can_manage() to authenticated;
grant execute on function private.v2_user_has_access() to authenticated;
grant execute on function private.v2_can_access_module(uuid) to authenticated;
grant execute on function private.v2_can_access_unit(uuid) to authenticated;
grant execute on function private.v2_can_access_lesson(uuid) to authenticated;
grant execute on function private.v2_can_access_block(uuid) to authenticated;

revoke all on function public.v2_set_updated_at() from public, anon, authenticated;

commit;
