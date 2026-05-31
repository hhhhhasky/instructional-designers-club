import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LockOverlayProps {
  level: 'plus' | 'pro';
  className?: string;
}

export default function LockOverlay({ level, className }: LockOverlayProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 bg-cream/60 backdrop-blur-[2px] rounded-ds-lg',
        'flex items-center justify-center',
        'transition-opacity duration-300',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-1">
        <Lock className="w-5 h-5 text-txs" />
        <span className="text-xs font-ds-semibold text-txs">
          {level === 'pro' ? 'Pro' : 'Plus'}
        </span>
      </div>
    </div>
  );
}
