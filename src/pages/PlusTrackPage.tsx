import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/Header';
import Footer from '@/components/common/Footer';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import PageMeta from '@/components/common/PageMeta';
import UpgradePopup from '@/components/common/UpgradePopup';
import { getCoursesByMembershipType, getPlusCourseStructure } from '@/db/api';
import { canAccessCourse } from '@/lib/access-control';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { Course, PlusCourseTrackId } from '@/types/types';
import {
  PLUS_TRACKS,
  buildPlusTrackUrl,
  getCoursesForModule,
  getCoursesForTrack,
  getEffectivePlusTracks,
  getModuleIcon,
  getPlusTrack,
  getTrackCourseCount,
  type PlusTrackConfig,
} from '@/lib/plusCourseStructure';
import { AlertCircle, ArrowLeft, BookOpen, ChevronRight, Clock, LockKeyhole, PlayCircle } from 'lucide-react';

export default function PlusTrackPage() {
  const { trackId } = useParams<{ trackId: PlusCourseTrackId }>();
  const navigate = useNavigate();
  const { user, accessLevel } = useAuth();
  const [plusTracks, setPlusTracks] = useState<PlusTrackConfig[]>(PLUS_TRACKS);
  const track = getPlusTrack(trackId, plusTracks);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    const loadCourses = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [coursesData, structureData] = await Promise.all([
          getCoursesByMembershipType('plus'),
          getPlusCourseStructure(),
        ]);
        setCourses(coursesData);
        setPlusTracks(getEffectivePlusTracks(coursesData, structureData.length > 0 ? structureData : PLUS_TRACKS));
      } catch (err) {
        console.error('加载 Plus 篇章课程失败:', err);
        setError('加载课程数据失败，请刷新页面重试');
      } finally {
        setIsLoading(false);
      }
    };
    loadCourses();
  }, []);

  useEffect(() => {
    if (isLoading || !track) return;
    const hash = decodeURIComponent(window.location.hash.replace('#', ''));
    if (!hash) return;
    requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [isLoading, track]);

  const trackCourses = useMemo(() => {
    if (!track) return [];
    return getCoursesForTrack(courses, track.id, plusTracks);
  }, [courses, track, plusTracks]);
  const visibleTrackCourseCount = track ? getTrackCourseCount(courses, track.id, plusTracks) : 0;
  const initialMobileModules = track
    ? [decodeURIComponent(window.location.hash.replace('#', '')) || track.modules[0]?.id].filter(Boolean)
    : [];

  const handleCourseClick = (course: Course) => {
    if (!canAccessCourse(accessLevel, 'plus')) {
      if (!user) {
        navigate('/login', { state: { from: `/courses/${course.id}` } });
        return;
      }
      setShowUpgrade(true);
      return;
    }
    navigate(`/courses/${course.id}`);
  };

  if (!track && isLoading) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <LoadingOverlay message="正在加载 Plus 篇章..." />
      </div>
    );
  }

  if (!track) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <main className="flex-1 pt-28 px-4">
          <div className="max-w-xl mx-auto text-center bg-bc border border-bd rounded-lg p-8">
            <AlertCircle className="w-12 h-12 text-ac mx-auto mb-4" />
            <h1 className="text-2xl font-ds-bold text-tx mb-3" style={{ fontFamily: 'var(--fd)' }}>
              Plus 篇章不存在
            </h1>
            <Button onClick={() => navigate('/courses')}>返回教学通识课</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const TrackIcon = track.icon;

  return (
    <>
      <PageMeta
        title={`${track.title} - Plus 教学通识课`}
        description={track.description}
        canonicalPath={`/courses/plus/${track.id}`}
        keywords={`${track.title},教学通识课Plus,教学设计课程`}
      />
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        {isLoading && <LoadingOverlay message="正在加载 Plus 篇章..." />}
        <main className="flex-1 pt-20 pb-12">
          <section className="border-b border-bdl bg-[radial-gradient(circle_at_15%_20%,rgba(196,93,62,0.10),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(42,122,110,0.10),transparent_36%),var(--bg)] px-4 py-8 md:py-12">
            <div className="max-w-7xl mx-auto">
              <button
                onClick={() => navigate('/courses')}
                className="inline-flex items-center gap-1 text-sm text-txs hover:text-ac transition-colors mb-5"
              >
                <ArrowLeft className="w-4 h-4" />
                返回课程地图
              </button>

              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn('w-13 h-13 rounded-lg bg-gradient-to-br flex items-center justify-center text-white', track.accent)}>
                      <TrackIcon className="w-7 h-7" />
                    </div>
                    <Badge className="bg-bc text-ac border border-ac/20 rounded-full px-3 py-1">
                      Plus · {track.shortTitle}
                    </Badge>
                  </div>
                  <h1 className="text-3xl md:text-5xl font-ds-black text-tx leading-tight" style={{ fontFamily: 'var(--fd)' }}>
                    {track.title}
                  </h1>
                  <p className="mt-4 text-lg text-txs leading-relaxed">{track.description}</p>
                  <p className="mt-2 text-sm text-txt">适合：{track.audience}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 min-w-[260px]">
                  <div className="bg-bc/85 border border-bd rounded-lg p-4">
                    <p className="text-2xl font-ds-black text-tx">{track.modules.length}</p>
                    <p className="text-xs text-txs">系列课</p>
                  </div>
                  <div className="bg-bc/85 border border-bd rounded-lg p-4">
                    <p className="text-2xl font-ds-black text-tx">{visibleTrackCourseCount}</p>
                    <p className="text-xs text-txs">已发布单课</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-2">
                {plusTracks.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(buildPlusTrackUrl(item.id))}
                    className={cn(
                      'px-3 py-1.5 rounded-full border text-sm transition-colors',
                      item.id === track.id
                        ? 'bg-ac text-white border-ac'
                        : 'bg-bc text-tx border-bd hover:border-ac/40 hover:text-ac',
                    )}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {error && !isLoading && (
            <div className="max-w-7xl mx-auto px-4 py-10">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
                <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
                <p className="text-destructive font-semibold">{error}</p>
              </div>
            </div>
          )}

          {!isLoading && !error && (
            <section className="max-w-7xl mx-auto px-4 py-8">
              <div className="hidden lg:grid lg:grid-cols-[280px_1fr] gap-6">
                <aside className="self-start sticky top-24 bg-bc border border-bd rounded-lg p-4 shadow-ds-sm">
                  <p className="text-sm font-semibold text-txs mb-3">系列课导航</p>
                  <nav className="space-y-1">
                    {track.modules.map((module) => {
                      const count = getCoursesForModule(courses, track.id, module.id, plusTracks).length;
                      const Icon = getModuleIcon(module.iconKey || module.id);
                      return (
                        <a
                          key={module.id}
                          href={`#${encodeURIComponent(module.id)}`}
                          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-tx hover:bg-acl hover:text-ac transition-colors"
                        >
                          <Icon className="w-4 h-4" />
                          <span className="flex-1">{module.title}</span>
                          <span className="text-xs text-txs">{count}</span>
                        </a>
                      );
                    })}
                  </nav>
                </aside>

                <div className="space-y-6">
                  {track.modules.map((module) => (
                    <ModuleSection
                      key={module.id}
                      trackId={track.id}
                      moduleId={module.id}
                      title={module.title}
                      description={module.description}
                      courses={getCoursesForModule(courses, track.id, module.id, plusTracks)}
                      onCourseClick={handleCourseClick}
                    />
                  ))}
                </div>
              </div>

              <div className="lg:hidden">
                <Accordion type="multiple" defaultValue={initialMobileModules} className="space-y-3">
                  {track.modules.map((module) => {
                    const moduleCourses = getCoursesForModule(courses, track.id, module.id, plusTracks);
                    const Icon = getModuleIcon(module.iconKey || module.id);
                    return (
                      <AccordionItem key={module.id} value={module.id} className="bg-bc border border-bd rounded-lg overflow-hidden">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                          <div className="flex items-center gap-2 text-left">
                            <Icon className="w-4 h-4 text-ac" />
                            <span className="font-bold text-tx">{module.title}</span>
                            <span className="text-xs text-txs">({moduleCourses.length})</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <p className="text-sm text-txs mb-3">{module.description}</p>
                          <CourseList courses={moduleCourses} onCourseClick={handleCourseClick} />
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </section>
          )}
        </main>
        <Footer />
        <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} requiredLevel="plus" />
      </div>
    </>
  );
}

function ModuleSection({
  moduleId,
  title,
  description,
  courses,
  onCourseClick,
}: {
  trackId: PlusCourseTrackId;
  moduleId: string;
  title: string;
  description: string;
  courses: Course[];
  onCourseClick: (course: Course) => void;
}) {
  const Icon = getModuleIcon(moduleId);
  return (
    <section id={moduleId} className="scroll-mt-28 bg-bc border border-bd rounded-lg p-5 shadow-ds-sm">
      <div className="flex items-start gap-3 border-b border-bdl pb-4 mb-4">
        <div className="w-10 h-10 rounded-lg bg-acl flex items-center justify-center">
          <Icon className="w-5 h-5 text-ac" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-ds-bold text-tx" style={{ fontFamily: 'var(--fd)' }}>
              {title}
            </h2>
            <Badge variant="outline" className="rounded-full">
              {courses.length} 节
            </Badge>
          </div>
          <p className="text-sm text-txs mt-1">{description}</p>
        </div>
      </div>
      <CourseList courses={courses} onCourseClick={onCourseClick} />
    </section>
  );
}

function CourseList({
  courses,
  onCourseClick,
}: {
  courses: Course[];
  onCourseClick: (course: Course) => void;
}) {
  if (courses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-bd bg-bgs/40 p-5 text-center">
        <BookOpen className="w-8 h-8 text-txt mx-auto mb-2" />
        <p className="font-semibold text-tx">规划中</p>
        <p className="text-sm text-txs mt-1">这个系列课会用于承接后续重录、图文课或案例材料。</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {courses.map((course, index) => (
        <button
          key={course.id}
          type="button"
          onClick={() => onCourseClick(course)}
          className="group flex items-start gap-3 rounded-lg border border-bd bg-bgs/30 p-4 text-left hover:border-ac/50 hover:bg-acl/30 transition-all"
        >
          <div className="mt-0.5 w-8 h-8 rounded-full bg-bc border border-bd flex items-center justify-center text-xs font-bold text-ac">
            {index + 1}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-tx leading-snug group-hover:text-ac">{course.title}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-txs">
              {course.duration && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {course.duration}分钟
                </span>
              )}
              {course.is_trial && <Badge className="bg-green-500 text-white text-xs px-2 py-0">试看</Badge>}
              <span className="inline-flex items-center gap-1">
                <PlayCircle className="w-3 h-3" />
                单课
              </span>
              <span className="inline-flex items-center gap-1">
                <LockKeyhole className="w-3 h-3" />
                Plus
              </span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-txs group-hover:text-ac group-hover:translate-x-1 transition-all flex-shrink-0" />
        </button>
      ))}
    </div>
  );
}
