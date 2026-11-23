import { Button } from '@/components/ui/button';
import CoursePurchaseButton from '@/components/course/CoursePurchaseButton';
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
import { getCoursePurchaseProduct, TEACHING_GENERAL_2025_CATALOG } from '@/lib/course-purchase';

interface UpgradePopupProps {
  open: boolean;
  onClose: () => void;
  requiredLevel: 'plus' | 'pro';
  productCode?: CourseAccessCode | null;
}

function UpgradeBody({ requiredLevel, productCode, onClose }: Omit<UpgradePopupProps, 'open'>) {
  const code = productCode ?? (requiredLevel === 'pro' ? 'teacher-ai' : TEACHING_GENERAL_2025_CATALOG.code);
  const product = getCoursePurchaseProduct(code);
  const courseName = product?.name ?? (code === TEACHING_GENERAL_2025_CATALOG.code ? TEACHING_GENERAL_2025_CATALOG.name : '当前课程');

  return (
    <div className="space-y-5 p-6">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-3 rounded-ds-full bg-acl flex items-center justify-center">
          <BookOpen className="w-7 h-7 text-ac" />
        </div>
        <h3 className="text-lg font-semibold text-tx mb-1">尚未开通{courseName}</h3>
        <p className="text-ds-sm text-txs">{product ? '下单后，请联系商家，为你的官网账号开通课程。' : '如已开通，请联系课程管理员核对当前账号。'}</p>
      </div>
      {product && <CoursePurchaseButton productCode={product.code} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-ds-lg bg-ac px-5 text-sm font-ds-bold text-white hover:bg-acd" />}
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
          <SheetTitle className="sr-only">课程权限提示</SheetTitle>
          <UpgradeBody requiredLevel={requiredLevel} productCode={productCode} onClose={onClose} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0" hideCloseButton>
        <DialogTitle className="sr-only">课程权限提示</DialogTitle>
        <DialogDescription className="sr-only">
          当前课程尚未开通。
        </DialogDescription>
        <UpgradeBody requiredLevel={requiredLevel} productCode={productCode} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
