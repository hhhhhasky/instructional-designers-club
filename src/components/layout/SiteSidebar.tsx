import { BookOpen, Bot, GraduationCap, Home, Library, Radio, ShieldCheck, User } from 'lucide-react';
import { useEffect, useState, type FocusEvent, type MouseEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const links = [
  { label: '首页', path: '/', icon: Home },
  { label: '课程', path: '/course-library', icon: BookOpen },
  { label: 'HAI', path: '/hai/work', icon: Bot },
  { label: 'Live 互动', path: '/live', icon: Radio },
  { label: '我的学习', path: '/learning', icon: GraduationCap },
  { label: '资源中心', path: '/resources', icon: Library },
];

export default function SiteSidebar({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const { user, profile } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('site-sidebar-collapsed') === 'true'; } catch { return false; } });
  const [width, setWidth] = useState(() => { try { return Math.min(340, Math.max(60, Number(localStorage.getItem('site-sidebar-width')) || 240)); } catch { return 240; } });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hint, setHint] = useState<{ text: string; y: number } | null>(null);
  const showHint = (text: string, event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    if (width >= 170 || window.matchMedia('(max-width: 767px)').matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setHint({ text, y: rect.top + rect.height / 2 });
  };
  const hideHint = () => setHint(null);
  useEffect(() => { try { localStorage.setItem('site-sidebar-collapsed', String(collapsed)); localStorage.setItem('site-sidebar-width', String(width)); } catch { /* storage is optional */ } }, [collapsed, width]);
  useEffect(() => { setMobileOpen(false); setHint(null); }, [location.pathname]);
  useEffect(() => { setHint(null); }, [width, collapsed]);
  useEffect(() => { const media = window.matchMedia('(max-width: 767px)'); const report = () => onOpenChange?.(media.matches ? mobileOpen : !collapsed); report(); media.addEventListener('change', report); return () => media.removeEventListener('change', report); }, [collapsed, mobileOpen, onOpenChange]);
  useEffect(() => { const toggle = () => { if (window.matchMedia('(max-width: 767px)').matches) setMobileOpen(open => !open); else setCollapsed(value => !value); }; window.addEventListener('site-sidebar-toggle', toggle); return () => window.removeEventListener('site-sidebar-toggle', toggle); }, []);
  const active = (path: string) => path === '/' ? location.pathname === '/' : path === '/course-library' ? location.pathname === path || location.pathname.startsWith('/courses') || location.pathname.startsWith('/course-v2') || location.pathname === '/teacher-ai-courses' : path === '/hai/work' ? location.pathname.startsWith('/hai') : location.pathname === path || location.pathname.startsWith(`${path}/`);
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault(); const start = event.clientX; const initial = width;
    const move = (e: globalThis.PointerEvent) => {
      const nextWidth = Math.min(340, Math.max(60, initial + e.clientX - start));
      setWidth(nextWidth);
    };
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; window.addEventListener('pointermove', move); window.addEventListener('pointerup', end);
  };
  const shownLinks = profile?.role === 'admin' ? [...links, { label: '平台管理后台', path: '/admin', icon: ShieldCheck }] : links;
  return <>
    <style>{`:root{--site-sidebar-width:${collapsed ? 0 : width}px}.site-shell{margin-left:var(--site-sidebar-width);min-width:0}.site-sidebar{width:var(--site-sidebar-width)} @media(max-width:767px){:root{--site-sidebar-width:0px}.site-sidebar{width:${mobileOpen ? 'min(260px, 82vw)' : '0px'}}} @media print{.site-sidebar{display:none!important}.site-shell{margin-left:0}}`}</style>
    {mobileOpen && <button className="fixed inset-0 z-[59] bg-black/25 md:hidden" aria-label="关闭导航" onClick={() => setMobileOpen(false)} />}
    <aside aria-hidden={collapsed && !mobileOpen ? true : undefined} className={`site-sidebar fixed inset-y-0 left-0 z-[60] flex flex-col border-r border-[var(--paper-rule)] bg-[var(--paper-deep)] text-tx shadow-sm print:hidden ${collapsed ? 'site-hidden' : ''} ${width < 170 ? 'site-icon-only' : ''} ${mobileOpen ? 'site-mobile-open' : 'site-mobile-hidden'}`}>
      <div className="site-brand flex min-h-16 items-center gap-2 overflow-hidden px-3">
        <Link to="/" className="site-logo flex min-w-[170px] flex-1 items-center gap-2.5 pr-8" aria-label="哈老师聊教学设计，返回首页" onMouseEnter={event => showHint("首页", event)} onMouseLeave={hideHint} onFocus={event => showHint("首页", event)} onBlur={hideHint}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ac text-white"><GraduationCap className="h-5 w-5" /></span><span className="site-label whitespace-nowrap font-serif text-base font-bold">哈老师聊教学设计</span></Link>
      </div>
      <nav aria-label="网站导航" onScroll={hideHint} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pt-3">
        <div className="space-y-1">{shownLinks.map(({ label, path, icon: Icon }) => <Link key={path} to={path} aria-label={label} onMouseEnter={event => showHint(label, event)} onMouseLeave={hideHint} onFocus={event => showHint(label, event)} onBlur={hideHint} aria-current={active(path) ? 'page' : undefined} className={`site-nav-link flex min-h-11 min-w-[200px] items-center gap-3 rounded-lg px-3 text-sm transition-colors ${active(path) ? 'bg-[var(--annotation-soft)] font-semibold text-ac' : 'text-txs hover:bg-white hover:text-tx'}`}><Icon className="h-[19px] w-[19px] shrink-0" /><span className="site-label whitespace-nowrap">{label}</span></Link>)}</div>
      </nav>
      <div className="relative border-t border-[var(--paper-rule)] p-2">
        {user ? <><div className="flex items-center overflow-hidden rounded-xl hover:bg-white"><Link to="/settings" aria-label="账号设置" onMouseEnter={event => showHint("账号设置", event)} onMouseLeave={hideHint} onFocus={event => showHint("账号设置", event)} onBlur={hideHint} className="site-profile flex min-w-[155px] flex-1 items-center gap-2.5 px-2 py-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-acl text-sm font-bold text-ac">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : profile?.nickname?.[0] || <User size={18} />}</span><span className="site-label min-w-0 whitespace-nowrap"><strong className="block truncate text-sm">{profile?.nickname || '我的账号'}</strong><span className="block text-xs text-txs">账号设置</span></span></Link></div></> : <Link to="/login" aria-label="注册/登录" onMouseEnter={event => showHint("注册/登录", event)} onMouseLeave={hideHint} onFocus={event => showHint("注册/登录", event)} onBlur={hideHint} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-txs hover:bg-white"><User size={19} className="shrink-0" /><span className="site-label">注册/登录</span></Link>}
      </div>
      {!collapsed && <div role="separator" aria-label="调整工具栏宽度" aria-orientation="vertical" tabIndex={0} onKeyDown={e => { if (e.key === 'ArrowRight') setWidth(w => Math.min(340, w + 10)); if (e.key === 'ArrowLeft') { setWidth(w => Math.max(60, w - 10)); } }} onPointerDown={startDrag} className="absolute -right-1 top-0 hidden h-full w-2 cursor-col-resize hover:bg-ac/20 md:block" />}
    </aside>
    {hint && !collapsed && createPortal(<div role="tooltip" className="pointer-events-none fixed z-[100] -translate-y-1/2 whitespace-nowrap rounded-md bg-[var(--ink)] px-3 py-2 text-xs font-medium text-white shadow-md" style={{ left: width + 8, top: hint.y }}>{hint.text}</div>, document.body)}
  </>;
}
