import { ArrowDown, ArrowRight, BookOpen, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import Header from '@/components/layout/Header';
import Footer from '@/components/common/Footer';
import PageMeta from '@/components/common/PageMeta';
import PageNavigation from '@/components/common/PageNavigation';
import MemberHomeHero from '@/components/home/MemberHomeHero';
import NotificationCard from '@/components/home/NotificationCard';
import AnnouncementFeed from '@/components/home/AnnouncementFeed';
import CoursePurchaseSection from '@/components/pricing/CoursePurchaseSection';
import { useAuth } from '@/contexts/AuthContext';
import { useHomeContent } from '@/hooks/useHomeContent';
import { HomeSnapshotProvider } from '@/hooks/useHomeSnapshot';

const navigation = [
  { id: 'teaching-problems', label: '教学难题' },
  { id: 'teaching-method', label: '哈老师的方法' },
  { id: 'about-han', label: '关于哈老师' },
  { id: 'course-products', label: '三门课程' },
  { id: 'how-to-learn', label: '如何学习' },
];

export default function HomePage() {
  return <HomeSnapshotProvider><HomePageContent /></HomeSnapshotProvider>;
}

function HomePageContent() {
  const { user, profile, courseAccessCodes, loading } = useAuth();
  const { loaded, homeCourses, landing, founder } = useHomeContent();
  const { home_hero: hero, home_situations: situationCopy, home_problem: problemCopy, home_method: methodCopy, home_founder: founderCopy, home_outcomes: outcomeCopy, home_learning: learningCopy, home_extra: extraCopy } = landing;
  const freeCourses = homeCourses.free.slice(0, 2);

  if (!loaded) {
    return <>
      <PageMeta title="哈老师聊教学设计" description="从真实教学问题出发，和哈老师一起分析教材、学情、目标、课堂活动与评价。了解教学通识课、教师 AI 课和道法教材解读课。" canonicalPath="/" keywords="哈老师聊教学设计,教师培训,教学设计,教师AI课,道法教材解读课" />
      <div className="min-h-screen bg-cream">
        <Header />
        <main aria-busy="true" aria-label="首页内容加载中" className="min-h-[70vh] bg-[var(--paper)] px-4 pb-14 pt-28 md:pb-20 md:pt-36">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-center">
            <div className="animate-pulse space-y-6" aria-hidden="true">
              <div className="h-4 w-48 rounded bg-bd/60" />
              <div className="h-14 max-w-2xl rounded bg-bd/60" />
              <div className="h-14 max-w-xl rounded bg-bd/60" />
              <div className="h-5 max-w-2xl rounded bg-bd/40" />
              <div className="h-5 max-w-lg rounded bg-bd/40" />
            </div>
            <div className="hidden h-64 animate-pulse rounded-ds-lg bg-bd/40 lg:block" aria-hidden="true" />
          </div>
        </main>
      </div>
    </>;
  }

  return <>
    <PageMeta title="哈老师聊教学设计" description="从真实教学问题出发，和哈老师一起分析教材、学情、目标、课堂活动与评价。了解教学通识课、教师 AI 课和道法教材解读课。" canonicalPath="/" keywords="哈老师聊教学设计,教师培训,教学设计,教师AI课,道法教材解读课" />
    <div className="min-h-screen bg-cream">
      <Header />
      {!loading && <PageNavigation items={user ? [...navigation, { id: 'my-learning', label: '我的学习' }] : navigation} />}
      <main>
        <section id="teaching-problems" aria-labelledby="home-title" className="relative overflow-hidden border-b border-[var(--paper-rule)] bg-[var(--paper)] px-4 pb-14 pt-28 md:pb-20 md:pt-36">
          <div className="pointer-events-none absolute -right-24 top-0 h-96 w-96 rounded-full bg-ac/5 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-center">
            <div className="animate-fade-in-up">
              <p className="editorial-kicker">{hero.kicker}</p>
              <h1 id="home-title" className="mt-6 max-w-4xl text-4xl font-ds-black leading-[1.22] tracking-tight text-tx md:text-6xl" style={{ fontFamily: 'var(--fd)' }}>{hero.title_line1}<br /><span className="text-ac">{hero.title_line2}</span></h1>
              <p className="mt-7 max-w-2xl text-base leading-8 text-txs md:text-lg md:leading-9">{hero.description}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#real-situations" className="inline-flex min-h-12 items-center gap-2 rounded-ds-sm bg-ac px-6 font-ds-bold text-white transition-colors hover:bg-acd focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac focus-visible:ring-offset-2">{hero.primary_cta} <ArrowDown className="h-4 w-4" aria-hidden="true" /></a>
                <a href="#course-products" className="inline-flex min-h-12 items-center gap-2 rounded-ds-sm border border-bd bg-white px-6 font-ds-semibold text-tx transition-colors hover:border-ac focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac focus-visible:ring-offset-2">{hero.secondary_cta} <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
              </div>
              {user && !loading && <Link to="/learning" className="mt-6 inline-flex items-center gap-2 text-sm font-ds-semibold text-ac hover:underline">{hero.learning_cta} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>}
            </div>
            <aside className="editorial-paper animate-fade-in border-[var(--paper-rule)] p-6 shadow-ds-md md:p-7" aria-label="一节课的设计线索">
              <div className="flex items-center justify-between border-b border-dashed border-[var(--paper-rule)] pb-4"><span className="editorial-stamp">{hero.aside_title}</span><span className="font-serif text-3xl text-ac/45" aria-hidden="true">01</span></div>
              <ol className="mt-5">{hero.aside_steps.map((item, index) => <li key={item} className="flex items-center gap-4 border-l-2 border-ac/25 py-3 pl-4 text-sm text-tx"><span className="font-mono text-xs text-ac">0{index + 1}</span><strong>{item}</strong></li>)}</ol>
              <p className="mt-5 border-t border-dashed border-[var(--paper-rule)] pt-4 text-sm leading-7 text-txs">{hero.aside_note}</p>
            </aside>
          </div>
        </section>

        {user && !loading && <div className="bg-[var(--paper-deep)]"><MemberHomeHero /><NotificationCard /></div>}

        <section id="real-situations" className="scroll-mt-24 bg-warm px-4 py-16 md:py-24" aria-labelledby="situations-title">
          <div className="mx-auto max-w-6xl">
            <span className="editorial-kicker">{situationCopy.kicker}</span>
            <h2 id="situations-title" className="mt-4 max-w-3xl text-3xl font-ds-black leading-tight text-tx md:text-5xl" style={{ fontFamily: 'var(--fd)' }}>{situationCopy.title}</h2>
            <p className="mt-4 max-w-3xl text-base leading-8 text-txs">{situationCopy.description}</p>
            <div className="mt-10 grid gap-4 md:grid-cols-2">{situationCopy.items.map((item, index) => <article key={item.label} className="editorial-paper flex min-h-52 flex-col border-[var(--paper-rule)] p-6 transition-colors hover:border-ac/50 md:p-8"><div className="flex items-center justify-between"><span className="editorial-stamp">{item.label}</span><span className="font-serif text-4xl text-ac/30" aria-hidden="true">0{index + 1}</span></div><h3 className="mt-5 text-xl font-ds-bold leading-snug text-tx" style={{ fontFamily: 'var(--fd)' }}>{item.title}</h3><p className="mt-3 text-sm leading-7 text-txs">{item.detail}</p></article>)}</div>
          </div>
        </section>

        <section id="why-stuck" className="scroll-mt-24 bg-[var(--ink)] px-4 py-16 text-white md:py-24" aria-labelledby="why-stuck-title">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
            <div><span className="text-xs font-ds-bold tracking-[.18em] text-[#e2a18b]">{problemCopy.kicker}</span><h2 id="why-stuck-title" className="mt-5 text-3xl font-ds-black leading-tight md:text-5xl" style={{ fontFamily: 'var(--fd)' }}>{problemCopy.title}</h2><p className="mt-6 max-w-md leading-8 text-[#d8cbc2]">{problemCopy.description}</p></div>
            <div className="divide-y divide-white/15 border-y border-white/15">{problemCopy.items.map((item) => <div key={item.title} className="grid gap-2 py-5 sm:grid-cols-[160px_1fr] sm:gap-6"><strong className="text-[#f0b29d]">{item.title}</strong><p className="leading-7 text-[#e6ddd5]">{item.detail}</p></div>)}<p className="py-6 text-xl font-ds-bold text-white" style={{ fontFamily: 'var(--fd)' }}>{problemCopy.conclusion}</p></div>
          </div>
        </section>

        <section id="teaching-method" className="scroll-mt-24 bg-[var(--paper)] px-4 py-16 md:py-24" aria-labelledby="method-title">
          <div className="mx-auto max-w-6xl">
            <span className="editorial-kicker">{methodCopy.kicker}</span>
            <div className="mt-4 grid gap-5 lg:grid-cols-[1.2fr_.8fr] lg:items-end"><h2 id="method-title" className="text-3xl font-ds-black leading-tight text-tx md:text-5xl" style={{ fontFamily: 'var(--fd)' }}>{methodCopy.title_line1}<br /><span className="text-ac">{methodCopy.title_line2}</span></h2><p className="max-w-md text-base leading-8 text-txs">{methodCopy.description}</p></div>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{methodCopy.items.map((step, index) => <div key={step.title} className="border-t-2 border-ac bg-[var(--paper-deep)] p-5 md:p-6"><span className="font-serif text-3xl text-ac/60">0{index + 1}</span><h3 className="mt-5 text-xl font-ds-bold text-tx" style={{ fontFamily: 'var(--fd)' }}>{step.title}</h3><p className="mt-2 text-sm leading-7 text-txs">{step.detail}</p></div>)}</div>
            <div className="mt-8 grid overflow-hidden border border-[var(--paper-rule)] md:grid-cols-2"><div className="bg-white p-6 md:p-8"><span className="editorial-stamp">{methodCopy.before_label}</span><p className="mt-4 text-lg font-ds-semibold leading-8 text-tx">{methodCopy.before_text}</p></div><div className="bg-[var(--annotation-soft)] p-6 md:p-8"><span className="editorial-stamp">{methodCopy.after_label}</span><p className="mt-4 text-lg font-ds-semibold leading-8 text-tx">{methodCopy.after_text}</p></div></div>
            <p className="mt-3 text-xs text-txt">{methodCopy.footnote}</p>
          </div>
        </section>

        <section id="about-han" className="scroll-mt-24 bg-[var(--paper-deep)] px-4 py-16 md:py-24" aria-labelledby="about-han-title">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[280px_1fr] lg:items-center">
            <img className="aspect-square w-full border border-[var(--paper-rule)] bg-[var(--paper)] object-cover" src={founder.avatar_url} alt={founder.avatar_alt || founder.name} loading="lazy" />
            <div>
              <span className="editorial-kicker">{founderCopy.kicker}</span>
              <h2 id="about-han-title" className="mt-4 text-3xl font-ds-black text-tx md:text-5xl" style={{ fontFamily: 'var(--fd)' }}>{founderCopy.title}</h2>
              <p className="mt-3 text-base font-ds-bold text-ac">{founder.name}</p>
              {founder.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{founder.tags.map((tag) => <span key={tag.label} className="rounded-ds-pill border border-ac/25 px-3 py-1 text-xs text-txs">{tag.label}</span>)}</div>}
              <p className="mt-6 max-w-2xl text-lg leading-9 text-tx">{founderCopy.description}</p>
              {founder.info_items.length > 0 && <dl className="mt-5 grid gap-2 text-sm text-txs sm:grid-cols-2">{founder.info_items.map((item) => <div key={item.label} className="flex gap-2"><dt className="font-ds-bold text-tx">{item.label}</dt><dd>{item.text}</dd></div>)}</dl>}
              <blockquote className="mt-7 border-l-4 border-ac pl-5 text-xl font-ds-bold leading-8 text-ac" style={{ fontFamily: 'var(--fd)' }}>“{founder.motto}”</blockquote>
              <p className="mt-5 text-sm leading-7 text-txs">{founderCopy.closing}</p>
            </div>
          </div>
        </section>

        <section id="learning-outcomes" className="scroll-mt-24 bg-warm px-4 py-16 md:py-24" aria-labelledby="outcomes-title"><div className="mx-auto max-w-6xl"><span className="editorial-kicker">{outcomeCopy.kicker}</span><h2 id="outcomes-title" className="mt-4 max-w-3xl text-3xl font-ds-black leading-tight text-tx md:text-5xl" style={{ fontFamily: 'var(--fd)' }}>{outcomeCopy.title}</h2><p className="mt-4 max-w-2xl leading-8 text-txs">{outcomeCopy.description}</p><div className="mt-9 grid gap-4 md:grid-cols-3">{outcomeCopy.items.map((item, index) => <article key={item.title} className="border border-bd bg-white p-6 md:p-7"><span className="font-mono text-xs text-ac">0{index + 1} / {outcomeCopy.item_kicker}</span><h3 className="mt-5 text-xl font-ds-bold text-tx" style={{ fontFamily: 'var(--fd)' }}>{item.title}</h3><p className="mt-3 text-sm leading-7 text-txs">{item.detail}</p></article>)}</div></div></section>

        <CoursePurchaseSection accessCodes={courseAccessCodes ?? []} isAdmin={profile?.role === 'admin'} content={landing.home_courses} />

        <section id="how-to-learn" className="scroll-mt-24 bg-[var(--paper)] px-4 py-16 md:py-24" aria-labelledby="how-to-title"><div className="mx-auto max-w-6xl"><span className="editorial-kicker">{learningCopy.kicker}</span><h2 id="how-to-title" className="mt-4 text-3xl font-ds-black text-tx md:text-5xl" style={{ fontFamily: 'var(--fd)' }}>{learningCopy.title}</h2><div className="mt-10 grid gap-4 md:grid-cols-4">{learningCopy.items.map(({ title, detail }, index) => { const number = String(index + 1).padStart(2, '0'); return <div key={number} className="border-l-2 border-ac/40 bg-[var(--paper-deep)] p-5"><span className="font-mono text-xs text-ac">STEP {number}</span><h3 className="mt-4 font-ds-bold text-tx">{title}</h3><p className="mt-2 text-sm leading-7 text-txs">{detail}</p></div>; })}</div><p className="mt-6 max-w-3xl text-sm leading-7 text-txs">{learningCopy.footnote}</p>{user && <Link to="/learning" className="mt-5 inline-flex items-center gap-2 font-ds-semibold text-ac hover:underline">{learningCopy.learning_cta} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>}</div></section>

        {freeCourses.length > 0 && <section id="free-courses" className="bg-[var(--annotation-soft)] px-4 py-14 md:py-20" aria-labelledby="free-courses-title"><div className="mx-auto max-w-6xl"><div className="flex flex-wrap items-end justify-between gap-4"><div><span className="editorial-kicker">{extraCopy.free_kicker}</span><h2 id="free-courses-title" className="mt-3 text-2xl font-ds-black text-tx md:text-4xl" style={{ fontFamily: 'var(--fd)' }}>{extraCopy.free_title}</h2></div><Link to="/courses" className="inline-flex items-center gap-2 text-sm font-ds-semibold text-ac hover:underline">{extraCopy.free_cta} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div><div className="mt-6 grid gap-4 md:grid-cols-2">{freeCourses.map((course) => <Link key={course.id} to={`/courses/${course.id}`} className="group border border-bd bg-white p-6 transition-colors hover:border-ac"><div className="flex items-start justify-between gap-4"><BookOpen className="h-6 w-6 text-ac" aria-hidden="true" /><Play className="h-4 w-4 text-ac" aria-hidden="true" /></div><h3 className="mt-5 text-lg font-ds-bold text-tx group-hover:text-ac">{course.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-7 text-txs">{course.description}</p></Link>)}</div></div></section>}

        {!loading && !user && <AnnouncementFeed variant="section" />}
        <section id="home-faq" className="bg-warm px-4 py-14 md:py-20" aria-labelledby="home-faq-title"><div className="mx-auto max-w-6xl"><span className="editorial-kicker">{extraCopy.faq_kicker}</span><h2 id="home-faq-title" className="mt-3 text-2xl font-ds-black text-tx md:text-4xl" style={{ fontFamily: 'var(--fd)' }}>{extraCopy.faq_title}</h2><div className="mt-7 grid gap-4 md:grid-cols-2">{extraCopy.faq_items.map((item, index) => <div key={`${index}-${item.title}`} className="border-t border-bd pt-5"><h3 className="font-ds-bold text-tx">{item.title}</h3><p className="mt-2 text-sm leading-7 text-txs">{item.detail}</p></div>)}</div><a href="#course-products" className="mt-8 inline-flex items-center gap-2 text-sm font-ds-semibold text-ac hover:underline">{extraCopy.faq_cta} <ArrowRight className="h-4 w-4" aria-hidden="true" /></a></div></section>
      </main>
      <Footer />
    </div>
  </>;
}
