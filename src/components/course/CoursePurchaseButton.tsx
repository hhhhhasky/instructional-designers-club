import { ArrowUpRight } from 'lucide-react';
import type { CourseAccessCode } from '@/lib/course-entitlements';
import { getCoursePurchaseProduct } from '@/lib/course-purchase';

export default function CoursePurchaseButton({ productCode }: { productCode: CourseAccessCode }) {
  const product = getCoursePurchaseProduct(productCode);
  if (!product) return null;

  return <a
    href={product.purchaseUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-ds-sm bg-ac px-5 py-2.5 text-sm font-ds-bold text-white transition-colors hover:bg-acd focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac focus-visible:ring-offset-2"
  >
    购买{product.name}<ArrowUpRight className="h-4 w-4" aria-hidden="true" />
  </a>;
}
