import { ArrowLeft, Coins, Loader2, MessageCircleMore } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Footer from "@/components/common/Footer";
import PageMeta from "@/components/common/PageMeta";
import Header from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getHaiAccessStatus, type HaiUsageSummary } from "@/db/hai-api";

export default function HaiPointsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [usage, setUsage] = useState<HaiUsageSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login", { state: { from: "/hai/points" } });
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void getHaiAccessStatus()
      .then((payload) => {
        if (cancelled) return;
        if (!payload.usage) {
          setError("积分信息加载失败，请稍后重试。");
          return;
        }
        setUsage(payload.usage);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "积分信息加载失败。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const walletPoints = Number(usage?.wallet_points ?? usage?.current_points ?? 0);
  const walletConsumedPoints = Number(usage?.wallet_consumed_points ?? usage?.consumed_points ?? 0);
  const pointPackages = (usage?.point_packages ?? [])
    .filter((pointPackage) => pointPackage.points > 0 && pointPackage.price_cny > 0);

  return (
    <div className="min-h-screen bg-bg text-tx">
      <PageMeta title="购买 HAI 积分" description="查看 HAI 积分套餐并联系企业微信购买" noIndex />
      <Header />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 md:py-12">
        <Button asChild variant="ghost" className="mb-5 text-txs">
          <Link to="/hai/chat"><ArrowLeft className="h-4 w-4" />返回 HAI</Link>
        </Button>

        <section className="overflow-hidden rounded-ds-xl border border-bd bg-white shadow-ds-lg">
          <div className="border-b border-bd bg-gradient-to-br from-acl via-white to-white px-5 py-7 md:px-8 md:py-10">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-ds-full bg-ac text-white">
                <Coins className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-2xl font-ds-black md:text-3xl">购买 HAI 积分</h1>
                <p className="mt-1 text-ds-sm text-txs">所有已登录用户均可购买，积分到账后可用于 HAI Chat 与 HAI Work</p>
              </div>
            </div>
          </div>

          {loading || authLoading ? (
            <div className="flex min-h-72 items-center justify-center text-txs">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />正在加载积分信息
            </div>
          ) : error ? (
            <div className="mx-auto max-w-lg px-5 py-16 text-center">
              <p className="rounded-ds-lg border border-amber-200 bg-amber-50 px-4 py-5 text-ds-sm text-amber-900">{error}</p>
            </div>
          ) : usage ? (
            <div className="grid gap-8 p-5 md:grid-cols-[minmax(0,1fr)_300px] md:p-8">
              <div>
                <div className="mb-6 rounded-ds-lg border border-ac/20 bg-acl/35 p-4">
                  <p className="text-ds-xs text-txs">已购积分余额</p>
                  <p className="mt-1 text-3xl font-ds-black text-ac">{formatPoints(walletPoints)} 积分</p>
                  <p className="mt-2 text-ds-xs text-txs">
                    已消耗 {formatPoints(walletConsumedPoints)} 积分
                  </p>
                  {usage.quota_mode === "internal" && (
                    <p className="mt-2 text-ds-xs leading-relaxed text-acd">
                      当前使用内测额度；购买的积分会保留，内测额度结束后再按积分扣减。
                    </p>
                  )}
                  {usage.quota_mode === "none" && (
                    <p className="mt-2 text-ds-xs leading-relaxed text-amber-700">
                      可先购买积分；使用 HAI 前仍需由后台开通权限或升级会员。
                    </p>
                  )}
                </div>

                <h2 className="mb-3 text-ds-base font-ds-bold">积分套餐</h2>
                {pointPackages.length > 0 ? (
                  <div className="overflow-x-auto rounded-ds-lg border border-bd bg-bg">
                    <table className="w-full min-w-[640px] text-left text-ds-sm">
                      <thead className="bg-acl/30 text-txs">
                        <tr>
                          <th className="px-4 py-3 font-ds-semibold">套餐</th>
                          <th className="px-4 py-3 font-ds-semibold">积分</th>
                          <th className="px-4 py-3 font-ds-semibold">价格</th>
                          <th className="px-4 py-3 font-ds-semibold">可完成内容</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pointPackages.map((pointPackage) => (
                          <tr key={pointPackage.id} className="border-t border-bd align-top">
                            <td className="px-4 py-4">
                              <div className="font-ds-bold text-tx">{pointPackage.name || "HAI 积分包"}</div>
                              {pointPackage.description && (
                                <p className="mt-1 text-ds-xs leading-relaxed text-txs">{pointPackage.description}</p>
                              )}
                              {pointPackage.is_recommended && (
                                <span className="mt-2 inline-flex rounded-ds-full bg-ac/10 px-2 py-1 text-ds-xs font-ds-semibold text-ac">
                                  推荐
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4 font-ds-bold">{formatPoints(pointPackage.points)} 积分</td>
                            <td className="px-4 py-4 font-ds-bold text-ac">¥{formatMoney(pointPackage.price_cny)}</td>
                            <td className="px-4 py-4">
                              <ul className="space-y-1 text-ds-xs leading-relaxed text-txt">
                                {formatValueMetrics(pointPackage.value_metrics).map((metric, metricIndex) => (
                                  <li key={`${pointPackage.id}-${metricIndex}`} className="flex gap-2">
                                    <span aria-hidden="true" className="text-ac">•</span>
                                    <span>{metric}</span>
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="rounded-ds-lg border border-bd bg-bg px-4 py-8 text-center text-ds-sm text-txs">
                    暂无可购买套餐，请联系管理员。
                  </p>
                )}
                <p className="mt-4 text-ds-xs leading-relaxed text-txt">
                  套餐积分数量和价格以当前页面为准。付款与积分到账由运营人员通过企业微信确认。
                </p>
              </div>

              <aside className="rounded-ds-xl border border-bd bg-bg p-5 text-center">
                <MessageCircleMore className="mx-auto h-6 w-6 text-ac" />
                <h2 className="mt-2 text-ds-base font-ds-bold">扫码联系购买</h2>
                <p className="mt-1 text-ds-xs text-txs">添加企业微信，发送账号手机号与所需套餐</p>
                <div className="mx-auto mt-5 aspect-square w-full max-w-[220px] overflow-hidden rounded-ds-lg border border-bd bg-white p-2">
                  <img
                    src={usage.wecom_qr_url || "/哈老师企微二维码.png"}
                    alt="企业微信购买二维码"
                    className="h-full w-full object-contain"
                  />
                </div>
              </aside>
            </div>
          ) : null}
        </section>
      </main>
      <Footer />
    </div>
  );
}

function formatPoints(value?: number) {
  const points = Number(value ?? 0);
  return Number.isInteger(points) ? points.toLocaleString("zh-CN") : points.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function formatValueMetrics(value?: string) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatMoney(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
