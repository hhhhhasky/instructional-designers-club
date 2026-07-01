import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, BookOpen, ChevronRight, Clock } from 'lucide-react';
import { getCategoryIcon } from '@/lib/categoryIcons';
import ContentFormatBadges from '@/components/course/ContentFormatBadges';
import Header from '@/components/layout/Header';
import Footer from '@/components/common/Footer';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import PageMeta from '@/components/common/PageMeta';
import UpgradePopup from '@/components/common/UpgradePopup';
import { useAuth } from '@/contexts/AuthContext';
import { getCourseCatalogSnapshot, getCourseDetailSnapshot } from '@/db/api';
import { canAccessCourse } from '@/lib/access-control';
import { cn } from '@/lib/utils';
import type { Course } from '@/types/types';

export default function TeacherAiCoursesPage() {
  const navigate = useNavigate();
  const { user, accessLevel } = useAuth();
  const [categories, setCategories] = useState<string[]>([]);
  const [coursesByCategory, setCoursesByCategory] = useState<Record<string, Course[]>>({});
  const [categoryTags, setCategoryTags] = useState<Record<string, {
    applicable_audience: string[];
    applicable_scenarios: string[];
    content_types: string[];
  }>>({});
  const [isNavigating, setIsNavigating] = useState(false);
  const [clickedCourseId, setClickedCourseId] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const catalog = await getCourseCatalogSnapshot();
        const coursesData = catalog.pro_courses;
        const filteredCategories = catalog.pro_categories;
        const grouped: Record<string, Course[]> = {};
        filteredCategories.forEach((category) => {
          grouped[category] = coursesData.filter((course) => course.category === category);
        });

        setCategories(filteredCategories);
        setCoursesByCategory(grouped);
        setCategoryTags(catalog.pro_category_tags);
      } catch (err) {
        console.error('加载教师 AI 课失败:', err);
        setError('加载教师 AI 课失败，请刷新页面重试');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleCourseClick = (course: Course) => {
    if (isNavigating) return;

    if (!canAccessCourse(accessLevel, course.membership_type)) {
      if (!user) {
        navigate('/login', { state: { from: `/courses/${course.id}` } });
        return;
      }
      setShowUpgrade(true);
      return;
    }

    setClickedCourseId(course.id);
    setIsNavigating(true);
    setTimeout(() => navigate(`/courses/${course.id}`), 200);
  };

  return (
    <>
      <PageMeta
        title="教师AI课"
        description="教师 AI 课 Pro 专属学习页，系统学习 AI 科普、AI 工具测评和 ClaudeCode 教程，让 AI 成为教学设计协作伙伴。"
        canonicalPath="/teacher-ai-courses"
        keywords="教师AI课,AI教学课程,Pro课程,ClaudeCode教程,AI工具测评"
      />
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        {isNavigating && <LoadingOverlay message="正在加载课程..." />}
        <main className="flex-1 pt-20 pb-12">
          <section className="relative overflow-hidden border-b border-bdl bg-[radial-gradient(circle_at_18%_12%,rgba(245,158,11,0.16),transparent_30%),radial-gradient(circle_at_82%_0%,rgba(42,122,110,0.12),transparent_34%),var(--bg)] px-4 py-12 md:py-16">
            <div className="max-w-7xl mx-auto">
              <div className="max-w-3xl">
                <Badge className="mb-4 bg-bc/80 text-amber-700 border border-amber-500/25 rounded-full px-3 py-1">
                  Pro 专属
                </Badge>
                <h1 className="text-3xl md:text-5xl font-ds-black text-tx leading-tight" style={{ fontFamily: 'var(--fd)' }}>
                  教师AI课
                </h1>
                <p className="mt-4 text-base md:text-lg text-txs max-w-2xl">
                  在教学通识课的基础上，用 AI 拓展教学设计的深度和广度：理解 AI、选择工具，并把它接入备课、分析、活动设计和课程开发。
                </p>
              </div>
            </div>
          </section>

          {isLoading && (
            <div className="max-w-7xl mx-auto px-4 py-16 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
              <p className="mt-4 text-txs">正在加载教师 AI 课...</p>
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
            <CourseSeriesList
              categories={categories}
              coursesByCategory={coursesByCategory}
              categoryTags={categoryTags}
              clickedCourseId={clickedCourseId}
              onCourseClick={handleCourseClick}
            />
          )}
        </main>
        <Footer />
        <UpgradePopup open={showUpgrade} onClose={() => setShowUpgrade(false)} requiredLevel="pro" />
      </div>
    </>
  );
}

interface CategoryTagInfo {
  applicable_audience: string[];
  applicable_scenarios: string[];
  content_types: string[];
}

interface CourseSeriesListProps {
  categories: string[];
  coursesByCategory: Record<string, Course[]>;
  categoryTags: Record<string, CategoryTagInfo>;
  clickedCourseId: string | null;
  onCourseClick: (course: Course) => void;
}

function CourseSeriesList({
  categories,
  coursesByCategory,
  categoryTags,
  clickedCourseId,
  onCourseClick,
}: CourseSeriesListProps) {
  // 锚点跳转：URL hash 指向某系列时滚动定位（SPA 下手动处理）
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.replace('#', ''));
    if (!hash) return;
    requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  if (categories.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <BookOpen className="w-12 h-12 text-txt mx-auto mb-3" />
        <p className="text-txs text-lg">暂无教师 AI 课系列</p>
      </div>
    );
  }

  const initialMobileValue = [categories[0]];

  return (
    <section className="max-w-7xl mx-auto px-4 py-8 md:py-10 pb-16">
      {/* 桌面端：左侧系列导航 + 右侧各系列单课 */}
      <div className="hidden lg:grid lg:grid-cols-[280px_1fr] gap-6">
        <aside className="self-start sticky top-24 bg-bc border border-bd rounded-lg p-4 shadow-ds-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-txs">系列课导航</p>
            <span className="text-xs text-txt">{categories.length} 个系列</span>
          </div>
          <nav className="space-y-1">
            {categories.map((category) => {
              const count = (coursesByCategory[category] || []).length;
              const Icon = getCategoryIcon(category);
              return (
                <a
                  key={category}
                  href={`#${encodeURIComponent(category)}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-tx hover:bg-amber-50 hover:text-amber-700 transition-colors"
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 truncate">{category}</span>
                  <span className="text-xs text-txs">{count}</span>
                </a>
              );
            })}
          </nav>
        </aside>

        <div className="space-y-6">
          {categories.map((category, index) => {
            const categoryCourses = coursesByCategory[category] || [];
            const Icon = getCategoryIcon(category);
            const tags = categoryTags[category];
            return (
              <section
                key={category}
                id={category}
                className="scroll-mt-28 bg-bc border border-bd rounded-lg p-5 shadow-ds-sm animate-fade-in-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-start gap-3 border-b border-bdl pb-4 mb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-500 flex-shrink-0">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-ds-bold text-tx" style={{ fontFamily: 'var(--fd)' }}>
                        {category}
                      </h2>
                      <Badge variant="outline" className="rounded-full">
                        {categoryCourses.length} 节
                      </Badge>
                    </div>
                    {tags && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {tags.applicable_scenarios.map((s) => (
                          <span key={`s-${s}`} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-teal-100 text-teal-700 border-teal-200">
                            {s}
                          </span>
                        ))}
                        {tags.content_types.map((t) => (
                          <span key={`t-${t}`} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-blue-100 text-blue-700 border-blue-200">
                            {t}
                          </span>
                        ))}
                        {tags.applicable_audience.map((a) => (
                          <span key={`a-${a}`} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-purple-100 text-purple-700 border-purple-200">
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <CourseGrid courses={categoryCourses} clickedCourseId={clickedCourseId} onCourseClick={onCourseClick} />
              </section>
            );
          })}
        </div>
      </div>

      {/* 移动端：Accordion 折叠 */}
      <div className="lg:hidden">
        <Accordion type="multiple" defaultValue={initialMobileValue} className="space-y-3">
          {categories.map((category) => {
            const categoryCourses = coursesByCategory[category] || [];
            const Icon = getCategoryIcon(category);
            return (
              <AccordionItem
                key={category}
                value={category}
                className="bg-card border-2 border-bd rounded-xl overflow-hidden shadow-ds-sm"
              >
                <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-warm/50 transition-colors">
                  <div className="flex items-center gap-3 w-full">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-500 flex-shrink-0">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <h3 className="text-base font-ds-bold text-tx truncate" style={{ fontFamily: 'var(--fd)' }}>
                        {category}
                      </h3>
                      <p className="text-xs text-txs">共 {categoryCourses.length} 节课程</p>
                    </div>
                    <Badge variant="outline" className="rounded-full flex-shrink-0">
                      {categoryCourses.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3 pt-1">
                  <CourseList courses={categoryCourses} clickedCourseId={clickedCourseId} onCourseClick={onCourseClick} />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </section>
  );
}

interface CourseCollectionProps {
  courses: Course[];
  clickedCourseId: string | null;
  onCourseClick: (course: Course) => void;
}

function EmptySeriesHint() {
  return (
    <div className="rounded-lg border border-dashed border-bd bg-bgs/40 p-5 text-center">
      <BookOpen className="w-7 h-7 text-txt mx-auto mb-2" />
      <p className="font-semibold text-tx">规划中</p>
      <p className="text-sm text-txs mt-1">该系列课程正在准备中。</p>
    </div>
  );
}

function CourseGrid({ courses, clickedCourseId, onCourseClick }: CourseCollectionProps) {
  if (courses.length === 0) return <EmptySeriesHint />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {courses.map((course, index) => (
        <CourseCard
          key={course.id}
          course={course}
          index={index}
          clickedCourseId={clickedCourseId}
          onCourseClick={onCourseClick}
        />
      ))}
    </div>
  );
}

function CourseList({ courses, clickedCourseId, onCourseClick }: CourseCollectionProps) {
  if (courses.length === 0) return <EmptySeriesHint />;
  return (
    <div className="space-y-2">
      {courses.map((course, index) => (
        <CourseCard
          key={course.id}
          course={course}
          index={index}
          clickedCourseId={clickedCourseId}
          onCourseClick={onCourseClick}
        />
      ))}
    </div>
  );
}

function CourseCard({
  course,
  index,
  clickedCourseId,
  onCourseClick,
}: {
  course: Course;
  index: number;
  clickedCourseId: string | null;
  onCourseClick: (course: Course) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCourseClick(course)}
      onMouseEnter={() => void getCourseDetailSnapshot(course.id)}
      onFocus={() => void getCourseDetailSnapshot(course.id)}
      onTouchStart={() => void getCourseDetailSnapshot(course.id)}
      className={cn(
        'group w-full flex items-center gap-4 p-4 rounded-lg border-2 border-bd text-left',
        'hover:border-amber-500/50 hover:bg-amber-50/40 cursor-pointer transition-all duration-300',
        'hover:shadow-ds-md hover:-translate-y-0.5',
        clickedCourseId === course.id && 'border-amber-500 bg-amber-50/50',
      )}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
        <span className="text-sm font-bold text-amber-700">{index + 1}</span>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-tx mb-1 truncate group-hover:text-amber-700 transition-colors">
          {course.title}
        </h4>
        <div className="flex flex-wrap items-center gap-2 text-xs text-txs">
          {course.duration && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {course.duration}分钟
            </span>
          )}
          {course.level && (
            <Badge variant="outline" className="text-xs px-2 py-0">
              {course.level}
            </Badge>
          )}
          {course.is_trial && (
            <Badge className="bg-green-500 text-white text-xs px-2 py-0">试看</Badge>
          )}
          <ContentFormatBadges course={course} />
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-txs group-hover:text-amber-700 group-hover:translate-x-1 transition-all flex-shrink-0" />
    </button>
  );
}
