import { useEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { getDaofaLessonMedia } from '@/db/daofa-media';

// Reuse the private canvas delivery path, including its server-side course entitlement check.
export default function DaofaLessonHandout({ lessonId, title }: { lessonId: string; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  const [height, setHeight] = useState(900);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setError(false);
    setUrl('');
    getDaofaLessonMedia(`${lessonId}-handout`)
      .then((value) => { if (active) setUrl(value); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [lessonId, attempt]);

  useEffect(() => {
    const resize = (event: MessageEvent) => {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      if (event.data?.type !== 'daofa-handout-height' || !Number.isFinite(event.data.height)) return;
      setHeight(Math.min(200000, Math.max(500, Math.ceil(event.data.height))));
    };
    window.addEventListener('message', resize);
    return () => window.removeEventListener('message', resize);
  }, []);

  return <section className="overflow-hidden rounded-ds-sm border border-bd bg-[var(--paper)]" aria-label="图文讲义">
    <div className="flex items-center gap-2 border-b border-bd px-5 py-5 sm:px-8">
      <BookOpen className="h-5 w-5 text-ac" />
      <h2 className="font-ds-bold text-lg text-tx">图文讲义</h2>
      <span className="ml-auto text-xs text-txs">点击课件图片可放大</span>
    </div>
    {error ? <div className="p-8 text-center text-sm text-txs"><p>讲义暂时无法加载，请重试。</p><button type="button" className="mt-4 min-h-11 text-ac underline" onClick={() => setAttempt((value) => value + 1)}>重新加载讲义</button></div>
      : url ? <iframe ref={frame} title={`${title}图文讲义`} src={url} sandbox="allow-scripts" className="block w-full border-0" style={{ height }} />
        : <p role="status" className="p-8 text-center text-sm text-txs">正在加载图文讲义…</p>}
  </section>;
}
