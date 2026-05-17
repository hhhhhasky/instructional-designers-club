import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface CourseConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
}

export default function CourseConfirmDialog({ open, onConfirm }: CourseConfirmDialogProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [open]);

  if (isMobile) {
    return (
      <Sheet open={open} modal>
        <SheetContent
          side="bottom"
          className="h-[90vh] max-h-[90vh] p-0 rounded-t-3xl border-t-2 border-ac/30 overflow-hidden flex flex-col pb-safe"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          hideCloseButton
        >
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <SheetHeader className="bg-gradient-to-r from-ac/10 to-tl/10 px-5 py-5 pb-4 sticky top-0 z-10 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-ds-full bg-acl flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-ac" />
                </div>
                <SheetTitle className="text-ds-xl font-ds-black text-tx text-left" style={{ fontFamily: 'var(--fd)' }}>
                  ⚠️ 重要提示
                </SheetTitle>
              </div>
              <SheetDescription className="text-ds-sm text-txs text-left">
                开始学习前，请务必仔细阅读以下重要信息
              </SheetDescription>
            </SheetHeader>

            <div className="px-5 py-5 space-y-5">
              <div className="bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-ds-xl p-4">
                <h3 className="text-ds-md font-ds-bold text-tx mb-3 flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  学习前须知
                </h3>

                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-ds-full bg-ac flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-ds-xs font-ds-bold">1</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-ds-sm text-tx leading-relaxed">
                        点击<span className="font-ds-bold text-ac">【开始学习】</span>按钮将跳转到<span className="font-ds-bold text-ac">申请页面</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-ds-full bg-ac flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-ds-xs font-ds-bold">2</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-ds-sm text-tx leading-relaxed">
                        申请回放时<span className="font-ds-bold text-red-600 dark:text-red-400">【务必备注自己的群名称】</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-ds-full bg-ac flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-ds-xs font-ds-bold">3</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-ds-sm text-tx leading-relaxed">
                        备注群名称是为了<span className="font-ds-bold text-ac">核对您的会员身份</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-ds-full bg-red-600 dark:bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-ds-xs font-ds-bold">!</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-ds-sm text-tx leading-relaxed">
                        <span className="font-ds-bold text-red-600 dark:text-red-400">未备注群名称的申请将不予通过</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-ds-xl p-4">
                <div className="flex items-start gap-2.5">
                  <span className="text-xl flex-shrink-0">💡</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-ds-xs text-yellow-900 dark:text-yellow-100 leading-relaxed">
                      <strong>温馨提示：</strong>为了确保您能顺利获得课程回放权限，请在申请时务必填写您在俱乐部群内的昵称或群名称，以便管理员快速核对您的会员身份。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 px-5 py-4 bg-cream border-t border-bd space-y-3 pb-safe">
            <Button
              size="lg"
              className="w-full text-ds-md py-6 btn-super-cta text-white active:scale-[0.98] touch-manipulation"
              onClick={onConfirm}
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              我已知晓，开始学习
            </Button>

            <p className="text-ds-xs text-center text-txs px-2">
              点击按钮即表示您已阅读并理解以上所有提示信息
            </p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} modal>
      <DialogContent
        className="sm:max-w-[600px] p-0 gap-0 border-2 border-ac/30 max-h-[90vh] flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader className="bg-gradient-to-r from-ac/10 to-tl/10 p-6 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-ds-full bg-acl flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-ac" />
            </div>
            <DialogTitle className="text-ds-2xl font-ds-black text-tx" style={{ fontFamily: 'var(--fd)' }}>
              ⚠️ 重要提示
            </DialogTitle>
          </div>
          <DialogDescription className="text-ds-md text-txs">
            开始学习前，请务必仔细阅读以下重要信息
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-6">
          <div className="bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-ds-lg p-5">
            <h3 className="text-ds-lg font-ds-bold text-tx mb-4 flex items-center gap-2">
              <span className="text-2xl">📋</span>
              学习前须知
            </h3>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-ds-full bg-ac flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-ds-sm font-ds-bold">1</span>
                </div>
                <div className="flex-1">
                  <p className="text-tx leading-relaxed">
                    点击<span className="font-ds-bold text-ac">【开始学习】</span>按钮将跳转到<span className="font-ds-bold text-ac">申请页面</span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-ds-full bg-ac flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-ds-sm font-ds-bold">2</span>
                </div>
                <div className="flex-1">
                  <p className="text-tx leading-relaxed">
                    申请回放时<span className="font-ds-bold text-red-600 dark:text-red-400">【务必备注自己的群名称】</span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-ds-full bg-ac flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-ds-sm font-ds-bold">3</span>
                </div>
                <div className="flex-1">
                  <p className="text-tx leading-relaxed">
                    备注群名称是为了<span className="font-ds-bold text-ac">核对您的会员身份</span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-ds-full bg-red-600 dark:bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-ds-sm font-ds-bold">!</span>
                </div>
                <div className="flex-1">
                  <p className="text-tx leading-relaxed">
                    <span className="font-ds-bold text-red-600 dark:text-red-400">未备注群名称的申请将不予通过</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-950/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-ds-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div className="flex-1">
                <p className="text-ds-sm text-yellow-900 dark:text-yellow-100 leading-relaxed">
                  <strong>温馨提示：</strong>为了确保您能顺利获得课程回放权限，请在申请时务必填写您在俱乐部群内的昵称或群名称，以便管理员快速核对您的会员身份。
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              className="w-full text-ds-lg py-6 btn-super-cta text-white btn-press"
              onClick={onConfirm}
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              我已知晓，开始学习
            </Button>

            <p className="text-ds-xs text-center text-txs">
              点击按钮即表示您已阅读并理解以上所有提示信息
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
