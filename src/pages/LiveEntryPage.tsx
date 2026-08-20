import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, Radio } from "lucide-react";
import Footer from "@/components/common/Footer";
import Header from "@/components/layout/Header";
import PageMeta from "@/components/common/PageMeta";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getLiveSessionsForParticipants } from "@/db/live-api";
import type { LiveSession } from "@/lib/live";

export default function LiveEntryPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomCode, setRoomCode] = useState("");

  useEffect(() => {
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        if (!cancelled) setLoading(true);
        const rows = await getLiveSessionsForParticipants();
        if (!cancelled) setSessions(rows);
      } catch {
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(load, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user]);

  const normalizedCode = roomCode.replace(/\D/g, "").slice(0, 6);

  return (
    <>
      <PageMeta title="Live 互动" description="进入当前正在进行的直播互动课堂" noIndex />
      <div className="flex min-h-screen flex-col bg-cream">
        <Header />
        <main className="flex-1 px-4 pb-16 pt-24 md:pb-12">
          <div className="mx-auto max-w-4xl">
            <section className="editorial-paper relative overflow-hidden p-5 md:p-8">
              <span className="editorial-stamp">NOW LIVE</span>
              <h1 className="mt-4 font-serif text-ds-3xl font-ds-black text-tx">Live 实时互动</h1>
              <p className="mt-2 max-w-xl text-ds-sm leading-7 text-txs">
                这里只显示正在发生的课堂。输入 6 位房间号，或在下方选择当前开放的互动房间。
              </p>

              {authLoading ? (
                <div className="mt-8 flex items-center gap-2 text-txs">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在确认登录状态...
                </div>
              ) : !user ? (
                <div className="mt-8 rounded-ds-xl border border-bd bg-bg/70 p-5">
                  <p className="font-ds-bold text-tx">请先登录后进入互动课堂</p>
                  <p className="mt-1 text-ds-sm text-txs">Live 答题会绑定你的会员账号，用于保存当前答案。</p>
                  <Button className="mt-4 bg-ac text-white hover:bg-acd hover:text-white" onClick={() => navigate("/login", { state: { from: "/live" } })}>
                    前往登录
                  </Button>
                </div>
              ) : (
                <>
                  <form
                    className="mt-7 flex flex-col gap-2 sm:flex-row"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (normalizedCode.length === 6) navigate(`/live/${normalizedCode}`);
                    }}
                  >
                    <input
                      value={normalizedCode}
                      onChange={(event) => setRoomCode(event.target.value)}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="输入 6 位房间号"
                      aria-label="输入 6 位房间号"
                      className="h-12 flex-1 rounded-ds-lg border border-bd bg-bg px-4 font-mono text-ds-lg tracking-[.32em] text-tx placeholder:font-sans placeholder:tracking-normal placeholder:text-txt focus:border-ac focus:outline-none focus:ring-2 focus:ring-ac/20"
                    />
                    <Button
                      type="submit"
                      disabled={normalizedCode.length !== 6}
                      className="h-12 rounded-ds-lg bg-ac px-5 text-white hover:bg-acd hover:text-white"
                    >
                      进入房间
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </form>

                  <div className="mt-8">
                    {loading ? (
                      <div className="flex items-center gap-2 text-txs">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        正在读取当前互动...
                      </div>
                    ) : sessions.length === 0 ? (
                      <div className="rounded-ds-xl border border-dashed border-bd bg-white/55 p-6 text-center">
                        <Radio className="mx-auto h-7 w-7 text-txt" />
                        <p className="mt-2 font-ds-bold text-tx">当前暂无互动</p>
                        <p className="mt-1 text-ds-sm text-txs">直播开启后，这里会显示可进入的房间。</p>
                      </div>
                    ) : (
                      <ul className="grid gap-2">
                        {sessions.map((session) => (
                          <li key={session.id}>
                            <Link
                              to={`/live/${session.room_code}`}
                              className="group flex items-center gap-3 rounded-ds-xl border border-bd bg-white/65 p-4 transition-all hover:-translate-y-0.5 hover:border-ac/50 hover:shadow-ds-sm"
                            >
                              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-ds-full bg-tll text-tl">
                                <Radio className="h-5 w-5" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-ds-bold text-ds-md text-tx">{session.title}</span>
                                <span className="font-mono text-ds-xs text-txs">房间号 {session.room_code}</span>
                              </span>
                              <ArrowRight className="h-4 w-4 text-txs transition-transform group-hover:translate-x-1 group-hover:text-ac" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
