import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/common/Footer";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import PageMeta from "@/components/common/PageMeta";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface AdminPageShellProps {
  title: string;
  description: string;
  currentPath: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function AdminPageShell({
  title,
  description,
  currentPath,
  actions,
  children,
}: AdminPageShellProps) {
  const navigate = useNavigate();
  const { user, profile, loading, session } = useAuth();
  const initialCheckDone = useRef(false);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const prefix = "[admin-refresh-diagnostics]";
    const log = (event: string, data?: Record<string, unknown>) => {
      console.info(prefix, event, {
        at: new Date().toISOString(),
        path: window.location.pathname,
        expectedPath: currentPath,
        pageTitle: title,
        visibilityState: document.visibilityState,
        ...data,
      });
    };

    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    log("admin page mounted", {
      navigationType: navigation?.type,
    });

    const handleBeforeUnload = () => {
      log("beforeunload: browser is about to leave/reload this page");
    };
    const handlePageHide = (event: PageTransitionEvent) => {
      log("pagehide: page is being hidden/unloaded", {
        persisted: event.persisted,
      });
    };
    const handleVisibilityChange = () => {
      log("visibilitychange", {
        hidden: document.hidden,
      });
    };
    const handleError = (event: ErrorEvent) => {
      log("window error", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };
    const handleResourceError = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const resourceUrl =
        target instanceof HTMLScriptElement ? target.src :
        target instanceof HTMLLinkElement ? target.href :
        target instanceof HTMLImageElement ? target.currentSrc || target.src :
        null;

      if (!resourceUrl) return;

      const resourcePath = new URL(resourceUrl).pathname;
      const recentResources = performance
        .getEntriesByType("resource")
        .filter((entry): entry is PerformanceResourceTiming => "initiatorType" in entry)
        .filter((entry) => entry.name === resourceUrl || entry.name.includes(resourcePath))
        .slice(-3)
        .map((entry) => ({
          name: entry.name,
          initiatorType: entry.initiatorType,
          transferSize: entry.transferSize,
          duration: Math.round(entry.duration),
          responseStatus: "responseStatus" in entry
            ? (entry as PerformanceResourceTiming & { responseStatus?: number }).responseStatus
            : undefined,
        }));

      log("resource load error", {
        tagName: target.tagName,
        resourceUrl,
        recentResources,
      });
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      log("unhandled promise rejection", {
        reason: String(event.reason),
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("error", handleError);
    window.addEventListener("error", handleResourceError, true);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    const hot = import.meta.hot;
    const handleViteBeforeUpdate = (payload: unknown) => {
      log("vite:beforeUpdate", { payload });
    };
    const handleViteBeforeFullReload = (payload: unknown) => {
      log("vite:beforeFullReload", { payload });
    };
    const handleViteError = (payload: unknown) => {
      log("vite:error", { payload });
    };

    hot?.on("vite:beforeUpdate", handleViteBeforeUpdate);
    hot?.on("vite:beforeFullReload", handleViteBeforeFullReload);
    hot?.on("vite:error", handleViteError);

    return () => {
      log("admin page unmounted");
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("error", handleError);
      window.removeEventListener("error", handleResourceError, true);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      hot?.off("vite:beforeUpdate", handleViteBeforeUpdate);
      hot?.off("vite:beforeFullReload", handleViteBeforeFullReload);
      hot?.off("vite:error", handleViteError);
    };
  }, [currentPath, title]);

  useEffect(() => {
    if (loading && !initialCheckDone.current) return;
    if (!user) {
      navigate("/login", { state: { from: currentPath } });
      return;
    }
    initialCheckDone.current = true;
  }, [user?.id, loading, navigate, currentPath]);

  if (loading && !session) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <LoadingOverlay message="正在确认登录状态..." />
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center pt-20 px-4">
          <div className="text-center">
            <p className="text-txs mb-4">请先登录</p>
            <Button onClick={() => navigate("/login")}>前往登录</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center pt-20 px-4">
          <div className="text-center max-w-sm">
            <p className="text-tx font-ds-semibold mb-2">
              账号已登录，用户资料暂未准备好
            </p>
            <p className="text-txs text-ds-sm mb-4">
              请稍后刷新；如果一直出现，请联系管理员。
            </p>
            <Button onClick={() => window.location.reload()}>刷新页面</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (profile.role !== "admin") {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center pt-20 px-4">
          <div className="text-center max-w-sm">
            <ShieldCheck className="w-12 h-12 text-ac mx-auto mb-4" />
            <p className="text-tx font-ds-bold text-ds-xl mb-2">无访问权限</p>
            <p className="text-txs text-ds-sm mb-4">
              管理员页面仅对管理员开放，当前账号无管理员权限。
            </p>
            <Button onClick={() => navigate("/")}>返回首页</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <PageMeta title={title} description="" noIndex />
      <div className="min-h-screen bg-[#f4efe7] flex flex-col">
        <Header />
        <main className="relative flex-1 overflow-hidden px-4 pb-14 pt-20">
          <div className="pointer-events-none absolute left-[-120px] top-32 h-72 w-72 rounded-full bg-ac/5 blur-3xl" />
          <div className="pointer-events-none absolute right-[-80px] top-[420px] h-64 w-64 rounded-full bg-tl/5 blur-3xl" />
          <div className="relative mx-auto max-w-[1400px] animate-fade-in pt-4 md:pt-7">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <button
                  onClick={() => navigate("/")}
                  className="group mb-3 inline-flex items-center gap-1.5 text-ds-xs font-ds-bold text-txs transition-colors hover:text-ac"
                >
                  <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                  返回俱乐部前台
                </button>
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-ds-lg bg-[#173d39] shadow-ds-md">
                    <ShieldCheck className="h-5 w-5 text-[#efb393]" />
                  </div>
                  <div>
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="text-[10px] font-ds-black tracking-[0.18em] text-ac">ADMIN STUDIO</span>
                      <span className="h-1 w-1 rounded-full bg-am" />
                      <span className="text-[10px] text-txt">仅管理员可见</span>
                    </div>
                    <h1 className="font-serif text-ds-2xl font-ds-black tracking-tight text-tx md:text-ds-3xl">{title}</h1>
                    <p className="mt-0.5 text-ds-xs text-txs md:text-ds-sm">{description}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">{actions}</div>
            </div>

            {children}
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
