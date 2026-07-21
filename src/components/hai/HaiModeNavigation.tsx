import { BriefcaseBusiness, MessageCircleMore } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function HaiModeNavigation() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[#ded7ca] bg-[#fffdf8]/95 pb-safe shadow-[0_-12px_32px_rgba(64,49,28,0.08)] backdrop-blur-xl md:hidden"
      aria-label="HAI 模式导航"
      data-testid="hai-mode-navigation"
    >
      <div className="mx-auto grid h-16 max-w-sm grid-cols-2 px-3">
        <ModeLink to="/hai/chat" label="聊聊问题" description="问答讨论" icon={MessageCircleMore} />
        <ModeLink to="/hai/work" label="帮你干活" description="完成任务" icon={BriefcaseBusiness} divided />
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
        divided && "border-l border-l-[#ded7ca]",
        isActive
          ? "border-t-[#b56238] bg-[#f7efe4] text-[#8f4e30]"
          : "border-t-transparent text-[#746b60] hover:bg-white",
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-left leading-none">
        <span className="block text-sm font-black tracking-wide">{label}</span>
        <span className="mt-1 block text-[10px] opacity-75">{description}</span>
      </span>
    </NavLink>
  );
}
