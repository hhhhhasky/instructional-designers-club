import { ArrowLeft, BriefcaseBusiness, Menu } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import HaiDesktopModeSwitch from "@/components/hai/HaiDesktopModeSwitch";
import Header from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useHaiExit } from "@/lib/hai-navigation";

export default function HaiWorkShell({
  children,
  sidebar,
  inspector,
  title = "帮你干活",
  subtitle = "把备课问题变成可交付的工作产物",
}: {
  children: ReactNode;
  sidebar?: ReactNode;
  inspector?: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const exitHai = useHaiExit();

  useEffect(() => {
    document.body.classList.add("hai-chat-active");
    return () => document.body.classList.remove("hai-chat-active");
  }, []);

  return (
    <div className="hai-page flex min-h-0 w-full max-w-full flex-col overflow-hidden bg-[#eee9df] md:min-h-screen">
      <div className="hidden md:block"><Header /></div>
      <main className="flex min-h-0 flex-1 overflow-hidden md:px-5 md:pb-6 md:pt-20">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1500px] flex-col overflow-hidden border-[#d9d0c1] bg-[#fffdf8] md:h-[calc(100dvh-7rem)] md:rounded-[28px] md:border md:shadow-[0_24px_70px_rgba(72,55,31,0.12)]">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#ded7ca] bg-[#fffdf8]/95 px-3 py-2.5 backdrop-blur md:px-5 md:py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={exitHai} aria-label="返回网站">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              {sidebar && (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 lg:hidden" aria-label="打开任务记录">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[300px] overflow-y-auto bg-[#f4efe5] p-4 pt-12">
                    {sidebar}
                  </SheetContent>
                </Sheet>
              )}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#263b34] text-[#f8ead1] shadow-[0_6px_16px_rgba(38,59,52,0.18)]">
                <BriefcaseBusiness className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-black tracking-tight text-[#2d302b] md:text-lg">{title}</h1>
                <p className="hidden truncate text-xs text-[#7c7469] sm:block">{subtitle}</p>
              </div>
            </div>
            <HaiDesktopModeSwitch />
          </header>

          <div className={`grid min-h-0 flex-1 ${inspector ? "lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_280px]" : "lg:grid-cols-[260px_minmax(0,1fr)]"}`}>
            <aside className="hidden min-h-0 overflow-y-auto border-r border-[#ded7ca] bg-[#f4efe5] p-4 lg:block">
              {sidebar}
            </aside>
            <section className="hai-work-scroll min-h-0 overflow-y-auto overscroll-contain bg-[#fffdf8]">
              {children}
            </section>
            {inspector && (
              <aside className="hidden min-h-0 overflow-y-auto border-l border-[#ded7ca] bg-[#f8f4ec] p-4 xl:block">
                {inspector}
              </aside>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
