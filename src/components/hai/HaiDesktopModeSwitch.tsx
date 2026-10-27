import { ArrowUpRight, BriefcaseBusiness, Coins } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export default function HaiDesktopModeSwitch() {
  const { pathname } = useLocation();
  const isWork = pathname === "/hai/work" || pathname.startsWith("/hai/work/");
  return (
    <nav
      className="hidden items-center gap-3 md:flex"
      aria-label="HAI 工作与账户"
      data-testid="hai-desktop-mode-switch"
    >
      {!isWork && <Link to="/hai/work" className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[var(--annotation)] px-3 text-xs font-bold text-[var(--paper)] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--annotation)]">
        <BriefcaseBusiness aria-hidden className="h-4 w-4" />帮你干活<ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
      </Link>}
      <Link to="/hai/points" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs text-[var(--txs)] transition hover:bg-[var(--paper-deep)] hover:text-[var(--ink)]">
        <Coins aria-hidden className="h-3.5 w-3.5" />购买积分
      </Link>
    </nav>
  );
}
