import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { CourseAccessCode } from '@/lib/course-entitlements';
import { getCoursePurchaseProduct } from '@/lib/course-purchase';

export default function CoursePurchaseButton({ productCode, className, label }: { productCode: CourseAccessCode; className?: string; label?: string }) {
  const [showWechat, setShowWechat] = useState(false);
  const product = getCoursePurchaseProduct(productCode);
  if (!product) return null;

  return <Dialog onOpenChange={(open) => { if (!open) { setShowWechat(false); } }}>
    <DialogTrigger asChild>
      <button type="button" aria-label={`购买${product.name}`} className={className ?? 'inline-flex min-h-11 items-center justify-center gap-2 rounded-ds-sm bg-ac px-5 py-2.5 text-sm font-ds-bold text-white transition-colors hover:bg-acd focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac focus-visible:ring-offset-2'}>
        {label ?? `购买${product.name}`}<ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </DialogTrigger>
    <DialogContent className="sm:max-w-md">
      <DialogTitle>选择购买方式</DialogTitle>
      <DialogDescription>购买{product.name}后，请联系商家核对订单并开通官网课程。</DialogDescription>
      <div className="grid gap-3">
        <a href={product.purchaseUrl} target="_blank" rel="noopener noreferrer" className="rounded-ds-sm border border-bd px-4 py-3 text-sm font-ds-bold text-tx hover:border-ac hover:text-ac">小红书支付 <ArrowUpRight className="ml-1 inline h-4 w-4" aria-hidden="true" /></a>
        <button type="button" onClick={() => setShowWechat(true)} className="rounded-ds-sm border border-bd px-4 py-3 text-left text-sm font-ds-bold text-tx hover:border-ac hover:text-ac">微信支付</button>
      </div>
      {showWechat && <div className="space-y-3 text-center text-sm text-tx">
        <p>在微信中长按二维码识别；也可以用手机微信扫一扫。</p>
        <img src={product.wechatQrImage} alt={`${product.name}微信小店购买二维码`} className="mx-auto w-full max-w-[280px] rounded-ds-sm" />
      </div>}
    </DialogContent>
  </Dialog>;
}
