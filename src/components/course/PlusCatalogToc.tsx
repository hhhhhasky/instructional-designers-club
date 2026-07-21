import { useEffect, useRef } from 'react';
import { CheckCircle2, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import ContentFormatBadges from './ContentFormatBadges';
import { getCoursesForModule, getModuleIcon, type PlusTrackConfig } from '@/lib/plusCourseStructure';
import type { Course, LearningRecord } from '@/types/types';

interface PlusCatalogTocProps {
  tracks: PlusTrackConfig[];
  courses: Course[];
  currentCourseId: string;
  onSelect: (courseId: string) => void;
  /** 学习记录，用于在目录项显示「已完成 / 进行中」进度（可选）。 */
  learningRecords?: LearningRecord[];
  className?: string;
}

/**
 * 教学通识课（Plus）全量目录：篇章 → 模块 → 单课。
 * 与教师AI课目录（TeacherAiCatalogToc）同一套交互与视觉模式：
 * 桌面折叠栏 + 移动 Sheet 共用渲染；当前课高亮并自动滚入可视区；
 * 目录项显示学习进度（已完成 / 进行中）与内容形态图标。
 * 配色沿用 Plus 的 ac 主色（区别于教师AI课的 amber）。
 */
export default function PlusCatalogToc({
  tracks,
  courses,
  currentCourseId,
  onSelect,
  learningRecords,
  className,
}: PlusCatalogTocProps) {
  const currentRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest' });
  }, [currentCourseId]);

  return (
    <div className={cn('min-h-0 overflow-y-auto overscroll-contain', className)}>
      <nav className="p-2 pb-6">
        {tracks.map((track, trackIdx) => {
          const modulesWithCourses = track.modules
            .map((module) => ({
              module,
              moduleCourses: getCoursesForModule(courses, track.id, module.id, tracks),
            }))
            .filter((entry) => entry.moduleCourses.length > 0);

          if (modulesWithCourses.length === 0) return null;

          return (
            <div
              key={track.id}
              className={cn('mb-3 last:mb-0', trackIdx > 0 && 'mt-2 pt-2 border-t border-bdl')}
            >
              {tracks.length > 1 && (
                <p className="px-2 mb-1 text-[11px] font-bold tracking-wide text-txs/70 truncate">
                  {track.shortTitle || track.title}
                </p>
              )}
              {modulesWithCourses.map(({ module, moduleCourses }) => {
                const Icon = getModuleIcon(module.iconKey || module.id);
                return (
                  <div key={module.id} className="mb-2 last:mb-0">
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <Icon className="w-4 h-4 text-ac flex-shrink-0" />
                      <span className="text-xs font-bold text-txs flex-1 truncate">{module.title}</span>
                      <span className="text-[10px] text-txt">{moduleCourses.length}</span>
                    </div>
                    <div className="space-y-0.5">
                      {moduleCourses.map((course, idx) => {
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
                                ? 'bg-acl text-ac font-semibold border-l-2 border-ac'
                                : 'text-tx hover:bg-warm/60 hover:text-ac',
                            )}
                          >
                            <span className="flex-shrink-0 w-5 flex items-center justify-center">
                              {isCurrent ? (
                                <PlayCircle className="w-4 h-4 text-ac" />
                              ) : isCompleted ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              ) : (
                                <span
                                  className={cn(
                                    'text-xs',
                                    isInProgress ? 'text-ac font-semibold' : 'text-txt',
                                  )}
                                >
                                  {idx + 1}
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
                                    className="block h-full rounded-full bg-ac transition-all"
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
            </div>
          );
        })}
      </nav>
    </div>
  );
}
