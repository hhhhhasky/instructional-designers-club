import type { ReactNode } from 'react';

export default function HaiHistorySidebar({ title, action, children }: { title: string; action: ReactNode; children: ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col" data-testid="hai-history-sidebar">
    <div className="flex h-12 shrink-0 items-center justify-between gap-2 px-4">
      <h2 className="text-2xl font-bold tracking-wide text-txs">{title}</h2>
      {action}
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">{children}</div>
  </div>;
}

export const HAI_HISTORY_ROW_CLASS = "group flex rounded-md border border-transparent transition hover:bg-[var(--paper)]";

export function formatHistoryDate(value: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}
