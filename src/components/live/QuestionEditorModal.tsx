import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import LiveAudienceFields from "@/components/live/LiveAudienceFields";
import QuestionSettingsFields, {
  type QuestionSettingsTypeOption,
} from "@/components/questions/QuestionSettingsFields";
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
  type LiveAdminParticipant,
  type LiveAudienceMode,
  type LiveQuestionType,
} from "@/lib/live";

const OPTION_IDS = ["A", "B", "C", "D"] as const;
const LIVE_QUESTION_TYPES: QuestionSettingsTypeOption[] = (
  Object.keys(LIVE_QUESTION_TYPE_LABELS) as LiveQuestionType[]
).map((type) => ({
  value: type,
  label: LIVE_QUESTION_TYPE_LABELS[type],
  kind: type === "single_choice" ? "single" : type === "multiple_choice" ? "multiple" : "true_false",
}));

interface QuestionEditorForm {
  title: string;
  type: LiveQuestionType;
  content: string;
  optionText: string[];
  correctSingle: string;
  correctMultiple: string[];
  correctBoolean: boolean;
  audienceMode: LiveAudienceMode;
  targetUserIds: string[];
  targetTags: string[];
}

const EMPTY_FORM: QuestionEditorForm = {
  title: "",
  type: "single_choice",
  content: "",
  optionText: ["", "", "", ""],
  correctSingle: "A",
  correctMultiple: [],
  correctBoolean: true,
  audienceMode: "all",
  targetUserIds: [],
  targetTags: [],
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
    audienceMode: question.audience_mode,
    targetUserIds: question.target_user_ids,
    targetTags: question.target_tags,
  };
}

interface QuestionEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: AdminLiveQuestion | null;
  locked: boolean;
  saving: boolean;
  participants: LiveAdminParticipant[];
  availableTags: string[];
  onlineUserIds: string[];
  onSave: (input: LiveQuestionInput) => Promise<void>;
}

export default function QuestionEditorModal({
  open,
  onOpenChange,
  question,
  locked,
  saving,
  participants,
  availableTags,
  onlineUserIds,
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
    if (form.audienceMode === "targeted" && form.targetUserIds.length === 0 && form.targetTags.length === 0) {
      toast.error("定向题目至少选择一位学员或一个标签");
      return;
    }

    const audience = {
      audience_mode: form.audienceMode,
      target_user_ids: form.audienceMode === "targeted" ? form.targetUserIds : [],
      target_tags: form.audienceMode === "targeted" ? form.targetTags : [],
    };

    if (form.type === "true_false") {
      await onSave({
        title,
        type: "true_false",
        content,
        options: [],
        correct_answer: form.correctBoolean,
        ...audience,
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
        ...audience,
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
      ...audience,
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

          <QuestionSettingsFields
            type={form.type}
            types={LIVE_QUESTION_TYPES}
            prompt={form.content}
            options={form.type === "true_false"
              ? [{ key: "true", text: "正确" }, { key: "false", text: "错误" }]
              : OPTION_IDS.map((key, index) => ({ key, text: form.optionText[index] ?? "" }))}
            correct={form.type === "multiple_choice"
              ? form.correctMultiple
              : form.type === "true_false"
                ? [String(form.correctBoolean)]
                : [form.correctSingle]}
            namePrefix="live"
            disabled={locked || saving}
            onTypeChange={(value) => changeType(value as LiveQuestionType)}
            onPromptChange={(content) => setForm((prev) => ({ ...prev, content }))}
            onOptionsChange={(options) => setForm((prev) => ({ ...prev, optionText: options.map((option) => option.text) }))}
            onCorrectChange={(correct) => setForm((prev) => ({
              ...prev,
              correctSingle: correct[0] ?? "A",
              correctMultiple: correct,
              correctBoolean: correct[0] !== "false",
            }))}
          />

          <LiveAudienceFields
            mode={form.audienceMode}
            targetUserIds={form.targetUserIds}
            targetTags={form.targetTags}
            participants={participants}
            availableTags={availableTags}
            onlineUserIds={onlineUserIds}
            disabled={locked || saving}
            onModeChange={(audienceMode) => setForm((prev) => ({ ...prev, audienceMode }))}
            onTargetUserIdsChange={(targetUserIds) => setForm((prev) => ({ ...prev, targetUserIds }))}
            onTargetTagsChange={(targetTags) => setForm((prev) => ({ ...prev, targetTags }))}
          />
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
