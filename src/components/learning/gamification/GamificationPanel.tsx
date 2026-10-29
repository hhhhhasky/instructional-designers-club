import {
  Award,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  Compass,
  Lock,
  Map,
  Route,
  Sparkles,
  Target,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import type { Achievement, GamificationSnapshot, Quest } from '@/lib/gamification';
import { cn } from '@/lib/utils';

interface GamificationPanelProps {
  snapshot: GamificationSnapshot;
  variant?: 'full' | 'compact';
}

const ACCENT_STYLES = {
  ac: {
    chip: 'bg-acl text-ac border-ac/20',
    bar: 'bg-ac',
    soft: 'bg-acl',
    text: 'text-ac',
  },
  tl: {
    chip: 'bg-tll text-tl border-tl/20',
    bar: 'bg-tl',
    soft: 'bg-tll',
    text: 'text-tl',
  },
  am: {
    chip: 'bg-aml text-am border-am/20',
    bar: 'bg-am',
    soft: 'bg-aml',
    text: 'text-am',
  },
  pp: {
    chip: 'bg-ppl text-pp border-pp/20',
    bar: 'bg-ppl',
    soft: 'bg-ppl',
    text: 'text-pp',
  },
} as const;

export default function GamificationPanel({ snapshot, variant = 'full' }: GamificationPanelProps) {
  if (variant === 'compact') {
    return <CompactGamificationPanel snapshot={snapshot} />;
  }

  return (
    <section className="space-y-4">
      <GrowthProfile snapshot={snapshot} />
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3">
          <AchievementGallery achievements={snapshot.achievements} />
        </div>
        <div className="xl:col-span-2">
          <QuestList quests={snapshot.quests} />
        </div>
      </div>
    </section>
  );
}

function CompactGamificationPanel({ snapshot }: { snapshot: GamificationSnapshot }) {
  const featured = snapshot.achievements
    .filter((achievement) => achievement.state === 'unlocked')
    .slice(0, 3);

  return (
    <div className="bg-white border border-bd rounded-ds-lg shadow-ds-sm p-4 md:p-5">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-ds-pill bg-acl text-ac text-ds-xs font-ds-bold">
              <Sparkles className="w-3.5 h-3.5" />
              {snapshot.levelLabel} · {snapshot.levelName}
            </span>
          </div>
          <p className="text-ds-sm text-txs line-clamp-2">{snapshot.statusLine}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {featured.length > 0 ? (
            featured.map((achievement) => (
              <AchievementBadge key={achievement.id} achievement={achievement} size="sm" />
            ))
          ) : (
            <span className="text-ds-xs text-txs">等待第一枚徽章</span>
          )}
          <Link
            to="/learning"
            className="inline-flex items-center gap-1 text-ds-sm font-ds-bold text-ac hover:underline"
          >
            成长档案
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function GrowthProfile({ snapshot }: { snapshot: GamificationSnapshot }) {
  const cards = [
    {
      icon: Award,
      label: '已获徽章',
      value: `${snapshot.unlockedAchievementCount}/${snapshot.totalAchievementCount}`,
      color: 'text-am',
      bg: 'bg-aml',
    },
    {
      icon: Compass,
      label: '探索区域',
      value: `${snapshot.exploredNodeCount}/${snapshot.explorableNodeCount}`,
      color: 'text-tl',
      bg: 'bg-tll',
    },
    {
      icon: BookOpenCheck,
      label: '已完成',
      value: `${snapshot.completedCourses}节`,
      color: 'text-ac',
      bg: 'bg-acl',
    },
  ];

  return (
    <div className="bg-white rounded-ds-lg border border-bd shadow-ds-sm p-4 md:p-5 overflow-hidden relative">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-progress" />
      <div className="flex flex-col lg:flex-row lg:items-center gap-5">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-ds-pill bg-acl text-ac text-ds-xs font-ds-bold border border-ac/20">
              <Sparkles className="w-3.5 h-3.5" />
              {snapshot.levelLabel} · {snapshot.levelName}
            </span>
            <span className="text-ds-xs text-txs">{snapshot.totalCredits} 学分</span>
          </div>
          <h2 className="text-ds-lg font-ds-black text-tx" style={{ fontFamily: 'var(--fd)' }}>
            成长档案
          </h2>
          <p className="text-ds-sm text-txs mt-1 leading-relaxed">{snapshot.statusLine}</p>
          <div className="mt-4">
            <div className="flex items-center justify-between text-ds-xs text-txs mb-1.5">
              <span>学习地图探索度</span>
              <span className="font-ds-bold text-tx">{snapshot.explorationPercentage}%</span>
            </div>
            <Progress value={snapshot.explorationPercentage} className="h-2" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 lg:w-[22rem]">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-ds-md border border-bd bg-bgs/40 p-3 text-center">
                <span className={cn('w-9 h-9 rounded-ds-full flex items-center justify-center mx-auto mb-1.5', card.bg)}>
                  <Icon className={cn('w-4.5 h-4.5', card.color)} />
                </span>
                <p className={cn('text-ds-lg font-ds-black', card.color)}>{card.value}</p>
                <p className="text-ds-xs text-txs">{card.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AchievementGallery({ achievements }: { achievements: Achievement[] }) {
  return (
    <div className="bg-white rounded-ds-lg border border-bd shadow-ds-sm p-4 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-ds-base font-ds-bold text-tx flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-am inline-block" />
          学习徽章
        </h2>
        <Link to="/learning-map" className="text-ds-xs text-ac font-ds-bold hover:underline">
          查看地图
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {achievements.map((achievement) => (
          <AchievementBadge key={achievement.id} achievement={achievement} />
        ))}
      </div>
    </div>
  );
}

export function AchievementBadge({
  achievement,
  size = 'md',
}: {
  achievement: Achievement;
  size?: 'sm' | 'md';
}) {
  const isSmall = size === 'sm';
  const isUnlocked = achievement.state === 'unlocked';
  const isPlanned = achievement.state === 'planned';
  const accent = ACCENT_STYLES[achievement.accent];
  const assetPath = `${import.meta.env.BASE_URL}${achievement.asset.replace(/^\//, '')}`;

  if (isSmall) {
    return (
      <span
        className={cn(
          'relative inline-flex items-center justify-center rounded-ds-full border bg-white shadow-ds-xs',
          isUnlocked ? 'border-am/30' : 'border-bd opacity-60',
          'w-9 h-9',
        )}
        title={achievement.name}
      >
        <img src={assetPath} alt="" className="w-7 h-7" />
      </span>
    );
  }

  return (
    <div
      className={cn(
        'rounded-ds-md border p-3 text-center transition-all',
        isUnlocked ? 'bg-white border-am/30 shadow-ds-xs' : 'bg-bgs/50 border-bd',
      )}
    >
      <div className="relative w-14 h-14 mx-auto mb-2">
        <img
          src={assetPath}
          alt=""
          className={cn('w-full h-full transition-all', !isUnlocked && 'grayscale opacity-45')}
        />
        {!isUnlocked && (
          <span className="absolute -right-1 -bottom-1 w-6 h-6 rounded-ds-full bg-white border border-bd flex items-center justify-center shadow-ds-xs">
            {isPlanned ? <Target className="w-3.5 h-3.5 text-txt" /> : <Lock className="w-3.5 h-3.5 text-txt" />}
          </span>
        )}
        {isUnlocked && (
          <span className="absolute -right-1 -bottom-1 w-6 h-6 rounded-ds-full bg-tl border-2 border-white flex items-center justify-center shadow-ds-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
          </span>
        )}
      </div>
      <p className="text-ds-sm font-ds-bold text-tx leading-tight">{achievement.name}</p>
      <p className="text-ds-xs text-txs mt-1 min-h-[2.2rem] line-clamp-2">
        {isPlanned ? '课程规划中' : achievement.description}
      </p>
      {!isPlanned && (
        <div className="mt-2">
          <div className="h-1.5 rounded-ds-pill bg-bgs overflow-hidden">
            <div
              className={cn('h-full rounded-ds-pill transition-all', accent.bar)}
              style={{ width: `${achievement.progress}%` }}
            />
          </div>
          <p className={cn('text-ds-xs mt-1 font-ds-bold', isUnlocked ? 'text-tl' : accent.text)}>
            {achievement.completed}/{achievement.target}
          </p>
        </div>
      )}
    </div>
  );
}

function QuestList({ quests }: { quests: Quest[] }) {
  if (quests.length === 0) {
    return (
      <div className="bg-white rounded-ds-lg border border-bd shadow-ds-sm p-5 text-center">
        <Map className="w-8 h-8 text-txs mx-auto mb-2" />
        <p className="text-ds-sm text-txs">暂无新的阶段任务</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-ds-lg border border-bd shadow-ds-sm p-4 md:p-5">
      <h2 className="text-ds-base font-ds-bold text-tx mb-4 flex items-center gap-2">
        <span className="w-1 h-4 rounded-full bg-ac inline-block" />
        近期任务
      </h2>
      <div className="space-y-2.5">
        {quests.map((quest) => (
          <QuestCard key={quest.id} quest={quest} />
        ))}
      </div>
    </div>
  );
}

function QuestCard({ quest }: { quest: Quest }) {
  const navigate = useNavigate();
  const accent = ACCENT_STYLES[quest.accent];
  const pct = quest.target > 0 ? Math.min(100, Math.round((quest.progress / quest.target) * 100)) : 0;

  return (
    <button
      type="button"
      onClick={() => navigate(quest.href)}
      className="group w-full text-left rounded-ds-md border border-bd bg-bgs/40 hover:bg-white hover:shadow-ds-xs transition-all p-3"
    >
      <div className="flex items-start gap-3">
        <span className={cn('w-9 h-9 rounded-ds-full flex items-center justify-center shrink-0 border', accent.chip)}>
          <Route className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-ds-sm font-ds-bold text-tx leading-snug">{quest.title}</p>
            <span className="text-ds-xs font-ds-bold text-ac whitespace-nowrap group-hover:underline">
              {quest.ctaLabel}
            </span>
          </div>
          <p className="text-ds-xs text-txs mt-0.5 line-clamp-2">{quest.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 bg-white rounded-ds-pill overflow-hidden">
              <div className={cn('h-full rounded-ds-pill transition-all', accent.bar)} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-ds-xs text-txs shrink-0">
              {quest.progress}/{quest.target}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
