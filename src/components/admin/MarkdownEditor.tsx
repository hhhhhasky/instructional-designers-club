import { useEffect, useRef, useState } from 'react';
import { Bold, Heading2, List, Link2, Image as ImageIcon, Eye, Pencil, Loader2, Upload } from 'lucide-react';
import MarkdownRenderer from '@/components/common/MarkdownRenderer';
import { uploadCourseImage } from '@/db/course-media';
import { cn } from '@/lib/utils';

/**
 * 轻量 Markdown 编辑器：textarea + 工具栏 + 写作/预览切换。
 * 面向非技术运营，工具栏一键插入常用语法，预览实时查看效果。
 */
export default function MarkdownEditor({
  value,
  onChange,
  placeholder = '在此编写正文（支持 Markdown：标题、列表、加粗、链接、图片等）',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const latestValueRef = useRef(value);
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  const commitValue = (next: string) => {
    latestValueRef.current = next;
    onChange(next);
  };

  /** 在光标处插入/包裹文本，并保留选区与焦点 */
  const apply = (fn: (selected: string) => { text: string; caret?: number }) => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const { text, caret } = fn(selected);
    const next = value.slice(0, start) + text + value.slice(end);
    commitValue(next);
    setMode('write');
    requestAnimationFrame(() => {
      ta.focus();
      const pos = caret ?? (start + text.length);
      ta.setSelectionRange(pos, pos);
    });
  };

  const tools = {
    bold: () =>
      apply((sel) => {
        const inner = sel || '加粗文本';
        const text = `**${inner}**`;
        return { text };
      }),
    heading: () =>
      apply((sel) => {
        const inner = sel || '小节标题';
        return { text: `## ${inner}` };
      }),
    list: () =>
      apply((sel) => {
        const inner = sel || '列表项';
        return { text: `- ${inner}` };
      }),
    link: () =>
      apply(() => ({ text: `[链接文字](https://)` })),
    image: () =>
      apply(() => ({ text: `![图片说明](图片URL)` })),
  };

  const handleImageUpload = async (file: File | undefined) => {
    if (!file) return;

    setMode('write');
    setUploadError(null);

    const ta = ref.current;
    const start = ta?.selectionStart ?? latestValueRef.current.length;
    const end = ta?.selectionEnd ?? start;
    const uploadId = crypto.randomUUID();
    const alt = file.name.replace(/\.[^.]+$/, '').replace(/[\[\]]/g, ' ').trim() || '课程图片';
    const placeholder = `![${alt}](uploading-image-${uploadId})`;
    const current = latestValueRef.current;
    commitValue(current.slice(0, start) + placeholder + current.slice(end));
    setUploading(true);

    try {
      const url = await uploadCourseImage(file);
      const next = latestValueRef.current.replace(placeholder, `![${alt}](${url})`);
      commitValue(next);
      requestAnimationFrame(() => {
        const position = next.indexOf(url) + url.length + 1;
        ref.current?.focus();
        ref.current?.setSelectionRange(position, position);
      });
    } catch (error) {
      commitValue(latestValueRef.current.replace(placeholder, ''));
      setUploadError(error instanceof Error ? error.message : '图片上传失败，请重试');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="border border-bd rounded-ds-lg overflow-hidden bg-bg">
      {/* 工具栏 + 模式切换 */}
      <div className="flex items-center justify-between border-b border-bdl bg-bgs/60 px-2 py-1.5">
        <div className="flex items-center gap-0.5">
          <ToolButton title="加粗" onClick={tools.bold}>
            <Bold className="w-4 h-4" />
          </ToolButton>
          <ToolButton title="标题" onClick={tools.heading}>
            <Heading2 className="w-4 h-4" />
          </ToolButton>
          <ToolButton title="列表" onClick={tools.list}>
            <List className="w-4 h-4" />
          </ToolButton>
          <ToolButton title="链接" onClick={tools.link}>
            <Link2 className="w-4 h-4" />
          </ToolButton>
          <ToolButton title="图片" onClick={tools.image}>
            <ImageIcon className="w-4 h-4" />
          </ToolButton>
          <ToolButton
            title={uploading ? '图片上传中' : '上传本地图片'}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          </ToolButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            aria-label="选择要上传的图片"
            className="sr-only"
            onChange={(event) => void handleImageUpload(event.target.files?.[0])}
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode('write')}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded text-ds-xs transition-colors',
              mode === 'write' ? 'bg-ac text-white' : 'text-txs hover:text-tx'
            )}
          >
            <Pencil className="w-3.5 h-3.5" />
            写作
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded text-ds-xs transition-colors',
              mode === 'preview' ? 'bg-ac text-white' : 'text-txs hover:text-tx'
            )}
          >
            <Eye className="w-3.5 h-3.5" />
            预览
          </button>
        </div>
      </div>

      {/* 编辑 / 预览区 */}
      {mode === 'write' ? (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => commitValue(e.target.value)}
          placeholder={placeholder}
          rows={14}
          className="w-full px-4 py-3 text-ds-sm font-mono leading-relaxed bg-bg text-tx placeholder:text-txt/70 focus:outline-none resize-y"
        />
      ) : (
        <div className="px-5 py-4 min-h-[14rem] max-h-[28rem] overflow-y-auto bg-bg">
          {value.trim() ? (
            <MarkdownRenderer content={value} />
          ) : (
            <p className="text-txs text-ds-sm">（暂无内容可预览）</p>
          )}
        </div>
      )}
      {uploadError && (
        <p role="alert" className="border-t border-bdl bg-red-50 px-4 py-2 text-ds-xs text-red-700">
          {uploadError}
        </p>
      )}
    </div>
  );
}

function ToolButton({
  title,
  onClick,
  disabled = false,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center w-7 h-7 rounded text-txs hover:bg-bg hover:text-ac disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
    >
      {children}
    </button>
  );
}
