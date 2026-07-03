import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  Bot,
  Brain,
  History,
  Loader2,
  LockKeyhole,
  Menu,
  Pin,
  Plus,
  Send,
  X,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/common/Footer";
import PageMeta from "@/components/common/PageMeta";
import MarkdownRenderer from "@/components/common/MarkdownRenderer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import {
  archiveHaiConversation,
  archiveHaiMemory,
  createHaiMemory,
  getHaiAccessStatus,
  getHaiConversations,
  getHaiMemories,
  getHaiMessages,
  getHaiModules,
  redeemHaiInvite,
  streamHaiChat,
  type HaiAccessStatus,
  type HaiConversation,
  type HaiFeatureModule,
  type HaiMessage,
  type HaiUserMemory,
  type HaiUsageSummary,
} from "@/db/hai-api";

type DraftMessage = Pick<HaiMessage, "id" | "role" | "content" | "created_at"> & {
  pending?: boolean;
};

export default function HaiPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [access, setAccess] = useState<HaiAccessStatus | null>(null);
  const [usage, setUsage] = useState<HaiUsageSummary | null>(null);
  const [modules, setModules] = useState<HaiFeatureModule[]>([]);
  const [conversations, setConversations] = useState<HaiConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DraftMessage[]>([]);
  const [memories, setMemories] = useState<HaiUserMemory[]>([]);
  const [activeModuleSlug, setActiveModuleSlug] = useState("ask-han");
  const [draft, setDraft] = useState("");
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memoryCategory, setMemoryCategory] = useState("teaching_preference");
  const [inviteCode, setInviteCode] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const visibleModules = useMemo(() => modules.filter((item) => item.slug === "ask-han"), [modules]);
  const activeModule = visibleModules.find((item) => item.slug === activeModuleSlug) ?? visibleModules[0] ?? modules[0] ?? null;
  const weeklyUsagePercent = useMemo(() => {
    if (!usage?.weekly_limit) return 0;
    return Math.min(100, Math.round((usage.weekly_used / usage.weekly_limit) * 100));
  }, [usage]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { state: { from: "/hai" } });
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setBooting(true);
      try {
        const [{ access, usage }, moduleRows] = await Promise.all([
          getHaiAccessStatus(),
          getHaiModules(),
        ]);
        if (cancelled) return;
        setAccess(access);
        setUsage(usage);
        setModules(moduleRows);
        setActiveModuleSlug("ask-han");
        if (access.allowed) {
          const [rows, memoryRows] = await Promise.all([
            getHaiConversations(),
            getHaiMemories(),
          ]);
          if (cancelled) return;
          setConversations(rows);
          setMemories(memoryRows);
          setActiveConversationId((current) => current ?? rows[0]?.id ?? null);
        }
      } catch (error) {
        if (!cancelled) setStatus(error instanceof Error ? error.message : "HAI 初始化失败。");
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await getHaiMessages(activeConversationId);
        if (!cancelled) setMessages(rows);
      } catch (error) {
        if (!cancelled) setStatus(error instanceof Error ? error.message : "消息加载失败。");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);

  async function refreshConversations(nextActiveId?: string | null) {
    const rows = await getHaiConversations();
    setConversations(rows);
    if (nextActiveId !== undefined) {
      setActiveConversationId(nextActiveId);
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
        await refreshConversations(null);
        setMemories(await getHaiMemories());
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "邀请码兑换失败。");
    } finally {
      setBusy(false);
    }
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || busy || !activeModule) return;
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
          moduleSlug: activeModule.slug,
          message: text,
          mode: "chat",
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

  function startNewConversation(moduleSlug?: string) {
    setActiveConversationId(null);
    setMessages([]);
    if (moduleSlug) setActiveModuleSlug(moduleSlug);
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
        canonicalPath="/hai"
        keywords="HAI,AI教研,问问哈老师"
      />
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <main className="flex-1 pt-20 pb-6 px-3 md:px-5">
          <div className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-[1440px] flex-col overflow-hidden rounded-ds-lg border border-bd bg-white shadow-ds-md xl:grid xl:grid-cols-[280px_minmax(0,1fr)_300px]">
            <aside className="hidden border-r border-bd bg-bgs/70 xl:block">
              {history}
            </aside>

            <section className="flex min-h-[calc(100vh-7rem)] flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-bd bg-white px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className="xl:hidden">
                        <Menu className="w-5 h-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[300px] overflow-hidden bg-[#fbfaf8] p-0" hideCloseButton>
                      <div className="h-full min-h-full bg-[#fbfaf8]">
                        <HistoryPanel
                          conversations={conversations}
                          activeConversationId={activeConversationId}
                          onSelect={(id) => {
                            setActiveConversationId(id);
                            setHistoryOpen(false);
                          }}
                          onArchive={handleArchiveConversation}
                          onNew={() => startNewConversation()}
                          showClose
                        />
                      </div>
                    </SheetContent>
                  </Sheet>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-full bg-acl">
                    <Bot className="h-5 w-5 text-ac" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="truncate text-ds-lg font-ds-black text-tx">HAI</h1>
                    <p className="truncate text-ds-xs text-txs">
                      {activeModule ? activeModule.name : "AI 教研助手"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {access?.allowed && (
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button size="sm" variant="outline" className="xl:hidden">
                          <Pin className="h-4 w-4" />
                          <span className="hidden sm:inline">上下文</span>
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="right" className="w-[320px] overflow-y-auto bg-[#fbfaf8] p-0" hideCloseButton>
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-bd bg-white px-4 py-3">
                          <span className="text-ds-sm font-ds-bold text-tx">上下文</span>
                          <SheetClose asChild>
                            <Button size="icon-sm" variant="ghost" aria-label="关闭上下文">
                              <X className="h-4 w-4" />
                            </Button>
                          </SheetClose>
                        </div>
                        <div className="min-h-full bg-[#fbfaf8] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                          {contextPanel}
                        </div>
                      </SheetContent>
                    </Sheet>
                  )}
                  <Button size="sm" variant="outline" onClick={() => startNewConversation(activeModuleSlug)}>
                    <Plus className="w-4 h-4" />
                    新 Session
                  </Button>
                </div>
              </div>

              {booting ? (
                <div className="flex flex-1 items-center justify-center text-txs">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在加载 HAI
                </div>
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
                  <div className="flex-1 overflow-y-auto bg-[#fbfaf8] px-4 py-5">
                    {messages.length === 0 ? (
                      <EmptyState module={activeModule} />
                    ) : (
                      <div className="mx-auto flex max-w-3xl flex-col gap-4">
                        {messages.map((message) => (
                          <MessageBubble key={message.id} message={message} />
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>

                  <div className="border-t border-bd bg-white p-3 md:p-4">
                    {status && (
                      <p className="mb-2 rounded-ds-md border border-red-200 bg-red-50 px-3 py-2 text-ds-sm text-red-700">
                        {status}
                      </p>
                    )}
                    <div className="mx-auto flex max-w-3xl gap-2">
                      <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                            event.preventDefault();
                            void handleSend();
                          }
                        }}
                        placeholder={activeModule ? `发送给「${activeModule.short_label}」` : "输入你的教学问题"}
                        className="min-h-[72px] flex-1 resize-none rounded-ds-lg border border-bd bg-bg px-4 py-3 text-ds-base leading-relaxed text-tx outline-none transition focus:border-ac focus:ring-2 focus:ring-ac/15"
                        disabled={busy}
                      />
                      <Button
                        className="h-[72px] w-14 rounded-ds-lg bg-ac text-white hover:bg-acd"
                        disabled={busy || !draft.trim()}
                        onClick={() => void handleSend()}
                        aria-label="发送"
                      >
                        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </section>

            <aside className="hidden border-l border-bd bg-bgs/70 p-4 xl:block">
              {contextPanel}
            </aside>
          </div>
        </main>
        <Footer />
      </div>
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
    <div className="flex h-full min-h-[480px] flex-col bg-[#fbfaf8]">
      <div className="flex items-center justify-between border-b border-bd bg-white p-4">
        <div className="flex items-center gap-2 font-ds-bold text-tx">
          <History className="h-4 w-4 text-ac" />
          Session
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" onClick={onNew} aria-label="新 Session">
            <Plus className="h-4 w-4" />
          </Button>
          {showClose && (
            <SheetClose asChild>
              <Button size="icon-sm" variant="ghost" aria-label="关闭 Session 列表">
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          )}
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {conversations.length === 0 ? (
          <p className="px-2 py-6 text-center text-ds-sm text-txs">暂无历史 Session</p>
        ) : conversations.map((conversation) => (
          <div
            key={conversation.id}
            className={`group flex items-start gap-2 rounded-ds-md border p-3 transition ${
              activeConversationId === conversation.id ? "border-ac bg-acl/70" : "border-transparent bg-white hover:border-bd"
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
              aria-label="归档 Session"
            >
              <Archive className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: DraftMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-ds-lg border px-4 py-3 shadow-ds-xs ${
          isUser
            ? "border-ac/20 bg-ac text-white"
            : "border-bd bg-white text-tx"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-ds-base leading-relaxed">{message.content}</p>
        ) : message.content ? (
          <MarkdownRenderer content={message.content} />
        ) : (
          <span className="inline-flex items-center text-ds-sm text-txs">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            思考中
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState({ module }: { module: HaiFeatureModule | null }) {
  return (
    <div className="mx-auto flex h-full min-h-[360px] max-w-xl flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-ds-full bg-acl">
        <Brain className="h-7 w-7 text-ac" />
      </div>
      <h2 className="text-ds-2xl font-ds-black text-tx">{module?.name ?? "HAI"}</h2>
      <p className="mt-2 text-ds-base leading-relaxed text-txs">{module?.description ?? "选择一个模块开始新的教研 Session。"}</p>
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
            className="h-11 flex-1 rounded-ds-md border border-bd bg-bg px-3 text-ds-base outline-none focus:border-ac focus:ring-2 focus:ring-ac/15"
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
            className="min-h-[76px] w-full resize-none rounded-ds-sm border border-bd bg-bg px-2 py-2 text-ds-sm leading-relaxed"
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
