import { BriefcaseBusiness, Coins, MessageCircleMore } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function HaiModeNavigation() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-bd bg-[var(--paper)]/95 pb-safe  backdrop-blur-xl md:hidden"
      aria-label="HAI 模式导航"
      data-testid="hai-mode-navigation"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-3 px-2">
        <ModeLink to="/hai/chat" label="聊聊问题" description="问答讨论" icon={MessageCircleMore} />
        <ModeLink to="/hai/work" label="帮你干活" description="完成任务" icon={BriefcaseBusiness} divided />
        <ModeLink to="/hai/points" label="购买积分" description="查看套餐" icon={Coins} divided />
      </div>
    </nav>
  );
}

function ModeLink({
  to,
  label,
  description,
  icon: Icon,
  divided = false,
}: {
  to: string;
  label: string;
  description: string;
  icon: React.ElementType;
  divided?: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        "group relative flex items-center justify-center gap-2 border-t-2 px-3 transition-colors active:bg-[#eee6da]",
        divided && "border-l border-l-bd",
        isActive
          ? "border-t-ac bg-acl/50 text-ac"
          : "border-t-transparent text-txs hover:bg-white",
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-left leading-none">
        <span className="block text-sm font-black tracking-wide">{label}</span>
        <span className="mt-1 block text-xs opacity-75">{description}</span>
      </span>
    </NavLink>
  );
}
