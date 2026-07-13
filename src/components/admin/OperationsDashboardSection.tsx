import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Crown,
  Lightbulb,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  buildOperationsMetrics,
  getAdminOperationsDashboard,
  type InsightTone,
  type OperationsDashboardSource,
} from "@/db/admin-operations";

interface OperationsDashboardSectionProps {
  onOpenDetail: (tab: string) => void;
}

export default function OperationsDashboardSection({ onOpenDetail }: OperationsDashboardSectionProps) {
  const navigate = useNavigate();
  const [source, setSource] = useState<OperationsDashboardSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await getAdminOperationsDashboard();
      setSource(result);
      setUpdatedAt(new Date());
    } catch (loadError) {
      console.error("getAdminOperationsDashboard error:", loadError);
      setError("运营数据汇总失败，请检查管理员权限后重试。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = useMemo(() => source ? buildOperationsMetrics(source) : null, [source]);

  if (loading && !source) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-ds-xl border border-bd bg-white text-txs shadow-ds-xs">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin text-ac" />
        正在拼合增长、学习、内容与 HAI 数据
      </div>
    );
  }

  if (!source || !metrics) {
    return (
      <div className="rounded-ds-xl border border-red-200 bg-red-50 p-8 text-center">
        <CircleAlert className="mx-auto h-8 w-8 text-red-500" />
        <p className="mt-3 text-ds-sm text-red-700">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => void load()}>重新加载</Button>
      </div>
    );
  }

  const memberMix = source.members.distribution.map((item) => ({
    ...item,
    label: levelLabel(item.access_level),
    percentage: source.members.total > 0 ? (item.count / source.members.total) * 100 : 0,
  }));
  const coursePerformance = [...source.courses]
    .sort((a, b) => b.total_learners - a.total_learners)
    .slice(0, 7)
    .map((course) => ({ ...course, shortTitle: shorten(course.title, 11) }));

  return (
    <div className="space-y-5">
      <section className="relative isolate overflow-hidden rounded-[24px] bg-[#173d39] px-5 py-6 text-white shadow-ds-xl md:px-8 md:py-8">
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,.18)_1px,transparent_0)] [background-size:22px_22px]" />
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[42px] border-[#de7856]/15" />
        <div className="pointer-events-none absolute bottom-[-110px] left-[35%] h-60 w-60 rounded-full bg-[#e2a75c]/10 blur-3xl" />

        <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_240px] xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[#f0b596]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11px] font-ds-bold tracking-[0.16em]">
                <Activity className="h-3.5 w-3.5" /> CLUB PULSE
              </span>
              <span className="text-ds-xs text-white/55">数据更新时间 {updatedAt ? formatTime(updatedAt) : "-"}</span>
            </div>
            <h2 className="mt-4 max-w-3xl font-serif text-[1.8rem] font-ds-black leading-[1.3] tracking-tight md:text-[2.35rem]">
              不只看数字，<span className="text-[#efb393]">看见运营下一步</span>
            </h2>
            <p className="mt-3 max-w-2xl text-ds-sm leading-7 text-white/65">
              把会员增长、首课激活、课程完成、内容供给与 HAI 质量放进同一条运营链，自动识别值得优先处理的信号。
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button className="bg-[#de7856] text-white hover:bg-[#c96546]" onClick={() => navigate("/admin/manage") }>
                进入数据维护 <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Button variant="outline" className="border-white/20 bg-white/[0.05] text-white hover:bg-white/10 hover:text-white" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> 刷新全量数据
              </Button>
            </div>
          </div>

          <HealthDial score={metrics.health_score} />
        </div>

        <div className="relative mt-7 grid gap-px overflow-hidden rounded-ds-lg border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-5">
          <HeroKpi icon={Users} label="会员总数" value={formatNumber(metrics.total_members)} note={`本月 +${metrics.current_month_growth}`} />
          <HeroKpi icon={Crown} label="付费会员占比" value={formatPercent(metrics.paid_ratio)} note={`${metrics.paid_members} 位 Plus / Pro`} />
          <HeroKpi icon={UserCheck} label="学习激活率" value={formatPercent(metrics.activation_rate)} note={`${metrics.zero_record_members} 位尚未首学`} />
          <HeroKpi icon={BookOpenCheck} label="课程加权完课率" value={formatPercent(metrics.completion_rate)} note={`${formatNumber(metrics.learner_touches)} 人次学习`} />
          <HeroKpi icon={Bot} label="HAI 使用覆盖" value={formatPercent(metrics.hai_adoption_rate)} note={`${source.hai.summary.active_users} 位近 30 天用户`} />
        </div>
      </section>

      {error && (
        <div className="rounded-ds-md border border-amber-200 bg-amber-50 px-4 py-3 text-ds-sm text-amber-800">
          本次刷新失败，当前仍显示上一次成功加载的数据。
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <article className="rounded-ds-xl border border-bd bg-white p-4 shadow-ds-xs md:p-6">
          <SectionHeading eyebrow="GROWTH" title="会员增长曲线" description="近 12 个月新增会员，观察增长是否连续而非只看总量" action={
            <GrowthPill value={metrics.growth_change} />
          } />
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={source.members.monthly_growth} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="memberGrowthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c65f42" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#c65f42" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--bdl)" strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="month" tickFormatter={(value: string) => value.slice(5)} tick={{ fontSize: 11, fill: "var(--txs)" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--txs)" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: number) => [`${value} 人`, "新增会员"]} labelFormatter={(label: string) => `${label}`} />
                <Area type="monotone" dataKey="new_members" stroke="#c65f42" strokeWidth={3} fill="url(#memberGrowthFill)" activeDot={{ r: 5, fill: "#c65f42", stroke: "#fff", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-ds-xl border border-bd bg-[#f8f2e9] p-4 shadow-ds-xs md:p-6">
          <SectionHeading eyebrow="MEMBERSHIP" title="会员结构" description="会员规模与转化结构同时判断" />
          <div className="mt-6 space-y-5">
            {memberMix.map((item) => (
              <div key={item.access_level}>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-ds-sm font-ds-bold text-tx">{item.label}</p>
                    <p className="mt-0.5 text-[11px] text-txs">{item.count} 人</p>
                  </div>
                  <p className="font-serif text-ds-xl font-ds-black text-tx">{formatPercent(item.percentage)}</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                  <div className={`h-full rounded-full ${levelColor(item.access_level)}`} style={{ width: `${Math.min(100, item.percentage)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => onOpenDetail("members")} className="mt-6 inline-flex items-center gap-1 text-ds-xs font-ds-bold text-ac hover:gap-2">
            查看会员趋势明细 <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
        <article className="rounded-ds-xl border border-bd bg-white p-4 shadow-ds-xs md:p-6">
          <SectionHeading eyebrow="LEARNING" title="课程吸引力 × 完成质量" description="按学习人数选择重点课程，再比较完课率" action={
            <button type="button" className="text-ds-xs font-ds-bold text-ac hover:underline" onClick={() => onOpenDetail("courses")}>完整排行</button>
          } />
          <div className="mt-4 h-[330px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={coursePerformance} layout="vertical" margin={{ top: 2, right: 28, left: 6, bottom: 0 }}>
                <CartesianGrid stroke="var(--bdl)" strokeDasharray="3 4" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11, fill: "var(--txs)" }} axisLine={false} tickLine={false} />
                <YAxis dataKey="shortTitle" type="category" width={105} tick={{ fontSize: 11, fill: "var(--tx)" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: number) => [`${value}%`, "完课率"]} labelFormatter={(_, payload) => payload[0]?.payload?.title ?? ""} />
                <Bar dataKey="completion_rate" fill="#2f7469" radius={[0, 6, 6, 0]} barSize={16} background={{ fill: "#eef1eb", radius: 6 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-ds-xl border border-bd bg-white p-4 shadow-ds-xs md:p-6">
          <SectionHeading eyebrow="NEXT ACTION" title="运营解读与建议" description="基于当前阈值自动生成，点击可直接进入对应工作区" />
          <div className="mt-4 space-y-3">
            {metrics.insights.map((insight, index) => (
              <div key={insight.id} className="group rounded-ds-lg border border-bd bg-bg p-3.5 transition hover:-translate-y-0.5 hover:border-ac/30 hover:shadow-ds-sm">
                <div className="flex gap-3">
                  <InsightMark tone={insight.tone} index={index + 1} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-ds-sm font-ds-black text-tx">{insight.title}</p>
                      <ToneLabel tone={insight.tone} />
                    </div>
                    <p className="mt-1.5 text-[11px] leading-5 text-txs">{insight.evidence}</p>
                    <p className="mt-2 border-l-2 border-am/50 pl-2 text-[11px] leading-5 text-tx">{insight.recommendation}</p>
                    <button
                      type="button"
                      onClick={() => insight.action_tab === "inactive" || insight.action_tab === "courses" || insight.action_tab === "hai"
                        ? onOpenDetail(insight.action_tab)
                        : navigate(`/admin/manage?tab=${insight.action_tab}`)}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-ds-bold text-ac"
                    >
                      {insight.action_label} <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatusCard icon={CheckCircle2} label="已发布课程" value={source.maintenance.published_courses} note={`${source.maintenance.draft_courses} 门草稿待维护`} tone="teal" onClick={() => navigate("/admin/manage?tab=courses")} />
        <StatusCard icon={Users} label="正常会员" value={source.maintenance.active_members} note={`${source.maintenance.banned_members} 个账号已停用`} tone="clay" onClick={() => navigate("/admin/manage?tab=students")} />
        <StatusCard icon={Sparkles} label="在架运营内容" value={source.maintenance.active_content} note="公告、活动与资源文章" tone="amber" onClick={() => navigate("/admin/manage?tab=content")} />
        <StatusCard icon={Clock3} label="待处理服务项" value={source.maintenance.pending_resets + source.maintenance.open_hai_alerts} note={`${source.maintenance.pending_resets} 重置 · ${source.maintenance.open_hai_alerts} 告警`} tone="red" onClick={() => navigate("/admin/manage?tab=reset")} />
      </section>

      <div className="flex items-start gap-2 rounded-ds-lg border border-dashed border-bd bg-white/60 px-4 py-3 text-[11px] leading-5 text-txs">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-am" />
        <p><strong className="text-tx">指标口径：</strong>学习激活率 = 有学习记录会员 / 全部会员；课程加权完课率 = 各课程完课人次 / 学习人次。课程人次会跨课程重复，不等同于独立会员数。运营健康度是用于发现趋势的组合信号，不替代财务或教学质量判断。</p>
      </div>
    </div>
  );
}

function HealthDial({ score }: { score: number }) {
  const status = score >= 80 ? "健康" : score >= 60 ? "需关注" : "待改善";
  return (
    <div className="mx-auto flex w-full max-w-[220px] flex-col items-center rounded-[22px] border border-white/10 bg-black/10 p-5 backdrop-blur-sm">
      <div className="relative grid h-32 w-32 place-items-center rounded-full" style={{ background: `conic-gradient(#efb393 ${score * 3.6}deg, rgba(255,255,255,.12) 0deg)` }}>
        <div className="grid h-[108px] w-[108px] place-items-center rounded-full bg-[#173d39] text-center">
          <div><p className="font-serif text-3xl font-ds-black">{score}</p><p className="text-[10px] tracking-[0.14em] text-white/45">HEALTH</p></div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-ds-xs"><span className="h-1.5 w-1.5 rounded-full bg-[#efb393]" />综合状态：{status}</div>
    </div>
  );
}

function HeroKpi({ icon: Icon, label, value, note }: { icon: typeof Users; label: string; value: string; note: string }) {
  return (
    <div className="bg-[#173d39]/90 p-4 md:p-5">
      <div className="flex items-center gap-2 text-white/50"><Icon className="h-4 w-4" /><span className="text-[11px]">{label}</span></div>
      <p className="mt-2 font-serif text-[1.55rem] font-ds-black tracking-tight text-white">{value}</p>
      <p className="mt-1 text-[10px] text-white/45">{note}</p>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div><p className="text-[10px] font-ds-black tracking-[0.18em] text-ac">{eyebrow}</p><h3 className="mt-1 text-ds-lg font-ds-black text-tx">{title}</h3><p className="mt-1 text-[11px] text-txs">{description}</p></div>
      {action}
    </div>
  );
}

function GrowthPill({ value }: { value: number | null }) {
  if (value === null) return <span className="rounded-full bg-bgs px-2.5 py-1 text-[11px] text-txs">暂无环比基数</span>;
  const rising = value >= 0;
  const Icon = rising ? TrendingUp : TrendingDown;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-ds-bold ${rising ? "bg-tll text-tl" : "bg-red-50 text-red-600"}`}><Icon className="h-3.5 w-3.5" />{rising ? "+" : ""}{value}% 环比</span>;
}

function InsightMark({ tone, index }: { tone: InsightTone; index: number }) {
  const classes: Record<InsightTone, string> = { critical: "bg-red-100 text-red-600", watch: "bg-amber-100 text-amber-700", positive: "bg-emerald-100 text-emerald-700", info: "bg-sky-100 text-sky-700" };
  return <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-ds-black ${classes[tone]}`}>{String(index).padStart(2, "0")}</span>;
}

function ToneLabel({ tone }: { tone: InsightTone }) {
  const config: Record<InsightTone, [string, string]> = { critical: ["优先", "text-red-600"], watch: ["观察", "text-amber-700"], positive: ["良好", "text-emerald-700"], info: ["提示", "text-sky-700"] };
  return <span className={`shrink-0 text-[10px] font-ds-bold ${config[tone][1]}`}>{config[tone][0]}</span>;
}

function StatusCard({ icon: Icon, label, value, note, tone, onClick }: { icon: typeof Users; label: string; value: number; note: string; tone: "teal" | "clay" | "amber" | "red"; onClick: () => void }) {
  const colors = { teal: "bg-tll text-tl", clay: "bg-acl text-ac", amber: "bg-aml text-am", red: "bg-red-50 text-red-600" };
  return (
    <button type="button" onClick={onClick} className="group flex items-center gap-3 rounded-ds-lg border border-bd bg-white p-4 text-left shadow-ds-xs transition hover:-translate-y-0.5 hover:shadow-ds-md">
      <span className={`grid h-10 w-10 place-items-center rounded-full ${colors[tone]}`}><Icon className="h-4.5 w-4.5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-[11px] text-txs">{label}</span><span className="mt-0.5 block text-ds-xl font-ds-black text-tx">{value}</span><span className="block truncate text-[10px] text-txt">{note}</span></span>
      <ArrowRight className="h-4 w-4 text-txt transition group-hover:translate-x-1 group-hover:text-ac" />
    </button>
  );
}

function levelLabel(level: string) {
  return ({ free: "Free 会员", plus: "Plus 会员", pro: "Pro 会员" } as Record<string, string>)[level] ?? level;
}

function levelColor(level: string) {
  return ({ free: "bg-tl", plus: "bg-am", pro: "bg-pp" } as Record<string, string>)[level] ?? "bg-ac";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatPercent(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(value);
}

function shorten(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length)}…` : value;
}
