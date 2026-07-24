import { useMemo } from "react";
import type { HomePageSnapshot } from "@/db/api";
import { useHomeSnapshot } from "@/hooks/useHomeSnapshot";
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
 * 三类来源来自同一份首页快照，避免重复请求和来源间状态漂移。
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
  const { snapshot, loading } = useHomeSnapshot();
  const items = useMemo(
    () => snapshot ? buildAnnouncementFeed(snapshot) : [],
    [snapshot],
  );
  return { items, loading };
}

function buildAnnouncementFeed(snapshot: HomePageSnapshot): FeedItem[] {
  const merged: FeedItem[] = [];

  for (const announcement of snapshot.announcements.slice(0, MAX_ITEMS)) {
    merged.push({
      key: `a:${announcement.id}`,
      source: "announcement",
      type: announcement.type,
      title: announcement.title,
      summary: announcement.summary,
      timestamp: announcement.published_at,
      pinned: !!announcement.is_pinned,
      href: announcement.link_url || null,
      external: announcement.link_url
        ? isExternalHref(announcement.link_url)
        : false,
      linkLabel: announcement.link_label || null,
    });
  }

  for (const course of snapshot.latest_courses.slice(0, MAX_LATEST_COURSES)) {
    merged.push({
      key: `c:${course.id}`,
      source: "course",
      type: "new_course",
      title: course.title,
      summary: course.description || null,
      timestamp: course.created_at || snapshot.generated_at ||
        "1970-01-01T00:00:00.000Z",
      pinned: false,
      href: `/courses/${course.id}`,
      external: false,
      linkLabel: "去学习",
    });
  }

  const currentActivities = snapshot.activities
    .filter((activity) =>
      activity.is_active && isActivityNotEnded(activity.end_time)
    )
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime(),
    )
    .slice(0, MAX_ACTIVITIES);

  for (const activity of currentActivities) {
    merged.push({
      key: `v:${activity.id}`,
      source: "activity",
      type: activityToFeedType(activity.activity_type),
      title: activity.title,
      summary: activity.description || null,
      timestamp: activitySortTimestamp(
        activity.start_time,
        activity.created_at,
      ),
      pinned: false,
      href: `/activities/${activity.id}`,
      external: false,
      linkLabel: ACTIVITY_LABEL[activity.activity_type],
      timeLabel: activityDisplayLabel(
        activity.start_time,
        activity.end_time,
      ),
    });
  }

  merged.sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return new Date(right.timestamp).getTime() -
      new Date(left.timestamp).getTime();
  });
  return merged.slice(0, MAX_ITEMS);
}
