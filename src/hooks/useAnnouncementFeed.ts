import { useEffect, useState } from "react";
import {
  getActiveAnnouncements,
  getLatestCourses,
  getActivities,
} from "@/db/api";
import type {
  AnnouncementType,
  ActivityType,
} from "@/types/types";

/**
 * 首页「最新动态 / 上新」信息流（R-P0-03）。
 *
 * 合并三类来源，给老用户「每次回来都有新东西可看」的回访理由：
 *  1. 运营后台发布的动态 / 上新 / 公告（announcements）—— 含置顶、过期自动隐藏
 *  2. 自动汇聚的「最近上架课程」—— 无需运营手发即出现在流里（验收 ③）
 *  3. 近期活动 / 直播预告（activities，仅未来的）—— 直播预告是核心回访钩子
 *
 * 排序：置顶优先，其余按时间倒序。上限 8 条。
 * 任意一类来源拉取失败时静默跳过，不影响其余来源展示。
 */

export type FeedSource = "announcement" | "course" | "activity";

export interface FeedItem {
  /** 唯一键（带来源前缀，避免不同来源 id 冲突） */
  key: string;
  source: FeedSource;
  /** 动态类型：决定图标 / 颜色 / 徽标文案 */
  type: AnnouncementType;
  title: string;
  summary: string | null;
  /** 用于排序与展示的时间戳（ISO） */
  timestamp: string;
  pinned: boolean;
  /** 跳转地址：站内路径（/courses/xx）或外链 */
  href: string | null;
  external: boolean;
  linkLabel: string | null;
  /** 时间展示文案覆盖；为空时由组件用 relativeTime(timestamp) 兜底 */
  timeLabel?: string | null;
}

export interface AnnouncementFeedState {
  items: FeedItem[];
  loading: boolean;
}

const MAX_ITEMS = 8;
const MAX_ACTIVITIES = 3;
const MAX_LATEST_COURSES = 4;

/** 活动 activity_type → 动态展示类型（直播单独保留，其余归为「活动」） */
function activityToFeedType(activityType: ActivityType): AnnouncementType {
  if (activityType === "live") return "live";
  return "event";
}

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  live: "查看直播",
  lesson_review: "查看磨课",
  study_group: "查看共学",
  event: "查看活动",
};

/** 活动是否仍在展示期：未结束即展示。
 *  共学、磨课等活动常常是「进行中」状态（已开始、未结束），也可能无固定开始时间。
 *  只要 end_time 为空（长期有效）或 ≥ 今天就展示；已结束的（end_time 早于今天）隐藏。 */
function isActivityNotEnded(endTime: string | null | undefined): boolean {
  if (!endTime) return true; // 无结束时间 = 长期有效
  const end = new Date(endTime).getTime();
  if (Number.isNaN(end)) return true; // 解析失败，不轻易隐藏
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return end >= startOfToday.getTime();
}

/** 活动排序时间戳：尚未开始的用 start_time（即将发生的排前），
 *  已开始 / 进行中 / 无开始时间的用 created_at（按运营上架时间排，新加的靠前）。 */
function activitySortTimestamp(
  startTime: string | null,
  createdAt: string
): string {
  const now = Date.now();
  if (startTime) {
    const start = new Date(startTime).getTime();
    if (!Number.isNaN(start) && start > now) return startTime; // 未开始
  }
  return createdAt;
}

/** 活动展示文案：进行中显示「进行中」，未开始交给组件用 relativeTime 显示倒计时。 */
function activityDisplayLabel(
  startTime: string | null,
  endTime: string | null
): string | null {
  const now = Date.now();
  const startT = startTime ? new Date(startTime).getTime() : null;
  const endT = endTime ? new Date(endTime).getTime() : null;
  const started = startT === null || Number.isNaN(startT) || startT <= now;
  const ended = endT !== null && !Number.isNaN(endT) && endT < now;
  if (started && !ended) return "进行中";
  return null;
}

function isExternalHref(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function useAnnouncementFeed(): AnnouncementFeedState {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);

      const [annRes, courseRes, activityRes] = await Promise.allSettled([
        getActiveAnnouncements(MAX_ITEMS),
        getLatestCourses(MAX_LATEST_COURSES),
        getActivities(20),
      ]);

      if (cancelled) return;

      const merged: FeedItem[] = [];

      // 1) 运营发布的动态
      if (annRes.status === "fulfilled") {
        for (const a of annRes.value) {
          merged.push({
            key: `a:${a.id}`,
            source: "announcement",
            type: a.type,
            title: a.title,
            summary: a.summary,
            timestamp: a.published_at,
            pinned: !!a.is_pinned,
            href: a.link_url || null,
            external: a.link_url ? isExternalHref(a.link_url) : false,
            linkLabel: a.link_label || null,
          });
        }
      }

      // 2) 自动汇聚最新课程
      if (courseRes.status === "fulfilled") {
        for (const c of courseRes.value) {
          merged.push({
            key: `c:${c.id}`,
            source: "course",
            type: "new_course",
            title: c.title,
            summary: c.description || null,
            timestamp: c.created_at || new Date().toISOString(),
            pinned: false,
            href: `/courses/${c.id}`,
            external: false,
            linkLabel: "去学习",
          });
        }
      }

      // 3) 近期活动 / 直播（未结束的；进行中的共学/磨课等也展示）
      if (activityRes.status === "fulfilled") {
        // 按 created_at 倒序，保证运营新加的活动优先入选（不被裁掉）
        const current = activityRes.value
          .filter((act) => act.is_active && isActivityNotEnded(act.end_time))
          .slice()
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )
          .slice(0, MAX_ACTIVITIES);
        for (const act of current) {
          const feedType = activityToFeedType(act.activity_type);
          merged.push({
            key: `v:${act.id}`,
            source: "activity",
            type: feedType,
            title: act.title,
            summary: act.description || null,
            timestamp: activitySortTimestamp(act.start_time, act.created_at),
            pinned: false,
            // 活动卡片永远指向详情页：详情页会展示运营填写的全部信息，
            // 并在有「会议链接」时再给出对应入口。很多活动只是告知性质，
            // 不一定有视频/会议链接，不能因缺链接就让卡片无法点击。
            href: `/activities/${act.id}`,
            external: false,
            linkLabel: ACTIVITY_LABEL[act.activity_type],
            timeLabel: activityDisplayLabel(act.start_time, act.end_time),
          });
        }
      }

      // 排序：置顶优先，其余按时间倒序
      merged.sort((x, y) => {
        if (x.pinned !== y.pinned) return x.pinned ? -1 : 1;
        return (
          new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime()
        );
      });

      if (!cancelled) {
        setItems(merged.slice(0, MAX_ITEMS));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { items, loading };
}
