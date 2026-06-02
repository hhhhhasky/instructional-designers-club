import { useState, useEffect } from "react";
import { Users, UserPlus, Crown } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import { getAdminMemberOverview } from "@/db/admin-api";
import type { MemberOverviewData } from "@/db/admin-api";

// 图表颜色
const LEVEL_COLORS: Record<string, string> = {
  free: "#2a7a6e", // tl 青绿
  plus: "#b8860b", // am 琥珀金
  pro: "#6b4d8a", // pp 紫色
};

const LEVEL_LABELS: Record<string, string> = {
  free: "免费会员",
  plus: "Plus 会员",
  pro: "Pro 会员",
};

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

  // 饼图数据
  const pieData = data.distribution.map((d) => ({
    name: LEVEL_LABELS[d.access_level] || d.access_level,
    value: d.count,
    level: d.access_level,
  }));

  // 等级人数映射
  const countByLevel: Record<string, number> = {};
  for (const d of data.distribution) {
    countByLevel[d.access_level] = d.count;
  }

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Users}
          value={data.total}
          label="会员总数"
          color="text-ac"
          accentBg="bg-pink-soft"
        />
        <StatCard
          icon={UserPlus}
          value={countByLevel.free || 0}
          label="免费会员"
          color="text-tl"
          accentBg="bg-mint-soft"
        />
        <StatCard
          icon={Crown}
          value={countByLevel.plus || 0}
          label="Plus 会员"
          color="text-am"
          accentBg="bg-yellow-soft"
        />
        <StatCard
          icon={Crown}
          value={countByLevel.pro || 0}
          label="Pro 会员"
          color="text-pp"
          accentBg="bg-blue-soft"
        />
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 等级分布饼图 */}
        <div className="bg-white rounded-ds-lg border border-bd p-4 md:p-6 shadow-ds-xs hover-lift">
          <h3 className="text-ds-md font-ds-bold text-tx mb-4 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-ac inline-block"></span>
            会员等级分布
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {pieData.map((entry) => (
                    <Cell
                      key={entry.level}
                      fill={LEVEL_COLORS[entry.level] || "#999"}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-txs text-center py-12">暂无数据</p>
          )}
        </div>

        {/* 月度增长折线图 */}
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
