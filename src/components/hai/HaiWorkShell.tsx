import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import type { HaiUsageSummary } from "@/db/hai-api";
import HaiWorkspaceShell from "@/components/hai/HaiWorkspaceShell";

export default function HaiWorkShell({
  children,
  sidebar,
  usage,
  inspector,
  title = "帮你干活",
  subtitle = "分析教学问题，帮你写教案、做课件",
  workspaceMode = "production",
  contentMode = "scroll",
  compactHeader = false,
  headerActions,
}: {
  children: ReactNode;
  sidebar?: ReactNode;
  usage?: HaiUsageSummary | null;
  inspector?: ReactNode;
  title?: string;
  subtitle?: string;
  workspaceMode?: "production" | "proof";
  contentMode?: "managed" | "scroll";
  compactHeader?: boolean;
  headerActions?: ReactNode;
}) {
  const location = useLocation();
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => { setHistoryOpen(false); }, [location.key]);
  return (
    <HaiWorkspaceShell
      mode={workspaceMode}
      sidebar={sidebar}
      usage={usage}
      mobileSidebarOpen={historyOpen}
      onMobileSidebarOpenChange={setHistoryOpen}
      inspector={inspector}
      sidebarLabel="打开任务记录"
      inspectorLabel="打开历史版本"
      compactHeader={compactHeader}
      headerActions={headerActions}
      title={title}
      subtitle={subtitle}
      contentMode={contentMode}
      resizable
    >
      {children}
    </HaiWorkspaceShell>
  );
}
