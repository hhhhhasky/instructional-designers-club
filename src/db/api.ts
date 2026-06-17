import { normalizePlusCourseStructure, type PlusTrackConfig } from "@/lib/plusCourseStructure";
import type {
  Activity,
  Announcement,
  Course,
  CourseCategory,
  Faq,
  LearningOverview,
  MemberProfile,
  MembershipType,
  PlusCourseModuleRow,
  PlusCourseTrackRow,
  RecentLearningItem,
  Resource,
  SeriesCourseItem,
  SeriesProgress,
  SiteContent,
  Testimonial,
} from "@/types/types";
import { supabase } from "./supabase";

/**
 * 获取所有已发布的课程列表
 * @returns 课程列表
 */
export async function getCourses(): Promise<Course[]> {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('status', 'published')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('获取课程列表失败:', error);
      throw error;
    }

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('获取课程列表异常:', error);
    return [];
  }
}

/**
 * 根据ID获取单个课程详情
 * @param courseId 课程ID
 * @returns 课程详情
 */
export async function getCourseById(courseId: string): Promise<Course | null> {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .eq('status', 'published')
      .maybeSingle();

    if (error) {
      console.error('获取课程详情失败:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('获取课程详情异常:', error);
    return null;
  }
}

/**
 * 管理员获取任意状态的课程详情（不限制 status）
 * @param courseId 课程ID
 * @returns 课程详情（含草稿和已归档）
 */
export async function getCourseByIdAdmin(courseId: string): Promise<Course | null> {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .maybeSingle();

    if (error) {
      console.error('getCourseByIdAdmin error:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('获取课程详情异常:', error);
    return null;
  }
}

/**
 * 获取所有课程分类（按 sort_order 排序）
 * @returns 分类列表
 */
export async function getCourseCategories(): Promise<string[]> {
  try {
    // 从 course_categories 表获取分类（标准分类表）
    // 只获取启用的分类，按 sort_order 排序
    const { data, error } = await supabase
      .from('course_categories')
      .select('name')
      .eq('is_active', true)  // 只获取启用的分类
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('获取课程分类失败:', error);
      throw error;
    }

    if (!Array.isArray(data)) {
      return ['全部'];
    }

    // 提取分类名称
    const categories = data.map(item => item.name).filter(Boolean);
    return ['全部', ...categories];
  } catch (error) {
    console.error('获取课程分类异常:', error);
    return ['全部'];
  }
}

/**
 * 根据分类获取课程列表
 * @param category 分类名称
 * @returns 课程列表
 */
export async function getCoursesByCategory(category: string): Promise<Course[]> {
  try {
    let query = supabase
      .from('courses')
      .select('*')
      .eq('status', 'published')
      .order('sort_order', { ascending: true });

    // 如果不是"全部"，则按分类筛选
    if (category !== '全部') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('获取分类课程失败:', error);
      throw error;
    }

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('获取分类课程异常:', error);
    return [];
  }
}

/**
 * 根据会员类型获取课程列表
 * @param membershipType 会员类型
 * @returns 课程列表
 */
export async function getCoursesByMembershipType(membershipType: MembershipType): Promise<Course[]> {
  try {
    let query = supabase
      .from('courses')
      .select('*')
      .eq('status', 'published')
      .order('sort_order', { ascending: true });

    // 根据会员类型筛选
    if (membershipType === 'free') {
      // 免费课程：membership_type = 'free' 或 is_trial = true
      query = query.or('membership_type.eq.free,is_trial.eq.true');
    } else {
      // Plus或Pro课程：直接按membership_type筛选
      query = query.eq('membership_type', membershipType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('获取会员类型课程失败:', error);
      throw error;
    }

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('获取会员类型课程异常:', error);
    return [];
  }
}

/**
 * 获取 Plus 课程篇章 / 分类定义。
 * 数据库表不存在或读取失败时返回空数组，调用方会回退到本地默认配置。
 */
export async function getPlusCourseStructure(): Promise<PlusTrackConfig[]> {
  try {
    const [
      { data: tracks, error: tracksError },
      { data: modules, error: modulesError },
      { data: categories, error: categoriesError },
    ] = await Promise.all([
      supabase
        .from('plus_course_tracks')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true }),
      supabase
        .from('plus_course_modules')
        .select('*')
        .eq('is_active', true)
        .order('track_id', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true }),
      supabase
        .from('course_categories')
        .select('*')
        .eq('is_active', true)
        .not('plus_track_id', 'is', null)
        .order('plus_track_id', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
    ]);

    if (tracksError || modulesError || categoriesError) {
      console.warn('获取 Plus 课程结构失败，将使用本地默认结构:', tracksError || modulesError || categoriesError);
      return [];
    }

    return normalizePlusCourseStructure(
      Array.isArray(tracks) ? tracks as PlusCourseTrackRow[] : [],
      Array.isArray(modules) ? modules as PlusCourseModuleRow[] : [],
      Array.isArray(categories) ? categories as CourseCategory[] : [],
    );
  } catch (error) {
    console.warn('获取 Plus 课程结构异常，将使用本地默认结构:', error);
    return [];
  }
}

/**
 * 根据会员类型和分类获取课程列表
 * @param membershipType 会员类型
 * @param category 分类名称
 * @returns 课程列表
 */
export async function getCoursesByMembershipAndCategory(
  membershipType: MembershipType,
  category: string
): Promise<Course[]> {
  try {
    let query = supabase
      .from('courses')
      .select('*')
      .eq('status', 'published')
      .order('sort_order', { ascending: true });

    // 根据会员类型筛选
    if (membershipType === 'free') {
      query = query.or('membership_type.eq.free,is_trial.eq.true');
    } else {
      query = query.eq('membership_type', membershipType);
    }

    // 如果不是"全部"，则按分类筛选
    if (category !== '全部') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('获取会员类型和分类课程失败:', error);
      throw error;
    }

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('获取会员类型和分类课程异常:', error);
    return [];
  }
}

/**
 * 获取指定会员类型下的所有分类
 * @param membershipType 会员类型
 * @returns 分类列表
 */
/**
 * 获取指定会员类型的课程分类（按 sort_order 排序）
 * @param membershipType 会员类型
 * @returns 分类列表
 */
export async function getCategoriesByMembershipType(membershipType: MembershipType): Promise<string[]> {
  try {
    // 第一步：从 course_categories 表获取所有启用的分类（按 sort_order 排序）
    const { data: allCategories, error: categoriesError } = await supabase
      .from('course_categories')
      .select('name')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (categoriesError) {
      console.error('获取分类列表失败:', categoriesError);
      throw categoriesError;
    }

    if (!Array.isArray(allCategories) || allCategories.length === 0) {
      return ['全部'];
    }

    // 第二步：查询该会员类型下有课程的分类
    let coursesQuery = supabase
      .from('courses')
      .select('category')
      .eq('status', 'published')
      .not('category', 'is', null);

    // 根据会员类型筛选
    if (membershipType === 'free') {
      coursesQuery = coursesQuery.or('membership_type.eq.free,is_trial.eq.true');
    } else {
      coursesQuery = coursesQuery.eq('membership_type', membershipType);
    }

    const { data: coursesData, error: coursesError } = await coursesQuery;

    if (coursesError) {
      console.error('获取会员类型课程失败:', coursesError);
      throw coursesError;
    }

    if (!Array.isArray(coursesData)) {
      return ['全部'];
    }

    // 第三步：提取该会员类型下有课程的分类名称
    const usedCategories = new Set(coursesData.map(item => item.category).filter(Boolean));

    // 第四步：过滤出有课程的分类，保持 sort_order 顺序
    const filteredCategories = allCategories
      .map(item => item.name)
      .filter(name => usedCategories.has(name));

    return ['全部', ...filteredCategories];
  } catch (error) {
    console.error('获取会员类型分类异常:', error);
    return ['全部'];
  }
}

/**
 * 增加课程浏览次数
 * @param courseId 课程ID
 */
export async function incrementCourseViewCount(courseId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('increment_course_view_count', {
      course_id: courseId
    });

    if (error) {
      console.error('增加课程浏览次数失败:', error);
    }
  } catch (error) {
    console.error('增加课程浏览次数异常:', error);
  }
}

/**
 * 验证课程分类数据完整性
 * 检查 courses 表中的分类是否都在 course_categories 表中定义
 * @returns 验证结果
 */
export async function validateCategoryData(): Promise<{
  isValid: boolean;
  missingCategories: string[];
  unusedCategories: string[];
}> {
  try {
    // 获取 course_categories 表中的所有分类
    const { data: categoryData, error: categoryError } = await supabase
      .from('course_categories')
      .select('name');

    if (categoryError) {
      console.error('获取分类表数据失败:', categoryError);
      throw categoryError;
    }

    const definedCategories = new Set(categoryData?.map(item => item.name) || []);

    // 获取 courses 表中实际使用的分类
    const { data: courseData, error: courseError } = await supabase
      .from('courses')
      .select('category')
      .eq('status', 'published');

    if (courseError) {
      console.error('获取课程分类数据失败:', courseError);
      throw courseError;
    }

    const usedCategories = new Set(
      courseData?.map(item => item.category).filter(Boolean) || []
    );

    // 找出在 courses 中使用但未在 course_categories 中定义的分类
    const missingCategories = Array.from(usedCategories).filter(
      cat => !definedCategories.has(cat)
    );

    // 找出在 course_categories 中定义但未在 courses 中使用的分类
    const unusedCategories = Array.from(definedCategories).filter(
      cat => !usedCategories.has(cat)
    );

    return {
      isValid: missingCategories.length === 0,
      missingCategories,
      unusedCategories
    };
  } catch (error) {
    console.error('验证分类数据异常:', error);
    return {
      isValid: false,
      missingCategories: [],
      unusedCategories: []
    };
  }
}

/**
 * 获取俱乐部统计数据
 * @returns 俱乐部统计数据
 */
export async function getClubStats(): Promise<{
  camps: number;
  courses: number;
  totalMinutes: number;
  members: number;
}> {
  try {
    // 并行查询学习营数量和课程数量
    const [categoriesResult, coursesResult] = await Promise.all([
      // 查询 course_categories 表的总行数（学习营数量）
      supabase
        .from('course_categories')
        .select('id', { count: 'exact', head: true }),
      
      // 查询 courses 表的总行数和总时长（课程节数）
      supabase
        .from('courses')
        .select('duration', { count: 'exact' })
        .eq('status', 'published')
    ]);

    // 获取学习营数量
    const camps = categoriesResult.count || 0;

    // 获取课程节数
    const courses = coursesResult.count || 0;

    // 计算累计课程时长（所有课程的duration总和）
    let totalMinutes = 0;
    if (coursesResult.data && Array.isArray(coursesResult.data)) {
      totalMinutes = coursesResult.data.reduce((sum, course) => {
        return sum + (course.duration || 0);
      }, 0);
    }

    // 会员人数：优先取后台 site_content.stats.member_count 手填值；
    // 未配置时回退到 profiles 表真实会员数。
    const members = await getMemberCount();

    return {
      camps,
      courses,
      totalMinutes,
      members
    };
  } catch (error) {
    console.error('获取俱乐部统计数据失败:', error);
    // 返回默认值
    return {
      camps: 0,
      courses: 0,
      totalMinutes: 0,
      members: 0
    };
  }
}

/**
 * 获取课程分类的标签数据（从分类表的字段中获取）
 * @param categoryName 课程分类名称
 * @returns 标签数据对象
 */
export async function getCategoryTags(categoryName: string): Promise<{
  applicable_audience: string[];
  applicable_scenarios: string[];
  content_types: string[];
} | null> {
  try {
    const { data, error } = await supabase
      .from('course_categories')
      .select('applicable_audience, applicable_scenarios, content_types')
      .eq('name', categoryName)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      console.error('获取课程分类标签失败:', error);
      return null;
    }

    return {
      applicable_audience: data.applicable_audience || [],
      applicable_scenarios: data.applicable_scenarios || [],
      content_types: data.content_types || []
    };
  } catch (err) {
    console.error('获取课程分类标签异常:', err);
    return null;
  }
}

/**
 * 批量获取多个课程分类的标签数据
 * @param categoryNames 课程分类名称数组
 * @returns 标签映射对象 { categoryName: tags }
 */
export async function getBatchCategoryTags(
  categoryNames: string[]
): Promise<Record<string, {
  applicable_audience: string[];
  applicable_scenarios: string[];
  content_types: string[];
}>> {
  try {
    const { data, error } = await supabase
      .from('course_categories')
      .select('name, applicable_audience, applicable_scenarios, content_types')
      .in('name', categoryNames)
      .eq('is_active', true);

    if (error || !data) {
      console.error('批量获取课程分类标签失败:', error);
      return {};
    }

    const result: Record<string, {
      applicable_audience: string[];
      applicable_scenarios: string[];
      content_types: string[];
    }> = {};

    data.forEach((category) => {
      result[category.name] = {
        applicable_audience: category.applicable_audience || [],
        applicable_scenarios: category.applicable_scenarios || [],
        content_types: category.content_types || []
      };
    });

    return result;
  } catch (err) {
    console.error('批量获取课程分类标签异常:', err);
    return {};
  }
}

// 学习主页数据缓存（5 分钟 TTL）
const learningCache = new Map<string, { data: Promise<{ overview: LearningOverview; seriesProgress: SeriesProgress[]; recentLearning: RecentLearningItem[] }>; ts: number }>();
const LEARNING_CACHE_TTL = 5 * 60 * 1000;

export function clearLearningDataCache(userId: string): void {
  learningCache.delete(userId);
}

/**
 * 获取学员学习主页全部数据（概览 + 系列进度 + 最近学习）
 * 仅 2 次 Supabase 查询，客户端聚合，带 5 分钟缓存
 */
export async function getLearningData(userId: string): Promise<{
  overview: LearningOverview;
  seriesProgress: SeriesProgress[];
  recentLearning: RecentLearningItem[];
}> {
  const cached = learningCache.get(userId);
  if (cached && Date.now() - cached.ts < LEARNING_CACHE_TTL) {
    return cached.data;
  }

  const dataPromise = _fetchLearningData(userId);
  learningCache.set(userId, { data: dataPromise, ts: Date.now() });
  return dataPromise;
}

async function _fetchLearningData(userId: string): Promise<{
  overview: LearningOverview;
  seriesProgress: SeriesProgress[];
  recentLearning: RecentLearningItem[];
}> {
  const empty = {
    overview: { totalCredits: 0, completedCourses: 0, inProgressCourses: 0 },
    seriesProgress: [],
    recentLearning: [],
  };

  try {
    const [recordsRes, coursesRes] = await Promise.all([
      supabase
        .from('learning_records')
        .select('*')
        .eq('user_id', userId),
      supabase
        .from('courses')
        .select('id, title, credits, category, image_url, membership_type, sort_order, duration')
        .eq('status', 'published')
        .order('sort_order', { ascending: true }),
    ]);

    if (recordsRes.error) {
      console.error('获取学习记录失败:', recordsRes.error);
      return empty;
    }
    if (coursesRes.error) {
      console.error('获取课程列表失败:', coursesRes.error);
      return empty;
    }

    const records = recordsRes.data || [];
    const courses: Pick<Course, 'id' | 'title' | 'credits' | 'category' | 'image_url' | 'membership_type' | 'sort_order' | 'duration'>[] = coursesRes.data || [];

    // courseId -> record 映射
    const recordMap = new Map(records.map(r => [r.course_id, r]));

    // 1. 概览统计
    const completedRecords = records.filter(r => r.status === 'completed');
    const inProgressRecords = records.filter(r => r.status === 'in_progress');
    const completedCourseIds = new Set(completedRecords.map(r => r.course_id));
    const totalCredits = courses
      .filter(c => completedCourseIds.has(c.id))
      .reduce((sum, c) => sum + parseFloat(c.credits || '0'), 0);

    const overview: LearningOverview = {
      totalCredits: Math.round(totalCredits * 10) / 10,
      completedCourses: completedRecords.length,
      inProgressCourses: inProgressRecords.length,
    };

    // 2. 系列进度（按 category 分组）
    const categoryMap = new Map<string, {
      totalCourses: number;
      completedCourses: number;
      inProgressCourses: number;
      courses: SeriesCourseItem[];
    }>();

    for (const course of courses) {
      const cat = course.category || '未分类';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, {
          totalCourses: 0,
          completedCourses: 0,
          inProgressCourses: 0,
          courses: [],
        });
      }
      const series = categoryMap.get(cat)!;
      const record = recordMap.get(course.id);
      const status = record?.status || 'not_started';
      const progress = record?.progress || 0;

      series.totalCourses++;
      if (status === 'completed') series.completedCourses++;
      if (status === 'in_progress') series.inProgressCourses++;

      series.courses.push({
        courseId: course.id,
        title: course.title,
        credits: parseFloat(course.credits || '0'),
        status,
        progress,
        imageUrl: course.image_url,
        membershipType: course.membership_type,
        sortOrder: course.sort_order,
        duration: course.duration,
      });
    }

    const seriesProgress: SeriesProgress[] = Array.from(categoryMap.entries())
      .map(([categoryName, data]) => ({
        categoryName,
        totalCourses: data.totalCourses,
        completedCourses: data.completedCourses,
        inProgressCourses: data.inProgressCourses,
        completionPercentage: data.totalCourses > 0
          ? Math.round((data.completedCourses / data.totalCourses) * 100)
          : 0,
        courses: data.courses.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
      }))
      .sort((a, b) => b.completionPercentage - a.completionPercentage);

    // 3. 最近学习（按 last_watched_at 降序取前 5）
    const recentLearning: RecentLearningItem[] = records
      .filter(r => r.last_watched_at)
      .sort((a, b) => new Date(b.last_watched_at!).getTime() - new Date(a.last_watched_at!).getTime())
      .slice(0, 5)
      .map(r => {
        const course = courses.find(c => c.id === r.course_id);
        return {
          courseId: r.course_id,
          title: course?.title || '未知课程',
          imageUrl: course?.image_url || null,
          category: course?.category || null,
          status: r.status,
          progress: r.progress,
          lastWatchedAt: r.last_watched_at,
          membershipType: course?.membership_type || 'free',
        };
      });

    return { overview, seriesProgress, recentLearning };
  } catch (error) {
    console.error('获取学习数据异常:', error);
    return empty;
  }
}

// ==================== 内容运营后台 · 前台读取（R-P0-02） ====================

/**
 * 会员人数：优先取后台 site_content.stats.member_count 手填值，
 * 否则用公开计数 RPC（public_member_count，SECURITY DEFINER 绕过 profiles RLS，
 * 匿名用户也能拿到真实活跃会员数）。全部失败时回退 0。
 */
export async function getMemberCount(): Promise<number> {
  try {
    const { data } = await supabase
      .from('site_content')
      .select('data')
      .eq('section_key', 'stats')
      .maybeSingle();
    const override = (data?.data as Record<string, unknown> | null)?.member_count;
    if (typeof override === 'number' && override >= 0) return override;

    const { data: rpcCount, error } = await supabase.rpc('public_member_count');
    if (!error && typeof rpcCount === 'number') return rpcCount;
    return 0;
  } catch {
    return 0;
  }
}

/**
 * 读取首页某个单例区块内容（不存在时返回 null，调用方走兜底）
 */
export async function getSiteContent<T = Record<string, unknown>>(
  sectionKey: string
): Promise<SiteContent | null> {
  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('*')
      .eq('section_key', sectionKey)
      .maybeSingle();
    if (error) {
      console.error(`getSiteContent(${sectionKey}) 失败:`, error);
      return null;
    }
    return (data as SiteContent | null) ?? null;
  } catch (error) {
    console.error(`getSiteContent(${sectionKey}) 异常:`, error);
    return null;
  }
}

/**
 * 读取首页会员风采（仅激活项，按 sort_order 排序）。
 * 注意：查询出错时抛出异常（不静默返回空），便于调用方区分
 * 「运营清空」与「表缺失/网络异常」——前者应显示空，后者应走兜底。
 */
export async function getMemberProfiles(): Promise<MemberProfile[]> {
  const { data, error } = await supabase
    .from('member_profiles')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('getMemberProfiles 失败:', error);
    throw error;
  }
  return (data as MemberProfile[]) ?? [];
}

/**
 * 读取 FAQ（仅激活项）。同上，出错抛异常。
 */
export async function getFaqs(): Promise<Faq[]> {
  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('getFaqs 失败:', error);
    throw error;
  }
  return (data as Faq[]) ?? [];
}

/**
 * 读取会员评价（仅激活项）。同上，出错抛异常。
 */
export async function getTestimonials(): Promise<Testimonial[]> {
  const { data, error } = await supabase
    .from('testimonials')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('getTestimonials 失败:', error);
    throw error;
  }
  return (data as Testimonial[]) ?? [];
}

/**
 * 读取最近上架的课程（R-P0-03 动态流自动汇聚）。
 * 按 created_at 倒序取已发布课程，仅保留 withinDays 天内上架的，
 * 避免把陈旧课程当作「上新」展示。created_at 为空的课程自动被过滤。
 */
export async function getLatestCourses(
  limit = 4,
  withinDays = 60
): Promise<Course[]> {
  try {
    const since = new Date(
      Date.now() - withinDays * 24 * 60 * 60 * 1000
    ).toISOString();
    const { data, error } = await supabase
      .from('courses')
      .select('id, title, description, category, image_url, membership_type, created_at, is_trial')
      .eq('status', 'published')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('getLatestCourses 失败:', error);
      return [];
    }
    return (data as Course[]) ?? [];
  } catch (error) {
    console.error('getLatestCourses 异常:', error);
    return [];
  }
}

/**
 * 读取有效动态（已发布、未过期、激活），置顶优先 + 发布时间倒序
 */
export async function getActiveAnnouncements(limit = 20): Promise<Announcement[]> {
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('getActiveAnnouncements 失败:', error);
      return [];
    }
    return (data as Announcement[]) ?? [];
  } catch (error) {
    console.error('getActiveAnnouncements 异常:', error);
    return [];
  }
}

/**
 * 读取近期活动（仅激活项，按开始时间升序）
 */
export async function getActivities(limit = 20): Promise<Activity[]> {
  try {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('start_time', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true })
      .limit(limit);
    if (error) {
      console.error('getActivities 失败:', error);
      return [];
    }
    return (data as Activity[]) ?? [];
  } catch (error) {
    console.error('getActivities 异常:', error);
    return [];
  }
}

/**
 * 读取单个活动详情（按 id，不过滤 is_active，是否可见由页面层判断）。
 * 找不到返回 null；出错同样返回 null（页面统一兜底为「不存在或已下架」）。
 */
export async function getActivityById(id: string): Promise<Activity | null> {
  try {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.error('getActivityById 失败:', error);
      return null;
    }
    return (data as Activity) ?? null;
  } catch (error) {
    console.error('getActivityById 异常:', error);
    return null;
  }
}

/**
 * 读取资源中心文章（仅激活项，按 sort_order 排序）。
 * 出错抛异常，便于调用方区分「运营清空」与「表缺失/网络异常」。
 */
export async function getResources(): Promise<Resource[]> {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('getResources 失败:', error);
    throw error;
  }
  return (data as Resource[]) ?? [];
}
