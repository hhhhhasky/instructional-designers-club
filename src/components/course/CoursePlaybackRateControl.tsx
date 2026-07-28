import { Gauge } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export const COURSE_PLAYBACK_RATES = [1, 1.25, 1.5, 2] as const;
export type CoursePlaybackRate = (typeof COURSE_PLAYBACK_RATES)[number];

const STORAGE_KEY = 'course-playback-rate';

export function isCoursePlaybackRate(value: number): value is CoursePlaybackRate {
  return COURSE_PLAYBACK_RATES.includes(value as CoursePlaybackRate);
}

export function readStoredCoursePlaybackRate(): CoursePlaybackRate {
  if (typeof window === 'undefined') return 1;
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY));
    return isCoursePlaybackRate(value) ? value : 1;
  } catch {
    return 1;
  }
}

export function writeStoredCoursePlaybackRate(rate: CoursePlaybackRate): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(rate));
  } catch {
    // Private browsing or a blocked storage provider should not affect playback.
  }
}

function formatRate(rate: CoursePlaybackRate): string {
  return `${rate === 1 ? '1.0' : rate}×`;
}

export default function CoursePlaybackRateControl({
  value,
  onChange,
  className,
  label = '播放倍速',
}: {
  value: CoursePlaybackRate;
  onChange: (rate: CoursePlaybackRate) => void;
  className?: string;
  label?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-full border border-white/30 bg-black/55 px-3 text-xs font-semibold text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac',
            className,
          )}
          aria-label={`${label}，当前 ${formatRate(value)}`}
        >
          <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
          {formatRate(value)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-32">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={String(value)}
          onValueChange={(next) => {
            const rate = Number(next);
            if (isCoursePlaybackRate(rate)) onChange(rate);
          }}
        >
          {COURSE_PLAYBACK_RATES.map((rate) => (
            <DropdownMenuRadioItem key={rate} value={String(rate)}>
              {formatRate(rate)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
