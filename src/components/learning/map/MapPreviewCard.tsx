import { Map as MapIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getLearningData } from '@/db/api';
import type { LearningMapData } from '@/lib/learningMap';
import { buildLearningMapData } from '@/lib/learningMap';
import type { ExplorationLevel } from './learningMapConfig';
import { getMapNodeById, LEARNING_MAP_CONFIG } from './learningMapConfig';

const LEVEL_COLOR: Record<ExplorationLevel, string> = {
  explored: 'bg-tl',
  started: 'bg-ac',
  unexplored: 'bg-bd',
};

/**
 * 课程中心顶部精简预览卡：显示当前要素 + 下一课 + 6 点迷你地图，
 * 一键跳转完整地图。仅登录用户渲染；自管理数据（复用 5 分钟缓存，零额外开销）。
 */
export default function MapPreviewCard() {
  const { user, profile } = useAuth();
  const [data, setData] = useState<LearningMapData | null>(null);

  useEffect(() => {
    if (!user || !profile) return;
    let alive = true;
    (async () => {
      try {
        const ld = await getLearningData(user.id);
        if (alive) setData(buildLearningMapData(ld.seriesProgress, profile.access_level));
      } catch {
        /* 静默：预览卡失败不影响课程中心 */
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id, profile]);

  if (!user || !data) return null;

  const currentNode = data.currentPositionNodeId
    ? getMapNodeById(data.currentPositionNodeId)
    : null;
  const next = data.recommendedNextCourse;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      <Link
        to="/learning-map"
        className="block bg-card border border-bd rounded-ds-lg p-4 hover-lift transition-all group"
      >
        <div className="flex items-center gap-4">
          {/* 左：信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-ds-xs text-txs mb-1">
              <MapIcon className="w-3.5 h-3.5 text-ac" />
              教学设计学习地图
            </div>
            {currentNode ? (
              <>
                <p className="text-ds-sm font-ds-bold text-tx truncate">
                  📍 你在「{currentNode.name}」
                </p>
                {next && (
                  <p className="text-ds-xs text-txs truncate mt-0.5">
                    下一课：{next.course.title}
                  </p>
                )}
              </>
            ) : (
              <p className="text-ds-sm font-ds-bold text-tl">🎉 你已通览全部已上线要素</p>
            )}
          </div>

          {/* 右：6 点迷你地图 */}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            {LEARNING_MAP_CONFIG.elements.map((node) => {
              const expl = data.nodes[node.id];
              const level = expl?.explorationLevel ?? 'unexplored';
              const isCurrent = data.currentPositionNodeId === node.id;
              return (
                <span
                  key={node.id}
                  title={node.name}
                  className={`w-2.5 h-2.5 rounded-full ${LEVEL_COLOR[level]} ${
                    isCurrent ? 'ring-2 ring-ac ring-offset-1 ring-offset-bc' : ''
                  }`}
                />
              );
            })}
          </div>

          <div className="shrink-0 text-ds-sm font-ds-bold text-ac group-hover:translate-x-0.5 transition-transform whitespace-nowrap">
            查看地图 →
          </div>
        </div>
      </Link>
    </div>
  );
}
