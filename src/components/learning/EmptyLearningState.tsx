import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EmptyLearningState() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-ds-full bg-bgs flex items-center justify-center mb-4">
        <BookOpen className="w-8 h-8 text-txs" />
      </div>
      <p className="text-ds-base font-ds-semibold text-tx mb-1">还没有学习记录</p>
      <p className="text-ds-sm text-txs mb-6">开始探索课程，开启你的学习之旅</p>
      <Button
        onClick={() => navigate('/courses')}
        className="btn-super-cta !text-white font-ds-bold rounded-ds-lg"
      >
        前往课程中心
      </Button>
    </div>
  );
}
