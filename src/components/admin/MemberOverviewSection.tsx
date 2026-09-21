import { UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import type { MemberOverviewData } from "@/db/admin-api";
import { getAdminMemberOverview } from "@/db/admin-api";

export default function MemberOverviewSection() {
  const [data, setData] = useState<MemberOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const result = await getAdminMemberOverview();
        setData(result);
      } catch {
        setError("加载会员数据失败，请刷新重试");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingOverlay message="正在加载会员数据..." />;
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
  if (!data) return null;

  const recentRegistrations = data.monthly_growth[data.monthly_growth.length - 1]?.new_members ?? 0;

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Users}
          value={data.total}
          label="会员总数"
          color="text-ac"
          accentBg="bg-pink-soft"
        />
        <StatCard
          icon={UserPlus}
          value={recentRegistrations}
          label="本月新注册"
          color="text-tl"
          accentBg="bg-mint-soft"
        />
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-ds-lg border border-bd p-4 md:p-6 shadow-ds-xs hover-lift">
          <h3 className="text-ds-md font-ds-bold text-tx mb-4 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-tl inline-block"></span>
            月度注册增长（近 12 月）
          </h3>
          {data.monthly_growth.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.monthly_growth}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bdl)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                  width={36}
                />
                <Tooltip
                  labelFormatter={(v: string) => `${v}`}
                  formatter={(value: number) => [`${value} 人`, "新增会员"]}
                />
                <Line
                  type="monotone"
                  dataKey="new_members"
                  stroke="var(--ac)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "var(--ac)" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-txs text-center py-12">暂无数据</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  color,
  accentBg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  color: string;
  accentBg: string;
}) {
  return (
    <div className="bg-white rounded-ds-lg border border-bd p-3 md:p-4 text-center hover-lift">
      <div className={`w-9 h-9 rounded-ds-full ${accentBg} flex items-center justify-center mx-auto mb-2`}>
        <Icon className={`w-4.5 h-4.5 ${color}`} />
      </div>
      <p className={`text-ds-xl md:text-ds-2xl font-ds-black ${color}`}>
        {value}
      </p>
      <p className="text-ds-xs text-txs mt-0.5">{label}</p>
    </div>
  );
}
