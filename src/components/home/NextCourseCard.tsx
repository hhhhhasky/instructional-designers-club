import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import type { SeriesCourseItem } from "@/types/types";

interface Props {
  data: { course: SeriesCourseItem; seriesName: string } | null;
}

/**
 * 「推荐下一步」卡：展示用户当前体系里下一门未开始的课，点击直跳课程详情。
 * data 为 null 时返回 null，由父容器控制显隐。
 */
export default function NextCourseCard({ data }: Props) {
  const navigate = useNavigate();

  if (!data) return null;

  const { course, seriesName } = data;

  return (
    <button
      type="button"
      onClick={() => navigate(`/courses/${course.courseId}`)}
      className="group w-full text-left bg-acl rounded-ds-lg border border-ac/20 shadow-ds-sm hover-lift p-4 md:p-5 transition-all"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1 h-4 rounded-full bg-am inline-block" />
        <span className="text-ds-sm font-ds-bold text-tx">推荐下一步</span>
      </div>

      <div className="mb-3">
        <p className="text-ds-xs text-txs mb-1">{seriesName}</p>
        <p className="text-ds-sm font-ds-medium text-tx line-clamp-2">{course.title}</p>
        {course.credits > 0 && (
          <p className="text-ds-xs text-am mt-1">{course.credits} 学分</p>
        )}
      </div>

      <div className="flex items-center justify-center gap-1 text-ds-sm font-ds-bold text-ac group-hover:gap-2 transition-all">
        <Sparkles className="w-3.5 h-3.5" />
        开始学习
      </div>
    </button>
  );
}
