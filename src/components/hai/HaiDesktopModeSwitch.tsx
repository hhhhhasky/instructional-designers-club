import { BriefcaseBusiness, MessageCircleMore } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function HaiDesktopModeSwitch() {
  return (
    <nav
      className="hidden grid-cols-2 overflow-hidden rounded-[10px] border border-[#d8d0c3] bg-[#f5f0e7] md:grid"
      aria-label="切换 HAI 模式"
      data-testid="hai-desktop-mode-switch"
    >
      <Mode to="/hai/chat" label="聊聊问题" icon={MessageCircleMore} />
      <Mode to="/hai/work" label="帮你干活" icon={BriefcaseBusiness} divided />
    </nav>
  );
}

function Mode({ to, label, icon: Icon, divided = false }: {
  to: string;
  label: string;
  icon: React.ElementType;
  divided?: boolean;
}) {
  return (
    <NavLink to={to} className={({ isActive }) => cn(
      "relative flex h-9 items-center justify-center gap-1.5 px-3 text-ds-xs font-ds-bold transition-colors",
      divided && "border-l border-[#d8d0c3]",
      isActive
        ? "bg-white text-[#a45d3d] shadow-[inset_0_-2px_0_#a45d3d]"
        : "text-[#746b60] hover:bg-white/60 hover:text-[#353733]",
    )}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </NavLink>
  );
}
