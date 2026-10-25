import { BriefcaseBusiness, Coins, MessageCircleMore } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function HaiDesktopModeSwitch() {
  return (
    <nav
      className="hidden grid-cols-3 gap-1 md:grid"
      aria-label="切换 HAI 模式"
      data-testid="hai-desktop-mode-switch"
    >
      <Mode to="/hai/chat" label="聊聊问题" icon={MessageCircleMore} />
      <Mode to="/hai/work" label="帮你干活" icon={BriefcaseBusiness} />
      <Mode to="/hai/points" label="购买积分" icon={Coins} />
    </nav>
  );
}

function Mode({ to, label, icon: Icon }: {
  to: string;
  label: string;
  icon: React.ElementType;
}) {
  return (
    <NavLink to={to} className={({ isActive }) => cn(
      "relative flex h-9 rounded-md items-center justify-center gap-1.5 px-3 text-ds-xs font-ds-bold transition-colors",
      isActive
        ? "bg-acl text-ac"
        : "text-txs hover:bg-white/60 hover:text-tx",
    )}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </NavLink>
  );
}
