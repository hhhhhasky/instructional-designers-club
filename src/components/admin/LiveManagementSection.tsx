import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  BarChart3,
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
  Tags,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
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
  getAdminLiveParticipants,
  getAdminLiveQuestions,
  getAdminLiveSessions,
  getLiveResponses,
  openLiveSession,
  setLiveParticipantTags,
  updateLiveQuestion,
  updateLiveSessionState,
  updateLiveTitle,
  type LiveQuestionInput,
} from "@/db/live-api";
import { useAuth } from "@/contexts/AuthContext";
import {
  LIVE_QUESTION_STATE_LABELS,
  LIVE_QUESTION_TYPE_LABELS,
  LIVE_PARTICIPANT_TAG_PRESETS,
  LIVE_STATUS_LABELS,
  extractLiveEvent,
  formatLiveAudience,
  getLiveControlCapabilities,
  getLiveTopic,
  isLiveQuestionEditable,
  liveQuestionTargetsParticipant,
  nextLiveQuestionId,
  normalizeLiveTag,
  summarizeLiveResults,
  type AdminLiveQuestion,
  type LiveAdminParticipant,
  type LiveResponse,
  type LiveSession,
  type LiveStatus,
} from "@/lib/live";

type PresenceMeta = { user_id?: string; display_name?: string; role?: "admin" | "participant" };
type RealtimeStatus = "idle" | "connecting" | "connected" | "recovering";

const LIVE_REALTIME_SUBSCRIBE_TIMEOUT_MS = 20_000;
const LIVE_REALTIME_WARNING_DELAY_MS = 8_000;

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
  const [participants, setParticipants] = useState<LiveAdminParticipant[]>([]);
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
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("idle");
  const [participantTagInputs, setParticipantTagInputs] = useState<Record<string, string>>({});
  const [savingParticipantId, setSavingParticipantId] = useState<string | null>(null);
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
  const realtimeStatusText: Record<RealtimeStatus, string> = {
    idle: selectedSession?.status === "live" ? "实时连接待启动" : "实时连接未启用",
    connecting: "实时连接中",
    connected: "实时已连接",
    recovering: "实时连接恢复中",
  };
  const onlineUserIds = useMemo(() => Array.from(new Set(
    onlineUsers
      .filter((item) => item.role === "participant" && item.user_id)
      .map((item) => item.user_id as string),
  )), [onlineUsers]);
  const onlineUserIdSet = useMemo(() => new Set(onlineUserIds), [onlineUserIds]);
  const availableTags = useMemo(() => Array.from(new Set([
    ...LIVE_PARTICIPANT_TAG_PRESETS,
    ...participants.flatMap((participant) => participant.tags),
    ...questions.flatMap((question) => question.target_tags),
  ])), [participants, questions]);
  const orderedParticipants = useMemo(() => [...participants].sort((left, right) => (
    Number(onlineUserIdSet.has(right.user_id)) - Number(onlineUserIdSet.has(left.user_id))
    || right.last_seen_at.localeCompare(left.last_seen_at)
  )), [onlineUserIdSet, participants]);

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

  const loadParticipants = useCallback(async (liveId: string) => {
    const rows = await getAdminLiveParticipants(liveId);
    setParticipants(rows);
    return rows;
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
      setParticipants([]);
      setDraftTitle("");
      return;
    }
    let cancelled = false;
    setDetailsLoading(true);
    Promise.all([
      loadQuestions(selectedId),
      loadParticipants(selectedId),
      loadResponses(sessions.find((row) => row.id === selectedId)?.current_question_id ?? null),
    ])
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
  }, [selectedId, loadParticipants, loadQuestions, loadResponses, sessions]);

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
      await loadParticipants(selectedId);
      const session = sessionRows.find((row) => row.id === selectedId);
      await loadResponses(session?.current_question_id ?? questionRows[0]?.id ?? null);
    }
  }, [loadParticipants, loadQuestions, loadResponses, loadSessions, selectedId]);

  useEffect(() => {
    const liveId = selectedSession?.id;
    if (!liveId || selectedSession?.status !== "live" || !user?.id) {
      setRealtimeStatus("idle");
      return;
    }
    let disposed = false;
    let warningTimer: ReturnType<typeof setTimeout> | null = null;
    const warningToastId = `live-realtime-${liveId}`;
    const channel = supabase.channel(getLiveTopic(liveId), {
      config: {
        private: true,
        broadcast: { self: false },
        presence: { key: user.id },
      },
    });
    channelRef.current = channel;
    setRealtimeStatus("connecting");

    const clearWarningTimer = () => {
      if (!warningTimer) return;
      clearTimeout(warningTimer);
      warningTimer = null;
    };

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
        void loadParticipants(liveId).catch(() => {
          // Presence 可能先于进入记录落库；下一次同步或手动刷新会补齐。
        });
      })
      .subscribe((status, error) => {
        if (status === "SUBSCRIBED" && !disposed) {
          clearWarningTimer();
          toast.dismiss(warningToastId);
          setRealtimeStatus("connected");
          void channel.track({
            user_id: user.id,
            display_name: profile?.nickname ?? "主持人",
            role: "admin",
          });
        }
        if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !disposed) {
          setRealtimeStatus("recovering");
          void refreshRoom().catch((refreshError) => {
            if (import.meta.env.DEV) console.warn("[live-realtime] database recovery failed", refreshError);
          });
          if (import.meta.env.DEV) {
            console.warn("[live-realtime] channel is retrying", status, error?.message ?? "no error detail");
          }
          if (!warningTimer) {
            warningTimer = setTimeout(() => {
              warningTimer = null;
              if (!disposed) {
                toast.warning("Live 实时连接仍在自动重试，控课状态已由数据库保存", {
                  id: warningToastId,
                });
              }
            }, LIVE_REALTIME_WARNING_DELAY_MS);
          }
        }
      }, LIVE_REALTIME_SUBSCRIBE_TIMEOUT_MS);

    return () => {
      disposed = true;
      clearWarningTimer();
      toast.dismiss(warningToastId);
      channelRef.current = null;
      void supabase.removeChannel(channel);
      setOnlineUsers([]);
      setRealtimeStatus("idle");
    };
  }, [selectedSession?.id, selectedSession?.status, user?.id, profile?.nickname, loadParticipants, loadResponses, refreshRoom]);

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

  const saveParticipantTags = async (participant: LiveAdminParticipant, tags: string[]) => {
    if (!selectedSession) return;
    try {
      setSavingParticipantId(participant.user_id);
      const savedTags = await setLiveParticipantTags(selectedSession.id, participant.user_id, tags);
      setParticipants((current) => current.map((item) => (
        item.user_id === participant.user_id ? { ...item, tags: savedTags } : item
      )));
      if (selectedSession.status === "live") {
        void sendControlEvent("audience_changed", { live_id: selectedSession.id });
      }
      toast.success(`已更新 ${participant.nickname} 的标签`);
    } catch (error) {
      toast.error(getErrorText(error, "保存学员标签失败"));
    } finally {
      setSavingParticipantId(null);
    }
  };

  const addParticipantTag = (participant: LiveAdminParticipant, rawTag: string) => {
    const tag = normalizeLiveTag(rawTag);
    if (!tag || participant.tags.includes(tag)) return;
    if (participant.tags.length >= 12) {
      toast.error("每位学员最多设置 12 个标签");
      return;
    }
    setParticipantTagInputs((current) => ({ ...current, [participant.user_id]: "" }));
    void saveParticipantTags(participant, [...participant.tags, tag]);
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
                        <th className="py-2 pr-3">发送对象</th>
                        <th className="py-2 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map((question) => {
                        const editable = isLiveQuestionEditable(selectedSession, question.id);
                        const targetCount = participants.filter((participant) => (
                          liveQuestionTargetsParticipant(question, participant)
                        )).length;
                        return (
                          <tr key={question.id} className="border-b border-bdl last:border-0">
                            <td className="py-2.5 pr-3 font-mono text-txs">Q{question.position}</td>
                            <td className="py-2.5 pr-3">
                              <p className="font-ds-semibold text-tx">{question.title}</p>
                              <p className="line-clamp-1 text-ds-xs text-txs">{question.content}</p>
                            </td>
                            <td className="py-2.5 pr-3 text-txs">{LIVE_QUESTION_TYPE_LABELS[question.type]}</td>
                            <td className="py-2.5 pr-3">
                              <span className={`rounded-ds-pill px-2 py-1 text-[10px] font-ds-bold ${question.audience_mode === "all" ? "bg-warm text-txs" : "bg-acl text-ac"}`}>
                                {formatLiveAudience(question)} · 当前匹配 {targetCount} 人
                              </span>
                            </td>
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

            <section className="rounded-ds-xl border border-bd bg-white/75 p-4 shadow-ds-xs">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-[10px] font-ds-black tracking-[.16em] text-txs">C · 学员标签与分组</p>
                  <p className="mt-1 text-ds-xs leading-5 text-txs">给进入过本场房间的学员添加标签；题目可按标签或指定个人定向发布。</p>
                </div>
                <div className="flex flex-wrap gap-2 text-ds-xs">
                  <span className="rounded-ds-pill bg-tll px-2.5 py-1 font-ds-bold text-tl">在线 {onlineUserIds.length}</span>
                  <span className="rounded-ds-pill bg-warm px-2.5 py-1 text-txs">累计 {participants.length}</span>
                </div>
              </div>

              {orderedParticipants.length === 0 ? (
                <div className="mt-4 rounded-ds-lg border border-dashed border-bd bg-bg/70 px-4 py-6 text-center text-ds-sm text-txs">
                  学员进入房间后会出现在这里。标签只在当前 Live 场次内生效。
                </div>
              ) : (
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {orderedParticipants.map((participant) => {
                    const online = onlineUserIdSet.has(participant.user_id);
                    const inputValue = participantTagInputs[participant.user_id] ?? "";
                    const saving = savingParticipantId === participant.user_id;
                    return (
                      <article key={participant.user_id} className="rounded-ds-lg border border-bd bg-bg/70 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500" : "bg-bd"}`} />
                              <h3 className="truncate text-ds-sm font-ds-bold text-tx">{participant.nickname}</h3>
                              <span className="text-[10px] text-txt">{online ? "在线" : "已离线"}</span>
                            </div>
                            <p className="mt-1 font-mono text-[10px] text-txt">{participant.user_id.slice(0, 8)}</p>
                          </div>
                          {saving ? <Loader2 className="h-4 w-4 animate-spin text-ac" /> : null}
                        </div>

                        <div className="mt-3 flex min-h-7 flex-wrap gap-1.5">
                          {participant.tags.map((tag) => (
                            <span key={tag} className="inline-flex items-center gap-1 rounded-ds-pill bg-acl px-2.5 py-1 text-ds-xs font-ds-bold text-ac">
                              {tag}
                              <button
                                type="button"
                                aria-label={`移除 ${participant.nickname} 的标签 ${tag}`}
                                disabled={saving || selectedSession.status === "ended"}
                                onClick={() => void saveParticipantTags(participant, participant.tags.filter((item) => item !== tag))}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                          {participant.tags.length === 0 ? <span className="text-ds-xs text-txt">暂无标签</span> : null}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {LIVE_PARTICIPANT_TAG_PRESETS.filter((tag) => !participant.tags.includes(tag)).map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              disabled={saving || selectedSession.status === "ended"}
                              onClick={() => addParticipantTag(participant, tag)}
                              className="rounded-ds-pill border border-bd bg-white px-2 py-1 text-[10px] text-txs hover:border-ac hover:text-ac disabled:opacity-40"
                            >
                              + {tag}
                            </button>
                          ))}
                        </div>

                        <div className="mt-3 flex gap-2">
                          <label className="relative min-w-0 flex-1">
                            <Tags className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-txt" />
                            <input
                              value={inputValue}
                              onChange={(event) => setParticipantTagInputs((current) => ({ ...current, [participant.user_id]: event.target.value }))}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  addParticipantTag(participant, inputValue);
                                }
                              }}
                              disabled={saving || selectedSession.status === "ended"}
                              maxLength={32}
                              placeholder="自定义标签"
                              className="h-9 w-full rounded-ds-md border border-bd bg-white pl-8 pr-2 text-ds-xs text-tx focus:border-ac focus:outline-none"
                            />
                          </label>
                          <Button type="button" size="sm" variant="outline" disabled={saving || !normalizeLiveTag(inputValue) || selectedSession.status === "ended"} onClick={() => addParticipantTag(participant, inputValue)}>添加</Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-ds-xl border border-[#244f48]/15 bg-[#244f48] p-4 text-white shadow-ds-md">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-[10px] font-ds-black tracking-[.16em] text-[#efb393]">D · 互动控制 / 实时结果</p>
                  <p className="mt-1 text-ds-xs text-white/55">这里只负责发布、停止、公布与下一题；数据分析已移至独立看板。</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-ds-xs">
                  <div className="flex items-center gap-2 rounded-ds-lg border border-white/10 bg-white/[.06] px-3 py-2">
                    <Users className="h-4 w-4 text-[#efb393]" />
                    学员在线 {new Set(onlineUsers.filter((item) => item.role !== "admin").map((item) => item.user_id ?? JSON.stringify(item))).size}
                  </div>
                  <div className="flex items-center gap-2 rounded-ds-lg border border-white/10 bg-white/[.06] px-3 py-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        realtimeStatus === "connected"
                          ? "bg-emerald-300"
                          : realtimeStatus === "recovering"
                            ? "animate-pulse bg-amber-300"
                            : "bg-white/35"
                      }`}
                    />
                    {realtimeStatusText[realtimeStatus]}
                  </div>
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
                          Q{question.position} {question.title} · {formatLiveAudience(question)}
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

                <div className="flex min-h-40 flex-col justify-between rounded-ds-lg border border-white/10 bg-white/[.05] p-4">
                  {currentQuestion && summary ? (
                    <>
                      <div>
                        <p className="text-[10px] font-ds-black tracking-[.14em] text-[#efb393]">CURRENT SNAPSHOT</p>
                        <p className="mt-2 font-serif text-ds-lg font-ds-black">Q{currentQuestion.position} · {currentQuestion.title}</p>
                        <p className="mt-1 text-ds-xs text-[#efb393]">{formatLiveAudience(currentQuestion)}</p>
                        <p className="mt-2 text-ds-sm text-white/60">已答 <span className="font-ds-black text-white">{summary.answeredCount}</span> 人 · 正确率 <span className="font-ds-black text-white">{summary.correctRate}%</span></p>
                      </div>
                      <Button asChild className="mt-5 w-full bg-[#efb393] text-[#244f48] hover:bg-[#e39c76] hover:text-[#244f48]">
                        <Link to="/admin?tab=live"><BarChart3 className="h-4 w-4" />打开大型 Live 数据看板</Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="grid flex-1 place-items-center text-center text-ds-sm text-white/55">等待主持人发布问题……</div>
                      <Button asChild className="mt-5 w-full bg-[#efb393] text-[#244f48] hover:bg-[#e39c76] hover:text-[#244f48]">
                        <Link to="/admin?tab=live"><BarChart3 className="h-4 w-4" />打开大型 Live 数据看板</Link>
                      </Button>
                    </>
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
        participants={participants}
        availableTags={availableTags}
        onlineUserIds={onlineUserIds}
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
