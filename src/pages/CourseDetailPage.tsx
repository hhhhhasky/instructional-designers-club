import { useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  ExternalLink,
  Clock,
  Award,
  User,
  BookOpen,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  List,
  CheckCircle2,
  PlayCircle,
  Eye,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  Download,
  FileText,
  FileVideo,
  FileImage,
  FileAudio,
  File,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/common/Footer';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import PageMeta from '@/components/common/PageMeta';
import MarkdownRenderer from '@/components/common/MarkdownRenderer';
import CourseConfirmDialog from '@/components/course/CourseConfirmDialog';
import CourseContentStack from '@/components/course/CourseContentStack';
import CourseCompletionDialog from '@/components/course/CourseCompletionDialog';
import TeacherAiCatalogToc from '@/components/course/TeacherAiCatalogToc';
import PlusCatalogToc from '@/components/course/PlusCatalogToc';
import CourseQuestionsPanel from '@/components/course/CourseQuestionsPanel';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { getCourseByIdAdmin, incrementCourseViewCount, getCourseCatalogSnapshot, getCourseDetailSnapshot, getLearningData, getCourseAttachments } from '@/db/api';
import { canAccessCourse, recordCourseVisit, updateLearningProgress, getUserLearningRecords } from '@/lib/access-control';
import {
  buildGamificationSnapshot,
  findAchievementForCourse,
  type Achievement,
  type GamificationSnapshot,
} from '@/lib/gamification';
import { useAuth } from '@/contexts/AuthContext';
import type { Course, CourseAttachment, LearningRecord } from '@/types/types';
import { cn } from '@/lib/utils';
import {
  buildPlusTrackUrl,
  getCoursesForModule,
  getEffectivePlusTracks,
  getPlusModule,
  getPlusTrack,
  PLUS_TRACKS,
  resolvePlusCoursePlacement,
  type PlusTrackConfig,
} from '@/lib/plusCourseStructure';

const LEVEL_STYLE: Record<string, string> = {
  '入门': 'bg-bgs text-txs',
  '初级': 'bg-tll text-tl',
  '中级': 'bg-acl text-ac',
  '高级': 'bg-aml text-am',
};

const detailWriteGuard = new Map<string, number>();
const WRITE_GUARD_TTL_MS = 60 * 1000;

function shouldRunDetailWrite(key: string): boolean {
  const now = Date.now();
  const lastRun = detailWriteGuard.get(key) ?? 0;
  if (now - lastRun < WRITE_GUARD_TTL_MS) return false;
  detailWriteGuard.set(key, now);
  return true;
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, accessLevel } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeLevel, setUpgradeLevel] = useState<'plus' | 'pro'>('plus');
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSyncedProgress = useRef(0);
  const lastSyncedAudioProgress = useRef(0);
  const [manuallyMarked, setManuallyMarked] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionSnapshot, setCompletionSnapshot] = useState<GamificationSnapshot | null>(null);
  const [completionAchievement, setCompletionAchievement] = useState<Achievement | null>(null);
  const [attachments, setAttachments] = useState<CourseAttachment[]>([]);

  // 同系列课程列表
  const [siblingCourses, setSiblingCourses] = useState<Course[]>([]);
  const [learningRecords, setLearningRecords] = useState<LearningRecord[]>([]);
  const [plusTracks, setPlusTracks] = useState<PlusTrackConfig[]>(PLUS_TRACKS);
  // 教师AI课全量目录（仅 pro 课程详情页加载）
  const [teacherAiCatalog, setTeacherAiCatalog] = useState<{
    categories: string[];
    coursesByCategory: Record<string, Course[]>;
  }>({ categories: [], coursesByCategory: {} });
  // 教学通识课（Plus）全量课程（仅 plus 课程详情页加载，供左侧全量目录）
  const [plusAllCourses, setPlusAllCourses] = useState<Course[]>([]);
  const [tocOpen, setTocOpen] = useState(true);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  const syncProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration || !user || !course) return;

    const progress = Math.round((video.currentTime / video.duration) * 100);
    if (progress <= lastSyncedProgress.current) return;

    lastSyncedProgress.current = progress;
    const status = progress >= 95 ? 'completed' : 'in_progress';
    updateLearningProgress(user.id, course.id, progress, status);
  }, [user, course]);

  const showCompletionFeedback = useCallback(async () => {
    if (!user || !course || !profile) return;
    const data = await getLearningData(user.id);
    const snapshot = buildGamificationSnapshot({
      overview: data.overview,
      seriesProgress: data.seriesProgress,
      recentLearning: data.recentLearning,
      accessLevel: profile.access_level,
    });
    setCompletionSnapshot(snapshot);
    setCompletionAchievement(findAchievementForCourse(course, snapshot.achievements));
    setCompletionOpen(true);
  }, [user, course, profile]);

  const completeCurrentCourse = useCallback(async () => {
    if (!user || !course) return;
    lastSyncedProgress.current = 100;
    lastSyncedAudioProgress.current = 100;
    await updateLearningProgress(user.id, course.id, 100, 'completed');
    setManuallyMarked(true);
    setLearningRecords((records) => {
      const existing = records.find((record) => record.course_id === course.id);
      if (!existing) return records;
      return records.map((record) =>
        record.course_id === course.id
          ? { ...record, progress: 100, status: 'completed' as const, last_watched_at: new Date().toISOString() }
          : record,
      );
    });
    await showCompletionFeedback();
  }, [user, course, showCompletionFeedback]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration) return;

    const progress = Math.round((video.currentTime / video.duration) * 100);
    if (progress - lastSyncedProgress.current >= 10 || progress >= 95) {
      syncProgress();
    }
  }, [syncProgress]);

  const handleVideoEnded = useCallback(() => {
    void completeCurrentCourse();
  }, [completeCurrentCourse]);

  // 音频进度：每 10% 或到 95% 同步一次（与视频逻辑一致，独立计数器）
  const handleAudioProgress = useCallback((percent: number) => {
    if (!user || !course) return;
    if (percent <= lastSyncedAudioProgress.current) return;
    if (percent - lastSyncedAudioProgress.current >= 10 || percent >= 95) {
      lastSyncedAudioProgress.current = percent;
      const status = percent >= 95 ? 'completed' : 'in_progress';
      updateLearningProgress(user.id, course.id, percent, status);
    }
  }, [user, course]);

  const handleAudioEnded = useCallback(() => {
    void completeCurrentCourse();
  }, [completeCurrentCourse]);

  // 只在 id 变化时加载课程数据
  useEffect(() => {
    const loadCourse = async () => {
      if (!id) {
        setError('课程ID不存在');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        setShowUpgrade(false);
        setManuallyMarked(false);
        setAttachments([]);
        setSiblingCourses([]);
        setTeacherAiCatalog({ categories: [], coursesByCategory: {} });
        setPlusAllCourses([]);

        const detailSnapshot = await getCourseDetailSnapshot(id);
        let courseData = detailSnapshot.course;
        let catalog = detailSnapshot.catalog;
        let siblingCoursesFromSnapshot = detailSnapshot.sibling_courses;

        // 管理员预览：常规 API 找不到时查所有状态
        if (!courseData && profile?.role === 'admin') {
          courseData = await getCourseByIdAdmin(id);
          catalog = await getCourseCatalogSnapshot();
          siblingCoursesFromSnapshot = [];
        }

        if (!courseData) {
          setError('课程不存在');
        } else {
          setCourse(courseData);
          if (courseData.status === 'published' && shouldRunDetailWrite(`view:${id}`)) {
            await incrementCourseViewCount(id);
          }

          // Plus 课程按篇章/分类系列结构加载同系列课程；Pro/Free 保持旧分类目录。
          if (courseData.membership_type === 'plus') {
            const plusCatalog = catalog ?? await getCourseCatalogSnapshot();
            const plusCourses = plusCatalog.plus_courses;
            const structureData = plusCatalog.plus_tracks;
            const moduleSourceCourses = plusCourses.some((item) => item.id === courseData.id)
              ? plusCourses
              : [...plusCourses, courseData];
            const effectiveTracks = getEffectivePlusTracks(
              moduleSourceCourses,
              structureData.length > 0 ? structureData : PLUS_TRACKS,
            );
            setPlusTracks(effectiveTracks);
            setPlusAllCourses(moduleSourceCourses);
            const placement = resolvePlusCoursePlacement(courseData, effectiveTracks);
            if (placement) {
              setSiblingCourses(getCoursesForModule(
                moduleSourceCourses,
                placement.resolvedTrackId,
                placement.resolvedModuleId,
                effectiveTracks,
              ));
            }
          } else if (courseData.membership_type === 'pro') {
            // 教师AI课：加载全量目录，并派生当前系列单课（供 prev/next 导航）
            const proCatalog = catalog ?? await getCourseCatalogSnapshot();
            const allProCourses = proCatalog.pro_courses.some((item) => item.id === courseData.id)
              ? proCatalog.pro_courses
              : [...proCatalog.pro_courses, courseData];
            const proCats = proCatalog.pro_categories;
            const proGrouped: Record<string, Course[]> = {};
            proCats.forEach((cat) => {
              proGrouped[cat] = allProCourses.filter((c) => c.category === cat);
            });
            setTeacherAiCatalog({ categories: proCats, coursesByCategory: proGrouped });
            setSiblingCourses(courseData.category ? proGrouped[courseData.category] ?? [] : []);
          } else {
            setSiblingCourses(siblingCoursesFromSnapshot);
          }
        }
      } catch (err) {
        console.error('加载课程详情失败:', err);
        setError('加载课程详情失败，请刷新页面重试');
      } finally {
        setIsLoading(false);
      }
    };

    loadCourse();
  }, [id, profile?.role]);

  // 访问控制检查独立于课程加载
  useEffect(() => {
    if (!course || isLoading) return;

    if (!canAccessCourse(accessLevel, course.membership_type)) {
      if (!user) {
        navigate('/login', { state: { from: `/courses/${course.id}` }, replace: true });
      } else {
        setUpgradeLevel(course.membership_type as 'plus' | 'pro');
        setShowUpgrade(true);
      }
    } else {
      setShowUpgrade(false);
      if (user) {
        if (shouldRunDetailWrite(`visit:${user.id}:${course.id}`)) {
          recordCourseVisit(user.id, course.id);
        }
        getUserLearningRecords(user.id).then(records => {
          setLearningRecords(records);
          const record = records.find(r => r.course_id === course.id);
          if (record && record.progress > lastSyncedProgress.current) {
            lastSyncedProgress.current = record.progress;
          }
          if (record && record.progress > lastSyncedAudioProgress.current) {
            lastSyncedAudioProgress.current = record.progress;
          }
        });
      }
    }
  }, [course, user, accessLevel, isLoading, navigate]);

  useEffect(() => {
    if (!course || isLoading) return;
    if (profile?.role !== 'admin' && !canAccessCourse(accessLevel, course.membership_type)) {
      setAttachments([]);
      return;
    }

    let cancelled = false;
    getCourseAttachments(course.id)
      .then((items) => {
        if (!cancelled) setAttachments(items);
      })
      .catch((err) => {
        console.error('加载课程附件失败:', err);
        if (!cancelled) setAttachments([]);
      });

    return () => {
      cancelled = true;
    };
  }, [course, accessLevel, profile?.role, isLoading]);

  // 页面离开时同步最终进度
  useEffect(() => {
    return () => { syncProgress(); };
  }, [syncProgress]);

  // 计算当前课程在系列中的位置
  const currentIndex = siblingCourses.findIndex(c => c.id === id);
  const prevCourse = currentIndex > 0 ? siblingCourses[currentIndex - 1] : null;
  const nextCourse = currentIndex >= 0 && currentIndex < siblingCourses.length - 1 ? siblingCourses[currentIndex + 1] : null;
  const currentPosition = currentIndex >= 0 ? currentIndex + 1 : 1;
  const plusPlacement = course?.membership_type === 'plus' ? resolvePlusCoursePlacement(course, plusTracks) : null;
  const plusTrack = plusPlacement ? getPlusTrack(plusPlacement.resolvedTrackId, plusTracks) : undefined;
  const plusModule = plusPlacement ? getPlusModule(plusPlacement.resolvedTrackId, plusPlacement.resolvedModuleId, plusTracks) : undefined;
  const courseCollectionLabel = plusModule?.title || course?.category || '课程目录';
  const courseBadgeLabel = course?.membership_type === 'plus' ? courseCollectionLabel : course?.category;

  const getProgress = (courseId: string): number => {
    const record = learningRecords.find(r => r.course_id === courseId);
    return record?.progress || 0;
  };

  const getStatus = (courseId: string): string => {
    const record = learningRecords.find(r => r.course_id === courseId);
    return record?.status || 'not_started';
  };

  const getCourseListPath = (membershipType?: string | null) => {
    if (membershipType === 'plus' && plusPlacement) {
      return buildPlusTrackUrl(plusPlacement.resolvedTrackId, plusPlacement.resolvedModuleId);
    }
    return membershipType === 'pro' ? '/teacher-ai-courses' : '/courses';
  };

  const getCourseListName = (membershipType?: string | null) => {
    if (membershipType === 'plus' && plusTrack) return plusTrack.title;
    return membershipType === 'pro' ? '教师AI课' : '教学通识课';
  };

  // 侧边栏内切换课程：直接跳转，不走 isNavigating 状态
  const handleNavigateToCourse = (courseId: string) => {
    if (courseId === id) return;
    navigate(`/courses/${courseId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <LoadingOverlay message="正在加载课程详情..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center pt-20 px-4">
          <div className="text-center animate-fade-in max-w-md">
            <AlertCircle className="w-14 h-14 text-ac/60 mx-auto mb-5" />
            <h1 className="text-ds-2xl font-ds-bold text-tx font-serif mb-5">{error}</h1>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate('/courses')} className="btn-press">
                返回教学通识课
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline" className="btn-press">
                刷新页面
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (showUpgrade) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center pt-20 px-4">
          <div className="text-center animate-fade-in max-w-md">
            <AlertCircle className="w-14 h-14 text-ac/60 mx-auto mb-5" />
            <h1 className="text-ds-2xl font-ds-bold text-tx font-serif mb-5">
              需要{upgradeLevel === 'pro' ? 'Pro 专家版' : 'Plus 会员版'}权限
            </h1>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate(getCourseListPath(upgradeLevel))} className="btn-press">
                返回{getCourseListName(upgradeLevel)}
              </Button>
              <Button asChild className="btn-super-cta !text-white btn-press">
                <a href="http://b50rtgy70nmgu05j.mikecrm.com/rPZN0Mb" target="_blank" rel="noopener noreferrer">
                  立即升级
                </a>
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // 兜底：加载完成且无错误，但 course 仍为 null（课程不存在 / 已下架）
  // 同时让 TS 在下方 JSX 中把 course 收窄为非 null
  if (!course) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center pt-20 px-4">
          <div className="text-center animate-fade-in max-w-md">
            <AlertCircle className="w-14 h-14 text-ac/60 mx-auto mb-5" />
            <h1 className="text-ds-2xl font-ds-bold text-tx font-serif mb-5">
              课程不存在或已下架
            </h1>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate('/courses')} className="btn-press">
                返回教学通识课
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // 纯文本/图集课：手动标记完成（乐观更新本地状态，学习记录已落库）
  const isCurrentCompleted = manuallyMarked || getStatus(course.id) === 'completed';
  const isProCourse = course.membership_type === 'pro';
  const hasTeacherAiCatalog = isProCourse && teacherAiCatalog.categories.length > 0;
  const isPlusCourse = course.membership_type === 'plus';
  const hasPlusCatalog = isPlusCourse && plusAllCourses.length > 0 && plusTracks.length > 0;

  const handleMarkComplete = () => {
    void completeCurrentCourse();
  };

  const handleBack = () => {
    navigate(getCourseListPath(course.membership_type));
  };

  const handleStartLearning = () => {
    if (course?.meeting_url) setShowConfirmDialog(true);
  };

  const handleConfirmStart = () => {
    setShowConfirmDialog(false);
    if (course?.meeting_url) window.open(course.meeting_url, '_blank');
  };

  const heroContent = course.video_url ? (
    <video
      ref={videoRef}
      src={course.video_url}
      controls
      playsInline
      preload="auto"
      className="w-full block"
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleVideoEnded}
    />
  ) : (
    <img
      src={course.image_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80'}
      alt={course.title}
      loading="lazy"
      decoding="async"
      className="w-full h-full object-cover aspect-video"
    />
  );

  return (
    <>
      {course && (
        <PageMeta
          title={course.title}
          description={course.description || `${course.title} - 教学设计师俱乐部课程`}
          canonicalPath={`/courses/${course.id}`}
          ogType="article"
          ogImage={course.image_url || undefined}
          keywords={course.category || undefined}
        />
      )}
    <div className="min-h-screen bg-cream flex flex-col">
      <Header />

      <main className="flex-1 pt-20 pb-ds-11">
        {/* Breadcrumb — 不用动画，避免叠层上下文问题 */}
        <div className="max-w-7xl mx-auto px-4 pt-5 pb-1">
          <div className="flex items-center gap-1.5 text-sm text-tx/60">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1 hover:text-ac transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
              {getCourseListName(course.membership_type)}
            </button>
            {courseCollectionLabel && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-tx/30" />
                <span className="text-tx/80 font-medium">{courseCollectionLabel}</span>
              </>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-tx/30" />
            <span className="truncate max-w-[200px] text-tx/60">{course.title}</span>
          </div>
        </div>

        {/* 管理员预览横幅 */}
        {profile?.role === 'admin' && course.status !== 'published' && (
          <div className="max-w-7xl mx-auto px-4 pt-3">
            <div className="bg-am/10 border border-am/30 rounded-ds-lg px-4 py-2.5 flex items-center gap-2 text-ds-sm text-am">
              <Eye className="w-4 h-4 flex-shrink-0" />
              <span>
                你正在预览未发布内容（状态：<strong>{course.status === 'draft' ? '草稿' : '已归档'}</strong>）— 普通用户看不到此页面
              </span>
            </div>
          </div>
        )}

        {/* Main Content: Video + Sidebar */}
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className={cn('flex', (isProCourse || isPlusCourse) ? 'gap-4' : 'gap-5')}>
            {/* 教师AI课：左侧可折叠全量目录（桌面端常驻） */}
            {hasTeacherAiCatalog && (
              <aside
                className="hidden lg:block flex-shrink-0 self-start sticky top-20 transition-all duration-200"
                style={{ width: tocOpen ? 260 : 48 }}
              >
                {tocOpen ? (
                  <div className="bg-bc rounded-lg border border-bd shadow-ds-elegant overflow-hidden h-[calc(100vh-7rem)] max-h-[680px] flex flex-col">
                    <div className="flex items-center justify-between px-3 py-3 border-b border-bdl bg-warm/30">
                      <h3 className="font-bold text-tx text-sm">教师AI课目录</h3>
                      <button
                        type="button"
                        onClick={() => setTocOpen(false)}
                        className="p-1 rounded hover:bg-bgs text-txs transition-colors"
                        aria-label="收起目录"
                      >
                        <PanelLeftClose className="w-4 h-4" />
                      </button>
                    </div>
                    <TeacherAiCatalogToc
                      categories={teacherAiCatalog.categories}
                      coursesByCategory={teacherAiCatalog.coursesByCategory}
                      currentCourseId={course.id}
                      onSelect={handleNavigateToCourse}
                      learningRecords={learningRecords}
                      className="flex-1"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setTocOpen(true)}
                    className="w-12 h-full min-h-[120px] bg-bc rounded-lg border border-bd shadow-ds-elegant py-3 flex flex-col items-center gap-2 text-txs hover:text-amber-700 transition-colors"
                    aria-label="展开目录"
                  >
                    <PanelLeftOpen className="w-5 h-5" />
                    <span className="text-[10px] [writing-mode:vertical-rl] tracking-widest">目录</span>
                  </button>
                )}
              </aside>
            )}
            {/* 教学通识课：左侧可折叠全量目录（桌面端常驻） */}
            {hasPlusCatalog && (
              <aside
                className="hidden lg:block flex-shrink-0 self-start sticky top-20 transition-all duration-200"
                style={{ width: tocOpen ? 260 : 48 }}
              >
                {tocOpen ? (
                  <div className="bg-bc rounded-lg border border-bd shadow-ds-elegant overflow-hidden h-[calc(100vh-7rem)] max-h-[680px] flex flex-col">
                    <div className="flex items-center justify-between px-3 py-3 border-b border-bdl bg-warm/30">
                      <h3 className="font-bold text-tx text-sm">教学通识课目录</h3>
                      <button
                        type="button"
                        onClick={() => setTocOpen(false)}
                        className="p-1 rounded hover:bg-bgs text-txs transition-colors"
                        aria-label="收起目录"
                      >
                        <PanelLeftClose className="w-4 h-4" />
                      </button>
                    </div>
                    <PlusCatalogToc
                      tracks={plusTracks}
                      courses={plusAllCourses}
                      currentCourseId={course.id}
                      onSelect={handleNavigateToCourse}
                      learningRecords={learningRecords}
                      className="flex-1"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setTocOpen(true)}
                    className="w-12 h-full min-h-[120px] bg-bc rounded-lg border border-bd shadow-ds-elegant py-3 flex flex-col items-center gap-2 text-txs hover:text-ac transition-colors"
                    aria-label="展开目录"
                  >
                    <PanelLeftOpen className="w-5 h-5" />
                    <span className="text-[10px] [writing-mode:vertical-rl] tracking-widest">目录</span>
                  </button>
                )}
              </aside>
            )}
            {/* Left: Video + Details */}
            <div className="flex-1 min-w-0">
              <div className="bg-bc rounded-ds-lg border border-bd shadow-ds-elegant overflow-hidden">

                {/* Hero Video */}
                <div className="relative bg-black">
                  {heroContent}
                  <div className="absolute top-3 left-3 flex gap-1.5 z-10">
                    {courseBadgeLabel && (
                      <Badge variant="secondary" className="bg-bc/90 backdrop-blur-sm text-tx text-xs font-medium rounded-full">
                        {courseBadgeLabel}
                      </Badge>
                    )}
                    {course.level && (
                      <Badge className={`${LEVEL_STYLE[course.level] || 'bg-bgs text-txs'} text-xs font-medium rounded-full`}>
                        {course.level}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Tablet/Desktop Prev/Next Navigation */}
                {siblingCourses.length > 1 && (
                  <div className="hidden md:flex items-center justify-between px-5 py-3 border-b border-bdl bg-warm/30">
                    <button
                      onClick={() => prevCourse && handleNavigateToCourse(prevCourse.id)}
                      disabled={!prevCourse}
                      className={cn(
                        "flex items-center gap-2 text-sm font-medium transition-colors",
                        prevCourse ? "text-ac hover:text-ac/80" : "text-txs/40 cursor-not-allowed"
                      )}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline truncate max-w-[200px]">
                        {prevCourse ? prevCourse.title : '已是第一节'}
                      </span>
                      <span className="sm:hidden">上一节</span>
                    </button>

                    {hasTeacherAiCatalog || hasPlusCatalog ? (
                      <>
                        {/* 平板端：目录入口；移动端改用固定课程控制栏 */}
                        <button
                          type="button"
                          onClick={() => setMobileTocOpen(true)}
                          className="hidden md:inline-flex lg:hidden items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold text-tx hover:bg-bgs active:bg-bgs transition-colors"
                          aria-label="打开课程目录"
                        >
                          <List className="w-4 h-4" />
                          目录
                          <span className="font-normal text-txs">
                            {currentPosition}/{siblingCourses.length}
                          </span>
                        </button>
                        {/* 桌面端：位置计数（桌面有左侧目录，无需入口） */}
                        <span className="hidden lg:inline text-xs text-txs px-3">
                          {currentPosition} / {siblingCourses.length}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-txs px-3">
                        {currentPosition} / {siblingCourses.length}
                      </span>
                    )}

                    <button
                      onClick={() => nextCourse && handleNavigateToCourse(nextCourse.id)}
                      disabled={!nextCourse}
                      className={cn(
                        "flex items-center gap-2 text-sm font-medium transition-colors",
                        nextCourse ? "text-ac hover:text-ac/80" : "text-txs/40 cursor-not-allowed"
                      )}
                    >
                      <span className="hidden sm:inline truncate max-w-[200px]">
                        {nextCourse ? nextCourse.title : '已是最后一节'}
                      </span>
                      <span className="sm:hidden">下一节</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Pro/Plus 单课的平板端目录入口；移动端改用固定课程控制栏 */}
                {siblingCourses.length <= 1 && (hasTeacherAiCatalog || hasPlusCatalog) && (
                  <div className="hidden md:flex lg:hidden items-center px-5 py-2.5 border-b border-bdl bg-warm/30">
                    <button
                      type="button"
                      onClick={() => setMobileTocOpen(true)}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-tx hover:text-ac transition-colors"
                      aria-label="打开课程目录"
                    >
                      <List className="w-4 h-4" />
                      查看全部目录
                    </button>
                  </div>
                )}

                {/* Tablet: Inline course list below video（仅 Free；移动端改用抽屉） */}
                {!isProCourse && !isPlusCourse && siblingCourses.length > 1 && (
                  <div className="hidden md:block lg:hidden border-b border-bdl">
                    <div className="px-4 py-2.5 bg-warm/30 flex items-center justify-between">
                      <h3 className="font-bold text-tx text-sm flex items-center gap-2">
                        <List className="w-4 h-4 text-ac" />
                        {courseCollectionLabel}
                      </h3>
                      <span className="text-xs text-txs">{currentPosition} / {siblingCourses.length}</span>
                    </div>
                    <div className="max-h-60 overflow-y-auto overscroll-contain">
                      {siblingCourses.map((sibling, index) => {
                        const isCurrent = sibling.id === id;
                        const progress = getProgress(sibling.id);
                        const status = getStatus(sibling.id);

                        return (
                          <button
                            key={sibling.id}
                            onClick={() => handleNavigateToCourse(sibling.id)}
                            className={cn(
                              "w-full text-left px-4 py-2.5 border-b border-bdl/30 transition-all",
                              "hover:bg-warm/50 active:bg-warm",
                              isCurrent && "bg-acl"
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="flex-shrink-0">
                                {isCurrent ? (
                                  <PlayCircle className="w-4 h-4 text-ac" />
                                ) : status === 'completed' ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                ) : (
                                  <span className={cn(
                                    "inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold",
                                    progress > 0 ? "bg-ac/10 text-ac" : "bg-bgs text-txs"
                                  )}>
                                    {index + 1}
                                  </span>
                                )}
                              </div>

                              <div className="flex-1 min-w-0 flex items-center gap-2">
                                <p className={cn(
                                  "text-sm truncate",
                                  isCurrent ? "text-ac font-semibold" : "text-tx"
                                )}>
                                  {sibling.title}
                                </p>
                                {status === 'completed' && !isCurrent && (
                                  <span className="text-[10px] text-green-500 flex-shrink-0">已完成</span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Course Info */}
                <div className="p-6 md:p-8">

                  {/* Title */}
                  <h1 className="text-2xl md:text-3xl font-black text-tx font-serif leading-tight">
                    {course.title}
                  </h1>

                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-txs mt-5 pb-6 border-b border-bdl">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-ac" />
                      {course.duration || 60}分钟
                    </span>
                    {course.credits && (
                      <span className="inline-flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-ac" />
                        {course.credits}学分
                      </span>
                    )}
                    {course.instructor && (
                      <span className="inline-flex items-center gap-1.5">
                        <User className="w-4 h-4 text-ac" />
                        {course.instructor}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <section className="pt-7 pb-6 border-b border-bdl">
                    <h2 className="text-xl font-bold text-tx font-serif mb-3 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-ac" />
                      课程简介
                    </h2>
                    <div className="bg-bgs rounded-md p-5">
                      <p className="text-lg text-tx leading-relaxed whitespace-pre-wrap font-body">
                        {course.description || '本课程将帮助您深入理解教学设计的核心概念和实践方法，通过系统化的学习，掌握AI时代的教学设计技能。'}
                      </p>
                    </div>
                  </section>

                  {/* 多载体内容栈：音频 / 正文 / 图集（按存在性叠加渲染） */}
                  <CourseContentStack
                    course={course}
                    onAudioProgress={handleAudioProgress}
                    onAudioEnded={handleAudioEnded}
                    onMarkComplete={handleMarkComplete}
                    isCompleted={isCurrentCompleted}
                  />

                  {attachments.length > 0 && (
                    <section className="py-7 border-b border-bdl">
                      <h2 className="text-xl font-bold text-tx font-serif mb-3 flex items-center gap-2">
                        <Download className="w-4 h-4 text-ac" />
                        下载文件
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={attachment.file_name}
                            className="group flex items-center gap-3 rounded-ds-md border border-bd bg-bgs/40 px-4 py-3 hover:border-ac/40 hover:bg-acl/40 transition-colors"
                          >
                            <AttachmentIcon attachment={attachment} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-ds-sm font-semibold text-tx group-hover:text-ac">
                                {attachment.file_name}
                              </span>
                              <span className="block text-ds-xs text-txs">
                                {getAttachmentTypeLabel(attachment.file_type)}
                                {attachment.file_size ? ` · ${formatFileSize(attachment.file_size)}` : ""}
                              </span>
                            </span>
                            <Download className="w-4 h-4 text-txs group-hover:text-ac flex-shrink-0" />
                          </a>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 课程精华（可选）：思维导图等看课参考材料，有内容才显示 */}
                  {course.essence?.trim() && (
                    <section className="py-7 border-b border-bdl">
                      <h2 className="text-xl font-bold text-tx font-serif mb-3 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-ac" />
                        课程精华
                      </h2>
                      <article className="bg-bgs/40 rounded-ds-md px-5 py-4">
                        <MarkdownRenderer content={course.essence} />
                      </article>
                    </section>
                  )}

                  <CourseQuestionsPanel course={course} />

                  {/* CTA */}
                  <section className="pt-7">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        size="lg"
                        className="flex-1 text-lg py-5 btn-super-cta btn-press"
                        onClick={handleStartLearning}
                        disabled={!course.meeting_url}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        观看课程
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="flex-1 text-lg py-5 btn-press"
                        onClick={handleBack}
                      >
                        浏览更多课程
                      </Button>
                    </div>

                    {course.meeting_url && (
                      <>
                        <p className="mt-3 text-sm text-txt text-center">
                          点击观看课程进入腾讯会议
                        </p>
                        <div className="mt-5 p-4 bg-bgs rounded-md border border-bdl">
                          <p className="text-sm text-txs leading-relaxed">
                            💡 <strong className="text-tx">温馨提示：</strong>点击【观看课程】将跳转至腾讯会议申请页面，申请回放时<strong className="text-ac">务必备注自己的群名称</strong>，否则申请不予通过
                          </p>
                        </div>
                      </>
                    )}
                  </section>

                </div>
              </div>
            </div>

            {/* Right: Sidebar - Desktop（仅 Free；教师AI课/教学通识课改用左侧全量目录） */}
            {!isProCourse && !isPlusCourse && siblingCourses.length > 0 && (
              <aside className="hidden lg:block w-72 flex-shrink-0">
                <div className="sticky top-24 bg-bc rounded-lg border border-bd shadow-ds-elegant overflow-hidden">
                  {/* Sidebar Header */}
                  <div className="px-4 py-3 border-b border-bdl bg-warm/30">
                    <h3 className="font-bold text-tx text-sm flex items-center gap-2">
                      <List className="w-4 h-4 text-ac" />
                      {courseCollectionLabel}
                    </h3>
                    <p className="text-xs text-txs mt-1">共 {siblingCourses.length} 节课程</p>
                  </div>

                  {/* Course List */}
                  <div className="max-h-[calc(100vh-160px)] overflow-y-auto">
                    {siblingCourses.map((sibling, index) => {
                      const isCurrent = sibling.id === id;
                      const progress = getProgress(sibling.id);
                      const status = getStatus(sibling.id);

                      return (
                        <button
                          key={sibling.id}
                          onClick={() => handleNavigateToCourse(sibling.id)}
                          className={cn(
                            "w-full text-left px-4 py-3 border-b border-bdl/50 transition-all",
                            "hover:bg-warm/50",
                            isCurrent && "bg-acl border-l-[3px] border-l-ac"
                          )}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="flex-shrink-0 mt-0.5">
                              {isCurrent ? (
                                <PlayCircle className="w-5 h-5 text-ac" />
                              ) : status === 'completed' ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                              ) : (
                                <span className={cn(
                                  "inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold",
                                  progress > 0 ? "bg-ac/10 text-ac" : "bg-bgs text-txs"
                                )}>
                                  {index + 1}
                                </span>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm leading-snug",
                                isCurrent ? "text-ac font-semibold" : "text-tx"
                              )}>
                                {sibling.title}
                              </p>
                              {progress > 0 && progress < 100 && (
                                <div className="mt-1.5 h-1 bg-bgs rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-ac rounded-full transition-all"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              )}
                              {status === 'completed' && !isCurrent && (
                                <p className="text-xs text-green-500 mt-0.5">已完成</p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </aside>
            )}
          </div>

          {/* 教师AI课：移动端 / 平板端目录抽屉 */}
          {hasTeacherAiCatalog && (
            <Sheet open={mobileTocOpen} onOpenChange={setMobileTocOpen}>
              <SheetContent side="left" className="w-72 p-0">
                <div className="flex flex-col h-full">
                  <div className="px-4 py-3 border-b border-bdl bg-warm/30">
                    <SheetTitle className="text-sm font-bold text-tx">教师AI课目录</SheetTitle>
                    <SheetDescription className="sr-only">教师AI课全部系列与单课导航</SheetDescription>
                  </div>
                  <TeacherAiCatalogToc
                    categories={teacherAiCatalog.categories}
                    coursesByCategory={teacherAiCatalog.coursesByCategory}
                    currentCourseId={course.id}
                    onSelect={(cid) => {
                      handleNavigateToCourse(cid);
                      setMobileTocOpen(false);
                    }}
                    learningRecords={learningRecords}
                    className="flex-1"
                  />
                </div>
              </SheetContent>
            </Sheet>
          )}

          {/* 教学通识课：移动端 / 平板端目录抽屉 */}
          {hasPlusCatalog && (
            <Sheet open={mobileTocOpen} onOpenChange={setMobileTocOpen}>
              <SheetContent side="left" className="w-72 p-0">
                <div className="flex flex-col h-full">
                  <div className="px-4 py-3 border-b border-bdl bg-warm/30">
                    <SheetTitle className="text-sm font-bold text-tx">教学通识课目录</SheetTitle>
                    <SheetDescription className="sr-only">教学通识课全部篇章、模块与单课导航</SheetDescription>
                  </div>
                  <PlusCatalogToc
                    tracks={plusTracks}
                    courses={plusAllCourses}
                    currentCourseId={course.id}
                    onSelect={(cid) => {
                      handleNavigateToCourse(cid);
                      setMobileTocOpen(false);
                    }}
                    learningRecords={learningRecords}
                    className="flex-1"
                  />
                </div>
              </SheetContent>
            </Sheet>
          )}

          {/* Free 或全量目录暂不可用时：复用当前系列 / 模块课程数据兜底 */}
          {!hasTeacherAiCatalog && !hasPlusCatalog && (
            <Sheet open={mobileTocOpen} onOpenChange={setMobileTocOpen}>
              <SheetContent side="left" className="w-72 p-0">
                <div className="flex flex-col h-full">
                  <div className="px-4 py-3 border-b border-bdl bg-warm/30">
                    <SheetTitle className="text-sm font-bold text-tx">{courseCollectionLabel}</SheetTitle>
                    <SheetDescription className="sr-only">当前系列全部课程导航</SheetDescription>
                    <p className="text-xs text-txs mt-1">共 {siblingCourses.length} 节课程</p>
                  </div>
                  <div className="flex-1 overflow-y-auto overscroll-contain p-2">
                    {siblingCourses.map((sibling, index) => {
                      const isCurrent = sibling.id === id;
                      const progress = getProgress(sibling.id);
                      const status = getStatus(sibling.id);

                      return (
                        <button
                          key={sibling.id}
                          type="button"
                          onClick={() => {
                            handleNavigateToCourse(sibling.id);
                            setMobileTocOpen(false);
                          }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-left transition-colors',
                            isCurrent ? 'bg-acl text-ac font-semibold border-l-2 border-ac' : 'text-tx hover:bg-warm/60',
                          )}
                        >
                          <span className="flex-shrink-0 w-5 flex items-center justify-center">
                            {isCurrent ? (
                              <PlayCircle className="w-4 h-4 text-ac" />
                            ) : status === 'completed' ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : (
                              <span className={cn('text-xs', progress > 0 ? 'text-ac font-semibold' : 'text-txt')}>
                                {index + 1}
                              </span>
                            )}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm leading-snug">{sibling.title}</span>
                            {progress > 0 && progress < 100 && (
                              <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-bgs">
                                <span className="block h-full rounded-full bg-ac" style={{ width: `${progress}%` }} />
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </main>

      {/* Mobile: 详情页专属固定课程控制栏，替代全局五标签导航 */}
      <nav
        aria-label="课程导航"
        data-testid="mobile-course-navigation"
        className="fixed inset-x-0 bottom-0 z-40 pb-safe md:hidden"
      >
        <div className="absolute inset-0 bg-bc/95 backdrop-blur-xl border-t border-bd shadow-[0_-4px_20px_rgba(0,0,0,0.10)]" />
        <div className="relative h-16 px-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMobileTocOpen(true)}
            className="h-11 min-w-16 px-3 inline-flex flex-col items-center justify-center gap-0.5 rounded-xl text-ac hover:bg-acl active:scale-95 transition-all"
            aria-label="打开课程目录"
          >
            <List className="w-5 h-5" />
            <span className="text-[11px] font-semibold">目录</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => prevCourse && handleNavigateToCourse(prevCourse.id)}
              disabled={!prevCourse}
              className={cn(
                'h-11 px-3.5 inline-flex items-center gap-1 rounded-xl text-sm font-semibold transition-all',
                prevCourse ? 'text-tx bg-bgs hover:bg-warm active:scale-95' : 'text-txs/40 bg-bgs/60 cursor-not-allowed',
              )}
              aria-label={prevCourse ? `上一节：${prevCourse.title}` : '已是第一节'}
            >
              <ChevronLeft className="w-4 h-4" />
              上一节
            </button>
            <button
              type="button"
              onClick={() => nextCourse && handleNavigateToCourse(nextCourse.id)}
              disabled={!nextCourse}
              className={cn(
                'h-11 px-3.5 inline-flex items-center gap-1 rounded-xl text-sm font-semibold transition-all',
                nextCourse ? 'text-white bg-ac hover:bg-ac/90 active:scale-95' : 'text-txs/40 bg-bgs/60 cursor-not-allowed',
              )}
              aria-label={nextCourse ? `下一节：${nextCourse.title}` : '已是最后一节'}
            >
              下一节
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <Footer />
      <CourseConfirmDialog open={showConfirmDialog} onConfirm={handleConfirmStart} />
      <CourseCompletionDialog
        open={completionOpen}
        onOpenChange={setCompletionOpen}
        courseTitle={course.title}
        achievement={completionAchievement}
        snapshot={completionSnapshot}
      />
    </div>
    </>
  );
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function getAttachmentTypeLabel(type: CourseAttachment["file_type"]) {
  const labels: Record<CourseAttachment["file_type"], string> = {
    video: "视频",
    audio: "音频",
    document: "文档",
    image: "图片",
    other: "文件",
  };
  return labels[type] ?? "文件";
}

function AttachmentIcon({ attachment }: { attachment: CourseAttachment }) {
  const className = "w-4 h-4";
  const iconMap = {
    video: <FileVideo className={className} />,
    audio: <FileAudio className={className} />,
    document: <FileText className={className} />,
    image: <FileImage className={className} />,
    other: <File className={className} />,
  } satisfies Record<CourseAttachment["file_type"], ReactNode>;

  return (
    <span className="inline-flex items-center justify-center w-9 h-9 rounded-ds-md bg-bc text-ac border border-bd flex-shrink-0">
      {iconMap[attachment.file_type] ?? iconMap.other}
    </span>
  );
}
