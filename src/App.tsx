import React, { Suspense, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';

import routes from './routes';
import ScrollToTop from '@/components/common/ScrollToTop';
import SiteSidebar from '@/components/layout/SiteSidebar';
import SiteNotifications from '@/components/layout/SiteNotifications';
import { SiteToolbarContext } from '@/components/layout/SiteToolbarContext';
import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toolbarContent, setToolbarContent] = useState<HTMLElement | null>(null);
  const isHaiWorkspace = location.pathname === '/hai/chat' || location.pathname === '/hai/work' || location.pathname.startsWith('/hai/work/');
  const currentTitle = routes.find(route => route.path === location.pathname)?.name || (location.pathname.startsWith('/courses/') ? '课程学习' : location.pathname.startsWith('/course-v2/') ? '课程学习' : '');
  const isAdmin = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  const back = () => {
    if (location.pathname === '/') return;
    if (location.pathname === '/hai/points') { navigate('/hai/work'); return; }
    if (window.history.state?.idx > 0) { navigate(-1); return; }
    if (location.pathname.startsWith('/hai/')) navigate('/hai/work');
    else if (location.pathname.startsWith('/courses/') || location.pathname === '/courses' || location.pathname === '/teacher-ai-courses') navigate('/course-library');
    else if (location.pathname.startsWith('/course-v2/')) navigate('/course-v2');
    else navigate('/');
  };
  return (
    <>
      <ScrollToTop />
      <SiteSidebar onOpenChange={setSidebarOpen} />
      <div className="site-shell flex min-h-screen flex-col pt-14 print:pt-0">
        <header className="site-toolbar fixed right-0 top-0 z-40 flex h-14 shrink-0 items-center gap-1 border-b border-[var(--paper-rule)] bg-[var(--paper)] px-3 print:hidden md:px-4">
          <button type="button" onClick={back} disabled={location.pathname === '/'} aria-label="返回上一页" title="返回上一页" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-txs hover:bg-[var(--paper-deep)] hover:text-ac disabled:opacity-30"><ArrowLeft size={19} /></button>
          <button type="button" onClick={() => window.dispatchEvent(new Event('site-sidebar-toggle'))} aria-label={sidebarOpen ? '折叠工具栏' : '展开工具栏'} title={sidebarOpen ? '折叠工具栏' : '展开工具栏'} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-txs hover:bg-[var(--paper-deep)] hover:text-ac">{sidebarOpen ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}</button>
          <div ref={setToolbarContent} className="site-toolbar-content flex min-w-0 flex-1 items-center justify-between gap-2">{!isHaiWorkspace && !isAdmin && <span className="truncate pl-1 font-serif text-sm font-bold text-tx">{currentTitle}</span>}</div>
          <SiteNotifications />
        </header>
        <main className="min-w-0 flex-grow">
          <SiteToolbarContext.Provider value={toolbarContent}>
          <Suspense
            fallback={(
              <div className="editorial-route-loading" role="status" aria-live="polite">
                <span className="editorial-kicker">正在整理教研桌</span>
                <span className="loading-spinner" aria-hidden="true" />
                <span className="sr-only">页面加载中</span>
              </div>
            )}
          >
            <Routes>
              {routes.map((route) => (
                <Route
                  key={route.path}
                  path={route.path}
                  element={route.element}
                />
              ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          </SiteToolbarContext.Provider>
        </main>


        {/* 全局 Toast 通知 */}
        <Toaster position="top-right" richColors />
      </div>
    </>
  );
}

export default App;
