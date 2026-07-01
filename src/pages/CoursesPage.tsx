import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Header from '@/components/layout/Header';
import Footer from '@/components/common/Footer';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import MapPreviewCard from '@/components/learning/map/MapPreviewCard';
import PageMeta from '@/components/common/PageMeta';
import { getCourseCatalogSnapshot, getCourseDetailSnapshot } from '@/db/api';
import type { Course, PlusCourseTrackId } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessCourse } from '@/lib/access-control';
import UpgradePopup from '@/components/common/UpgradePopup';
import {
  PLUS_PROBLEM_ENTRIES,
  PLUS_RECOMMENDED_PATHS,
  PLUS_TRACKS,
  buildPlusTrackUrl,
  getEffectivePlusTracks,
  getModuleCourseCount,
  getModuleIcon,
  getRepresentativeCourses,
  getTrackCourseCount,
  type PlusTrackConfig,
} from '@/lib/plusCourseStructure';

export default function CoursesPage() {
  const navigate = useNavigate();
  const { user, accessLevel } = useAuth();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeLevel, setUpgradeLevel] = useState<'plus' | 'pro'>('plus');
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [plusTracks, setPlusTracks] = useState<PlusTrackConfig[]>(PLUS_TRACKS);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const catalog = await getCourseCatalogSnapshot();
        const coursesData = catalog.plus_courses;
        const structureData = catalog.plus_tracks;
        setAllCourses(coursesData);
        setPlusTracks(getEffectivePlusTracks(coursesData, structureData.length > 0 ? structureData : PLUS_TRACKS));
      } catch (err) {
        console.error('加载课程数据失败:', err);
        setError('加载课程数据失败，请刷新页面重试');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleCourseClick = (course: Course) => {
    if (isNavigating) return;

    if (course.membership_type !== 'free' && !canAccessCourse(accessLevel, course.membership_type)) {
      if (!user) {
        navigate('/login', { state: { from: `/courses/${course.id}` } });
        return;
      }
      setUpgradeLevel(course.membership_type as 'plus' | 'pro');
      setShowUpgrade(true);
      return;
    }

    setIsNavigating(true);
    setTimeout(() => navigate(`/courses/${course.id}`), 200);
  };

  const handlePlusDestination = (trackId: PlusCourseTrackId, moduleId?: string) => {
    navigate(buildPlusTrackUrl(trackId, moduleId));
  };

  return (
    <>
      <PageMeta
        title="教学通识课"
        description="系统学习教学通识课 Plus：从底层理论、教学设计原理，到日常课、说课、公开课等真实教学场景。"
        canonicalPath="/courses"
        keywords="教学通识课,教学设计课程,教师培训课程,Plus课程"
      />
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        {isNavigating && <LoadingOverlay message="正在加载课程..." />}
        <main className="flex-1 pt-20 pb-12">
          <div className="relative overflow-hidden border-b border-bdl bg-[radial-gradient(circle_at_20%_10%,rgba(196,93,62,0.10),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(42,122,110,0.12),transparent_34%),var(--bg)] px-4 py-12 md:py-16">
            <div className="max-w-7xl mx-auto">
              <div className="max-w-3xl">
                <Badge className="mb-4 bg-bc/80 text-ac border border-ac/20 rounded-full px-3 py-1">
                  Plus 专属
                </Badge>
                <h1 className="text-3xl md:text-5xl font-ds-black text-tx leading-tight" style={{ fontFamily: 'var(--fd)' }}>
                  教学通识课
                </h1>
                <p className="mt-4 text-base md:text-lg text-txs max-w-2xl">
                  按你的学习目标选择入口：打底层理论、练设计方法，或直接解决备课、说课、公开课这些真实任务。
                </p>
              </div>
            </div>
          </div>

          <MapPreviewCard />

          {isLoading && (
            <div className="max-w-7xl mx-auto px-4 py-16 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ac" />
              <p className="mt-4 text-txs">正在加载课程数据...</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="max-w-7xl mx-auto px-4 py-16">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
                <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <p className="text-destructive font-semibold mb-2">{error}</p>
                <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
                  刷新页面
                </Button>
              </div>
            </div>
          )}

          {!isLoading && !error && (
            <PlusCourseMap courses={allCourses} tracks={plusTracks} onTrackOpen={handlePlusDestination} onCourseOpen={handleCourseClick} />
          )}
        </main>
        <Footer />
        <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} requiredLevel={upgradeLevel} />
      </div>
    </>
  );
}

function PlusCourseMap({
  courses,
  tracks,
  onTrackOpen,
  onCourseOpen,
}: {
  courses: Course[];
  tracks: PlusTrackConfig[];
  onTrackOpen: (trackId: PlusCourseTrackId, moduleId?: string) => void;
  onCourseOpen: (course: Course) => void;
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-10 space-y-10">
      <section>
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <p className="text-sm font-semibold text-ac">三条主线</p>
            <h2 className="text-2xl md:text-3xl font-ds-black text-tx" style={{ fontFamily: 'var(--fd)' }}>
              教学通识课 Plus 课程地图
            </h2>
          </div>
          <p className="hidden md:block text-sm text-txs max-w-md">
            先选篇章，再进入具体系列课；也可以从下方问题入口直接开始。
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {tracks.map((track) => {
            const Icon = track.icon;
            const count = getTrackCourseCount(courses, track.id, tracks);
            return (
              <article key={track.id} className="bg-bc border border-bd rounded-lg overflow-hidden shadow-ds-sm hover:shadow-ds-md transition-shadow">
                <div className={cn('h-2 bg-gradient-to-r', track.accent)} />
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <div className={cn('w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center text-white', track.accent)}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-ds-bold text-tx" style={{ fontFamily: 'var(--fd)' }}>
                        {track.title}
                      </h3>
                      <p className="text-sm text-txs mt-1">{track.subtitle}</p>
                    </div>
                    <Badge variant="outline" className="rounded-full">
                      {count} 节
                    </Badge>
                  </div>

                  <p className="mt-4 text-sm text-txs leading-relaxed">{track.description}</p>
                  <p className="mt-2 text-xs text-txt">适合：{track.audience}</p>

                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2.5">
                    {track.modules.map((module) => {
                      const moduleCount = getModuleCourseCount(courses, track.id, module.id, tracks);
                      const ModuleIcon = getModuleIcon(module.iconKey || module.id);
                      return (
                        <button
                          key={module.id}
                          onClick={() => onTrackOpen(track.id, module.id)}
                          className="group rounded-lg border border-bd bg-bgs/50 px-3 py-3 text-left hover:border-ac/50 hover:bg-acl/35 transition-all"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-md bg-bc border border-bd flex items-center justify-center flex-shrink-0 group-hover:border-ac/40">
                              <ModuleIcon className="w-4 h-4 text-ac" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold text-sm text-tx group-hover:text-ac">
                                  {module.shortTitle || module.title}
                                </p>
                                <span className="text-xs text-txs flex-shrink-0">
                                  {moduleCount > 0 ? `${moduleCount} 节` : '规划中'}
                                </span>
                              </div>
                              <p className="text-xs text-txs mt-1 line-clamp-2">{module.description}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-5 space-y-2">
                    <p className="text-xs font-semibold text-txs">可以先看</p>
                    <div className="space-y-1.5">
                      {track.modules.flatMap((module) => getRepresentativeCourses(courses, module, 1, tracks)).slice(0, 3).map((course) => (
                        <button
                          key={course.id}
                          onClick={() => onCourseOpen(course)}
                          onMouseEnter={() => void getCourseDetailSnapshot(course.id)}
                          onFocus={() => void getCourseDetailSnapshot(course.id)}
                          onTouchStart={() => void getCourseDetailSnapshot(course.id)}
                          className="w-full flex items-center justify-between gap-3 text-left text-xs text-txs hover:text-ac transition-colors"
                        >
                          <span className="truncate">{course.title}</span>
                          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button onClick={() => onTrackOpen(track.id)} className="w-full mt-5 btn-super-cta btn-press">
                    进入本篇
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bg-bc border border-bd rounded-lg p-5 md:p-6 shadow-ds-sm">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
          <div>
            <p className="text-sm font-semibold text-ac">按问题找课</p>
            <h2 className="text-2xl font-ds-black text-tx" style={{ fontFamily: 'var(--fd)' }}>
              我现在想解决什么问题？
            </h2>
          </div>
          <p className="text-sm text-txs md:max-w-md">
            不确定从哪里开始时，可以先选一个最接近你当下任务的问题。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {PLUS_PROBLEM_ENTRIES.map((entry) => (
            <button
              key={entry.label}
              onClick={() => onTrackOpen(entry.trackId, entry.moduleId)}
              className="group min-h-[128px] rounded-lg border border-bd bg-bgs/40 p-4 text-left hover:border-ac/40 hover:bg-acl/40 transition-all"
            >
              <p className="font-bold text-tx leading-snug group-hover:text-ac">{entry.label}</p>
              <p className="text-xs text-txs mt-2 leading-relaxed">{entry.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <p className="text-sm font-semibold text-ac">推荐路径</p>
            <h2 className="text-2xl font-ds-black text-tx" style={{ fontFamily: 'var(--fd)' }}>
              不同任务的学习顺序
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {PLUS_RECOMMENDED_PATHS.map((path) => (
            <button
              key={path.title}
              onClick={() => onTrackOpen(path.trackId, path.moduleId)}
              className="rounded-lg border border-bd bg-bc p-4 text-left hover:shadow-ds-md hover:border-ac/40 transition-all"
            >
              <h3 className="font-ds-bold text-tx" style={{ fontFamily: 'var(--fd)' }}>
                {path.title}
              </h3>
              <p className="text-xs text-txs mt-1">{path.description}</p>
              <div className="mt-4 space-y-2">
                {path.steps.map((step, index) => (
                  <div key={step} className="flex items-center gap-2 text-sm text-tx">
                    <span className="w-5 h-5 rounded-full bg-acl text-ac flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <span className="truncate">{step}</span>
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
