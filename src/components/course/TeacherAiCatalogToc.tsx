import { useEffect, useRef } from 'react';
import { CheckCircle2, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCategoryIcon } from '@/lib/categoryIcons';
import ContentFormatBadges from './ContentFormatBadges';
import type { Course, LearningRecord } from '@/types/types';

interface TeacherAiCatalogTocProps {
  categories: string[];
  coursesByCategory: Record<string, Course[]>;
  currentCourseId: string;
  onSelect: (courseId: string) => void;
  /** 学习记录，用于在目录项显示「已完成 / 进行中」进度（可选）。 */
  learningRecords?: LearningRecord[];
  className?: string;
}

/**
 * 教师AI课全量目录（系列 → 单课）。
 * 桌面端折叠栏与移动端 Sheet 抽屉共用同一份渲染。
 * 当前课程高亮，挂载/切换时自动滚入目录可视区（不影响页面滚动）。
 * 目录项显示学习进度（已完成 / 进行中）与内容形态图标。
 */
export default function TeacherAiCatalogToc({
  categories,
  coursesByCategory,
  currentCourseId,
  onSelect,
  learningRecords,
  className,
}: TeacherAiCatalogTocProps) {
  const currentRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest' });
  }, [currentCourseId]);

  return (
    <div className={cn('overflow-y-auto overscroll-contain', className)}>
      <nav className="p-2">
        {categories.map((category) => {
          const courses = coursesByCategory[category] || [];
          const Icon = getCategoryIcon(category);
          return (
            <div key={category} className="mb-3 last:mb-0">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Icon className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-xs font-bold text-txs flex-1 truncate">{category}</span>
                <span className="text-[10px] text-txt">{courses.length}</span>
              </div>
              <div className="space-y-0.5">
                {courses.map((course, index) => {
                  const isCurrent = course.id === currentCourseId;
                  const record = learningRecords?.find((r) => r.course_id === course.id);
                  const progress = record?.progress ?? 0;
                  const isCompleted = record?.status === 'completed';
                  const isInProgress = !isCompleted && progress > 0 && progress < 100;

                  return (
                    <button
                      key={course.id}
                      type="button"
                      ref={isCurrent ? currentRef : null}
                      onClick={() => onSelect(course.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-2 rounded-md text-left text-sm transition-colors',
                        isCurrent
                          ? 'bg-amber-50 text-amber-700 font-semibold border-l-2 border-amber-500'
                          : 'text-tx hover:bg-warm/60 hover:text-amber-700',
                      )}
                    >
                      <span className="flex-shrink-0 w-5 flex items-center justify-center">
                        {isCurrent ? (
                          <PlayCircle className="w-4 h-4 text-amber-600" />
                        ) : isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <span
                            className={cn(
                              'text-xs',
                              isInProgress ? 'text-amber-600 font-semibold' : 'text-txt',
                            )}
                          >
                            {index + 1}
                          </span>
                        )}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate leading-snug">{course.title}</span>
                          {!isCurrent && (
                            <ContentFormatBadges course={course} compact className="flex-shrink-0 opacity-70" />
                          )}
                        </span>
                        {isInProgress && (
                          <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-bgs">
                            <span
                              className="block h-full rounded-full bg-amber-500 transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
