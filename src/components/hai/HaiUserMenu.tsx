import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Brain, Coins, Pin, X } from "lucide-react";
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
    <div className="flex items-center gap-1 sm:gap-2" aria-label="HAI 积分与记忆">
      <span className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[var(--paper-deep)] px-2 text-xs font-semibold text-tx" title="当前积分"><Coins className="h-4 w-4 shrink-0 text-ac" aria-hidden="true" />{balance ? <>{formatPoints(balance.current_points)}<span className="hidden sm:inline"> 积分</span></> : <><span className="sm:hidden">--</span><span className="hidden sm:inline">积分待更新</span></>}</span>
      <button type="button" onClick={() => setOpen(true)} aria-label="记忆设置" title="记忆设置" aria-haspopup="dialog" className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs text-txs hover:bg-[var(--paper-deep)] hover:text-tx focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac"><Brain className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="hidden sm:inline">记忆设置</span></button>
      <Link to="/hai/points" title="购买积分" aria-label="购买积分" className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-ac hover:bg-[var(--paper-deep)]">购买<span className="hidden sm:inline">积分</span></Link>
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto bg-[var(--paper)] sm:max-w-lg">
        <DialogHeader><DialogTitle>记忆设置</DialogTitle><DialogDescription>{name} · 管理 HAI 需要记住的信息</DialogDescription></DialogHeader>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {loading ? <p role="status" className="py-6 text-sm text-txs">正在读取记忆…</p> : <UsagePanel memories={memories} memoryDraft={draft} memoryCategory={category} busy={busy} onMemoryDraftChange={setDraft} onMemoryCategoryChange={setCategory} onCreateMemory={save} onArchiveMemory={archive} />}
      </DialogContent>
    </Dialog>
  </>;
}

function UsagePanel({
  memories,
  memoryDraft,
  memoryCategory,
  busy,
  onMemoryDraftChange,
  onMemoryCategoryChange,
  onCreateMemory,
  onArchiveMemory,
}: {
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
                <Badge variant="outline" className="text-xs">
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
