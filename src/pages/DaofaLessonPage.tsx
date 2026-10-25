import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import PageMeta from '@/components/common/PageMeta';
import CoursePurchaseButton from '@/components/course/CoursePurchaseButton';
import { useAuth } from '@/contexts/AuthContext';
import { getDaofaLessonMedia } from '@/db/daofa-media';
import { canAccessCourse } from '@/lib/access-control';


export default function DaofaLessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { user, profile, courseAccessCodes, loading } = useAuth();
  const userId = user?.id;
  const isCanvas = lessonId === 'alignment-canvas';
  const hasAccess = profile?.role === 'admin' || canAccessCourse(courseAccessCodes, 'daofa-textbook');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaError, setMediaError] = useState('');
  const [mediaLoading, setMediaLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setMediaUrl('');
    setMediaError('');
    setMediaLoading(false);
    if (loading || !userId || !hasAccess || !isCanvas) return;
    let active = true;
    setMediaLoading(true);
    getDaofaLessonMedia('alignment-canvas')
      .then((url) => { if (active) setMediaUrl(url); })
      .catch((error) => { if (active) setMediaError(error instanceof Error ? error.message : '课程媒体暂时无法加载'); })
      .finally(() => { if (active) setMediaLoading(false); });
    return () => { active = false; };
  }, [hasAccess, isCanvas, loading, retryCount, userId]);

  if (isCanvas) return <>
    <PageMeta title="三元对齐画布｜道法教材解读课" description="课标素养、内容要求与教材单元对齐画布" noIndex />
    <main className="relative h-screen w-full overflow-hidden bg-[var(--sage-dark)]" style={{ height: '100dvh' }}>
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
      <Link to="/courses/daofa" className="absolute left-4 top-4 z-10 inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/25 bg-[var(--sage-dark)] px-4 text-sm font-ds-bold text-white shadow-lg transition-colors hover:bg-[var(--sage-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0a453] sm:left-6">
        <ArrowLeft className="h-4 w-4" />返回课程目录
      </Link>
    </main>
  </>;

  return <Navigate to="/courses/daofa" replace />;
}
