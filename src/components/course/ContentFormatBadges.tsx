import { cn } from '@/lib/utils';
import { CONTENT_FORMATS, getCourseContentFormats } from './CourseContentStack';
import type { Course } from '@/types/types';

interface ContentFormatBadgesProps {
  course: Course;
  /** 紧凑模式：只显示形态图标（用于空间受限的目录项）。默认 false，显示「图标 + 文字」小标签。 */
  compact?: boolean;
  className?: string;
}

/**
 * 课程内容形态标识（视频/图文/音频/精华/图集）。
 * 复用 CourseContentStack 的判定逻辑，供列表卡片（带文字）与目录项（纯图标）共用。
 */
export default function ContentFormatBadges({ course, compact = false, className }: ContentFormatBadgesProps) {
  const formats = getCourseContentFormats(course);
  if (formats.length === 0) return null;

  if (compact) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-txs', className)} aria-hidden="true">
        {formats.map((f) => {
          const Icon = CONTENT_FORMATS[f].icon;
          return (
            <span
              key={f}
              className="inline-flex items-center justify-center"
              title={CONTENT_FORMATS[f].label}
            >
              <Icon className="w-3.5 h-3.5" />
            </span>
          );
        })}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {formats.map((f) => {
        const meta = CONTENT_FORMATS[f];
        const Icon = meta.icon;
        return (
          <span
            key={f}
            className="inline-flex items-center gap-1 rounded bg-bgs px-1.5 py-0.5 text-[11px] font-medium text-txs"
          >
            <Icon className="w-3 h-3" />
            {meta.label}
          </span>
        );
      })}
    </span>
  );
}
