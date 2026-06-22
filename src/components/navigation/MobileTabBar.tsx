import { BookOpen, FolderOpen, GraduationCap, Home, Sparkles } from 'lucide-react';
import { Link, useLocation, useMatch } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface TabItem {
  name: string;
  path: string;
  icon: React.ElementType;
}

export default function MobileTabBar() {
  const location = useLocation();
  const isCourseDetail = useMatch({ path: '/courses/:id', end: true });

  const tabs: TabItem[] = [
    { name: '首页', path: '/', icon: Home },
    { name: '通识课', path: '/courses', icon: BookOpen },
    { name: 'AI课', path: '/teacher-ai-courses', icon: Sparkles },
    { name: '学习', path: '/learning', icon: GraduationCap },
    { name: '资源', path: '/resources', icon: FolderOpen },
  ];

  // 判断当前路径是否激活
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // 课程详情页使用自己的目录 / 上一节 / 下一节控制栏。
  // 精确匹配避免误伤 /courses 列表页和 /courses/plus/:trackId 篇章页。
  if (isCourseDetail) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe md:hidden">
      {/* 渐变背景 + 模糊效果 + 阴影 */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-background/80 backdrop-blur-xl border-t-2 border-primary/20 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]" />
      
      {/* Tab内容 */}
      <div className="relative flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);

          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={cn(
                'relative flex flex-col items-center justify-center flex-1 h-full gap-1',
                'touch-manipulation transition-all duration-300 ease-out',
                'active:scale-90',
                'group'
              )}
            >
              {/* 激活状态背景高亮 */}
              {active && (
                <div className="absolute inset-0 mx-auto w-14 h-14 top-1/2 -translate-y-1/2 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent rounded-2xl animate-pulse" />
              )}
              
              {/* 图标容器 */}
              <div className={cn(
                'relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300',
                active && 'scale-110'
              )}>
                {/* 图标发光效果 */}
                {active && (
                  <div className="absolute inset-0 bg-primary/30 rounded-xl blur-md animate-pulse" />
                )}
                
                {/* 图标 */}
                <Icon
                  className={cn(
                    'relative z-10 transition-all duration-300',
                    active 
                      ? 'w-6 h-6 text-primary drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]' 
                      : 'w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:scale-110'
                  )}
                />
              </div>
              
              {/* 文字标签 */}
              <span
                className={cn(
                  'relative text-xs transition-all duration-300',
                  active 
                    ? 'font-black text-primary scale-105' 
                    : 'font-medium text-muted-foreground group-hover:text-foreground'
                )}
              >
                {tab.name}
              </span>
              
              {/* 底部指示条 */}
              {active && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-gradient-to-r from-primary via-primary-glow to-primary rounded-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.6)] animate-pulse" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
