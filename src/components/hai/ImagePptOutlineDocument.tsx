import { useMemo, useState } from "react";
import { ArrowRight, FileText, Loader2, Pencil } from "lucide-react";
import MarkdownRenderer from "@/components/common/MarkdownRenderer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parsePptMarkdown } from "../../../supabase/functions/_shared/hai_image_ppt";

export default function ImagePptOutlineDocument({
  markdown,
  onChange,
  onRevise,
  onConfirm,
  busy,
  planning,
  canConfirm,
}: {
  markdown: string;
  onChange: (value: string) => void;
  onRevise: (feedback: string) => Promise<void>;
  onConfirm: () => void;
  busy: boolean;
  planning: boolean;
  canConfirm: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const parsed = useMemo(() => {
    try {
      return { pages: parsePptMarkdown(markdown), error: "" };
    } catch (error) {
      return {
        pages: [],
        error: error instanceof Error ? error.message : "请检查分页标题。",
      };
    }
  }, [markdown]);
  const locked = busy || planning;
  return (
    <div>
      {planning && (
        <div
          role="status"
          className="mb-5 flex items-start gap-3 rounded-xl bg-[var(--annotation-soft)] px-5 py-4 text-sm leading-6"
        >
          <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin text-[var(--annotation)]" />
          <div>
            <p>
              {markdown
                ? "正在根据你的意见修改整份大纲…"
                : "正在阅读教案，组织整套课件的思路…"}
            </p>
            <p className="mt-1 text-xs text-txs">
              可以离开页面，稍后从工作记录继续查看。
            </p>
          </div>
        </div>
      )}
      {(markdown || editing) && (
        <>
          <div className="overflow-hidden rounded-2xl border border-[var(--paper-rule)] bg-[var(--paper)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--paper-rule)] px-5 py-3 md:px-8">
              <div className="flex items-center gap-3 text-xs text-txs">
                <FileText className="h-4 w-4" />
                <span>课件文字大纲</span>
                {parsed.pages.length > 0 && (
                  <span className="border-l border-[var(--paper-rule)] pl-3">
                    共{parsed.pages.length}页
                  </span>
                )}
              </div>
              <div
                role="group"
                aria-label="大纲阅读与编辑"
                className="flex gap-1"
              >
                <Button
                  size="sm"
                  variant={editing ? "ghost" : "secondary"}
                  disabled={locked}
                  onClick={() => setEditing(false)}
                >
                  阅读
                </Button>
                <Button
                  size="sm"
                  variant={editing ? "secondary" : "ghost"}
                  disabled={locked}
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />编辑全文
                </Button>
              </div>
            </div>
            {editing
              ? (
                <div className="p-5 md:p-8">
                  <label
                    htmlFor="ppt-outline-document"
                    className="mb-3 block text-xs leading-6 text-txs"
                  >
                    用“##
                    第1页｜页面标题”区分页面，其余内容可以自由修改、增删或调整顺序。
                  </label>
                  <textarea
                    id="ppt-outline-document"
                    aria-label="课件文字大纲全文"
                    value={markdown}
                    disabled={locked}
                    onChange={(event) => onChange(event.target.value)}
                    className="min-h-[65vh] w-full resize-y border-0 bg-transparent font-mono text-sm leading-8 text-tx outline-none disabled:opacity-70"
                    spellCheck={false}
                  />
                </div>
              )
              : (
                <article
                  aria-label="课件文字大纲文档"
                  className="px-5 pb-10 pt-2 md:px-10 md:pb-14 md:pt-5"
                >
                  <MarkdownRenderer
                    content={markdown}
                    className="mx-auto max-w-3xl [&_h2]:scroll-mt-8"
                  />
                </article>
              )}
          </div>
          {parsed.error && (
            <p role="alert" className="mt-3 text-sm leading-6 text-amber-800">
              {parsed.error}
            </p>
          )}
          <div className="mt-7 border-t border-[var(--paper-rule)] pt-6">
            <label
              htmlFor="ppt-outline-feedback"
              className="font-serif text-lg font-bold"
            >
              想怎样调整这份大纲？
            </label>
            <p className="mb-3 mt-2 text-xs leading-6 text-txs">
              可以提出整体或某几页的修改意见，AI
              会基于你当前编辑的全文修改。文字修改按现有用量规则计费。
            </p>
            <textarea
              id="ppt-outline-feedback"
              aria-label="大纲修改意见"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              disabled={locked}
              maxLength={8000}
              placeholder="例如：把导入压缩成一页；第二个活动展开一些；讨论前先不要给出结论。"
              className={cn(
                "min-h-24 w-full resize-y rounded-xl border border-[var(--paper-rule)] bg-[var(--paper)] px-4 py-3 text-sm leading-7 outline-none focus:border-[var(--annotation)]",
                locked && "opacity-60",
              )}
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="outline"
                disabled={locked || !feedback.trim()}
                onClick={() => void onRevise(feedback.trim())}
              >
                {locked && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}按意见修改大纲
              </Button>
              <Button
                disabled={locked || !canConfirm || Boolean(parsed.error)}
                onClick={onConfirm}
              >
                确认大纲，选择风格<ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
