import { FileText, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CourseType } from '@/types/types';

export default function CourseFormatBadge({ format }: { format: CourseType }) {
  const isVideo = format === 'video';
  const Icon = isVideo ? Video : FileText;

  return (
    <span className={cn(
      'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium leading-4',
      isVideo ? 'bg-acl text-ac' : 'bg-bgs text-txs',
    )}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {isVideo ? '视频' : '图文'}
    </span>
  );
}
