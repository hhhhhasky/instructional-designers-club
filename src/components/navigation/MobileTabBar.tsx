import { COURSE_PATH } from "@/lib/course-paths";
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
  const isCourseDetail = useMatch({ path: `${COURSE_PATH}/:courseSlug/:lessonSlug`, end: true });
  const isHai = location.pathname === '/hai' || location.pathname.startsWith('/hai/');
  const isAdmin = location.pathname === '/admin' || location.pathname.startsWith('/admin/');

  const tabs: TabItem[] = [
    { name: '首页', path: '/', icon: Home },
    { name: '课程', path: COURSE_PATH, icon: BookOpen },
    { name: 'HAI', path: '/hai', icon: Bot },
    { name: 'Live 互动', path: '/live', icon: Radio },
    { name: '我的学习', path: '/learning', icon: GraduationCap },
  ];

  // 判断当前路径是否激活
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  // 课程详情页使用自己的目录 / 上一节 / 下一节控制栏。
  if (isCourseDetail || location.pathname === COURSE_PATH) return null;
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
            to={tab.path === '/hai' ? '/hai/work' : tab.path}
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
