import { ArrowRight, BookOpen, Compass, LockKeyhole, PlayCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Footer from '@/components/common/Footer';
import PageMeta from '@/components/common/PageMeta';
import ContentFormatBadges from '@/components/course/ContentFormatBadges';
import { CourseEditorialHero } from '@/components/course/CourseEditorialShell';
import CourseAccessNotice from '@/components/course/CourseAccessNotice';
import CourseTypeTabs from '@/components/course/CourseTypeTabs';
import Header from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { type CourseProductCatalog, getCourseProductCatalog, subscribeToCourseCatalogUpdates } from '@/db/api';
import { canAccessCourse } from '@/lib/access-control';
import { DAOFA_CANVAS_ENTRY } from '@/lib/daofa-catalog';

export default function DaofaCoursePage() {
  const { courseAccessCodes, profile } = useAuth();
  const [catalog, setCatalog] = useState<CourseProductCatalog>({ courses: [], categories: [], coursesByCategory: {} });
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await getCourseProductCatalog('daofa-textbook');
        if (active) { setCatalog(data); setError(false); }
      } catch { if (active) setError(true); }
      finally { if (active) setIsLoading(false); }
    };
    void load();
    const unsubscribe = subscribeToCourseCatalogUpdates(() => { void load(); });
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', refresh);
    return () => { active = false; unsubscribe(); window.removeEventListener('focus', refresh); };
  }, []);
  const chapters = catalog.categories.map((title) => ({ id: title, title, lessons: catalog.coursesByCategory[title] ?? [] }));
  const hasAccess = profile?.role === 'admin' || canAccessCourse(courseAccessCodes, 'daofa-textbook');

  return <>
    <PageMeta title="道法教材解读课" description="从课标到单元，再从单元到单课，建立一至九年级道法教材地图。" noIndex />
    <div className="min-h-screen bg-cream flex flex-col">
      <Header />
      <main className="flex-1 pt-20">
        <CourseTypeTabs />
        <CourseEditorialHero
          kicker="道法教材解读课 · 课程目录"
          badge="1—9 年级 · 18 册教材"
          title="道法教材解读课"
          description="先看懂为什么教、到底教什么，再进入教学设计。"
          audience="建议先学总论，再按正在使用的册次查阅；三元对齐画布可随时用来追溯课标与教材单元的关系。"
          icon={BookOpen}
          stats={[{ label: '课程篇章', value: chapters.length }, { label: '可学课程', value: catalog.courses.length }, { label: '备课工具', value: 1 }]}
        >
          <CourseAccessNotice productCode="daofa-textbook" />
        </CourseEditorialHero>
        <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-20 pt-8 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="course-editorial-toc self-start lg:sticky lg:top-24">
            <span className="editorial-kicker">选择学习内容</span>
            <nav aria-label="道法课程篇章" className="mt-4 space-y-2">
              {chapters.map((chapter, index) => <a key={chapter.id} href={`#${chapter.id}`} className="flex min-h-11 items-center justify-between rounded-ds-sm px-3 text-sm text-tx hover:bg-acl/40 hover:text-ac">
                <span>{String(index + 1).padStart(2, '0')} · {chapter.title}</span><span className="text-xs text-txt">{chapter.lessons.length + (chapter.title === DAOFA_CANVAS_ENTRY.category ? 1 : 0)} 项</span>
              </a>)}
            </nav>
            {!hasAccess && <p className="mt-6 border-t border-dashed border-bd pt-4 text-xs leading-6 text-txs"><LockKeyhole className="mr-1 inline h-3.5 w-3.5" />开通“道法教材解读课”后，即可学习下方课程。</p>}
          </aside>
          <div className="space-y-12">
            {isLoading && <p role="status" className="py-8 text-txs">正在加载课程目录…</p>}
            {error && <p role="alert" className="py-8 text-txs">课程目录加载失败，请刷新页面重试。</p>}
            {!isLoading && !error && catalog.courses.length === 0 && <p className="py-8 text-txs">课程发布后会显示在这里。</p>}
            {chapters.map((chapter, index) => <section key={chapter.id} id={chapter.id} className="scroll-mt-28">
              <div className="mb-4 flex items-end gap-4 border-b border-bd pb-5">
                <span className="font-serif text-4xl text-ac/60">{String(index + 1).padStart(2, '0')}</span>
                <div><p className="editorial-kicker">{index === 0 ? '先了解解读方法' : '按年级选择教材'}</p><h2 className="mt-1 font-ds-black text-2xl text-tx" style={{ fontFamily: 'var(--fd)' }}>{chapter.title}</h2><p className="mt-2 text-sm leading-6 text-txs">选择下方课程，开始学习。</p></div>
              </div>
              <ol className="overflow-hidden rounded-ds-sm border border-bd bg-[var(--paper)]">
                {chapter.lessons.map((lesson, lessonIndex) => <li key={lesson.id} className="border-b border-dashed border-bd last:border-b-0">
                  <Link to={`/courses/${lesson.id}`} className="group flex min-h-20 items-center gap-4 px-4 py-4 transition-colors hover:bg-acl/25 focus-visible:bg-acl/25 sm:px-6">
                    <span className="w-7 shrink-0 font-mono text-xs text-txt">{String(lessonIndex + 1).padStart(2, '0')}</span>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-bd text-ac">{lesson.course_type === 'video' ? <PlayCircle className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}</span>
                    <span className="min-w-0 flex-1"><span className="block font-ds-bold text-tx group-hover:text-ac">{lesson.title}</span><span className="mt-1 block text-xs leading-5 text-txs">{lesson.description}</span></span>
                    <ContentFormatBadges course={lesson} />
                    <ArrowRight className="h-4 w-4 shrink-0 text-ac transition-transform group-hover:translate-x-1" />
                  </Link>
                </li>)}
                {chapter.title === DAOFA_CANVAS_ENTRY.category && <li className="border-b border-dashed border-bd last:border-b-0">
                  <Link to={DAOFA_CANVAS_ENTRY.href} className="group flex min-h-20 items-center gap-4 px-4 py-4 transition-colors hover:bg-acl/25 focus-visible:bg-acl/25 sm:px-6">
                    <span className="w-7 shrink-0 font-mono text-xs text-txt">{String(chapter.lessons.length + 1).padStart(2, '0')}</span>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-bd text-ac"><Compass className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block font-ds-bold text-tx group-hover:text-ac">{DAOFA_CANVAS_ENTRY.title}</span><span className="mt-1 block text-xs leading-5 text-txs">查看课标素养目标、内容要求与教材单元的对应关系。</span></span>
                    <span className="shrink-0 text-xs text-txs">交互工具</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ac transition-transform group-hover:translate-x-1" />
                  </Link>
                </li>}
              </ol>
            </section>)}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  </>;
}
