// 访问统计表类型
export interface VisitorStats {
  id: number;
  visitor_uuid: string;
  visit_count: number;
  first_visit_at: string;
  last_visit_at: string;
}

// 访问统计返回类型
export interface VisitorStatsResult {
  unique_visitors: number;
  total_visits: number;
}

// 会员类型
export type MembershipType = 'free' | 'plus' | 'pro';

// 课程分类类型
export interface CourseCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  scenarios: string[];  // 关联的场景 ID 数组
  applicable_audience: string[];  // 适用人群
  applicable_scenarios: string[];  // 适用场景
  content_types: string[];  // 内容类型
}

// 课程类型
export interface Course {
  id: string;
  title: string;
  description: string | null;
  instructor: string | null;
  category_id: string | null;
  category: string | null;
  level: 'entry' | 'beginner' | 'intermediate' | 'advanced' | '入门' | '初级' | '中级' | '高级';
  semester: string | null;
  duration: number | null;
  credits: string | null;
  status: 'draft' | 'published' | 'archived';
  membership_type: MembershipType; // 会员类型
  is_trial: boolean; // 是否试看课程
  image_url: string | null;
  video_url: string | null;
  meeting_url: string | null;
  sort_order: number | null;
  view_count: number | null;
  created_at: string | null;
  updated_at: string | null;
}
