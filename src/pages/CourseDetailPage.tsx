import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ExternalLink, Clock, Award, User, BookOpen, AlertCircle, ChevronLeft, ChevronRight, List, CheckCircle2, PlayCircle, Eye, Sparkles } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/common/Footer';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import PageMeta from '@/components/common/PageMeta';
import MarkdownRenderer from '@/components/common/MarkdownRenderer';
import CourseConfirmDialog from '@/components/course/CourseConfirmDialog';
import CourseContentStack from '@/components/course/CourseContentStack';
import CourseCompletionDialog from '@/components/course/CourseCompletionDialog';
import { getCourseById, getCourseByIdAdmin, incrementCourseViewCount, getCoursesByMembershipAndCategory, getCoursesByMembershipType, getPlusCourseStructure, getLearningData } from '@/db/api';
import { canAccessCourse, recordCourseVisit, updateLearningProgress, getUserLearningRecords } from '@/lib/access-control';
import {
  buildGamificationSnapshot,
  findAchievementForCourse,
  type Achievement,
  type GamificationSnapshot,
} from '@/lib/gamification';
import { useAuth } from '@/contexts/AuthContext';
import type { Course, LearningRecord } from '@/types/types';
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

  // 同系列课程列表
  const [siblingCourses, setSiblingCourses] = useState<Course[]>([]);
  const [learningRecords, setLearningRecords] = useState<LearningRecord[]>([]);
  const [plusTracks, setPlusTracks] = useState<PlusTrackConfig[]>(PLUS_TRACKS);

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
        setSiblingCourses([]);

        let courseData = await getCourseById(id);

        // 管理员预览：常规 API 找不到时查所有状态
        if (!courseData && profile?.role === 'admin') {
          courseData = await getCourseByIdAdmin(id);
        }

        if (!courseData) {
          setError('课程不存在');
        } else {
          setCourse(courseData);
          await incrementCourseViewCount(id);

          // Plus 课程按新篇章/模块结构加载同模块课程；Pro/Free 保持旧分类目录。
          if (courseData.membership_type === 'plus') {
            const [plusCourses, structureData] = await Promise.all([
              getCoursesByMembershipType('plus'),
              getPlusCourseStructure(),
            ]);
            const moduleSourceCourses = plusCourses.some((item) => item.id === courseData.id)
              ? plusCourses
              : [...plusCourses, courseData];
            const effectiveTracks = getEffectivePlusTracks(
              moduleSourceCourses,
              structureData.length > 0 ? structureData : PLUS_TRACKS,
            );
            setPlusTracks(effectiveTracks);
            const placement = resolvePlusCoursePlacement(courseData, effectiveTracks);
            if (placement) {
              setSiblingCourses(getCoursesForModule(
                moduleSourceCourses,
                placement.resolvedTrackId,
                placement.resolvedModuleId,
                effectiveTracks,
              ));
            }
          } else if (courseData.category && courseData.membership_type) {
            const siblings = await getCoursesByMembershipAndCategory(
              courseData.membership_type,
              courseData.category
            );
            setSiblingCourses(siblings);
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
        recordCourseVisit(user.id, course.id);
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
          <div className="flex gap-5">
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

                {/* Prev/Next Navigation */}
                {siblingCourses.length > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-b border-bdl bg-warm/30">
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

                    <span className="text-xs text-txs px-3">
                      {currentPosition} / {siblingCourses.length}
                    </span>

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

                {/* Mobile: Inline course list below video */}
                {siblingCourses.length > 1 && (
                  <div className="lg:hidden border-b border-bdl">
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

            {/* Right: Sidebar - Desktop */}
            {siblingCourses.length > 0 && (
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
        </div>
      </main>

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
