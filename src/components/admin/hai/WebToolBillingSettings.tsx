import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/db/supabase";

type Setting = { key: string; value: string | number | boolean };
export default function WebToolBillingSettings({ settings, cnyPerPoint, onSaved }: {
  settings: Setting[]; cnyPerPoint: number; onSaved: (search: number, fetch: number) => void;
}) {
  const searchSetting = settings.find(s => s.key === "points.web_search_cny_per_1000");
  const fetchSetting = settings.find(s => s.key === "points.web_fetch_cny_per_1000");
  const [search, setSearch] = useState(String(searchSetting?.value ?? 5));
  const [fetch, setFetch] = useState(String(fetchSetting?.value ?? 5));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => setSearch(String(searchSetting?.value ?? 5)), [searchSetting?.value]);
  useEffect(() => setFetch(String(fetchSetting?.value ?? 5)), [fetchSetting?.value]);
  const valid = [search, fetch].every(value => value.trim() && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 10000);
  const ready = Boolean(searchSetting && fetchSetting);
  const changed = Number(search) !== Number(searchSetting?.value) || Number(fetch) !== Number(fetchSetting?.value);
  const points = (price: string) => cnyPerPoint > 0 && price.trim() && Number.isFinite(Number(price))
    ? new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 6 }).format(Number(price) / 1000 / cnyPerPoint) : "—";
  async function save() {
    if (!ready || !valid || busy) return;
    setBusy(true); setMessage("");
    try {
      const { error } = await supabase.rpc("hai_update_web_tool_prices", { p_search_cny: Number(search), p_fetch_cny: Number(fetch) });
      if (error) throw error;
      onSaved(Number(search), Number(fetch));
      setMessage("检索与抓取单价已保存，已开始检索的任务继续使用原单价。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "保存失败，请重试。"); }
    finally { setBusy(false); }
  }
  return <section aria-label="联网检索与网页抓取计费" className="mt-5 rounded-ds-md border border-bd bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-ds-base font-ds-bold text-tx">联网检索与网页抓取计费</h3>
        <p className="mt-1 text-ds-xs leading-relaxed text-txs">按成功请求次数计费。一次搜索返回多条结果仍算一次；一次抓取成功取得一页正文算一次。</p></div>
      <Button type="button" size="sm" disabled={busy || !ready || !valid || !changed} onClick={() => void save()}>保存检索与抓取单价</Button>
    </div>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="block text-ds-sm">每1000次成功检索费用（元）
        <input type="number" min={0} max={10000} step="0.01" value={search} onChange={event => setSearch(event.target.value)} disabled={busy} className="mt-2 h-9 w-full rounded-ds-sm border border-bd bg-bg px-2" />
        <span className="mt-1 block text-ds-xs text-txs">每次成功检索：{points(search)}积分</span></label>
      <label className="block text-ds-sm">每1000次成功抓取费用（元）
        <input type="number" min={0} max={10000} step="0.01" value={fetch} onChange={event => setFetch(event.target.value)} disabled={busy} className="mt-2 h-9 w-full rounded-ds-sm border border-bd bg-bg px-2" />
        <span className="mt-1 block text-ds-xs text-txs">每次成功抓取：{points(fetch)}积分</span></label>
    </div>
    <p className="mt-3 text-ds-xs leading-relaxed text-txs">基础换算：1积分＝{cnyPerPoint}元，独立于购买套餐的优惠价格。失败、超时、搜索无结果及抓取无正文不计费；复用已保存资料不重复计费。随任务成功交付统一结算，任务失败或停止不扣费。</p>
    {!ready && <p className="mt-2 text-ds-xs text-amber-700">数据库检索计费配置尚未安装，暂不能保存。</p>}
    {!valid && <p role="alert" className="mt-2 text-ds-xs text-red-700">请填写0至10000之间的有效费用。</p>}
    {message && <p role="status" className="mt-2 text-ds-xs text-txs">{message}</p>}
  </section>;
}
