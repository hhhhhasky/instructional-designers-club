import {
  Archive,
  Bot,
  Brain,
  Check,
  Copy,
  History,
  Loader2,
  LockKeyhole,
  Pin,
  Plus,
  Send,
  Share2,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Footer from "@/components/common/Footer";
import MarkdownRenderer from "@/components/common/MarkdownRenderer";
import PageMeta from "@/components/common/PageMeta";
import HaiProfileOnboardingDialog, {
  type HaiProfileOnboardingMemory,
} from "@/components/hai/HaiProfileOnboardingDialog";
import HaiWorkspaceShell from "@/components/hai/HaiWorkspaceShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SheetClose } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import {
  archiveHaiConversation,
  archiveHaiMemory,
  createHaiMemory,
  getHaiChatModule,
  getHaiAccessStatus,
  getHaiConversations,
  getHaiMemories,
  getHaiMessageFeedback,
  getHaiMessages,
  type HaiAccessStatus,
  type HaiConversation,
  type HaiFeatureModule,
  type HaiMessage,
  type HaiMessageFeedback,
  type HaiUsageSummary,
  type HaiUserMemory,
  hasCompletedHaiProfileOnboarding,
  redeemHaiInvite,
  saveHaiProfileMemories,
  setHaiMessageFeedback,
  streamHaiChat,
} from "@/db/hai-api";
import { copyHaiAnswer, createHaiShareImage } from "@/lib/hai-share";

type DraftMessage = Pick<HaiMessage, "id" | "role" | "content" | "created_at"> & {
  pending?: boolean;
};

export const HAI_STARTER_QUESTIONS = [
  "公开课设计太平，应该先改哪里？",
  "学生参与度低，怎么判断问题原因？",
  "如何检查目标、活动和评价是否对齐？",
] as const;

export default function HaiPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [access, setAccess] = useState<HaiAccessStatus | null>(null);
  const [usage, setUsage] = useState<HaiUsageSummary | null>(null);
  const [chatModule, setChatModule] = useState<HaiFeatureModule | null>(null);
  const [conversations, setConversations] = useState<HaiConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DraftMessage[]>([]);
  const [messageFeedback, setMessageFeedback] = useState<Record<string, HaiMessageFeedback["rating"]>>({});
  const [memories, setMemories] = useState<HaiUserMemory[]>([]);
  const [draft, setDraft] = useState("");
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memoryCategory, setMemoryCategory] = useState("teaching_preference");
  const [inviteCode, setInviteCode] = useState("");
  const [status, setStatus] = useState("");
  const [initializationError, setInitializationError] = useState("");
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [profileOnboardingOpen, setProfileOnboardingOpen] = useState(false);
  const [profileOnboardingSaving, setProfileOnboardingSaving] = useState(false);
  const [profileOnboardingError, setProfileOnboardingError] = useState("");
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);

  const weeklyUsagePercent = useMemo(() => {
    if (!usage?.weekly_limit) return 0;
    return Math.min(100, Math.round((usage.weekly_used / usage.weekly_limit) * 100));
  }, [usage]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { state: { from: "/hai/chat" } });
    }
  }, [loading, navigate, user?.id]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setBooting(true);
      setInitializationError("");
      try {
        const { access, usage } = await getHaiAccessStatus();
        if (cancelled) return;
        setAccess(access);
        setUsage(usage);
        if (access.allowed) {
          const [moduleRow, rows, memoryRows, profileCompleted] = await Promise.all([
            getHaiChatModule(),
            getHaiConversations(),
            getHaiMemories(),
            hasCompletedHaiProfileOnboarding(),
          ]);
          if (cancelled) return;
          setChatModule(moduleRow);
          setConversations(rows);
          setMemories(memoryRows);
          setActiveConversationId((current) => current ?? rows[0]?.id ?? null);
          setProfileOnboardingOpen(!profileCompleted);
        }
      } catch (error) {
        if (!cancelled) {
          setInitializationError(error instanceof Error ? error.message : "HAI 初始化失败。");
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      setMessageFeedback({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await getHaiMessages(activeConversationId);
        const feedbackRows = await getHaiMessageFeedback(
          rows.filter((message) => message.role === "assistant").map((message) => message.id),
        );
        if (!cancelled) {
          setMessages(rows);
          setMessageFeedback(Object.fromEntries(feedbackRows.map((item) => [item.message_id, item.rating])));
        }
      } catch (error) {
        if (!cancelled) setStatus(error instanceof Error ? error.message : "消息加载失败。");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);

  useEffect(() => {
    const scrollRegion = messagesScrollRef.current;
    if (scrollRegion) scrollRegion.scrollTop = scrollRegion.scrollHeight;
  }, [messages]);

  useEffect(() => {
    document.body.classList.add("hai-chat-active");
    return () => document.body.classList.remove("hai-chat-active");
  }, []);

  async function refreshConversations(nextActiveId?: string | null) {
    const rows = await getHaiConversations();
    setConversations(rows);
    if (nextActiveId !== undefined) {
      setActiveConversationId(nextActiveId);
    }
  }

  async function handleMessageFeedback(messageId: string, rating: "up" | "down") {
    try {
      const feedback = await setHaiMessageFeedback(messageId, rating);
      setMessageFeedback((current) => ({ ...current, [messageId]: feedback.rating }));
      toast.success(rating === "up" ? "已记录：这条回答有帮助" : "已记录：今晚复盘会优先分析这条回答");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "评价保存失败，请稍后重试");
    }
  }

  async function handleRedeemInvite() {
    const code = inviteCode.trim();
    if (!code || busy) return;
    setBusy(true);
    setStatus("");
    try {
      const result = await redeemHaiInvite(code);
      setAccess(result.access);
      setUsage(result.usage);
      setInviteCode("");
      if (result.access.allowed) {
        try {
          const [moduleRow, , memoryRows, profileCompleted] = await Promise.all([
            getHaiChatModule(),
            refreshConversations(null),
            getHaiMemories(),
            hasCompletedHaiProfileOnboarding(),
          ]);
          setChatModule(moduleRow);
          setInitializationError("");
          setMemories(memoryRows);
          setProfileOnboardingOpen(!profileCompleted);
        } catch (error) {
          setInitializationError(error instanceof Error ? error.message : "HAI 初始化失败。");
        }
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "邀请码兑换失败。");
    } finally {
      setBusy(false);
    }
  }

  async function handleSend(suggestedQuestion?: string) {
    const text = (suggestedQuestion ?? draft).trim();
    if (!text || busy || !chatModule) return;
    setBusy(true);
    setStatus("");
    setDraft("");
    const userMessage: DraftMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
      pending: true,
    };
    const assistantId = `local-assistant-${Date.now()}`;
    const assistantMessage: DraftMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((current) => [...current, userMessage, assistantMessage]);

    let nextConversationId = activeConversationId;
    try {
      await streamHaiChat(
        {
          conversationId: activeConversationId,
          message: text,
        },
        {
          onEvent: (event) => {
            if (event.type === "ready") {
              nextConversationId = event.conversationId;
              setActiveConversationId(event.conversationId);
              return;
            }
            if (event.type === "token") {
              setMessages((current) => current.map((item) => (
                item.id === assistantId ? { ...item, content: item.content + event.token } : item
              )));
              return;
            }
            if (event.type === "error") {
              setStatus(event.message);
              return;
            }
            if (event.type === "done") {
              setMessages((current) => current.map((item) => (
                item.id === assistantId || item.id === userMessage.id ? { ...item, pending: false } : item
              )));
            }
          },
        },
      );
      const [accessPayload] = await Promise.all([
        getHaiAccessStatus(),
        refreshConversations(nextConversationId),
      ]);
      setUsage(accessPayload.usage);
      if (nextConversationId) {
        const rows = await getHaiMessages(nextConversationId);
        setMessages(rows);
        const feedbackRows = await getHaiMessageFeedback(
          rows.filter((message) => message.role === "assistant").map((message) => message.id),
        );
        setMessageFeedback(Object.fromEntries(feedbackRows.map((item) => [item.message_id, item.rating])));
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "HAI 请求失败。");
      setMessages((current) => current.map((item) => (
        item.id === assistantId ? { ...item, content: item.content || "这次请求没有完成。", pending: false } : item
      )));
    } finally {
      setBusy(false);
    }
  }

  async function handleArchiveConversation(conversationId: string) {
    if (busy) return;
    await archiveHaiConversation(conversationId);
    const remaining = conversations.filter((item) => item.id !== conversationId);
    setConversations(remaining);
    if (activeConversationId === conversationId) {
      setActiveConversationId(remaining[0]?.id ?? null);
    }
  }

  async function handleCreateMemory() {
    const content = memoryDraft.trim();
    if (!user || !content || busy) return;
    setBusy(true);
    setStatus("");
    try {
      await createHaiMemory({
        userId: user.id,
        category: memoryCategory,
        content,
      });
      setMemoryDraft("");
      setMemories(await getHaiMemories());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "记忆保存失败。");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchiveMemory(memoryId: string) {
    await archiveHaiMemory(memoryId);
    setMemories((current) => current.filter((item) => item.id !== memoryId));
  }

  async function handleProfileOnboardingSubmit(profileMemories: HaiProfileOnboardingMemory[]) {
    if (!user || profileOnboardingSaving) return;
    setProfileOnboardingSaving(true);
    setProfileOnboardingError("");
    try {
      await saveHaiProfileMemories({
        userId: user.id,
        memories: profileMemories,
      });
      setMemories(await getHaiMemories());
      setProfileOnboardingOpen(false);
      toast.success("个人信息已保存，HAI 会在之后的咨询中记住这些背景");
    } catch (error) {
      setProfileOnboardingError(error instanceof Error ? error.message : "个人信息保存失败，请稍后重试。");
    } finally {
      setProfileOnboardingSaving(false);
    }
  }

  function startNewConversation() {
    setActiveConversationId(null);
    setMessages([]);
    setHistoryOpen(false);
  }

  const history = (
    <HistoryPanel
      conversations={conversations}
      activeConversationId={activeConversationId}
      onSelect={(id) => {
        setActiveConversationId(id);
        setHistoryOpen(false);
      }}
      onArchive={handleArchiveConversation}
      onNew={() => startNewConversation()}
    />
  );

  const contextPanel = (
    <UsagePanel
      usage={usage}
      weeklyUsagePercent={weeklyUsagePercent}
      access={access}
      memories={memories}
      memoryDraft={memoryDraft}
      memoryCategory={memoryCategory}
      busy={busy}
      onMemoryDraftChange={setMemoryDraft}
      onMemoryCategoryChange={setMemoryCategory}
      onCreateMemory={handleCreateMemory}
      onArchiveMemory={handleArchiveMemory}
    />
  );

  return (
    <>
      <PageMeta
        title="HAI"
        description="HAI 教研助手"
        canonicalPath="/hai/chat"
        keywords="HAI,AI教研,问问哈老师"
      />
      <HaiWorkspaceShell
        mode="consultation"
        title="聊聊问题"
        subtitle={chatModule ? chatModule.name : "和 HAI 一起想清楚教学问题"}
        sidebar={history}
        inspector={access?.allowed ? contextPanel : undefined}
        sidebarLabel="打开对话记录"
        inspectorLabel="打开咨询上下文"
        mobileSidebarOpen={historyOpen}
        onMobileSidebarOpenChange={setHistoryOpen}
        sidebarPadded={false}
        contentMode="managed"
        footer={<Footer />}
      >
        {booting ? (
          <div className="flex flex-1 items-center justify-center text-txs">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            正在加载 HAI
          </div>
        ) : initializationError ? (
          <UnavailablePanel message={initializationError} />
        ) : !access?.allowed ? (
          <LockedPanel
            reason={access?.reason}
            inviteCode={inviteCode}
            busy={busy}
            status={status}
            onCodeChange={setInviteCode}
            onSubmit={handleRedeemInvite}
          />
        ) : (
          <>
            <div
              ref={messagesScrollRef}
              className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain bg-[var(--bg)] px-3 py-3 scroll-smooth md:px-4 md:py-5"
              aria-label="对话内容"
              data-testid="hai-message-scroll-region"
            >
              {messages.length === 0 ? (
                <EmptyState
                  module={chatModule}
                  busy={busy}
                  onQuestionSelect={(question) => void handleSend(question)}
                />
              ) : (
                <div className="mx-auto flex max-w-3xl flex-col gap-4">
                  {messages.map((message, index) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      question={message.role === "assistant" ? findPreviousQuestion(messages, index) : undefined}
                      feedback={messageFeedback[message.id]}
                      onFeedback={handleMessageFeedback}
                    />
                  ))}
                </div>
              )}
            </div>

            <div
              className="shrink-0 border-t border-bd bg-[var(--paper)] px-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5 md:p-4"
              data-testid="hai-composer"
            >
              {status && (
                <p className="mb-2 rounded-ds-md border border-red-200 bg-red-50 px-3 py-2 text-ds-sm text-red-700">
                  {status}
                </p>
              )}
              <div className="mx-auto flex w-full max-w-3xl min-w-0 gap-2">
                <textarea
                  rows={1}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder={chatModule ? `发送给「${chatModule.short_label}」` : "输入你的教学问题"}
                  className="h-[52px] min-h-[52px] min-w-0 flex-1 resize-none rounded-ds-md border border-bd bg-bg px-3.5 py-3 text-[16px] leading-relaxed text-tx outline-none transition focus:border-ac focus:ring-2 focus:ring-ac/15 md:h-[72px] md:min-h-[72px] md:rounded-ds-lg md:px-4"
                  disabled={busy}
                  aria-label="输入教学问题"
                />
                <Button
                  className="h-[52px] w-[52px] rounded-ds-md bg-ac text-white hover:bg-acd md:h-[72px] md:w-14 md:rounded-ds-lg"
                  disabled={busy || !draft.trim() || !chatModule}
                  onClick={() => void handleSend()}
                  aria-label="发送"
                >
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </div>
            </div>
          </>
        )}
      </HaiWorkspaceShell>
      {access?.allowed && (
        <HaiProfileOnboardingDialog
          open={profileOnboardingOpen}
          saving={profileOnboardingSaving}
          error={profileOnboardingError}
          onSubmit={handleProfileOnboardingSubmit}
          onSkip={() => {
            setProfileOnboardingError("");
            setProfileOnboardingOpen(false);
          }}
        />
      )}
    </>
  );
}

function HistoryPanel({
  conversations,
  activeConversationId,
  onSelect,
  onArchive,
  onNew,
  showClose = false,
}: {
  conversations: HaiConversation[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onArchive: (id: string) => void;
  onNew: () => void;
  showClose?: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--paper-deep)] p-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-[11px] font-black tracking-[0.16em] text-[var(--proof)]">
          <History className="h-4 w-4" />
          对话记录
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" onClick={onNew} aria-label="新建对话">
            <Plus className="h-4 w-4" />
          </Button>
          {showClose && (
            <SheetClose asChild>
              <Button size="icon-sm" variant="ghost" aria-label="关闭对话记录">
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          )}
        </div>
      </div>
      <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="px-2 py-6 text-center text-ds-sm text-txs">还没有历史对话</p>
        ) : conversations.map((conversation) => (
          <div
            key={conversation.id}
            className={`group flex items-start gap-2 rounded-[14px] border p-3 transition ${
              activeConversationId === conversation.id ? "border-ac/30 bg-[var(--paper)]" : "border-transparent hover:bg-[var(--paper)]/75"
            }`}
          >
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() => onSelect(conversation.id)}
            >
              <p className="truncate text-ds-sm font-ds-semibold text-tx">{conversation.title}</p>
              <p className="mt-1 text-ds-xs text-txs">{formatDate(conversation.updated_at)}</p>
            </button>
            <button
              className="rounded-ds-sm p-1 text-txt opacity-0 transition hover:bg-bgs hover:text-ac group-hover:opacity-100"
              onClick={() => onArchive(conversation.id)}
              aria-label="归档对话"
            >
              <Archive className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MessageBubble({
  message,
  question,
  feedback,
  onFeedback,
}: {
  message: DraftMessage;
  question?: string;
  feedback?: "up" | "down";
  onFeedback?: (messageId: string, rating: "up" | "down") => void | Promise<void>;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [sharePreviewUrl, setSharePreviewUrl] = useState<string | null>(null);

  useEffect(() => () => {
    if (sharePreviewUrl) URL.revokeObjectURL(sharePreviewUrl);
  }, [sharePreviewUrl]);

  async function handleCopy() {
    try {
      await copyHaiAnswer(message.content);
      setCopied(true);
      toast.success("回答已复制");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("复制失败，请长按选择文字复制");
    }
  }

  async function handleShare() {
    if (!question || sharing) return;
    setSharing(true);
    try {
      const blob = await createHaiShareImage({ question, answer: message.content });
      setSharePreviewUrl(URL.createObjectURL(blob));
      toast.success("分享图已生成，长按图片即可保存或转发");
    } catch {
      toast.error("分享图生成失败，请稍后重试");
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <div className={`flex min-w-0 ${isUser ? "justify-end" : "justify-start"}`}>
        <div
          className={`min-w-0 max-w-[94%] rounded-ds-lg border px-4 py-3 shadow-ds-xs sm:max-w-[88%] ${
            isUser
              ? "border-ac/20 bg-ac text-white"
              : "border-bd bg-white text-tx"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-ds-base leading-relaxed">{message.content}</p>
          ) : message.content ? (
            <>
              <div className="min-w-0 overflow-x-auto">
                <MarkdownRenderer content={message.content} />
              </div>
              {!message.pending && (
                <div className="mt-3 flex items-center gap-1 border-t border-bdl pt-2">
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-ds-md px-2.5 text-ds-sm text-txs transition hover:bg-bgs hover:text-ac focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac/30"
                    aria-label="复制这条回答"
                  >
                    {copied ? <Check className="h-4 w-4 text-tl" /> : <Copy className="h-4 w-4" />}
                    {copied ? "已复制" : "复制"}
                  </button>
                  {question && (
                    <button
                      type="button"
                      onClick={() => void handleShare()}
                      disabled={sharing}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-ds-md px-2.5 text-ds-sm text-txs transition hover:bg-bgs hover:text-ac focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac/30 disabled:cursor-wait disabled:opacity-60"
                      aria-label="把这轮问答生成分享图"
                    >
                      {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                      {sharing ? "生成中" : "转发"}
                    </button>
                  )}
                  <span className="ml-auto text-[11px] text-txs">这条回答有帮助吗？</span>
                  <button
                    type="button"
                    onClick={() => void onFeedback?.(message.id, "up")}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-ds-md transition hover:bg-bgs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac/30 ${
                      feedback === "up" ? "bg-tll text-tl" : "text-txs hover:text-tl"
                    }`}
                    aria-label="这条回答有帮助"
                    aria-pressed={feedback === "up"}
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void onFeedback?.(message.id, "down")}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-ds-md transition hover:bg-bgs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac/30 ${
                      feedback === "down" ? "bg-red-50 text-red-600" : "text-txs hover:text-red-600"
                    }`}
                    aria-label="这条回答没帮助"
                    aria-pressed={feedback === "down"}
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <span className="inline-flex items-center text-ds-sm text-txs">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              思考中
            </span>
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(sharePreviewUrl)}
        onOpenChange={(open) => {
          if (!open) setSharePreviewUrl(null);
        }}
      >
        <DialogContent
          className="flex max-h-[calc(100dvh-1rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-ds-lg border-bd bg-white p-0 shadow-ds-xl sm:max-h-[calc(100dvh-2rem)]"
          hideCloseButton
        >
          <DialogHeader className="shrink-0 border-b border-bd bg-white px-4 py-3 text-left sm:px-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="font-ds-black text-tx">分享图已生成</DialogTitle>
                <DialogDescription className="mt-1 text-txs">
                  手机长按图片选择保存或转发，电脑端可右键保存。
                </DialogDescription>
              </div>
              <DialogClose asChild>
                <Button size="icon-sm" variant="ghost" className="shrink-0" aria-label="关闭分享图预览">
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[var(--paper-deep)] p-2 sm:p-5">
            {sharePreviewUrl && (
              <img
                src={sharePreviewUrl}
                alt="HAI 教学咨询分享图，长按可保存或转发"
                className="mx-auto block h-auto w-full max-w-[540px] rounded-ds-md bg-white shadow-ds-lg"
                data-testid="hai-share-preview-image"
              />
            )}
          </div>
          <div className="shrink-0 border-t border-bd bg-white px-4 py-3 text-center text-ds-sm text-txs">
            长按图片 · 存储到照片 · 转发给同事
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EmptyState({
  module,
  busy,
  onQuestionSelect,
}: {
  module: HaiFeatureModule | null;
  busy: boolean;
  onQuestionSelect: (question: string) => void;
}) {
  return (
    <div className="mx-auto flex h-full min-h-0 max-w-2xl flex-col items-stretch justify-start py-2 text-left sm:items-center sm:justify-center sm:py-6 sm:text-center">
      <div className="flex items-center gap-3 sm:flex-col sm:gap-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-full bg-acl sm:mb-4 sm:h-14 sm:w-14">
          <Brain className="h-5 w-5 text-ac sm:h-7 sm:w-7" />
        </div>
        <div className="min-w-0">
          <h2 className="text-ds-lg font-ds-black leading-tight text-tx sm:text-ds-2xl">{module?.name ?? "HAI"}</h2>
          <p className="mt-0.5 truncate text-ds-sm leading-relaxed text-txs sm:mt-2 sm:max-w-xl sm:whitespace-normal sm:text-ds-base">
            {module?.description ?? "把你的备课困惑告诉我，我们从最值得改的地方开始。"}
          </p>
        </div>
      </div>
      <div className="mt-4 w-full text-left sm:mt-6">
        <p className="mb-2 text-ds-xs font-ds-semibold tracking-[0.08em] text-txt sm:text-center sm:tracking-[0.12em]">不知道从哪问？试试这些</p>
        <div className="grid gap-2 sm:grid-cols-3 sm:gap-2.5">
          {HAI_STARTER_QUESTIONS.map((question, index) => (
            <button
              key={question}
              type="button"
              aria-label={question}
              onClick={() => onQuestionSelect(question)}
              disabled={busy}
              className="group flex min-h-11 min-w-0 items-center gap-2.5 rounded-ds-md border border-bd bg-white px-3 py-2 text-left shadow-ds-xs transition hover:-translate-y-0.5 hover:border-ac/40 hover:shadow-ds-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac/30 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[96px] sm:items-start sm:gap-3 sm:rounded-ds-lg sm:p-4"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-ds-full bg-acl text-[11px] font-ds-bold text-ac transition group-hover:bg-ac group-hover:text-white sm:h-6 sm:w-6 sm:text-ds-xs">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-ds-sm leading-relaxed text-tx sm:whitespace-normal">{question}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-ds-xs text-txt sm:mt-3 sm:text-center">点击后直接发送，也可以在下方写自己的问题</p>
      </div>
    </div>
  );
}

function UnavailablePanel({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-bg px-4">
      <div
        className="w-full max-w-md rounded-ds-lg border border-amber-200 bg-white p-6 text-center shadow-ds-md"
        role="alert"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-ds-full bg-amber-50">
          <Bot className="h-6 w-6 text-amber-700" />
        </div>
        <h2 className="text-ds-xl font-ds-black text-tx">HAI 暂时不可用</h2>
        <p className="mt-2 text-ds-sm leading-relaxed text-txs">{message}</p>
      </div>
    </div>
  );
}

function LockedPanel({
  reason,
  inviteCode,
  busy,
  status,
  onCodeChange,
  onSubmit,
}: {
  reason?: string;
  inviteCode: string;
  busy: boolean;
  status: string;
  onCodeChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md rounded-ds-lg border border-bd bg-white p-6 shadow-ds-md">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-ds-full bg-acl">
          <LockKeyhole className="h-6 w-6 text-ac" />
        </div>
        <h2 className="text-center text-ds-xl font-ds-black text-tx">HAI 内测中</h2>
        <p className="mt-2 text-center text-ds-sm text-txs">{reason || "请输入邀请码开通使用权限。"}</p>
        <div className="mt-5 flex gap-2">
          <input
            value={inviteCode}
            onChange={(event) => onCodeChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmit();
              }
            }}
            className="h-11 min-w-0 flex-1 rounded-ds-md border border-bd bg-bg px-3 text-[16px] outline-none focus:border-ac focus:ring-2 focus:ring-ac/15"
            placeholder="邀请码"
            disabled={busy}
          />
          <Button className="h-11 bg-ac text-white hover:bg-acd" disabled={busy || !inviteCode.trim()} onClick={onSubmit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "开通"}
          </Button>
        </div>
        {status && <p className="mt-3 text-center text-ds-sm text-red-600">{status}</p>}
      </div>
    </div>
  );
}

function UsagePanel({
  usage,
  weeklyUsagePercent,
  access,
  memories,
  memoryDraft,
  memoryCategory,
  busy,
  onMemoryDraftChange,
  onMemoryCategoryChange,
  onCreateMemory,
  onArchiveMemory,
}: {
  usage: HaiUsageSummary | null;
  weeklyUsagePercent: number;
  access: HaiAccessStatus | null;
  memories: HaiUserMemory[];
  memoryDraft: string;
  memoryCategory: string;
  busy: boolean;
  onMemoryDraftChange: (value: string) => void;
  onMemoryCategoryChange: (value: string) => void;
  onCreateMemory: () => void;
  onArchiveMemory: (memoryId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-ds-sm font-ds-bold text-tx">周额度</h2>
          <Badge variant="outline" className="border-ac/30 text-ac">
            {usage?.policy_key ?? access?.quota_policy_key ?? "beta"}
          </Badge>
        </div>
        <div className="h-2 overflow-hidden rounded-ds-pill bg-bd">
          <div className="h-full bg-ac transition-all" style={{ width: `${weeklyUsagePercent}%` }} />
        </div>
        <p className="mt-2 text-ds-xs text-txs">
          {formatNumber(usage?.weekly_used ?? 0)} / {formatNumber(usage?.weekly_limit ?? 0)} tokens
        </p>
      </div>
      <div className="rounded-ds-lg border border-bd bg-white p-3">
        <div className="mb-3 flex items-center gap-2">
          <Pin className="h-4 w-4 text-ac" />
          <h2 className="text-ds-sm font-ds-bold text-tx">用户记忆</h2>
        </div>
        <div className="space-y-2">
          <select
            value={memoryCategory}
            onChange={(event) => onMemoryCategoryChange(event.target.value)}
            className="h-9 w-full rounded-ds-sm border border-bd bg-bg px-2 text-ds-sm"
            disabled={busy}
          >
            <option value="basic_info">基本情况</option>
            <option value="teaching_preference">教学偏好</option>
            <option value="constraint">现实限制</option>
            <option value="student_view">学生特点</option>
            <option value="challenge">当前困难</option>
            <option value="vision">长期追求</option>
          </select>
          <textarea
            value={memoryDraft}
            onChange={(event) => onMemoryDraftChange(event.target.value)}
            className="min-h-[76px] w-full resize-none rounded-ds-sm border border-bd bg-bg px-2 py-2 text-[16px] leading-relaxed md:text-ds-sm"
            placeholder="写一条 HAI 需要记住的信息"
            disabled={busy}
          />
          <Button
            className="w-full bg-ac text-white hover:bg-acd"
            size="sm"
            disabled={busy || !memoryDraft.trim()}
            onClick={onCreateMemory}
          >
            保存记忆
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {memories.length === 0 ? (
            <p className="rounded-ds-md bg-bg px-3 py-4 text-center text-ds-xs text-txs">暂无记忆</p>
          ) : memories.slice(0, 8).map((memory) => (
            <div key={memory.id} className="group rounded-ds-md border border-bd bg-bg p-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-[11px]">
                  {memoryLabel(memory.category)}
                </Badge>
                <button
                  className="rounded-ds-sm p-1 text-txt opacity-0 transition hover:bg-white hover:text-ac group-hover:opacity-100"
                  onClick={() => onArchiveMemory(memory.id)}
                  aria-label="归档记忆"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-ds-xs leading-relaxed text-tx">{memory.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function findPreviousQuestion(messages: DraftMessage[], assistantIndex: number) {
  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") return messages[index].content;
  }
  return undefined;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function memoryLabel(category: string) {
  const labels: Record<string, string> = {
    basic_info: "基本情况",
    education_philosophy: "教育观",
    student_view: "学生特点",
    teaching_view: "教学观",
    teaching_preference: "教学偏好",
    constraint: "现实限制",
    behavior: "已尝试",
    vision: "长期追求",
    challenge: "当前困难",
  };
  return labels[category] ?? category;
}
