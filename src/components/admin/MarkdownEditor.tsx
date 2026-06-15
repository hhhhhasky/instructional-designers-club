import { useRef, useState } from 'react';
import { Bold, Heading2, List, Link2, Image as ImageIcon, Eye, Pencil } from 'lucide-react';
import MarkdownRenderer from '@/components/common/MarkdownRenderer';
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
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  /** 在光标处插入/包裹文本，并保留选区与焦点 */
  const apply = (fn: (selected: string) => { text: string; caret?: number }) => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const { text, caret } = fn(selected);
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
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
          onChange={(e) => onChange(e.target.value)}
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
    </div>
  );
}

function ToolButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex items-center justify-center w-7 h-7 rounded text-txs hover:bg-bg hover:text-ac transition-colors"
    >
      {children}
    </button>
  );
}
