import { useEffect, useState } from 'react';
import { Users, Eye } from 'lucide-react';
import CountUp from '@/components/ui/CountUp';
import { recordVisit } from '@/db/api';

export default function VisitorStats() {
  const [uniqueVisitors, setUniqueVisitors] = useState(0);
  const [totalVisits, setTotalVisits] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 生成或获取用户唯一标识
    const getUserId = () => {
      let userId = localStorage.getItem('visitor_uuid');
      if (!userId) {
        userId = crypto.randomUUID();
        localStorage.setItem('visitor_uuid', userId);
      }
      return userId;
    };

    // 记录访问并获取统计数据
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
        // 出错时显示默认值
        setUniqueVisitors(0);
        setTotalVisits(0);
      } finally {
        setIsLoading(false);
      }
    };

    trackVisit();
  }, []);

  return (
    <div className="flex flex-col xl:flex-row items-center justify-center gap-6 xl:gap-12 py-6">
      {/* 访问人数 */}
      <div className="flex items-center gap-3 group">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300">
          <Users className="w-5 h-5 text-primary group-hover:scale-110 transition-transform duration-300" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">网站访问人数</p>
          <p className="text-2xl font-bold text-foreground">
            {isLoading ? (
              <span className="animate-pulse">--</span>
            ) : (
              <CountUp end={uniqueVisitors} />
            )}
          </p>
        </div>
      </div>

      {/* 分隔线 */}
      <div className="hidden xl:block w-px h-12 bg-border" />

      {/* 访问人次 */}
      <div className="flex items-center gap-3 group">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300">
          <Eye className="w-5 h-5 text-primary group-hover:scale-110 transition-transform duration-300" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">网站访问人次</p>
          <p className="text-2xl font-bold text-foreground">
            {isLoading ? (
              <span className="animate-pulse">--</span>
            ) : (
              <CountUp end={totalVisits} />
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
