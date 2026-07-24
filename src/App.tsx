import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';

import routes from './routes';
import ScrollToTop from '@/components/common/ScrollToTop';
import MobileTabBar from '@/components/navigation/MobileTabBar';

const App: React.FC = () => {
  return (
    <Router>
      <ScrollToTop />
      <div className="flex flex-col min-h-screen">
        <main className="flex-grow pb-16 md:pb-0">
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
        </main>

        {/* 移动端底部Tab导航栏 */}
        <MobileTabBar />

        {/* 全局 Toast 通知 */}
        <Toaster position="top-right" richColors />
      </div>
    </Router>
  );
};

export default App;
