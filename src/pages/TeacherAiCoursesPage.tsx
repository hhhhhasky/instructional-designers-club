import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  Award,
  BookOpen,
  Brain,
  ChevronRight,
  Clock,
  Compass,
  Crown,
  Layers,
  Lightbulb,
  Puzzle,
  Rocket,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/common/Footer';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import PageMeta from '@/components/common/PageMeta';
import UpgradePopup from '@/components/common/UpgradePopup';
import { useAuth } from '@/contexts/AuthContext';
import { getBatchCategoryTags, getCategoriesByMembershipType, getCoursesByMembershipType } from '@/db/api';
import { canAccessCourse } from '@/lib/access-control';
import { cn } from '@/lib/utils';
import type { Course } from '@/types/types';

const categoryIconConfig: Record<string, LucideIcon> = {
  教学设计: Lightbulb,
  教学目标: Target,
  认知负荷理论: Brain,
  建构主义: Puzzle,
  应用学习科学: Rocket,
  PBL项目式学习: Compass,
  真实任务设计: Zap,
  罗森海因共读: Award,
  课堂管理: TrendingUp,
  教学评估: TrendingUp,
  教学幻象: Sparkles,
  AI工具应用: Layers,
  教育技术: Layers,
  ClaudeCode教程: Layers,
  AI科普: Brain,
  AI工具测评: Layers,
};

const getCategoryIcon = (category: string): LucideIcon => {
  if (categoryIconConfig[category]) return categoryIconConfig[category];
  for (const key in categoryIconConfig) {
    if (category.includes(key) || key.includes(category)) return categoryIconConfig[key];
  }
  return BookOpen;
};

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
        const [categoriesData, coursesData] = await Promise.all([
          getCategoriesByMembershipType('pro'),
          getCoursesByMembershipType('pro'),
        ]);

        const filteredCategories = categoriesData.filter((cat) => cat !== '全部');
        const grouped: Record<string, Course[]> = {};
        filteredCategories.forEach((category) => {
          grouped[category] = coursesData.filter((course) => course.category === category);
        });

        setCategories(filteredCategories);
        setCoursesByCategory(grouped);
        setCategoryTags(filteredCategories.length > 0 ? await getBatchCategoryTags(filteredCategories) : {});
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

function CourseSeriesList({
  categories,
  coursesByCategory,
  categoryTags,
  clickedCourseId,
  onCourseClick,
}: {
  categories: string[];
  coursesByCategory: Record<string, Course[]>;
  categoryTags: Record<string, {
    applicable_audience: string[];
    applicable_scenarios: string[];
    content_types: string[];
  }>;
  clickedCourseId: string | null;
  onCourseClick: (course: Course) => void;
}) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-16">
      {categories.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-txs text-lg">暂无教师 AI 课系列</p>
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-4 pb-4">
          {categories.map((category, index) => {
            const categoryCourses = coursesByCategory[category] || [];
            const CategoryIcon = getCategoryIcon(category);
            return (
              <AccordionItem
                key={category}
                value={category}
                className="border-2 border-bd rounded-xl overflow-hidden bg-card shadow-ds-sm hover:shadow-ds-md transition-all duration-300 animate-fade-in-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-warm/50 transition-colors">
                  <div className="flex items-center gap-4 w-full">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-500">
                      <CategoryIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-lg font-ds-bold text-tx mb-1" style={{ fontFamily: 'var(--fd)' }}>
                        {category}
                      </h3>
                      {categoryTags[category] && (
                        <div className="hidden md:flex flex-wrap gap-1.5 mb-2">
                          {categoryTags[category].applicable_scenarios.map((scenario) => (
                            <span key={`scenario-${scenario}`} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-teal-100 text-teal-700 border-teal-200">
                              {scenario}
                            </span>
                          ))}
                          {categoryTags[category].content_types.map((type) => (
                            <span key={`type-${type}`} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-blue-100 text-blue-700 border-blue-200">
                              {type}
                            </span>
                          ))}
                          {categoryTags[category].applicable_audience.map((audience) => (
                            <span key={`audience-${audience}`} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-purple-100 text-purple-700 border-purple-200">
                              {audience}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-sm text-txs">共 {categoryCourses.length} 节课程</p>
                    </div>
                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold px-3 py-1 flex-shrink-0">
                      <Crown className="w-3.5 h-3.5 mr-1" />
                      Pro
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <div className="space-y-2 pt-2">
                    {categoryCourses.length === 0 ? (
                      <p className="text-txs text-center py-4">暂无课程</p>
                    ) : (
                      categoryCourses.map((course, courseIndex) => (
                        <button
                          type="button"
                          key={course.id}
                          onClick={() => onCourseClick(course)}
                          className={cn(
                            'group w-full flex items-center gap-4 p-4 rounded-lg border-2 border-bd text-left',
                            'hover:border-amber-500/50 hover:bg-amber-50/40 cursor-pointer transition-all duration-300',
                            'hover:shadow-ds-md hover:-translate-y-0.5',
                            clickedCourseId === course.id && 'border-amber-500 bg-amber-50/50',
                          )}
                        >
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                            <span className="text-sm font-bold text-amber-700">{courseIndex + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-tx mb-1 truncate group-hover:text-amber-700 transition-colors">
                              {course.title}
                            </h4>
                            <div className="flex items-center gap-3 text-xs text-txs">
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
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-txs group-hover:text-amber-700 group-hover:translate-x-1 transition-all" />
                        </button>
                      ))
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
