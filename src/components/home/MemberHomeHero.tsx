import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getLearningData } from "@/db/api";
import type {
  LearningOverview as LearningOverviewType,
  SeriesProgress,
  RecentLearningItem,
  SeriesCourseItem,
} from "@/types/types";
import LearningOverview from "@/components/learning/LearningOverview";
import EmptyLearningState from "@/components/learning/EmptyLearningState";
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
        className="pt-20 md:pt-24 pb-6 md:pb-8 px-4 bg-acl scroll-mt-32"
      >
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-ds-base font-ds-bold text-tx mb-1">
            👋 Hi {nickname}，欢迎回来
          </p>
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
  const nextCourse = data ? pickNext(data.seriesProgress) : null;
  const hasRecords =
    !!data &&
    (data.recentLearning.length > 0 ||
      data.overview.completedCourses > 0 ||
      data.overview.inProgressCourses > 0);

  const twoColumn = !!continueItem && !!nextCourse;

  return (
    <section
      id="my-learning"
      className="pt-20 md:pt-24 pb-6 md:pb-8 px-4 bg-acl scroll-mt-32"
    >
      <div className="max-w-6xl mx-auto">
        {/* 欢迎栏 */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 mb-4 md:mb-6 animate-fade-in">
          <div>
            <h2
              className="text-ds-lg md:text-ds-xl font-ds-black text-tx"
              style={{ fontFamily: "var(--fd)" }}
            >
              👋 Hi {nickname}，欢迎回来
            </h2>
            <p className="text-ds-sm text-txs mt-1">继续你的教学设计精进之旅</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-ds-pill text-ds-xs font-ds-bold bg-white text-ac border border-ac/20 self-start md:self-auto">
            <Sparkles className="w-3.5 h-3.5" />
            {levelLabel}
          </span>
        </div>

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
      </div>
    </section>
  );
}
