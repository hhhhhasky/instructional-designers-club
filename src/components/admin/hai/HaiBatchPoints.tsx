import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getAdminCourseAccessProducts } from "@/db/admin-api";
import { supabase } from "@/db/supabase";
import type { CourseAccessProduct } from "@/lib/course-entitlements";

type PointUser = { id: string; nickname: string | null; phone: string | null; points: number };
type RpcResult = { data: unknown; error: { message: string } | null };
const rpc = supabase.rpc.bind(supabase) as unknown as (name: string, args: Record<string, unknown>) => Promise<RpcResult>;

export default function HaiBatchPoints() {
  const [products, setProducts] = useState<CourseAccessProduct[]>([]);
  const [product, setProduct] = useState("");
  const [users, setUsers] = useState<PointUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [operation, setOperation] = useState<"add" | "deduct">("add");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => { void getAdminCourseAccessProducts().then(setProducts).catch(() => setMessage("课程列表加载失败，请刷新重试。")); }, []);
  useEffect(() => {
    setUsers([]); setSelected(new Set()); setMessage("");
    if (!product) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    void rpc("hai_admin_course_point_users", { p_product_code: product }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) setMessage(`用户加载失败：${error.message}`);
      else setUsers((data ?? []) as PointUser[]);
      setLoading(false);
    }).catch(() => { if (!cancelled) { setMessage("用户加载失败，请重试。"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [product, revision]);

  const visible = users.filter((user) => `${user.nickname ?? ""} ${user.phone ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const allVisible = visible.length > 0 && visible.every((user) => selected.has(user.id));
  const count = Number(points);
  const valid = Number.isSafeInteger(count) && count > 0 && count <= 2147483647;
  async function submit() {
    if (!valid || !reason.trim() || !selected.size || saving) return;
    const action = operation === "add" ? "增加" : "扣除";
    if (!window.confirm(`确认给选中的 ${selected.size} 位用户每人${action} ${count} 积分？\n原因：${reason.trim()}`)) return;
    setSaving(true); setMessage("");
    try {
      const { error } = await rpc("hai_admin_batch_adjust_points", { p_user_ids: [...selected], p_points: operation === "add" ? count : -count, p_reason: reason.trim() });
      if (error) throw new Error(error.message);
      setSelected(new Set()); setPoints(""); setReason("");
      // Refresh balances without clearing the success message.
      const result = await rpc("hai_admin_course_point_users", { p_product_code: product });
      if (!result.error) setUsers((result.data ?? []) as PointUser[]);
      setMessage(`已为 ${selected.size} 位用户每人${action} ${count} 积分。${result.error ? "余额刷新失败，请手动刷新。" : ""}`);
    } catch (error) { setMessage(`调整未确认：${error instanceof Error ? error.message : "网络异常"}。请刷新余额和积分记录后再重试，避免重复操作。`); }
    finally { setSaving(false); }
  }
  return <div className="space-y-4 rounded-ds-md border border-bd p-4">
    <div><h3 className="font-bold text-tx">按课程批量调整积分</h3><p className="mt-1 text-xs text-txs">包含直接授权和会员等级带来的有效课程权限，仅显示正常账号。切换课程会清空选择。</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">课程权限<select aria-label="课程权限" className="mt-1 h-10 w-full rounded-ds-md border border-bd bg-bg px-3" value={product} disabled={saving} onChange={(e) => setProduct(e.target.value)}><option value="">请选择课程</option>{products.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></label>
      <label className="text-sm">搜索用户<input aria-label="批量搜索用户" className="mt-1 h-10 w-full rounded-ds-md border border-bd bg-bg px-3" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="手机号或用户名" /></label>
    </div>
    {product && <><div className="flex flex-wrap items-center gap-3 text-sm"><label><input type="checkbox" checked={allVisible} disabled={!visible.length || loading || saving} onChange={() => setSelected((previous) => { const next = new Set(previous); visible.forEach((u) => allVisible ? next.delete(u.id) : next.add(u.id)); return next; })} /> 全选当前筛选结果</label><span>符合课程权限 {users.length} 人，已选 {selected.size} 人</span><button type="button" className="text-ac underline" disabled={saving} onClick={() => setRevision((v) => v + 1)}>刷新名单</button></div>
    <div className="max-h-72 overflow-auto rounded-ds-md border border-bd">{loading ? <p className="p-3 text-sm">正在加载用户…</p> : visible.length === 0 ? <p className="p-3 text-sm text-txs">没有符合条件的用户。</p> : visible.map((user) => <label key={user.id} className="flex items-center gap-3 border-b border-bd px-3 py-2 text-sm last:border-0"><input type="checkbox" checked={selected.has(user.id)} disabled={saving} onChange={(e) => setSelected((previous) => { const next = new Set(previous); if (e.target.checked) next.add(user.id); else next.delete(user.id); return next; })} /><span className="min-w-0 flex-1">{user.nickname || "未命名"} · {user.phone || "无手机号"}</span><span className="shrink-0 text-txs">{user.points} 积分</span></label>)}</div></>}
    <div className="grid gap-2 sm:grid-cols-[120px_140px_minmax(0,1fr)_auto]"><select aria-label="积分操作" className="h-10 rounded-ds-md border border-bd bg-bg px-3 text-sm" value={operation} disabled={saving} onChange={(e) => setOperation(e.target.value as "add" | "deduct")}><option value="add">增加积分</option><option value="deduct">扣除积分</option></select><input aria-label="每人积分数量" type="number" min="1" step="1" className="h-10 rounded-ds-md border border-bd bg-bg px-3 text-sm" placeholder="每人积分" value={points} disabled={saving} onChange={(e) => setPoints(e.target.value)} /><input aria-label="批量调整原因" className="h-10 rounded-ds-md border border-bd bg-bg px-3 text-sm" placeholder="填写调整原因" value={reason} disabled={saving} onChange={(e) => setReason(e.target.value)} /><Button disabled={!selected.size || !valid || !reason.trim() || saving || loading} onClick={() => void submit()}>{saving ? "处理中…" : "调整选中用户"}</Button></div>
    <p className="text-xs text-txs">按每人相同数量调整。扣分时若任何人的可用积分不足，整批不会执行；进行中的任务可能占用积分。</p>
    {message && <p role="status" className="text-sm text-tx">{message}</p>}
  </div>;
}
