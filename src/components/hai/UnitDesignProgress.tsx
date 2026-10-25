import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  ["输入备课信息", "选择教材与范围，说明课时和学情"],
  ["确定教学模式", "比较组织思路，由你确认主模式"],
  ["生成单元整体设计", "审核目标、评价与课时安排"],
  ["完成整套课时教案", "逐课展开，交付整体设计与详案"],
];

export default function UnitDesignProgress({ current = 0, completed = false }: { current?: number; completed?: boolean }) {
  return <ol aria-label="大单元教学四步流程" className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
    {steps.map(([title, description], index) => {
      const done = completed || index < current;
      const active = !completed && index === current;
      return <li key={title} aria-current={active ? "step" : undefined} className={cn("min-w-0 border-b-2 pb-3", active ? "border-[var(--annotation)]" : "border-[var(--paper-rule)]")}>
        <span aria-hidden="true" className={cn("mb-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold", active || done ? "bg-[var(--annotation-soft)] text-[var(--annotation)]" : "bg-[var(--paper-deep)] text-txs")}>
          {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
        </span>
        <p className={cn("text-sm font-bold leading-6", active ? "text-[var(--annotation)]" : "text-tx")}>{title}</p>
        <p className="mt-1 text-xs leading-5 text-txs">{description}</p>
        <span className="sr-only">{active ? "当前步骤" : done ? "已完成" : "尚未开始"}</span>
      </li>;
    })}
  </ol>;
}
