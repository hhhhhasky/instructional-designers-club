import { useNavigate } from 'react-router-dom';
import { CheckCircle, PlayCircle, BookOpen } from 'lucide-react';
import type { RecentLearningItem } from '@/types/types';

interface Props {
  items: RecentLearningItem[];
}

const STATUS_LABEL = {
  completed: { icon: CheckCircle, text: '已完成', color: 'text-emerald-500' },
  in_progress: { icon: PlayCircle, text: '学习中', color: 'text-blue-500' },
  not_started: { icon: BookOpen, text: '未开始', color: 'text-gray-400' },
};

export default function RecentLearning({ items }: Props) {
  const navigate = useNavigate();

  if (items.length === 0) return null;

  return (
    <div>
      <h2 className="text-ds-base font-ds-bold text-tx mb-2">最近学习</h2>
      <div className="bg-white rounded-ds-lg shadow-ds-sm border border-bd divide-y divide-bd/50">
        {items.map((item) => {
          const cfg = STATUS_LABEL[item.status];
          const Icon = cfg.icon;
          return (
            <button
              key={item.courseId}
              onClick={() => navigate(`/courses/${item.courseId}`)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-bgs/50 transition-colors text-left"
            >
              {/* 缩略图 */}
              <div className="w-12 h-8 rounded-ds-md overflow-hidden bg-bgs shrink-0 flex items-center justify-center">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <BookOpen className="w-4 h-4 text-txs" />
                )}
              </div>

              {/* 信息 */}
              <div className="flex-1 min-w-0">
                <p className="text-ds-sm font-ds-medium text-tx truncate">{item.title}</p>
                <p className="text-ds-xs text-txs flex items-center gap-1 mt-0.5">
                  {item.category && <span>{item.category} · </span>}
                  <Icon className={`w-3 h-3 ${cfg.color}`} />
                  <span className={cfg.color}>
                    {cfg.text}
                    {item.status === 'in_progress' && item.progress > 0 && ` ${Math.round(item.progress)}%`}
                  </span>
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
