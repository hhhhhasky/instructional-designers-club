import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Gift, Video, Calendar, Megaphone, ArrowRight, Sparkles, Pin } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AnnouncementType } from "@/types/types";
import { useAnnouncementFeed, type FeedItem } from "@/hooks/useAnnouncementFeed";
import { relativeTime } from "@/lib/time";
import { getColor } from "@/lib/content-render";

/**
 * 首页「最新动态 / 上新」信息流（R-P0-03）。
 * 数据来自 useAnnouncementFeed：运营动态 + 自动最新课程 + 近期活动。
 *
 * 两种形态：
 *  - compact：已登录老用户首屏内（MemberHomeHero 内），紧凑列表
 *  - section：未登录用户 Hero 下方的独立区块，卡片网格
 *
 * 无数据时整块不渲染，避免空区块。
 */

type Variant = "compact" | "section";

interface TypeMeta {
  Icon: LucideIcon;
  label: string;
  /** content-render 颜色 key（ac/am/pp/tl/rose） */
  color: ReturnType<typeof getColor>;
}

const TYPE_META: Record<AnnouncementType, TypeMeta> = {
  new_course: { Icon: Gift, label: "新课", color: getColor("ac") },
  live: { Icon: Video, label: "直播", color: getColor("rose") },
  event: { Icon: Calendar, label: "活动", color: getColor("am") },
  announcement: { Icon: Megaphone, label: "公告", color: getColor("pp") },
};

export default function AnnouncementFeed({ variant }: { variant: Variant }) {
  const { items, loading } = useAnnouncementFeed();

  // compact：随首屏加载，加载中 / 无数据都不渲染，避免打扰
  if (variant === "compact") {
    if (loading || items.length === 0) return null;
    return <CompactFeed items={items} />;
  }

  // section：加载中给骨架占位防跳动；无数据整块消失
  if (loading) return <SectionSkeleton />;
  if (items.length === 0) return null;
  return <SectionFeed items={items} />;
}

// ==================== compact：首屏内紧凑列表 ====================

function CompactFeed({ items }: { items: FeedItem[] }) {
  return (
    <div className="bg-white rounded-ds-lg border border-bd p-3 md:p-4 shadow-ds-xs animate-fade-in">
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <Sparkles className="w-3.5 h-3.5 text-ac" />
        <span className="text-ds-sm font-ds-bold text-tx">最新动态</span>
        <span className="text-ds-xs text-txs">· 上新 / 直播 / 活动</span>
      </div>
      <div className="divide-y divide-bd">
        {items.slice(0, 4).map((item) => (
          <FeedRow key={item.key} item={item} />
        ))}
      </div>
    </div>
  );
}

function FeedRow({ item }: { item: FeedItem }) {
  const meta = TYPE_META[item.type];
  const { Icon, color } = meta;

  return (
    <FeedLink item={item} className="block group">
      <div className="flex items-center gap-2.5 py-2 px-1 rounded-ds-md transition-colors group-hover:bg-warm">
        <span
          className={`inline-flex items-center justify-center w-7 h-7 rounded-ds-md shrink-0 ${color.iconWrap}`}
        >
          <Icon className={`w-3.5 h-3.5 ${color.iconColor}`} />
        </span>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded-ds-pill text-ds-xs font-ds-semibold border shrink-0 ${color.badge}`}
        >
          {meta.label}
        </span>
        {item.pinned && <Pin className="w-3 h-3 text-ac shrink-0" />}
        <span className="flex-1 min-w-0 text-ds-sm font-ds-medium text-tx truncate">
          {item.title}
        </span>
        <span
          className={`text-ds-xs shrink-0 hidden sm:inline ${
            item.timeLabel === "进行中"
              ? "text-tl font-ds-semibold"
              : "text-txt"
          }`}
        >
          {item.timeLabel ?? relativeTime(item.timestamp)}
        </span>
        {item.href && (
          <ArrowRight className="w-3.5 h-3.5 text-txt shrink-0 group-hover:text-ac group-hover:translate-x-0.5 transition-all" />
        )}
      </div>
    </FeedLink>
  );
}

// ==================== section：未登录用户独立区块 ====================

function SectionFeed({ items }: { items: FeedItem[] }) {
  return (
    <section className="py-8 md:py-12 xl:py-16 px-4 bg-acl">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6 md:mb-10 animate-fade-in">
          <div className="flex items-center justify-center gap-2 md:gap-3 mb-2 md:mb-3">
            <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-ac" />
            <h2
              className="text-2xl md:text-4xl xl:text-5xl font-ds-black text-tx"
              style={{ fontFamily: "var(--fd)" }}
            >
              俱乐部最新动态
            </h2>
          </div>
          <p className="text-sm md:text-xl text-txs">
            新课上线、直播预告、活动公告，持续更新中
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          {items.map((item) => (
            <FeedCard key={item.key} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  const meta = TYPE_META[item.type];
  const { Icon, color } = meta;

  return (
    <FeedLink
      item={item}
      className="block group h-full bg-white rounded-ds-lg border border-bd shadow-ds-xs hover-lift transition-all"
    >
      <div className="p-4 md:p-5 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-2 md:mb-3">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-ds-pill text-ds-xs font-ds-semibold border ${color.badge}`}
          >
            <Icon className="w-3 h-3" />
            {meta.label}
          </span>
          {item.pinned && (
            <span className="inline-flex items-center gap-0.5 text-ds-xs text-ac font-ds-semibold">
              <Pin className="w-3 h-3" />
              置顶
            </span>
          )}
        </div>

        <h3 className="text-base md:text-lg font-ds-bold text-tx mb-1.5 group-hover:text-ac transition-colors line-clamp-2">
          {item.title}
        </h3>

        {item.summary && (
          <p className="text-ds-sm text-txs leading-relaxed line-clamp-2 mb-3 flex-1">
            {item.summary}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-1">
          <span
            className={`text-ds-xs ${
              item.timeLabel === "进行中"
                ? "text-tl font-ds-semibold"
                : "text-txt"
            }`}
          >
            {item.timeLabel ?? relativeTime(item.timestamp)}
          </span>
          {item.href && (
            <span className="inline-flex items-center gap-1 text-ds-sm font-ds-bold text-ac group-hover:gap-1.5 transition-all">
              {item.linkLabel || "查看"}
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      </div>
    </FeedLink>
  );
}

// ==================== 统一的「可点击包裹」 ====================
// 有 href 才可点击；外链新窗口打开，站内走 SPA 路由。

function FeedLink({
  item,
  className,
  children,
}: {
  item: FeedItem;
  className?: string;
  children: ReactNode;
}) {
  if (!item.href) {
    return <div className={className}>{children}</div>;
  }
  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <Link to={item.href} className={className}>
      {children}
    </Link>
  );
}

// ==================== 加载骨架 ====================

function SectionSkeleton() {
  return (
    <section className="py-8 md:py-12 xl:py-16 px-4 bg-acl">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6 md:mb-10">
          <div className="flex items-center justify-center gap-2 md:gap-3 mb-2 md:mb-3">
            <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-ac" />
            <h2
              className="text-2xl md:text-4xl xl:text-5xl font-ds-black text-tx"
              style={{ fontFamily: "var(--fd)" }}
            >
              俱乐部最新动态
            </h2>
          </div>
          <p className="text-sm md:text-xl text-txs">
            新课上线、直播预告、活动公告，持续更新中
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-ds-lg border border-bd bg-white shadow-ds-xs animate-pulse"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
