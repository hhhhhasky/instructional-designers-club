import { Bell, CheckCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getMyNotifications, getUnreadNotificationCount, markNotificationsRead } from '@/db/api';
import { relativeTime } from '@/lib/time';
import type { UserNotification } from '@/types/types';

export default function SiteNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const area = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) { setUnread(0); setNotifications([]); return; }
    let cancelled = false;
    const load = async () => { try { const count = await getUnreadNotificationCount(); if (!cancelled) setUnread(count); } catch { /* 不影响页面使用 */ } };
    void load();
    const timer = window.setInterval(load, 30000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [user]);
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (!area.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true); setError(false); setLoading(true);
    try { setNotifications(await getMyNotifications()); } catch { setError(true); } finally { setLoading(false); }
  };
  const markRead = async (items: UserNotification[]) => {
    const ids = items.filter(n => !n.is_read).map(n => n.id);
    if (!ids.length) return;
    try { await markNotificationsRead(ids); setNotifications(previous => previous.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n)); setUnread(count => Math.max(0, count - ids.length)); } catch { setError(true); }
  };
  if (!user) return null;
  return <div ref={area} className="relative shrink-0">
    <button type="button" onClick={() => void toggle()} aria-expanded={open} aria-label={`通知${unread ? `，${unread}条未读` : ''}`} title="通知" className="relative flex h-9 w-9 items-center justify-center rounded-lg text-txs hover:bg-[var(--paper-deep)] hover:text-ac"><Bell size={19} aria-hidden="true" />{unread > 0 && <span className="absolute right-0 top-0 flex min-h-[17px] min-w-[17px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-none text-white">{unread > 99 ? '99+' : unread}</span>}</button>
    {open && <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-bd bg-white shadow-xl" aria-label="通知列表"><div className="flex items-center justify-between border-b border-bd px-4 py-3 text-sm font-semibold">通知 {unread > 0 && <button className="flex items-center gap-1 text-xs text-txs hover:text-ac" onClick={() => void markRead(notifications)}><CheckCheck size={14} />全部已读</button>}</div><div className="max-h-80 overflow-y-auto">{loading && <p role="status" className="p-5 text-center text-sm text-txs">正在加载通知…</p>}{!loading && error && <p role="alert" className="px-4 py-3 text-sm text-red-600">通知暂时无法加载或更新，请稍后重试。</p>}{notifications.length === 0 && !error && !loading ? <p className="p-5 text-center text-sm text-txs">暂无通知</p> : notifications.slice(0, 10).map(n => <button key={n.id} className="block w-full border-b border-bd px-4 py-3 text-left hover:bg-[var(--paper)]" onClick={() => { void markRead([n]); setOpen(false); if (n.link) navigate(n.link); }}><span className={`block text-sm ${!n.is_read ? 'font-bold text-ac' : ''}`}>{n.title}</span>{n.body && <span className="mt-1 block text-xs text-txs">{n.body}</span>}<span className="mt-1 block text-xs text-txs">{relativeTime(n.created_at)}</span></button>)}</div></div>}
  </div>;
}
