import { cn } from '@/lib/utils';
import type { Course, CourseType } from '@/types/types';

export type CourseTypeFilterValue = 'all' | CourseType;

export function resolveCourseType(course: Pick<Course, 'course_type' | 'has_video'>): CourseType {
  return course.course_type ?? (course.has_video ? 'video' : 'article');
}

interface CourseFormatFilterProps {
  courses: Course[];
  value: CourseTypeFilterValue;
  onChange: (value: CourseTypeFilterValue) => void;
}

const OPTIONS: Array<{
  value: CourseTypeFilterValue;
  label: string;
}> = [
  { value: 'all', label: '全部' },
  { value: 'article', label: '图文' },
  { value: 'video', label: '视频' },
];

export default function CourseFormatFilter({ courses, value, onChange }: CourseFormatFilterProps) {
  const counts: Record<CourseTypeFilterValue, number> = {
    all: courses.length,
    article: courses.filter((course) => resolveCourseType(course) === 'article').length,
    video: courses.filter((course) => resolveCourseType(course) === 'video').length,
  };

  return (
    <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-end" aria-label="课程类型筛选">
      <span className="shrink-0 text-xs font-ds-semibold text-txs">内容形式</span>
      <div className="grid min-w-0 flex-1 grid-cols-3 overflow-hidden rounded-ds-sm border border-bd bg-bg sm:flex-none" role="group" aria-label="按课程类型筛选">
          {OPTIONS.map((option) => {
            const selected = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                aria-label={`筛选课程类型：${option.label}`}
                onClick={() => onChange(option.value)}
                className={cn(
                  'flex min-h-10 min-w-[76px] items-center justify-center gap-1.5 border-r border-bd px-3 text-sm font-semibold transition-colors last:border-r-0 focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac focus-visible:ring-inset',
                  selected ? 'bg-acl text-ac' : 'text-txs hover:bg-bgs hover:text-tx',
                )}
              >
                <span>{option.label}</span>
                <span className={cn('text-[11px] tabular-nums', selected ? 'text-ac/70' : 'text-txt')}>
                  {counts[option.value]}
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}
