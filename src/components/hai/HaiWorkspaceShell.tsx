import { NavLink, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Menu,
  MessageCircleMore,
  PanelRight,
} from "lucide-react";
import { useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import HaiUserMenu from "@/components/hai/HaiUserMenu";
import type { HaiUsageSummary } from "@/db/hai-api";
import HaiDesktopModeSwitch from "@/components/hai/HaiDesktopModeSwitch";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useHaiExit } from "@/lib/hai-navigation";
import { cn } from "@/lib/utils";

function HaiSidebarContent({ children, usage }: { children: ReactNode; usage?: HaiUsageSummary | null }) {
  return <>
    <div className="shrink-0 p-3 pb-2">
      <NavLink to="/hai/work" state={{ newTask: true }} className={({ isActive }) => cn(
        "flex min-h-14 items-center gap-3 rounded-xl border px-3 py-3 transition-colors",
        isActive
          ? "border-[var(--annotation)] bg-[var(--annotation-soft)] text-[var(--annotation)]"
          : "border-[var(--paper-rule)] text-[var(--ink)] hover:bg-[var(--paper)]",
      )}>
        <BriefcaseBusiness aria-hidden className="h-5 w-5 shrink-0" />
        <span><strong className="block text-sm">帮你干活</strong><span className="mt-1 block text-xs font-normal text-[var(--txs)]">写教案 · 改设计 · 做图片</span></span>
      </NavLink>
    </div>
    <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    <div className="shrink-0 border-t border-[var(--paper-rule)] px-3 pb-[env(safe-area-inset-bottom)] pt-3">
      <NavLink to="/hai/chat" className={({ isActive }) => cn(
        "flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs transition-colors hover:bg-[var(--paper)]",
        isActive ? "bg-[var(--paper)] text-[var(--annotation)]" : "text-[var(--txs)]",
      )}>
        <MessageCircleMore aria-hidden className="h-4 w-4 shrink-0" />
        <span><span className="block text-[11px] text-[var(--txt)]">还没想清楚？</span><span className="mt-1 block">先聊聊问题</span></span>
      </NavLink>
      <HaiUserMenu usage={usage} />
    </div>
  </>;
}

// 可调宽布局:桌面三栏宽度本地持久化(仅 resizable 页面启用;移动端走 Sheet 不受影响)。
const HAI_LAYOUT_STORAGE_KEY = "hai-work-layout";
const HAI_LAYOUT_DEFAULTS = { sidebar: 232, inspector: 280 };
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
  usage?: HaiUsageSummary | null;
  inspector?: ReactNode;
  sidebarLabel?: string;
  inspectorLabel?: string;
  mobileSidebarOpen?: boolean;
  onMobileSidebarOpenChange?: (open: boolean) => void;
  hideMobileSidebarClose?: boolean;
  sidebarPadded?: boolean;
  headerActions?: ReactNode;
  contentMode?: "managed" | "scroll";
  contentClassName?: string;
  resizable?: boolean;
  compactHeader?: boolean;
};

export default function HaiWorkspaceShell({
  children,
  mode,
  title,
  subtitle: _subtitle,
  sidebar,
  usage,
  inspector,
  sidebarLabel = "打开记录",
  inspectorLabel = "打开校样档案",
  mobileSidebarOpen,
  onMobileSidebarOpenChange,
  hideMobileSidebarClose = false,
  sidebarPadded: _sidebarPadded = true,
  headerActions,
  contentMode = "scroll",
  contentClassName,
  resizable = false,
  compactHeader = false,
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
  const workspaceLocation = useLocation();
  const isWorkChild = workspaceLocation.pathname.startsWith("/hai/work/") || (workspaceLocation.pathname === "/hai/work" && workspaceLocation.state?.imagePpt);
  const showInspectorColumn = Boolean(inspector) && mode !== "consultation";

  useEffect(() => {
    document.body.classList.add("hai-chat-active");
    return () => document.body.classList.remove("hai-chat-active");
  }, []);

  return (
    <div className="hai-page flex min-h-0 w-full max-w-full flex-col overflow-hidden bg-[var(--paper)] md:h-dvh print:h-auto print:overflow-visible print:bg-white">
      <main className="flex min-h-0 flex-1 overflow-hidden print:block print:overflow-visible print:p-0">
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--paper)] print:h-auto print:max-w-none print:overflow-visible print:border-0 print:shadow-none">
          <header className={cn("flex shrink-0 items-center justify-between gap-3 border-b border-[var(--paper-rule)] bg-[var(--paper)]/95 px-3 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] backdrop-blur md:px-5 print:hidden", compactHeader ? "md:py-1.5" : "md:py-2")}>
            <div className="flex min-w-0 items-center gap-2.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={exitHai}
                aria-label={isWorkChild ? "返回帮你干活主页" : "返回官网首页"}
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
                      "flex w-[min(320px,88vw)] flex-col gap-0 overflow-hidden bg-[var(--paper-deep)] p-0 pt-[calc(2.5rem+env(safe-area-inset-top))]",
                    )}
                    hideCloseButton={hideMobileSidebarClose}
                  >
                    <HaiSidebarContent usage={usage}>{sidebar}</HaiSidebarContent>
                  </SheetContent>
                </Sheet>
              )}
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h1 className={cn("truncate font-serif font-black tracking-tight text-[var(--ink)]", compactHeader ? "text-sm" : "text-base md:text-lg")}>
                    {title}
                  </h1>
                </div>
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
                      className={showInspectorColumn ? "xl:hidden" : undefined}
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
                ? cn("hai-work-resizable-grid", !showInspectorColumn && "hai-work-resizable-grid--no-inspector")
                : showInspectorColumn
                  ? "lg:grid-cols-[232px_minmax(0,1fr)] xl:grid-cols-[232px_minmax(0,1fr)_280px]"
                  : "lg:grid-cols-[232px_minmax(0,1fr)]",
            )}
            style={resizable ? ({
              "--hai-sidebar-w": `${layout.sidebar}px`,
              "--hai-inspector-w": `${layout.inspector}px`,
            } as HaiLayoutCSSVars) : undefined}
          >
            <aside className={cn(
              "hidden min-h-0 flex-col overflow-hidden border-r border-[var(--paper-rule)] bg-[var(--paper-deep)] lg:flex print:hidden",
            )}>
              <HaiSidebarContent usage={usage}>{sidebar}</HaiSidebarContent>
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
            {resizable && showInspectorColumn && (
              <div
                aria-hidden
                className="hidden w-1.5 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-ac/25 active:bg-ac/40 xl:block print:hidden"
                onPointerDown={(event) => startDrag("inspector", event)}
              />
            )}
            {showInspectorColumn && (
              <aside className="hidden min-h-0 overflow-y-auto border-l border-[var(--paper-rule)] bg-[var(--bg)] p-4 xl:block print:hidden">
                {inspector}
              </aside>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
