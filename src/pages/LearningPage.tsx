import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/common/Footer';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import MobileTabBar from '@/components/navigation/MobileTabBar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { getLearningData } from '@/db/api';
import LearningOverview from '@/components/learning/LearningOverview';
import SeriesProgressCard from '@/components/learning/SeriesProgressCard';
import RecentLearning from '@/components/learning/RecentLearning';
import EmptyLearningState from '@/components/learning/EmptyLearningState';
import type { LearningOverview as LearningOverviewType, SeriesProgress, RecentLearningItem } from '@/types/types';

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

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getLearningData(user.id);
        setOverview(data.overview);
        setSeriesProgress(data.seriesProgress);
        setRecentLearning(data.recentLearning);
      } catch {
        setError('加载学习数据失败，请刷新页面重试');
      } finally {
        setIsLoading(false);
      }
    };
    load();
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

  const hasRecords = recentLearning.length > 0 || (overview && (overview.completedCourses > 0 || overview.inProgressCourses > 0));

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Header />
      <main className="flex-1 pt-20 pb-24 md:pb-12 px-4">
        <div className="max-w-4xl mx-auto pt-4 md:pt-8">
          {/* 返回 + 标题 */}
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-ds-sm text-txs hover:text-ac transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-ds-full bg-acl flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-ac" />
            </div>
            <div>
              <h1 className="text-ds-xl font-ds-black text-tx">我的学习</h1>
              <p className="text-ds-sm text-txs">{profile.nickname} 的学习主页</p>
            </div>
          </div>

          {/* 数据加载中 */}
          {isLoading && <LoadingOverlay message="正在加载学习数据..." />}

          {/* 加载失败 */}
          {error && !isLoading && (
            <div className="text-center py-12">
              <p className="text-txs mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>刷新页面</Button>
            </div>
          )}

          {/* 数据就绪 */}
          {!isLoading && !error && overview && (
            <>
              {!hasRecords ? (
                <EmptyLearningState />
              ) : (
                <>
                  {/* 统计概览 */}
                  <div className="mb-6">
                    <LearningOverview overview={overview} />
                  </div>

                  {/* 桌面端两栏布局 */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 左侧：系列进度 */}
                    <div className="lg:col-span-2 space-y-3">
                      <h2 className="text-ds-base font-ds-bold text-tx mb-2">系列课进度</h2>
                      {seriesProgress.map((series) => (
                        <SeriesProgressCard
                          key={series.categoryName}
                          series={series}
                          accessLevel={profile.access_level}
                        />
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
  );
}
