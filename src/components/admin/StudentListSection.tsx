import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import { Button } from "@/components/ui/button";
import type { StudentItem } from "@/db/admin-api";
import { adminAdjustBonusCredits, adminUpdateUserAccessLevel, adminUpdateUserStatus, getAdminStudentList } from "@/db/admin-api";
import { cn } from "@/lib/utils";
import type { MembershipType } from "@/types/types";

const PAGE_SIZE = 20;

const ACCESS_LEVEL_OPTIONS = [
  { value: "all", label: "全部等级" },
  { value: "free", label: "Free" },
  { value: "plus", label: "Plus" },
  { value: "pro", label: "Pro" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "active", label: "正常" },
  { value: "banned", label: "封禁" },
];

export default function StudentListSection() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const result = await getAdminStudentList();
        setStudents(result);
      } catch {
        setError("加载学员数据失败，请刷新重试");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // 客户端过滤
  const filtered = useMemo(() => {
    let result = students;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.nickname.toLowerCase().includes(q) ||
          s.phone.includes(q)
      );
    }

    if (levelFilter !== "all") {
      result = result.filter((s) => s.access_level === levelFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter);
    }

    return result;
  }, [students, search, levelFilter, statusFilter]);

  // 分页
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // 搜索/筛选变化时重置页码
  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(1);
  };
  const handleLevelChange = (v: string) => {
    setLevelFilter(v);
    setPage(1);
  };
  const handleStatusChange = (v: string) => {
    setStatusFilter(v);
    setPage(1);
  };

  // 内联编辑用户等级
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingLevel, setPendingLevel] = useState<MembershipType | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // 学分调整弹窗
  const [creditUserId, setCreditUserId] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [creditSaving, setCreditSaving] = useState(false);
  const [statusUserId, setStatusUserId] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const openCreditDialog = (userId: string) => {
    setCreditUserId(userId);
    setCreditAmount("");
    setCreditReason("");
  };
  const closeCreditDialog = () => {
    if (creditSaving) return;
    setCreditUserId(null);
    setCreditAmount("");
    setCreditReason("");
  };

  const handleSaveLevel = async (userId: string, newLevel: MembershipType) => {
    const previousLevel = students.find((s) => s.id === userId)?.access_level;
    if (previousLevel === newLevel) {
      setEditingId(null);
      setPendingLevel(null);
      return;
    }

    try {
      setSavingId(userId);
      const result = await adminUpdateUserAccessLevel(userId, newLevel);
      setStudents((prev) =>
        prev.map((s) =>
          s.id === userId ? { ...s, access_level: result.access_level } : s
        )
      );
      toast.success(`已将用户等级修改为 ${result.access_level.toUpperCase()}`);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "修改等级失败，请重试";
      toast.error(message);
    } finally {
      setSavingId(null);
      setEditingId(null);
      setPendingLevel(null);
    }
  };

  const handleCreditAdjust = async () => {
    if (!creditUserId) return;
    const amount = Number.parseFloat(creditAmount);
    if (Number.isNaN(amount) || amount === 0) {
      toast.error("请输入有效的调整分数（不能为 0）");
      return;
    }
    if (!creditReason.trim()) {
      toast.error("请填写调整原因");
      return;
    }

    try {
      setCreditSaving(true);
      const result = await adminAdjustBonusCredits(creditUserId, amount, creditReason.trim());
      setStudents((prev) =>
        prev.map((s) =>
          s.id === creditUserId
            ? { ...s, bonus_credits: result.bonus_credits, total_credits: result.total_credits }
            : s
        )
      );
      const label = amount > 0 ? `+${amount} 学分` : `${amount} 学分`;
      toast.success(`${label} 已发放给学员`);
      closeCreditDialog();
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : "学分调整失败，请重试";
      toast.error(message);
    } finally {
      setCreditSaving(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!statusUserId) return;
    const student = students.find((item) => item.id === statusUserId);
    if (!student) return;
    const nextStatus = student.status === "active" ? "banned" : "active";

    try {
      setStatusSaving(true);
      const result = await adminUpdateUserStatus(student.id, nextStatus);
      setStudents((items) => items.map((item) => item.id === student.id ? { ...item, status: result.status } : item));
      toast.success(nextStatus === "banned" ? `已停用 ${student.nickname} 的账号` : `已恢复 ${student.nickname} 的账号`);
      setStatusUserId(null);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "账号状态更新失败");
    } finally {
      setStatusSaving(false);
    }
  };

  if (loading) return <LoadingOverlay message="正在加载学员数据..." />;
  if (error)
    return (
      <div className="text-center py-12">
        <p className="text-txs mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-ac hover:underline"
        >
          刷新页面
        </button>
      </div>
    );

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center flex-1">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt" />
            <input
              type="text"
              placeholder="搜索昵称或手机号..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 pr-3 py-2 text-ds-sm bg-white border border-bd rounded-ds-md w-64 focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
            />
          </div>

          {/* 等级筛选 */}
          <select
            value={levelFilter}
            onChange={(e) => handleLevelChange(e.target.value)}
            className="px-3 py-2 text-ds-sm bg-white border border-bd rounded-ds-md focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
          >
            {ACCESS_LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* 状态筛选 */}
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-3 py-2 text-ds-sm bg-white border border-bd rounded-ds-md focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-ds-sm text-txs">
            共 {filtered.length} 人
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCSV(filtered)}
          >
            <Download className="w-4 h-4 mr-1" />
            导出 CSV
          </Button>
        </div>
      </div>

      {/* 表格 */}
      <div className="bg-white rounded-ds-lg border border-bd overflow-hidden shadow-ds-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-ds-sm">
            <thead>
              <tr className="border-b border-bd bg-warm">
                <th className="text-left px-4 py-3 font-ds-semibold text-tx">
                  昵称
                </th>
                <th className="text-left px-4 py-3 font-ds-semibold text-tx">
                  手机号
                </th>
                <th className="text-center px-4 py-3 font-ds-semibold text-tx">
                  等级
                </th>
                <th className="text-right px-4 py-3 font-ds-semibold text-tx">
                  学分
                </th>
                <th className="text-right px-4 py-3 font-ds-semibold text-tx">
                  奖励
                </th>
                <th className="text-center px-4 py-3 font-ds-semibold text-tx">
                  状态
                </th>
                <th className="text-left px-4 py-3 font-ds-semibold text-tx">
                  注册日期
                </th>
                <th className="text-left px-4 py-3 font-ds-semibold text-tx">
                  最后活跃
                </th>
                <th className="text-right px-4 py-3 font-ds-semibold text-tx">
                  已完成
                </th>
                <th className="text-right px-4 py-3 font-ds-semibold text-tx">
                  学习中
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map((student) => (
                <tr
                  key={student.id}
                  className="border-b border-bdl hover:bg-bgs/50 transition-colors"
                >
                  <td className="px-4 py-3 font-ds-medium text-tx">
                    {student.nickname}
                  </td>
                  <td className="px-4 py-3 text-txs font-mono">
                    {maskPhone(student.phone)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingId === student.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <select
                          value={pendingLevel || student.access_level}
                          onChange={(e) => setPendingLevel(e.target.value as MembershipType)}
                          className="px-2 py-1 text-ds-xs border border-bd rounded-ds-md bg-white focus:outline-none focus:border-ac"
                          autoFocus
                        >
                          <option value="free">Free</option>
                          <option value="plus">Plus</option>
                          <option value="pro">Pro</option>
                        </select>
                        <button
                          onClick={() => handleSaveLevel(student.id, pendingLevel || student.access_level)}
                          disabled={savingId === student.id}
                          className="text-ds-xs text-tl hover:text-tl/80 font-ds-semibold"
                        >
                          {savingId === student.id ? "保存中" : "保存"}
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setPendingLevel(null); }}
                          disabled={savingId === student.id}
                          className="text-ds-xs text-txs hover:text-tx"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingId(student.id); setPendingLevel(student.access_level); }}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        title="点击修改等级"
                      >
                        <LevelBadge level={student.access_level} />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-ds-semibold text-tx">
                    {formatCredits(student.total_credits)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openCreditDialog(student.id)}
                      className={cn(
                        "cursor-pointer hover:opacity-80 transition-opacity",
                        student.bonus_credits > 0 ? "text-tl font-ds-semibold" : "text-txs"
                      )}
                      title="点击调整奖励学分"
                    >
                      {student.bonus_credits > 0 ? `+${formatCredits(student.bonus_credits)}` : formatCredits(student.bonus_credits)}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => setStatusUserId(student.id)}
                      className="cursor-pointer transition hover:opacity-75"
                      title={student.status === "active" ? "点击停用账号" : "点击恢复账号"}
                    >
                      <StatusBadge status={student.status} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-txs">
                    {formatDate(student.created_at)}
                  </td>
                  <td className="px-4 py-3 text-txs">
                    {student.last_active_at
                      ? formatDate(student.last_active_at)
                      : "从未活跃"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {student.completed_courses}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {student.in_progress_courses}
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-12 text-center text-txs"
                  >
                    没有匹配的学员
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-ds-sm text-txs px-2">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* 学分调整弹窗 */}
      {creditUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 遮罩 */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeCreditDialog}
          />
          {/* 弹窗 */}
          <div className="relative bg-white rounded-ds-xl shadow-ds-lg border border-bd w-full max-w-sm mx-4 p-6 space-y-4">
            <h3 className="font-ds-semibold text-tx text-ds-base">
              调整奖励学分
              <span className="text-ds-sm text-txs font-ds-regular ml-2">
                {students.find((s) => s.id === creditUserId)?.nickname}
              </span>
            </h3>

            {/* 当前学分信息 */}
            {(() => {
              const student = students.find((s) => s.id === creditUserId);
              return (
                <div className="flex gap-4 text-ds-sm">
                  <div>
                    <span className="text-txs">总学分：</span>
                    <span className="font-ds-semibold text-tx">
                      {student ? formatCredits(student.total_credits) : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-txs">奖励学分：</span>
                    <span
                      className={cn(
                        "font-ds-semibold",
                        student && student.bonus_credits > 0 ? "text-tl" : "text-tx"
                      )}
                    >
                      {student
                        ? student.bonus_credits > 0
                          ? `+${formatCredits(student.bonus_credits)}`
                          : formatCredits(student.bonus_credits)
                        : "-"}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* 调整分数 */}
            <div>
              <label className="block text-ds-sm font-ds-medium text-tx mb-1.5">
                调整分数
                <span className="text-txs font-ds-regular ml-1">
                  （正数加分，负数扣分）
                </span>
              </label>
              <div className="flex items-center gap-2 mb-2">
                {[1, 2, 5, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCreditAmount(String(n))}
                    className={cn(
                      "px-2.5 py-1 text-ds-xs rounded-ds-md border transition-all",
                      creditAmount === String(n)
                        ? "bg-ac border-ac text-white"
                        : "bg-warm border-bd text-txs hover:border-ac hover:text-ac"
                    )}
                  >
                    +{n}
                  </button>
                ))}
              </div>
              <input
                type="number"
                step="0.5"
                placeholder="输入调整分数，如 2 或 -1"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreditAdjust();
                }}
                className="w-full px-3 py-2 text-ds-sm border border-bd rounded-ds-md focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
                autoFocus
              />
            </div>

            {/* 调整原因 */}
            <div>
              <label className="block text-ds-sm font-ds-medium text-tx mb-1.5">
                调整原因
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <textarea
                placeholder="如：优质分享奖励、提出好问题、优秀笔记..."
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-ds-sm border border-bd rounded-ds-md focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all resize-none"
              />
            </div>

            {/* 按钮 */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={closeCreditDialog}
                disabled={creditSaving}
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleCreditAdjust}
                disabled={creditSaving}
                className="bg-ac text-white hover:bg-ac-dark"
              >
                {creditSaving ? "保存中..." : "确认调整"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {statusUserId && (() => {
        const student = students.find((item) => item.id === statusUserId);
        if (!student) return null;
        const willBan = student.status === "active";
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <button type="button" aria-label="关闭账号状态确认" className="absolute inset-0 bg-black/45" onClick={() => !statusSaving && setStatusUserId(null)} />
            <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-ds-xl border border-bd bg-white shadow-ds-xl">
              <div className={`h-1.5 ${willBan ? "bg-red-500" : "bg-tl"}`} />
              <div className="p-6">
                <div className={`grid h-11 w-11 place-items-center rounded-full ${willBan ? "bg-red-50 text-red-600" : "bg-tll text-tl"}`}>
                  {willBan ? "停" : "启"}
                </div>
                <h3 className="mt-4 text-ds-lg font-ds-black text-tx">{willBan ? "确认停用会员账号？" : "确认恢复会员账号？"}</h3>
                <p className="mt-2 text-ds-sm leading-6 text-txs">
                  {willBan
                    ? `${student.nickname} 将无法继续登录俱乐部，但学习记录、问答和学分都会保留。`
                    : `${student.nickname} 将重新获得登录和学习权限，原有数据不变。`}
                </p>
                <div className="mt-4 rounded-ds-md bg-bgs px-3 py-2 text-[11px] text-txs">
                  账号：{student.nickname} · {maskPhone(student.phone)} · {student.access_level.toUpperCase()}
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setStatusUserId(null)} disabled={statusSaving}>取消</Button>
                  <Button className={willBan ? "bg-red-600 text-white hover:bg-red-700" : "bg-tl text-white hover:bg-tl/90"} onClick={() => void handleStatusUpdate()} disabled={statusSaving}>
                    {statusSaving ? "正在保存..." : willBan ? "确认停用" : "确认恢复"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// 手机号脱敏
function maskPhone(phone: string): string {
  if (phone.length >= 7) {
    return phone.slice(0, 3) + "****" + phone.slice(-4);
  }
  return phone;
}

// 日期格式化
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 等级 Badge
function LevelBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    free: "bg-mint-soft text-tl",
    plus: "bg-yellow-soft text-am",
    pro: "bg-blue-soft text-pp",
  };
  const labels: Record<string, string> = {
    free: "Free",
    plus: "Plus",
    pro: "Pro",
  };
  return (
    <span
      className={cn(
        "inline-block px-2 py-0.5 rounded-ds-pill text-ds-xs font-ds-semibold",
        styles[level] || "bg-warm text-txs"
      )}
    >
      {labels[level] || level}
    </span>
  );
}

// 状态 Badge
function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block px-2 py-0.5 rounded-ds-pill text-ds-xs font-ds-semibold",
        status === "active"
          ? "bg-mint-soft text-tl"
          : "bg-error-bg text-error-tx"
      )}
    >
      {status === "active" ? "正常" : "封禁"}
    </span>
  );
}

// CSV 导出（UTF-8 BOM 确保中文兼容）
function exportCSV(students: StudentItem[]) {
  const BOM = "﻿";
  const header = "昵称,手机号,等级,学分,奖励学分,状态,注册日期,最后活跃,已完成,学习中\n";
  const rows = students
    .map((s) =>
      [
        s.nickname,
        s.phone,
        s.access_level,
        formatCredits(s.total_credits),
        formatCredits(s.bonus_credits),
        s.status === "active" ? "正常" : "封禁",
        formatDate(s.created_at),
        s.last_active_at ? formatDate(s.last_active_at) : "从未活跃",
        s.completed_courses,
        s.in_progress_courses,
      ].join(",")
    )
    .join("\n");

  const blob = new Blob([BOM + header + rows], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `学员名单_${formatDate(new Date().toISOString())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// 学分格式化
function formatCredits(credits: number): string {
  return credits % 1 === 0 ? String(credits) : credits.toFixed(1);
}
