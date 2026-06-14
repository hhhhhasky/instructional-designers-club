import type { ReactNode } from "react";
import {
  Brain,
  Bot,
  BookOpen,
  UserCheck,
  TrendingUp,
  GraduationCap,
  Lightbulb,
  Users,
  Sparkles,
  Target,
  Rocket,
  Heart,
  Star,
  Award,
  Zap,
  Globe,
  Microscope,
  PenTool,
  Compass,
  Gem,
  Quote,
  Calendar,
  Clock,
  Gift,
  Crown,
  ShieldCheck,
  Flame,
  Leaf,
  Beaker,
  Megaphone,
  Video,
  Bell,
  type LucideIcon,
} from "lucide-react";

// 内容渲染的共享工具：管理后台与前台共用，保证两端一致。

// ==================== 图标映射 ====================

export const ICON_OPTIONS: { name: string; Icon: LucideIcon }[] = [
  { name: "Sparkles", Icon: Sparkles },
  { name: "GraduationCap", Icon: GraduationCap },
  { name: "Bot", Icon: Bot },
  { name: "Brain", Icon: Brain },
  { name: "BookOpen", Icon: BookOpen },
  { name: "UserCheck", Icon: UserCheck },
  { name: "Users", Icon: Users },
  { name: "TrendingUp", Icon: TrendingUp },
  { name: "Lightbulb", Icon: Lightbulb },
  { name: "Target", Icon: Target },
  { name: "Rocket", Icon: Rocket },
  { name: "Heart", Icon: Heart },
  { name: "Star", Icon: Star },
  { name: "Award", Icon: Award },
  { name: "Zap", Icon: Zap },
  { name: "Globe", Icon: Globe },
  { name: "Microscope", Icon: Microscope },
  { name: "PenTool", Icon: PenTool },
  { name: "Compass", Icon: Compass },
  { name: "Gem", Icon: Gem },
  { name: "Quote", Icon: Quote },
  { name: "Calendar", Icon: Calendar },
  { name: "Clock", Icon: Clock },
  { name: "Gift", Icon: Gift },
  { name: "Crown", Icon: Crown },
  { name: "ShieldCheck", Icon: ShieldCheck },
  { name: "Flame", Icon: Flame },
  { name: "Leaf", Icon: Leaf },
  { name: "Beaker", Icon: Beaker },
  { name: "Megaphone", Icon: Megaphone },
  { name: "Video", Icon: Video },
  { name: "Bell", Icon: Bell },
];

const ICON_MAP = new Map(ICON_OPTIONS.map((o) => [o.name, o.Icon]));

export function getIcon(name: string | null | undefined): LucideIcon {
  if (name && ICON_MAP.has(name)) return ICON_MAP.get(name) as LucideIcon;
  return Sparkles;
}

// ==================== 颜色映射 ====================

export interface ColorOption {
  key: string;
  label: string;
  badge: string;
  iconWrap: string;
  iconColor: string;
}

export const COLOR_OPTIONS: ColorOption[] = [
  {
    key: "ac",
    label: "主色（蓝绿）",
    badge: "bg-acl text-ac border-ac/20",
    iconWrap: "bg-acl",
    iconColor: "text-ac",
  },
  {
    key: "am",
    label: "琥珀",
    badge: "bg-aml text-am border-am/20",
    iconWrap: "bg-aml",
    iconColor: "text-am",
  },
  {
    key: "pp",
    label: "紫色",
    badge: "bg-ppl text-pp border-pp/20",
    iconWrap: "bg-ppl",
    iconColor: "text-pp",
  },
  {
    key: "tl",
    label: "青绿",
    badge: "bg-tll text-tl border-tl/20",
    iconWrap: "bg-tll",
    iconColor: "text-tl",
  },
  {
    key: "rose",
    label: "玫红",
    badge: "bg-rose-100 text-rose-500 border-rose-200",
    iconWrap: "bg-rose-100",
    iconColor: "text-rose-500",
  },
];

const COLOR_MAP = new Map(COLOR_OPTIONS.map((c) => [c.key, c]));

export function getColor(key: string | null | undefined): ColorOption {
  return (key && COLOR_MAP.get(key)) || COLOR_OPTIONS[0];
}

// ==================== 内联加粗渲染：**文字** → <strong> ====================

export function renderInline(
  text: string,
  strongClass = "text-ac font-semibold"
): ReactNode {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className={strongClass}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
