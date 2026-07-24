import type { ReactNode } from "react";
import HaiWorkspaceShell from "@/components/hai/HaiWorkspaceShell";

export default function HaiWorkShell({
  children,
  sidebar,
  inspector,
  title = "帮你干活",
  subtitle = "把备课问题变成可交付的工作产物",
  workspaceMode = "production",
}: {
  children: ReactNode;
  sidebar?: ReactNode;
  inspector?: ReactNode;
  title?: string;
  subtitle?: string;
  workspaceMode?: "production" | "proof";
}) {
  return (
    <HaiWorkspaceShell
      mode={workspaceMode}
      sidebar={sidebar}
      inspector={inspector}
      sidebarLabel="打开任务记录"
      inspectorLabel="打开历史版本"
      title={title}
      subtitle={subtitle}
      contentMode="scroll"
    >
      {children}
    </HaiWorkspaceShell>
  );
}
