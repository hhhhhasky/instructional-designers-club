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
import { AlertTriangle, ExternalLink } from 'lucide-react';

interface CourseConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
}

function DialogBody({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div className="space-y-5 p-6">
      <p className="text-tx leading-relaxed">
        即将跳转到腾讯会议回放申请页面。
      </p>
      <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">
          <strong>务必在申请时备注自己的群名称</strong>，否则申请不予通过。
        </p>
      </div>
      <Button
        size="lg"
        className="w-full text-base py-5 btn-press"
        onClick={onConfirm}
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        我知道了，前往腾讯会议
      </Button>
    </div>
  );
}

export default function CourseConfirmDialog({ open, onConfirm }: CourseConfirmDialogProps) {
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    return (
      <Sheet open={open} modal>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl p-0 pb-safe"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          hideCloseButton
        >
          <SheetTitle className="sr-only">跳转确认</SheetTitle>
          <DialogBody onConfirm={onConfirm} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} modal>
      <DialogContent
        className="sm:max-w-[420px] p-0 gap-0"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogTitle className="sr-only">跳转确认</DialogTitle>
        <DialogDescription className="sr-only">
          确认后将打开腾讯会议回放申请页面。
        </DialogDescription>
        <DialogBody onConfirm={onConfirm} />
      </DialogContent>
    </Dialog>
  );
}
