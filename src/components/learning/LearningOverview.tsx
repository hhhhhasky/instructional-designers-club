import { Award, BookOpen, CheckCircle, PlayCircle } from 'lucide-react';
import type { LearningOverview as LearningOverviewType } from '@/types/types';

interface Props {
  overview: LearningOverviewType;
}

export default function LearningOverview({ overview }: Props) {
  const cards = [
    {
      icon: BookOpen,
      value: overview.totalCourses,
      label: '课程总数',
      suffix: '节',
      color: 'text-pp',
      accentBg: 'bg-ppl',
    },
    {
      icon: Award,
      value: overview.totalCredits,
      label: '累计学分',
      color: 'text-am',
      accentBg: 'bg-yellow-soft',
    },
    {
      icon: CheckCircle,
      value: overview.completedCourses,
      label: '已完成',
      suffix: '节',
      color: 'text-tl',
      accentBg: 'bg-mint-soft',
    },
    {
      icon: PlayCircle,
      value: overview.inProgressCourses,
      label: '学习中',
      suffix: '节',
      color: 'text-ac',
      accentBg: 'bg-pink-soft',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="bg-white rounded-ds-lg border border-bd p-3 md:p-4 text-center hover-lift animate-fade-in-up"
            style={{ animationDelay: `${idx * 0.1}s` }}
          >
            <div className={`w-9 h-9 rounded-ds-full ${card.accentBg} flex items-center justify-center mx-auto mb-2`}>
              <Icon className={`w-4.5 h-4.5 ${card.color}`} />
            </div>
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
