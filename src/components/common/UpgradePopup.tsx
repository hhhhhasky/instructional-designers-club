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
import { BookOpen } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import type { CourseAccessCode } from '@/lib/course-entitlements';
import { getCoursePurchaseProduct } from '@/lib/course-purchase';

interface UpgradePopupProps {
  open: boolean;
  onClose: () => void;
  requiredLevel: 'plus' | 'pro';
  productCode?: CourseAccessCode | null;
}

function UpgradeBody({ requiredLevel, productCode, onClose }: Omit<UpgradePopupProps, 'open'>) {
  const product = productCode ? getCoursePurchaseProduct(productCode) : getCoursePurchaseProduct(requiredLevel === 'pro' ? 'teacher-ai' : 'teaching-general-v1');
  const courseName = product?.name ?? '当前课程';

  return (
    <div className="space-y-5 p-6">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-3 rounded-ds-full bg-acl flex items-center justify-center">
          <BookOpen className="w-7 h-7 text-ac" />
        </div>
        <h3 className="text-xl font-ds-bold text-tx mb-1">尚未开通{courseName}</h3>
        <p className="text-ds-sm text-txs">购买后按现有流程开通课程权限</p>
      </div>
      {product && <Button
        size="lg"
        className="w-full btn-super-cta !text-white font-ds-bold rounded-ds-lg"
        asChild
      >
        <a href={product.purchaseUrl} target="_blank" rel="noopener noreferrer">购买{courseName}</a>
      </Button>}
      <Button variant="outline" className="w-full rounded-ds-lg" onClick={onClose}>
        返回
      </Button>
    </div>
  );
}

export default function UpgradePopup({ open, onClose, requiredLevel, productCode }: UpgradePopupProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl p-0 pb-safe">
          <SheetTitle className="sr-only">课程购买提示</SheetTitle>
          <UpgradeBody requiredLevel={requiredLevel} productCode={productCode} onClose={onClose} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0" hideCloseButton>
        <DialogTitle className="sr-only">课程购买提示</DialogTitle>
        <DialogDescription className="sr-only">
          当前课程尚未开通。
        </DialogDescription>
        <UpgradeBody requiredLevel={requiredLevel} productCode={productCode} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
