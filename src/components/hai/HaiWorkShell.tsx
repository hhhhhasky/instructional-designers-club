import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import HaiWorkspaceShell from "@/components/hai/HaiWorkspaceShell";

export default function HaiWorkShell({
  children,
  sidebar,
  inspector,
  title = "帮你干活",
  subtitle = "把备课问题变成可交付的工作产物",
  workspaceMode = "production",
  contentMode = "scroll",
  compactHeader = false,
  headerActions,
}: {
  children: ReactNode;
  sidebar?: ReactNode;
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
