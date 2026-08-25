import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ArrowLeft, BarChart3, CheckCircle2, Eye, Loader2, Radio, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import Footer from "@/components/common/Footer";
import PageMeta from "@/components/common/PageMeta";
import Header from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  getLiveParticipantSnapshot,
  getLiveRoomAudienceSummary,
  recordLiveParticipant,
  type LiveParticipantSnapshot,
} from "@/db/live-api";
import { supabase } from "@/db/supabase";
import {
  LIVE_QUESTION_STATE_LABELS,
  extractLiveEvent,
  formatLiveAnswer,
  getLiveTopic,
} from "@/lib/live";
import type { LiveRoomAudienceSummary } from "@/lib/live-dashboard";

type PresenceMeta = { user_id?: string; role?: "admin" | "participant" };

function flattenPresence(state: Record<string, PresenceMeta[]>): PresenceMeta[] {
  return Object.values(state).flat();
}

function learnerOnlineCount(users: PresenceMeta[]): number {
  return new Set(users.filter((item) => item.role !== "admin").map((item) => item.user_id ?? JSON.stringify(item))).size;
}

export default function LiveAudienceDashboardPage() {
  const { roomCode = "" } = useParams();
  const { user, profile, loading: authLoading } = useAuth();
  const [snapshot, setSnapshot] = useState<LiveParticipantSnapshot | null>(null);
  const [summary, setSummary] = useState<LiveRoomAudienceSummary | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<PresenceMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ended, setEnded] = useState(false);
  const liveId = snapshot?.session.id;
  const liveStatus = snapshot?.session.status;

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const nextSnapshot = await getLiveParticipantSnapshot(roomCode, user.id);
      if (!nextSnapshot) {
        setSnapshot(null);
        setSummary(null);
        return;
      }
      await recordLiveParticipant(nextSnapshot.session.id);
      const nextSummary = await getLiveRoomAudienceSummary(nextSnapshot.session.id);
      setSnapshot(nextSnapshot);
      setSummary(nextSummary);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Live 展示屏读取失败");
    } finally {
      setLoading(false);
    }
  }, [roomCode, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [authLoading, refresh, user]);

  useEffect(() => {
    if (!liveId || liveStatus !== "live" || !user?.id) return;
    let disposed = false;
    let channel: RealtimeChannel;
    channel = supabase.channel(getLiveTopic(liveId), {
      config: { private: true, broadcast: { self: false }, presence: { key: user.id } },
    });
    channel
      .on("broadcast", { event: "*" }, (payload) => {
        const event = extractLiveEvent(payload);
        if (!event) return;
        if (event.event === "session_ended") {
          setEnded(true);
          return;
        }
        void refresh();
      })
      .on("presence", { event: "sync" }, () => {
        setOnlineUsers(flattenPresence(channel.presenceState() as Record<string, PresenceMeta[]>));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && !disposed) {
          void channel.track({ user_id: user.id, display_name: profile?.nickname ?? "学员", role: "participant" });
          void refresh();
        }
      });
    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
      setOnlineUsers([]);
    };
  }, [liveId, liveStatus, profile?.nickname, refresh, user?.id]);

  const onlineCount = learnerOnlineCount(onlineUsers);
  const participationRate = useMemo(() => {
    if (!summary || summary.targetedCount === 0) return 0;
    return Math.round((summary.answeredCount / summary.targetedCount) * 1000) / 10;
  }, [summary]);

  return (
    <>
      <PageMeta title="Live 互动数据展示屏" description="查看当前 Live 房间的匿名互动数据" noIndex />
      <div className="flex min-h-screen flex-col bg-[#f4efe7]">
        <Header />
        <main className="flex-1 px-3 pb-16 pt-24 sm:px-5 md:pb-12">
          <div className="mx-auto max-w-[1500px]">
            <Link to={`/live/${roomCode}`} className="inline-flex items-center gap-1.5 text-ds-sm text-txs transition-colors hover:text-ac"><ArrowLeft className="h-4 w-4" />返回答题</Link>

            {authLoading || loading ? (
              <div className="mt-4 grid min-h-[520px] place-items-center rounded-[24px] border border-bd bg-white text-txs shadow-ds-sm"><span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-ac" />正在连接 Live 数据展示屏...</span></div>
            ) : !user ? (
              <MessageCard title="请先登录" message="Live 数据展示屏只对登录学员开放。" action={<Button asChild className="mt-5"><Link to="/login" state={{ from: `/live/${roomCode}/dashboard` }}>前往登录</Link></Button>} />
            ) : ended ? (
              <MessageCard title="本场互动已结束" message="展示屏已停止实时刷新，感谢参与。" />
            ) : error && !snapshot ? (
              <MessageCard title="无法打开展示屏" message={error} action={<Button variant="outline" className="mt-5" onClick={() => void refresh()}>重新加载</Button>} />
            ) : !snapshot || !summary ? (
              <MessageCard title="房间未开放" message="请确认房间号，或等待主持人开启互动。" />
            ) : (
              <div className="mt-4 space-y-5">
                <section className="relative isolate overflow-hidden rounded-[28px] bg-[#173d39] px-5 py-7 text-white shadow-ds-xl md:px-9 md:py-10">
                  <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,.2)_1px,transparent_0)] [background-size:24px_24px]" />
                  <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border-[54px] border-[#de7856]/15" />
                  <div className="relative flex flex-wrap items-start justify-between gap-5">
                    <div><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.06] px-3 py-1 text-[11px] font-ds-bold tracking-[.16em] text-[#efb393]"><Radio className="h-3.5 w-3.5" /> LIVE NOW</span><h1 className="mt-4 font-serif text-[2rem] font-ds-black leading-tight md:text-[3rem]">{snapshot.session.title}</h1><p className="mt-2 font-mono text-ds-sm text-white/50">房间 {snapshot.session.room_code} · {LIVE_QUESTION_STATE_LABELS[snapshot.session.question_state]}</p></div>
                    <Button asChild className="bg-[#de7856] text-white hover:bg-[#c96546]"><Link to={`/live/${roomCode}`}>返回作答</Link></Button>
                  </div>
                  <div className="relative mt-8 grid gap-px overflow-hidden rounded-ds-xl border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-5">
                    <AudienceKpi icon={Eye} label="当前在线" value={onlineCount} note="Presence 实时学员数" />
                    <AudienceKpi icon={Users} label="累计进入" value={summary.joinedCount} note="本场去重参与者" />
                    <AudienceKpi icon={Users} label="本题目标" value={summary.targetedCount} note="定向受众去重人数" />
                    <AudienceKpi icon={CheckCircle2} label="当前题已答" value={summary.answeredCount} note="每人只计当前答案" />
                    <AudienceKpi icon={BarChart3} label="当前题参与率" value={`${participationRate}%`} note="已答 ÷ 本题目标" />
                  </div>
                </section>

                <section className="rounded-[24px] border border-bd bg-white p-5 shadow-ds-sm md:p-8">
                  {snapshot.question ? (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-ds-black tracking-[.16em] text-ac">CURRENT QUESTION</p><h2 className="mt-2 font-serif text-ds-2xl font-ds-black text-tx">Q{snapshot.question.position} · {snapshot.question.title}</h2><p className="mt-2 max-w-4xl whitespace-pre-wrap text-ds-sm leading-7 text-txs">{snapshot.question.content}</p></div><span className="rounded-full bg-tll px-3 py-1 text-ds-xs font-ds-bold text-tl">{LIVE_QUESTION_STATE_LABELS[snapshot.session.question_state]}</span></div>
                      {snapshot.response && snapshot.results ? (
                        <div className="mt-7"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-serif text-ds-xl font-ds-black text-tx">大家的选择</h3><span className="text-ds-xs text-txs">{snapshot.results.answeredCount} 人已答 · 只显示匿名聚合</span></div><div className="mt-5 grid gap-4">{snapshot.results.options.map((option) => <div key={option.id}><div className="flex justify-between gap-4 text-ds-sm"><span className="min-w-0 truncate font-ds-bold text-tx">{option.id.length === 1 && snapshot.question?.type !== "true_false" ? `${option.id} · ` : ""}{option.label}</span><span className="shrink-0 text-txs">{option.count} 人 · {option.percentage}%</span></div><div className="mt-2 h-4 overflow-hidden rounded-full bg-bgs"><div className="h-full rounded-full bg-gradient-to-r from-[#2f7469] to-[#de7856] transition-[width] duration-300" style={{ width: `${Math.min(100, option.percentage)}%` }} /></div></div>)}</div>{snapshot.session.question_state === "revealed" && snapshot.correctAnswer !== null ? <p className="mt-6 border-t border-bdl pt-4 text-ds-sm text-txs">正确答案 <span className="font-ds-black text-tl">{formatLiveAnswer(snapshot.correctAnswer)}</span></p> : null}</div>
                      ) : (
                        <div className="mt-7 grid min-h-56 place-items-center rounded-ds-xl border border-dashed border-bd bg-bg/60 p-6 text-center"><div><BarChart3 className="mx-auto h-8 w-8 text-txt" /><p className="mt-3 font-ds-bold text-tx">提交答案后显示选项分布</p><p className="mt-1 text-ds-sm text-txs">为避免当前统计影响你的选择，作答前只展示人数。</p><Button asChild className="mt-4 bg-ac text-white hover:bg-acd"><Link to={`/live/${roomCode}`}>去作答</Link></Button></div></div>
                      )}
                    </>
                  ) : <div className="grid min-h-72 place-items-center text-center"><div><Radio className="mx-auto h-8 w-8 text-txt" /><h2 className="mt-3 font-serif text-ds-xl font-ds-black text-tx">{snapshot.session.current_question_id ? "当前没有为你发布题目" : "等待发布题目"}</h2><p className="mt-2 text-ds-sm text-txs">{snapshot.session.current_question_id ? "主持人正在为不同学习进度的学员安排不同问题，请继续保持在线。" : "主持人发布后，本页会自动更新。"}</p></div></div>}
                </section>
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

function AudienceKpi({ icon: Icon, label, value, note }: { icon: typeof Users; label: string; value: number | string; note: string }) {
  return <div className="bg-[#173d39]/90 p-5"><div className="flex items-center gap-2 text-[#efb393]"><Icon className="h-4 w-4" /><span className="text-[10px] font-ds-black tracking-[.12em]">{label}</span></div><p className="mt-3 font-serif text-[2.2rem] font-ds-black leading-none">{typeof value === "number" ? value.toLocaleString("zh-CN") : value}</p><p className="mt-2 text-[10px] text-white/45">{note}</p></div>;
}

function MessageCard({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return <div className="mt-4 grid min-h-[480px] place-items-center rounded-[24px] border border-bd bg-white p-8 text-center shadow-ds-sm"><div><Radio className="mx-auto h-9 w-9 text-txt" /><h1 className="mt-4 font-serif text-ds-2xl font-ds-black text-tx">{title}</h1><p className="mt-2 text-ds-sm text-txs">{message}</p>{action}</div></div>;
}
