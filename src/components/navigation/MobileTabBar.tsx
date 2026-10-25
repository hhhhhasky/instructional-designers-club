import { BookOpen, Bot, GraduationCap, Home, Radio } from 'lucide-react';
import { Link, useLocation, useMatch } from 'react-router-dom';
import { cn } from '@/lib/utils';
import HaiModeNavigation from '@/components/hai/HaiModeNavigation';

interface TabItem {
  name: string;
  path: string;
  icon: React.ElementType;
}

export default function MobileTabBar() {
  const location = useLocation();
  const isCourseDetail = useMatch({ path: '/courses/:id', end: true });
  const isHai = location.pathname === '/hai' || location.pathname.startsWith('/hai/');
  const isAdmin = location.pathname === '/admin' || location.pathname.startsWith('/admin/');

  const tabs: TabItem[] = [
    { name: '首页', path: '/', icon: Home },
    { name: '课程', path: '/course-library', icon: BookOpen },
    { name: 'HAI', path: '/hai', icon: Bot },
    { name: 'Live 互动', path: '/live', icon: Radio },
    { name: '我的学习', path: '/learning', icon: GraduationCap },
  ];

  // 判断当前路径是否激活
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    if (path === '/course-library') {
      return location.pathname === '/course-library' || location.pathname === '/courses' || location.pathname.startsWith('/courses/plus') || location.pathname === '/teacher-ai-courses';
    }
    return location.pathname.startsWith(path);
  };

  // 课程详情页使用自己的目录 / 上一节 / 下一节控制栏。
  // 精确匹配避免误伤 /courses 列表页和 /courses/plus/:trackId 篇章页。
  if (isCourseDetail || location.pathname === '/course-library') return null;
  if (isAdmin) return null;
  if (isHai) return <HaiModeNavigation />;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-bd bg-[var(--paper)]/95 pb-safe backdrop-blur md:hidden" aria-label="网站导航">
      <div className="mx-auto flex h-16 max-w-xl items-stretch px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          return <Link
            key={tab.path}
            to={tab.path === '/hai' ? '/hai/chat' : tab.path}
            state={tab.path === '/hai' ? { fromSite: location.pathname } : undefined}
            aria-current={active ? 'page' : undefined}
            className={cn('flex min-w-0 flex-1 flex-col items-center justify-center gap-1 border-t-2 text-xs transition-colors', active ? 'border-ac text-ac' : 'border-transparent text-txs hover:text-ac')}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className={active ? 'font-semibold' : 'font-medium'}>{tab.name}</span>
          </Link>;
        })}
      </div>
    </nav>
  );
}
