import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface CourseEditorialStat {
  label: string;
  value: string | number;
}

interface CourseEditorialHeroProps {
  kicker: string;
  badge: string;
  title: string;
  description: string;
  icon: LucideIcon;
  audience?: string;
  stats: CourseEditorialStat[];
  onBack?: () => void;
  backLabel?: string;
  children?: ReactNode;
}

export function CourseEditorialHero({
  kicker,
  badge,
  title,
  description,
  icon: Icon,
  audience,
  stats,
  onBack,
  backLabel,
  children,
}: CourseEditorialHeroProps) {
  return (
    <section className="course-editorial-hero border-b border-bd px-4 py-9 md:py-14">
      <div className="mx-auto max-w-7xl">
        {onBack && backLabel && (
          <button
            type="button"
            onClick={onBack}
            className="mb-6 inline-flex min-h-11 items-center gap-1.5 text-sm font-ds-semibold text-txs transition-colors hover:text-ac focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </button>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
          <div className="max-w-4xl">
            <span className="editorial-kicker">{kicker}</span>
            <div className="mt-5 flex items-center gap-3">
              <span className="course-editorial-mark" aria-hidden="true">
                <Icon className="h-5 w-5" />
              </span>
              <span className="editorial-stamp">{badge}</span>
            </div>
            <h1
              className="mt-5 text-3xl font-ds-black leading-tight tracking-tight text-tx md:text-5xl"
              style={{ fontFamily: "var(--fd)" }}
            >
              {title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-txs md:text-lg">
              {description}
            </p>
            {audience && (
              <p className="mt-3 border-l-2 border-ac/35 pl-3 text-sm leading-6 text-txt">
                {audience}
              </p>
            )}
          </div>

          <aside className="editorial-paper p-5" aria-label="卷册信息">
            <span className="editorial-kicker">CATALOGUE NOTE · 卷册信息</span>
            <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-ds-sm border border-bd bg-bd">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-[var(--paper)] px-3 py-3">
                  <dt className="text-[11px] text-txt">{stat.label}</dt>
                  <dd className="mt-1 font-ds-black text-tx">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>

        {children && <div className="mt-8 border-t border-dashed border-bd pt-5">{children}</div>}
      </div>
    </section>
  );
}

interface CourseEditorialCatalogLayoutProps {
  label: string;
  countLabel: string;
  toc: ReactNode;
  children: ReactNode;
  mobile: ReactNode;
}

export function CourseEditorialCatalogLayout({
  label,
  countLabel,
  toc,
  children,
  mobile,
}: CourseEditorialCatalogLayoutProps) {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 pt-8 md:pt-10" aria-label={`${label}课程目录`}>
      <div className="hidden gap-6 lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="course-editorial-toc sticky top-24 self-start">
          <div className="border-b border-dashed border-bd pb-3">
            <span className="editorial-kicker">CONTENTS · 目录</span>
            <div className="mt-2 flex items-end justify-between gap-3">
              <h2 className="font-ds-bold text-tx" style={{ fontFamily: "var(--fd)" }}>{label}</h2>
              <span className="text-xs text-txt">{countLabel}</span>
            </div>
          </div>
          <nav className="mt-3 space-y-1" aria-label={`${label}导航`}>
            {toc}
          </nav>
        </aside>

        <div className="space-y-6">{children}</div>
      </div>

      <div className="lg:hidden">{mobile}</div>
    </section>
  );
}

interface CourseEditorialVolumeProps {
  id: string;
  index: number;
  title: string;
  description?: string;
  count: number;
  icon: LucideIcon;
  tags?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function CourseEditorialVolume({
  id,
  index,
  title,
  description,
  count,
  icon: Icon,
  tags,
  children,
  className,
}: CourseEditorialVolumeProps) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("course-editorial-volume scroll-mt-28 p-5 md:p-6", className)}
    >
      <header className="mb-5 grid gap-4 border-b border-dashed border-bd pb-5 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <div className="course-editorial-mark" aria-hidden="true">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <span className="editorial-kicker">VOL. {String(index + 1).padStart(2, "0")}</span>
          <h2 id={headingId} className="mt-1 text-xl font-ds-bold text-tx md:text-2xl" style={{ fontFamily: "var(--fd)" }}>
            {title}
          </h2>
          {description && <p className="mt-1.5 text-sm leading-6 text-txs">{description}</p>}
          {tags}
        </div>
        <span className="h-fit rounded-ds-sm border border-bd bg-bgs/70 px-2.5 py-1 text-xs font-ds-bold text-txs">
          {count} 节
        </span>
      </header>
      {children}
    </section>
  );
}

interface CourseReadingProgressProps {
  current: number;
  total: number;
  progress: number;
  completed: boolean;
}

export function CourseReadingProgress({
  current,
  total,
  progress,
  completed,
}: CourseReadingProgressProps) {
  const value = completed ? 100 : Math.max(0, Math.min(100, progress));
  return (
    <div className="course-reading-progress" aria-label="课程学习进度">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-ds-bold text-tx">阅读进度</span>
        <span className="text-txs">
          第 {current} / {Math.max(total, current)} 节 · {completed ? "已完成" : `${value}%`}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-bgs"
        role="progressbar"
        aria-label="当前课程完成度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={completed ? "已完成" : `已完成百分之 ${value}`}
      >
        <span className="block h-full rounded-full bg-ac transition-[width]" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
