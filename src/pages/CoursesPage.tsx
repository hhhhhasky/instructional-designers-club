import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Clock,
  AlertCircle,
  Crown,
  Sparkles,
  Gift,
  ChevronRight,
  BookOpen,
  Lightbulb,
  Brain,
  Target,
  Rocket,
  Zap,
  Star,
  Compass,
  Puzzle,
  Flame,
  Heart,
  Code,
  Palette,
  Music,
  Camera,
  Globe,
  Users,
  TrendingUp,
  Award,
  Presentation,
  MessageSquare,
  FileText,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Header from '@/components/layout/Header';
import Footer from '@/components/common/Footer';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import MapPreviewCard from '@/components/learning/map/MapPreviewCard';
import PageMeta from '@/components/common/PageMeta';
import { getCoursesByMembershipType, getCategoriesByMembershipType, getBatchCategoryTags } from '@/db/api';
import type { Course, MembershipType } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessCourse } from '@/lib/access-control';
import LockOverlay from '@/components/common/LockOverlay';
import UpgradePopup from '@/components/common/UpgradePopup';

// 课程系列图标配置（只配置图标，颜色由会员类型决定）
const categoryIconConfig: Record<string, LucideIcon> = {
  // 教学设计相关
  '教学设计': Lightbulb,
  '教学设计101Course': Lightbulb,
  '教学目标': Target,
  '教学目标学习营': Target,

  // 学习理论相关
  '认知负荷理论': Brain,
  '认知负荷理论共读': Brain,
  '建构主义': Puzzle,
  '建构主义学习营': Puzzle,
  '应用学习科学': Rocket,
  '应用学习科学共读': Rocket,

  // 教学方法相关
  'PBL项目式学习': Compass,
  '真实任务设计': Zap,
  '真实任务设计实操营': Zap,
  '罗森海因共读': Award,

  // 教学技能相关
  '课堂管理': Users,
  '教学评估': TrendingUp,
  '教学幻象': Flame,

  // 技术应用相关
  'AI工具应用': Code,
  '教育技术': Palette,
  'ClaudeCode教程': Code,
};

// 获取课程系列的图标
const getCategoryIcon = (category: string): LucideIcon => {
  // 精确匹配
  if (categoryIconConfig[category]) {
    return categoryIconConfig[category];
  }

  // 模糊匹配
  for (const key in categoryIconConfig) {
    if (category.includes(key) || key.includes(category)) {
      return categoryIconConfig[key];
    }
  }

  // 返回默认图标
  return BookOpen;
};

// 会员类型配置
const membershipTypes = [
  {
    id: 'pro' as MembershipType,
    name: '教师AI课',
    subtitle: 'Pro 会员专属课程',
    shortName: 'AI课（Pro）',
    mobileShortName: 'Pro',
    icon: Crown,
    color: 'from-amber-500 to-orange-500',
    badgeColor: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
  },
  {
    id: 'plus' as MembershipType,
    name: '教学通识课',
    subtitle: 'Plus 会员专属课程',
    shortName: '通识课（Plus）',
    mobileShortName: 'Plus',
    icon: Sparkles,
    color: 'from-teal-500 to-cyan-500',
    badgeColor: 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white'
  },
  {
    id: 'free' as MembershipType,
    name: '免费课',
    subtitle: '',
    shortName: '免费',
    mobileShortName: '免费',
    icon: Gift,
    color: 'from-green-500 to-emerald-500',
    badgeColor: 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
  }
];

// 场景导航配置
interface ScenarioConfig {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgGradient: string;
  filterType: 'scenario' | 'audience';  // 筛选类型：场景或人群
  filterValue: string;  // 筛选值
}

const scenarioConfigs: ScenarioConfig[] = [
  {
    id: 'open-class',
    name: '我要准备公开课/赛课',
    description: '精选适合公开展示的优质课程',
    icon: Presentation,
    color: 'from-teal-500 to-cyan-500',
    bgGradient: 'bg-gradient-to-br from-teal-50 to-cyan-50',
    filterType: 'scenario',
    filterValue: '公开课'
  },
  {
    id: 'daily-class',
    name: '我要准备日常课',
    description: '日常教学实用技巧与方法',
    icon: FileText,
    color: 'from-indigo-500 to-blue-500',
    bgGradient: 'bg-gradient-to-br from-indigo-50 to-blue-50',
    filterType: 'scenario',
    filterValue: '日常课'
  },
  {
    id: 'innovative-teacher',
    name: '我是创新教育老师',
    description: '探索前沿教育理念与技术',
    icon: Rocket,
    color: 'from-purple-500 to-pink-500',
    bgGradient: 'bg-gradient-to-br from-purple-50 to-pink-50',
    filterType: 'audience',
    filterValue: '创新教育老师'
  },
  {
    id: 'parent',
    name: '我是家长',
    description: '了解孩子学习与成长',
    icon: Users,
    color: 'from-orange-500 to-amber-500',
    bgGradient: 'bg-gradient-to-br from-orange-50 to-amber-50',
    filterType: 'audience',
    filterValue: '家长'
  }
];

export default function CoursesPage() {
  const navigate = useNavigate();
  const { user, accessLevel } = useAuth();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeLevel, setUpgradeLevel] = useState<'plus' | 'pro'>('plus');

  // 一级导航：会员类型（默认显示 Plus 课程）
  const [selectedMembershipType, setSelectedMembershipType] = useState<MembershipType>('plus');

  // 场景筛选状态
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);

  // 课程分类列表
  const [categories, setCategories] = useState<string[]>([]);

  // 所有课程数据（按会员类型）
  const [allCourses, setAllCourses] = useState<Course[]>([]);

  // 按分类分组的课程
  const [coursesByCategory, setCoursesByCategory] = useState<Record<string, Course[]>>({});

  // 课程分类标签数据
  const [categoryTags, setCategoryTags] = useState<Record<string, {
    applicable_audience: string[];
    applicable_scenarios: string[];
    content_types: string[];
  }>>({});

  // UI状态
  const [isNavigating, setIsNavigating] = useState(false);
  const [clickedCourseId, setClickedCourseId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 当会员类型改变时，重新加载分类和课程
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 并行加载分类和课程
        const [categoriesData, coursesData] = await Promise.all([
          getCategoriesByMembershipType(selectedMembershipType),
          getCoursesByMembershipType(selectedMembershipType)
        ]);

        // 过滤掉"全部"选项
        const filteredCategories = categoriesData.filter(cat => cat !== '全部');
        setCategories(filteredCategories);
        setAllCourses(coursesData);

        // 按分类分组课程
        const grouped: Record<string, Course[]> = {};
        filteredCategories.forEach(category => {
          grouped[category] = coursesData.filter(course => course.category === category);
        });
        setCoursesByCategory(grouped);

        // 加载课程分类标签
        if (filteredCategories.length > 0) {
          const tagsData = await getBatchCategoryTags(filteredCategories);
          setCategoryTags(tagsData);
        }
      } catch (err) {
        console.error('加载课程数据失败:', err);
        setError('加载课程数据失败，请刷新页面重试');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedMembershipType]);

  // 当切换会员类型时，如果不是 Plus，自动清除场景筛选
  useEffect(() => {
    if (selectedMembershipType !== 'plus' && selectedScenario) {
      setSelectedScenario(null);
    }
  }, [selectedMembershipType, selectedScenario]);

  // 处理场景筛选
  const handleScenarioClick = (scenarioId: string) => {
    if (selectedScenario === scenarioId) {
      // 如果点击的是当前已选中的场景，则取消筛选
      setSelectedScenario(null);
    } else {
      // 否则选中新场景
      setSelectedScenario(scenarioId);
    }
  };

  // 根据场景筛选分类列表（仅在 Plus 会员时生效）
  const getFilteredCategories = (): string[] => {
    // 如果不是 Plus 会员，或者没有选中场景，返回全部分类
    if (selectedMembershipType !== 'plus' || !selectedScenario) {
      return categories;
    }

    const scenario = scenarioConfigs.find(s => s.id === selectedScenario);
    if (!scenario) {
      return categories;
    }

    // 根据筛选类型选择不同的字段进行筛选
    return categories.filter(category => {
      const tags = categoryTags[category];
      if (!tags) return false;

      // 根据筛选类型选择对应的数组字段
      if (scenario.filterType === 'scenario') {
        // 场景筛选：检查 applicable_scenarios 数组
        return tags.applicable_scenarios.includes(scenario.filterValue);
      } else if (scenario.filterType === 'audience') {
        // 人群筛选：检查 applicable_audience 数组
        return tags.applicable_audience.includes(scenario.filterValue);
      }

      return false;
    });
  };

  const filteredCategories = getFilteredCategories();

  // 获取会员类型配置
  const getMembershipConfig = (type: MembershipType) => {
    return membershipTypes.find(m => m.id === type) || membershipTypes[0];
  };

  // 处理课程点击
  const handleCourseClick = (courseId: string) => {
    if (isNavigating) return;

    // 访问控制检查
    if (selectedMembershipType !== 'free' && !canAccessCourse(accessLevel, selectedMembershipType)) {
      if (!user) {
        navigate('/login', { state: { from: `/courses/${courseId}` } });
        return;
      }
      setUpgradeLevel(selectedMembershipType as 'plus' | 'pro');
      setShowUpgrade(true);
      return;
    }

    setClickedCourseId(courseId);
    setIsNavigating(true);

    setTimeout(() => {
      navigate(`/courses/${courseId}`);
    }, 200);
  };

  return (
    <>
      <PageMeta
        title="课程中心"
        description="探索AI时代的教学设计课程，涵盖教学通识课(Plus)、教师AI课(Pro)和免费课程。系统学习教学设计方法论，提升教学专业能力。"
        canonicalPath="/courses"
        keywords="教学设计课程,教师培训课程,AI教学课程,免费教学课程"
      />
    <div className="min-h-screen bg-cream flex flex-col">
      <Header />
      {/* 加载遮罩 */}
      {isNavigating && <LoadingOverlay message="正在加载课程..." />}
      <main className="flex-1 pt-20 pb-12">
        {/* 页面标题 */}
        <div className="relative gradient-animate py-12 md:py-16 px-4 overflow-hidden">
          <div className="absolute top-10 right-10 w-72 h-72 bg-acl rounded-full blur-3xl pointer-events-none animate-pulse-slow" />
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-acl rounded-full blur-3xl pointer-events-none animate-pulse-slow" />
          <div className="max-w-7xl mx-auto text-center relative">
            <h1 className="text-3xl md:text-4xl xl:text-5xl font-ds-black text-tx mb-4" style={{ fontFamily: 'var(--fd)' }}>
              课程中心
            </h1>
            <p className="text-base md:text-lg text-txs max-w-2xl mx-auto">
              探索AI时代的教学设计，掌握系统化的教学方法论
            </p>
          </div>
        </div>

        {/* 学习地图预览卡（仅登录用户，R-P1-01） */}
        <MapPreviewCard />

        {/* 加载状态 */}
        {isLoading && (
          <div className="max-w-7xl mx-auto px-4 py-16 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ac"></div>
            <p className="mt-4 text-txs">正在加载课程数据...</p>
          </div>
        )}

        {/* 错误状态 */}
        {error && !isLoading && (
          <div className="max-w-7xl mx-auto px-4 py-16">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <p className="text-destructive font-semibold mb-2">{error}</p>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="mt-4"
              >
                刷新页面
              </Button>
            </div>
          </div>
        )}

        {/* 课程内容 */}
        {!isLoading && !error && (
          <>
            {/* 一级导航：会员类型 */}
            <div className="max-w-7xl mx-auto px-4 py-6 border-b border-bd">
              <div className="flex gap-2 md:gap-3 justify-center">
                {membershipTypes.map((type) => {
                  const isActive = selectedMembershipType === type.id;
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setSelectedMembershipType(type.id)}
                      className={cn(
                        "px-3 py-2 md:px-6 md:py-3 rounded-xl text-xs md:text-base font-bold transition-all duration-300",
                        "border-2 flex items-center gap-1.5 md:gap-2 flex-shrink-0",
                        isActive
                          ? `bg-gradient-to-r ${type.color} text-white border-transparent shadow-lg scale-105`
                          : "bg-cream text-tx border-bd hover:border-ac/30 hover:scale-102"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5 md:w-5 md:h-5 shrink-0" />
                      {/* 桌面端：主标题 + 副标题 */}
                      <span className="hidden md:flex flex-col items-start leading-tight">
                        <span className="font-bold">{type.name}</span>
                        {type.subtitle && (
                          <span className={cn(
                            "text-xs font-normal",
                            isActive ? "opacity-80" : "text-txs"
                          )}>{type.subtitle}</span>
                        )}
                      </span>
                      {/* 移动端：短名称 */}
                      <span className="md:hidden whitespace-nowrap">{type.shortName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 场景导航区 - 仅 Plus 会员显示 */}
            {selectedMembershipType === 'plus' && (
              <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="mb-4 text-center">
                  <h2 className="text-xl md:text-2xl font-ds-bold text-tx mb-1" style={{ fontFamily: 'var(--fd)' }}>
                    🎯 快速找到你需要的课程
                  </h2>
                  <p className="text-txs text-xs md:text-sm">
                    根据教学场景，为你精选最合适的课程内容
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  {scenarioConfigs.map((scenario) => {
                    const isActive = selectedScenario === scenario.id;
                    const Icon = scenario.icon;

                    // 统计该场景下有多少个课程系列
                    const scenarioCategoriesCount = categories.filter(category => {
                      const tags = categoryTags[category];
                      if (!tags) return false;

                      // 根据筛选类型选择对应的数组字段
                      if (scenario.filterType === 'scenario') {
                        return tags.applicable_scenarios.includes(scenario.filterValue);
                      } else if (scenario.filterType === 'audience') {
                        return tags.applicable_audience.includes(scenario.filterValue);
                      }

                      return false;
                    }).length;

                    // 如果该场景没有对应的课程，显示"即将推出"
                    const isComingSoon = scenarioCategoriesCount === 0;

                    return (
                      <button
                        key={scenario.id}
                        onClick={() => !isComingSoon && handleScenarioClick(scenario.id)}
                        disabled={isComingSoon}
                        className={cn(
                          "relative group rounded-xl p-4 transition-all duration-300",
                          "border-2 text-left overflow-hidden",
                          isActive
                            ? `border-transparent shadow-lg scale-105 bg-gradient-to-br ${scenario.color}`
                            : isComingSoon
                            ? "border-bd bg-warm/30 cursor-not-allowed opacity-60"
                            : `border-bd ${scenario.bgGradient} hover:border-ac/30 hover:shadow-md hover:scale-102`
                        )}
                      >
                        {/* 背景装饰 */}
                        {!isComingSoon && (
                          <div className={cn(
                            "absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-20 transition-opacity",
                            isActive ? "opacity-40" : "group-hover:opacity-30"
                          )}>
                            <div className={`w-full h-full bg-gradient-to-br ${scenario.color}`}></div>
                          </div>
                        )}

                        {/* 内容 */}
                        <div className="relative z-10">
                          {/* 图标 */}
                          <div className={cn(
                            "w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center mb-2 transition-all",
                            isActive
                              ? "bg-white/20 backdrop-blur-sm"
                              : isComingSoon
                              ? "bg-warm"
                              : `bg-gradient-to-br ${scenario.color}`
                          )}>
                            <Icon className={cn(
                              "w-5 h-5 md:w-6 md:h-6",
                              isActive ? "text-white" : isComingSoon ? "text-txs" : "text-white"
                            )} />
                          </div>

                          {/* 标题 */}
                          <h3 className={cn(
                            "text-sm md:text-base font-ds-bold mb-1",
                            isActive ? "text-white" : isComingSoon ? "text-txs" : "text-tx"
                          )} style={{ fontFamily: 'var(--fd)' }}>
                            {scenario.name}
                          </h3>

                          {/* 描述 */}
                          <p className={cn(
                            "text-xs mb-2 line-clamp-2",
                            isActive ? "text-white/90" : isComingSoon ? "text-txt" : "text-txs"
                          )}>
                            {scenario.description}
                          </p>

                          {/* 课程数量或即将推出标签 */}
                          {isComingSoon ? (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warm text-txs text-xs font-medium">
                              <Rocket className="w-3 h-3" />
                              即将推出
                            </div>
                          ) : (
                            <div className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                              isActive
                                ? "bg-white/20 text-white backdrop-blur-sm"
                                : "bg-acl text-tx"
                            )}>
                              <BookOpen className="w-3 h-3" />
                              {scenarioCategoriesCount} 个系列
                            </div>
                          )}

                          {/* 选中指示器 */}
                          {isActive && (
                            <div className="absolute top-2 right-2">
                              <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
                                <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-green-500 to-emerald-500"></div>
                              </div>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 筛选提示 */}
                {selectedScenario && (
                  <div className="mt-4 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-acl text-ac text-sm font-medium">
                      <span>已筛选：{scenarioConfigs.find(s => s.id === selectedScenario)?.name}</span>
                      <button
                        onClick={() => setSelectedScenario(null)}
                        className="hover:bg-ac/20 rounded-full p-0.5 transition-colors"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 课程系列列表 */}
            <div className="max-w-5xl mx-auto px-4 py-8 pb-16">
              {filteredCategories.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-txs text-lg">
                    {selectedScenario ? '该场景下暂无课程系列' : '暂无课程系列'}
                  </p>
                  {selectedScenario && (
                    <Button
                      onClick={() => setSelectedScenario(null)}
                      variant="outline"
                      className="mt-4"
                    >
                      查看全部课程
                    </Button>
                  )}
                </div>
              ) : (
                <Accordion type="multiple" className="space-y-4 pb-4">
                  {filteredCategories.map((category, index) => {
                    const categoryCourses = coursesByCategory[category] || [];
                    const membershipConfig = getMembershipConfig(selectedMembershipType);
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
                            {/* 系列图标 - 使用会员类型的颜色 */}
                            <div className={cn(
                              "w-12 h-12 rounded-lg flex items-center justify-center",
                              `bg-gradient-to-br ${membershipConfig.color}`
                            )}>
                              <CategoryIcon className="w-6 h-6 text-white" />
                            </div>

                            {/* 系列信息 */}
                            <div className="flex-1 text-left">
                              <h3 className="text-lg font-ds-bold text-tx mb-1" style={{ fontFamily: 'var(--fd)' }}>
                                {category}
                              </h3>

                              {/* 标签列表 - 仅在桌面端显示 */}
                              {categoryTags[category] && (
                                <div className="hidden md:flex flex-wrap gap-1.5 mb-2">
                                  {/* 适用场景标签 */}
                                  {categoryTags[category].applicable_scenarios.map((scenario, index) => (
                                    <span
                                      key={`scenario-${index}`}
                                      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-teal-100 text-teal-700 border-teal-200"
                                    >
                                      {scenario}
                                    </span>
                                  ))}

                                  {/* 内容类型标签 */}
                                  {categoryTags[category].content_types.map((type, index) => (
                                    <span
                                      key={`type-${index}`}
                                      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-blue-100 text-blue-700 border-blue-200"
                                    >
                                      {type}
                                    </span>
                                  ))}

                                  {/* 适用人群标签 */}
                                  {categoryTags[category].applicable_audience.map((audience, index) => (
                                    <span
                                      key={`audience-${index}`}
                                      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-purple-100 text-purple-700 border-purple-200"
                                    >
                                      {audience}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <p className="text-sm text-txs">
                                共 {categoryCourses.length} 节课程
                              </p>
                            </div>

                            {/* 会员标签：移动端简化显示，桌面端显示完整名称 */}
                            <Badge className={cn(membershipConfig.badgeColor, "font-semibold px-3 py-1 flex-shrink-0")}>
                              <span className="hidden md:inline">{membershipConfig.shortName}</span>
                              <span className="md:hidden">{membershipConfig.mobileShortName}</span>
                            </Badge>
                          </div>
                        </AccordionTrigger>

                        <AccordionContent className="px-6 pb-4">
                          <div className="space-y-2 pt-2">
                            {categoryCourses.length === 0 ? (
                              <p className="text-txs text-center py-4">暂无课程</p>
                            ) : (
                              categoryCourses.map((course, courseIndex) => (
                                <div
                                  key={course.id}
                                  onClick={() => handleCourseClick(course.id)}
                                  className={cn(
                                    "group flex items-center gap-4 p-4 rounded-lg border-2 border-bd",
                                    "hover:border-ac/50 hover:bg-warm/30 cursor-pointer transition-all duration-300",
                                    "hover:shadow-ds-md hover:-translate-y-0.5",
                                    clickedCourseId === course.id && "border-ac bg-acl",
                                    "relative"
                                  )}
                                >
                                  {/* 课程序号 */}
                                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-acl flex items-center justify-center">
                                    <span className="text-sm font-bold text-ac">
                                      {courseIndex + 1}
                                    </span>
                                  </div>

                                  {/* 课程信息 */}
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-tx mb-1 truncate group-hover:text-ac transition-colors">
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
                                        <Badge className="bg-green-500 text-white text-xs px-2 py-0">
                                          试看
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  {/* 箭头图标 */}
                                  <ChevronRight className="w-5 h-5 text-txs group-hover:text-ac group-hover:translate-x-1 transition-all" />
                                </div>
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
          </>
        )}
      </main>
      <Footer />
      <UpgradePopup
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        requiredLevel={upgradeLevel}
      />
    </div>
    </>
  );
}
