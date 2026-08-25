import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Eye,
  Loader2,
  Radio,
  RefreshCw,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getAdminLiveSessionDashboard, getAdminLiveSessions } from "@/db/live-api";
import { supabase } from "@/db/supabase";
import {
  LIVE_QUESTION_STATE_LABELS,
  LIVE_QUESTION_TYPE_LABELS,
  LIVE_STATUS_LABELS,
  extractLiveEvent,
  formatLiveAnswer,
  formatLiveAudience,
  getLiveTopic,
  type LiveSession,
} from "@/lib/live";
import type { AdminLiveSessionDashboard } from "@/lib/live-dashboard";

type PresenceMeta = { user_id?: string; display_name?: string; role?: "admin" | "participant" };

function flattenPresence(state: Record<string, PresenceMeta[]>): PresenceMeta[] {
  return Object.values(state).flat();
}

function learnerOnlineCount(users: PresenceMeta[]): number {
  return new Set(
    users
      .filter((item) => item.role !== "admin")
      .map((item) => item.user_id ?? JSON.stringify(item)),
  ).size;
}

function statusTone(status: LiveSession["status"]): string {
  if (status === "live") return "bg-[#d7efe8] text-[#23675d]";
  if (status === "draft") return "bg-[#f8e9cf] text-[#8f5b1f]";
  return "bg-white/10 text-white/65";
}

function formatTime(date: Date | null): string {
  return date ? date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-";
}

export default function LiveDashboardSection() {
  const { user, profile } = useAuth();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<AdminLiveSessionDashboard | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<PresenceMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedId) ?? null,
    [sessions, selectedId],
  );

  const loadSessions = useCallback(async () => {
    const rows = await getAdminLiveSessions();
    setSessions(rows);
    setSelectedId((current) => {
      if (current && rows.some((row) => row.id === current)) return current;
      return rows.find((row) => row.status === "live")?.id ?? rows[0]?.id ?? null;
    });
    return rows;
  }, []);

  const loadDashboard = useCallback(async (session: LiveSession, silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      setDashboard(await getAdminLiveSessionDashboard(session));
      setUpdatedAt(new Date());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Live 看板数据读取失败");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async (silent = false) => {
    try {
      if (!silent) setRefreshing(true);
      const rows = await loadSessions();
      const session = rows.find((row) => row.id === selectedId)
        ?? rows.find((row) => row.status === "live")
        ?? rows[0];
      if (session) await loadDashboard(session, silent);
      else {
        setDashboard(null);
        setLoading(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Live 房间读取失败");
      setLoading(false);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [loadDashboard, loadSessions, selectedId]);

  useEffect(() => {
    void loadSessions().catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Live 房间读取失败");
      setLoading(false);
    });
  }, [loadSessions]);

  useEffect(() => {
    if (!selectedSession) {
      setDashboard(null);
      setLoading(false);
      return;
    }
    void loadDashboard(selectedSession);
  }, [loadDashboard, selectedSession]);

  useEffect(() => {
    if (!selectedSession || selectedSession.status !== "live" || !user?.id) {
      setOnlineUsers([]);
      return;
    }
    let disposed = false;
    let channel: RealtimeChannel;
    channel = supabase.channel(getLiveTopic(selectedSession.id), {
      config: {
        private: true,
        broadcast: { self: false },
        presence: { key: user.id },
      },
    });
    channel
      .on("broadcast", { event: "*" }, (payload) => {
        const event = extractLiveEvent(payload);
        if (!event) return;
        if (event.event === "response_changed") {
          void loadDashboard(selectedSession, true);
          return;
        }
        void refreshAll(true);
      })
      .on("presence", { event: "sync" }, () => {
        setOnlineUsers(flattenPresence(channel.presenceState() as Record<string, PresenceMeta[]>));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && !disposed) {
          void channel.track({
            user_id: user.id,
            display_name: profile?.nickname ?? "主持人",
            role: "admin",
          });
        }
      });

    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
      setOnlineUsers([]);
    };
  }, [loadDashboard, profile?.nickname, refreshAll, selectedSession, user?.id]);

  const onlineCount = learnerOnlineCount(onlineUsers);
  const currentQuestion = dashboard?.questions.find(
    (item) => item.question.id === dashboard.session.current_question_id,
  ) ?? null;
  const questionChart = dashboard?.questions.map((item) => ({
    name: `Q${item.question.position}`,
    title: item.question.title,
    rate: item.responseRate,
    responses: item.answeredCount,
  })) ?? [];

  if (loading && !dashboard) {
    return (
      <div className="grid min-h-[480px] place-items-center rounded-ds-xl border border-bd bg-white text-txs shadow-ds-xs">
        <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-ac" />正在生成 Live 大型数据看板...</span>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="grid min-h-[420px] place-items-center rounded-ds-xl border border-dashed border-bd bg-white/60 p-8 text-center">
        <div><Radio className="mx-auto h-8 w-8 text-txt" /><h2 className="mt-3 font-serif text-ds-xl font-ds-black text-tx">还没有 Live 房间</h2><p className="mt-2 text-ds-sm text-txs">请先在数据管理中创建一场 Live 互动。</p></div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="rounded-ds-xl border border-red-200 bg-red-50 p-8 text-center">
        <CircleAlert className="mx-auto h-8 w-8 text-red-500" />
        <p className="mt-3 text-ds-sm text-red-700">{error || "Live 看板数据读取失败"}</p>
        <Button variant="outline" className="mt-4" onClick={() => void refreshAll()}>重新加载</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="relative isolate overflow-hidden rounded-[24px] bg-[#173d39] px-5 py-6 text-white shadow-ds-xl md:px-8 md:py-8">
        <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,.2)_1px,transparent_0)] [background-size:22px_22px]" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full border-[44px] border-[#de7856]/15" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[#efb393]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[.06] px-3 py-1 text-[11px] font-ds-bold tracking-[.16em]"><Activity className="h-3.5 w-3.5" /> LIVE PULSE</span>
              <span className="text-ds-xs text-white/55">更新于 {formatTime(updatedAt)}</span>
            </div>
            <h2 className="mt-4 font-serif text-[1.8rem] font-ds-black leading-tight md:text-[2.4rem]">{dashboard.session.title}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-ds-xs text-white/60">
              <span className={`rounded-full px-2.5 py-1 font-ds-bold ${statusTone(dashboard.session.status)}`}>{LIVE_STATUS_LABELS[dashboard.session.status]}</span>
              <span className="rounded-full border border-white/15 px-2.5 py-1 font-mono">房间 {dashboard.session.room_code ?? "未开启"}</span>
              <span>{LIVE_QUESTION_STATE_LABELS[dashboard.session.question_state]}</span>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
            <select
              value={selectedId ?? ""}
              onChange={(event) => setSelectedId(event.target.value)}
              aria-label="选择 Live 场次"
              className="h-11 min-w-[240px] rounded-ds-lg border border-white/15 bg-[#244f48] px-3 text-ds-sm text-white focus:outline-none"
            >
              {sessions.map((session) => <option key={session.id} value={session.id}>{LIVE_STATUS_LABELS[session.status]} · {session.title}</option>)}
            </select>
            <Button variant="outline" onClick={() => void refreshAll()} disabled={refreshing} className="border-white/20 bg-white/[.06] text-white hover:bg-white/10 hover:text-white">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />刷新
            </Button>
            {dashboard.session.room_code && dashboard.session.status === "live" ? (
              <Button asChild className="bg-[#de7856] text-white hover:bg-[#c96546]">
                <a href={`/live/${dashboard.session.room_code}/dashboard`} target="_blank" rel="noreferrer">学员展示屏 <ArrowUpRight className="h-4 w-4" /></a>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="relative mt-7 grid gap-px overflow-hidden rounded-ds-lg border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi icon={Eye} label="当前在线" value={dashboard.session.status === "live" ? onlineCount : 0} note="Presence 实时学员数" />
          <Kpi icon={Users} label="累计进入" value={dashboard.participantCount} note="本场去重学员数" />
          <Kpi icon={CheckCircle2} label="参与答题" value={dashboard.answeredParticipantCount} note={`覆盖率 ${dashboard.overallParticipationRate}%`} />
          <Kpi icon={BarChart3} label="互动题数" value={dashboard.questionCount} note="含尚未发布的题目" />
          <Kpi icon={Activity} label="答题人次" value={dashboard.totalResponses} note="每人每题计 1 次" />
        </div>
      </section>

      {error ? <div className="rounded-ds-md border border-amber-200 bg-amber-50 px-4 py-3 text-ds-sm text-amber-800">本次实时刷新失败，当前仍显示上一次成功数据。</div> : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)]">
        <article className="rounded-ds-xl border border-bd bg-white p-4 shadow-ds-xs md:p-6">
          <SectionHeading eyebrow="QUESTION REACH" title="每道题的互动参与" description="作答人数 ÷ 该题目标人数，兼容全员题与定向题" />
          {questionChart.length > 0 ? (
            <div className="mt-4 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={questionChart} layout="vertical" margin={{ top: 4, right: 28, left: 4, bottom: 0 }}>
                  <CartesianGrid stroke="var(--bdl)" strokeDasharray="3 4" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11, fill: "var(--txs)" }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={42} tick={{ fontSize: 11, fill: "var(--tx)" }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value: number) => [`${value}%`, "参与率"]} labelFormatter={(_, payload) => payload[0]?.payload?.title ?? ""} />
                  <Bar dataKey="rate" fill="#2f7469" radius={[0, 6, 6, 0]} barSize={18} background={{ fill: "#eef1eb", radius: 6 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState text="当前场次还没有题目" />}
        </article>

        <article className="rounded-ds-xl border border-bd bg-[#f8f2e9] p-4 shadow-ds-xs md:p-6">
          <SectionHeading eyebrow="CURRENT QUESTION" title="当前答题现状" description="选项分布随学员提交或改答实时刷新" />
          {currentQuestion ? (
            <div className="mt-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-serif text-ds-xl font-ds-black text-tx">Q{currentQuestion.question.position} · {currentQuestion.question.title}</p>
                <span className="text-ds-xs text-txs">{currentQuestion.answeredCount} / {currentQuestion.targetParticipantCount} 人已答 · {currentQuestion.responseRate}%</span>
              </div>
              <p className="mt-2 text-ds-xs font-ds-bold text-ac">{formatLiveAudience(currentQuestion.question)}</p>
              <OptionBars options={currentQuestion.options} />
              <p className="mt-4 border-t border-bd pt-3 text-ds-xs text-txs">正确答案 <span className="font-ds-bold text-tl">{formatLiveAnswer(currentQuestion.question.correct_answer)}</span> · 正确率 {currentQuestion.correctRate}%</p>
            </div>
          ) : <EmptyState text="等待主持人发布题目" />}
        </article>
      </section>

      <section className="rounded-ds-xl border border-bd bg-white p-4 shadow-ds-xs md:p-6">
        <SectionHeading eyebrow="QUESTION DETAIL" title="逐题互动明细" description="同时对比作答人数、参与率、选项分布和正确率" />
        {dashboard.questions.length > 0 ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {dashboard.questions.map((item) => (
              <article key={item.question.id} className="rounded-ds-xl border border-bd bg-bg/70 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0"><p className="text-[10px] font-ds-black tracking-[.14em] text-ac">Q{item.question.position} · {LIVE_QUESTION_TYPE_LABELS[item.question.type]}</p><h3 className="mt-1 line-clamp-2 font-serif text-ds-lg font-ds-black text-tx">{item.question.title}</h3><p className="mt-1 text-[10px] font-ds-bold text-ac">{formatLiveAudience(item.question)} · 目标 {item.targetParticipantCount} 人</p></div>
                  <div className="shrink-0 text-right"><p className="font-serif text-ds-2xl font-ds-black text-tx">{item.answeredCount}</p><p className="text-[10px] text-txs">/{item.targetParticipantCount} 人 · {item.responseRate}%</p></div>
                </div>
                <OptionBars options={item.options} compact />
                <div className="mt-3 flex items-center justify-between border-t border-bdl pt-3 text-[11px] text-txs"><span>正确率 {item.correctRate}%</span><span>正确答案 {formatLiveAnswer(item.question.correct_answer)}</span></div>
              </article>
            ))}
          </div>
        ) : <EmptyState text="当前场次还没有题目数据" />}
      </section>

      <p className="px-1 text-[11px] leading-5 text-txt">数据口径：“当前在线”来自 Realtime Presence；“累计进入”为本场去重进入账号；单题参与率按该题目标受众计算，指定学员与标签命中者去重。记录功能上线前的历史场次只能从已有作答者回填，因此其累计进入数是可恢复的下限。</p>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, note }: { icon: typeof Users; label: string; value: number; note: string }) {
  return <div className="bg-[#173d39]/90 p-4"><div className="flex items-center gap-2 text-[#efb393]"><Icon className="h-4 w-4" /><span className="text-[10px] font-ds-black tracking-[.12em]">{label}</span></div><p className="mt-2 font-serif text-[2rem] font-ds-black leading-none">{value.toLocaleString("zh-CN")}</p><p className="mt-2 text-[10px] text-white/45">{note}</p></div>;
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div><p className="text-[10px] font-ds-black tracking-[.16em] text-ac">{eyebrow}</p><h3 className="mt-1 font-serif text-ds-xl font-ds-black text-tx">{title}</h3><p className="mt-1 text-ds-xs leading-5 text-txs">{description}</p></div>;
}

function OptionBars({ options, compact = false }: { options: AdminLiveSessionDashboard["questions"][number]["options"]; compact?: boolean }) {
  return <div className={`${compact ? "mt-4 gap-2" : "mt-5 gap-3"} grid`}>{options.map((option) => <div key={option.id}><div className="flex justify-between gap-3 text-ds-xs"><span className="min-w-0 truncate font-ds-semibold text-tx">{option.id.length === 1 ? `${option.id} · ` : ""}{option.label}</span><span className="shrink-0 text-txs">{option.count} 人 · {option.percentage}%</span></div><div className={`${compact ? "mt-1 h-2" : "mt-1.5 h-2.5"} overflow-hidden rounded-full bg-white`}><div className="h-full rounded-full bg-gradient-to-r from-[#2f7469] to-[#de7856] transition-[width] duration-300" style={{ width: `${Math.min(100, option.percentage)}%` }} /></div></div>)}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="grid min-h-48 place-items-center text-center text-ds-sm text-txs">{text}</div>;
}
