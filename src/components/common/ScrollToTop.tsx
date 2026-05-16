import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // 每次路由变化时滚动到顶部
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
