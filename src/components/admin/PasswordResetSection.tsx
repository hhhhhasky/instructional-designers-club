import { Check, Copy, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import { Button } from "@/components/ui/button";
import { supabase } from "@/db/supabase";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------
interface PasswordResetRequest {
  id: string;
  phone: string;
  user_id: string | null;
  note: string;
  status: "pending" | "approved" | "rejected";
  temp_password: string | null;
  created_at: string;
  resolved_at: string | null;
}

const STATUS_LABEL: Record<PasswordResetRequest["status"], string> = {
  pending: "待处理",
  approved: "已通过",
  rejected: "已拒绝",
};

const STATUS_CLASS: Record<PasswordResetRequest["status"], string> = {
  pending: "bg-am/10 text-am",
  approved: "bg-tl/10 text-tl",
  rejected: "bg-txs/10 text-txs",
};

// ---------------------------------------------------------------------------
// 组件
// ---------------------------------------------------------------------------
export default function PasswordResetSection() {
  const [requests, setRequests] = useState<PasswordResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: qError } = await supabase
        .from("password_reset_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (qError) throw qError;
      setRequests((data ?? []) as PasswordResetRequest[]);
    } catch {
      setError("加载重置申请失败，请刷新重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ---- 操作 ----
  const handleAction = async (requestId: string, action: "approve" | "reject") => {
    try {
      setProcessingId(requestId);
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ request_id: requestId, action }),
        }
      );
      const result = (await res.json()) as {
        ok?: boolean;
        error?: string;
        temp_password?: string;
      };

      if (!res.ok || result.error) {
        toast.error(result.error ?? "操作失败");
      } else if (action === "reject") {
        toast.success("已拒绝该重置申请");
      } else if (result.temp_password) {
        // 批准成功 → 弹临时密码
        toast.success(
          `密码已重置，临时密码：${result.temp_password}`,
          {
            duration: 12000,
            action: {
              label: "复制",
              onClick: () => {
                navigator.clipboard.writeText(result.temp_password!).then(
                  () => toast.success("已复制临时密码"),
                  () => toast.error("复制失败，请手动记下")
                );
              },
            },
          }
        );
      } else {
        toast.success("密码已重置");
      }

      // 刷新列表
      await load();
    } catch {
      toast.error("请求发送失败，请检查网络后重试");
    } finally {
      setProcessingId(null);
    }
  };

  // ---- 渲染 ----
  if (loading) return <LoadingOverlay message="正在加载重置申请..." />;
  if (error)
    return (
      <div className="text-center py-12">
        <p className="text-txs mb-4">{error}</p>
        <button onClick={load} className="text-ac hover:underline">
          重新加载
        </button>
      </div>
    );

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <span className="text-ds-sm text-txs">
          共 {requests.length} 条申请，{pendingCount} 条待处理
        </span>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} />
          刷新
        </Button>
      </div>

      {/* 无数据 */}
      {requests.length === 0 && (
        <div className="text-center py-16">
          <p className="text-txs">暂无重置申请</p>
        </div>
      )}

      {/* 列表 */}
      <div className="divide-y divide-bd border border-bd rounded-ds-lg overflow-hidden">
        {requests.map((req) => (
          <div
            key={req.id}
            className={cn(
              "p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3",
              req.status === "pending" ? "bg-white" : "bg-bg/50"
            )}
          >
            {/* 左：信息 */}
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-tx font-ds-bold text-ds-sm">{req.phone}</span>
                <span
                  className={cn(
                    "inline-block px-2 py-0.5 rounded-ds-full text-xs font-ds-bold",
                    STATUS_CLASS[req.status]
                  )}
                >
                  {STATUS_LABEL[req.status]}
                </span>
                {req.note && (
                  <span className="text-txt text-xs truncate max-w-[160px]">{req.note}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 text-xs text-txt">
                <span>
                  申请时间：{new Date(req.created_at).toLocaleString("zh-CN")}
                </span>
                {req.resolved_at && (
                  <span>
                    处理时间：{new Date(req.resolved_at).toLocaleString("zh-CN")}
                  </span>
                )}
                {req.status === "approved" && req.temp_password && (
                  <span className="flex items-center gap-1">
                    临时密码：{req.temp_password}
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(req.temp_password!).then(
                          () => toast.success("已复制临时密码"),
                          () => toast.error("复制失败")
                        );
                      }}
                      className="text-ac hover:text-ac/80 transition-colors"
                      title="复制临时密码"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            </div>

            {/* 右：操作按钮（仅 pending） */}
            {req.status === "pending" && (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-tl text-tl hover:bg-tl/10"
                  onClick={() => handleAction(req.id, "approve")}
                  disabled={processingId === req.id}
                >
                  {processingId === req.id ? null : <Check className="w-4 h-4 mr-1" />}
                  {processingId === req.id ? "处理中..." : "通过"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-txs/40 text-txs hover:bg-txs/10"
                  onClick={() => handleAction(req.id, "reject")}
                  disabled={processingId === req.id}
                >
                  {processingId === req.id ? null : <X className="w-4 h-4 mr-1" />}
                  {processingId === req.id ? "处理中..." : "拒绝"}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
