import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ExternalLink, Clock, Award, User, BookOpen, AlertCircle } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/common/Footer';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import CourseConfirmDialog from '@/components/course/CourseConfirmDialog';
import { getCourseById, incrementCourseViewCount } from '@/db/api';
import type { Course } from '@/types/types';

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

        // 获取课程详情
        const courseData = await getCourseById(id);
        
        if (!courseData) {
          setError('课程不存在');
        } else {
          setCourse(courseData);
          // 增加浏览次数
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

  // 处理返回按钮点击
  const handleBack = () => {
    if (isNavigating) return;
    setIsNavigating(true);
    setTimeout(() => {
      navigate('/courses');
    }, 200);
  };

  // 处理开始学习按钮点击
  const handleStartLearning = () => {
    setShowConfirmDialog(true);
  };

  // 确认后跳转到课程链接
  const handleConfirmStart = () => {
    setShowConfirmDialog(false);
    if (course?.meeting_url) {
      window.open(course.meeting_url, '_blank');
    }
  };

  // 难度级别对应的颜色
  const getLevelColor = (level: string) => {
    switch (level) {
      case '入门':
        return 'bg-gray-500';
      case '初级':
        return 'bg-green-500';
      case '中级':
        return 'bg-blue-500';
      case '高级':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <LoadingOverlay message="正在加载课程详情..." />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center pt-20 px-4">
          <div className="text-center animate-fade-in max-w-md">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-4">
              {error || '课程不存在'}
            </h1>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={handleBack} className="btn-press">
                返回课程中心
              </Button>
              {error && (
                <Button 
                  onClick={() => window.location.reload()} 
                  variant="outline"
                  className="btn-press"
                >
                  刷新页面
                </Button>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      {/* 加载遮罩 */}
      {isNavigating && <LoadingOverlay message="正在返回..." />}
      <main className="flex-1 pt-20 pb-12 page-transition fade-in">
        {/* 返回按钮 */}
        <div className="max-w-5xl mx-auto px-4 py-6 animate-fade-in-down">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="gap-2 btn-press"
          >
            <ArrowLeft className="w-4 h-4" />
            返回课程中心
          </Button>
        </div>

        {/* 课程详情 */}
        <div className="max-w-5xl mx-auto px-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <Card className="overflow-hidden border-2 border-border shadow-[var(--shadow-elegant)]">
            {/* 课程配图 */}
            <div className="relative h-64 md:h-96 overflow-hidden bg-muted">
              <img
                src={course.image_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800'}
                alt={course.title}
                className="w-full h-full object-cover"
              />
              {/* 分类和难度标签 */}
              <div className="absolute top-4 left-4 flex gap-2">
                {course.category && (
                  <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm text-foreground font-semibold text-sm">
                    {course.category}
                  </Badge>
                )}
                {course.level && (
                  <Badge className={`${getLevelColor(course.level)} text-white font-semibold text-sm`}>
                    {course.level}
                  </Badge>
                )}
              </div>
            </div>

            <CardContent className="p-6 md:p-8">
              {/* 课程标题 */}
              <h1 className="text-2xl md:text-3xl xl:text-4xl font-black text-foreground mb-4">
                {course.title}
              </h1>

              {/* 课程统计信息 */}
              <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground mb-6 pb-6 border-b border-border">
                {/* 课程时长 */}
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="font-medium">课程时长：</span>
                  <span>{course.duration || 60}分钟</span>
                </div>
                {/* 课程学分 */}
                {course.credits && (
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-primary" />
                    <span className="font-medium">课程学分：</span>
                    <span>{course.credits}学分</span>
                  </div>
                )}
                {/* 课程讲者 */}
                {course.instructor && (
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    <span className="font-medium">课程讲者：</span>
                    <span>{course.instructor}</span>
                  </div>
                )}
              </div>

              {/* 课程描述 */}
              <div className="mb-8">
                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  课程简介
                </h2>
                <div className="bg-muted/30 rounded-lg p-6">
                  <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">
                    {course.description || '本课程将帮助您深入理解教学设计的核心概念和实践方法，通过系统化的学习，掌握AI时代的教学设计技能。'}
                  </p>
                </div>
              </div>

              {/* 课程亮点 */}
              <div className="mb-8">
                <h2 className="text-xl font-bold text-foreground mb-4">课程亮点</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <span className="text-2xl">💡</span>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">理论与实践结合</h3>
                      <p className="text-sm text-muted-foreground">系统的理论框架配合丰富的实践案例</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <span className="text-2xl">🎯</span>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">即学即用</h3>
                      <p className="text-sm text-muted-foreground">学完即可应用到实际教学场景中</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <span className="text-2xl">👨‍🏫</span>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">专家讲解</h3>
                      <p className="text-sm text-muted-foreground">由经验丰富的教学设计专家授课</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <span className="text-2xl">🌟</span>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">持续更新</h3>
                      <p className="text-sm text-muted-foreground">课程内容持续优化和更新</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 适合人群 */}
              <div className="mb-8">
                <h2 className="text-xl font-bold text-foreground mb-4">适合人群</h2>
                <div className="bg-muted/30 rounded-lg p-6">
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <span className="text-primary text-xl">✓</span>
                      <span className="text-foreground">中小学教师、高校教师</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-primary text-xl">✓</span>
                      <span className="text-foreground">教学设计师、课程开发者</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-primary text-xl">✓</span>
                      <span className="text-foreground">教育培训机构从业者</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-primary text-xl">✓</span>
                      <span className="text-foreground">对教学设计感兴趣的学习者</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* 开始学习按钮 */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  className="flex-1 text-lg py-6 bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 transition-opacity btn-press"
                  onClick={handleStartLearning}
                  disabled={!course.meeting_url}
                >
                  <ExternalLink className="w-5 h-5 mr-2" />
                  {course.meeting_url ? '观看课程' : '暂无课程链接'}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1 text-lg py-6 btn-press"
                  onClick={handleBack}
                >
                  浏览更多课程
                </Button>
              </div>

              {/* 提示信息 */}
              {course.meeting_url && (
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    💡 <strong>温馨提示：</strong>点击【观看课程】按钮将跳转到腾讯会议申请页面，申请回放时【务必备注自己的群名称】，以便做核对，否则申请不予通过
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
      {/* 确认对话框 */}
      <CourseConfirmDialog 
        open={showConfirmDialog} 
        onConfirm={handleConfirmStart}
      />
    </div>
  );
}
