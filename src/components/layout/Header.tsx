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
import { GraduationCap, Menu, X, Settings, LogOut, User, BookOpen, ShieldCheck, BarChart3 } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import routes from "@/routes";
import { useAuth } from "@/contexts/AuthContext";

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
