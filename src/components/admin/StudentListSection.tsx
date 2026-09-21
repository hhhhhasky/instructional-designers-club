import { ChevronLeft, ChevronRight, Download, Search, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import { Button } from "@/components/ui/button";
import {
  adminAdjustBonusCredits, adminSetUserCourseAccess, adminUpdateUserStatus,
  getAdminCourseAccessProducts, getAdminStudentList, getAdminUserCourseEntitlements,
  type StudentItem,
} from "@/db/admin-api";
import {
  courseAccessLabel, getMembershipCourseAccessCodes, mergeCourseAccessCodes,
  type CourseAccessProduct, type UserCourseEntitlement,
} from "@/lib/course-entitlements";
import { cn } from "@/lib/utils";
import type { CourseAccessCode } from "@/types/types";

const PAGE_SIZE = 20;

export default function StudentListSection() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [products, setProducts] = useState<CourseAccessProduct[]>([]);
  const [entitlements, setEntitlements] = useState<UserCourseEntitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [grantUserId, setGrantUserId] = useState<string | null>(null);
  const [grantProductCode, setGrantProductCode] = useState<CourseAccessCode | "">("");
  const [grantNotes, setGrantNotes] = useState("");
  const [savingCourseAccess, setSavingCourseAccess] = useState(false);
  const [creditUserId, setCreditUserId] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [creditSaving, setCreditSaving] = useState(false);
  const [statusUserId, setStatusUserId] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  useEffect(() => {
    Promise.all([getAdminStudentList(), getAdminCourseAccessProducts(), getAdminUserCourseEntitlements()])
      .then(([studentRows, productRows, entitlementRows]) => {
        setStudents(studentRows); setProducts(productRows); setEntitlements(entitlementRows);
      })
      .catch(() => setError("加载学员数据失败，请刷新重试"))
      .finally(() => setLoading(false));
  }, []);

  const directCodesByUser = useMemo(() => {
    const map = new Map<string, CourseAccessCode[]>();
    entitlements.forEach((row) => map.set(row.user_id, [...(map.get(row.user_id) ?? []), row.product_code]));
    return map;
  }, [entitlements]);
  const effectiveCodes = (student: StudentItem) => mergeCourseAccessCodes(
    getMembershipCourseAccessCodes(student.access_level), directCodesByUser.get(student.id) ?? [],
  );
  const filtered = useMemo(() => students.filter((student) => {
    const q = search.trim().toLowerCase();
    if (q && !student.nickname.toLowerCase().includes(q) && !student.phone.includes(q)) return false;
    if (statusFilter !== "all" && student.status !== statusFilter) return false;
    const codes = effectiveCodes(student);
    if (courseFilter === "none") return codes.length === 0;
    return courseFilter === "all" || codes.includes(courseFilter as CourseAccessCode);
  }), [students, search, statusFilter, courseFilter, directCodesByUser]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const setFilter = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); };
  const openGrant = (userId: string) => {
    setGrantUserId(userId); setGrantProductCode(products[0]?.code ?? ""); setGrantNotes("");
  };
  const saveGrant = async () => {
    if (!grantUserId || !grantProductCode) return;
    try {
      setSavingCourseAccess(true);
      const row = await adminSetUserCourseAccess(grantUserId, grantProductCode, true, grantNotes);
      setEntitlements((items) => [...items.filter((item) => item.user_id !== grantUserId || item.product_code !== grantProductCode), row]);
      toast.success(`已开通${courseAccessLabel(grantProductCode)}`); setGrantUserId(null);
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "课程权限开通失败"); }
    finally { setSavingCourseAccess(false); }
  };
  const revokeGrant = async (student: StudentItem, code: CourseAccessCode) => {
    if (!window.confirm(`确认收回 ${student.nickname} 的「${courseAccessLabel(code)}」单独授权？`)) return;
    try {
      await adminSetUserCourseAccess(student.id, code, false, "后台手动收回");
      setEntitlements((items) => items.filter((item) => item.user_id !== student.id || item.product_code !== code));
      toast.success("已收回单独授权");
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "收回课程权限失败"); }
  };
  const adjustCredits = async () => {
    if (!creditUserId) return;
    const amount = Number(creditAmount);
    if (!Number.isFinite(amount) || amount === 0 || !creditReason.trim()) { toast.error("请填写非 0 分数和调整原因"); return; }
    try {
      setCreditSaving(true);
      const result = await adminAdjustBonusCredits(creditUserId, amount, creditReason.trim());
      setStudents((items) => items.map((item) => item.id === creditUserId ? { ...item, ...result } : item));
      toast.success("奖励学分已调整"); setCreditUserId(null);
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "学分调整失败"); }
    finally { setCreditSaving(false); }
  };
  const updateStatus = async () => {
    const student = students.find((item) => item.id === statusUserId); if (!student) return;
    const status = student.status === "active" ? "banned" : "active";
    try {
      setStatusSaving(true); await adminUpdateUserStatus(student.id, status);
      setStudents((items) => items.map((item) => item.id === student.id ? { ...item, status } : item));
      toast.success(status === "banned" ? "账号已停用" : "账号已恢复"); setStatusUserId(null);
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "账号状态更新失败"); }
    finally { setStatusSaving(false); }
  };

  if (loading) return <LoadingOverlay message="正在加载学员数据..." />;
  if (error) return <div className="py-12 text-center text-txs">{error}</div>;

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap gap-2">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-txt" /><input value={search} onChange={(e) => setFilter(setSearch, e.target.value)} placeholder="搜索昵称或手机号..." className="w-64 rounded-ds-md border border-bd bg-white py-2 pl-9 pr-3 text-ds-sm" /></div>
        <select value={courseFilter} onChange={(e) => setFilter(setCourseFilter, e.target.value)} className="rounded-ds-md border border-bd bg-white px-3 py-2 text-ds-sm"><option value="all">全部课程权限</option><option value="none">无课程权限</option>{products.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select>
        <select value={statusFilter} onChange={(e) => setFilter(setStatusFilter, e.target.value)} className="rounded-ds-md border border-bd bg-white px-3 py-2 text-ds-sm"><option value="all">全部状态</option><option value="active">正常</option><option value="banned">封禁</option></select>
      </div>
      <div className="flex items-center gap-3 text-ds-sm text-txs"><span>共 {filtered.length} 人</span><Button variant="outline" size="sm" onClick={() => exportCSV(filtered, effectiveCodes)}><Download className="mr-1 h-4 w-4" />导出 CSV</Button></div>
    </div>
    <div className="overflow-hidden rounded-ds-lg border border-bd bg-white shadow-ds-xs"><div className="overflow-x-auto"><table className="w-full text-ds-sm">
      <thead><tr className="border-b border-bd bg-warm"><th className="px-4 py-3 text-left">昵称</th><th className="px-4 py-3 text-left">手机号</th><th className="min-w-[340px] px-4 py-3 text-left">课程权限</th><th className="px-4 py-3 text-right">学分</th><th className="px-4 py-3 text-right">奖励</th><th className="px-4 py-3 text-center">状态</th><th className="px-4 py-3 text-left">注册日期</th><th className="px-4 py-3 text-left">最后活跃</th></tr></thead>
      <tbody>{paged.map((student) => { const mapped = getMembershipCourseAccessCodes(student.access_level); const direct = directCodesByUser.get(student.id) ?? []; const codes = effectiveCodes(student); return <tr key={student.id} className="border-b border-bdl hover:bg-bgs/50">
        <td className="px-4 py-3 font-ds-medium">{student.nickname}</td><td className="px-4 py-3 font-mono text-txs">{maskPhone(student.phone)}</td>
        <td className="px-4 py-3"><div className="flex flex-wrap items-center gap-1.5">{codes.length === 0 && <span className="text-txs">暂无</span>}{codes.map((code) => <span key={code} title={direct.includes(code) ? "后台单独开通" : "旧会员等级兼容映射"} className={cn("inline-flex items-center gap-1 rounded-ds-pill px-2 py-1 text-ds-xs", direct.includes(code) ? "bg-blue-soft text-pp" : "bg-warm text-am")}>{courseAccessLabel(code)}{direct.includes(code) && <button type="button" aria-label={`收回${courseAccessLabel(code)}`} onClick={() => void revokeGrant(student, code)}><X className="h-3 w-3" /></button>}</span>)}<button type="button" onClick={() => openGrant(student.id)} className="rounded-ds-pill border border-dashed border-ac px-2 py-1 text-ds-xs text-ac">+开通课程</button>{mapped.length > 0 && <span className="text-[10px] text-txs">橙色=兼容映射</span>}</div></td>
        <td className="px-4 py-3 text-right font-ds-semibold">{formatCredits(student.total_credits)}</td><td className="px-4 py-3 text-right"><button className="text-tl" onClick={() => { setCreditUserId(student.id); setCreditAmount(""); setCreditReason(""); }}>{student.bonus_credits > 0 ? "+" : ""}{formatCredits(student.bonus_credits)}</button></td>
        <td className="px-4 py-3 text-center"><button onClick={() => setStatusUserId(student.id)}><StatusBadge status={student.status} /></button></td><td className="px-4 py-3 text-txs">{formatDate(student.created_at)}</td><td className="px-4 py-3 text-txs">{student.last_active_at ? formatDate(student.last_active_at) : "从未活跃"}</td>
      </tr>; })}{paged.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-txs">没有匹配的学员</td></tr>}</tbody>
    </table></div></div>
    {totalPages > 1 && <div className="flex items-center justify-center gap-2"><Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((v) => v - 1)}><ChevronLeft className="h-4 w-4" /></Button><span className="px-2 text-ds-sm text-txs">{currentPage} / {totalPages}</span><Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((v) => v + 1)}><ChevronRight className="h-4 w-4" /></Button></div>}
    {grantUserId && <Modal title="开通课程权限" onClose={() => !savingCourseAccess && setGrantUserId(null)}><select value={grantProductCode} onChange={(e) => setGrantProductCode(e.target.value as CourseAccessCode)} className="w-full rounded-ds-md border border-bd px-3 py-2 text-ds-sm">{products.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select><input value={grantNotes} onChange={(e) => setGrantNotes(e.target.value)} placeholder="备注，如：学员购买课程" className="w-full rounded-ds-md border border-bd px-3 py-2 text-ds-sm" /><DialogActions onCancel={() => setGrantUserId(null)} onConfirm={() => void saveGrant()} saving={savingCourseAccess} confirmText="确认开通" /></Modal>}
    {creditUserId && <Modal title="调整奖励学分" onClose={() => !creditSaving && setCreditUserId(null)}><input type="number" step="0.5" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} placeholder="正数加分，负数扣分" className="w-full rounded-ds-md border border-bd px-3 py-2 text-ds-sm" /><textarea value={creditReason} onChange={(e) => setCreditReason(e.target.value)} placeholder="调整原因" rows={2} className="w-full rounded-ds-md border border-bd px-3 py-2 text-ds-sm" /><DialogActions onCancel={() => setCreditUserId(null)} onConfirm={() => void adjustCredits()} saving={creditSaving} confirmText="确认调整" /></Modal>}
    {statusUserId && (() => { const student = students.find((item) => item.id === statusUserId); if (!student) return null; return <Modal title={student.status === "active" ? "确认停用账号？" : "确认恢复账号？"} onClose={() => !statusSaving && setStatusUserId(null)}><p className="text-ds-sm text-txs">{student.nickname} 的学习记录、课程授权和学分都会保留。</p><DialogActions onCancel={() => setStatusUserId(null)} onConfirm={() => void updateStatus()} saving={statusSaving} confirmText={student.status === "active" ? "确认停用" : "确认恢复"} /></Modal>; })()}
  </div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center"><button type="button" aria-label="关闭" className="absolute inset-0 bg-black/40" onClick={onClose} /><div className="relative mx-4 w-full max-w-sm space-y-4 rounded-ds-xl border border-bd bg-white p-6 shadow-ds-lg"><h3 className="text-ds-base font-ds-semibold">{title}</h3>{children}</div></div>; }
function DialogActions({ onCancel, onConfirm, saving, confirmText }: { onCancel: () => void; onConfirm: () => void; saving: boolean; confirmText: string }) { return <div className="flex justify-end gap-2"><Button variant="outline" onClick={onCancel} disabled={saving}>取消</Button><Button onClick={onConfirm} disabled={saving}>{saving ? "保存中..." : confirmText}</Button></div>; }
function StatusBadge({ status }: { status: StudentItem["status"] }) { return <span className={cn("rounded-ds-pill px-2 py-0.5 text-ds-xs font-ds-semibold", status === "active" ? "bg-mint-soft text-tl" : "bg-error-bg text-error-tx")}>{status === "active" ? "正常" : "封禁"}</span>; }
function maskPhone(phone: string) { return phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone; }
function formatDate(value: string) { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function formatCredits(value: number) { return value % 1 === 0 ? String(value) : value.toFixed(1); }
function exportCSV(students: StudentItem[], getCodes: (student: StudentItem) => CourseAccessCode[]) {
  const header = "昵称,手机号,课程权限,学分,奖励学分,状态,注册日期,最后活跃\n";
  const rows = students.map((s) => [s.nickname, s.phone, `"${getCodes(s).map(courseAccessLabel).join("、")}"`, formatCredits(s.total_credits), formatCredits(s.bonus_credits), s.status === "active" ? "正常" : "封禁", formatDate(s.created_at), s.last_active_at ? formatDate(s.last_active_at) : "从未活跃"].join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", header, rows], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `学员名单_${formatDate(new Date().toISOString())}.csv`; a.click(); URL.revokeObjectURL(url);
}
