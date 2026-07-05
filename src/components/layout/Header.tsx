import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GraduationCap, Menu, X, Settings, LogOut, User, BookOpen, ShieldCheck, BarChart3, Bell, CheckCheck, Gift, TrendingUp, TrendingDown } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import routes from "@/routes";
import { useAuth } from "@/contexts/AuthContext";
import { getCourseCatalogSnapshot, getMyNotifications, getResources, getUnreadNotificationCount, markNotificationsRead } from "@/db/api";
import { relativeTime } from "@/lib/time";
import type { UserNotification } from "@/types/types";

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // 通知铃铛
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const count = await getUnreadNotificationCount();
        setUnreadCount(count);
        if (count > 0) {
          const list = await getMyNotifications();
          setNotifications(list);
        }
      } catch { /* 静默 */ }
    };
    load();
    // 每 30 秒轮询一次
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [user]);

  const openNotifications = async () => {
    setNotifOpen(!notifOpen);
    if (!notifOpen && unreadCount > 0) {
      try {
        const list = await getMyNotifications();
        setNotifications(list);
      } catch { /* 静默 */ }
    }
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    try {
      await markNotificationsRead(unreadIds);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* 静默 */ }
  };

  const markOneRead = async (id: string, link?: string | null) => {
    try {
      await markNotificationsRead([id]);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* 静默 */ }
    setNotifOpen(false);
    if (link) navigate(link);
  };

  const TYPE_ICON: Record<string, typeof Bell> = {
    credit_reward: Gift,
    credit_deduct: TrendingDown,
    level_change: TrendingUp,
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 点击外部关闭通知下拉
  useEffect(() => {
    if (!notifOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-notif-area]')) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifOpen]);

  const visibleRoutes = routes.filter(route => route.visible);

  const isRouteActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/courses') return location.pathname === '/courses' || location.pathname.startsWith('/courses/plus');
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const handleSignOut = async () => {
    await signOut();
    setIsOpen(false);
    navigate('/');
  };

  const prefetchRoute = (path: string) => {
    if (path === "/courses" || path === "/teacher-ai-courses") {
      void getCourseCatalogSnapshot();
      return;
    }
    if (path === "/resources") {
      void getResources();
    }
  };

  const avatarEl = profile?.avatar_url ? (
    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
  ) : (
    <span className="text-sm font-ds-bold text-ac">
      {profile?.nickname?.[0] || '?'}
    </span>
  );

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-[rgba(250,248,245,0.92)] backdrop-blur-xl shadow-ds-sm border-b border-bd"
          : "bg-[rgba(250,248,245,0.6)] backdrop-blur-sm"
      }`}
    >
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="flex items-center justify-between h-14 xl:h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-9 h-9 rounded-ds-full flex items-center justify-center bg-acl">
              <GraduationCap className="w-5 h-5 text-ac" />
            </div>
            <span className="text-ds-lg font-ds-bold text-tx" style={{ fontFamily: 'var(--fd)' }}>
              教学设计师俱乐部
            </span>
          </Link>

          {/* 桌面端导航 */}
          <nav className="hidden xl:flex items-center gap-1">
            {visibleRoutes.map((route) => (
              <Link
                key={route.path}
                to={route.path}
                onMouseEnter={() => prefetchRoute(route.path)}
                onFocus={() => prefetchRoute(route.path)}
                onTouchStart={() => prefetchRoute(route.path)}
                className={`px-3 py-1.5 text-ds-sm font-ds-semibold rounded-ds-pill transition-all ${
                  isRouteActive(route.path)
                    ? "text-ac bg-acl"
                    : "text-txs hover:text-ac hover:bg-acl"
                }`}
              >
                {route.name}
              </Link>
            ))}
          </nav>

          {/* 右侧按钮 */}
          <div className="flex items-center gap-3">
            {/* 通知铃铛 */}
            {user && (
              <div className="relative" data-notif-area>
                <button
                  onClick={openNotifications}
                  className="relative w-8 h-8 flex items-center justify-center rounded-ds-full hover:bg-acl transition-colors"
                >
                  <Bell className="w-5 h-5 text-txs" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-ds-full bg-red-500 text-white text-ds-xs font-ds-bold px-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* 通知下拉 */}
                {notifOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-ds-xl border border-bd shadow-ds-lg overflow-hidden z-50">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-bd">
                      <span className="text-ds-sm font-ds-semibold text-tx">通知</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-ds-xs text-txs hover:text-ac transition-colors flex items-center gap-1"
                        >
                          <CheckCheck className="w-3 h-3" />
                          全部已读
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="px-4 py-6 text-ds-sm text-txs text-center">暂无通知</p>
                      ) : (
                        notifications.slice(0, 10).map((n) => {
                          const Icon = TYPE_ICON[n.type] || Bell;
                          return (
                            <button
                              key={n.id}
                              onClick={() => markOneRead(n.id, n.link)}
                              className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-bgs transition-colors border-b border-bdl last:border-b-0 ${
                                !n.is_read ? 'bg-acl/40' : ''
                              }`}
                            >
                              <Icon className="w-4 h-4 mt-0.5 shrink-0 text-ac" />
                              <div className="min-w-0 flex-1">
                                <p className={`text-ds-sm text-tx ${!n.is_read ? 'font-ds-semibold' : ''}`}>
                                  {n.title}
                                </p>
                                {n.body && (
                                  <p className="text-ds-xs text-txs mt-0.5 line-clamp-1">{n.body}</p>
                                )}
                                <p className="text-ds-xs text-txs/60 mt-1">{relativeTime(n.created_at)}</p>
                              </div>
                              {!n.is_read && (
                                <span className="w-2 h-2 rounded-full bg-ac shrink-0 mt-1.5" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {user ? (
              /* 已登录：头像 + 下拉菜单 */
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-8 h-8 rounded-ds-full bg-acl flex items-center justify-center overflow-hidden ring-2 ring-transparent hover:ring-ac/30 transition-all">
                    {avatarEl}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-ds-semibold text-tx">{profile?.nickname}</p>
                    <p className="text-xs text-txs">
                      {profile?.access_level === 'pro' ? 'Pro 专家版' :
                       profile?.access_level === 'plus' ? 'Plus 会员版' : '免费版'}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/learning')} className="cursor-pointer">
                    <BookOpen className="w-4 h-4 mr-2" />
                    我的学习
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
                    <Settings className="w-4 h-4 mr-2" />
                    账号设置
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer text-ac">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        数据看板
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/admin/manage')} className="cursor-pointer text-ac">
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        数据维护
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600">
                    <LogOut className="w-4 h-4 mr-2" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              /* 未登录：注册/登录 */
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-ds-sm font-ds-semibold text-txs hover:text-ac hover:bg-acl rounded-ds-pill transition-all"
              >
                <User className="w-4 h-4" />
                注册/登录
              </Link>
            )}

            {/* 移动端菜单按钮 */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="xl:hidden"
                >
                  {isOpen ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Menu className="w-5 h-5" />
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <div className="flex flex-col gap-4 mt-8">
                  {/* 用户信息 or Logo */}
                  {user ? (
                    <div className="flex items-center gap-2 pb-4 border-b border-bd">
                      <div className="w-10 h-10 rounded-ds-full bg-acl flex items-center justify-center overflow-hidden">
                        {avatarEl}
                      </div>
                      <div>
                        <p className="text-sm font-ds-bold text-tx">{profile?.nickname}</p>
                        <p className="text-xs text-txs">
                          {profile?.access_level === 'pro' ? 'Pro 专家版' :
                           profile?.access_level === 'plus' ? 'Plus 会员版' : '免费版'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 pb-4 border-b border-bd">
                      <div className="w-10 h-10 rounded-ds-full flex items-center justify-center bg-acl">
                        <GraduationCap className="w-6 h-6 text-ac" />
                      </div>
                      <span className="text-ds-lg font-ds-bold text-tx" style={{ fontFamily: 'var(--fd)' }}>
                        教学设计师俱乐部
                      </span>
                    </div>
                  )}

                  <nav className="flex flex-col gap-2">
                    {visibleRoutes.map((route) => (
                      <Link
                        key={route.path}
                        to={route.path}
                        onMouseEnter={() => prefetchRoute(route.path)}
                        onFocus={() => prefetchRoute(route.path)}
                        onTouchStart={() => prefetchRoute(route.path)}
                        onClick={() => setIsOpen(false)}
                        className={`px-4 py-3 text-left text-ds-base font-ds-medium rounded-ds-lg transition-all ${
                          isRouteActive(route.path)
                            ? "text-ac bg-acl"
                            : "text-tx hover:bg-bgs"
                        }`}
                      >
                        {route.name}
                      </Link>
                    ))}

                    {/* 移动端用户菜单 */}
                    {user ? (
                      <>
                        <Link
                          to="/learning"
                          onClick={() => setIsOpen(false)}
                          className="px-4 py-3 text-left text-ds-base font-ds-medium rounded-ds-lg text-tx hover:bg-bgs transition-all flex items-center gap-2"
                        >
                          <BookOpen className="w-4 h-4" />
                          我的学习
                        </Link>
                        <Link
                          to="/settings"
                          onClick={() => setIsOpen(false)}
                          className="px-4 py-3 text-left text-ds-base font-ds-medium rounded-ds-lg text-tx hover:bg-bgs transition-all flex items-center gap-2"
                        >
                          <Settings className="w-4 h-4" />
                          账号设置
                        </Link>
                        {isAdmin && (
                          <Link
                            to="/admin"
                            onClick={() => setIsOpen(false)}
                            className="px-4 py-3 text-left text-ds-base font-ds-medium rounded-ds-lg text-ac hover:bg-acl transition-all flex items-center gap-2"
                          >
                            <BarChart3 className="w-4 h-4" />
                            数据看板
                          </Link>
                        )}
                        {isAdmin && (
                          <Link
                            to="/admin/manage"
                            onClick={() => setIsOpen(false)}
                            className="px-4 py-3 text-left text-ds-base font-ds-medium rounded-ds-lg text-ac hover:bg-acl transition-all flex items-center gap-2"
                          >
                            <ShieldCheck className="w-4 h-4" />
                            数据维护
                          </Link>
                        )}
                        <button
                          onClick={handleSignOut}
                          className="px-4 py-3 text-left text-ds-base font-ds-medium rounded-ds-lg text-red-600 hover:bg-red-50 transition-all flex items-center gap-2"
                        >
                          <LogOut className="w-4 h-4" />
                          退出登录
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          to="/login"
                          onClick={() => setIsOpen(false)}
                          className="px-4 py-3 text-left text-ds-base font-ds-medium rounded-ds-lg text-tx hover:bg-bgs transition-all flex items-center gap-2"
                        >
                          <User className="w-4 h-4" />
                          注册/登录
                        </Link>
                      </>
                    )}
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
