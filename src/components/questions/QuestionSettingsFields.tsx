export type QuestionSettingsKind = "single" | "multiple" | "true_false" | "text";

export interface QuestionSettingsTypeOption {
  value: string;
  label: string;
  kind: QuestionSettingsKind;
}

export interface QuestionSettingsOption {
  key: string;
  text: string;
}

interface QuestionSettingsFieldsProps {
  type: string;
  types: QuestionSettingsTypeOption[];
  prompt: string;
  options: QuestionSettingsOption[];
  correct: string[];
  namePrefix: string;
  disabled?: boolean;
  promptLabel?: string;
  promptPlaceholder?: string;
  onTypeChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onOptionsChange: (options: QuestionSettingsOption[]) => void;
  onCorrectChange: (correct: string[]) => void;
}

const inputClass = "w-full h-11 px-3 text-ds-sm border border-bd rounded-ds-lg bg-bg text-tx placeholder:text-txt focus:outline-none focus:border-ac focus:ring-2 focus:ring-ac/20 transition-all disabled:bg-warm disabled:text-txs";

export default function QuestionSettingsFields({
  type,
  types,
  prompt,
  options,
  correct,
  namePrefix,
  disabled = false,
  promptLabel = "题干",
  promptPlaceholder = "写清楚题目情境和要学员判断的内容",
  onTypeChange,
  onPromptChange,
  onOptionsChange,
  onCorrectChange,
}: QuestionSettingsFieldsProps) {
  const selectedType = types.find((option) => option.value === type);
  const kind = selectedType?.kind ?? "text";

  function selectAnswer(key: string) {
    if (kind === "multiple") {
      onCorrectChange(correct.includes(key)
        ? correct.filter((value) => value !== key)
        : [...correct, key]);
      return;
    }
    onCorrectChange([key]);
  }

  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-1.5" disabled={disabled}>
        <legend className="text-ds-xs font-ds-semibold text-tx">题目类型</legend>
        <div className="flex flex-wrap gap-2">
          {types.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-ds-pill border px-3 py-1.5 text-ds-xs transition-colors ${
                type === option.value
                  ? "border-ac bg-acl text-ac font-ds-bold"
                  : "border-bd bg-bg text-txs hover:border-ac/50"
              }`}
            >
              <input
                type="radio"
                name={`${namePrefix}-question-type`}
                className="sr-only"
                checked={type === option.value}
                onChange={() => onTypeChange(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="grid gap-1.5">
        <span className="text-ds-xs font-ds-semibold text-tx">{promptLabel}</span>
        <textarea
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          disabled={disabled}
          rows={4}
          placeholder={promptPlaceholder}
          className={`${inputClass} h-auto py-2.5 leading-7`}
        />
      </label>

      {kind === "true_false" ? (
        <fieldset className="grid gap-2" disabled={disabled}>
          <legend className="text-ds-xs font-ds-semibold text-tx">正确答案</legend>
          <div className="flex gap-2">
            {options.slice(0, 2).map((option) => (
              <label
                key={option.key}
                className={`cursor-pointer rounded-ds-pill border px-4 py-2 text-ds-xs transition-colors ${
                  correct.includes(option.key)
                    ? "border-tl bg-tll text-tl font-ds-bold"
                    : "border-bd bg-bg text-txs hover:border-tl/50"
                }`}
              >
                <input
                  type="radio"
                  name={`${namePrefix}-true-false-answer`}
                  className="sr-only"
                  checked={correct.includes(option.key)}
                  onChange={() => selectAnswer(option.key)}
                />
                {option.text}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (kind === "single" || kind === "multiple") ? (
        <div className="grid gap-3">
          <p className="text-ds-xs font-ds-semibold text-tx">选项与正确答案</p>
          {options.map((option, index) => {
            const filled = option.text.trim().length > 0;
            return (
              <div key={option.key} className="flex items-center gap-2">
                <input
                  type={kind === "multiple" ? "checkbox" : "radio"}
                  name={kind === "single" ? `${namePrefix}-single-answer` : undefined}
                  aria-label={`正确答案 ${option.key}`}
                  checked={correct.includes(option.key)}
                  onChange={() => selectAnswer(option.key)}
                  disabled={disabled || !filled}
                  className="h-4 w-4 accent-[var(--ac)]"
                />
                <span className="w-6 font-ds-bold text-ac">{option.key}</span>
                <input
                  value={option.text}
                  onChange={(event) => onOptionsChange(options.map((item, itemIndex) => (
                    itemIndex === index ? { ...item, text: event.target.value } : item
                  )))}
                  disabled={disabled}
                  placeholder={`选项 ${option.key}`}
                  className={inputClass}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
