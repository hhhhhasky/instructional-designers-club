import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  CalendarDays,
  MapPin,
  ExternalLink,
  AlertCircle,
  Eye,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/Header';
import Footer from '@/components/common/Footer';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import PageMeta from '@/components/common/PageMeta';
import { getActivityById, getCachedHomePageSnapshot } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
import { renderInline, getColor } from '@/lib/content-render';
import type { Activity, ActivityType } from '@/types/types';

/**
 * 活动详情页（R-P0-03 配套）。
 *
 * 首页「最新动态」里的活动卡片点击后进入这里，展示运营填写的全部信息：
 * 类型、时间、地点、描述等。有「会议链接」时给出对应入口按钮；
 * 没有也照常展示（很多活动只是告知性质，不一定有视频/会议入口）。
 */

// 活动类型 → 徽标文案 + 配色
function typeMeta(t: ActivityType): { label: string; badge: string; color: string } {
  if (t === 'live') return { label: '直播', ...pickColor('rose') };
  if (t === 'study_group') return { label: '共学', ...pickColor('ac') };
  if (t === 'lesson_review') return { label: '磨课', ...pickColor('tl') };
  return { label: '活动', ...pickColor('am') };
}

function pickColor(key: string): { badge: string; color: string } {
  const c = getColor(key);
  return { badge: c.badge, color: c.iconColor };
}

// 有「会议链接」时，详情页入口按钮的文案
const CTA_LABEL: Record<ActivityType, string> = {
  live: '进入直播',
  lesson_review: '进入磨课',
  study_group: '进入共学',
  event: '进入活动',
};

type Status = 'ongoing' | 'upcoming' | 'ended' | 'unknown';

function activityStatus(
  startTime: string | null,
  endTime: string | null
): { status: Status; label: string | null } {
  const now = Date.now();
  const startT = startTime ? new Date(startTime).getTime() : null;
  const endT = endTime ? new Date(endTime).getTime() : null;
  // 既没有开始也没有结束时间：纯告知性质，不显示状态徽标
  if (startT === null && endT === null) return { status: 'unknown', label: null };

  const started = startT === null || startT <= now;
  const ended = endT !== null && endT < now;
  if (ended) return { status: 'ended', label: '已结束' };
  if (!started && startT !== null) return { status: 'upcoming', label: '即将开始' };
  return { status: 'ongoing', label: '进行中' };
}

const STATUS_BADGE: Record<Exclude<Status, 'unknown'>, string> = {
  ongoing: 'bg-tll text-tl border-tl/20',
  upcoming: 'bg-aml text-am border-am/20',
  ended: 'bg-bgs text-txt border-bd',
};

// 时间区间的展示文案。
// 后台用 datetime-local 录入，运营通常只在意「日期」；具体时点对跨多天的
// 活动（共学/磨课/活动）没意义。所以：
//  - 跨多天 → 只显示日期范围（隐去无意义的时分）
//  - 同一天 → 日期 + 时分区间（直播等单场活动时点才重要）
//  - 只有开始 → 日期 + 时分 +「开始」
//  - 只有结束 → 日期 +「持续至」
//  - 都没有 → null（不渲染）
const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: Date) => `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const parse = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

function timeRangeText(startTime: string | null, endTime: string | null): string | null {
  const sd = parse(startTime);
  const ed = parse(endTime);
  if (sd && ed) {
    const sameDay = sd.toDateString() === ed.toDateString();
    if (sameDay) return `${fmtDate(sd)} ${fmtTime(sd)} — ${fmtTime(ed)}`;
    return `${fmtDate(sd)} — ${fmtDate(ed)}`;
  }
  if (sd) return `${fmtDate(sd)} ${fmtTime(sd)} 开始`;
  if (ed) return `持续至 ${fmtDate(ed)}`;
  return null;
}

export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!id) {
        setError('活动ID不存在');
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        setError(null);
        const snapshotActivity = getCachedHomePageSnapshot()?.activities.find((item) => item.id === id);
        if (snapshotActivity && alive) {
          setActivity(snapshotActivity);
          setIsLoading(false);
        }
        const data = await getActivityById(id);
        if (!alive) return;
        setActivity(data);
      } catch (err) {
        console.error('加载活动详情失败:', err);
        if (alive) setError('加载活动详情失败，请刷新页面重试');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <LoadingOverlay message="正在加载活动详情..." />
      </div>
    );
  }

  // 异常 / 缺失 / 已下架（非管理员）统一兜底
  const notFound = error || !activity || (!activity.is_active && profile?.role !== 'admin');
  if (notFound) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center pt-20 px-4">
          <div className="text-center animate-fade-in max-w-md">
            <AlertCircle className="w-14 h-14 text-ac/60 mx-auto mb-5" />
            <h1 className="text-ds-2xl font-ds-bold text-tx font-serif mb-5">
              {error || '活动不存在或已下架'}
            </h1>
            <Button onClick={() => navigate('/')} className="btn-press">
              返回首页
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const meta = typeMeta(activity.activity_type);
  const status = activityStatus(activity.start_time, activity.end_time);
  const timeText = timeRangeText(activity.start_time, activity.end_time);
  const isAdmin = profile?.role === 'admin';

  return (
    <>
      <PageMeta
        title={activity.title}
        description={activity.description || `${activity.title} - 教学设计师俱乐部活动`}
        canonicalPath={`/activities/${activity.id}`}
        ogType="article"
      />
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />

        <main className="flex-1 pt-20 pb-ds-11">
          {/* 面包屑 */}
          <div className="max-w-3xl mx-auto px-4 pt-5 pb-1">
            <div className="flex items-center gap-1.5 text-sm text-tx/60">
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-1 hover:text-ac transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                首页
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-tx/30" />
              <span className="truncate max-w-[240px] text-tx/60">{activity.title}</span>
            </div>
          </div>

          {/* 管理员预览横幅 */}
          {isAdmin && !activity.is_active && (
            <div className="max-w-3xl mx-auto px-4 pt-3">
              <div className="bg-am/10 border border-am/30 rounded-ds-lg px-4 py-2.5 flex items-center gap-2 text-ds-sm text-am">
                <Eye className="w-4 h-4 flex-shrink-0" />
                <span>
                  你正在预览<strong>未上架</strong>的活动 — 普通用户看不到此页面
                </span>
              </div>
            </div>
          )}

          {/* 主体卡片 */}
          <div className="max-w-3xl mx-auto px-4 pt-4">
            <div className="bg-bc rounded-ds-lg border border-bd shadow-ds-elegant overflow-hidden">
              <div className="p-6 md:p-8">
                {/* 类型 + 状态徽标 */}
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-ds-pill text-ds-xs font-ds-semibold border ${meta.badge}`}
                  >
                    {meta.label}
                  </span>
                  {status.label && (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-ds-pill text-ds-xs font-ds-semibold border ${
                        STATUS_BADGE[status.status as Exclude<Status, 'unknown'>]
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      {status.label}
                    </span>
                  )}
                </div>

                {/* 标题 */}
                <h1 className="text-2xl md:text-3xl font-black text-tx font-serif leading-tight">
                  {activity.title}
                </h1>

                {/* 元信息：时间 / 地点 */}
                {(timeText || activity.location) && (
                  <div className="flex flex-col gap-2 text-sm text-txs mt-5 pb-6 border-b border-bdl">
                    {timeText && (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="w-4 h-4 text-ac flex-shrink-0" />
                        {timeText}
                      </span>
                    )}
                    {activity.location && (
                      <span className="inline-flex items-start gap-1.5">
                        <MapPin className="w-4 h-4 text-ac flex-shrink-0 mt-0.5" />
                        <span className="whitespace-pre-wrap">{activity.location}</span>
                      </span>
                    )}
                  </div>
                )}

                {/* 描述 */}
                <section className="pt-6">
                  <h2 className="text-xl font-bold text-tx font-serif mb-3">活动详情</h2>
                  <div className="bg-bgs rounded-md p-5">
                    {activity.description ? (
                      <p className="text-base md:text-lg text-tx leading-relaxed whitespace-pre-wrap font-body">
                        {renderInline(
                          activity.description,
                          'text-ac font-semibold'
                        )}
                      </p>
                    ) : (
                      <p className="text-base text-txs leading-relaxed">
                        本活动为告知性质，暂无更多说明。如需了解详情，可留意俱乐部群内通知。
                      </p>
                    )}
                  </div>
                </section>

                {/* 入口 CTA：有会议链接才显示 */}
                {activity.meeting_url && (
                  <section className="pt-7">
                    <Button
                      size="lg"
                      asChild
                      className="w-full sm:w-auto text-lg py-5 btn-super-cta !text-white btn-press"
                    >
                      <a
                        href={activity.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        {CTA_LABEL[activity.activity_type]}
                      </a>
                    </Button>
                  </section>
                )}

                {/* 无入口时的说明 */}
                {!activity.meeting_url && status.status !== 'ended' && (
                  <div className="mt-7 p-4 bg-bgs rounded-md border border-bdl">
                    <p className="text-sm text-txs leading-relaxed">
                      💡 此活动暂无在线入口，相关信息以本页说明为准。如有会议/直播链接，会在活动开始前更新到此处。
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
