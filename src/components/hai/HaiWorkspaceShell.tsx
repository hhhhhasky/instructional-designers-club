import {
  ArrowLeft,
  BriefcaseBusiness,
  FileCheck2,
  Menu,
  NotebookPen,
  PanelRight,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import HaiDesktopModeSwitch from "@/components/hai/HaiDesktopModeSwitch";
import Header from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useHaiExit } from "@/lib/hai-navigation";
import { cn } from "@/lib/utils";

export type HaiWorkspaceMode = "consultation" | "production" | "proof";

type HaiWorkspaceShellProps = {
  children: ReactNode;
  mode: HaiWorkspaceMode;
  title: string;
  subtitle: string;
  sidebar?: ReactNode;
  inspector?: ReactNode;
  sidebarLabel?: string;
  inspectorLabel?: string;
  mobileSidebarOpen?: boolean;
  onMobileSidebarOpenChange?: (open: boolean) => void;
  hideMobileSidebarClose?: boolean;
  sidebarPadded?: boolean;
  headerActions?: ReactNode;
  footer?: ReactNode;
  contentMode?: "managed" | "scroll";
  contentClassName?: string;
};

const modePresentation = {
  consultation: {
    label: "咨询笔记",
    Icon: NotebookPen,
    iconClassName: "bg-[var(--proof-soft)] text-[var(--proof)]",
  },
  production: {
    label: "教研生产台",
    Icon: BriefcaseBusiness,
    iconClassName: "bg-[var(--annotation-soft)] text-[var(--annotation)]",
  },
  proof: {
    label: "校样档案",
    Icon: FileCheck2,
    iconClassName: "bg-[var(--paper-deep)] text-[var(--ink)]",
  },
} satisfies Record<HaiWorkspaceMode, {
  label: string;
  Icon: typeof NotebookPen;
  iconClassName: string;
}>;

export default function HaiWorkspaceShell({
  children,
  mode,
  title,
  subtitle,
  sidebar,
  inspector,
  sidebarLabel = "打开记录",
  inspectorLabel = "打开校样档案",
  mobileSidebarOpen,
  onMobileSidebarOpenChange,
  hideMobileSidebarClose = false,
  sidebarPadded = true,
  headerActions,
  footer,
  contentMode = "scroll",
  contentClassName,
}: HaiWorkspaceShellProps) {
  const exitHai = useHaiExit();
  const presentation = modePresentation[mode];
  const WorkspaceIcon = presentation.Icon;

  useEffect(() => {
    document.body.classList.add("hai-chat-active");
    return () => document.body.classList.remove("hai-chat-active");
  }, []);

  return (
    <div className="hai-page flex min-h-0 w-full max-w-full flex-col overflow-hidden bg-[var(--paper-deep)] md:min-h-screen print:h-auto print:overflow-visible print:bg-white">
      <div className="hidden md:block print:hidden">
        <Header />
      </div>
      <main className="flex min-h-0 flex-1 overflow-hidden md:px-5 md:pb-6 md:pt-20 print:block print:overflow-visible print:p-0">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1500px] flex-col overflow-hidden border-[var(--paper-rule)] bg-[var(--paper)] md:h-[calc(100dvh-7rem)] md:rounded-ds-xl md:border md:shadow-ds-xl print:h-auto print:max-w-none print:overflow-visible print:border-0 print:shadow-none">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--paper-rule)] bg-[var(--paper)]/95 px-3 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] backdrop-blur md:px-5 md:py-3 print:hidden">
            <div className="flex min-w-0 items-center gap-2.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={exitHai}
                aria-label="返回网站"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              {sidebar && (
                <Sheet
                  open={mobileSidebarOpen}
                  onOpenChange={onMobileSidebarOpenChange}
                >
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 lg:hidden"
                      aria-label={sidebarLabel}
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    className={cn(
                      "w-[min(320px,88vw)] overflow-y-auto bg-[var(--paper-deep)]",
                      sidebarPadded
                        ? "p-4 pt-[calc(3rem+env(safe-area-inset-top))]"
                        : "p-0 pt-[env(safe-area-inset-top)]",
                    )}
                    hideCloseButton={hideMobileSidebarClose}
                  >
                    {sidebar}
                  </SheetContent>
                </Sheet>
              )}
              <div className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-md shadow-ds-sm",
                presentation.iconClassName,
              )}>
                <WorkspaceIcon className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h1 className="truncate font-serif text-base font-black tracking-tight text-[var(--ink)] md:text-lg">
                    {title}
                  </h1>
                  <span className="editorial-stamp hidden shrink-0 sm:inline-flex">{presentation.label}</span>
                </div>
                <p className="hidden truncate text-xs text-[var(--ink-muted)] sm:block">{subtitle}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerActions}
              <HaiDesktopModeSwitch />
              {inspector && (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      className="xl:hidden"
                      aria-label={inspectorLabel}
                    >
                      <PanelRight className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="right"
                    className="w-[min(340px,92vw)] overflow-y-auto bg-[var(--bg)] p-4 pt-[calc(3rem+env(safe-area-inset-top))]"
                  >
                    {inspector}
                  </SheetContent>
                </Sheet>
              )}
            </div>
          </header>

          <div className={cn(
            "grid min-h-0 flex-1 print:block print:overflow-visible",
            inspector
              ? "lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_280px]"
              : "lg:grid-cols-[260px_minmax(0,1fr)]",
          )}>
            <aside className={cn(
              "hidden min-h-0 overflow-y-auto border-r border-[var(--paper-rule)] bg-[var(--paper-deep)] lg:block print:hidden",
              sidebarPadded && "p-4",
            )}>
              {sidebar}
            </aside>
            <section className={cn(
              "min-h-0 min-w-0 bg-[var(--paper)] print:overflow-visible print:bg-white",
              contentMode === "managed"
                ? "flex h-full flex-col overflow-hidden"
                : "hai-work-scroll overflow-y-auto overscroll-contain",
              contentClassName,
            )}>
              {children}
            </section>
            {inspector && (
              <aside className="hidden min-h-0 overflow-y-auto border-l border-[var(--paper-rule)] bg-[var(--bg)] p-4 xl:block print:hidden">
                {inspector}
              </aside>
            )}
          </div>
        </div>
      </main>
      {footer && <div className="hidden md:block print:hidden">{footer}</div>}
    </div>
  );
}
