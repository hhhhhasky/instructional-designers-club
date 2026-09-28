import { ArrowLeft, ArrowRight, BookOpen, LockKeyhole, PlayCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Footer from '@/components/common/Footer';
import PageMeta from '@/components/common/PageMeta';
import Header from '@/components/layout/Header';
import CoursePurchaseButton from '@/components/course/CoursePurchaseButton';
import { useAuth } from '@/contexts/AuthContext';
import { getDaofaLessonMedia } from '@/db/daofa-media';
import { canAccessCourse } from '@/lib/access-control';
import { DAOFA_CHAPTERS, DAOFA_LESSONS, getDaofaLesson } from '@/lib/daofa-course';

export default function DaofaLessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { user, profile, courseAccessCodes, loading } = useAuth();
  const userId = user?.id;
  const lesson = getDaofaLesson(lessonId);
  const chapter = DAOFA_CHAPTERS.find((item) => item.lessons.some((entry) => entry.id === lessonId));
  const index = DAOFA_LESSONS.findIndex((item) => item.id === lessonId);
  const hasAccess = profile?.role === 'admin' || canAccessCourse(courseAccessCodes, 'daofa-textbook');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaError, setMediaError] = useState('');
  const [mediaLoading, setMediaLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setMediaUrl('');
    setMediaError('');
    setMediaLoading(false);
    if (loading || !userId || !hasAccess || !lesson || (lesson.kind === 'video' && !lesson.mediaAvailable)) return;
    let active = true;
    setMediaLoading(true);
    getDaofaLessonMedia(lesson.id)
      .then((url) => { if (active) setMediaUrl(url); })
      .catch((error) => { if (active) setMediaError(error instanceof Error ? error.message : '课程媒体暂时无法加载'); })
      .finally(() => { if (active) setMediaLoading(false); });
    return () => { active = false; };
  }, [hasAccess, lesson, loading, retryCount, userId]);

  if (lesson?.kind === 'canvas') return <>
    <PageMeta title={`${lesson.title}｜道法教材解读课`} description={lesson.subtitle} noIndex />
    <main className="relative h-screen w-full overflow-hidden bg-[#102f2b]" style={{ height: '100dvh' }}>
      {loading ? <div className="flex h-full items-center justify-center text-sm text-white">正在确认课程权限…</div>
        : !hasAccess ? <div className="flex h-full flex-col items-center justify-center px-6 text-center text-white">
          <LockKeyhole className="h-9 w-9 text-[#d0a453]" />
          <h1 className="mt-4 text-xl font-ds-bold">尚未开通道法教材解读课</h1>
          <p className="mt-3 text-sm text-white/70">请联系课程管理员为当前账号开通课程权限。</p>
          <div className="mt-6"><CoursePurchaseButton productCode="daofa-textbook" /></div>
        </div> : mediaUrl ? <iframe
          title="课标素养、内容要求与教材单元三元对齐画布"
          src={mediaUrl}
          sandbox="allow-scripts"
          className="absolute inset-0 h-full w-full border-0"
        /> : mediaError ? <div className="flex h-full flex-col items-center justify-center gap-4 text-sm text-white"><p>{mediaError}</p><button type="button" className="rounded-lg border border-white/40 px-4 py-2" onClick={() => setRetryCount((count) => count + 1)}>重新加载</button></div>
          : <div className="flex h-full items-center justify-center text-sm text-white">{mediaLoading ? '正在载入画布…' : '正在准备画布…'}</div>}
      <Link to="/courses/daofa" className="absolute right-4 top-4 z-10 inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/25 bg-[#102f2b] px-4 text-sm font-ds-bold text-white shadow-lg transition-colors hover:bg-[#24554e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0a453] sm:right-6">
        <ArrowLeft className="h-4 w-4" />返回课程目录
      </Link>
    </main>
  </>;

  return <>
    <PageMeta title={`${lesson?.title ?? '课程'}｜道法教材解读课`} description={lesson?.subtitle ?? '道法教材解读课'} noIndex />
    <div className="min-h-screen bg-cream flex flex-col">
      <Header />
      <main className="flex-1 px-4 pb-20 pt-24 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <Link to="/courses/daofa" className="inline-flex min-h-11 items-center gap-2 text-sm text-txs hover:text-ac"><ArrowLeft className="h-4 w-4" />返回课程目录</Link>
          {!lesson ? <div className="mt-10 rounded-ds-sm border border-bd bg-[var(--paper)] p-8 text-center"><h1 className="font-ds-bold text-xl text-tx">没有找到这节课</h1></div>
            : <>
              <header className="mt-4 border-y border-bd py-7 sm:py-10">
                <p className="editorial-kicker">DAOFA · {chapter?.title}</p>
                <h1 className="mt-3 font-ds-black text-3xl leading-tight text-tx sm:text-5xl" style={{ fontFamily: 'var(--fd)' }}>{lesson.title}</h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-txs sm:text-base">{lesson.subtitle}</p>
              </header>

              {loading ? <div className="py-20 text-center text-txs">正在确认课程权限…</div>
                : !hasAccess ? <div className="mx-auto mt-12 max-w-xl rounded-ds-sm border border-bd bg-[var(--paper)] p-8 text-center">
                  <LockKeyhole className="mx-auto h-8 w-8 text-ac" />
                  <h2 className="mt-4 font-ds-bold text-xl text-tx">尚未开通道法教材解读课</h2>
                  <p className="mt-3 text-sm leading-6 text-txs">请联系课程管理员为当前账号开通课程权限。</p>
                  <div className="mt-6"><CoursePurchaseButton productCode="daofa-textbook" /></div>
                </div> : <div className="mt-8 grid gap-8 lg:grid-cols-[235px_minmax(0,1fr)]">
                  <aside className="course-editorial-toc self-start lg:sticky lg:top-24">
                    <span className="editorial-kicker">LEARNING PATH · 学习目录</span>
                    <nav aria-label="道法课程目录" className="mt-3 max-h-[65vh] space-y-1 overflow-y-auto">
                      {DAOFA_CHAPTERS.map((section) => <div key={section.id} className="pt-3 first:pt-0">
                        <p className="px-2 text-xs font-ds-bold text-txt">{section.title}</p>
                        {section.lessons.map((item) => <Link key={item.id} to={`/courses/daofa/${item.id}`} aria-current={item.id === lesson.id ? 'page' : undefined} className={`mt-1 block rounded-ds-sm px-2 py-2 text-xs leading-5 ${item.id === lesson.id ? 'bg-acl text-ac font-ds-bold' : 'text-txs hover:bg-bgs hover:text-ac'}`}>{item.title}</Link>)}
                      </div>)}
                    </nav>
                  </aside>
                  <div className="min-w-0">
                    <section className="rounded-ds-sm border border-bd bg-[var(--paper)] p-5 sm:p-8">
                      <div className="mb-5 flex items-center gap-2"><PlayCircle className="h-5 w-5 text-ac" /><h2 className="font-ds-bold text-lg text-tx">课程视频</h2></div>
                      {mediaUrl ? <video controls playsInline preload="metadata" src={mediaUrl} className="aspect-video w-full rounded-ds-sm bg-[#102f2b]" /> : mediaError ? <div className="flex aspect-video flex-col items-center justify-center gap-4 rounded-ds-sm bg-[#102f2b] px-5 text-center text-white"><p>{mediaError}</p><button type="button" className="rounded-lg border border-white/40 px-4 py-2" onClick={() => setRetryCount((count) => count + 1)}>重新加载</button></div> : mediaLoading ? <div className="flex aspect-video items-center justify-center rounded-ds-sm bg-[#102f2b] text-sm text-white">正在加载视频…</div> : <div className="flex aspect-video flex-col items-center justify-center rounded-ds-sm bg-[#102f2b] px-5 text-center text-white">
                        <BookOpen className="h-10 w-10 text-[#d0a453]" />
                        <p className="mt-5 font-ds-bold text-lg">视频即将上线</p>
                        <p className="mt-2 text-sm text-white/65">课程目录已准备好，视频发布后可在这里直接学习。</p>
                      </div>}
                    </section>
                    <nav aria-label="前后单课" className="mt-8 flex items-center justify-between gap-4 border-t border-bd pt-5 text-sm">
                      {index > 0 ? <Link to={`/courses/daofa/${DAOFA_LESSONS[index - 1].id}`} className="inline-flex min-h-11 items-center gap-2 text-ac hover:underline"><ArrowLeft className="h-4 w-4" />上一项</Link> : <span />}
                      {index < DAOFA_LESSONS.length - 1 && <Link to={`/courses/daofa/${DAOFA_LESSONS[index + 1].id}`} className="inline-flex min-h-11 items-center gap-2 text-ac hover:underline">下一项<ArrowRight className="h-4 w-4" /></Link>}
                    </nav>
                  </div>
                </div>}
            </>}
        </div>
      </main>
      <Footer />
    </div>
  </>;
}
