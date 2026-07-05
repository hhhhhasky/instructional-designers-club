import { createAsyncCache } from "@/lib/async-cache";
import { getModuleIcon, normalizePlusCourseStructure, type PlusTrackConfig } from "@/lib/plusCourseStructure";
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
  UserNotification,
} from "@/types/types";
import { supabase } from "./supabase";

const COURSE_SUMMARY_COLUMNS =
  'id, title, description, body, essence, instructor, category_id, category, level, duration, credits, status, membership_type, is_trial, image_url, video_url, audio_url, images, plus_lesson_order, plus_representative, meeting_url, sort_order, view_count, created_at, updated_at';

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

export interface ClubStats {
  camps: number;
  courses: number;
  totalMinutes: number;
  members: number;
}

/**
 * 获取俱乐部统计数据
 * @returns 俱乐部统计数据
 */
export async function getClubStats(): Promise<ClubStats> {
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

type LearningData = {
  overview: LearningOverview;
  seriesProgress: SeriesProgress[];
  recentLearning: RecentLearningItem[];
};

// 用户专属学习数据：短缓存 + 写后失效。用于 /learning、/learning-map 和预览卡互跳时复用。
const learningDataCaches = new Map<string, ReturnType<typeof createAsyncCache<LearningData>>>();

function getLearningDataCache(userId: string) {
  const existing = learningDataCaches.get(userId);
  if (existing) return existing;
  const cache = createAsyncCache<LearningData>({
    key: `club.learningData.v1.${userId}`,
    ttlMs: 60 * 1000,
    storage: 'session',
    fetcher: () => _fetchLearningData(userId),
  });
  learningDataCaches.set(userId, cache);
  return cache;
}

export function clearLearningDataCache(userId: string): void {
  learningDataCaches.get(userId)?.clear();
  learningDataCaches.delete(userId);
}

export function clearAllLearningDataCaches(): void {
  for (const cache of learningDataCaches.values()) cache.clear();
  learningDataCaches.clear();
}

/**
 * 获取学员学习主页全部数据（概览 + 系列进度 + 最近学习）
 * 总学分直接读取 profiles.total_credits，课程目录以 courses 表的已发布课程为唯一数据源。
 */
export async function getLearningData(userId: string, options: { fresh?: boolean } = {}): Promise<LearningData> {
  return getLearningDataCache(userId).get(options);
}

async function _fetchLearningData(userId: string): Promise<LearningData> {
  const empty = {
    overview: { totalCourses: 0, totalCredits: 0, completedCourses: 0, inProgressCourses: 0 },
    seriesProgress: [],
    recentLearning: [],
  };

  try {
    const [recordsRes, coursesRes, profileRes] = await Promise.all([
      supabase
        .from('learning_records')
        .select('*')
        .eq('user_id', userId),
      supabase
        .from('courses')
        .select('id, title, credits, category, image_url, membership_type, sort_order, duration')
        .eq('status', 'published')
        .order('sort_order', { ascending: true }),
      supabase
        .from('profiles')
        .select('total_credits')
        .eq('id', userId)
        .maybeSingle(),
    ]);

    if (recordsRes.error) {
      console.error('获取学习记录失败:', recordsRes.error);
      return empty;
    }
    if (coursesRes.error) {
      console.error('获取课程列表失败:', coursesRes.error);
      return empty;
    }
    if (profileRes.error) {
      console.error('获取用户总学分失败:', profileRes.error);
      return empty;
    }

    const records = recordsRes.data || [];
    const courses: Pick<Course, 'id' | 'title' | 'credits' | 'category' | 'image_url' | 'membership_type' | 'sort_order' | 'duration'>[] = coursesRes.data || [];
    const totalCredits = Number(profileRes.data?.total_credits ?? 0);

    // 只统计仍在已发布课程目录中的学习记录，避免归档/删除课程污染主页数字。
    const courseMap = new Map(courses.map(course => [course.id, course]));
    const visibleRecords = records.filter(record => courseMap.has(record.course_id));
    const recordMap = new Map(visibleRecords.map(record => [record.course_id, record]));

    // 1. 概览统计
    const completedRecords = visibleRecords.filter(record => record.status === 'completed');
    const inProgressRecords = visibleRecords.filter(record => record.status === 'in_progress');

    const overview: LearningOverview = {
      totalCourses: courses.length,
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
    const recentLearning: RecentLearningItem[] = visibleRecords
      .filter(record => record.last_watched_at)
      .sort((a, b) => new Date(b.last_watched_at!).getTime() - new Date(a.last_watched_at!).getTime())
      .slice(0, 5)
      .map(r => {
        const course = courseMap.get(r.course_id);
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

export interface HomeCourseBuckets {
  free: Course[];
  plus: Course[];
  pro: Course[];
}

export interface HomePageSnapshot {
  site_content: Record<string, SiteContent> | null;
  member_profiles: MemberProfile[] | null;
  testimonials: Testimonial[] | null;
  faqs: Faq[] | null;
  announcements: Announcement[];
  latest_courses: Course[];
  activities: Activity[];
  home_courses: HomeCourseBuckets;
  stats_counts: ClubStats;
  generated_at: string | null;
  source_updated_at: string | null;
  source: 'rpc' | 'rest-fallback';
}

const HOME_CONTENT_SECTION_KEYS = [
  'hero',
  'introduction',
  'club_values',
  'founder',
  'stats',
  'members',
  'testimonials',
  'faq',
] as const;

const HOME_PAGE_SNAPSHOT_TTL_MS = 2 * 60 * 1000;

function normalizeSiteContentMap(rows: SiteContent[] | null | undefined): Record<string, SiteContent> {
  if (!Array.isArray(rows)) return {};
  return rows.reduce<Record<string, SiteContent>>((acc, row) => {
    if (row?.section_key) acc[row.section_key] = row;
    return acc;
  }, {});
}

function isHomePageSnapshot(value: unknown): value is Omit<HomePageSnapshot, 'source'> {
  return !!value && typeof value === 'object' && 'site_content' in value && 'home_courses' in value;
}

function withDefaultHomeBuckets(value: Partial<HomeCourseBuckets> | null | undefined): HomeCourseBuckets {
  return {
    free: Array.isArray(value?.free) ? value.free : [],
    plus: Array.isArray(value?.plus) ? value.plus : [],
    pro: Array.isArray(value?.pro) ? value.pro : [],
  };
}

function pickSettledData<T>(res: PromiseSettledResult<{ data: unknown; error: unknown }>): T[] | null {
  if (res.status !== 'fulfilled' || res.value.error) return null;
  return Array.isArray(res.value.data) ? (res.value.data as T[]) : [];
}

function normalizeHomeSnapshot(value: unknown, source: HomePageSnapshot['source']): HomePageSnapshot {
  if (!isHomePageSnapshot(value)) {
    throw new Error('Invalid home page snapshot payload');
  }
  const raw = value as Partial<HomePageSnapshot>;
  return {
    site_content:
      raw.site_content && typeof raw.site_content === 'object'
        ? (raw.site_content as Record<string, SiteContent>)
        : null,
    member_profiles: Array.isArray(raw.member_profiles) ? raw.member_profiles : null,
    testimonials: Array.isArray(raw.testimonials) ? raw.testimonials : null,
    faqs: Array.isArray(raw.faqs) ? raw.faqs : null,
    announcements: Array.isArray(raw.announcements) ? raw.announcements : [],
    latest_courses: Array.isArray(raw.latest_courses) ? raw.latest_courses : [],
    activities: Array.isArray(raw.activities) ? raw.activities : [],
    home_courses: withDefaultHomeBuckets(raw.home_courses),
    stats_counts: {
      camps: Number(raw.stats_counts?.camps ?? 0),
      courses: Number(raw.stats_counts?.courses ?? 0),
      totalMinutes: Number(raw.stats_counts?.totalMinutes ?? 0),
      members: Number(raw.stats_counts?.members ?? 0),
    },
    generated_at: typeof raw.generated_at === 'string' ? raw.generated_at : null,
    source_updated_at: typeof raw.source_updated_at === 'string' ? raw.source_updated_at : null,
    source,
  };
}

async function fetchHomePageSnapshotRpc(): Promise<HomePageSnapshot> {
  const { data, error } = await supabase.rpc('home_page_snapshot', {
    latest_course_days: 60,
    announcement_limit: 8,
    latest_course_limit: 4,
    activity_limit: 20,
    home_course_limit: 4,
  });

  if (error) throw error;
  return normalizeHomeSnapshot(data, 'rpc');
}

async function fetchHomePageSnapshotRestFallback(): Promise<HomePageSnapshot> {
  const nowIso = new Date().toISOString();
  const latestSince = Date.now() - 60 * 24 * 60 * 60 * 1000;

  const [
    siteRes,
    memberRes,
    testimonialRes,
    faqRes,
    coursesRes,
    categoriesRes,
    announcementRes,
    activityRes,
  ] = await Promise.allSettled([
    supabase
      .from('site_content')
      .select('*')
      .in('section_key', [...HOME_CONTENT_SECTION_KEYS]),
    supabase
      .from('member_profiles')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('testimonials')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('faqs')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('courses')
      .select(COURSE_SUMMARY_COLUMNS)
      .eq('status', 'published')
      .order('sort_order', { ascending: true }),
    supabase
      .from('course_categories')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(8),
    supabase
      .from('activities')
      .select('*')
      .eq('is_active', true)
      .order('start_time', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true })
      .limit(20),
  ]);

  const siteRows = pickSettledData<SiteContent>(siteRes);
  const siteContent = siteRows ? normalizeSiteContentMap(siteRows) : null;
  const statsData = siteContent?.stats?.data ?? {};
  const memberOverride = statsData.member_count;
  const hasMemberOverride = typeof memberOverride === 'number' && memberOverride >= 0;
  let memberCount = hasMemberOverride ? memberOverride : 0;
  if (!hasMemberOverride) {
    const { data: rpcCount, error } = await supabase.rpc('public_member_count');
    if (!error && typeof rpcCount === 'number') memberCount = rpcCount;
  }

  const courses = pickSettledData<Course>(coursesRes) ?? [];
  const bySortOrder = (a: Course, b: Course) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER);
  const latestCourses = courses
    .filter((course) => course.created_at && new Date(course.created_at).getTime() >= latestSince)
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .slice(0, 4);

  const homeCourses: HomeCourseBuckets = {
    free: courses.filter((course) => course.membership_type === 'free' || course.is_trial).sort(bySortOrder).slice(0, 4),
    plus: courses.filter((course) => course.membership_type === 'plus').sort(bySortOrder).slice(0, 4),
    pro: courses.filter((course) => course.membership_type === 'pro').sort(bySortOrder).slice(0, 4),
  };

  return {
    site_content: siteContent,
    member_profiles: pickSettledData<MemberProfile>(memberRes),
    testimonials: pickSettledData<Testimonial>(testimonialRes),
    faqs: pickSettledData<Faq>(faqRes),
    announcements: pickSettledData<Announcement>(announcementRes) ?? [],
    latest_courses: latestCourses,
    activities: pickSettledData<Activity>(activityRes) ?? [],
    home_courses: homeCourses,
    stats_counts: {
      camps:
        categoriesRes.status === 'fulfilled' && !categoriesRes.value.error
          ? Number((categoriesRes.value as { count?: number | null }).count ?? 0)
          : 0,
      courses: courses.length,
      totalMinutes: courses.reduce((sum, course) => sum + (course.duration || 0), 0),
      members: memberCount,
    },
    generated_at: new Date().toISOString(),
    source_updated_at: null,
    source: 'rest-fallback',
  };
}

const homePageSnapshotCache = createAsyncCache<HomePageSnapshot>({
  key: 'club.homePageSnapshot.v1',
  ttlMs: HOME_PAGE_SNAPSHOT_TTL_MS,
  storage: 'session',
  fetcher: async () => {
    try {
      return await fetchHomePageSnapshotRpc();
    } catch (error) {
      console.warn('home_page_snapshot RPC unavailable; falling back to REST batch:', error);
      return fetchHomePageSnapshotRestFallback();
    }
  },
});

export function clearHomePageSnapshotCache(): void {
  homePageSnapshotCache.clear();
}

export function getCachedHomePageSnapshot(): HomePageSnapshot | null {
  return homePageSnapshotCache.peek();
}

/**
 * Public homepage snapshot with in-flight de-dupe + short TTL cache.
 * Preferred path is one RPC request; if the migration is not applied yet,
 * fall back to a smaller REST batch so the homepage keeps rendering.
 */
export async function getHomePageSnapshot(options: { fresh?: boolean } = {}): Promise<HomePageSnapshot> {
  return homePageSnapshotCache.get(options);
}

export interface CategoryTagInfo {
  applicable_audience: string[];
  applicable_scenarios: string[];
  content_types: string[];
}

export interface CourseCatalogSnapshot {
  plus_courses: Course[];
  plus_tracks: PlusTrackConfig[];
  pro_courses: Course[];
  pro_categories: string[];
  pro_category_tags: Record<string, CategoryTagInfo>;
  generated_at: string | null;
  source_updated_at: string | null;
  source: 'rpc' | 'rest-fallback';
}

interface RawCourseCatalogSnapshot {
  plus_courses?: Course[];
  plus_track_rows?: PlusCourseTrackRow[];
  plus_module_rows?: PlusCourseModuleRow[];
  plus_category_rows?: CourseCategory[];
  pro_courses?: Course[];
  pro_category_rows?: CourseCategory[];
  generated_at?: string;
  source_updated_at?: string;
}

export interface CourseDetailSnapshot {
  course: Course | null;
  catalog: CourseCatalogSnapshot | null;
  sibling_courses: Course[];
  generated_at: string | null;
  source_updated_at: string | null;
  source: 'rpc' | 'rest-fallback';
}

interface RawCourseDetailSnapshot extends RawCourseCatalogSnapshot {
  course?: Course | null;
  sibling_courses?: Course[];
}

function normalizeCategoryTagRows(rows: CourseCategory[]): Record<string, CategoryTagInfo> {
  return rows.reduce<Record<string, CategoryTagInfo>>((acc, category) => {
    acc[category.name] = {
      applicable_audience: category.applicable_audience || [],
      applicable_scenarios: category.applicable_scenarios || [],
      content_types: category.content_types || [],
    };
    return acc;
  }, {});
}

function deriveUsedCategories(courses: Course[], categoryRows: CourseCategory[]): string[] {
  const used = new Set(courses.map((course) => course.category).filter(Boolean) as string[]);
  return categoryRows
    .filter((category) => used.has(category.name))
    .map((category) => category.name);
}

function normalizeCourseCatalogSnapshot(
  value: unknown,
  source: CourseCatalogSnapshot['source'],
): CourseCatalogSnapshot {
  const raw = (value ?? {}) as RawCourseCatalogSnapshot;
  const plusCourses = Array.isArray(raw.plus_courses) ? raw.plus_courses : [];
  const plusTracks = normalizePlusCourseStructure(
    Array.isArray(raw.plus_track_rows) ? raw.plus_track_rows : [],
    Array.isArray(raw.plus_module_rows) ? raw.plus_module_rows : [],
    Array.isArray(raw.plus_category_rows) ? raw.plus_category_rows : [],
  );
  const proCourses = Array.isArray(raw.pro_courses) ? raw.pro_courses : [];
  const proCategoryRows = Array.isArray(raw.pro_category_rows) ? raw.pro_category_rows : [];

  return {
    plus_courses: plusCourses,
    plus_tracks: plusTracks,
    pro_courses: proCourses,
    pro_categories: deriveUsedCategories(proCourses, proCategoryRows),
    pro_category_tags: normalizeCategoryTagRows(proCategoryRows),
    generated_at: typeof raw.generated_at === 'string' ? raw.generated_at : null,
    source_updated_at: typeof raw.source_updated_at === 'string' ? raw.source_updated_at : null,
    source,
  };
}

function getTrackIconKey(track: PlusTrackConfig): string {
  if (track.iconKey) return track.iconKey;
  if (track.id === 'theory') return 'brain';
  if (track.id === 'design-principles') return 'target';
  if (track.id === 'scenarios') return 'compass';
  return track.id;
}

function rehydrateCourseCatalogSnapshot(snapshot: CourseCatalogSnapshot): CourseCatalogSnapshot {
  return {
    ...snapshot,
    plus_tracks: snapshot.plus_tracks.map((track) => ({
      ...track,
      icon: getModuleIcon(getTrackIconKey(track)),
      modules: track.modules.map((module) => ({ ...module })),
    })),
  };
}

async function fetchCourseCatalogSnapshotRpc(): Promise<CourseCatalogSnapshot> {
  const { data, error } = await supabase.rpc('course_catalog_snapshot');
  if (error) throw error;
  return normalizeCourseCatalogSnapshot(data, 'rpc');
}

async function fetchCourseCatalogSnapshotRestFallback(): Promise<CourseCatalogSnapshot> {
  const [
    plusCoursesRes,
    plusTracksRes,
    plusModulesRes,
    plusCategoriesRes,
    proCoursesRes,
    proCategoriesRes,
  ] = await Promise.allSettled([
    supabase
      .from('courses')
      .select(COURSE_SUMMARY_COLUMNS)
      .eq('status', 'published')
      .eq('membership_type', 'plus')
      .order('sort_order', { ascending: true }),
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
    supabase
      .from('courses')
      .select(COURSE_SUMMARY_COLUMNS)
      .eq('status', 'published')
      .eq('membership_type', 'pro')
      .order('sort_order', { ascending: true }),
    supabase
      .from('course_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ]);

  return normalizeCourseCatalogSnapshot(
    {
      plus_courses: pickSettledData<Course>(plusCoursesRes) ?? [],
      plus_track_rows: pickSettledData<PlusCourseTrackRow>(plusTracksRes) ?? [],
      plus_module_rows: pickSettledData<PlusCourseModuleRow>(plusModulesRes) ?? [],
      plus_category_rows: pickSettledData<CourseCategory>(plusCategoriesRes) ?? [],
      pro_courses: pickSettledData<Course>(proCoursesRes) ?? [],
      pro_category_rows: pickSettledData<CourseCategory>(proCategoriesRes) ?? [],
      generated_at: new Date().toISOString(),
    },
    'rest-fallback',
  );
}

const courseCatalogSnapshotCache = createAsyncCache<CourseCatalogSnapshot>({
  key: 'club.courseCatalogSnapshot.v1',
  ttlMs: 10 * 60 * 1000,
  storage: 'session',
  fetcher: async () => {
    try {
      return await fetchCourseCatalogSnapshotRpc();
    } catch (error) {
      console.warn('course_catalog_snapshot RPC unavailable; falling back to REST batch:', error);
      return fetchCourseCatalogSnapshotRestFallback();
    }
  },
});

export function clearCourseCatalogCache(): void {
  courseCatalogSnapshotCache.clear();
}

export async function getCourseCatalogSnapshot(options: { fresh?: boolean } = {}): Promise<CourseCatalogSnapshot> {
  return rehydrateCourseCatalogSnapshot(await courseCatalogSnapshotCache.get(options));
}

function normalizeCourseDetailSnapshot(
  value: unknown,
  source: CourseDetailSnapshot['source'],
): CourseDetailSnapshot {
  const raw = (value ?? {}) as RawCourseDetailSnapshot;
  const course = raw.course ?? null;
  const rawCatalog = normalizeCourseCatalogSnapshot(raw, source);
  const hasCatalog =
    rawCatalog.plus_courses.length > 0 ||
    rawCatalog.plus_tracks.length > 0 ||
    rawCatalog.pro_courses.length > 0 ||
    rawCatalog.pro_categories.length > 0;

  return {
    course,
    catalog: hasCatalog ? rehydrateCourseCatalogSnapshot(rawCatalog) : null,
    sibling_courses: Array.isArray(raw.sibling_courses) ? raw.sibling_courses : [],
    generated_at: typeof raw.generated_at === 'string' ? raw.generated_at : null,
    source_updated_at: typeof raw.source_updated_at === 'string' ? raw.source_updated_at : null,
    source,
  };
}

async function fetchCourseDetailSnapshotRpc(courseId: string): Promise<CourseDetailSnapshot> {
  const { data, error } = await supabase.rpc('course_detail_snapshot', {
    p_course_id: courseId,
  });
  if (error) throw error;
  return normalizeCourseDetailSnapshot(data, 'rpc');
}

async function fetchCourseDetailSnapshotRestFallback(courseId: string): Promise<CourseDetailSnapshot> {
  const { data: course, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .eq('status', 'published')
    .maybeSingle();
  if (error) throw error;
  if (!course) {
    return normalizeCourseDetailSnapshot({ course: null, generated_at: new Date().toISOString() }, 'rest-fallback');
  }

  const courseData = course as Course;
  if (courseData.membership_type === 'plus' || courseData.membership_type === 'pro') {
    const catalog = await getCourseCatalogSnapshot();
    return {
      course: courseData,
      catalog,
      sibling_courses: [],
      generated_at: new Date().toISOString(),
      source_updated_at: catalog.source_updated_at,
      source: 'rest-fallback',
    };
  }

  const siblingCourses = courseData.category
    ? await getCoursesByMembershipAndCategory(courseData.membership_type, courseData.category)
    : [];

  return {
    course: courseData,
    catalog: null,
    sibling_courses: siblingCourses,
    generated_at: new Date().toISOString(),
    source_updated_at: null,
    source: 'rest-fallback',
  };
}

const courseDetailSnapshotCaches = new Map<string, ReturnType<typeof createAsyncCache<CourseDetailSnapshot>>>();

function getCourseDetailCache(courseId: string) {
  const existing = courseDetailSnapshotCaches.get(courseId);
  if (existing) return existing;
  const cache = createAsyncCache<CourseDetailSnapshot>({
    key: `club.courseDetailSnapshot.v1.${courseId}`,
    ttlMs: 5 * 60 * 1000,
    storage: 'session',
    fetcher: async () => {
      try {
        return await fetchCourseDetailSnapshotRpc(courseId);
      } catch (error) {
        console.warn('course_detail_snapshot RPC unavailable; falling back to REST batch:', error);
        return fetchCourseDetailSnapshotRestFallback(courseId);
      }
    },
  });
  courseDetailSnapshotCaches.set(courseId, cache);
  return cache;
}

export function clearCourseDetailCache(courseId?: string): void {
  if (courseId) {
    courseDetailSnapshotCaches.get(courseId)?.clear();
    courseDetailSnapshotCaches.delete(courseId);
    return;
  }
  for (const cache of courseDetailSnapshotCaches.values()) cache.clear();
  courseDetailSnapshotCaches.clear();
}

export async function getCourseDetailSnapshot(
  courseId: string,
  options: { fresh?: boolean } = {},
): Promise<CourseDetailSnapshot> {
  const snapshot = await getCourseDetailCache(courseId).get(options);
  return {
    ...snapshot,
    catalog: snapshot.catalog ? rehydrateCourseCatalogSnapshot(snapshot.catalog) : null,
  };
}

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
async function fetchResources(): Promise<Resource[]> {
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

const resourcesCache = createAsyncCache<Resource[]>({
  key: 'club.resources.v1',
  ttlMs: 10 * 60 * 1000,
  storage: 'session',
  fetcher: fetchResources,
});

export function clearResourcesCache(): void {
  resourcesCache.clear();
}

export async function getResources(options: { fresh?: boolean } = {}): Promise<Resource[]> {
  return resourcesCache.get(options);
}

// ==================== 站内通知 ====================

/**
 * 获取当前用户的通知（最近 30 条，未读优先）
 */
export async function getMyNotifications(): Promise<UserNotification[]> {
  const { data, error } = await supabase.rpc("get_my_notifications");
  if (error) {
    console.error("getMyNotifications error:", error);
    throw error;
  }
  return (Array.isArray(data) ? data : []) as UserNotification[];
}

/**
 * 批量标记通知为已读
 */
export async function markNotificationsRead(ids: string[]): Promise<void> {
  const { error } = await supabase.rpc("mark_notifications_read", { p_ids: ids });
  if (error) {
    console.error("markNotificationsRead error:", error);
    throw error;
  }
}

/**
 * 获取未读通知数量
 */
export async function getUnreadNotificationCount(): Promise<number> {
  const { data, error } = await supabase.rpc("get_unread_notification_count");
  if (error) {
    console.error("getUnreadNotificationCount error:", error);
    return 0; // 静默失败，不阻塞页面
  }
  return (typeof data === "number" ? data : 0);
}
