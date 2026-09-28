import { ArrowRight, BookOpen, Compass, LockKeyhole, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import Footer from '@/components/common/Footer';
import PageMeta from '@/components/common/PageMeta';
import { CourseEditorialHero } from '@/components/course/CourseEditorialShell';
import CourseTypeTabs from '@/components/course/CourseTypeTabs';
import CoursePurchaseButton from '@/components/course/CoursePurchaseButton';
import Header from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessCourse } from '@/lib/access-control';
import { DAOFA_CHAPTERS } from '@/lib/daofa-course';

export default function DaofaCoursePage() {
  const { courseAccessCodes, profile, loading: authLoading } = useAuth();
  const hasAccess = profile?.role === 'admin' || canAccessCourse(courseAccessCodes, 'daofa-textbook');

  return <>
    <PageMeta title="道法教材解读课" description="从课标到单元，再从单元到单课，建立一至九年级道法教材地图。" noIndex />
    <div className="min-h-screen bg-cream flex flex-col">
      <Header />
      <main className="flex-1 pt-20">
        <CourseTypeTabs />
        <CourseEditorialHero
          kicker="DAOFA CATALOGUE · 道法教材解读课"
          badge="1—9 年级 · 18 册教材"
          title="道法教材解读课"
          description="先看懂为什么教、到底教什么，再进入教学设计。"
          audience="建议先学总论，再按正在使用的册次查阅；三元对齐画布可随时用来追溯课标与教材单元的关系。"
          icon={BookOpen}
          stats={[{ label: '核心篇章', value: 2 }, { label: '视频单课', value: 22 }, { label: '交互画布', value: 1 }, { label: '教材册次', value: 18 }]}
        >
          {!authLoading && !hasAccess && <CoursePurchaseButton productCode="daofa-textbook" />}
        </CourseEditorialHero>
        <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-20 pt-8 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="course-editorial-toc self-start lg:sticky lg:top-24">
            <span className="editorial-kicker">CONTENTS · 课程索引</span>
            <nav aria-label="道法课程篇章" className="mt-4 space-y-2">
              {DAOFA_CHAPTERS.map((chapter, index) => <a key={chapter.id} href={`#${chapter.id}`} className="flex min-h-11 items-center justify-between rounded-ds-sm px-3 text-sm text-tx hover:bg-acl/40 hover:text-ac">
                <span>{String(index + 1).padStart(2, '0')} · {chapter.title}</span><span className="text-xs text-txt">{chapter.lessons.length} 项</span>
              </a>)}
            </nav>
            {!hasAccess && <p className="mt-6 border-t border-dashed border-bd pt-4 text-xs leading-6 text-txs"><LockKeyhole className="mr-1 inline h-3.5 w-3.5" />课程内容需开通“道法教材解读课”权限。</p>}
          </aside>
          <div className="space-y-12">
            {DAOFA_CHAPTERS.map((chapter, index) => <section key={chapter.id} id={chapter.id} className="scroll-mt-28">
              <div className="mb-4 flex items-end gap-4 border-b border-bd pb-5">
                <span className="font-serif text-4xl text-ac/60">{String(index + 1).padStart(2, '0')}</span>
                <div><p className="editorial-kicker">{index === 0 ? 'FOUNDATION' : 'BOOK BY BOOK'}</p><h2 className="mt-1 font-ds-black text-2xl text-tx" style={{ fontFamily: 'var(--fd)' }}>{chapter.title}</h2><p className="mt-2 text-sm leading-6 text-txs">{chapter.description}</p></div>
              </div>
              <ol className="overflow-hidden rounded-ds-sm border border-bd bg-[var(--paper)]">
                {chapter.lessons.map((lesson, lessonIndex) => <li key={lesson.id} className="border-b border-dashed border-bd last:border-b-0">
                  <Link to={`/courses/daofa/${lesson.id}`} className="group flex min-h-20 items-center gap-4 px-4 py-4 transition-colors hover:bg-acl/25 focus-visible:bg-acl/25 sm:px-6">
                    <span className="w-7 shrink-0 font-mono text-xs text-txt">{String(lessonIndex + 1).padStart(2, '0')}</span>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-bd text-ac">{lesson.kind === 'canvas' ? <Compass className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}</span>
                    <span className="min-w-0 flex-1"><span className="block font-ds-bold text-tx group-hover:text-ac">{lesson.title}</span><span className="mt-1 block text-xs leading-5 text-txs">{lesson.subtitle}</span></span>
                    <span className="hidden shrink-0 text-xs text-txt sm:block">{lesson.kind === 'canvas' ? '交互阅读' : '视频课程'}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ac transition-transform group-hover:translate-x-1" />
                  </Link>
                </li>)}
              </ol>
            </section>)}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  </>;
}
