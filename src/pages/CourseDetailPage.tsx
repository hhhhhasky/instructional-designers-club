import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ExternalLink, Clock, Award, User, BookOpen, AlertCircle } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/common/Footer';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import CourseConfirmDialog from '@/components/course/CourseConfirmDialog';
import { getCourseById, incrementCourseViewCount } from '@/db/api';
import { canAccessCourse, recordCourseVisit, updateLearningProgress, getUserLearningRecords } from '@/lib/access-control';
import { useAuth } from '@/contexts/AuthContext';
import type { Course } from '@/types/types';

const HIGHLIGHTS = [
  { icon: '💡', title: '理论与实践结合', desc: '系统的理论框架配合丰富的实践案例' },
  { icon: '🎯', title: '即学即用', desc: '学完即可应用到实际教学场景中' },
  { icon: '👨‍🏫', title: '专家讲解', desc: '由经验丰富的教学设计专家授课' },
  { icon: '🌟', title: '持续更新', desc: '课程内容持续优化和更新' },
];

const AUDIENCES = [
  '中小学教师、高校教师',
  '教学设计师、课程开发者',
  '教育培训机构从业者',
  '对教学设计感兴趣的学习者',
];

const LEVEL_STYLE: Record<string, string> = {
  '入门': 'bg-bgs text-txs',
  '初级': 'bg-tll text-tl',
  '中级': 'bg-acl text-ac',
  '高级': 'bg-aml text-am',
};

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, accessLevel } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeLevel, setUpgradeLevel] = useState<'plus' | 'pro'>('plus');
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSyncedProgress = useRef(0);

  const syncProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration || !user || !course) return;

    const progress = Math.round((video.currentTime / video.duration) * 100);
    if (progress <= lastSyncedProgress.current) return;

    lastSyncedProgress.current = progress;
    const status = progress >= 95 ? 'completed' : 'in_progress';
    updateLearningProgress(user.id, course.id, progress, status);
  }, [user, course]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration) return;

    const progress = Math.round((video.currentTime / video.duration) * 100);
    if (progress - lastSyncedProgress.current >= 10 || progress >= 95) {
      syncProgress();
    }
  }, [syncProgress]);

  const handleVideoEnded = useCallback(() => {
    lastSyncedProgress.current = 100;
    if (user && course) {
      updateLearningProgress(user.id, course.id, 100, 'completed');
    }
  }, [user, course]);

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

        const courseData = await getCourseById(id);

        if (!courseData) {
          setError('课程不存在');
        } else {
          setCourse(courseData);
          await incrementCourseViewCount(id);
        }
      } catch (err) {
        console.error('加载课程详情失败:', err);
        setError('加载课程详情失败，请刷新页面重试');
      } finally {
        setIsLoading(false);
      }
    };

    loadCourse();
  }, [id]);

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
        // 用已有进度初始化 lastSyncedProgress，防止从头播放时覆盖更高进度
        getUserLearningRecords(user.id).then(records => {
          const record = records.find(r => r.course_id === course.id);
          if (record && record.progress > lastSyncedProgress.current) {
            lastSyncedProgress.current = record.progress;
          }
        });
      }
    }
  }, [course, user, accessLevel, isLoading, navigate]);

  // 页面离开时同步最终进度
  useEffect(() => {
    return () => { syncProgress(); };
  }, [syncProgress]);

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
                返回课程中心
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

  // 权限不足：显示升级提示页（所有 hooks 之后）
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
              <Button onClick={() => navigate('/courses')} className="btn-press">
                返回课程中心
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

  const handleBack = () => {
    if (isNavigating) return;
    setIsNavigating(true);
    setTimeout(() => navigate('/courses'), 200);
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
    <div className="min-h-screen bg-cream flex flex-col">
      <Header />
      {isNavigating && <LoadingOverlay message="正在返回..." />}

      <main className="flex-1 pt-20 pb-ds-11 page-transition fade-in">
        {/* Back */}
        <div className="max-w-4xl mx-auto px-4 pt-ds-6 animate-fade-in-down">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-ds-sm text-txs hover:text-ac transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            返回课程中心
          </button>
        </div>

        {/* Course Card */}
        <article className="max-w-4xl mx-auto px-4 pt-ds-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="bg-bc rounded-ds-lg border border-bd shadow-ds-elegant overflow-hidden">

            {/* Hero */}
            <div className="relative bg-black">
              {heroContent}
              <div className="absolute top-ds-3 left-ds-3 flex gap-1.5 z-10">
                {course.category && (
                  <Badge variant="secondary" className="bg-bc/90 backdrop-blur-sm text-tx text-ds-xs font-ds-medium rounded-ds-pill">
                    {course.category}
                  </Badge>
                )}
                {course.level && (
                  <Badge className={`${LEVEL_STYLE[course.level] || 'bg-bgs text-txs'} text-ds-xs font-ds-medium rounded-ds-pill`}>
                    {course.level}
                  </Badge>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="p-ds-6 md:p-ds-8">

              {/* Title */}
              <h1 className="text-ds-3xl md:text-ds-4xl font-ds-black text-tx font-serif leading-tight">
                {course.title}
              </h1>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-x-ds-5 gap-y-ds-2 text-ds-sm text-txs mt-ds-5 pb-ds-6 border-b border-bdl">
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
              <section className="pt-ds-7 pb-ds-6 border-b border-bdl">
                <h2 className="text-ds-xl font-ds-bold text-tx font-serif mb-ds-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-ac" />
                  课程简介
                </h2>
                <div className="bg-bgs rounded-ds-md p-ds-5">
                  <p className="text-ds-lg text-tx leading-relaxed whitespace-pre-wrap font-body">
                    {course.description || '本课程将帮助您深入理解教学设计的核心概念和实践方法，通过系统化的学习，掌握AI时代的教学设计技能。'}
                  </p>
                </div>
              </section>

              {/* Highlights */}
              <section className="py-ds-7 border-b border-bdl">
                <h2 className="text-ds-xl font-ds-bold text-tx font-serif mb-ds-4">课程亮点</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-ds-3">
                  {HIGHLIGHTS.map(item => (
                    <div key={item.title} className="flex items-start gap-2.5 p-ds-4 rounded-ds-md bg-bgs">
                      <span className="text-lg flex-shrink-0">{item.icon}</span>
                      <div>
                        <h3 className="text-ds-md font-ds-semibold text-tx">{item.title}</h3>
                        <p className="text-ds-sm text-txs mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Audience */}
              <section className="py-ds-7 border-b border-bdl">
                <h2 className="text-ds-xl font-ds-bold text-tx font-serif mb-ds-4">适合人群</h2>
                <div className="bg-bgs rounded-ds-md p-ds-5">
                  <ul className="space-y-ds-2">
                    {AUDIENCES.map(item => (
                      <li key={item} className="flex items-start gap-2 text-ds-lg text-tx font-body">
                        <span className="text-ac text-ds-md mt-px">✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              {/* CTA */}
              <section className="pt-ds-7">
                <div className="flex flex-col sm:flex-row gap-ds-3">
                  <Button
                    size="lg"
                    className="flex-1 text-ds-lg py-ds-5 btn-super-cta btn-press"
                    onClick={handleStartLearning}
                    disabled={!course.meeting_url}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    观看课程
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="flex-1 text-ds-lg py-ds-5 btn-press"
                    onClick={handleBack}
                  >
                    浏览更多课程
                  </Button>
                </div>

                {course.meeting_url && (
                  <>
                    <p className="mt-ds-3 text-ds-sm text-txt text-center">
                      点击观看课程进入腾讯会议
                    </p>
                    <div className="mt-ds-5 p-ds-4 bg-bgs rounded-ds-md border border-bdl">
                      <p className="text-ds-sm text-txs leading-relaxed">
                        💡 <strong className="text-tx">温馨提示：</strong>点击【观看课程】将跳转至腾讯会议申请页面，申请回放时<strong className="text-ac">务必备注自己的群名称</strong>，否则申请不予通过
                      </p>
                    </div>
                  </>
                )}
              </section>

            </div>
          </div>
        </article>
      </main>

      <Footer />
      <CourseConfirmDialog open={showConfirmDialog} onConfirm={handleConfirmStart} />
    </div>
  );
}
