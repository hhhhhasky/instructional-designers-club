import { useRef, useState } from 'react';
import { Headphones, CheckCircle2, Images as ImagesIcon, Video, FileText, Sparkles, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import MarkdownRenderer from '@/components/common/MarkdownRenderer';
import type { Course } from '@/types/types';

// 课程内容形态：用于卡片/目录上的「视频/图文/音频/精华/图集」标识。
export type CourseContentFormat = 'video' | 'audio' | 'article' | 'essence' | 'images';

export interface ContentFormatMeta {
  key: CourseContentFormat;
  label: string;
  icon: LucideIcon;
}

export const CONTENT_FORMATS: Record<CourseContentFormat, ContentFormatMeta> = {
  video: { key: 'video', label: '视频', icon: Video },
  audio: { key: 'audio', label: '音频', icon: Headphones },
  article: { key: 'article', label: '图文', icon: FileText },
  essence: { key: 'essence', label: '精华', icon: Sparkles },
  images: { key: 'images', label: '图集', icon: ImagesIcon },
};

// 顺序即展示顺序：视频 > 图文 > 音频 > 精华 > 图集
const FORMAT_ORDER: CourseContentFormat[] = ['video', 'article', 'audio', 'essence', 'images'];

/**
 * 解析一门课包含的内容形态（视频/图文/音频/精华/图集）。
 * 与本组件内部的载体判定保持同一套口径，供列表卡片、目录项复用。
 */
export function getCourseContentFormats(course: Course): CourseContentFormat[] {
  const present: CourseContentFormat[] = [];
  if (course.video_url) present.push('video');
  if (course.body?.trim()) present.push('article');
  if (course.audio_url) present.push('audio');
  if (course.essence?.trim()) present.push('essence');
  if ((course.images ?? []).filter(Boolean).length > 0) present.push('images');
  return FORMAT_ORDER.filter((f) => present.includes(f));
}

/**
 * 课程多载体内容栈：按 音频 → 正文 → 图集 顺序叠加渲染存在的载体。
 * 运营填哪个显示哪个；都没有则返回 null（页面回退到纯视频/简介行为）。
 *
 * 进度解耦：组件内部持有 audioRef 并计算播放百分比，
 * 通过 onAudioProgress(0-100) / onAudioEnded 回调上抛，由父页写入学习记录。
 */
export default function CourseContentStack({
  course,
  onAudioProgress,
  onAudioEnded,
  onMarkComplete,
  isCompleted = false,
}: {
  course: Course;
  onAudioProgress?: (percent: number) => void;
  onAudioEnded?: () => void;
  onMarkComplete?: () => void;
  isCompleted?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const images = (course.images ?? []).filter(Boolean);
  const hasAudio = !!course.audio_url;
  const hasBody = !!course.body?.trim();
  const hasImages = images.length > 0;
  const hasAny = hasAudio || hasBody || hasImages;

  // 纯文本/图集课（无可追踪进度的音视频）才显示「标记为已学完」
  const showMarkComplete =
    !!onMarkComplete && !course.video_url && !course.audio_url && (hasBody || hasImages);

  if (!hasAny && !showMarkComplete) return null;

  const handleAudioTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || !audio.duration || !onAudioProgress) return;
    onAudioProgress(Math.round((audio.currentTime / audio.duration) * 100));
  };

  return (
    <section className="pt-7 pb-6 border-b border-bdl space-y-7">
      {/* 音频讲解 */}
      {hasAudio && (
        <div>
          <h2 className="text-xl font-bold text-tx font-serif mb-3 flex items-center gap-2">
            <Headphones className="w-4 h-4 text-ac" />
            音频讲解
          </h2>
          <div className="bg-bgs rounded-ds-md p-4">
            <audio
              ref={audioRef}
              src={course.audio_url ?? undefined}
              controls
              preload="metadata"
              className="w-full"
              onTimeUpdate={handleAudioTimeUpdate}
              onEnded={onAudioEnded}
            />
          </div>
        </div>
      )}

      {/* 正文（Markdown） */}
      {hasBody && (
        <div>
          <h2 className="text-xl font-bold text-tx font-serif mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-ac" />
            正文
          </h2>
          <article className="bg-bgs/40 rounded-ds-md px-5 py-4">
            <MarkdownRenderer content={course.body as string} />
          </article>
        </div>
      )}

      {/* 图片集 */}
      {hasImages && (
        <div>
          <h2 className="text-xl font-bold text-tx font-serif mb-3 flex items-center gap-2">
            <ImagesIcon className="w-4 h-4 text-ac" />
            图片集
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((url, idx) => (
              <button
                key={`${url}-${idx}`}
                type="button"
                onClick={() => setLightbox(url)}
                className="block overflow-hidden rounded-ds-md border border-bdl bg-bgs aspect-square hover:opacity-90 transition-opacity"
              >
                <img
                  src={url}
                  alt={`图片 ${idx + 1}`}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 纯文本/图集课：标记完成 */}
      {showMarkComplete && (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant={isCompleted ? 'secondary' : 'default'}
            onClick={onMarkComplete}
            disabled={isCompleted}
            className="min-w-[10rem]"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isCompleted ? '已学完' : '标记为已学完'}
          </Button>
        </div>
      )}

      {/* 图片放大灯箱 */}
      <Dialog open={lightbox !== null} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-none">
          <DialogTitle className="sr-only">图片预览</DialogTitle>
          <DialogDescription className="sr-only">
            查看当前课程图片的大图预览。
          </DialogDescription>
          {lightbox && (
            <img src={lightbox} alt="图片预览" className="w-full h-auto block" />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
