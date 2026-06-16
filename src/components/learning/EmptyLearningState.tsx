import { BookOpen, Compass, PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function EmptyLearningState() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 animate-fade-in-up">
      <div className="w-20 h-20 rounded-ds-full bg-acl/60 flex items-center justify-center mb-5 animate-pulse-slow">
        <BookOpen className="w-9 h-9 text-ac" />
      </div>
      <p className="text-ds-lg font-ds-semibold text-tx mb-1">还没有学习记录</p>
      <p className="text-ds-sm text-txs mb-8">开始探索课程，开启你的学习之旅</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg mb-8">
        <div className="rounded-ds-md border border-bd bg-white px-4 py-3 text-left">
          <div className="flex items-center gap-2 mb-1">
            <Compass className="w-4 h-4 text-ac" />
            <p className="text-ds-sm font-ds-bold text-tx">新手任务 1</p>
          </div>
          <p className="text-ds-xs text-txs">打开学习地图，选择第一段探索路线。</p>
        </div>
        <div className="rounded-ds-md border border-bd bg-white px-4 py-3 text-left">
          <div className="flex items-center gap-2 mb-1">
            <PlayCircle className="w-4 h-4 text-tl" />
            <p className="text-ds-sm font-ds-bold text-tx">新手任务 2</p>
          </div>
          <p className="text-ds-xs text-txs">完成任意一节课程，获得第一段成长记录。</p>
        </div>
      </div>
      <Button
        onClick={() => navigate('/courses')}
        className="btn-super-cta !text-white font-ds-bold rounded-ds-lg px-8"
      >
        前往课程中心
      </Button>
    </div>
  );
}
