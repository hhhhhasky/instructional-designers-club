import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  Clock3,
  Database,
  Gauge,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getAdminHaiDashboard,
  rollbackHaiDailyReview,
  triggerHaiDailyReview,
  type HaiDashboardData,
  type HaiDashboardRangeDays,
} from "@/db/hai-analytics";
import {
  haiIntentLabel,
  haiSceneLabel,
  haiSupportDepthLabel,
  haiUserGoalLabel,
} from "@/lib/hai-intents";

const RANGE_OPTIONS: Array<{ value: HaiDashboardRangeDays; label: string }> = [
  { value: 7, label: "近 7 天" },
  { value: 30, label: "近 30 天" },
  { value: 90, label: "近 90 天" },
];

export default function HaiDashboardSection() {
  const [rangeDays, setRangeDays] = useState<HaiDashboardRangeDays>(30);
  const [data, setData] = useState<HaiDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void getAdminHaiDashboard(rangeDays)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError("HAI 使用数据加载失败，请检查管理员权限后重试。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rangeDays, refreshKey]);

  if (loading && !data) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-ds-lg border border-bd bg-white text-txs">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        正在汇总 HAI 使用数据
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-ds-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-ds-sm text-red-700">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => setRefreshKey((key) => key + 1)}>
          重新加载
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const { summary } = data;
  const latestReview = data.daily_reviews[0];

  async function runReviewNow() {
    if (reviewing) return;
    setReviewing(true);
    setError("");
    try {
      await triggerHaiDailyReview();
      setRefreshKey((key) => key + 1);
    } catch {
      setError("手动复盘执行失败，请确认每日复盘函数和服务端密钥已部署。");
    } finally {
      setReviewing(false);
    }
  }

  async function rollbackLatestReview() {
    if (!latestReview || rollingBack) return;
    setRollingBack(true);
    setError("");
    try {
      await rollbackHaiDailyReview(latestReview.run_date);
      setRefreshKey((key) => key + 1);
    } catch {
      setError("回滚失败，请检查该次复盘的发布前快照。");
    } finally {
      setRollingBack(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-ds-xl bg-[#244f48] p-5 text-white shadow-ds-lg md:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/10 bg-white/[0.04]" />
        <div className="pointer-events-none absolute bottom-[-90px] left-[42%] h-52 w-52 rounded-full bg-[#c45d3e]/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[#f1b597]">
              <Bot className="h-5 w-5" />
              <span className="text-ds-xs font-ds-bold tracking-[0.18em]">HAI OPERATIONS</span>
            </div>
            <h2 className="font-serif text-ds-2xl font-ds-black md:text-ds-3xl">每一次调用，都能看见</h2>
            <p className="mt-2 max-w-2xl text-ds-sm leading-relaxed text-white/70">
              汇总真实使用、Token 成本、用户活跃与编排质检，让 HAI 的增长和质量在同一张看板上被判断。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-ds-md border border-white/15 bg-black/10 p-1">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRangeDays(option.value)}
                  className={`rounded-ds-sm px-3 py-1.5 text-ds-xs font-ds-bold transition ${
                    rangeDays === option.value ? "bg-white text-[#244f48]" : "text-white/70 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Button
              size="icon-sm"
              variant="outline"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              onClick={() => setRefreshKey((key) => key + 1)}
              aria-label="刷新 HAI 看板"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-ds-lg border border-white/10 bg-white/10 lg:grid-cols-4">
          <HeroMetric icon={Activity} label="使用次数" value={formatNumber(summary.request_count)} suffix="次" />
          <HeroMetric icon={Users} label="使用人数" value={formatNumber(summary.active_users)} suffix="人" />
          <HeroMetric icon={Database} label="Token 消耗" value={formatCompactNumber(summary.total_tokens)} suffix="" />
          <HeroMetric icon={Gauge} label="人均 Token" value={formatCompactNumber(summary.average_tokens_per_user)} suffix="" />
        </div>
      </section>

      <section className="rounded-ds-lg border border-bd bg-white p-4 shadow-ds-xs md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-ac" />
              <h3 className="text-ds-lg font-ds-black text-tx">每日复盘与受控迭代</h3>
            </div>
            <p className="mt-1 text-ds-xs leading-relaxed text-txs">
              每天 00:05 复盘前一日全部 HAI 回答；点踩优先。仅低风险且反事实 A/B 提分的表达层改动自动上线，核心边界与路由只生成待审核候选。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {latestReview?.publish_mode === "gated_auto" && (
              <Button variant="outline" disabled={rollingBack} onClick={() => void rollbackLatestReview()}>
                {rollingBack ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                {rollingBack ? "回滚中" : "回滚最近自动发布"}
              </Button>
            )}
            <Button variant="outline" disabled={reviewing} onClick={() => void runReviewNow()}>
              {reviewing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {reviewing ? "复盘执行中" : "立即复盘昨日"}
            </Button>
          </div>
        </div>

        {latestReview ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <ReviewMetric label="最近日期" value={latestReview.run_date} note={reviewStatusLabel(latestReview.status)} />
            <ReviewMetric label="复盘回答" value={`${latestReview.turns_evaluated}`} note={`低分 ${latestReview.low_score_count} 条`} />
            <ReviewMetric label="严格评分" value={latestReview.average_score == null ? "-" : `${latestReview.average_score}`} note={latestReview.pass_rate == null ? "尚无通过率" : `通过率 ${Math.round(latestReview.pass_rate * 100)}%`} />
            <ReviewMetric label="用户反馈" value={`${latestReview.positive_feedback_count}/${latestReview.negative_feedback_count}`} note="点赞 / 点踩" />
            <ReviewMetric label="发布结果" value={publishModeLabel(latestReview.publish_mode)} note={latestReview.note || latestReview.error_message || "无备注"} />
          </div>
        ) : (
          <p className="mt-5 rounded-ds-md bg-bg px-4 py-8 text-center text-ds-sm text-txs">尚无每日复盘记录，部署后可先手动补跑昨日。</p>
        )}

        {data.daily_reviews.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-ds-sm">
              <thead className="text-txs">
                <tr className="border-b border-bd"><th className="py-2">日期</th><th>状态</th><th className="text-right">回答</th><th className="text-right">均分</th><th className="text-right">低分</th><th>发布</th><th>结论</th></tr>
              </thead>
              <tbody>
                {data.daily_reviews.slice(0, 7).map((run) => (
                  <tr key={run.id} className="border-b border-bdl">
                    <td className="py-2 font-ds-semibold text-tx">{run.run_date}</td>
                    <td><Badge variant="outline">{reviewStatusLabel(run.status)}</Badge></td>
                    <td className="text-right text-txs">{run.turns_evaluated}</td>
                    <td className="text-right text-tx">{run.average_score ?? "-"}</td>
                    <td className="text-right text-red-600">{run.low_score_count}</td>
                    <td className="text-txs">{publishModeLabel(run.publish_mode)}</td>
                    <td className="max-w-sm truncate text-txs">{run.error_message || run.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-ds-md border border-amber-200 bg-amber-50 px-4 py-3 text-ds-sm text-amber-800">
          本次刷新失败，当前仍显示上一次成功加载的数据。
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SignalCard icon={ShieldCheck} label="调用成功率" value={`${formatDecimal(summary.success_rate)}%`} note={`${summary.request_count} 次最终状态`} tone="teal" />
        <SignalCard icon={Clock3} label="平均响应时间" value={formatDuration(summary.average_duration_ms)} note="仅统计有耗时记录的调用" tone="amber" />
        <SignalCard icon={BarChart3} label="平均质检分" value={summary.quality_average === null ? "暂无" : `${summary.quality_average} 分`} note={summary.quality_pass_rate === null ? "尚无 trace 评分" : `通过率 ${formatDecimal(summary.quality_pass_rate)}%`} tone="clay" />
        <SignalCard icon={AlertTriangle} label="未处理告警" value={`${summary.open_alerts} 条`} note={summary.open_alerts > 0 ? "建议优先检查额度与异常调用" : "当前运行平稳"} tone="red" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
        <div className="rounded-ds-lg border border-bd bg-white p-4 shadow-ds-xs md:p-6">
          <SectionTitle title="使用趋势" description={`近 ${rangeDays} 天调用量与 Token 消耗`} />
          <div className="mt-5 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.daily_usage} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--bdl)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--txs)" }} minTickGap={20} />
                <YAxis yAxisId="requests" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--txs)" }} width={34} />
                <YAxis yAxisId="tokens" orientation="right" tick={{ fontSize: 11, fill: "var(--txs)" }} tickFormatter={formatCompactNumber} width={48} />
                <Tooltip formatter={(value: number, name: string) => [name === "Token" ? formatNumber(value) : `${value} 次`, name]} />
                <Legend />
                <Bar yAxisId="requests" dataKey="requests" name="调用次数" fill="#c45d3e" radius={[5, 5, 0, 0]} maxBarSize={26} />
                <Line yAxisId="tokens" type="monotone" dataKey="tokens" name="Token" stroke="#2a7a6e" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-ds-lg border border-bd bg-white p-4 shadow-ds-xs md:p-6">
          <SectionTitle title="Token 结构" description="输入与输出成本拆分" />
          <div className="mt-7 space-y-6">
            <TokenMeter label="输入 Token" value={summary.input_tokens} total={summary.total_tokens} color="bg-tl" />
            <TokenMeter label="输出 Token" value={summary.output_tokens} total={summary.total_tokens} color="bg-ac" />
            <div className="grid grid-cols-2 gap-3 border-t border-bdl pt-5">
              <MiniMetric label="单次平均" value={formatCompactNumber(summary.average_tokens_per_request)} />
              <MiniMetric label="单用户平均" value={formatCompactNumber(summary.average_tokens_per_user)} />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-ds-lg border border-bd bg-white shadow-ds-xs">
        <div className="flex flex-col gap-2 border-b border-bd px-4 py-4 md:flex-row md:items-end md:justify-between md:px-6">
          <SectionTitle title="单用户 Token 消耗排行榜" description="按统计周期内实际 Token 总量降序排列" />
          <span className="text-ds-xs text-txs">共 {data.user_rankings.length} 位使用者</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-ds-sm">
            <thead className="bg-bgs/70 text-txs">
              <tr>
                <th className="w-16 px-4 py-3 text-center">排名</th>
                <th className="px-4 py-3">用户</th>
                <th className="px-4 py-3 text-right">使用次数</th>
                <th className="px-4 py-3 text-right">Token 总量</th>
                <th className="px-4 py-3 text-right">单次平均</th>
                <th className="px-4 py-3 text-right">失败</th>
                <th className="px-4 py-3 text-right">最近使用</th>
              </tr>
            </thead>
            <tbody>
              {data.user_rankings.map((user, index) => (
                <tr key={user.user_id} className="border-t border-bdl transition hover:bg-bgs/40">
                  <td className="px-4 py-3 text-center"><RankMark rank={index + 1} /></td>
                  <td className="px-4 py-3">
                    <p className="font-ds-bold text-tx">{user.nickname}</p>
                    <p className="mt-0.5 text-ds-xs text-txs">{maskPhone(user.phone)} · {user.access_level}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-tx">{formatNumber(user.request_count)}</td>
                  <td className="px-4 py-3 text-right font-ds-black text-ac">{formatNumber(user.total_tokens)}</td>
                  <td className="px-4 py-3 text-right text-txs">{formatNumber(user.average_tokens)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={user.failed_count > 0 ? "text-red-600" : "text-txs"}>{user.failed_count}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-ds-xs text-txs">{formatDateTime(user.last_used_at)}</td>
                </tr>
              ))}
              {data.user_rankings.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-txs">当前周期暂无 HAI 使用记录</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <div className="rounded-ds-lg border border-bd bg-white p-4 shadow-ds-xs md:p-6">
          <SectionTitle title="最近调用" description="从 HAI 配置页整合而来的使用明细" />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-ds-sm">
              <thead className="text-txs">
                <tr className="border-b border-bd"><th className="py-2">时间</th><th>用户</th><th>接口</th><th>状态</th><th className="text-right">Token</th><th className="text-right">耗时</th></tr>
              </thead>
              <tbody>
                {data.recent_events.slice(0, 12).map((event) => (
                  <tr key={event.id} className="border-b border-bdl">
                    <td className="py-2 text-ds-xs text-txs">{formatDateTime(event.created_at)}</td>
                    <td><span className="font-ds-semibold text-tx">{event.profile?.nickname ?? "未知用户"}</span></td>
                    <td className="text-txs">{event.route}</td>
                    <td><StatusBadge status={event.status} /></td>
                    <td className="text-right font-ds-semibold text-tx">{formatNumber(event.total_tokens ?? 0)}</td>
                    <td className="text-right text-txs">{formatDuration(event.duration_ms ?? 0)}</td>
                  </tr>
                ))}
                {data.recent_events.length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-txs">暂无调用记录</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-ds-lg border border-bd bg-white p-4 shadow-ds-xs md:p-6">
          <SectionTitle title="额度与运行告警" description="未处理异常集中查看" />
          <div className="mt-4 space-y-2">
            {data.alerts.slice(0, 8).map((alert) => (
              <div key={alert.id} className="rounded-ds-md border border-bd bg-bg p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className={alert.severity === "critical" ? "border-red-200 text-red-600" : "border-amber-200 text-amber-700"}>
                    {alert.severity}
                  </Badge>
                  <span className="text-[11px] text-txs">{formatDateTime(alert.created_at)}</span>
                </div>
                <p className="mt-2 text-ds-sm font-ds-bold text-tx">{alert.title}</p>
                <p className="mt-1 text-ds-xs leading-relaxed text-txs">{alert.description || alert.profile?.nickname || "HAI 运行告警"}</p>
              </div>
            ))}
            {data.alerts.length === 0 && (
              <div className="rounded-ds-md bg-[#eef7f4] px-4 py-10 text-center">
                <ShieldCheck className="mx-auto h-7 w-7 text-tl" />
                <p className="mt-2 text-ds-sm font-ds-bold text-tx">暂无未处理告警</p>
                <p className="mt-1 text-ds-xs text-txs">当前额度与运行状态平稳</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-ds-lg border border-bd bg-white p-4 shadow-ds-xs md:p-6">
        <SectionTitle title="最近编排 trace" description="从 HAI 配置页整合而来的路由与质检观察" />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data.recent_traces.map((trace) => (
            <div key={trace.id} className="rounded-ds-md border border-bd bg-bg p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">{haiIntentLabel(trace.intent)}</Badge>
                <Badge variant="outline" className={trace.passed === false ? "border-red-200 text-red-600" : "border-tl/30 text-tl"}>
                  {trace.score === null ? "未评分" : `${trace.score} 分`}
                </Badge>
              </div>
              <p className="mt-3 line-clamp-3 text-ds-sm leading-relaxed text-tx">{trace.question}</p>
              <div className="mt-3 space-y-1 text-[11px] text-txs">
                <p>场景：{haiSceneLabel(trace.scene)}</p>
                <p>目的：{haiUserGoalLabel(trace.user_goal)}</p>
                <p>支持：{haiSupportDepthLabel(trace.support_depth)}</p>
                <p>路由：{trace.route_method}</p>
                <p className="truncate">诊断：{trace.diagnostic_module}</p>
                <p>{formatDateTime(trace.created_at)}</p>
              </div>
              {trace.problems.length > 0 && <p className="mt-2 line-clamp-2 text-[11px] text-red-600">{trace.problems.join("；")}</p>}
            </div>
          ))}
          {data.recent_traces.length === 0 && (
            <p className="rounded-ds-md bg-bg px-4 py-10 text-center text-ds-sm text-txs md:col-span-2 xl:col-span-4">暂无编排 trace</p>
          )}
        </div>
      </section>
    </div>
  );
}

function HeroMetric({ icon: Icon, label, value, suffix }: { icon: typeof Activity; label: string; value: string; suffix: string }) {
  return (
    <div className="bg-[#244f48]/90 px-4 py-4 md:px-5">
      <div className="flex items-center gap-2 text-white/55"><Icon className="h-4 w-4" /><span className="text-ds-xs">{label}</span></div>
      <p className="mt-2 font-serif text-ds-2xl font-ds-black tracking-tight text-white">{value}<span className="ml-1 text-ds-xs font-ds-regular text-white/55">{suffix}</span></p>
    </div>
  );
}

function SignalCard({ icon: Icon, label, value, note, tone }: { icon: typeof Activity; label: string; value: string; note: string; tone: "teal" | "amber" | "clay" | "red" }) {
  const tones = { teal: "bg-tll text-tl", amber: "bg-aml text-am", clay: "bg-acl text-ac", red: "bg-red-50 text-red-600" };
  return (
    <div className="rounded-ds-lg border border-bd bg-white p-4 shadow-ds-xs">
      <div className={`flex h-9 w-9 items-center justify-center rounded-ds-full ${tones[tone]}`}><Icon className="h-4 w-4" /></div>
      <p className="mt-3 text-ds-xs text-txs">{label}</p>
      <p className="mt-1 text-ds-xl font-ds-black text-tx">{value}</p>
      <p className="mt-1 line-clamp-1 text-[11px] text-txt">{note}</p>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return <div><h3 className="text-ds-lg font-ds-black text-tx">{title}</h3><p className="mt-1 text-ds-xs text-txs">{description}</p></div>;
}

function TokenMeter({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percent = total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
  return (
    <div>
      <div className="flex items-end justify-between gap-3"><span className="text-ds-sm font-ds-bold text-tx">{label}</span><span className="text-ds-sm text-txs">{formatNumber(value)} · {percent}%</span></div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-ds-full bg-bgs"><div className={`h-full rounded-ds-full ${color}`} style={{ width: `${Math.min(100, percent)}%` }} /></div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] text-txs">{label}</p><p className="mt-1 text-ds-lg font-ds-black text-tx">{value}</p></div>;
}

function ReviewMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-ds-md bg-bg p-3"><p className="text-[11px] text-txs">{label}</p><p className="mt-1 text-ds-lg font-ds-black text-tx">{value}</p><p className="mt-1 line-clamp-1 text-[11px] text-txs">{note}</p></div>;
}

function reviewStatusLabel(status: "running" | "completed" | "failed" | "skipped") {
  return { running: "执行中", completed: "已完成", failed: "失败", skipped: "已跳过" }[status];
}

function publishModeLabel(mode: "none" | "pending" | "gated_auto" | "manual" | "rolled_back") {
  return { none: "未改动", pending: "待审核", gated_auto: "门禁自动发布", manual: "人工发布", rolled_back: "已回滚" }[mode];
}

function RankMark({ rank }: { rank: number }) {
  const style = rank === 1 ? "bg-ac text-white" : rank === 2 ? "bg-am text-white" : rank === 3 ? "bg-tl text-white" : "bg-bgs text-txs";
  return <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-ds-full px-2 text-ds-xs font-ds-black ${style}`}>{rank}</span>;
}

function StatusBadge({ status }: { status: "completed" | "cached" | "failed" }) {
  const labels = { completed: "成功", cached: "缓存", failed: "失败" };
  return <Badge variant="outline" className={status === "failed" ? "border-red-200 text-red-600" : "border-tl/30 text-tl"}>{labels[status]}</Badge>;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatDecimal(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDuration(milliseconds: number) {
  if (milliseconds <= 0) return "-";
  if (milliseconds < 1000) return `${milliseconds}ms`;
  return `${(milliseconds / 1000).toFixed(milliseconds >= 10000 ? 0 : 1)}s`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function maskPhone(phone: string) {
  return phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone || "无手机号";
}
