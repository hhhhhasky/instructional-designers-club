import { useNavigate } from "react-router-dom";
import { BookOpen, Play } from "lucide-react";
import type { RecentLearningItem } from "@/types/types";

interface Props {
  item: RecentLearningItem | null;
}

/**
 * 「继续学习」主卡：展示用户正在进行中的最近一门课，带进度条，点击直跳课程详情。
 * item 为 null 时返回 null，由父容器控制显隐。
 */
export default function ContinueLearningCard({ item }: Props) {
  const navigate = useNavigate();

  if (!item) return null;

  const progress = Math.round(item.progress || 0);

  return (
    <button
      type="button"
      onClick={() => navigate(`/courses/${item.courseId}`)}
      className="group w-full text-left bg-white rounded-ds-lg border border-bd shadow-ds-sm hover-lift p-4 md:p-5 transition-all"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1 h-4 rounded-full bg-ac inline-block" />
        <span className="text-ds-sm font-ds-bold text-tx">继续学习</span>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="w-14 h-10 rounded-ds-md overflow-hidden bg-bgs shrink-0 flex items-center justify-center">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <BookOpen className="w-5 h-5 text-txs" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-ds-sm font-ds-medium text-tx truncate">{item.title}</p>
          {item.category && <p className="text-ds-xs text-txs mt-0.5">{item.category}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-2 bg-bgs rounded-full overflow-hidden">
          <div
            className="h-full bg-ac rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-ds-xs text-ac font-ds-semibold shrink-0">{progress}%</span>
      </div>

      <div className="flex items-center justify-center gap-1 text-ds-sm font-ds-bold text-ac group-hover:gap-2 transition-all">
        <Play className="w-3.5 h-3.5" />
        继续学习
      </div>
    </button>
  );
}
