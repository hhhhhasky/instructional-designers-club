import { ArrowLeft, ChevronRight, GraduationCap, Map as MapIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Footer from '@/components/common/Footer';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import PageMeta from '@/components/common/PageMeta';
import Header from '@/components/layout/Header';
import EmptyLearningState from '@/components/learning/EmptyLearningState';
import GamificationPanel from '@/components/learning/gamification/GamificationPanel';
import LearningOverview from '@/components/learning/LearningOverview';
import RecentLearning from '@/components/learning/RecentLearning';
import SeriesProgressCard from '@/components/learning/SeriesProgressCard';
import MobileTabBar from '@/components/navigation/MobileTabBar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { getLearningData } from '@/db/api';
import { supabase } from '@/db/supabase';
import { buildGamificationSnapshot } from '@/lib/gamification';
import type { LearningOverview as LearningOverviewType, RecentLearningItem, SeriesProgress } from '@/types/types';

export default function LearningPage() {
  const navigate = useNavigate();
  const { user, profile, loading, session, refreshProfile } = useAuth();
  const initialCheckDone = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [overview, setOverview] = useState<LearningOverviewType | null>(null);
  const [seriesProgress, setSeriesProgress] = useState<SeriesProgress[]>([]);
  const [recentLearning, setRecentLearning] = useState<RecentLearningItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 首次加载：等待 loading 结束
    if (loading && !initialCheckDone.current) return;
    if (!user) {
      navigate('/login', { state: { from: '/learning' } });
      return;
    }

    initialCheckDone.current = true;

    let disposed = false;
    let requestVersion = 0;
    const load = async (showLoading = false, fresh = false) => {
      const version = ++requestVersion;
      if (showLoading) setIsLoading(true);
      setError(null);
      try {
        const data = await getLearningData(user.id, { fresh });
        if (disposed || version !== requestVersion) return;
        setOverview(data.overview);
        setSeriesProgress(data.seriesProgress);
        setRecentLearning(data.recentLearning);
      } catch {
        if (disposed || version !== requestVersion) return;
        setError('加载学习数据失败，请刷新页面重试');
      } finally {
        if (!disposed && version === requestVersion) setIsLoading(false);
      }
    };
    void load(true);

    // 课程目录与当前用户的学习记录任一变化，都重新从真实表数据聚合主页。
    const channel = supabase
      .channel(`learning-home-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, () => void load(false, true))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'learning_records', filter: `user_id=eq.${user.id}` },
        () => void load(false, true),
      )
      .subscribe();

    // Realtime 未开启时，用户回到标签页也会拿到最新课程目录。
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void load(false, true);
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      disposed = true;
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      void supabase.removeChannel(channel);
    };
  }, [user?.id, loading, navigate]);

  // 认证守卫：仅在首次加载且无 session 时显示全屏加载
  if (loading && !session) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <LoadingOverlay message="正在确认登录状态..." />
        <Footer />
      </div>
    );
  }

  // 认证守卫：未登录（redirect 在 useEffect 中处理，这里兜底）
  if (!user) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center pt-20 px-4">
          <div className="text-center">
            <p className="text-txs mb-4">请先登录</p>
            <Button onClick={() => navigate('/login')}>前往登录</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // 认证守卫：profile 未就绪
  if (!profile) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center pt-20 px-4">
          <div className="text-center max-w-sm">
            <p className="text-tx font-ds-semibold mb-2">账号已登录，用户资料暂未准备好</p>
            <p className="text-txs text-sm mb-4">请稍后刷新；如果一直出现，请联系管理员。</p>
            <Button onClick={refreshProfile}>重新加载</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const gamificationSnapshot = overview && profile
    ? buildGamificationSnapshot({
      overview,
      seriesProgress,
      recentLearning,
      accessLevel: profile.access_level,
    })
    : null;

  return (
    <>
      <PageMeta title="学习主页" description="" noIndex />
    <div className="min-h-screen bg-cream flex flex-col">
      <Header />
      <main className="flex-1 pt-20 pb-24 md:pb-12 px-4">
        <div className="max-w-4xl mx-auto pt-4 md:pt-8 animate-fade-in">
          {/* 返回 + 标题 */}
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-ds-sm text-txs hover:text-ac transition-colors mb-4 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            返回
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-ds-full bg-acl flex items-center justify-center shadow-ds-sm">
              <GraduationCap className="w-5 h-5 text-ac" />
            </div>
            <div>
              <h1 className="text-ds-xl font-ds-black text-tx">我的学习</h1>
              <p className="text-ds-sm text-txs">{profile.nickname} 的学习主页</p>
            </div>
          </div>

          {/* 学习地图入口（R-P1-01） */}
          <Link
            to="/learning-map"
            className="flex items-center gap-3 p-4 rounded-ds-lg bg-gradient-primary text-white mb-6 hover-lift transition-all group"
          >
            <span className="w-10 h-10 rounded-ds-full bg-white/20 flex items-center justify-center shrink-0">
              <MapIcon className="w-5 h-5" />
            </span>
            <div className="flex-1">
              <p className="font-ds-bold text-ds-md">教学设计学习地图</p>
              <p className="text-ds-xs text-white/80">看清你在哪里、下一步学什么</p>
            </div>
            <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          {/* 数据加载中 */}
          {isLoading && <LoadingOverlay message="正在加载学习数据..." />}

          {/* 加载失败 */}
          {error && !isLoading && (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-ds-full bg-pink-soft flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚠️</span>
              </div>
              <p className="text-txs mb-4">{error}</p>
              <Button className="btn-super-cta !text-white rounded-ds-lg">刷新页面</Button>
            </div>
          )}

          {/* 数据就绪 */}
          {!isLoading && !error && overview && (
            <>
              {seriesProgress.length === 0 ? (
                <EmptyLearningState />
              ) : (
                <>
                  {gamificationSnapshot && (
                    <div className="mb-8">
                      <GamificationPanel snapshot={gamificationSnapshot} />
                    </div>
                  )}

                  {/* 统计概览 */}
                  <div className="mb-8">
                    <LearningOverview overview={overview} />
                  </div>

                  {/* 桌面端两栏布局 */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 左侧：系列进度 */}
                    <div className="lg:col-span-2 space-y-3">
                      <h2 className="text-ds-base font-ds-bold text-tx mb-3 flex items-center gap-2">
                        <span className="w-1 h-4 rounded-full bg-ac inline-block"></span>
                        系列课进度
                      </h2>
                      {seriesProgress.map((series, idx) => (
                        <div key={series.categoryName} className="animate-fade-in-up" style={{ animationDelay: `${idx * 0.08}s` }}>
                          <SeriesProgressCard
                            series={series}
                            accessLevel={profile.access_level}
                          />
                        </div>
                      ))}
                    </div>

                    {/* 右侧：最近学习（桌面端） */}
                    <div className="hidden lg:block lg:col-span-1">
                      <RecentLearning items={recentLearning} />
                    </div>
                  </div>

                  {/* 移动端：最近学习放在系列进度下方 */}
                  <div className="mt-6 lg:hidden">
                    <RecentLearning items={recentLearning} />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
      <MobileTabBar />
    </div>
    </>
  );
}
