/** @jsxRuntime automatic */
import { ArrowDown, ArrowRight, Play } from "lucide-react";
import type { ReactNode } from "react";
import type { HomeLandingContent } from "../../lib/home-landing-content";

export default function HomeInitialHero({
  hero,
  hasFreeCourses = false,
  learningLink,
}: {
  hero: HomeLandingContent["home_hero"];
  hasFreeCourses?: boolean;
  learningLink?: ReactNode;
}) {
  return (
    <section
      id="teaching-problems"
      aria-labelledby="home-title"
      style={{ fontFamily: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif' }}
      className="relative overflow-hidden border-b border-[var(--paper-rule)] bg-[var(--paper)] px-4 pb-14 pt-16 md:pb-20 md:pt-20"
    >
      <div
        className="pointer-events-none absolute -right-24 top-0 h-96 w-96 rounded-full bg-ac/5 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-center">
        <div className="min-w-0">
          <p className="editorial-kicker">{hero.kicker}</p>
          <h1
            id="home-title"
            className="mt-6 max-w-4xl text-4xl font-ds-black leading-[1.22] tracking-tight text-tx md:text-6xl"
          >
            {hero.title_line1}
            <br />
            <span className="text-ac">{hero.title_line2}</span>
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-8 text-txs md:text-lg md:leading-9">
            {hero.description}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#real-situations"
              className="inline-flex min-h-12 items-center gap-2 rounded-ds-sm bg-ac px-6 font-ds-bold text-white transition-colors hover:bg-acd focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac focus-visible:ring-offset-2"
            >
              {hero.primary_cta}{" "}
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </a>
            <a
              href="#course-products"
              className="inline-flex min-h-12 items-center gap-2 rounded-ds-sm border border-bd bg-white px-6 font-ds-semibold text-tx transition-colors hover:border-ac focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac focus-visible:ring-offset-2"
            >
              {hero.secondary_cta}{" "}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            {hasFreeCourses && (
              <a
                href="#free-courses"
                className="inline-flex min-h-12 items-center gap-2 rounded-ds-sm border border-ac/30 bg-[var(--annotation-soft)] px-6 font-ds-semibold text-ac transition-colors hover:border-ac focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac focus-visible:ring-offset-2"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                免费体验课程
              </a>
            )}
          </div>
          {learningLink}
        </div>
        <aside
          className="editorial-paper border-[var(--paper-rule)] p-6 shadow-ds-md md:p-7"
          aria-label="一节课的设计线索"
        >
          <div className="flex items-center justify-between border-b border-dashed border-[var(--paper-rule)] pb-4">
            <span className="editorial-stamp">{hero.aside_title}</span>
            <span className="text-3xl text-ac/45" aria-hidden="true">
              01
            </span>
          </div>
          <ol className="mt-5">
            {hero.aside_steps.map((item, index) => (
              <li
                key={item}
                className="flex items-center gap-4 border-l-2 border-ac/25 py-3 pl-4 text-sm text-tx"
              >
                <span className="font-mono text-xs text-ac">
                  0{index + 1}
                </span>
                <strong>{item}</strong>
              </li>
            ))}
          </ol>
          <p className="mt-5 border-t border-dashed border-[var(--paper-rule)] pt-4 text-sm leading-7 text-txs">
            {hero.aside_note}
          </p>
        </aside>
      </div>
    </section>
  );
}
