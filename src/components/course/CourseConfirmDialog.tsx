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
    // 检测是否为移动设备
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 阻止物理返回键和手势返回
  useEffect(() => {
    if (!open) return;

    // 阻止浏览器返回
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
    };

    // 添加历史记录以拦截返回
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [open]);

  // 移动端使用Sheet组件（强制确认模式）
  if (isMobile) {
    return (
      <Sheet open={open} modal>
        <SheetContent 
          side="bottom" 
          className="h-[90vh] max-h-[90vh] p-0 rounded-t-3xl border-t-2 border-primary/30 overflow-hidden flex flex-col pb-safe"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          hideCloseButton
        >
          {/* 可滚动内容区域 */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {/* 标题区域 */}
            <SheetHeader className="bg-gradient-to-r from-primary/10 to-primary-glow/10 px-5 py-5 pb-4 sticky top-0 z-10 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-primary" />
                </div>
                <SheetTitle className="text-xl font-black text-foreground text-left">
                  ⚠️ 重要提示
                </SheetTitle>
              </div>
              <SheetDescription className="text-sm text-muted-foreground text-left">
                开始学习前，请务必仔细阅读以下重要信息
              </SheetDescription>
            </SheetHeader>

            {/* 内容区域 */}
            <div className="px-5 py-5 space-y-5">
              {/* 提示信息卡片 */}
              <div className="bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  学习前须知
                </h3>
                
                <div className="space-y-3">
                  {/* 第一条 */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">1</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-relaxed">
                        点击<span className="font-bold text-primary">【开始学习】</span>按钮将跳转到<span className="font-bold text-primary">申请页面</span>
                      </p>
                    </div>
                  </div>

                  {/* 第二条 */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">2</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-relaxed">
                        申请回放时<span className="font-bold text-red-600 dark:text-red-400">【务必备注自己的群名称】</span>
                      </p>
                    </div>
                  </div>

                  {/* 第三条 */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">3</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-relaxed">
                        备注群名称是为了<span className="font-bold text-primary">核对您的会员身份</span>
                      </p>
                    </div>
                  </div>

                  {/* 第四条 */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-red-600 dark:bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">!</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-relaxed">
                        <span className="font-bold text-red-600 dark:text-red-400">未备注群名称的申请将不予通过</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 强调提示 */}
              <div className="bg-yellow-50 dark:bg-yellow-950/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-2xl p-4">
                <div className="flex items-start gap-2.5">
                  <span className="text-xl flex-shrink-0">💡</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-yellow-900 dark:text-yellow-100 leading-relaxed">
                      <strong>温馨提示：</strong>为了确保您能顺利获得课程回放权限，请在申请时务必填写您在俱乐部群内的昵称或群名称，以便管理员快速核对您的会员身份。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 底部固定按钮区域 */}
          <div className="flex-shrink-0 px-5 py-4 bg-background border-t border-border space-y-3 pb-safe">
            <Button
              size="lg"
              className="w-full text-base py-6 bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 transition-opacity active:scale-[0.98] touch-manipulation"
              onClick={onConfirm}
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              我已知晓，开始学习
            </Button>
            
            <p className="text-xs text-center text-muted-foreground px-2">
              点击按钮即表示您已阅读并理解以上所有提示信息
            </p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // 桌面端使用Dialog组件（保持强制确认）
  return (
    <Dialog open={open} modal>
      <DialogContent 
        className="sm:max-w-[600px] p-0 gap-0 border-2 border-primary/30 max-h-[90vh] flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        {/* 标题区域 */}
        <DialogHeader className="bg-gradient-to-r from-primary/10 to-primary-glow/10 p-6 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-2xl font-black text-foreground">
              ⚠️ 重要提示
            </DialogTitle>
          </div>
          <DialogDescription className="text-base text-muted-foreground">
            开始学习前，请务必仔细阅读以下重要信息
          </DialogDescription>
        </DialogHeader>

        {/* 可滚动内容区域 */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-6">
          {/* 提示信息卡片 */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-5">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <span className="text-2xl">📋</span>
              学习前须知
            </h3>
            
            <div className="space-y-4">
              {/* 第一条 */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm font-bold">1</span>
                </div>
                <div className="flex-1">
                  <p className="text-foreground leading-relaxed">
                    点击<span className="font-bold text-primary">【开始学习】</span>按钮将跳转到<span className="font-bold text-primary">申请页面</span>
                  </p>
                </div>
              </div>

              {/* 第二条 */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm font-bold">2</span>
                </div>
                <div className="flex-1">
                  <p className="text-foreground leading-relaxed">
                    申请回放时<span className="font-bold text-red-600 dark:text-red-400">【务必备注自己的群名称】</span>
                  </p>
                </div>
              </div>

              {/* 第三条 */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm font-bold">3</span>
                </div>
                <div className="flex-1">
                  <p className="text-foreground leading-relaxed">
                    备注群名称是为了<span className="font-bold text-primary">核对您的会员身份</span>
                  </p>
                </div>
              </div>

              {/* 第四条 */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-red-600 dark:bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm font-bold">!</span>
                </div>
                <div className="flex-1">
                  <p className="text-foreground leading-relaxed">
                    <span className="font-bold text-red-600 dark:text-red-400">未备注群名称的申请将不予通过</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 强调提示 */}
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div className="flex-1">
                <p className="text-sm text-yellow-900 dark:text-yellow-100 leading-relaxed">
                  <strong>温馨提示：</strong>为了确保您能顺利获得课程回放权限，请在申请时务必填写您在俱乐部群内的昵称或群名称，以便管理员快速核对您的会员身份。
                </p>
              </div>
            </div>
          </div>

          {/* 确认按钮 */}
          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              className="w-full text-lg py-6 bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 transition-opacity btn-press"
              onClick={onConfirm}
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              我已知晓，开始学习
            </Button>
            
            <p className="text-xs text-center text-muted-foreground">
              点击按钮即表示您已阅读并理解以上所有提示信息
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
