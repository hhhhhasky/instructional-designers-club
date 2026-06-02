import { useState, useEffect, useMemo } from "react";
import { Trophy } from "lucide-react";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAdminStudentLeaderboard } from "@/db/admin-api";
import type { LeaderboardStudentItem } from "@/db/admin-api";

type SortDimension = "total_credits" | "estimated_watch_minutes" | "avg_completion_rate";

const SORT_OPTIONS: { key: SortDimension; label: string }[] = [
  { key: "total_credits", label: "学分" },
  { key: "estimated_watch_minutes", label: "观看时长" },
  { key: "avg_completion_rate", label: "完成度" },
];

const TIER_OPTIONS: { value: string; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "plus", label: "Plus" },
  { value: "pro", label: "Pro" },
];

export default function StudentLeaderboardSection() {
  const [students, setStudents] = useState<LeaderboardStudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortDimension, setSortDimension] = useState<SortDimension>("total_credits");
  const [tierFilter, setTierFilter] = useState("plus");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const result = await getAdminStudentLeaderboard();
        setStudents(result);
      } catch {
        setError("加载排行榜数据失败，请刷新重试");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // 按等级过滤
  const filtered = useMemo(() => {
    return students.filter((s) => s.access_level === tierFilter);
  }, [students, tierFilter]);

  // 按维度降序排列 + 分配名次（同分并列）
  const ranked = useMemo(() => {
    const sorted = [...filtered].sort(
      (a, b) => b[sortDimension] - a[sortDimension]
    );

    // 分配名次（同分并列，跳过后续名次）
    let rank = 0;
    let prevValue: number | null = null;
    let sameCount = 0;
    return sorted.map((s) => {
      if (s[sortDimension] !== prevValue) {
        rank += 1 + sameCount;
        sameCount = 0;
        prevValue = s[sortDimension];
      } else {
        sameCount++;
      }
      return { ...s, rank };
    });
  }, [filtered, sortDimension]);

  // 各等级人数
  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = { free: 0, plus: 0, pro: 0 };
    students.forEach((s) => {
      if (counts[s.access_level] !== undefined) {
        counts[s.access_level]++;
      }
    });
    return counts;
  }, [students]);

  if (loading) return <LoadingOverlay message="正在加载排行榜数据..." />;
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
    <div className="space-y-6">
      {/* 控制栏 */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* 排序维度 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-ds-sm text-txs mr-1">排名维度：</span>
          {SORT_OPTIONS.map((opt) => (
            <Button
              key={opt.key}
              variant={sortDimension === opt.key ? "default" : "outline"}
              size="sm"
              onClick={() => setSortDimension(opt.key)}
              className={cn(
                "text-ds-sm",
                sortDimension === opt.key && "bg-ac text-white hover:bg-ac-dark"
              )}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        {/* 等级筛选 */}
        <div className="flex items-center gap-1.5 bg-warm rounded-ds-lg p-1">
          {TIER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTierFilter(opt.value)}
              className={cn(
                "px-3 py-1.5 text-ds-sm font-ds-semibold rounded-ds-md transition-all",
                tierFilter === opt.value
                  ? "bg-white text-ac shadow-ds-xs"
                  : "text-txs hover:text-tx"
              )}
            >
              {opt.label}
              <span className="ml-1 text-ds-xs opacity-60">
                {tierCounts[opt.value] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 排行榜表格 */}
      <div className="bg-white rounded-ds-lg border border-bd overflow-hidden shadow-ds-xs hover-lift">
        <div className="overflow-x-auto">
          <table className="w-full text-ds-sm">
            <thead>
              <tr className="border-b border-bd bg-warm">
                <th className="text-center px-4 py-3 font-ds-semibold text-tx w-16">
                  排名
                </th>
                <th className="text-left px-4 py-3 font-ds-semibold text-tx">
                  昵称
                </th>
                <th className="text-left px-4 py-3 font-ds-semibold text-tx">
                  手机号
                </th>
                <th className="text-right px-4 py-3 font-ds-semibold text-tx">
                  学分
                </th>
                <th className="text-right px-4 py-3 font-ds-semibold text-tx">
                  观看时长
                </th>
                <th className="text-right px-4 py-3 font-ds-semibold text-tx">
                  完成度
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((student) => (
                <tr
                  key={student.id}
                  className={cn(
                    "border-b border-bdl hover:bg-bgs/50 transition-colors",
                    student.rank <= 3 && "bg-warm/30"
                  )}
                >
                  <td className="px-4 py-3 text-center">
                    <RankBadge rank={student.rank} />
                  </td>
                  <td className="px-4 py-3 font-ds-medium text-tx">
                    {student.nickname}
                  </td>
                  <td className="px-4 py-3 text-txs font-mono">
                    {maskPhone(student.phone)}
                  </td>
                  <td className="px-4 py-3 text-right font-ds-semibold text-tx">
                    {formatCredits(student.total_credits)}
                  </td>
                  <td className="px-4 py-3 text-right text-txs">
                    {formatWatchMinutes(student.estimated_watch_minutes)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <CompletionBadge rate={student.avg_completion_rate} />
                  </td>
                </tr>
              ))}
              {ranked.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-txs">
                    该等级暂无学员数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==================== 子组件 ====================

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-ds-full bg-ac text-white text-ds-xs font-ds-black shadow-ds-accent">
        <Trophy className="w-3.5 h-3.5" />
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-ds-full bg-am text-white text-ds-xs font-ds-black">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-ds-full bg-tl text-white text-ds-xs font-ds-black">
        3
      </span>
    );
  }
  return (
    <span className="text-ds-sm text-txs font-ds-medium">{rank}</span>
  );
}

function CompletionBadge({ rate }: { rate: number }) {
  let colorClass = "text-tl"; // ≥ 50% 绿色
  if (rate < 20) colorClass = "text-red-500";
  else if (rate < 50) colorClass = "text-am";

  return (
    <span className={cn("font-ds-semibold", colorClass)}>{rate}%</span>
  );
}

// ==================== 工具函数 ====================

function maskPhone(phone: string): string {
  if (phone.length >= 7) {
    return phone.slice(0, 3) + "****" + phone.slice(-4);
  }
  return phone;
}

function formatWatchMinutes(minutes: number): string {
  if (minutes < 1) return "0分钟";
  if (minutes < 60) return `${Math.round(minutes)}分钟`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
}

function formatCredits(credits: number): string {
  return credits % 1 === 0 ? String(credits) : credits.toFixed(1);
}
