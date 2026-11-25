import type { Course, CourseType } from '@/types/types';

export function resolveCourseType(course: Pick<Course, 'course_type' | 'has_video'>): CourseType {
  return course.course_type ?? (course.has_video ? 'video' : 'article');
}

export function getVideoCourseDuration(course: Pick<Course, 'course_type' | 'has_video' | 'duration'>): number | null {
  const duration = course.duration ?? 0;
  return resolveCourseType(course) === 'video' && duration > 0 ? duration : null;
}

export function hasV2LessonVideo(resources: readonly { is_active: boolean; mime_type: string | null }[]): boolean {
  return resources.some((resource) => resource.is_active && resource.mime_type?.startsWith('video/'));
}
