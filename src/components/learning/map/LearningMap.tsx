import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { LearningMapData, NodeExploration } from '@/lib/learningMap';
import type { MembershipType } from '@/types/types';
import ImageMap from './ImageMap';
import type { MapNodeConfig } from './learningMapConfig';
import { LEARNING_MAP_CONFIG } from './learningMapConfig';
import MapLegend from './MapLegend';
import SpotDetailSheet from './SpotDetailSheet';

interface Props {
  data: LearningMapData;
  accessLevel: MembershipType;
}

/**
 * 教学设计学习地图主组件。
 * - 桌面端：AI 生成图片作底图，节点按百分比坐标叠加动态标记（当前位置/进度/已通览）。
 * - 移动端：横图在窄屏标记太挤，降级为核心卡 + 要素网格 + 理论/AI 卡片流。
 * - 点击任意节点从右侧滑出 SpotDetailSheet。
 * - ?mapedit=1 启用坐标校准（运营自助拖拽对准建筑）。
 */
export default function LearningMap({ data, accessLevel }: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const editMode = searchParams.get('mapedit') === '1';

  return (
    <div>
      <div className="hidden md:block">
        <ImageMap data={data} onSelect={setSelectedNodeId} editMode={editMode} />
      </div>
      <div className="md:hidden">
        <MobileMap data={data} onSelect={setSelectedNodeId} />
      </div>

      <MapLegend />

      <SpotDetailSheet
        nodeId={selectedNodeId}
        onChangeNodeId={setSelectedNodeId}
        data={data}
        accessLevel={accessLevel}
      />
    </div>
  );
}

interface SectionProps {
  data: LearningMapData;
  onSelect: (id: string) => void;
}

function MobileMap({ data, onSelect }: SectionProps) {
  const { core, elements, foundations, toolkits } = LEARNING_MAP_CONFIG;
  const CoreIcon = core.icon;

  return (
    <div className="space-y-4">
      {/* 中心卡 */}
      <button
        type="button"
        onClick={() => onSelect(core.id)}
        className="w-full flex items-center gap-3 p-4 rounded-ds-lg bg-gradient-primary text-white text-left shadow-ds-sm hover-lift"
      >
        <span className="w-11 h-11 rounded-ds-full bg-white/20 flex items-center justify-center shrink-0">
          <CoreIcon className="w-6 h-6" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-ds-bold text-ds-md">{core.name}</div>
          <div className="text-ds-xs text-white/80 line-clamp-2">{core.desc}</div>
        </div>
      </button>

      {/* 6 要素网格 */}
      <div className="grid grid-cols-2 gap-2.5">
        {elements.map((node) => (
          <MobileCard
            key={node.id}
            node={node}
            expl={data.nodes[node.id]}
            isCurrent={data.currentPositionNodeId === node.id}
            onClick={() => onSelect(node.id)}
          />
        ))}
      </div>

      {/* 理论基石 / AI 工具箱 */}
      <div>
        <h3 className="text-ds-xs text-txs mb-2 px-1">理论 & 工具</h3>
        <div className="grid grid-cols-2 gap-2.5">
          {foundations.map((node) => (
            <MobileCard
              key={node.id}
              node={node}
              expl={data.nodes[node.id]}
              accent="pp"
              onClick={() => onSelect(node.id)}
            />
          ))}
          {toolkits.map((node) => (
            <MobileCard
              key={node.id}
              node={node}
              expl={data.nodes[node.id]}
              accent="am"
              onClick={() => onSelect(node.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface MobileCardProps {
  node: MapNodeConfig;
  expl: NodeExploration | undefined;
  isCurrent?: boolean;
  accent?: 'ac' | 'pp' | 'am';
  onClick: () => void;
}

function MobileCard({ node, expl, isCurrent = false, accent = 'ac', onClick }: MobileCardProps) {
  const Icon = node.icon;
  const isPlanned = !!node.isPlanned;
  const level = expl?.explorationLevel ?? 'unexplored';
  const done = level === 'explored';
  const has = !!expl && expl.totalCourses > 0;
  const sub = isPlanned
    ? '规划中'
    : done
      ? '已通览'
      : has
        ? `${expl!.completedCourses}/${expl!.totalCourses}`
        : '未开始';

  const iconBg = done
    ? 'bg-tll'
    : isPlanned
      ? 'bg-bd/50'
      : accent === 'pp'
        ? 'bg-ppl'
        : accent === 'am'
          ? 'bg-aml'
          : 'bg-acl';
  const iconColor = done ? 'text-tl' : isPlanned ? 'text-txt' : accent === 'pp' ? 'text-pp' : accent === 'am' ? 'text-am' : 'text-ac';
  const subColor = done ? 'text-tl' : isPlanned ? 'text-txt' : 'text-txs';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-ds-lg border transition-all ${
        isCurrent ? 'border-ac bg-acl shadow-ds-sm' : isPlanned ? 'border-dashed border-bd bg-bgs' : 'border-bd bg-card'
      }`}
    >
      {isCurrent && <span className="absolute top-1.5 right-1.5 text-ds-xs">📍</span>}
      <span className={`w-10 h-10 rounded-ds-full flex items-center justify-center ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </span>
      <span className="text-ds-sm font-ds-semibold text-tx text-center leading-tight">{node.name}</span>
      <span className={`text-ds-xs ${subColor}`}>{sub}</span>
    </button>
  );
}
