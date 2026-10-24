import { Check, LockKeyhole } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CourseAccessBadge({ hasAccess, isAdmin = false }: { hasAccess: boolean; isAdmin?: boolean }) {
  const Icon = hasAccess ? Check : LockKeyhole;
  return <span className={cn(
    'inline-flex shrink-0 items-center gap-1 rounded-ds-pill border px-2 py-0.5 text-[11px] font-ds-semibold leading-5',
    hasAccess ? 'border-tl/20 bg-mint-soft text-tl' : 'border-bd bg-bgs text-txs',
  )}>
    <Icon className="h-3 w-3" aria-hidden="true" />
    {isAdmin ? '可直接学习' : hasAccess ? '已开通' : '未开通'}
  </span>;
}
