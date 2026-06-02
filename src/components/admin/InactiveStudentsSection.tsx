import { useState, useEffect, useMemo } from "react";
import { UserX, AlertTriangle } from "lucide-react";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { getAdminInactiveStudents } from "@/db/admin-api";
import type { InactiveStudentsData } from "@/db/admin-api";

export default function InactiveStudentsSection() {
  const [data, setData] = useState<InactiveStudentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const result = await getAdminInactiveStudents();
        setData(result);
      } catch {
        setError("加载沉默学员数据失败，请刷新重试");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const zeroCount = data?.zero_record_students.length ?? 0;
  const total = data?.total_members ?? 1;

  // 构建不活跃阈值数据
  const inactiveThresholds = useMemo(() => {
    if (!data) return [];
    return data.inactive_counts.map((ic) => ({
      ...ic,
      percentage: total > 0 ? Math.round((ic.count / total) * 1000) / 10 : 0,
    }));
  }, [data, total]);

  if (loading) return <LoadingOverlay message="正在加载沉默学员数据..." />;
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

  return (
    <div className="space-y-6">
      {/* 摘要卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 零记录学员 */}
        <SummaryCard
          icon={UserX}
          label="零学习记录"
          count={zeroCount}
          total={total}
          accent={
            zeroCount / total > 0.5
              ? "danger"
              : zeroCount / total > 0.25
                ? "warning"
                : "good"
          }
        />
        {/* 各不活跃阈值 */}
        {inactiveThresholds.map((t) => (
          <SummaryCard
            key={t.days_threshold}
            icon={AlertTriangle}
            label={`${t.days_threshold} 天未活跃`}
            count={t.count}
            total={total}
            accent={
              t.percentage > 50
                ? "danger"
                : t.percentage > 25
                  ? "warning"
                  : "good"
            }
          />
        ))}
      </div>

      {/* 零记录学员列表 */}
      <div className="bg-white rounded-ds-lg border border-bd overflow-hidden shadow-ds-xs">
        <Accordion type="single" collapsible>
          <AccordionItem value="zero-record">
            <AccordionTrigger className="px-4 hover:no-underline hover:bg-bgs/50 transition-colors">
              <div className="flex items-center gap-2">
                <UserX className="w-4 h-4 text-ac" />
                <span className="font-ds-semibold text-tx">
                  零学习记录学员
                </span>
                <span className="text-ds-xs text-txs">
                  （{zeroCount} 人，占比{" "}
                  {(total > 0
                    ? Math.round((zeroCount / total) * 1000) / 10
                    : 0)
                  }%）
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="px-4">
                {data.zero_record_students.length > 0 ? (
                  <table className="w-full text-ds-sm">
                    <thead>
                      <tr className="border-b border-bd">
                        <th className="text-left py-2 font-ds-semibold text-txs">
                          昵称
                        </th>
                        <th className="text-left py-2 font-ds-semibold text-txs">
                          手机号
                        </th>
                        <th className="text-center py-2 font-ds-semibold text-tx-secondary">
                          等级
                        </th>
                        <th className="text-left py-2 font-ds-semibold text-txs">
                          注册日期
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.zero_record_students.map((s) => (
                        <tr
                          key={s.id}
                          className="border-b border-bdl last:border-0 hover:bg-bgs/50 transition-colors"
                        >
                          <td className="py-2 text-tx">{s.nickname}</td>
                          <td className="py-2 text-txs font-mono">
                            {maskPhone(s.phone)}
                          </td>
                          <td className="py-2 text-center">
                            <LevelBadge level={s.access_level} />
                          </td>
                          <td className="py-2 text-txs">
                            {formatDate(s.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-txs text-center py-6">
                    没有零学习记录的学员 🎉
                  </p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}

// 摘要卡片
function SummaryCard({
  icon: Icon,
  label,
  count,
  total,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  total: number;
  accent: "danger" | "warning" | "good";
}) {
  const percentage =
    total > 0 ? Math.round((count / total) * 1000) / 10 : 0;

  const iconBgStyles = {
    danger: "bg-error-bg",
    warning: "bg-yellow-soft",
    good: "bg-mint-soft",
  };

  const iconStyles = {
    danger: "text-error-tx",
    warning: "text-am",
    good: "text-tl",
  };

  const valueStyles = {
    danger: "text-error-tx",
    warning: "text-am",
    good: "text-tl",
  };

  return (
    <div className="bg-white rounded-ds-lg border border-bd p-4 hover-lift flex items-start gap-3">
      <div className={cn("w-10 h-10 rounded-ds-lg flex items-center justify-center shrink-0", iconBgStyles[accent])}>
        <Icon className={cn("w-5 h-5", iconStyles[accent])} />
      </div>
      <div className="min-w-0">
        <p className={cn("text-ds-2xl font-ds-black leading-tight", valueStyles[accent])}>
          {count}
          <span className="text-ds-sm font-ds-regular text-txs ml-1">
            人
          </span>
        </p>
        <p className="text-ds-xs text-txs mt-0.5">
          {label}（{percentage}%）
        </p>
      </div>
    </div>
  );
}

function maskPhone(phone: string): string {
  if (phone.length >= 7) {
    return phone.slice(0, 3) + "****" + phone.slice(-4);
  }
  return phone;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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
