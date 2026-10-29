import type { ReactNode } from "react";
import { useContext, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { SiteToolbarContext } from "@/components/layout/SiteToolbarContext";
import { ShieldCheck } from "lucide-react";
import PageBackBar from "@/components/common/PageBackBar";
import Footer from "@/components/common/Footer";
import LoadingOverlay from "@/components/common/LoadingOverlay";
import PageMeta from "@/components/common/PageMeta";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface AdminPageShellProps {
  title: string;
  description: string;
  currentPath: string;
  activeSection: "manage" | "dashboard";
  children: ReactNode;
}

export default function AdminPageShell({
  title,
  description,
  currentPath,
  activeSection,
  children,
}: AdminPageShellProps) {
  const navigate = useNavigate();
  const toolbarTarget = useContext(SiteToolbarContext);
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
        <PageBackBar />
        <LoadingOverlay message="正在确认登录状态..." />
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <PageBackBar />
        <main className="flex-1 flex items-center justify-center pt-4 px-4">
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
        <PageBackBar />
        <main className="flex-1 flex items-center justify-center pt-4 px-4">
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
        <PageBackBar />
        <main className="flex-1 flex items-center justify-center pt-4 px-4">
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
      <PageMeta title={title} description={description} noIndex />
      <div className="min-h-screen bg-[var(--paper)] flex flex-col">
        <PageBackBar />
        <main className="min-w-0 flex-1 pb-10">
          {toolbarTarget ? createPortal(<AdminTopNav activeSection={activeSection} />, toolbarTarget) : <AdminTopNav activeSection={activeSection} />}
          <div className="min-w-0 px-3 py-5 sm:px-4 md:px-6">
            {children}
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

function AdminTopNav({ activeSection }: { activeSection: AdminPageShellProps["activeSection"] }) {
  return (
    <nav className="flex h-14 min-w-0 flex-1 items-center gap-3" aria-label="平台管理后台导航">
      <Link to="/admin" className="hidden shrink-0 items-center gap-2 text-base font-bold text-tx sm:flex"><ShieldCheck className="h-4 w-4 text-ac" /><span>平台管理后台</span></Link>
      <div className="flex h-full min-w-0 items-center gap-1 overflow-x-auto">
        <AdminTopLink to="/admin/manage" label="数据管理" active={activeSection === "manage"} />
        <AdminTopLink to="/admin" label="数据看板" active={activeSection === "dashboard"} />
      </div>
    </nav>
  );
}

function AdminTopLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return <Link to={to} aria-current={active ? "page" : undefined} className={`inline-flex min-h-9 shrink-0 items-center rounded-lg px-3 text-sm font-semibold transition-colors ${active ? "bg-[var(--annotation-soft)] text-ac" : "text-txs hover:bg-[var(--paper-deep)] hover:text-tx"}`}>{label}</Link>;
}
