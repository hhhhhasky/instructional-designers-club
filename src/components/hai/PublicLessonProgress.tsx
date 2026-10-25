import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { title: "输入需求", description: "选择教材，说明课堂需求" },
  { title: "确定教什么", description: "选择学生最需要发生的转变" },
  { title: "确定怎么教", description: "比较并选择合适的教学模式" },
  { title: "生成教案", description: "展开完整、可调整的教学设计" },
] as const;

type StepState = "current" | "complete" | "upcoming" | "unavailable";

export default function PublicLessonProgress({ current = 0, focusConfirmed = false, modeConfirmed = false, completed = false, legacy = false }: {
  current?: number; focusConfirmed?: boolean; modeConfirmed?: boolean; completed?: boolean; legacy?: boolean;
}) {
  function state(index: number): StepState {
    if (index === 1 && legacy) return "unavailable";
    if ((index === 0 && current > 0) || (index === 1 && focusConfirmed) || (index === 2 && modeConfirmed) || (index === 3 && completed)) return "complete";
    return index === current ? "current" : "upcoming";
  }
  return <ol aria-label="公开课设计四阶段" className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
    {steps.map((step, index) => {
      const status = state(index);
      return <li key={step.title} aria-current={status === "current" ? "step" : undefined} className="min-w-0">
        <div className="mb-2 flex items-center gap-2" aria-hidden="true">
          <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold", status === "current" ? "border-[var(--proof)] bg-[var(--proof)] text-white" : status === "complete" ? "border-[var(--proof)] text-[var(--proof)]" : "border-[var(--paper-rule)] text-txs", status === "unavailable" && "border-dashed")}>
            {status === "complete" ? <Check className="h-3.5 w-3.5" /> : index + 1}
          </span>
          <span className="h-px flex-1 bg-[var(--paper-rule)]" />
        </div>
        <p className={cn("text-sm font-bold", status === "current" ? "text-[var(--proof)]" : "text-tx")}>{step.title}</p>
        <p className="mt-1 text-xs leading-5 text-txs">{status === "unavailable" ? "本任务未单独确认" : step.description}</p>
        <span className="sr-only">{status === "current" ? "当前阶段" : status === "complete" ? "已完成" : status === "upcoming" ? "尚未开始" : "未单独确认"}</span>
      </li>;
    })}
  </ol>;
}
