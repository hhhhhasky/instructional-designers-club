import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  BookOpen,
  ChevronRight,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/common/Footer';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import PageMeta from '@/components/common/PageMeta';
import {
  CourseEditorialCatalogLayout,
  CourseEditorialHero,
  CourseEditorialVolume,
} from '@/components/course/CourseEditorialShell';
import { getCourseCatalogSnapshot, getCourseDetailSnapshot, subscribeToCourseCatalogUpdates } from '@/db/api';
import type { Course } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessCourse } from '@/lib/access-control';
import UpgradePopup from '@/components/common/UpgradePopup';
import {
  PLUS_TRACKS,
  getEffectivePlusTracks,
  getModuleCourseCount,
  getModuleIcon,
  getCoursesForModule,
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
  const lastCatalogRefreshAt = useRef(0);

  const loadData = useCallback(async (background = false) => {
      try {
        if (!background) {
          setIsLoading(true);
          setError(null);
        }
        const catalog = await getCourseCatalogSnapshot({ fresh: background });
        const coursesData = catalog.plus_courses;
        const structureData = catalog.plus_tracks;
        setAllCourses(coursesData);
        setPlusTracks(getEffectivePlusTracks(coursesData, structureData.length > 0 ? structureData : PLUS_TRACKS));
        lastCatalogRefreshAt.current = Date.now();
      } catch (err) {
        console.error('加载课程数据失败:', err);
        if (!background) setError('加载课程数据失败，请刷新页面重试');
      } finally {
        if (!background) setIsLoading(false);
      }
  }, []);

  useEffect(() => {
    void loadData();
    return subscribeToCourseCatalogUpdates(() => {
      void loadData(true);
    });
  }, [loadData]);

  useEffect(() => {
    const revalidateWhenFocused = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastCatalogRefreshAt.current < 5 * 60 * 1000) return;
      void loadData(true);
    };
    window.addEventListener('focus', revalidateWhenFocused);
    document.addEventListener('visibilitychange', revalidateWhenFocused);
    return () => {
      window.removeEventListener('focus', revalidateWhenFocused);
      document.removeEventListener('visibilitychange', revalidateWhenFocused);
    };
  }, [loadData]);

  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.replace('#', ''));
    if (!hash || isLoading) return;
    requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [isLoading]);

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
        <main className="course-reading-desk flex-1 pb-12 pt-20">
          <CourseEditorialHero
            kicker="PLUS CATALOGUE · 教学通识课"
            badge="PLUS 专属"
            title="教学通识课"
            description="从理解学习和教学的底层规律，到掌握教学设计原理，再把方法用到日常课、说课和公开课等真实任务里。"
            audience="建议按理论篇、教学设计原理篇、场景篇的顺序学习；需要解决具体问题时，也可以直接从目录定位到对应系列课。"
            icon={BookOpen}
            stats={[
              { label: '系列卷册', value: plusTracks.length },
              { label: '已发布单课', value: plusTracks.reduce((sum, track) => sum + getTrackCourseCount(allCourses, track.id, plusTracks), 0) },
            ]}
          />

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
            <PlusCourseMap courses={allCourses} tracks={plusTracks} onCourseOpen={handleCourseClick} />
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
  onCourseOpen,
}: {
  courses: Course[];
  tracks: PlusTrackConfig[];
  onCourseOpen: (course: Course) => void;
}) {
  return <PlusCourseCatalog courses={courses} tracks={tracks} onCourseOpen={onCourseOpen} />;
}

function PlusCourseCatalog({
  courses,
  tracks,
  onCourseOpen,
}: {
  courses: Course[];
  tracks: PlusTrackConfig[];
  onCourseOpen: (course: Course) => void;
}) {
  const renderTrack = (track: PlusTrackConfig, index: number) => (
    <CourseEditorialVolume
      key={track.id}
      id={track.id}
      index={index}
      title={track.title}
      count={getTrackCourseCount(courses, track.id, tracks)}
      icon={track.icon}
    >
      <div className="space-y-5">
        {track.modules.map((module) => {
          const moduleCourses = getCoursesForModule(courses, track.id, module.id, tracks);
          const Icon = getModuleIcon(module.iconKey || module.id);
          return (
            <section key={module.id} id={`${track.id}-${module.id}`} className="scroll-mt-28 rounded-ds-sm border border-bd bg-bgs/30 p-4 md:p-5">
              <div className="mb-4 flex items-start gap-3 border-b border-dashed border-bd pb-3">
                <span className="course-editorial-mark h-9 w-9 shrink-0"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-ds-bold text-tx" style={{ fontFamily: 'var(--fd)' }}>{module.title}</h3>
                </div>
                <span className="shrink-0 text-xs text-txt">{moduleCourses.length} 节</span>
              </div>
              {moduleCourses.length > 0 ? (
                <CourseGrid courses={moduleCourses} onCourseOpen={onCourseOpen} />
              ) : (
                <p className="rounded-lg border border-dashed border-bd bg-bgs/40 p-4 text-center text-sm text-txs">该系列课程正在准备中。</p>
              )}
            </section>
          );
        })}
      </div>
    </CourseEditorialVolume>
  );

  return (
    <CourseEditorialCatalogLayout
      label="系列课"
      countLabel={`${tracks.length} 篇`}
      tocStatic
      toc={tracks.map((track, index) => {
        const Icon = track.icon;
        return (
          <div key={track.id}>
            <a href={`#${track.id}`} className="course-editorial-toc-link">
              <span className="font-mono text-[10px] text-txt">{String(index + 1).padStart(2, '0')}</span>
              <Icon className="h-4 w-4 flex-shrink-0 text-ac" aria-hidden="true" />
              <span className="flex-1 truncate">{track.title}</span>
              <span className="text-xs text-txt">{getTrackCourseCount(courses, track.id, tracks)} 节</span>
            </a>
            <div className="ml-7 space-y-0.5 border-l border-dashed border-bd py-1 pl-3">
              {track.modules.map((module) => (
                <a
                  key={module.id}
                  href={`#${track.id}-${module.id}`}
                  className="flex min-h-8 items-center justify-between gap-2 rounded-ds-sm px-2 text-xs text-txs transition-colors hover:bg-acl/30 hover:text-ac"
                >
                  <span className="truncate">{module.shortTitle || module.title}</span>
                  <span className="shrink-0 text-[10px] text-txt">{getModuleCourseCount(courses, track.id, module.id, tracks)}</span>
                </a>
              ))}
            </div>
          </div>
        );
      })}
      mobile={(
        <Accordion type="multiple" defaultValue={tracks.map((track) => track.id)} className="space-y-3">
          {tracks.map((track, index) => {
            const Icon = track.icon;
            return (
            <AccordionItem key={track.id} value={track.id} className="course-editorial-volume overflow-hidden">
              <AccordionTrigger className="min-h-16 px-4 py-3 hover:bg-[var(--proof-soft)] hover:no-underline">
                <div className="flex w-full items-center gap-3 text-left">
                  <span className="course-editorial-mark"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1"><span className="editorial-kicker block">VOL. {String(index + 1).padStart(2, '0')}</span><strong className="block truncate text-tx">{track.title}</strong><small className="text-txs">{getTrackCourseCount(courses, track.id, tracks)} 节课程</small></span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 pt-1">
                <div className="space-y-4">{track.modules.map((module) => <div key={module.id}><h3 className="mb-1 font-ds-bold text-tx">{module.title}</h3><CourseGrid courses={getCoursesForModule(courses, track.id, module.id, tracks)} onCourseOpen={onCourseOpen} /></div>)}</div>
              </AccordionContent>
            </AccordionItem>
            );
          })}
        </Accordion>
      )}
    >
      {tracks.map(renderTrack)}
    </CourseEditorialCatalogLayout>
  );
}

function CourseGrid({ courses, onCourseOpen }: { courses: Course[]; onCourseOpen: (course: Course) => void }) {
  if (courses.length === 0) return <p className="rounded-lg border border-dashed border-bd bg-bgs/40 p-4 text-center text-sm text-txs">该系列课程正在准备中。</p>;
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{courses.map((course, index) => <button key={course.id} type="button" onClick={() => onCourseOpen(course)} onMouseEnter={() => void getCourseDetailSnapshot(course.id)} onFocus={() => void getCourseDetailSnapshot(course.id)} onTouchStart={() => void getCourseDetailSnapshot(course.id)} aria-label={`打开课程：${course.title}`} className="course-editorial-entry group"><span className="course-editorial-index">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1 text-left"><h3 className="font-semibold leading-snug text-tx group-hover:text-ac">{course.title}</h3><span className="mt-2 block text-xs text-txs">{course.duration ? `${course.duration}分钟 · ` : ''}Plus 单课</span></div><ChevronRight className="h-5 w-5 shrink-0 text-txs transition-all group-hover:translate-x-1 group-hover:text-ac" aria-hidden="true" /></button>)}</div>;
}
