import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAdminCourseRankings } from "@/db/admin-api";
import type { CourseRankingItem } from "@/db/admin-api";

type SortKey = "view_count" | "completion_rate" | "active_learners";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "view_count", label: "按观看数" },
  { key: "completion_rate", label: "按完课率" },
  { key: "active_learners", label: "按活跃学员" },
];

export default function CourseRankingsSection() {
  const [courses, setCourses] = useState<CourseRankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("view_count");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const result = await getAdminCourseRankings();
        setCourses(result);
      } catch {
        setError("加载课程数据失败，请刷新重试");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const sorted = useMemo(() => {
    return [...courses].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [courses, sortKey]);

  const top10 = useMemo(() => sorted.slice(0, 10), [sorted]);

  if (loading) return <LoadingOverlay message="正在加载课程数据..." />;
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
      {/* 排序切换 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-ds-sm text-txs mr-1">排序方式：</span>
        {SORT_OPTIONS.map((opt) => (
          <Button
            key={opt.key}
            variant={sortKey === opt.key ? "default" : "outline"}
            size="sm"
            onClick={() => setSortKey(opt.key)}
            className={cn(
              "text-ds-sm",
              sortKey === opt.key && "bg-ac text-white hover:bg-ac-dark"
            )}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Top 10 柱状图 */}
      <div className="bg-white rounded-ds-lg border border-bd p-4 md:p-6 shadow-ds-xs hover-lift">
        <h3 className="text-ds-md font-ds-bold text-tx mb-4 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-ac inline-block"></span>
          Top 10 课程
        </h3>
        {top10.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={top10}
              layout="vertical"
              margin={{ left: 20, right: 20 }}
            >
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                dataKey="title"
                type="category"
                tick={{ fontSize: 12 }}
                width={120}
                tickFormatter={(v: string) =>
                  v.length > 8 ? v.slice(0, 8) + "…" : v
                }
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    view_count: "观看数",
                    completion_rate: "完课率(%)",
                    active_learners: "活跃学员",
                  };
                  return [value, labels[name] || name];
                }}
                labelFormatter={() => ""}
              />
              <Bar
                dataKey={sortKey}
                fill="var(--ac)"
                radius={[0, 4, 4, 0]}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-txs text-center py-12">暂无数据</p>
        )}
      </div>

      {/* 完整排行表 */}
      <div className="bg-white rounded-ds-lg border border-bd overflow-hidden shadow-ds-xs hover-lift">
        <div className="overflow-x-auto">
          <table className="w-full text-ds-sm">
            <thead>
              <tr className="border-b border-bd bg-warm">
                <th className="text-left px-4 py-3 font-ds-semibold text-tx">
                  课程名称
                </th>
                <th className="text-left px-4 py-3 font-ds-semibold text-tx">
                  分类
                </th>
                <th className="text-right px-4 py-3 font-ds-semibold text-tx">
                  观看数
                </th>
                <th className="text-right px-4 py-3 font-ds-semibold text-tx">
                  学习人数
                </th>
                <th className="text-right px-4 py-3 font-ds-semibold text-tx">
                  活跃学员
                </th>
                <th className="text-right px-4 py-3 font-ds-semibold text-tx">
                  完课人数
                </th>
                <th className="text-right px-4 py-3 font-ds-semibold text-tx">
                  完课率
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((course, i) => (
                <tr
                  key={course.id}
                  className="border-b border-bdl hover:bg-bgs/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-txs mr-2">{i + 1}.</span>
                    {course.title}
                  </td>
                  <td className="px-4 py-3 text-txs">
                    {course.category || "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {course.view_count}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {course.total_learners}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {course.active_learners}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {course.completed_learners}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <CompletionBadge rate={course.completion_rate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CompletionBadge({ rate }: { rate: number }) {
  let colorClass = "text-tl"; // 绿色 > 50%
  if (rate < 20) colorClass = "text-red-500";
  else if (rate < 50) colorClass = "text-am";

  return <span className={cn("font-ds-semibold", colorClass)}>{rate}%</span>;
}
