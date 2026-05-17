import { useEffect, useState } from 'react';
import { Users, Eye } from 'lucide-react';
import CountUp from '@/components/ui/CountUp';
import { recordVisit } from '@/db/api';

export default function VisitorStats() {
  const [uniqueVisitors, setUniqueVisitors] = useState(0);
  const [totalVisits, setTotalVisits] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getUserId = () => {
      let userId = localStorage.getItem('visitor_uuid');
      if (!userId) {
        userId = crypto.randomUUID();
        localStorage.setItem('visitor_uuid', userId);
      }
      return userId;
    };

    const trackVisit = async () => {
      try {
        setIsLoading(true);
        const userId = getUserId();
        console.log('[访问统计] 开始记录访问，用户ID:', userId);

        const stats = await recordVisit(userId);
        console.log('[访问统计] 获取到统计数据:', stats);

        if (stats && typeof stats.unique_visitors === 'number' && typeof stats.total_visits === 'number') {
          setUniqueVisitors(stats.unique_visitors);
          setTotalVisits(stats.total_visits);
          console.log('[访问统计] 统计数据更新成功');
        } else {
          console.warn('[访问统计] 返回的数据格式不正确:', stats);
          setUniqueVisitors(0);
          setTotalVisits(0);
        }
      } catch (error) {
        console.error('[访问统计] 记录访问失败:', error);
        console.error('[访问统计] 错误详情:', {
          message: error instanceof Error ? error.message : '未知错误',
          stack: error instanceof Error ? error.stack : undefined,
          error
        });
        setUniqueVisitors(0);
        setTotalVisits(0);
      } finally {
        setIsLoading(false);
      }
    };

    trackVisit();
  }, []);

  return (
    <div className="flex items-center justify-center gap-6 xl:gap-8">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-txt" />
        <span className="text-sm text-txs">
          访问人数 <strong className="text-tx font-semibold">{isLoading ? '--' : <CountUp end={uniqueVisitors} />}</strong>
        </span>
      </div>
      <div className="w-px h-3.5 bg-bd" />
      <div className="flex items-center gap-2">
        <Eye className="w-4 h-4 text-txt" />
        <span className="text-sm text-txs">
          访问人次 <strong className="text-tx font-semibold">{isLoading ? '--' : <CountUp end={totalVisits} />}</strong>
        </span>
      </div>
    </div>
  );
}
