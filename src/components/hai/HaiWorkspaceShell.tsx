import {
  ArrowLeft,
  BriefcaseBusiness,
  FileCheck2,
  Menu,
  NotebookPen,
  PanelRight,
} from "lucide-react";
import { useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import HaiDesktopModeSwitch from "@/components/hai/HaiDesktopModeSwitch";
import Header from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useHaiExit } from "@/lib/hai-navigation";
import { cn } from "@/lib/utils";

// 可调宽布局:桌面三栏宽度本地持久化(仅 resizable 页面启用;移动端走 Sheet 不受影响)。
const HAI_LAYOUT_STORAGE_KEY = "hai-work-layout";
const HAI_LAYOUT_DEFAULTS = { sidebar: 260, inspector: 280 };
const HAI_LAYOUT_LIMITS = {
  sidebar: { min: 200, max: 420 },
  inspector: { min: 220, max: 460 },
} as const;

type HaiLayout = { sidebar: number; inspector: number };
type HaiLayoutCSSVars = CSSProperties & Partial<Record<`--hai-${string}`, string>>;

function clampWidth(value: number, range: { min: number; max: number }) {
  return Math.min(range.max, Math.max(range.min, value));
}

function readHaiLayout(): HaiLayout {
  if (typeof window === "undefined") return { ...HAI_LAYOUT_DEFAULTS };
  try {
    const raw = window.localStorage.getItem(HAI_LAYOUT_STORAGE_KEY);
    if (!raw) return { ...HAI_LAYOUT_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<HaiLayout>;
    return {
      sidebar: clampWidth(Number(parsed.sidebar) || HAI_LAYOUT_DEFAULTS.sidebar, HAI_LAYOUT_LIMITS.sidebar),
      inspector: clampWidth(Number(parsed.inspector) || HAI_LAYOUT_DEFAULTS.inspector, HAI_LAYOUT_LIMITS.inspector),
    };
  } catch {
    return { ...HAI_LAYOUT_DEFAULTS };
  }
}

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
  resizable?: boolean;
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
  resizable = false,
}: HaiWorkspaceShellProps) {
  const [layout, setLayout] = useState<HaiLayout>(readHaiLayout);

  useEffect(() => {
    if (!resizable) return;
    try {
      window.localStorage.setItem(HAI_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // 无痕模式或配额不足时静默跳过。
    }
  }, [layout, resizable]);

  function startDrag(which: "sidebar" | "inspector", event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = layout[which];
    const range = HAI_LAYOUT_LIMITS[which];
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const handleMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      // 左栏向右拖变宽;右栏向左拖变宽,故取反。
      const next = clampWidth(which === "sidebar" ? startWidth + delta : startWidth - delta, range);
      setLayout((current) => ({ ...current, [which]: next }));
    };
    const handleUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

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

          <div
            className={cn(
              "grid min-h-0 flex-1 print:block print:overflow-visible",
              resizable
                ? cn("hai-work-resizable-grid", !inspector && "hai-work-resizable-grid--no-inspector")
                : inspector
                  ? "lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_280px]"
                  : "lg:grid-cols-[260px_minmax(0,1fr)]",
            )}
            style={resizable ? ({
              "--hai-sidebar-w": `${layout.sidebar}px`,
              "--hai-inspector-w": `${layout.inspector}px`,
            } as HaiLayoutCSSVars) : undefined}
          >
            <aside className={cn(
              "hidden min-h-0 overflow-y-auto border-r border-[var(--paper-rule)] bg-[var(--paper-deep)] lg:block print:hidden",
              sidebarPadded && "p-4",
            )}>
              {sidebar}
            </aside>
            {resizable && (
              <div
                aria-hidden
                className="hidden w-1.5 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-ac/25 active:bg-ac/40 lg:block print:hidden"
                onPointerDown={(event) => startDrag("sidebar", event)}
              />
            )}
            <section className={cn(
              "min-h-0 min-w-0 bg-[var(--paper)] print:overflow-visible print:bg-white",
              contentMode === "managed"
                ? "flex h-full flex-col overflow-hidden"
                : "hai-work-scroll overflow-y-auto overscroll-contain",
              contentClassName,
            )}>
              {children}
            </section>
            {resizable && inspector && (
              <div
                aria-hidden
                className="hidden w-1.5 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-ac/25 active:bg-ac/40 xl:block print:hidden"
                onPointerDown={(event) => startDrag("inspector", event)}
              />
            )}
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
