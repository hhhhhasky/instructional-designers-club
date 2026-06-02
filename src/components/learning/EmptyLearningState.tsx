import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
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
      <Button
        onClick={() => navigate('/courses')}
        className="btn-super-cta !text-white font-ds-bold rounded-ds-lg px-8"
      >
        前往课程中心
      </Button>
    </div>
  );
}
