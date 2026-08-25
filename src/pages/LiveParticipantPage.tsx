import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, CheckCircle2, Loader2, Radio } from "lucide-react";
import { toast } from "sonner";
import Footer from "@/components/common/Footer";
import Header from "@/components/layout/Header";
import PageMeta from "@/components/common/PageMeta";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/db/supabase";
import {
  getLiveParticipantResults,
  getLiveParticipantSnapshot,
  recordLiveParticipant,
  submitLiveAnswer,
  type LiveParticipantSnapshot,
} from "@/db/live-api";
import {
  extractLiveEvent,
  formatLiveAnswer,
  getLiveTopic,
  isValidLiveAnswer,
  parseLiveAnswer,
  type LiveAnswer,
} from "@/lib/live";

export default function LiveParticipantPage() {
  const { roomCode = "" } = useParams();
  const { user, profile, loading: authLoading } = useAuth();
  const [snapshot, setSnapshot] = useState<LiveParticipantSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [draftAnswer, setDraftAnswer] = useState<LiveAnswer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const recordedLiveIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const nextSnapshot = await getLiveParticipantSnapshot(roomCode, user.id);
      setSnapshot(nextSnapshot);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "进入互动课堂失败，请刷新重试");
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
    let cancelled = false;
    setLoading(true);
    void refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, refresh, user]);

  useEffect(() => {
    if (!snapshot?.question || !snapshot.response) {
      setDraftAnswer(null);
      return;
    }
    setDraftAnswer(parseLiveAnswer(snapshot.response.answer));
  }, [snapshot?.question?.id, snapshot?.response]);

  useEffect(() => {
    const liveId = snapshot?.session.id;
    if (!liveId || recordedLiveIdRef.current === liveId) return;
    void recordLiveParticipant(liveId)
      .then(() => { recordedLiveIdRef.current = liveId; })
      .catch(() => {
        // 进入记录不影响答题主链路，下次进入时可恢复。
      });
  }, [snapshot?.session.id]);

  useEffect(() => {
    const liveId = snapshot?.session.id;
    if (!liveId || !user?.id || snapshot?.session.status !== "live") return;
    let disposed = false;
    const channel = supabase.channel(getLiveTopic(liveId), {
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
        if (event.event === "session_ended") {
          setEnded(true);
          return;
        }
        void refresh();
      })
      .on("presence", { event: "sync" }, () => {
        // Presence 只影响在线状态，V1 学员端不需要展示名单。
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && !disposed) {
          void channel.track({
            user_id: user.id,
            display_name: profile?.nickname ?? "学员",
            role: "participant",
          });
          // 订阅完成后再读一次数据库，处理晚进入、刷新和漏收事件。
          void refresh();
        }
      });

    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
    };
  }, [snapshot?.session.id, snapshot?.session.status, user?.id, profile?.nickname, refresh]);

  const question = snapshot?.question ?? null;
  const session = snapshot?.session ?? null;
  const canSubmit = session?.status === "live"
    && session.question_state === "answering"
    && question !== null
    && isValidLiveAnswer(question, draftAnswer);

  const toggleMultiple = (id: string) => {
    const current = Array.isArray(draftAnswer) ? draftAnswer : [];
    setDraftAnswer(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const handleSubmit = async () => {
    if (!question || !user || !canSubmit) return;
    try {
      setSubmitting(true);
      const response = await submitLiveAnswer(question.id, user.id, draftAnswer as LiveAnswer);
      setSnapshot((prev) => prev ? { ...prev, response } : prev);
      toast.success("答案已提交，作答结束前仍可修改");
      void getLiveParticipantResults(question.id)
        .then((results) => {
          setSnapshot((prev) => prev?.question?.id === question.id ? { ...prev, results } : prev);
        })
        .catch(() => {
          // 提交已成功；若聚合回读短暂失败，后续 Broadcast 或刷新会恢复。
        });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "提交答案失败");
      void refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageMeta title="互动课堂" description="参与当前 Live 互动答题" noIndex />
      <div className="flex min-h-screen flex-col bg-cream">
        <Header />
        <main className="flex-1 px-4 pb-16 pt-24 md:pb-12">
          <div className="mx-auto max-w-3xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                to="/live"
                className="inline-flex items-center gap-1.5 text-ds-sm text-txs transition-colors hover:text-ac"
              >
                <ArrowLeft className="h-4 w-4" />
                返回 Live 入口
              </Link>
              {snapshot?.session ? (
                <Link to={`/live/${roomCode}/dashboard`} className="inline-flex items-center gap-1.5 text-ds-xs font-ds-bold text-ac hover:underline">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Live 数据展示屏
                </Link>
              ) : null}
            </div>

            {authLoading || loading ? (
              <div className="editorial-paper mt-4 grid min-h-72 place-items-center p-8 text-txs">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在进入互动课堂...
                </span>
              </div>
            ) : !user ? (
              <div className="editorial-paper mt-4 p-8">
                <h1 className="font-serif text-ds-xl font-ds-black text-tx">请先登录</h1>
                <p className="mt-2 text-ds-sm text-txs">Live 答题需要绑定你的会员账号。</p>
                <Button className="mt-5 bg-ac text-white hover:bg-acd hover:text-white" asChild>
                  <Link to="/login" state={{ from: `/live/${roomCode}` }}>前往登录</Link>
                </Button>
              </div>
            ) : ended ? (
              <div className="editorial-paper mt-4 grid min-h-72 place-items-center p-8 text-center">
                <div>
                  <Radio className="mx-auto h-8 w-8 text-tl" />
                  <h1 className="mt-3 font-serif text-ds-xl font-ds-black text-tx">本场互动已结束</h1>
                  <p className="mt-2 text-ds-sm text-txs">感谢参与，当前房间已关闭提交。</p>
                </div>
              </div>
            ) : error ? (
              <div className="editorial-paper mt-4 grid min-h-72 place-items-center p-8 text-center">
                <div>
                  <h1 className="font-serif text-ds-xl font-ds-black text-tx">无法进入房间</h1>
                  <p className="mt-2 text-ds-sm text-txs">{error}</p>
                  <Button variant="outline" className="mt-5 bg-bg text-txs hover:text-ac" onClick={() => void refresh()}>
                    重新读取房间状态
                  </Button>
                </div>
              </div>
            ) : !snapshot ? (
              <div className="editorial-paper mt-4 grid min-h-72 place-items-center p-8 text-center">
                <div>
                  <h1 className="font-serif text-ds-xl font-ds-black text-tx">房间未开放</h1>
                  <p className="mt-2 text-ds-sm text-txs">请确认 6 位房间号，或等待主持人开启房间。</p>
                </div>
              </div>
            ) : !session ? (
              <div className="editorial-paper mt-4 grid min-h-72 place-items-center p-8 text-center">
                <div>
                  <h1 className="font-serif text-ds-xl font-ds-black text-tx">房间状态异常</h1>
                  <p className="mt-2 text-ds-sm text-txs">请重新进入房间。</p>
                </div>
              </div>
            ) : session.status === "ended" ? (
              <div className="editorial-paper mt-4 grid min-h-72 place-items-center p-8 text-center">
                <div>
                  <h1 className="font-serif text-ds-xl font-ds-black text-tx">本场互动已结束</h1>
                  <p className="mt-2 text-ds-sm text-txs">当前房间不再展示。</p>
                </div>
              </div>
            ) : !question || session.question_state === "waiting" ? (
              <div className="editorial-paper mt-4 grid min-h-72 place-items-center p-8 text-center">
                <div>
                  <span className="editorial-kicker">{session.room_code}</span>
                  <h1 className="mt-3 font-serif text-ds-xl font-ds-black text-tx">
                    {session.current_question_id && !question ? "当前没有为你发布题目" : "已进入互动课堂"}
                  </h1>
                  <p className="mt-2 text-ds-sm text-txs">
                    {session.current_question_id && !question
                      ? "主持人正在根据不同学习进度发布不同问题，请继续保持在线。"
                      : "等待主持人发布问题……"}
                  </p>
                </div>
              </div>
            ) : (
              <section className="editorial-paper mt-4 p-5 md:p-7">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="editorial-kicker">
                    {session.title} · 房间 {session.room_code}
                  </span>
                  <span className={`rounded-ds-pill px-3 py-1 text-ds-xs font-ds-bold ${
                    session.question_state === "answering" ? "bg-tll text-tl" : "bg-warm text-txs"
                  }`}>
                    {session.question_state === "answering" ? "作答中" : session.question_state === "closed" ? "作答已结束" : "答案已公布"}
                  </span>
                </div>

                <h1 className="mt-4 font-serif text-ds-2xl font-ds-black leading-tight text-tx">{question.title}</h1>
                <p className="mt-3 whitespace-pre-wrap text-ds-md leading-8 text-tx">{question.content}</p>

                <div className="mt-6 grid gap-2">
                  {question.type === "true_false" ? (
                    [true, false].map((value) => (
                      <button
                        key={String(value)}
                        type="button"
                        disabled={session.question_state !== "answering"}
                        onClick={() => setDraftAnswer(value)}
                        className={`flex min-h-14 items-center gap-3 rounded-ds-xl border px-4 py-3 text-left text-ds-md transition-all ${
                          draftAnswer === value
                            ? "border-ac bg-acl/60 text-ac font-ds-bold"
                            : "border-bd bg-white/65 text-tx hover:border-ac/50"
                        } disabled:opacity-60`}
                      >
                        <span className={`grid h-6 w-6 place-items-center rounded-full border ${
                          draftAnswer === value ? "border-ac bg-ac text-white" : "border-bd text-transparent"
                        }`}>
                          <CheckCircle2 className="h-4 w-4" />
                        </span>
                        {value ? "正确" : "错误"}
                      </button>
                    ))
                  ) : question.options.map((option) => {
                    const selected = question.type === "multiple_choice"
                      ? Array.isArray(draftAnswer) && draftAnswer.includes(option.id)
                      : draftAnswer === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={session.question_state !== "answering"}
                        onClick={() => question.type === "multiple_choice" ? toggleMultiple(option.id) : setDraftAnswer(option.id)}
                        className={`flex min-h-14 items-center gap-3 rounded-ds-xl border px-4 py-3 text-left transition-all ${
                          selected
                            ? "border-ac bg-acl/60 text-ac"
                            : "border-bd bg-white/65 text-tx hover:border-ac/50"
                        } disabled:opacity-60`}
                      >
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-ds-md border font-ds-bold ${
                          selected ? "border-ac bg-ac text-white" : "border-bd text-txs"
                        }`}>
                          {option.id}
                        </span>
                        <span className="flex-1 text-ds-md leading-7">{option.text}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex flex-col gap-3 border-t border-bdl pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-ds-xs text-txs">
                    {snapshot.response ? (
                      <>
                        当前答案：<span className="font-ds-bold text-tx">{formatLiveAnswer(snapshot.response.answer)}</span>
                        {session.question_state === "answering" ? " · 提交后仍可修改" : null}
                      </>
                    ) : session.question_state === "answering" ? "尚未提交答案" : "未提交答案"}
                    {session.question_state === "revealed" && snapshot.correctAnswer !== null ? (
                      <p className="mt-1">正确答案：<span className="font-ds-bold text-tl">{formatLiveAnswer(snapshot.correctAnswer)}</span></p>
                    ) : null}
                  </div>
                  {session.question_state === "answering" ? (
                    <Button
                      onClick={handleSubmit}
                      disabled={!canSubmit || submitting}
                      className="h-11 rounded-ds-lg bg-ac px-6 text-white hover:bg-acd hover:text-white"
                    >
                      {submitting ? "提交中..." : snapshot.response ? "修改答案" : "提交答案"}
                    </Button>
                  ) : (
                    <span className="rounded-ds-pill bg-warm px-4 py-2 text-ds-xs text-txs">
                      {session.question_state === "closed" ? "作答已结束，不能继续修改" : "答案已公布"}
                    </span>
                  )}
                </div>

                {snapshot.response && snapshot.results ? (
                  <div className="mt-5 rounded-ds-xl border border-bd bg-white/55 p-4" aria-live="polite">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="font-serif text-ds-lg font-ds-black text-tx">大家的选择</h2>
                      <span className="text-ds-xs text-txs">已答 {snapshot.results.answeredCount} 人 · 匿名统计</span>
                    </div>
                    <div className="mt-3 grid gap-3">
                      {snapshot.results.options.map((option) => (
                        <div key={option.id}>
                          <div className="flex items-center justify-between gap-3 text-ds-xs">
                            <span className="min-w-0 truncate font-ds-semibold text-tx">
                              {option.id.length === 1 && question.type !== "true_false" ? `${option.id} · ` : ""}{option.label}
                            </span>
                            <span className="shrink-0 text-txs">{option.count} 人 · {option.percentage}%</span>
                          </div>
                          <div className="mt-1.5 h-2.5 overflow-hidden rounded-ds-pill bg-warm">
                            <div
                              className="h-full rounded-ds-pill bg-gradient-to-r from-ac to-am transition-[width] duration-300"
                              style={{ width: `${Math.min(100, option.percentage)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    {question.type === "multiple_choice" ? (
                      <p className="mt-3 text-[11px] text-txt">多选题按每个选项分别统计，各项占比之和可能超过 100%。</p>
                    ) : null}
                  </div>
                ) : null}
              </section>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
