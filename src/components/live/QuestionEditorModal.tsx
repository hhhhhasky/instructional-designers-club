import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LiveQuestionInput } from "@/db/live-api";
import {
  LIVE_QUESTION_TYPE_LABELS,
  type AdminLiveQuestion,
  type LiveQuestionType,
} from "@/lib/live";

const OPTION_IDS = ["A", "B", "C", "D"] as const;

interface QuestionEditorForm {
  title: string;
  type: LiveQuestionType;
  content: string;
  optionText: string[];
  correctSingle: string;
  correctMultiple: string[];
  correctBoolean: boolean;
}

const EMPTY_FORM: QuestionEditorForm = {
  title: "",
  type: "single_choice",
  content: "",
  optionText: ["", "", "", ""],
  correctSingle: "A",
  correctMultiple: [],
  correctBoolean: true,
};

function questionToForm(question: AdminLiveQuestion | null): QuestionEditorForm {
  if (!question) return EMPTY_FORM;
  const optionText = [...OPTION_IDS].map((id) => question.options.find((option) => option.id === id)?.text ?? "");
  return {
    title: question.title,
    type: question.type,
    content: question.content,
    optionText,
    correctSingle: typeof question.correct_answer === "string" ? question.correct_answer : "A",
    correctMultiple: Array.isArray(question.correct_answer)
      ? question.correct_answer.filter((id): id is string => typeof id === "string")
      : [],
    correctBoolean: question.correct_answer !== false,
  };
}

interface QuestionEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: AdminLiveQuestion | null;
  locked: boolean;
  saving: boolean;
  onSave: (input: LiveQuestionInput) => Promise<void>;
}

export default function QuestionEditorModal({
  open,
  onOpenChange,
  question,
  locked,
  saving,
  onSave,
}: QuestionEditorModalProps) {
  const [form, setForm] = useState<QuestionEditorForm>(EMPTY_FORM);

  useEffect(() => {
    if (open) setForm(questionToForm(question));
  }, [open, question]);

  const changeType = (type: LiveQuestionType) => {
    setForm((prev) => ({
      ...prev,
      type,
      correctSingle: "A",
      correctMultiple: [],
      correctBoolean: true,
    }));
  };

  const toggleMultipleAnswer = (id: string) => {
    setForm((prev) => ({
      ...prev,
      correctMultiple: prev.correctMultiple.includes(id)
        ? prev.correctMultiple.filter((item) => item !== id)
        : [...prev.correctMultiple, id],
    }));
  };

  const handleSave = async () => {
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title) {
      toast.error("请填写题目标题");
      return;
    }
    if (!content) {
      toast.error("请填写题干");
      return;
    }

    if (form.type === "true_false") {
      await onSave({
        title,
        type: "true_false",
        content,
        options: [],
        correct_answer: form.correctBoolean,
      });
      return;
    }

    const options = OPTION_IDS.map((id, index) => ({
      id,
      text: form.optionText[index]?.trim() ?? "",
    })).filter((option) => option.text.length > 0);
    if (options.length < 2) {
      toast.error("至少填写两个非空选项");
      return;
    }
    const optionIds = new Set<string>(options.map((option) => option.id));

    if (form.type === "single_choice") {
      if (!optionIds.has(form.correctSingle)) {
        toast.error("正确答案必须是已填写的选项");
        return;
      }
      await onSave({
        title,
        type: "single_choice",
        content,
        options,
        correct_answer: form.correctSingle,
      });
      return;
    }

    const correctMultiple = [...form.correctMultiple].sort();
    if (correctMultiple.length === 0 || correctMultiple.some((id) => !optionIds.has(id))) {
      toast.error("多选答案至少选择一个已填写的选项");
      return;
    }
    await onSave({
      title,
      type: "multiple_choice",
      content,
      options,
      correct_answer: correctMultiple,
    });
  };

  const inputClass = "w-full h-11 px-3 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all disabled:bg-warm disabled:text-txs";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{question ? "编辑题目" : "新建题目"}</DialogTitle>
          <DialogDescription>
            {locked
              ? "当前题已进入互动，题干、选项和答案均已锁定。"
              : "题目保存后只会进入题库，不会自动发布给学员。"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-ds-xs font-ds-semibold text-tx">题目标题</span>
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              disabled={locked || saving}
              placeholder="例如：教学目标的关键结构"
              className={inputClass}
            />
          </label>

          <fieldset className="grid gap-1.5" disabled={locked || saving}>
            <legend className="text-ds-xs font-ds-semibold text-tx">题目类型</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(LIVE_QUESTION_TYPE_LABELS) as LiveQuestionType[]).map((type) => (
                <label
                  key={type}
                  className={`cursor-pointer rounded-ds-pill border px-3 py-1.5 text-ds-xs transition-colors ${
                    form.type === type
                      ? "border-ac bg-acl text-ac font-ds-bold"
                      : "border-bd bg-bg text-txs hover:border-ac/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="live-question-type"
                    className="sr-only"
                    checked={form.type === type}
                    onChange={() => changeType(type)}
                  />
                  {LIVE_QUESTION_TYPE_LABELS[type]}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="grid gap-1.5">
            <span className="text-ds-xs font-ds-semibold text-tx">题干</span>
            <textarea
              value={form.content}
              onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
              disabled={locked || saving}
              rows={4}
              placeholder="写清楚题目情境和要学员判断的内容"
              className={`${inputClass} h-auto py-2.5 leading-7`}
            />
          </label>

          {form.type === "true_false" ? (
            <fieldset className="grid gap-2" disabled={locked || saving}>
              <legend className="text-ds-xs font-ds-semibold text-tx">正确答案</legend>
              <div className="flex gap-2">
                {[true, false].map((value) => (
                  <label
                    key={String(value)}
                    className={`cursor-pointer rounded-ds-pill border px-4 py-2 text-ds-xs transition-colors ${
                      form.correctBoolean === value
                        ? "border-tl bg-tll text-tl font-ds-bold"
                        : "border-bd bg-bg text-txs hover:border-tl/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="live-true-false-answer"
                      className="sr-only"
                      checked={form.correctBoolean === value}
                      onChange={() => setForm((prev) => ({ ...prev, correctBoolean: value }))}
                    />
                    {value ? "正确" : "错误"}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <div className="grid gap-3">
              <p className="text-ds-xs font-ds-semibold text-tx">选项与正确答案</p>
              {OPTION_IDS.map((id, index) => {
                const filled = (form.optionText[index] ?? "").trim().length > 0;
                return (
                  <div key={id} className="flex items-center gap-2">
                    {form.type === "single_choice" ? (
                      <input
                        type="radio"
                        name="live-single-answer"
                        aria-label={`正确答案 ${id}`}
                        checked={form.correctSingle === id}
                        onChange={() => setForm((prev) => ({ ...prev, correctSingle: id }))}
                        disabled={locked || saving || !filled}
                        className="h-4 w-4 accent-[var(--ac)]"
                      />
                    ) : (
                      <input
                        type="checkbox"
                        aria-label={`正确答案 ${id}`}
                        checked={form.correctMultiple.includes(id)}
                        onChange={() => toggleMultipleAnswer(id)}
                        disabled={locked || saving || !filled}
                        className="h-4 w-4 accent-[var(--ac)]"
                      />
                    )}
                    <span className="w-6 font-ds-bold text-ac">{id}</span>
                    <input
                      value={form.optionText[index] ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        setForm((prev) => ({
                          ...prev,
                          optionText: prev.optionText.map((item, itemIndex) => itemIndex === index ? value : item),
                        }));
                      }}
                      disabled={locked || saving}
                      placeholder={`选项 ${id}`}
                      className={inputClass}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={locked || saving}
            className="bg-ac text-white hover:bg-acd hover:text-white"
          >
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
