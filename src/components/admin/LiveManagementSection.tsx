import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  Copy,
  DoorOpen,
  Loader2,
  Pencil,
  Plus,
  QrCode,
  Radio,
  RefreshCw,
  Search,
  Square,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import QuestionEditorModal from "@/components/live/QuestionEditorModal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/db/supabase";
import {
  copyLiveQuestion,
  createLiveQuestion,
  createLiveSession,
  deleteLiveQuestion,
  endLiveSession,
  getAdminLiveQuestions,
  getAdminLiveSessions,
  getLiveResponses,
  openLiveSession,
  updateLiveQuestion,
  updateLiveSessionState,
  updateLiveTitle,
  type LiveQuestionInput,
} from "@/db/live-api";
import { useAuth } from "@/contexts/AuthContext";
import {
  LIVE_QUESTION_STATE_LABELS,
  LIVE_QUESTION_TYPE_LABELS,
  LIVE_STATUS_LABELS,
  extractLiveEvent,
  formatLiveAnswer,
  getLiveControlCapabilities,
  getLiveTopic,
  isLiveQuestionEditable,
  nextLiveQuestionId,
  summarizeLiveResults,
  type AdminLiveQuestion,
  type LiveResponse,
  type LiveSession,
  type LiveStatus,
} from "@/lib/live";

type PresenceMeta = { user_id?: string; display_name?: string };

const STATUS_FILTERS: Array<{ value: LiveStatus | "all"; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "draft", label: "草稿" },
  { value: "live", label: "进行中" },
  { value: "ended", label: "已结束" },
];

function statusClass(status: LiveSession["status"]): string {
  if (status === "live") return "bg-tll text-tl";
  if (status === "draft") return "bg-aml text-am";
  return "bg-warm text-txs";
}

function getErrorText(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

function flattenPresence(state: Record<string, PresenceMeta[]>): PresenceMeta[] {
  return Object.values(state).flat();
}

export default function LiveManagementSection() {
  const { user, profile } = useAuth();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<AdminLiveQuestion[]>([]);
  const [responses, setResponses] = useState<LiveResponse[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<PresenceMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LiveStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AdminLiveQuestion | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [deleteQuestion, setDeleteQuestion] = useState<AdminLiveQuestion | null>(null);
  const [showQr, setShowQr] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedId) ?? null,
    [sessions, selectedId],
  );
  const currentQuestion = useMemo(
    () => questions.find((question) => question.id === selectedSession?.current_question_id) ?? null,
    [questions, selectedSession?.current_question_id],
  );
  const capabilities = selectedSession ? getLiveControlCapabilities(selectedSession) : null;

  const filteredSessions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return sessions.filter((session) => {
      if (statusFilter !== "all" && session.status !== statusFilter) return false;
      if (!keyword) return true;
      return session.title.toLowerCase().includes(keyword)
        || (session.room_code ?? "").includes(keyword);
    });
  }, [sessions, search, statusFilter]);

  const loadQuestions = useCallback(async (liveId: string) => {
    const rows = await getAdminLiveQuestions(liveId);
    setQuestions(rows);
    return rows;
  }, []);

  const loadResponses = useCallback(async (questionId: string | null) => {
    setResponses(questionId ? await getLiveResponses(questionId) : []);
  }, []);

  const loadSessions = useCallback(async (preferredId?: string | null) => {
    const rows = await getAdminLiveSessions();
    setSessions(rows);
    setSelectedId((current) => {
      const requested = preferredId ?? current;
      if (requested && rows.some((row) => row.id === requested)) return requested;
      return rows.find((row) => row.status === "live")?.id ?? rows[0]?.id ?? null;
    });
    return rows;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadSessions()
      .catch((error) => {
        if (!cancelled) toast.error(getErrorText(error, "读取 Live 房间失败"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadSessions]);

  useEffect(() => {
    if (!selectedId) {
      setQuestions([]);
      setResponses([]);
      setDraftTitle("");
      return;
    }
    let cancelled = false;
    setDetailsLoading(true);
    Promise.all([loadQuestions(selectedId), loadResponses(sessions.find((row) => row.id === selectedId)?.current_question_id ?? null)])
      .catch((error) => {
        if (!cancelled) toast.error(getErrorText(error, "读取题目或实时结果失败"));
      })
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });
    const session = sessions.find((row) => row.id === selectedId);
    setDraftTitle(session?.title ?? "");
    setShowQr(false);
    return () => {
      cancelled = true;
    };
  }, [selectedId, loadQuestions, loadResponses, sessions]);

  useEffect(() => {
    if (!selectedSession?.current_question_id && questions.length === 0) {
      setSelectedQuestionId(null);
      return;
    }
    if (selectedSession?.current_question_id) {
      setSelectedQuestionId((current) =>
        current && questions.some((question) => question.id === current)
          ? current
          : selectedSession.current_question_id,
      );
      return;
    }
    setSelectedQuestionId((current) =>
      current && questions.some((question) => question.id === current) ? current : questions[0]?.id ?? null,
    );
  }, [questions, selectedSession?.current_question_id]);

  const refreshRoom = useCallback(async () => {
    const sessionRows = await loadSessions(selectedId);
    if (selectedId) {
      const questionRows = await loadQuestions(selectedId);
      const session = sessionRows.find((row) => row.id === selectedId);
      await loadResponses(session?.current_question_id ?? questionRows[0]?.id ?? null);
    }
  }, [loadQuestions, loadResponses, loadSessions, selectedId]);

  useEffect(() => {
    const liveId = selectedSession?.id;
    if (!liveId || selectedSession?.status !== "live" || !user?.id) return;
    let disposed = false;
    const channel = supabase.channel(getLiveTopic(liveId), {
      config: {
        private: true,
        broadcast: { self: false },
        presence: { key: user.id },
      },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "*" }, (payload) => {
        const event = extractLiveEvent(payload);
        if (!event) return;
        if (event.event === "response_changed") {
          void loadResponses(event.questionId ?? selectedSession.current_question_id)
            .catch((error) => toast.error(getErrorText(error, "刷新实时答案失败")));
          return;
        }
        void refreshRoom().catch((error) => toast.error(getErrorText(error, "刷新房间状态失败")));
      })
      .on("presence", { event: "sync" }, () => {
        setOnlineUsers(flattenPresence(channel.presenceState() as Record<string, PresenceMeta[]>));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && !disposed) {
          void channel.track({
            user_id: user.id,
            display_name: profile?.nickname ?? "主持人",
          });
        }
        if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !disposed) {
          toast.error("Live 实时连接中断，页面会按数据库状态恢复");
        }
      });

    return () => {
      disposed = true;
      channelRef.current = null;
      void supabase.removeChannel(channel);
      setOnlineUsers([]);
    };
  }, [selectedSession?.id, selectedSession?.status, user?.id, profile?.nickname, loadResponses, refreshRoom]);

  const sendControlEvent = async (event: string, payload: Record<string, string>) => {
    const channel = channelRef.current;
    if (!channel) return false;
    const result = await channel.send({
      type: "broadcast",
      event,
      payload: { event, payload },
    });
    return result === "ok";
  };

  const replaceSession = (session: LiveSession) => {
    setSessions((prev) => prev.map((item) => item.id === session.id ? session : item));
  };

  const handleCreateSession = async () => {
    const title = newTitle.trim();
    if (!title) {
      toast.error("请输入直播标题");
      return;
    }
    try {
      setCreating(true);
      const session = await createLiveSession(title);
      await loadSessions(session.id);
      setCreateOpen(false);
      setNewTitle("");
      toast.success("直播已创建，现在可以提前出题");
    } catch (error) {
      toast.error(getErrorText(error, "创建直播失败"));
    } finally {
      setCreating(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!selectedSession) return;
    const title = draftTitle.trim();
    if (!title) {
      toast.error("直播标题不能为空");
      return;
    }
    try {
      setSavingTitle(true);
      replaceSession(await updateLiveTitle(selectedSession.id, title));
      toast.success("直播标题已保存");
    } catch (error) {
      toast.error(getErrorText(error, "保存标题失败"));
    } finally {
      setSavingTitle(false);
    }
  };

  const handleOpenRoom = async () => {
    if (!selectedSession) return;
    try {
      setAction("open");
      replaceSession(await openLiveSession(selectedSession.id));
      toast.success("房间已开启，学员可以通过房间号进入");
    } catch (error) {
      toast.error(getErrorText(error, "开启房间失败"));
    } finally {
      setAction(null);
    }
  };

  const control = async (
    actionName: string,
    update: () => Promise<LiveSession>,
    event: string,
    payload: Record<string, string>,
    successText: string,
  ) => {
    try {
      setAction(actionName);
      const session = await update();
      replaceSession(session);
      const sent = await sendControlEvent(event, payload);
      if (!sent) toast.warning("状态已保存，实时通知未确认；学员刷新后仍会恢复最新状态");
      else toast.success(successText);
    } catch (error) {
      toast.error(getErrorText(error, "更新互动状态失败"));
    } finally {
      setAction(null);
    }
  };

  const handlePublish = () => {
    if (!selectedSession || !selectedQuestionId) return;
    void control(
      "publish",
      () => updateLiveSessionState(selectedSession.id, {
        current_question_id: selectedQuestionId,
        question_state: "answering",
      }),
      "question_opened",
      { question_id: selectedQuestionId },
      "题目已发布",
    );
  };

  const handleClose = () => {
    if (!selectedSession?.current_question_id) return;
    void control(
      "close",
      () => updateLiveSessionState(selectedSession.id, { question_state: "closed" }),
      "question_closed",
      { question_id: selectedSession.current_question_id },
      "作答已停止",
    );
  };

  const handleReveal = () => {
    if (!selectedSession?.current_question_id) return;
    void control(
      "reveal",
      () => updateLiveSessionState(selectedSession.id, { question_state: "revealed" }),
      "answer_revealed",
      { question_id: selectedSession.current_question_id },
      "答案已公布",
    );
  };

  const handleNext = () => {
    if (!selectedSession) return;
    const nextId = nextLiveQuestionId(questions, selectedSession.current_question_id);
    if (!nextId) {
      toast.info("已经是最后一题");
      return;
    }
    setSelectedQuestionId(nextId);
    void control(
      "next",
      () => updateLiveSessionState(selectedSession.id, {
        current_question_id: nextId,
        question_state: "answering",
      }),
      "question_opened",
      { question_id: nextId },
      "下一题已发布",
    );
  };

  const handleEnd = async () => {
    if (!selectedSession) return;
    try {
      setAction("end");
      const session = await endLiveSession(selectedSession.id);
      replaceSession(session);
      const sent = await sendControlEvent("session_ended", { live_id: selectedSession.id });
      if (!sent) toast.warning("房间已结束，结束通知未确认");
      else toast.success("本场互动已结束");
    } catch (error) {
      toast.error(getErrorText(error, "结束房间失败"));
    } finally {
      setAction(null);
    }
  };

  const openEditor = (question: AdminLiveQuestion | null) => {
    setEditingQuestion(question);
    setEditorOpen(true);
  };

  const handleSaveQuestion = async (input: LiveQuestionInput) => {
    if (!selectedSession) return;
    try {
      setSavingQuestion(true);
      if (editingQuestion) {
        await updateLiveQuestion(editingQuestion.id, input);
        toast.success("题目已更新");
      } else {
        const created = await createLiveQuestion(selectedSession.id, input);
        setSelectedQuestionId(created.id);
        toast.success(selectedSession.status === "live" ? "临时题已加入，尚未发布" : "题目已保存");
      }
      const rows = await loadQuestions(selectedSession.id);
      if (selectedSession.current_question_id) {
        await loadResponses(selectedSession.current_question_id);
      }
      const savedId = editingQuestion?.id ?? rows[rows.length - 1]?.id;
      if (savedId) setSelectedQuestionId(savedId);
      setEditorOpen(false);
    } catch (error) {
      toast.error(getErrorText(error, "保存题目失败"));
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleCopyQuestion = async (question: AdminLiveQuestion) => {
    try {
      const created = await copyLiveQuestion(question.id);
      await loadQuestions(question.live_id);
      if (created) setSelectedQuestionId(created.id);
      toast.success("题目已复制");
    } catch (error) {
      toast.error(getErrorText(error, "复制题目失败"));
    }
  };

  const handleDeleteQuestion = async () => {
    if (!deleteQuestion) return;
    try {
      await deleteLiveQuestion(deleteQuestion.id);
      const rows = await loadQuestions(deleteQuestion.live_id);
      setSelectedQuestionId(rows[0]?.id ?? null);
      toast.success("题目已删除");
    } catch (error) {
      toast.error(getErrorText(error, "删除题目失败"));
    } finally {
      setDeleteQuestion(null);
    }
  };

  const summary = currentQuestion
    ? summarizeLiveResults(currentQuestion, currentQuestion.correct_answer, responses)
    : null;
  const roomUrl = selectedSession?.room_code
    ? `${window.location.origin}/live/${selectedSession.room_code}`
    : null;

  if (loading) {
    return (
      <div className="flex min-h-60 items-center justify-center gap-2 text-txs">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在读取 Live 房间...
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <section className="flex flex-col gap-3 rounded-ds-xl border border-bd bg-white/70 p-3 md:flex-row md:items-center md:justify-between md:p-4">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-txt" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索标题 / 房间号"
              className="h-11 w-full rounded-ds-lg border border-bd bg-bg pl-9 pr-3 text-ds-sm text-tx placeholder:text-txt focus:border-ac focus:outline-none focus:ring-2 focus:ring-ac/20"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as LiveStatus | "all")}
            className="h-11 rounded-ds-lg border border-bd bg-bg px-3 text-ds-sm text-tx focus:border-ac focus:outline-none"
            aria-label="状态筛选"
          >
            {STATUS_FILTERS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refreshRoom()} className="bg-bg text-txs hover:text-ac">
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="bg-ac text-white hover:bg-acd hover:text-white">
            <Plus className="h-4 w-4" />
            创建直播
          </Button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(220px,22%)_1fr]">
        <aside className="rounded-ds-xl border border-bd bg-white/70 p-2">
          <p className="px-2 py-2 text-ds-xs font-ds-black tracking-[.14em] text-txs">房间列表</p>
          {filteredSessions.length === 0 ? (
            <p className="px-2 pb-3 text-ds-sm text-txs">暂无符合条件的房间</p>
          ) : (
            <ul className="grid gap-1">
              {filteredSessions.map((session) => (
                <li key={session.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(session.id)}
                    className={`w-full rounded-ds-lg border p-3 text-left transition-colors ${
                      session.id === selectedId
                        ? "border-ac/60 bg-acl/50"
                        : "border-transparent hover:border-bd hover:bg-warm"
                    }`}
                  >
                    <span className="line-clamp-1 font-ds-bold text-ds-sm text-tx">{session.title}</span>
                    <span className="mt-2 flex items-center justify-between gap-2">
                      <span className="font-mono text-ds-xs text-txs">{session.room_code ?? "—"}</span>
                      <span className={`rounded-ds-pill px-2 py-0.5 text-[10px] font-ds-bold ${statusClass(session.status)}`}>
                        {LIVE_STATUS_LABELS[session.status]}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {!selectedSession ? (
          <section className="grid min-h-72 place-items-center rounded-ds-xl border border-dashed border-bd bg-white/50 text-txs">
            请选择或创建一场直播
          </section>
        ) : (
          <div className="grid gap-4">
            <section className="rounded-ds-xl border border-bd bg-white/75 p-4 shadow-ds-xs">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-ds-black tracking-[.16em] text-txs">A · 房间信息与控制</p>
                  {selectedSession.status === "draft" ? (
                    <div className="mt-2 flex gap-2">
                      <input
                        value={draftTitle}
                        onChange={(event) => setDraftTitle(event.target.value)}
                        className="h-11 flex-1 rounded-ds-lg border border-bd bg-bg px-3 text-ds-md font-ds-bold text-tx focus:border-ac focus:outline-none"
                        aria-label="直播标题"
                      />
                      <Button onClick={handleSaveTitle} disabled={savingTitle}>
                        {savingTitle ? "保存中..." : "保存"}
                      </Button>
                    </div>
                  ) : (
                    <h3 className="mt-1 font-serif text-ds-xl font-ds-black text-tx">{selectedSession.title}</h3>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-ds-xs text-txs">
                    <span className={`rounded-ds-pill px-2.5 py-1 font-ds-bold ${statusClass(selectedSession.status)}`}>
                      {LIVE_STATUS_LABELS[selectedSession.status]}
                    </span>
                    <span className="rounded-ds-pill border border-bd px-2.5 py-1 font-mono">
                      {selectedSession.room_code ?? "未生成房间号"}
                    </span>
                    <span className="rounded-ds-pill border border-bd px-2.5 py-1">
                      {LIVE_QUESTION_STATE_LABELS[selectedSession.question_state]}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-2 lg:items-end">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={handleOpenRoom}
                      disabled={selectedSession.status !== "draft" || action === "open"}
                      className="bg-tl text-white hover:bg-[#20605a] hover:text-white"
                    >
                      <DoorOpen className="h-4 w-4" />
                      开启房间
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!selectedSession.room_code}
                      onClick={async () => {
                        if (!selectedSession.room_code) return;
                        await navigator.clipboard.writeText(selectedSession.room_code);
                        toast.success("房间号已复制");
                      }}
                      className="bg-bg text-txs hover:text-ac"
                    >
                      <Copy className="h-4 w-4" />
                      复制房间号
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!selectedSession.room_code}
                      onClick={() => setShowQr((prev) => !prev)}
                      className="bg-bg text-txs hover:text-ac"
                    >
                      <QrCode className="h-4 w-4" />
                      {showQr ? "隐藏二维码" : "显示二维码"}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={selectedSession.status !== "live" || action === "end"}
                      onClick={() => setConfirmEnd(true)}
                      className="bg-error-bg text-error-tx hover:opacity-90"
                    >
                      <Square className="h-4 w-4" />
                      结束房间
                    </Button>
                  </div>
                  {showQr && roomUrl ? (
                    <div className="rounded-ds-lg border border-bd bg-bg p-3 text-center">
                      <QRCodeSVG value={roomUrl} size={132} />
                      <p className="mt-2 font-mono text-ds-xs text-txs">{selectedSession.room_code}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="rounded-ds-xl border border-bd bg-white/75 p-4 shadow-ds-xs">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[10px] font-ds-black tracking-[.16em] text-txs">B · 题目内容管理</p>
                  <p className="mt-1 text-ds-xs text-txs">只管理题目内容；发布和控课在下方 D 区。</p>
                </div>
                <Button
                  onClick={() => openEditor(null)}
                  disabled={selectedSession.status === "ended"}
                  className="bg-ac text-white hover:bg-acd hover:text-white"
                >
                  <Plus className="h-4 w-4" />
                  {selectedSession.status === "live" ? "临时加题" : "新建题目"}
                </Button>
              </div>

              {detailsLoading ? (
                <p className="py-8 text-center text-ds-sm text-txs">正在读取题目...</p>
              ) : questions.length === 0 ? (
                <p className="py-8 text-center text-ds-sm text-txs">先创建题目；不需要先开启房间。</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-ds-sm">
                    <thead>
                      <tr className="border-b border-bdl text-ds-xs text-txs">
                        <th className="py-2 pr-3">序号</th>
                        <th className="py-2 pr-3">题目标题</th>
                        <th className="py-2 pr-3">题目类型</th>
                        <th className="py-2 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map((question) => {
                        const editable = isLiveQuestionEditable(selectedSession, question.id);
                        return (
                          <tr key={question.id} className="border-b border-bdl last:border-0">
                            <td className="py-2.5 pr-3 font-mono text-txs">Q{question.position}</td>
                            <td className="py-2.5 pr-3">
                              <p className="font-ds-semibold text-tx">{question.title}</p>
                              <p className="line-clamp-1 text-ds-xs text-txs">{question.content}</p>
                            </td>
                            <td className="py-2.5 pr-3 text-txs">{LIVE_QUESTION_TYPE_LABELS[question.type]}</td>
                            <td className="py-2.5">
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  title={editable ? "编辑" : "当前题已锁定"}
                                  disabled={!editable}
                                  onClick={() => openEditor(question)}
                                  className="rounded-ds-md p-2 text-txs transition-colors hover:bg-warm hover:text-ac disabled:opacity-40"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  title="复制题目"
                                  disabled={selectedSession.status === "ended"}
                                  onClick={() => void handleCopyQuestion(question)}
                                  className="rounded-ds-md p-2 text-txs transition-colors hover:bg-warm hover:text-ac disabled:opacity-40"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  title={question.id === selectedSession.current_question_id ? "当前题不能删除" : "删除题目"}
                                  disabled={selectedSession.status === "ended" || question.id === selectedSession.current_question_id}
                                  onClick={() => setDeleteQuestion(question)}
                                  className="rounded-ds-md p-2 text-txs transition-colors hover:bg-error-bg hover:text-error-tx disabled:opacity-40"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-ds-xl border border-[#244f48]/15 bg-[#244f48] p-4 text-white shadow-ds-md">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-[10px] font-ds-black tracking-[.16em] text-[#efb393]">D · 互动控制 / 实时结果</p>
                  <p className="mt-1 text-ds-xs text-white/55">这里是唯一的课堂事件发送区。</p>
                </div>
                <div className="flex items-center gap-2 rounded-ds-lg border border-white/10 bg-white/[.06] px-3 py-2 text-ds-xs">
                  <Users className="h-4 w-4 text-[#efb393]" />
                  在线 {new Set(onlineUsers.map((item) => item.user_id ?? JSON.stringify(item))).size}
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[320px_1fr]">
                <div className="rounded-ds-lg border border-white/10 bg-white/[.05] p-3">
                  <label className="grid gap-1.5 text-ds-xs text-white/70">
                    选择要发布的题目
                    <select
                      value={selectedQuestionId ?? ""}
                      onChange={(event) => setSelectedQuestionId(event.target.value || null)}
                      disabled={questions.length === 0 || selectedSession.status !== "live"}
                      className="h-10 rounded-ds-md border border-white/15 bg-[#173d39] px-2 text-ds-sm text-white disabled:opacity-50"
                    >
                      {questions.length === 0 ? <option value="">暂无题目</option> : null}
                      {questions.map((question) => (
                        <option key={question.id} value={question.id}>
                          Q{question.position} {question.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="mt-3 text-ds-xs text-white/55">
                    当前状态：{LIVE_QUESTION_STATE_LABELS[selectedSession.question_state]}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      onClick={handlePublish}
                      disabled={!capabilities?.publish || !selectedQuestionId || action === "publish"}
                      className="bg-[#efb393] text-[#244f48] hover:bg-[#e39c76] hover:text-[#244f48]"
                    >
                      <Radio className="h-4 w-4" />
                      发布题目
                    </Button>
                    <Button
                      onClick={handleClose}
                      disabled={!capabilities?.close || action === "close"}
                      className="bg-white/10 text-white hover:bg-white/20 hover:text-white"
                    >
                      停止作答
                    </Button>
                    <Button
                      onClick={handleReveal}
                      disabled={!capabilities?.reveal || action === "reveal"}
                      className="bg-white/10 text-white hover:bg-white/20 hover:text-white"
                    >
                      公布答案
                    </Button>
                    <Button
                      onClick={handleNext}
                      disabled={!capabilities?.next || action === "next"}
                      className="bg-white/10 text-white hover:bg-white/20 hover:text-white"
                    >
                      发布下一题
                    </Button>
                  </div>
                </div>

                <div className="rounded-ds-lg border border-white/10 bg-white/[.05] p-3">
                  {currentQuestion && summary ? (
                    <>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-serif text-ds-lg font-ds-black">
                          Q{currentQuestion.position} · {currentQuestion.title}
                        </p>
                        <p className="text-ds-xs text-white/60">
                          已答 {summary.answeredCount} 人 · 正确率 {summary.correctRate}%
                        </p>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {summary.options.map((option) => (
                          <div key={option.id}>
                            <div className="flex justify-between text-ds-xs text-white/70">
                              <span>{option.label}</span>
                              <span>{option.count} 人 · {option.percentage}%</span>
                            </div>
                            <div className="mt-1 h-2.5 overflow-hidden rounded-ds-pill bg-black/20">
                              <div
                                className="h-full rounded-ds-pill bg-gradient-to-r from-[#efb393] to-[#e39c76] transition-[width]"
                                style={{ width: `${Math.min(100, option.percentage)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 border-t border-white/10 pt-3 text-ds-xs text-white/70">
                        正确答案：{formatLiveAnswer(currentQuestion.correct_answer)}
                      </p>
                    </>
                  ) : (
                    <div className="grid min-h-40 place-items-center text-center text-ds-sm text-white/55">
                      等待主持人发布问题……
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      <DialogWrapper
        createOpen={createOpen}
        onCreateOpenChange={setCreateOpen}
        newTitle={newTitle}
        onNewTitleChange={setNewTitle}
        creating={creating}
        onCreate={handleCreateSession}
      />
      <QuestionEditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        question={editingQuestion}
        locked={Boolean(
          editingQuestion
          && selectedSession
          && (
            selectedSession.status === "ended"
            || !isLiveQuestionEditable(selectedSession, editingQuestion.id)
          ),
        )}
        saving={savingQuestion}
        onSave={handleSaveQuestion}
      />
      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title="结束本场互动？"
        description="结束后学员不能继续提交答案，/live 列表也不再显示本场直播。"
        confirmText="结束房间"
        onConfirm={handleEnd}
      />
      <ConfirmDialog
        open={Boolean(deleteQuestion)}
        onOpenChange={(open) => {
          if (!open) setDeleteQuestion(null);
        }}
        title="删除这道题？"
        description="题目及其正确答案会被删除；未被使用的答案记录也会一并删除。"
        confirmText="删除题目"
        onConfirm={handleDeleteQuestion}
      />
    </div>
  );
}

function DialogWrapper({
  createOpen,
  onCreateOpenChange,
  newTitle,
  onNewTitleChange,
  creating,
  onCreate,
}: {
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  newTitle: string;
  onNewTitleChange: (value: string) => void;
  creating: boolean;
  onCreate: () => void | Promise<void>;
}) {
  return (
    <Dialog
      open={createOpen}
      onOpenChange={(open) => {
        if (!open) onNewTitleChange("");
        onCreateOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>创建直播</DialogTitle>
          <DialogDescription>先创建记录即可出题，房间号会在开启房间时生成。</DialogDescription>
        </DialogHeader>
        <input
          value={newTitle}
          onChange={(event) => onNewTitleChange(event.target.value)}
          placeholder="例如：教学目标设计直播"
          className="h-11 w-full rounded-ds-lg border border-bd bg-bg px-3 text-ds-sm text-tx focus:border-ac focus:outline-none focus:ring-2 focus:ring-ac/20"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onCreateOpenChange(false)} disabled={creating}>
            取消
          </Button>
          <Button onClick={onCreate} disabled={creating} className="bg-ac text-white hover:bg-acd hover:text-white">
            {creating ? "创建中..." : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
