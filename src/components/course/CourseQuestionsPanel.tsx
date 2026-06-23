import { useEffect, useMemo, useState } from "react";
import { MessageCircle, RefreshCw, Send, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  createCourseQuestion,
  createCourseQuestionReply,
  getCourseQuestions,
  getCourseQuestionTags,
} from "@/db/course-questions";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { Course, CourseQuestionTag, CourseQuestionWithDetails } from "@/types/types";

const MAX_TEXT_LENGTH = 2000;

interface CourseQuestionsPanelProps {
  course: Course;
}

export default function CourseQuestionsPanel({ course }: CourseQuestionsPanelProps) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<CourseQuestionWithDetails[]>([]);
  const [tags, setTags] = useState<CourseQuestionTag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState("");
  const [questionBody, setQuestionBody] = useState("");
  const [questionAnonymous, setQuestionAnonymous] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyAnonymous, setReplyAnonymous] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [savingReplyId, setSavingReplyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const courseTag = useMemo(() => {
    if (!course.category) return null;
    return tags.find((tag) => tag.name === course.category) ?? null;
  }, [course.category, tags]);

  useEffect(() => {
    if (!selectedTagId && courseTag) {
      setSelectedTagId(courseTag.id);
    }
  }, [courseTag, selectedTagId]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [questionData, tagData] = await Promise.all([
        getCourseQuestions(course.id),
        getCourseQuestionTags(),
      ]);
      setQuestions(questionData);
      setTags(tagData);
    } catch {
      setError("课程问答加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [course.id]);

  const handleSubmitQuestion = async () => {
    if (!user) {
      toast.error("请先登录后再提问");
      return;
    }
    const body = questionBody.trim();
    if (!body) {
      toast.error("问题内容不能为空");
      return;
    }
    if (body.length > MAX_TEXT_LENGTH) {
      toast.error(`问题内容不能超过 ${MAX_TEXT_LENGTH} 字`);
      return;
    }

    try {
      setSavingQuestion(true);
      await createCourseQuestion({
        courseId: course.id,
        authorId: user.id,
        body,
        isAnonymous: questionAnonymous,
        tagIds: selectedTagId ? [selectedTagId] : [],
      });
      setQuestionBody("");
      setQuestionAnonymous(false);
      toast.success("问题已发布");
      await load();
    } catch {
      toast.error("发布失败，请确认账号权限后重试");
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleSubmitReply = async (questionId: string) => {
    if (!user) {
      toast.error("请先登录后再回复");
      return;
    }
    const body = (replyDrafts[questionId] ?? "").trim();
    if (!body) {
      toast.error("回复内容不能为空");
      return;
    }
    if (body.length > MAX_TEXT_LENGTH) {
      toast.error(`回复内容不能超过 ${MAX_TEXT_LENGTH} 字`);
      return;
    }

    try {
      setSavingReplyId(questionId);
      await createCourseQuestionReply({
        questionId,
        authorId: user.id,
        body,
        isAnonymous: Boolean(replyAnonymous[questionId]),
      });
      setReplyDrafts((drafts) => ({ ...drafts, [questionId]: "" }));
      setReplyAnonymous((values) => ({ ...values, [questionId]: false }));
      toast.success("回复已发布");
      await load();
    } catch {
      toast.error("回复失败，请稍后重试");
    } finally {
      setSavingReplyId(null);
    }
  };

  return (
    <section className="py-7 border-b border-bdl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-tx font-serif flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-ac" />
            课程问答
          </h2>
          <p className="text-sm text-txs mt-1">
            围绕本节课提出问题，和同学在这里补充讨论。
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} />
          刷新
        </Button>
      </div>

      <div className="rounded-ds-md border border-bd bg-bgs/40 p-4 mb-5">
        <div className="grid gap-3">
          <textarea
            value={questionBody}
            onChange={(event) => setQuestionBody(event.target.value)}
            maxLength={MAX_TEXT_LENGTH}
            rows={4}
            placeholder="写下你对这节课的疑问、实践卡点或想继续讨论的问题..."
            className="w-full resize-y rounded-ds-md border border-bd bg-white px-3 py-2 text-sm leading-relaxed text-tx focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20"
          />
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={selectedTagId}
                onChange={(event) => setSelectedTagId(event.target.value)}
                className="h-9 rounded-ds-md border border-bd bg-white px-3 text-sm text-tx focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20"
                aria-label="选择课程体系标签"
              >
                <option value="">不选择标签</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 text-sm text-txs">
                <input
                  type="checkbox"
                  checked={questionAnonymous}
                  onChange={(event) => setQuestionAnonymous(event.target.checked)}
                  className="h-4 w-4 rounded border-bd text-ac focus:ring-ac"
                />
                匿名提问
              </label>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-txs">
                {questionBody.trim().length}/{MAX_TEXT_LENGTH}
              </span>
              <Button type="button" onClick={handleSubmitQuestion} disabled={savingQuestion || !questionBody.trim()}>
                <Send className="w-4 h-4 mr-1" />
                {savingQuestion ? "发布中..." : "发布问题"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-ds-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-ds-md border border-bd bg-white px-4 py-6 text-center text-sm text-txs">
          正在加载课程问答...
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-ds-md border border-dashed border-bd bg-white px-4 py-8 text-center">
          <MessageCircle className="w-8 h-8 text-txs/50 mx-auto mb-2" />
          <p className="text-sm text-txs">还没有问题，欢迎提出第一个问题。</p>
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {questions.map((question) => (
            <AccordionItem
              key={question.id}
              value={question.id}
              className="rounded-ds-md border border-bd bg-white px-4"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex-1 text-left min-w-0 pr-3">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 text-xs text-txs">
                      <UserRound className="w-3.5 h-3.5" />
                      {question.author_display_name}
                    </span>
                    {question.tags.map((tag) => (
                      <span key={tag.id} className="rounded-full bg-acl px-2 py-0.5 text-xs text-ac">
                        {tag.name}
                      </span>
                    ))}
                    <span className="text-xs text-txs">{formatDate(question.created_at)}</span>
                  </div>
                  <p className="line-clamp-2 text-sm font-medium leading-relaxed text-tx whitespace-pre-wrap">
                    {question.body}
                  </p>
                  <p className="text-xs text-txs mt-2">{question.replies.length} 条回复</p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed text-tx whitespace-pre-wrap">{question.body}</p>
                  <div className="space-y-3">
                    {question.replies.map((reply) => (
                      <div key={reply.id} className="rounded-ds-md bg-bgs px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-txs mb-1.5">
                          <span>{reply.author_display_name}</span>
                          <span>{formatDate(reply.created_at)}</span>
                        </div>
                        <p className="text-sm leading-relaxed text-tx whitespace-pre-wrap">{reply.body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-ds-md border border-bdl bg-bgs/60 p-3">
                    <textarea
                      value={replyDrafts[question.id] ?? ""}
                      onChange={(event) =>
                        setReplyDrafts((drafts) => ({ ...drafts, [question.id]: event.target.value }))
                      }
                      maxLength={MAX_TEXT_LENGTH}
                      rows={3}
                      placeholder="回复这个问题..."
                      className="w-full resize-y rounded-ds-md border border-bd bg-white px-3 py-2 text-sm leading-relaxed text-tx focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20"
                    />
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <label className="inline-flex items-center gap-2 text-sm text-txs">
                        <input
                          type="checkbox"
                          checked={Boolean(replyAnonymous[question.id])}
                          onChange={(event) =>
                            setReplyAnonymous((values) => ({ ...values, [question.id]: event.target.checked }))
                          }
                          className="h-4 w-4 rounded border-bd text-ac focus:ring-ac"
                        />
                        匿名回复
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSubmitReply(question.id)}
                        disabled={savingReplyId === question.id || !(replyDrafts[question.id] ?? "").trim()}
                      >
                        <Send className="w-3.5 h-3.5 mr-1" />
                        {savingReplyId === question.id ? "发布中..." : "回复"}
                      </Button>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
