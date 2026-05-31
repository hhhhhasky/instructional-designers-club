import { Award, CheckCircle, PlayCircle } from 'lucide-react';
import type { LearningOverview as LearningOverviewType } from '@/types/types';

interface Props {
  overview: LearningOverviewType;
}

export default function LearningOverview({ overview }: Props) {
  const cards = [
    {
      icon: Award,
      value: overview.totalCredits,
      label: '累计学分',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      icon: CheckCircle,
      value: overview.completedCourses,
      label: '已完成',
      suffix: '节',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      icon: PlayCircle,
      value: overview.inProgressCourses,
      label: '学习中',
      suffix: '节',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`${card.bg} rounded-ds-lg border border-bd/50 p-3 md:p-4 text-center`}
          >
            <Icon className={`w-5 h-5 mx-auto mb-1.5 ${card.color}`} />
            <p className={`text-ds-xl md:text-ds-2xl font-ds-black ${card.color}`}>
              {card.value}
              {card.suffix && (
                <span className="text-ds-xs font-ds-medium ml-0.5">{card.suffix}</span>
              )}
            </p>
            <p className="text-ds-xs text-txs mt-0.5">{card.label}</p>
          </div>
        );
      })}
    </div>
  );
}
