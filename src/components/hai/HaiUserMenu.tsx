import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronsUpDown, Pin, UserRound, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getHaiAccessStatus, getHaiMemories, createHaiMemory, archiveHaiMemory, type HaiUsageSummary, type HaiUserMemory } from "@/db/hai-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function HaiUserMenu({ usage: suppliedUsage }: { usage?: HaiUsageSummary | null }) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [usage, setUsage] = useState<HaiUsageSummary | null>(null);
  const [memories, setMemories] = useState<HaiUserMemory[]>([]);
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState("teaching_preference");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const balance = suppliedUsage === undefined ? usage : suppliedUsage;
  const name = profile?.nickname || "我的账号";

  useEffect(() => {
    if (!user || suppliedUsage !== undefined) return;
    let cancelled = false;
    (async () => { try { const result = await getHaiAccessStatus(); if (!cancelled) setUsage(result.usage); } catch { /* 不影响主工作区，未知积分显示为待更新。 */ } })();
    return () => { cancelled = true; };
  }, [user?.id, suppliedUsage]);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setLoading(true); setError("");
    getHaiMemories(user.id).then(rows => { if (!cancelled) setMemories(rows); })
      .catch(() => { if (!cancelled) setError("记忆读取失败，请关闭后重新打开。"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, user?.id]);

  async function save() {
    if (!user || busy || !draft.trim()) return;
    setBusy(true); setError("");
    try {
      await createHaiMemory({ userId: user.id, category, content: draft.trim() });
      setDraft("");
      setMemories(await getHaiMemories(user.id));
    } catch { setError("记忆未能保存，请稍后重试。"); }
    finally { setBusy(false); }
  }
  async function archive(id: string) {
    if (busy) return;
    setBusy(true); setError("");
    try { await archiveHaiMemory(id); setMemories(rows => rows.filter(row => row.id !== id)); }
    catch { setError("记忆未能归档，请稍后重试。"); }
    finally { setBusy(false); }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="用户与记忆设置" aria-haspopup="dialog" className="flex min-h-16 w-full items-center gap-3 rounded-md px-2 py-3 text-left transition hover:bg-[var(--paper)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-acl text-ac">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-4 w-4" />}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-tx">{name}</span><span className="mt-1 block text-xs text-txs">{balance ? `${formatPoints(balance.current_points)} 积分` : "积分待更新"}</span></span>
      <ChevronsUpDown className="h-4 w-4 shrink-0 text-txt" />
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto bg-[var(--paper)] sm:max-w-lg">
        <DialogHeader><DialogTitle>用户设置</DialogTitle><DialogDescription>{name} · 管理积分与 HAI 的用户记忆</DialogDescription></DialogHeader>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {loading ? <p role="status" className="py-6 text-sm text-txs">正在读取记忆…</p> : <UsagePanel usage={balance} memories={memories} memoryDraft={draft} memoryCategory={category} busy={busy} onMemoryDraftChange={setDraft} onMemoryCategoryChange={setCategory} onCreateMemory={save} onArchiveMemory={archive} />}
      </DialogContent>
    </Dialog>
  </>;
}

function UsagePanel({
  usage,
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
      <div className="border-b border-bd pb-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-ds-sm font-ds-bold text-tx">积分额度</h2>
          <Badge variant="outline" className="border-ac/30 text-ac">
            积分
          </Badge>
        </div>
        <p className="text-2xl font-ds-black text-tx">{usage ? `${formatPoints(usage.current_points)} 积分` : "积分待更新"}</p>
        <p className="mt-1 text-ds-xs text-txs">
          累计已消耗 {formatPoints(usage?.consumed_points)} 积分
        </p>
        <Button asChild size="sm" className="mt-3 w-full bg-ac text-white hover:bg-acd">
          <Link to="/hai/points">购买积分</Link>
        </Button>
      </div>
      <div className="pt-1">
        <div className="mb-3 flex items-center gap-2">
          <Pin className="h-4 w-4 text-ac" />
          <h2 className="text-ds-sm font-ds-bold text-tx">用户记忆</h2>
        </div>
        <div className="space-y-2">
          <select
            aria-label="记忆分类"
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
            aria-label="用户记忆内容"
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
          ) : memories.map((memory) => (
            <div key={memory.id} className="group rounded-ds-md border border-bd bg-bg p-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-[11px]">
                  {memoryLabel(memory.category)}
                </Badge>
                <button
                  className="rounded-ds-sm p-1 text-txt opacity-60 transition hover:bg-white hover:text-ac group-hover:opacity-100"
                  onClick={() => onArchiveMemory(memory.id)}
                  disabled={busy}
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

function formatPoints(value?: number) {
  const points = Number(value ?? 0);
  return Number.isInteger(points) ? points.toLocaleString("zh-CN") : points.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
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
