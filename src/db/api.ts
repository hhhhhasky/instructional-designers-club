import { supabase } from "./supabase";
import type { VisitorStatsResult, Course, MembershipType } from "@/types/types";

/**
 * 记录访问并获取统计数据
 * @param visitorUuid 访问者唯一标识
 * @returns 访问统计数据
 */
export async function recordVisit(visitorUuid: string): Promise<VisitorStatsResult> {
  try {
    console.log('[API] 调用 Edge Function 代理，参数:', { visitor_uuid: visitorUuid });
    
    // 使用 Edge Function 代理来避免 CORS 问题
    const { data, error } = await supabase.functions.invoke('record-visit-proxy', {
      body: { visitor_uuid: visitorUuid }
    });

    console.log('[API] Edge Function 调用结果:', { data, error });

    if (error) {
      console.error('[API] 记录访问失败 - Edge Function 错误:', {
        message: error.message,
        context: error.context
      });
      
      // 如果 Edge Function 失败，尝试直接调用 RPC（作为后备方案）
      console.log('[API] 尝试直接调用 RPC 作为后备方案...');
      const { data: rpcData, error: rpcError } = await supabase.rpc('record_visit', {
        p_visitor_uuid: visitorUuid
      });
      
      if (rpcError) {
        console.error('[API] RPC 后备方案也失败:', rpcError);
        throw rpcError;
      }
      
      console.log('[API] RPC 后备方案成功:', rpcData);
      return rpcData as VisitorStatsResult;
    }

    if (!data) {
      console.warn('[API] Edge Function 返回数据为空');
      return {
        unique_visitors: 0,
        total_visits: 0
      };
    }

    console.log('[API] 成功获取访问统计:', data);
    return data as VisitorStatsResult;
  } catch (error) {
    console.error('[API] 记录访问异常:', {
      error,
      message: error instanceof Error ? error.message : '未知错误',
      stack: error instanceof Error ? error.stack : undefined
    });
    // 返回默认值
    return {
      unique_visitors: 0,
      total_visits: 0
    };
  }
}

/**
 * 获取访问统计数据（不记录新访问）
 * @returns 访问统计数据
 */
export async function getVisitorStats(): Promise<VisitorStatsResult> {
  try {
    const { data, error } = await supabase
      .from('visitor_stats')
      .select('visitor_uuid, visit_count');

    if (error) {
      console.error('获取统计数据失败:', error);
      throw error;
    }

    const visitors = Array.isArray(data) ? data : [];
    const uniqueVisitors = visitors.length;
    const totalVisits = visitors.reduce((sum, v) => sum + (v.visit_count || 0), 0);

    return {
      unique_visitors: uniqueVisitors,
      total_visits: totalVisits
    };
  } catch (error) {
    console.error('获取统计数据异常:', error);
    return {
      unique_visitors: 0,
      total_visits: 0
    };
  }
}

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

    // 会员人数固定为500
    const members = 500;

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
      members: 500
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
