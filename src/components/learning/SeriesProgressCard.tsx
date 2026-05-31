import { useNavigate } from 'react-router-dom';
import { CheckCircle, Circle, PlayCircle, Lock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import type { SeriesProgress as SeriesProgressType, MembershipType } from '@/types/types';
import { canAccessCourse } from '@/lib/access-control';

interface Props {
  series: SeriesProgressType;
  accessLevel: MembershipType;
}

const STATUS_CONFIG = {
  completed: { icon: CheckCircle, color: 'text-emerald-500', label: '已完成' },
  in_progress: { icon: PlayCircle, color: 'text-blue-500', label: '学习中' },
  not_started: { icon: Circle, color: 'text-gray-300', label: '未开始' },
};

export default function SeriesProgressCard({ series, accessLevel }: Props) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-ds-lg shadow-ds-sm border border-bd overflow-hidden">
      <Accordion type="single" collapsible>
        <AccordionItem value="series" className="border-b-0">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-bgs/50 transition-colors">
            <div className="flex-1 text-left">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-ds-base font-ds-bold text-tx">{series.categoryName}</h3>
                <span className="text-ds-sm text-txs">
                  {series.completedCourses}/{series.totalCourses} 完成
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Progress
                  value={series.completionPercentage}
                  className="h-1.5 flex-1"
                />
                <span className="text-ds-xs font-ds-semibold text-primary min-w-[36px] text-right">
                  {series.completionPercentage}%
                </span>
              </div>
            </div>
          </AccordionTrigger>

          <AccordionContent className="px-4 pb-3">
            <div className="space-y-1">
              {series.courses.map((course, idx) => {
                const hasAccess = canAccessCourse(accessLevel, course.membershipType);
                const statusCfg = STATUS_CONFIG[course.status];
                const StatusIcon = statusCfg.icon;

                return (
                  <button
                    key={course.courseId}
                    onClick={() => navigate(`/courses/${course.courseId}`)}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-ds-md hover:bg-bgs transition-colors text-left group"
                  >
                    {/* 序号 */}
                    <span className="text-ds-xs text-txt min-w-[20px] text-right">
                      {idx + 1}.
                    </span>

                    {/* 状态图标 */}
                    <StatusIcon className={`w-4 h-4 shrink-0 ${statusCfg.color}`} />

                    {/* 标题 + 进度 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-ds-sm truncate ${hasAccess ? 'text-tx group-hover:text-ac' : 'text-txs'}`}>
                          {course.title}
                        </span>
                        {!hasAccess && <Lock className="w-3 h-3 text-txs shrink-0" />}
                      </div>
                      {course.status === 'in_progress' && course.progress > 0 && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Progress value={course.progress} className="h-1 flex-1" />
                          <span className="text-ds-xs text-txs">{Math.round(course.progress)}%</span>
                        </div>
                      )}
                    </div>

                    {/* 学分 */}
                    {course.credits > 0 && (
                      <span className={`text-ds-xs shrink-0 ${
                        course.status === 'completed' ? 'text-amber-600 font-ds-semibold' : 'text-txs'
                      }`}>
                        {course.credits}学分
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
