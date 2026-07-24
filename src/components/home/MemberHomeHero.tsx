import { ClipboardPenLine, MapPinned, MessageSquareText, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import EmptyLearningState from "@/components/learning/EmptyLearningState";
import GamificationPanel from "@/components/learning/gamification/GamificationPanel";
import LearningOverview from "@/components/learning/LearningOverview";
import { useAuth } from "@/contexts/AuthContext";
import { getLearningData } from "@/db/api";
import { buildGamificationSnapshot } from "@/lib/gamification";
import type {
  LearningOverview as LearningOverviewType,
  RecentLearningItem,
  SeriesCourseItem,
  SeriesProgress,
} from "@/types/types";
import AnnouncementFeed from "./AnnouncementFeed";
import ContinueLearningCard from "./ContinueLearningCard";
import NextCourseCard from "./NextCourseCard";

interface LearningData {
  overview: LearningOverviewType;
  seriesProgress: SeriesProgress[];
  recentLearning: RecentLearningItem[];
}

/** 在系列进度里找第一门「未开始」的课（按系列顺序）作为推荐下一步 */
function pickNext(
  series: SeriesProgress[],
): { course: SeriesCourseItem; seriesName: string } | null {
  for (const s of series) {
    const next = s.courses.find((c) => c.status === "not_started");
    if (next) return { course: next, seriesName: s.categoryName };
  }
  return null;
}

/**
 * 主页老用户「学习首屏」：仅对已登录用户渲染。
 * 一次性拉取学习数据（带 5 分钟缓存，与 /learning 同源），首屏展示
 * 欢迎语 + 学习概览 + 继续学习 + 推荐下一步。
 * 加载失败时静默降级为欢迎语 + 入口，不阻塞首页。
 */
export default function MemberHomeHero() {
  const { user, profile } = useAuth();
  const [data, setData] = useState<LearningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        if (alive) setData(await getLearningData(user.id));
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const levelLabel =
    profile?.access_level === "pro"
      ? "Pro 专家版"
      : profile?.access_level === "plus"
        ? "Plus 会员版"
        : "免费版";
  const nickname = profile?.nickname || "老师";

  // 出错静默降级：只保留入口，不影响首页其余部分
  if (error) {
    return (
      <section
        id="my-learning"
        className="editorial-desk-section scroll-mt-32 px-4 pb-8 pt-20 md:pb-10 md:pt-24"
      >
        <div className="editorial-paper mx-auto max-w-6xl p-6 text-center">
          <span className="editorial-kicker">TODAY'S DESK · 今日教研桌</span>
          <p className="mb-2 mt-3 text-ds-base font-ds-bold text-tx">Hi {nickname}，欢迎回来</p>
          <p className="mb-3 text-xs text-txs">学习数据暂时未能载入，你仍可继续进入课程与教研工具。</p>
          <Link
            to="/learning"
            className="text-ds-sm text-ac font-ds-semibold hover:underline"
          >
            前往我的学习 →
          </Link>
        </div>
      </section>
    );
  }

  const continueItem =
    data?.recentLearning.find((r) => r.status === "in_progress") ?? null;
  const gamificationSnapshot = data && profile
    ? buildGamificationSnapshot({
      overview: data.overview,
      seriesProgress: data.seriesProgress,
      recentLearning: data.recentLearning,
      accessLevel: profile.access_level,
    })
    : null;
  const nextCourse = gamificationSnapshot?.nextCourse ?? (data ? pickNext(data.seriesProgress) : null);
  const hasRecords =
    !!data &&
    (data.recentLearning.length > 0 ||
      data.overview.completedCourses > 0 ||
      data.overview.inProgressCourses > 0);

  const twoColumn = !!continueItem && !!nextCourse;

  return (
    <section
      id="my-learning"
      className="editorial-desk-section scroll-mt-32 px-4 pb-8 pt-20 md:pb-10 md:pt-24"
    >
      <div className="editorial-paper mx-auto max-w-6xl p-5 md:p-8">
        {/* 欢迎栏 */}
        <div className="mb-5 flex animate-fade-in flex-col gap-3 border-b border-dashed border-bd pb-5 md:mb-7 md:flex-row md:items-end md:justify-between md:pb-6">
          <div>
            <span className="editorial-kicker">TODAY'S DESK · 今日教研桌</span>
            <h2
              className="mt-3 text-ds-lg font-ds-black text-tx md:text-ds-xl"
              style={{ fontFamily: "var(--fd)" }}
            >
              Hi {nickname}，今天从哪里继续？
            </h2>
            <p className="mt-1 text-ds-sm text-txs">课程、咨询与教研产物，都在这张桌上接续。</p>
            {gamificationSnapshot && (
              <p className="text-ds-sm text-tx mt-2 max-w-2xl">
                {gamificationSnapshot.statusLine}
              </p>
            )}
          </div>
          <span className="editorial-stamp inline-flex items-center gap-1.5 self-start md:self-auto">
            <Sparkles className="w-3.5 h-3.5" />
            {levelLabel}
          </span>
        </div>

        <nav className="mb-6 grid gap-2 sm:grid-cols-3" aria-label="今日教研快捷入口">
          <Link to="/learning-map" className="editorial-desk-link">
            <MapPinned className="h-4 w-4 text-ac" aria-hidden="true" />
            <span><strong>学习地图</strong><small>查看课程进度</small></span>
          </Link>
          <Link to="/hai/chat" className="editorial-desk-link">
            <MessageSquareText className="h-4 w-4 text-tl" aria-hidden="true" />
            <span><strong>问问哈老师</strong><small>诊断一个教学问题</small></span>
          </Link>
          <Link to="/hai/work" className="editorial-desk-link">
            <ClipboardPenLine className="h-4 w-4 text-am" aria-hidden="true" />
            <span><strong>HAI Work</strong><small>继续教研产物</small></span>
          </Link>
        </nav>

        {/* 加载中：局部 spinner，不用全屏 LoadingOverlay */}
        {loading && (
          <div className="flex items-center justify-center py-10">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-ac border-t-transparent" />
          </div>
        )}

        {/* 就绪 */}
        {!loading && data && (
          hasRecords ? (
            <div className="space-y-4 md:space-y-6 animate-fade-in">
              {gamificationSnapshot && <GamificationPanel snapshot={gamificationSnapshot} variant="compact" />}

              <LearningOverview overview={data.overview} />

              {(continueItem || nextCourse) && (
                <div
                  className={`grid gap-3 md:gap-4 ${
                    twoColumn
                      ? "grid-cols-1 md:grid-cols-2"
                      : "grid-cols-1 max-w-md mx-auto"
                  }`}
                >
                  <ContinueLearningCard item={continueItem} />
                  <NextCourseCard data={nextCourse} />
                </div>
              )}

              {!continueItem && !nextCourse && (
                <div className="text-center py-6 bg-white rounded-ds-lg border border-bd">
                  <p className="text-ds-base text-tx mb-3">
                    🎉 你已学完当前课程体系，真棒！
                  </p>
                  <Link
                    to="/courses"
                    className="text-ds-sm text-ac font-ds-semibold hover:underline"
                  >
                    去看看全部课程 →
                  </Link>
                </div>
              )}

              <div className="text-center pt-1">
                <Link
                  to="/learning"
                  className="text-ds-sm text-ac font-ds-semibold hover:underline"
                >
                  查看全部我的学习 →
                </Link>
              </div>
            </div>
          ) : (
            <EmptyLearningState />
          )
        )}

        {/* 最新动态 / 上新信息流（R-P0-03）：自管理加载，无数据不渲染 */}
        {!loading && <AnnouncementFeed variant="compact" />}
      </div>
    </section>
  );
}
