import { CheckCircle, Copy, RotateCcw } from 'lucide-react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useReducer, useRef, useState } from 'react';
import type { LearningMapData, NodeExploration } from '@/lib/learningMap';
import type { ExplorationLevel, MapNodeConfig } from './learningMapConfig';
import { ALL_MAP_NODES } from './learningMapConfig';
import {
  clearNodeMapPosOverrides,
  getAllNodeMapPos,
  getNodeMapPos,
  setNodeMapPos,
} from './mapLayout';

interface Props {
  data: LearningMapData;
  onSelect: (id: string) => void;
  /** ?mapedit=1 启用坐标校准：节点可拖拽、显示坐标、底部导出 JSON */
  editMode?: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * 图片版教学设计学习地图。
 * - AI 生成的横屏地图作底图（4:3），节点按 mapPos 百分比坐标叠加在对应建筑上。
 * - 动态要素：当前位置脉冲光圈 + "你在这里"、探索进度环、已通览勾、点击下钻。
 * - editMode 下可拖拽节点校准坐标，导出 JSON 供开发写入配置（运营自助）。
 */
export default function ImageMap({ data, onSelect, editMode = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<string | null>(null);
  const [, force] = useReducer((x) => x + 1, 0);

  const onPointerDown = (e: ReactPointerEvent, id: string) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = id;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!editMode || !dragRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100);
    setNodeMapPos(dragRef.current, { x, y });
    force();
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (dragRef.current) {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    }
    dragRef.current = null;
  };

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="relative w-full aspect-[4/3] rounded-ds-lg overflow-hidden bg-bgs border border-bd shadow-ds-sm select-none"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <img
          src={`${import.meta.env.BASE_URL}maps/learning-map.png`}
          alt="教学设计学习地图"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          draggable={false}
        />

        {ALL_MAP_NODES.map((node) => {
          const pos = getNodeMapPos(node.id);
          if (!pos) return null;
          return (
            <MapPin
              key={node.id}
              node={node}
              expl={data.nodes[node.id]}
              pos={pos}
              isCurrent={data.currentPositionNodeId === node.id}
              editMode={editMode}
              onClick={() => onSelect(node.id)}
              onPointerDown={(e) => onPointerDown(e, node.id)}
            />
          );
        })}
      </div>

      {editMode && <EditPanel onReset={force} />}
    </div>
  );
}

interface MapPinProps {
  node: MapNodeConfig;
  expl: NodeExploration | undefined;
  pos: { x: number; y: number };
  isCurrent: boolean;
  editMode: boolean;
  onClick: () => void;
  onPointerDown: (e: ReactPointerEvent) => void;
}

function MapPin({
  node,
  expl,
  pos,
  isCurrent,
  editMode,
  onClick,
  onPointerDown,
}: MapPinProps) {
  const isPlanned = !!node.isPlanned;
  const level = expl?.explorationLevel ?? 'unexplored';
  const pct = expl?.completionPercentage ?? 0;
  const hasCourses = !!expl && expl.totalCourses > 0;

  return (
    <div
      className="absolute z-10"
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
    >
      <button
        type="button"
        onPointerDown={onPointerDown}
        onClick={editMode ? undefined : onClick}
        aria-label={node.name}
        className={`relative block rounded-ds-full group touch-none ${
          editMode ? 'cursor-move' : 'cursor-pointer'
        }`}
      >
        {/* 当前位置扩散脉冲（Tailwind 内置 animate-ping） */}
        {isCurrent && !editMode && (
          <span className="absolute inset-0 rounded-ds-full border-2 border-ac animate-ping pointer-events-none" />
        )}

        {/* 热区底盘 */}
        <span
          className={`block w-12 h-12 md:w-14 md:h-14 rounded-ds-full transition-all ${
            isCurrent
              ? 'ring-4 ring-ac/50 bg-ac/10'
              : 'group-hover:ring-4 group-hover:ring-ac/30 group-hover:bg-ac/5'
          }`}
        />

        {/* 当前位置 flag */}
        {isCurrent && !editMode && (
          <span className="absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-ds-pill bg-ac text-white text-ds-xs font-ds-bold whitespace-nowrap shadow-ds-sm">
            📍 你在这里
          </span>
        )}

        {/* 状态徽章（建筑顶部右上角） */}
        {!editMode && (
          <StatusBadge
            level={level}
            pct={pct}
            isPlanned={isPlanned}
            hasCourses={hasCourses}
          />
        )}

        {/* editMode：坐标标签 */}
        {editMode && (
          <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1.5 py-0.5 rounded bg-tx/80 text-white text-[10px] whitespace-nowrap pointer-events-none">
            {node.id} · {pos.x},{pos.y}
          </span>
        )}
      </button>
    </div>
  );
}

/** 节点状态徽章：进行中=进度环+百分比 / 已通览=绿勾 / 规划中=虚线 / 有课未开始=小白点 */
function StatusBadge({
  level,
  pct,
  isPlanned,
  hasCourses,
}: {
  level: ExplorationLevel;
  pct: number;
  isPlanned: boolean;
  hasCourses: boolean;
}) {
  if (isPlanned) {
    return (
      <span className="absolute -top-1 -right-1 w-6 h-6 rounded-ds-full bg-white/85 border border-dashed border-txt/50 flex items-center justify-center shadow-ds-xs">
        <span className="text-[8px] text-txt/60 leading-none">规划</span>
      </span>
    );
  }
  if (level === 'explored') {
    return (
      <span className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-ds-full bg-tl border-2 border-white flex items-center justify-center shadow-ds-xs">
        <CheckCircle className="w-4 h-4 text-white" />
      </span>
    );
  }
  if (level === 'started' && pct > 0) {
    const r = 14;
    const c = 2 * Math.PI * r;
    return (
      <span className="absolute -top-2 -right-2 w-9 h-9 rounded-ds-full bg-white border-2 border-ac flex items-center justify-center shadow-ds-xs">
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="18" r={r} fill="none" stroke="var(--bdl)" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            stroke="var(--ac)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct / 100)}
          />
        </svg>
        <span className="text-[9px] font-ds-bold text-ac relative leading-none">{pct}</span>
      </span>
    );
  }
  // 有课但未开始：小白点提示可探索
  if (hasCourses) {
    return (
      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-ds-full bg-white border border-bd shadow-ds-xs" />
    );
  }
  return null;
}

function EditPanel({ onReset }: { onReset: () => void }) {
  const json = JSON.stringify(getAllNodeMapPos(), null, 2);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 剪贴板不可用时静默 */
    }
  };

  const reset = () => {
    clearNodeMapPosOverrides();
    onReset();
  };

  return (
    <div className="bg-aml border border-am/30 rounded-ds-md p-3 text-ds-xs">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <span className="font-ds-bold text-am">🔧 坐标校准模式</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-ds-md bg-white border border-bd text-tx"
          >
            <Copy className="w-3 h-3" />
            {copied ? '已复制' : '复制 JSON'}
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-ds-md bg-white border border-bd text-tx"
          >
            <RotateCcw className="w-3 h-3" />
            重置
          </button>
        </div>
      </div>
      <p className="text-txs mb-1.5">
        拖动每个标记对准对应建筑的中心，满意后点「复制 JSON」发给开发写入配置。坐标仅保存在本浏览器。
      </p>
      <pre className="bg-white/60 rounded-ds-md p-2 overflow-x-auto text-[10px] text-tx leading-relaxed">
        <code>{json}</code>
      </pre>
    </div>
  );
}
