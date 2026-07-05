import { Eye, EyeOff, MessageCircle, RotateCcw, Search, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import { Button } from "@/components/ui/button";
import {
  createCourseQuestionReply,
  getAdminCourseQuestions,
  updateCourseQuestionReplyStatus,
  updateCourseQuestionStatus,
} from "@/db/course-questions";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { AdminCourseQuestionItem, AdminCourseQuestionReply, CourseQuestionStatus } from "@/types/types";

const STATUS_OPTIONS: { value: "all" | CourseQuestionStatus; label: string }[] = [
  { value: "all", label: "全部状态" },
  { value: "visible", label: "可见" },
  { value: "hidden", label: "已隐藏" },
  { value: "deleted", label: "已删除" },
];

export default function CourseQuestionsManagementSection() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<AdminCourseQuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CourseQuestionStatus>("all");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingReplyId, setSavingReplyId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      setQuestions(await getAdminCourseQuestions());
    } catch {
      setError("加载课程问答失败，请刷新重试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter((question) => {
      const matchesStatus = statusFilter === "all" || question.status === statusFilter;
      const matchesSearch =
        !q ||
        question.body.toLowerCase().includes(q) ||
        question.course_title.toLowerCase().includes(q) ||
        (question.course_category ?? "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [questions, search, statusFilter]);

  const updateQuestionStatus = async (questionId: string, status: CourseQuestionStatus) => {
    try {
      setSavingKey(`question:${questionId}`);
      await updateCourseQuestionStatus(questionId, status);
      setQuestions((items) =>
        items.map((item) => item.id === questionId ? { ...item, status } : item)
      );
      toast.success("问题状态已更新");
    } catch {
      toast.error("更新问题状态失败");
    } finally {
      setSavingKey(null);
    }
  };

  const updateReplyStatus = async (
    questionId: string,
    replyId: string,
    status: CourseQuestionStatus,
  ) => {
    try {
      setSavingKey(`reply:${replyId}`);
      await updateCourseQuestionReplyStatus(replyId, status);
      setQuestions((items) =>
        items.map((item) =>
          item.id === questionId
            ? {
                ...item,
                replies: item.replies.map((reply) =>
                  reply.id === replyId ? { ...reply, status } : reply
                ),
              }
            : item
        )
      );
      toast.success("回复状态已更新");
    } catch {
      toast.error("更新回复状态失败");
    } finally {
      setSavingKey(null);
    }
  };

  const handleSubmitReply = async (questionId: string) => {
    if (!user) {
      toast.error("请先登录");
      return;
    }
    const body = (replyDrafts[questionId] ?? "").trim();
    if (!body) {
      toast.error("回复内容不能为空");
      return;
    }
    if (body.length > 2000) {
      toast.error("回复内容不能超过 2000 字");
      return;
    }

    try {
      setSavingReplyId(questionId);
      await createCourseQuestionReply({
        questionId,
        authorId: user.id,
        body,
        isAnonymous: false,
      });
      setReplyDrafts((drafts) => ({ ...drafts, [questionId]: "" }));
      toast.success("回复已发布");
      await load();
    } catch {
      toast.error("回复失败，请稍后重试");
    } finally {
      setSavingReplyId(null);
    }
  };

  if (loading) return <LoadingOverlay message="正在加载课程问答..." />;
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-txs mb-4">{error}</p>
        <button onClick={() => void load()} className="text-ac hover:underline">
          重新加载
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-ds-lg bg-gradient-to-br from-ac/5 to-am/5 border border-bd p-4">
        <div className="w-9 h-9 rounded-ds-full bg-acl flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-5 h-5 text-ac" />
        </div>
        <div className="text-ds-sm text-txs leading-relaxed">
          <p className="font-ds-semibold text-tx mb-0.5">课程问答管理</p>
          这里用于处理课程详情页内的学员提问和回复。隐藏会让普通用户前台不可见；删除为软删除，数据仍保留在数据库中。
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索课程或问题内容..."
              className="pl-9 pr-3 py-2 text-ds-sm bg-white border border-bd rounded-ds-md w-72 focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | CourseQuestionStatus)}
            className="px-3 py-2 text-ds-sm bg-white border border-bd rounded-ds-md focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <span className="text-ds-sm text-txs">共 {filtered.length} 条问题</span>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white border border-dashed border-bd rounded-ds-lg py-10 text-center text-txs">
            暂无符合条件的课程问答。
          </div>
        ) : (
          filtered.map((question) => (
            <article key={question.id} className="bg-white border border-bd rounded-ds-lg shadow-ds-xs overflow-hidden">
              <div className="p-4 border-b border-bdl">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <StatusBadge status={question.status} />
                      <span className="text-xs text-txs">{question.course_membership_type.toUpperCase()}</span>
                      <span className="text-xs text-txs">{formatDate(question.created_at)}</span>
                      {question.tags.map((tag) => (
                        <span key={tag.id} className="rounded-full bg-acl px-2 py-0.5 text-xs text-ac">
                          {tag.name}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm font-ds-semibold text-tx mb-1">
                      <a
                        href={`/#/courses/${question.course_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ac hover:underline"
                      >
                        {question.course_title}
                      </a>
                    </p>
                    <p className="text-sm text-tx leading-relaxed whitespace-pre-wrap">{question.body}</p>
                    <p className="text-xs text-txs mt-2">
                      作者：{question.author_display_name}
                      {question.is_anonymous && (
                        <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-600">
                          匿名
                        </span>
                      )}
                    </p>
                  </div>
                  <StatusActions
                    status={question.status}
                    disabled={savingKey === `question:${question.id}`}
                    onChange={(status) => updateQuestionStatus(question.id, status)}
                  />
                </div>
              </div>

              <div className="p-4 bg-bgs/40">
                <p className="text-xs font-ds-semibold text-txs mb-2">
                  回复 {question.replies.length}
                </p>

                {/* Admin reply form */}
                <div className="rounded-ds-md border border-bdl bg-white px-3 py-3 mb-3">
                  <textarea
                    value={replyDrafts[question.id] ?? ""}
                    onChange={(event) =>
                      setReplyDrafts((drafts) => ({ ...drafts, [question.id]: event.target.value }))
                    }
                    maxLength={2000}
                    rows={3}
                    placeholder="在此输入答疑回复..."
                    className="w-full resize-y rounded-ds-md border border-bd bg-white px-3 py-2 text-sm leading-relaxed text-tx focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-txs">
                      {(replyDrafts[question.id] ?? "").trim().length}/2000
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleSubmitReply(question.id)}
                      disabled={savingReplyId === question.id || !(replyDrafts[question.id] ?? "").trim()}
                    >
                      <Send className="w-3.5 h-3.5 mr-1" />
                      {savingReplyId === question.id ? "发布中..." : "答疑"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {question.replies.length === 0 ? (
                    <p className="text-sm text-txs">暂无回复。</p>
                  ) : (
                    question.replies.map((reply) => (
                      <ReplyRow
                        key={reply.id}
                        reply={reply}
                        disabled={savingKey === `reply:${reply.id}`}
                        onChange={(status) => updateReplyStatus(question.id, reply.id, status)}
                      />
                    ))
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function ReplyRow({
  reply,
  disabled,
  onChange,
}: {
  reply: AdminCourseQuestionReply;
  disabled: boolean;
  onChange: (status: CourseQuestionStatus) => void;
}) {
  return (
    <div className="rounded-ds-md border border-bdl bg-white px-3 py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <StatusBadge status={reply.status} />
            <span className="text-xs text-txs">{formatDate(reply.created_at)}</span>
            <span className="text-xs text-txs">
              作者：{reply.author_display_name}
              {reply.is_anonymous && (
                <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-600">
                  匿名
                </span>
              )}
            </span>
          </div>
          <p className="text-sm text-tx leading-relaxed whitespace-pre-wrap">{reply.body}</p>
        </div>
        <StatusActions status={reply.status} disabled={disabled} onChange={onChange} compact />
      </div>
    </div>
  );
}

function StatusActions({
  status,
  disabled,
  onChange,
  compact = false,
}: {
  status: CourseQuestionStatus;
  disabled: boolean;
  onChange: (status: CourseQuestionStatus) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", compact ? "md:justify-end" : "lg:justify-end")}>
      {status !== "visible" && (
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onChange("visible")}>
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          恢复
        </Button>
      )}
      {status !== "hidden" && (
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onChange("hidden")}>
          {status === "visible" ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
          隐藏
        </Button>
      )}
      {status !== "deleted" && (
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onChange("deleted")}>
          <Trash2 className="w-3.5 h-3.5 mr-1" />
          删除
        </Button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: CourseQuestionStatus }) {
  const label = status === "visible" ? "可见" : status === "hidden" ? "已隐藏" : "已删除";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs",
        status === "visible" && "bg-green-50 text-green-700",
        status === "hidden" && "bg-amber-50 text-amber-700",
        status === "deleted" && "bg-red-50 text-red-700",
      )}
    >
      {label}
    </span>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
