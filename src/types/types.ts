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

// 用户资料类型
export interface Profile {
  id: string;
  phone: string;
  nickname: string;
  avatar_url: string | null;
  access_level: MembershipType;
  status: 'active' | 'banned';
  created_at: string;
  updated_at: string;
}

// 学习记录类型
export interface LearningRecord {
  id: string;
  user_id: string;
  course_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  watch_count: number;
  progress: number;
  last_watched_at: string | null;
  created_at: string;
  updated_at: string;
}

// 学习概览统计
export interface LearningOverview {
  totalCredits: number;
  completedCourses: number;
  inProgressCourses: number;
}

// 系列课中的单课条目
export interface SeriesCourseItem {
  courseId: string;
  title: string;
  credits: number;
  status: 'not_started' | 'in_progress' | 'completed';
  progress: number;
  imageUrl: string | null;
  membershipType: MembershipType;
  sortOrder: number | null;
}

// 系列课进度
export interface SeriesProgress {
  categoryName: string;
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  completionPercentage: number;
  courses: SeriesCourseItem[];
}

// 最近学习条目
export interface RecentLearningItem {
  courseId: string;
  title: string;
  imageUrl: string | null;
  category: string | null;
  status: 'not_started' | 'in_progress' | 'completed';
  progress: number;
  lastWatchedAt: string | null;
  membershipType: MembershipType;
}
