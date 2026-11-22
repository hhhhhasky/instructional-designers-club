import { Link } from "react-router-dom";
import PageMeta from "@/components/common/PageMeta";

export default function NotFoundPage({ backTo = "/", backLabel = "返回首页" }: { backTo?: string; backLabel?: string }) {
  return (
    <section className="mx-auto max-w-lg px-5 py-20 text-center">
      <PageMeta title="页面找不到了" description="" noIndex />
      <h1 className="text-2xl font-bold text-tx">页面找不到了</h1>
      <p className="mt-3 text-txs">链接可能有误，或内容已经下架。</p>
      <Link to={backTo} className="mt-5 inline-block font-semibold text-ac underline">{backLabel}</Link>
    </section>
  );
}
