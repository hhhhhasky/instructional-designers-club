import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, BookOpen, ChevronRight, Clock, GraduationCap } from 'lucide-react';
import { getCategoryIcon } from '@/lib/categoryIcons';
import ContentFormatBadges from '@/components/course/ContentFormatBadges';
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
  const totalCourseCount = categories.reduce(
    (sum, category) => sum + (coursesByCategory[category]?.length ?? 0),
    0,
  );

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
        <main className="course-reading-desk flex-1 pb-12 pt-20">
          <CourseEditorialHero
            kicker="PRO CATALOGUE · 教师 AI 专题刊"
            badge="PRO 专属"
            title="教师 AI 课"
            description="在教学通识课的基础上，用 AI 拓展教学设计的深度和广度：理解 AI、选择工具，并把它接入备课、分析、活动设计和课程开发。"
            audience="建议按系列卷册顺序阅读；需要解决具体问题时，也可以直接从目录定位到对应单课。"
            icon={GraduationCap}
            stats={[
              { label: '系列卷册', value: categories.length },
              { label: '已发布单课', value: totalCourseCount },
            ]}
          />

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
    <CourseEditorialCatalogLayout
      label="系列卷册"
      countLabel={`${categories.length} 卷`}
      toc={categories.map((category, index) => {
        const count = (coursesByCategory[category] || []).length;
        const Icon = getCategoryIcon(category);
        return (
          <a key={category} href={`#${encodeURIComponent(category)}`} className="course-editorial-toc-link">
            <span className="font-mono text-[10px] text-txt">{String(index + 1).padStart(2, '0')}</span>
            <Icon className="h-4 w-4 flex-shrink-0 text-ac" aria-hidden="true" />
            <span className="flex-1 truncate">{category}</span>
            <span className="text-xs text-txt">{count}</span>
          </a>
        );
      })}
      mobile={(
        <Accordion type="multiple" defaultValue={initialMobileValue} className="space-y-3">
          {categories.map((category, index) => {
            const categoryCourses = coursesByCategory[category] || [];
            const Icon = getCategoryIcon(category);
            return (
              <AccordionItem
                key={category}
                value={category}
                className="course-editorial-volume overflow-hidden"
              >
                <AccordionTrigger className="min-h-16 px-4 py-3 hover:bg-[var(--proof-soft)] hover:no-underline">
                  <div className="flex items-center gap-3 w-full">
                    <div className="course-editorial-mark">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <span className="editorial-kicker">VOL. {String(index + 1).padStart(2, '0')}</span>
                      <h3 className="text-base font-ds-bold text-tx truncate" style={{ fontFamily: 'var(--fd)' }}>
                        {category}
                      </h3>
                      <p className="text-xs text-txs">{categoryCourses.length} 节课程</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3 pt-1">
                  <CourseList courses={categoryCourses} clickedCourseId={clickedCourseId} onCourseClick={onCourseClick} />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    >
      {categories.map((category, index) => {
        const categoryCourses = coursesByCategory[category] || [];
        const Icon = getCategoryIcon(category);
        const tags = categoryTags[category];
        return (
          <CourseEditorialVolume
            key={category}
            id={category}
            index={index}
            title={category}
            count={categoryCourses.length}
            icon={Icon}
            tags={tags ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tags.applicable_scenarios.map((tag) => (
                  <span key={`s-${tag}`} className="rounded-ds-sm border border-tl/20 bg-tll px-2 py-0.5 text-xs font-medium text-tl">{tag}</span>
                ))}
                {tags.content_types.map((tag) => (
                  <span key={`t-${tag}`} className="rounded-ds-sm border border-am/20 bg-aml px-2 py-0.5 text-xs font-medium text-am">{tag}</span>
                ))}
                {tags.applicable_audience.map((tag) => (
                  <span key={`a-${tag}`} className="rounded-ds-sm border border-ac/20 bg-acl px-2 py-0.5 text-xs font-medium text-ac">{tag}</span>
                ))}
              </div>
            ) : undefined}
          >
            <CourseGrid courses={categoryCourses} clickedCourseId={clickedCourseId} onCourseClick={onCourseClick} />
          </CourseEditorialVolume>
        );
      })}
    </CourseEditorialCatalogLayout>
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
      aria-label={`打开课程：${course.title}`}
      className={cn(
        'course-editorial-entry group cursor-pointer',
        clickedCourseId === course.id && 'border-ac bg-acl/40',
      )}
    >
      <span className="course-editorial-index">{String(index + 1).padStart(2, '0')}</span>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-tx mb-1 truncate group-hover:text-ac transition-colors">
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
      <ChevronRight className="w-5 h-5 text-txs group-hover:text-ac group-hover:translate-x-1 transition-all flex-shrink-0" aria-hidden="true" />
    </button>
  );
}
