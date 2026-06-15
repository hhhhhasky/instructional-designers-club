import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { Crown, Sparkles } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface UpgradePopupProps {
  open: boolean;
  onClose: () => void;
  requiredLevel: 'plus' | 'pro';
}

function UpgradeBody({ requiredLevel, onClose }: Omit<UpgradePopupProps, 'open'>) {
  const tierName = requiredLevel === 'pro' ? 'Pro 专家版' : 'Plus 会员版';
  const Icon = requiredLevel === 'pro' ? Crown : Sparkles;

  return (
    <div className="space-y-5 p-6">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-3 rounded-ds-full bg-acl flex items-center justify-center">
          <Icon className="w-7 h-7 text-ac" />
        </div>
        <h3 className="text-xl font-ds-bold text-tx mb-1">需要{tierName}权限</h3>
        <p className="text-ds-sm text-txs">升级后即可解锁此课程</p>
      </div>
      <Button
        size="lg"
        className="w-full btn-super-cta !text-white font-ds-bold rounded-ds-lg"
        asChild
      >
        <a
          href="http://b50rtgy70nmgu05j.mikecrm.com/rPZN0Mb"
          target="_blank"
          rel="noopener noreferrer"
        >
          立即升级
        </a>
      </Button>
      <Button variant="outline" className="w-full rounded-ds-lg" onClick={onClose}>
        返回
      </Button>
    </div>
  );
}

export default function UpgradePopup({ open, onClose, requiredLevel }: UpgradePopupProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl p-0 pb-safe">
          <SheetTitle className="sr-only">升级提示</SheetTitle>
          <UpgradeBody requiredLevel={requiredLevel} onClose={onClose} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0" hideCloseButton>
        <DialogTitle className="sr-only">升级提示</DialogTitle>
        <DialogDescription className="sr-only">
          当前课程需要升级会员权限后才能访问。
        </DialogDescription>
        <UpgradeBody requiredLevel={requiredLevel} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
