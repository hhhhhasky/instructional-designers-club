import { ArrowLeft, Map as MapIcon, PartyPopper, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Footer from '@/components/common/Footer';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import PageMeta from '@/components/common/PageMeta';
import Header from '@/components/layout/Header';
import GamificationPanel from '@/components/learning/gamification/GamificationPanel';
import LearningMap from '@/components/learning/map/LearningMap';
import type { MapNodeConfig } from '@/components/learning/map/learningMapConfig';
import { getMapNodeById } from '@/components/learning/map/learningMapConfig';
import MobileTabBar from '@/components/navigation/MobileTabBar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { getLearningData } from '@/db/api';
import { buildGamificationSnapshot, type GamificationSnapshot } from '@/lib/gamification';
import type {
  LearningMapData,
  RecommendedNextCourse,
} from '@/lib/learningMap';
import { isAllElementsExplored } from '@/lib/learningMap';

export default function LearningMapPage() {
  const navigate = useNavigate();
  const { user, profile, loading, session, refreshProfile } = useAuth();
  const initialCheckDone = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [mapData, setMapData] = useState<LearningMapData | null>(null);
  const [gamificationSnapshot, setGamificationSnapshot] = useState<GamificationSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading && !initialCheckDone.current) return;
    if (!user) {
      navigate('/login', { state: { from: '/learning-map' } });
      return;
    }
    if (!profile) return; // profile 未就绪，等下一次 effect
    initialCheckDone.current = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getLearningData(user.id);
        const snapshot = buildGamificationSnapshot({
          overview: data.overview,
          seriesProgress: data.seriesProgress,
          recentLearning: data.recentLearning,
          accessLevel: profile.access_level,
        });
        setGamificationSnapshot(snapshot);
        setMapData(snapshot.mapData);
      } catch {
        setError('加载学习地图失败，请刷新页面重试');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user?.id, loading, profile, navigate]);

  // 守卫：首次加载
  if (loading && !session) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <LoadingOverlay message="正在确认登录状态..." />
        <Footer />
      </div>
    );
  }

  // 守卫：未登录
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

  // 守卫：profile 未就绪
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

  const currentNode: MapNodeConfig | null = mapData?.currentPositionNodeId
    ? getMapNodeById(mapData.currentPositionNodeId) ?? null
    : null;
  const nextCourse = mapData?.recommendedNextCourse ?? null;
  const allExplored = mapData ? isAllElementsExplored(mapData) : false;

  return (
    <>
      <PageMeta title="教学设计学习地图" description="" noIndex />
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <main className="flex-1 pt-20 pb-24 md:pb-12 px-4">
          <div className="max-w-4xl mx-auto pt-4 md:pt-8 animate-fade-in">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 text-ds-sm text-txs hover:text-ac transition-colors mb-4 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              返回
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-ds-full bg-acl flex items-center justify-center shadow-ds-sm">
                <MapIcon className="w-5 h-5 text-ac" />
              </div>
              <div>
                <h1 className="text-ds-xl font-ds-black text-tx">教学设计学习地图</h1>
                <p className="text-ds-sm text-txs">六大要素 · 看清你在哪里、下一步学什么</p>
              </div>
            </div>

            {isLoading && <LoadingOverlay message="正在绘制你的学习地图..." />}

            {error && !isLoading && (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-ds-full bg-pink-soft flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚠️</span>
                </div>
                <p className="text-txs mb-4">{error}</p>
                <Button className="btn-super-cta !text-white rounded-ds-lg" onClick={() => location.reload()}>
                  刷新页面
                </Button>
              </div>
            )}

            {!isLoading && !error && mapData && (
              <div className="space-y-5">
                {gamificationSnapshot && (
                  <GamificationPanel snapshot={gamificationSnapshot} variant="compact" />
                )}
                <CurrentPositionCard
                  currentNode={currentNode}
                  nextCourse={nextCourse}
                  allExplored={allExplored}
                  onOpenCourse={(id) => navigate(`/courses/${id}`)}
                />
                <LearningMap data={mapData} accessLevel={profile.access_level} />
              </div>
            )}
          </div>
        </main>
        <Footer />
        <MobileTabBar />
      </div>
    </>
  );
}

function CurrentPositionCard({
  currentNode,
  nextCourse,
  allExplored,
  onOpenCourse,
}: {
  currentNode: MapNodeConfig | null;
  nextCourse: RecommendedNextCourse | null;
  allExplored: boolean;
  onOpenCourse: (courseId: string) => void;
}) {
  // 庆祝态：全部已上线要素已通览
  if (allExplored && !currentNode) {
    return (
      <div className="bg-tll border border-tl/30 rounded-ds-lg p-4 flex items-center gap-3">
        <PartyPopper className="w-6 h-6 text-tl shrink-0" />
        <div className="flex-1">
          <p className="text-ds-base font-ds-bold text-tl">你已通览全部已上线要素</p>
          <p className="text-ds-sm text-txs mt-0.5">
            继续探索下方的理论基石与 AI 工具箱，或复习已学内容。
          </p>
        </div>
      </div>
    );
  }

  if (!currentNode) return null;

  return (
    <div className="bg-acl border border-ac/20 rounded-ds-lg p-4 flex items-center gap-3">
      <Sparkles className="w-5 h-5 text-ac shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-ds-xs text-txs">📍 你当前在</p>
        <p className="text-ds-md font-ds-bold text-tx truncate">「{currentNode.name}」要素</p>
      </div>
      {nextCourse && (
        <button
          type="button"
          onClick={() => onOpenCourse(nextCourse.course.courseId)}
          className="shrink-0 px-3.5 py-2 rounded-ds-pill bg-ac text-white text-ds-sm font-ds-bold whitespace-nowrap hover-lift"
        >
          下一课 →
        </button>
      )}
    </div>
  );
}
