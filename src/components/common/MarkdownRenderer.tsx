import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

/**
 * 统一 Markdown 渲染组件（详情页正文 + 后台预览共用）。
 * 不启用 raw HTML，避免 XSS 与排版破坏。
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
  return (
    <div
      className={cn(
        'font-body text-tx text-ds-md leading-relaxed break-words',
        className
      )}
    >
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
    </div>
  );
}
