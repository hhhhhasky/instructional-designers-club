import { useState, useEffect, useMemo } from "react";
import { Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAdminStudentList } from "@/db/admin-api";
import type { StudentItem } from "@/db/admin-api";

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
                    <LevelBadge level={student.access_level} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={student.status} />
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
                    colSpan={8}
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
  const header = "昵称,手机号,等级,状态,注册日期,最后活跃,已完成,学习中\n";
  const rows = students
    .map((s) =>
      [
        s.nickname,
        s.phone,
        s.access_level,
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
