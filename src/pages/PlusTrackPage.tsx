import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/Header';
import Footer from '@/components/common/Footer';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import PageMeta from '@/components/common/PageMeta';
import UpgradePopup from '@/components/common/UpgradePopup';
import {
  CourseEditorialCatalogLayout,
  CourseEditorialHero,
  CourseEditorialVolume,
} from '@/components/course/CourseEditorialShell';
import { getCourseCatalogSnapshot, getCourseDetailSnapshot } from '@/db/api';
import { canAccessCourse } from '@/lib/access-control';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { Course, PlusCourseTrackId } from '@/types/types';
import {
  PLUS_TRACKS,
  buildPlusTrackUrl,
  getCoursesForModule,
  getEffectivePlusTracks,
  getModuleIcon,
  getPlusTrack,
  getTrackCourseCount,
  type PlusTrackConfig,
} from '@/lib/plusCourseStructure';
import { AlertCircle, BookOpen, ChevronRight, Clock, LockKeyhole, PlayCircle } from 'lucide-react';

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
        const catalog = await getCourseCatalogSnapshot();
        const coursesData = catalog.plus_courses;
        const structureData = catalog.plus_tracks;
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
        <main className="course-reading-desk flex-1 pb-12 pt-20">
          <CourseEditorialHero
            kicker="PLUS VOLUME · 教学通识课卷册"
            badge={`PLUS · ${track.shortTitle}`}
            title={track.title}
            description={track.description}
            audience={`适合：${track.audience}`}
            icon={TrackIcon}
            onBack={() => navigate('/courses')}
            backLabel="返回课程地图"
            stats={[
              { label: '系列卷册', value: track.modules.length },
              { label: '已发布单课', value: visibleTrackCourseCount },
            ]}
          >
            <nav className="flex flex-wrap gap-2" aria-label="教学通识课篇章">
              {plusTracks.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(buildPlusTrackUrl(item.id))}
                  aria-current={item.id === track.id ? 'page' : undefined}
                  className={cn(
                    'min-h-10 rounded-ds-sm border px-3 py-1.5 text-sm font-ds-semibold transition-colors',
                    item.id === track.id
                      ? 'border-ac bg-ac text-white'
                      : 'border-bd bg-[var(--paper)] text-txs hover:border-ac/40 hover:text-ac',
                  )}
                >
                  <span className="mr-1.5 font-mono text-[10px] opacity-70">{String(index + 1).padStart(2, '0')}</span>
                  {item.title}
                </button>
              ))}
            </nav>
          </CourseEditorialHero>

          {error && !isLoading && (
            <div className="max-w-7xl mx-auto px-4 py-10">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
                <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
                <p className="text-destructive font-semibold">{error}</p>
              </div>
            </div>
          )}

          {!isLoading && !error && (
            <CourseEditorialCatalogLayout
              label={`${track.shortTitle}目录`}
              countLabel={`${track.modules.length} 卷`}
              toc={track.modules.map((module, index) => {
                const count = getCoursesForModule(courses, track.id, module.id, plusTracks).length;
                const Icon = getModuleIcon(module.iconKey || module.id);
                return (
                  <a key={module.id} href={`#${encodeURIComponent(module.id)}`} className="course-editorial-toc-link">
                    <span className="font-mono text-[10px] text-txt">{String(index + 1).padStart(2, '0')}</span>
                    <Icon className="h-4 w-4 flex-shrink-0 text-ac" aria-hidden="true" />
                    <span className="flex-1 truncate">{module.title}</span>
                    <span className="text-xs text-txt">{count}</span>
                  </a>
                );
              })}
              mobile={(
                <Accordion type="multiple" defaultValue={initialMobileModules} className="space-y-3">
                  {track.modules.map((module, index) => {
                    const moduleCourses = getCoursesForModule(courses, track.id, module.id, plusTracks);
                    const Icon = getModuleIcon(module.iconKey || module.id);
                    return (
                      <AccordionItem key={module.id} value={module.id} className="course-editorial-volume overflow-hidden">
                        <AccordionTrigger className="min-h-16 px-4 py-3 hover:bg-[var(--proof-soft)] hover:no-underline">
                          <div className="flex w-full items-center gap-3 text-left">
                            <div className="course-editorial-mark">
                              <Icon className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <span className="min-w-0 flex-1">
                              <span className="editorial-kicker block">VOL. {String(index + 1).padStart(2, '0')}</span>
                              <strong className="block truncate text-tx">{module.title}</strong>
                              <small className="text-txs">{moduleCourses.length} 节课程</small>
                            </span>
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
              )}
            >
              {track.modules.map((module, index) => (
                <ModuleSection
                  key={module.id}
                  index={index}
                  moduleId={module.id}
                  iconKey={module.iconKey || module.id}
                  title={module.title}
                  description={module.description}
                  courses={getCoursesForModule(courses, track.id, module.id, plusTracks)}
                  onCourseClick={handleCourseClick}
                />
              ))}
            </CourseEditorialCatalogLayout>
          )}
        </main>
        <Footer />
        <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} requiredLevel="plus" />
      </div>
    </>
  );
}

function ModuleSection({
  index,
  moduleId,
  iconKey,
  title,
  description,
  courses,
  onCourseClick,
}: {
  index: number;
  moduleId: string;
  iconKey: string;
  title: string;
  description: string;
  courses: Course[];
  onCourseClick: (course: Course) => void;
}) {
  const Icon = getModuleIcon(iconKey);
  return (
    <CourseEditorialVolume
      id={moduleId}
      index={index}
      title={title}
      description={description}
      count={courses.length}
      icon={Icon}
    >
      <CourseList courses={courses} onCourseClick={onCourseClick} />
    </CourseEditorialVolume>
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
          onMouseEnter={() => void getCourseDetailSnapshot(course.id)}
          onFocus={() => void getCourseDetailSnapshot(course.id)}
          onTouchStart={() => void getCourseDetailSnapshot(course.id)}
          aria-label={`打开课程：${course.title}`}
          className="course-editorial-entry group"
        >
          <span className="course-editorial-index">{String(index + 1).padStart(2, '0')}</span>
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
          <ChevronRight className="w-5 h-5 text-txs group-hover:text-ac group-hover:translate-x-1 transition-all flex-shrink-0" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
