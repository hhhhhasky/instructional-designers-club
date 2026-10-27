import { BriefcaseBusiness, Coins } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function HaiModeNavigation() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-bd bg-[var(--paper)]/95 pb-safe  backdrop-blur-xl md:hidden"
      aria-label="HAI 工作与账户"
      data-testid="hai-mode-navigation"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-[1.4fr_1fr] gap-2 px-3 py-2">
        <ModeLink to="/hai/work" label="帮你干活" description="HAI 教研工作台" icon={BriefcaseBusiness} primary />
        <ModeLink to="/hai/points" label="购买积分" description="查看套餐" icon={Coins} />
      </div>
    </nav>
  );
}

function ModeLink({
  to,
  label,
  description,
  icon: Icon,
  primary = false,
}: {
  to: string;
  label: string;
  description: string;
  icon: React.ElementType;
  primary?: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        "relative flex items-center justify-center gap-2 rounded-xl px-3 transition-colors",
        primary
          ? "bg-[var(--annotation)] text-[var(--paper)] hover:opacity-90"
          : isActive
            ? "bg-[var(--paper-deep)] text-[var(--ink)]"
            : "text-[var(--txs)] hover:bg-[var(--paper-deep)]",
      )}
    >
      <Icon aria-hidden className="h-5 w-5" />
      <span className="text-left leading-none">
        <span className="block text-sm font-black tracking-wide">{label}</span>
        <span className="mt-1 block text-xs opacity-75">{description}</span>
      </span>
    </NavLink>
  );
}
