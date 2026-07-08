import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

type MarkdownSegment =
  | { type: 'markdown'; content: string }
  | { type: 'details'; summary: string; content: string };

const DETAILS_BLOCK_RE = /<details>\s*<summary>([\s\S]*?)<\/summary>\s*([\s\S]*?)<\/details>/gi;

function splitDetailsBlocks(content: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];
  let cursor = 0;

  for (const match of content.matchAll(DETAILS_BLOCK_RE)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      segments.push({ type: 'markdown', content: content.slice(cursor, index) });
    }
    segments.push({
      type: 'details',
      summary: match[1].trim(),
      content: match[2].trim(),
    });
    cursor = index + match[0].length;
  }

  if (cursor < content.length) {
    segments.push({ type: 'markdown', content: content.slice(cursor) });
  }

  return segments.length > 0 ? segments : [{ type: 'markdown', content }];
}

/**
 * 统一 Markdown 渲染组件（详情页正文 + 后台预览共用）。
 * 不启用任意 raw HTML，避免 XSS 与排版破坏；只对白名单的 details/summary 折叠块做结构化支持。
 *
 * 无 tailwindcss/typography 插件，故用 components 手动映射到设计系统 token。
 */
export default function MarkdownRenderer({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const segments = splitDetailsBlocks(content);

  return (
    <div
      className={cn(
        'font-body text-tx text-ds-md leading-relaxed break-words',
        className
      )}
    >
      {segments.map((segment, index) => {
        if (segment.type === 'details') {
          return (
            <details
              key={`${segment.summary}-${index}`}
              className="my-4 rounded-ds-lg border border-bdl bg-bgs/50 px-4 py-3"
            >
              <summary className="cursor-pointer select-none font-semibold text-tx marker:text-ac">
                {segment.summary}
              </summary>
              <div className="mt-3 border-t border-bdl pt-3">
                <MarkdownRenderer content={segment.content} />
              </div>
            </details>
          );
        }

        return <MarkdownBlock key={index} content={segment.content} />;
      })}
    </div>
  );
}

function MarkdownBlock({ content }: { content: string }) {
  if (!content.trim()) return null;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="font-serif text-2xl md:text-3xl font-black text-tx mt-7 mb-3 leading-tight">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="font-serif text-xl md:text-2xl font-bold text-tx mt-7 mb-3 flex items-center gap-2 leading-snug">
            <span className="inline-block w-1 h-5 bg-ac rounded-full" />
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="font-serif text-lg font-semibold text-tx mt-5 mb-2 leading-snug">
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="font-semibold text-tx mt-4 mb-2">{children}</h4>
        ),
        p: ({ children }) => <p className="my-3 leading-relaxed">{children}</p>,
        ul: ({ children }) => (
          <ul className="list-disc pl-6 my-3 space-y-1.5 marker:text-ac">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-6 my-3 space-y-1.5 marker:text-ac marker:font-semibold">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ac underline underline-offset-2 hover:text-acd transition-colors"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-ac/40 bg-bgs/60 pl-4 py-2 my-4 rounded-r-ds-md text-txs">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-bdl my-6" />,
        strong: ({ children }) => (
          <strong className="font-semibold text-tx">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        // 行内代码
        code: ({ className: cls, children, ...props }) => {
          const isBlock = typeof cls === 'string' && cls.includes('language-');
          if (isBlock) {
            return (
              <code className={cn('font-mono text-ds-sm text-tx', cls)} {...props}>
                {children}
              </code>
            );
          }
          return (
            <code className="bg-bgs text-am px-1.5 py-0.5 rounded text-ds-sm font-mono" {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="bg-bgs border border-bdl rounded-ds-lg p-4 overflow-x-auto my-4">
            {children}
          </pre>
        ),
        img: ({ src, alt }) => (
          <img
            src={typeof src === 'string' ? src : undefined}
            alt={alt ?? ''}
            loading="lazy"
            className="rounded-ds-lg my-4 max-w-full h-auto border border-bdl"
          />
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-4">
            <table className="w-full text-ds-sm border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-bdl bg-bgs px-3 py-2 text-left font-semibold text-tx">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-bdl px-3 py-2 align-top">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
