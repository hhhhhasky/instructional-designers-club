import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { COURSE_PURCHASE_PRODUCTS } from '@/lib/course-purchase';
import type { CourseAccessCode } from '@/lib/course-entitlements';
import { HOME_LANDING_DEFAULTS, type HomeLandingContent } from '@/lib/home-landing-content';

export default function CoursePurchaseSection({ accessCodes = [], isAdmin = false, content = HOME_LANDING_DEFAULTS.home_courses }: { accessCodes?: readonly CourseAccessCode[]; isAdmin?: boolean; content?: HomeLandingContent['home_courses'] }) {
  return (
    <section id="course-products" aria-labelledby="course-products-title" className="border-y border-bd bg-[var(--paper-deep)] px-4 py-12 md:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-3 border-b border-bd pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="editorial-kicker">{content.kicker}</span>
            <h2 id="course-products-title" className="mt-3 text-2xl font-ds-black text-tx md:text-4xl" style={{ fontFamily: 'var(--fd)' }}>{content.title}</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-txs">{content.description}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {COURSE_PURCHASE_PRODUCTS.map((product, index) => {
            const details = content.items.find((item) => item.code === product.code) ?? HOME_LANDING_DEFAULTS.home_courses.items.find((item) => item.code === product.code)!;
            return (
            <article key={product.code} className="editorial-paper flex h-full flex-col p-5 transition-colors hover:border-ac/50 md:p-6">
              <div className="flex items-start justify-between gap-3">
                <span className="font-serif text-4xl text-ac/60" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span className="editorial-stamp">{content.product_label}</span>
              </div>
              <h3 className="mt-6 text-xl font-ds-black text-tx" style={{ fontFamily: 'var(--fd)' }}>{product.name}</h3>
              <p className="mt-3 text-xs font-ds-bold text-ac">{details.audience}</p>
              <p className="mt-3 flex-1 text-sm leading-7 text-txs">{details.gain}</p>
              <div className="mt-8 border-t border-dashed border-bd pt-5">
                <Link to={product.cataloguePath} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-ds-semibold text-ac hover:underline">
                  {content.catalogue_cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                {isAdmin || accessCodes.includes(product.code) ? (
                  <Link to={product.cataloguePath} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-ds-sm bg-ac px-5 text-sm font-ds-bold text-white transition-colors hover:bg-acd">
                    {content.access_cta}{product.name} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <a href={product.purchaseUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-ds-sm bg-ac px-5 text-sm font-ds-bold text-white transition-colors hover:bg-acd focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac focus-visible:ring-offset-2">
                    {content.purchase_cta}{product.name} <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                )}
              </div>
            </article>
          ); })}
        </div>
        <p className="mt-5 text-xs leading-6 text-txt">{content.footnote}</p>
      </div>
    </section>
  );
}
