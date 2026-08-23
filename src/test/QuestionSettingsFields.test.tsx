import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import QuestionSettingsFields, {
  type QuestionSettingsOption,
  type QuestionSettingsTypeOption,
} from "@/components/questions/QuestionSettingsFields";

const types: QuestionSettingsTypeOption[] = [
  { value: "single_choice", label: "单选题", kind: "single" },
  { value: "multiple_choice", label: "多选题", kind: "multiple" },
  { value: "true_false", label: "判断题", kind: "true_false" },
  { value: "open_task", label: "开放性真实任务", kind: "text" },
];

function Harness() {
  const [type, setType] = useState("single_choice");
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<QuestionSettingsOption[]>([
    { key: "A", text: "" },
    { key: "B", text: "" },
    { key: "C", text: "" },
    { key: "D", text: "" },
  ]);
  const [correct, setCorrect] = useState<string[]>([]);

  function changeType(value: string) {
    setType(value);
    setCorrect([]);
    setOptions(value === "true_false"
      ? [{ key: "T", text: "正确" }, { key: "F", text: "错误" }]
      : [
        { key: "A", text: "" },
        { key: "B", text: "" },
        { key: "C", text: "" },
        { key: "D", text: "" },
      ]);
  }

  return (
    <QuestionSettingsFields
      type={type}
      types={types}
      prompt={prompt}
      options={options}
      correct={correct}
      namePrefix="test"
      onTypeChange={changeType}
      onPromptChange={setPrompt}
      onOptionsChange={setOptions}
      onCorrectChange={setCorrect}
    />
  );
}

describe("shared question settings fields", () => {
  it("shows all configured question types and edits single-choice options", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole("radio", { name: "单选题" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "多选题" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "判断题" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "开放性真实任务" })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("选项 A"), "形成性评价");
    await user.click(screen.getByRole("radio", { name: "正确答案 A" }));
    expect(screen.getByRole("radio", { name: "正确答案 A" })).toBeChecked();
  });

  it("switches to multiple choice and true/false answer controls", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("radio", { name: "多选题" }));
    await user.type(screen.getByPlaceholderText("选项 A"), "选项一");
    await user.type(screen.getByPlaceholderText("选项 B"), "选项二");
    await user.click(screen.getByRole("checkbox", { name: "正确答案 A" }));
    await user.click(screen.getByRole("checkbox", { name: "正确答案 B" }));
    expect(screen.getByRole("checkbox", { name: "正确答案 A" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "正确答案 B" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "判断题" }));
    await user.click(screen.getByRole("radio", { name: "错误" }));
    expect(screen.getByRole("radio", { name: "错误" })).toBeChecked();
  });
});
