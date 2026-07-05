import { Bell, CheckCheck, Gift, Star, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyNotifications, markNotificationsRead } from "@/db/api";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/time";
import type { UserNotification } from "@/types/types";

const TYPE_META: Record<string, { Icon: typeof Bell; color: string }> = {
  credit_reward: { Icon: Gift, color: "text-tl" },
  credit_deduct: { Icon: TrendingDown, color: "text-error-tx" },
  level_change: { Icon: TrendingUp, color: "text-ac" },
  banned: { Icon: Star, color: "text-error-tx" },
  unbanned: { Icon: Star, color: "text-tl" },
};

const MAX_VISIBLE = 5;

export default function NotificationCard() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await getMyNotifications();
      setNotifications(data);
    } catch {
      // 静默失败，不阻塞首页
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    try {
      await markNotificationsRead(unreadIds);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // 静默
    }
  };

  const markOneRead = async (id: string, link?: string | null) => {
    try {
      await markNotificationsRead([id]);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      // 静默
    }
    if (link) {
      navigate(link);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const visible = notifications.slice(0, MAX_VISIBLE);

  if (loading) return null;
  if (unreadCount === 0) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 mt-6">
      <div className="bg-acl rounded-ds-xl border border-ac/20 shadow-ds-xs overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-ac/10">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-ac" />
            <span className="text-ds-sm font-ds-semibold text-tx">
              通知
            </span>
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-ds-full bg-ac text-white text-ds-xs font-ds-semibold">
              {unreadCount}
            </span>
          </div>
          <button
            onClick={markAllRead}
            className="text-ds-xs text-txs hover:text-ac transition-colors flex items-center gap-1"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            全部已读
          </button>
        </div>

        {/* 通知列表 */}
        <div className="divide-y divide-ac/10">
          {visible.map((n) => {
            const meta = TYPE_META[n.type] || { Icon: Bell, color: "text-txs" };
            const Icon = meta.Icon;
            return (
              <button
                key={n.id}
                onClick={() => markOneRead(n.id, n.link)}
                className={cn(
                  "w-full text-left px-5 py-3 flex items-start gap-3 transition-colors hover:bg-ac/5",
                  !n.is_read && "bg-ac/5"
                )}
              >
                <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", meta.color)} />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-ds-sm text-tx",
                      !n.is_read && "font-ds-semibold"
                    )}
                  >
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-ds-xs text-txs mt-0.5 line-clamp-2">
                      {n.body}
                    </p>
                  )}
                </div>
                <span className="text-ds-xs text-txs whitespace-nowrap shrink-0">
                  {relativeTime(n.created_at)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
