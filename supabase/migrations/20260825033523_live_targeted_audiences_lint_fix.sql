-- Live 定向受众：管理端学员列表 RPC 会调用现有 VOLATILE 管理员校验函数，
-- 因此不应宣称为 STABLE。

begin;

alter function public.get_live_admin_participants(uuid) volatile;

commit;
