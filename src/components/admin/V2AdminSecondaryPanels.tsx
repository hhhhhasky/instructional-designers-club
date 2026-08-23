import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  getV2AccessRows,
  getV2ReviewDetail,
  getV2ReviewQueue,
  saveV2Access,
  saveV2Review,
  type V2AccessRow,
  type V2ReviewDetail,
  type V2ReviewQueueItem,
} from "@/db/v2-api";

export function V2ReviewPanel() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<V2ReviewQueueItem[]>([]);
  const [detail, setDetail] = useState<V2ReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [score, setScore] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setQueue(await getV2ReviewQueue());
    } catch (error) {
      console.error(error);
      toast.error("批阅列表加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submitReview(status: "reviewed" | "revision_required") {
    if (!detail || !user) return;
    try {
      await saveV2Review(detail.attempt.id, user.id, {
        status,
        score: score ? Number(score) : null,
        feedback_markdown: feedback,
        rubric_result: null,
      });
      toast.success(status === "revision_required" ? "已退回修改" : "批阅已保存");
      setDetail(null);
      setFeedback("");
      setScore("");
      await load();
    } catch (error) {
      console.error(error);
      toast.error("批阅保存失败");
    }
  }

  return (
    <div className="rounded-3xl border border-bdl bg-white/65 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-ds-black tracking-[.16em] text-ac">V2 REVIEW CENTER</p>
          <h3 className="mt-2 font-serif text-2xl font-ds-black text-tx">批阅中心</h3>
          <p className="mt-1 text-xs text-txs">标准题和开放任务的提交、反馈与二次修改记录都保留。</p>
        </div>
        <Button onClick={() => void load()} variant="outline" className="border-bdl bg-white text-tx">刷新</Button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-xs text-txs">加载提交记录...</p>
      ) : queue.length === 0 ? (
        <p className="py-10 text-center text-xs text-txs">暂无待处理提交</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead><tr className="border-b border-bdl text-[10px] tracking-wide text-txs"><th className="px-3 py-2">学员</th><th className="px-3 py-2">课程路径</th><th className="px-3 py-2">任务</th><th className="px-3 py-2">提交时间</th><th className="px-3 py-2">状态</th><th className="px-3 py-2" /></tr></thead>
            <tbody>{queue.map((item) => <tr key={item.id} className="border-b border-bdl/70"><td className="px-3 py-3"><p className="font-ds-bold text-tx">{item.learner_name}</p><p className="mt-1 text-[10px] text-txs">{item.learner_phone}</p></td><td className="px-3 py-3 text-txs">{item.module_title} / {item.unit_title} / {item.lesson_title}</td><td className="px-3 py-3 text-txs">{item.assessment_title} · 第 {item.attempt_no} 次</td><td className="px-3 py-3 text-txs">{item.submitted_at ? new Date(item.submitted_at).toLocaleString("zh-CN") : "—"}</td><td className="px-3 py-3"><StatusPill status={item.status} /></td><td className="px-3 py-3 text-right"><Button size="sm" onClick={() => getV2ReviewDetail(item.id).then(setDetail).catch(() => toast.error("详情加载失败"))}>打开</Button></td></tr>)}</tbody>
          </table>
        </div>
      )}

      {detail && (
        <div className="mt-5 rounded-2xl border border-ac/25 bg-acl/30 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-ds-bold text-tx">{detail.learner_name} · {detail.block.title}</p><p className="mt-1 text-[11px] text-txs">{detail.lesson?.title ?? "单元任务"} · 第 {detail.attempt.attempt_no} 次提交</p></div><button type="button" onClick={() => setDetail(null)} className="text-xs text-txs hover:text-tx">关闭</button></div>
          <div className="mt-4 space-y-3">
            {detail.items.map((item, index) => {
              const answer = detail.answers.find((row) => row.item_id === item.id);
              const answerValue = answer?.answer_text || (Array.isArray(answer?.answer_json) ? answer.answer_json.join("、") : "（未填写答案）");
              return <div key={item.id} className="rounded-xl border border-bdl bg-white/70 p-3"><p className="text-xs font-ds-bold text-tx">{index + 1}. {item.prompt_markdown}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-txs">{answerValue}</p></div>;
            })}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[140px_1fr]"><input value={score} onChange={(event) => setScore(event.target.value)} type="number" placeholder="分数" className="rounded-xl border border-bdl bg-white px-3 py-2 text-sm text-tx outline-none focus:border-ac" /><textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={4} placeholder="Markdown 反馈" className="rounded-xl border border-bdl bg-white px-3 py-2 text-sm text-tx outline-none focus:border-ac" /></div>
          <div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => void submitReview("reviewed")} className="bg-[#173d39] text-white hover:bg-[#24554e]"><Check className="h-4 w-4" />通过并保存</Button><Button onClick={() => void submitReview("revision_required")} variant="outline" className="border-[#bb704c] bg-white text-[#bb704c]">要求修改</Button></div>
        </div>
      )}
    </div>
  );
}

export function V2AccessPanel() {
  const [rows, setRows] = useState<V2AccessRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); try { setRows(await getV2AccessRows()); } catch (error) { console.error(error); toast.error("V2 权限列表加载失败"); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = rows.filter((row) => `${row.nickname} ${row.phone}`.toLowerCase().includes(query.toLowerCase()));

  async function toggle(row: V2AccessRow) {
    const status = row.access_status === "active" ? "suspended" : "active";
    try {
      await saveV2Access(row.user_id, status, row.notes ?? "", row.expires_at);
      toast.success(status === "active" ? "已开通 V2" : "已暂停 V2");
      await load();
    } catch (error) {
      console.error(error);
      toast.error("权限更新失败");
    }
  }

  return (
    <div className="rounded-3xl border border-bdl bg-white/65 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-ds-black tracking-[.16em] text-ac">V2 ACCESS</p><h3 className="mt-2 font-serif text-2xl font-ds-black text-tx">新版访问权限</h3><p className="mt-1 text-xs text-txs">有效权限用户会在顶部导航看到“教学通识课 V2”。</p></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索昵称 / 手机号" className="rounded-xl border border-bdl bg-white px-3 py-2 text-xs text-tx outline-none focus:border-ac" /></div>
      {loading ? <p className="py-10 text-center text-xs text-txs">加载会员权限...</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead><tr className="border-b border-bdl text-[10px] tracking-wide text-txs"><th className="px-3 py-2">会员</th><th className="px-3 py-2">账号状态</th><th className="px-3 py-2">V2 状态</th><th className="px-3 py-2">有效期</th><th className="px-3 py-2" /></tr></thead><tbody>{filtered.map((row) => <tr key={row.user_id} className="border-b border-bdl/70"><td className="px-3 py-3"><p className="font-ds-bold text-tx">{row.nickname}</p><p className="mt-1 text-[10px] text-txs">{row.phone}</p></td><td className="px-3 py-3 text-txs">{row.profile_status}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-ds-bold ${row.access_status === "active" ? "bg-bgs text-ac" : row.access_status === "suspended" ? "bg-[#fff0e8] text-[#bb704c]" : "bg-bgs text-txs"}`}>{row.access_status === "active" ? "已开通" : row.access_status === "suspended" ? "已暂停" : "未开通"}</span></td><td className="px-3 py-3 text-txs">{row.expires_at ? new Date(row.expires_at).toLocaleDateString("zh-CN") : "不限期"}</td><td className="px-3 py-3 text-right"><Button size="sm" variant="outline" onClick={() => void toggle(row)} className="border-bdl bg-white text-tx">{row.access_status === "active" ? "暂停" : "开通"}</Button></td></tr>)}</tbody></table></div>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const labels: Record<string, string> = { draft: "草稿", submitted: "待批阅", reviewed: "已批阅", revision_required: "要求修改" };
  return <span className={`rounded-full px-2 py-1 text-[10px] font-ds-bold ${status === "reviewed" ? "bg-bgs text-ac" : status === "revision_required" ? "bg-[#fff0e8] text-[#bb704c]" : "bg-bgs text-txs"}`}>{labels[status] ?? status}</span>;
}
