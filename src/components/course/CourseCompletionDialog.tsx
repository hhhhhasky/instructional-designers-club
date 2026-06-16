import { Award, BookOpenCheck, ChevronRight, Map, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AchievementBadge } from '@/components/learning/gamification/GamificationPanel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Achievement, GamificationSnapshot } from '@/lib/gamification';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseTitle: string;
  achievement: Achievement | null;
  snapshot: GamificationSnapshot | null;
}

export default function CourseCompletionDialog({
  open,
  onOpenChange,
  courseTitle,
  achievement,
  snapshot,
}: Props) {
  const navigate = useNavigate();
  const nextCourse = snapshot?.nextCourse;
  const isAchievementUnlocked = achievement?.state === 'unlocked';

  const goTo = (href: string) => {
    onOpenChange(false);
    navigate(href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border-bd rounded-ds-lg p-0 overflow-hidden">
        <DialogTitle className="sr-only">课程完成反馈</DialogTitle>
        <DialogDescription className="sr-only">
          展示本次课程完成后的徽章进度和下一步学习建议。
        </DialogDescription>
        <div className="relative p-5 md:p-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-progress" />
          <div className="flex items-start gap-3 mb-5">
            <span className="w-12 h-12 rounded-ds-full bg-tll flex items-center justify-center shrink-0">
              <BookOpenCheck className="w-6 h-6 text-tl" />
            </span>
            <div className="min-w-0">
              <p className="text-ds-lg font-ds-black text-tx" style={{ fontFamily: 'var(--fd)' }}>
                已完成一节课程
              </p>
              <p className="text-ds-sm text-txs line-clamp-2 mt-0.5">{courseTitle}</p>
            </div>
          </div>

          {achievement && (
            <div className="rounded-ds-lg bg-bgs/60 border border-bd p-4 mb-4">
              <div className="flex items-center gap-3">
                <AchievementBadge achievement={achievement} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-ds-sm font-ds-bold text-tx flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-am" />
                    本课贡献到「{achievement.name}」
                  </p>
                  <p className="text-ds-xs text-txs mt-0.5">
                    {isAchievementUnlocked
                      ? '这枚学习徽章已经点亮。'
                      : `还差 ${achievement.remaining} 节课点亮这枚徽章。`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {snapshot && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              <StatTile label="等级" value={`${snapshot.levelLabel}`} icon={Sparkles} />
              <StatTile label="徽章" value={`${snapshot.unlockedAchievementCount}/${snapshot.totalAchievementCount}`} icon={Award} />
              <StatTile label="地图" value={`${snapshot.explorationPercentage}%`} icon={Map} />
            </div>
          )}

          <div className="space-y-2">
            {nextCourse && (
              <Button
                type="button"
                className="w-full btn-super-cta !text-white rounded-ds-lg"
                onClick={() => goTo(`/courses/${nextCourse.course.courseId}`)}
              >
                学习下一课
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              className="w-full rounded-ds-lg"
              onClick={() => goTo('/learning-map')}
            >
              查看学习地图
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Sparkles;
}) {
  return (
    <div className="rounded-ds-md bg-bgs/50 border border-bd p-2 text-center">
      <Icon className="w-4 h-4 text-ac mx-auto mb-1" />
      <p className="text-ds-sm font-ds-black text-tx">{value}</p>
      <p className="text-ds-xs text-txs">{label}</p>
    </div>
  );
}
