/** 地图图例：说明节点状态色与当前位置标记。 */
export default function MapLegend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-ds-xs text-txs mt-6 px-4">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-full bg-card border border-bd" /> 未开始
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-full bg-acl border border-ac/30" /> 学习中
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-full bg-tll border border-tl" /> 已通览
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block px-1.5 py-0.5 rounded-ds-pill bg-ac text-white text-ds-xs leading-none">📍</span>
        你在这里
      </span>
    </div>
  );
}
