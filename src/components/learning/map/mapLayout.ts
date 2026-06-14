import { getMapNodeById } from './learningMapConfig';

/**
 * 地图坐标访问层。
 * - 默认坐标来自 learningMapConfig 的 mapPos（图像分析估算的建筑中心）。
 * - 运营可在 /learning-map?mapedit=1 拖拽节点微调，覆盖值存 localStorage（仅本地浏览器），
 *   满意后导出 JSON，由开发写入配置。这样非技术的运营也能自助校准坐标。
 */

const LS_KEY = 'learning-map-positions-v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readOverrides(): Record<string, { x: number; y: number }> {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, { x: number; y: number }>) : {};
  } catch {
    return {};
  }
}

/** 节点坐标：优先 localStorage 覆盖，其次配置 mapPos。无坐标返回 null。 */
export function getNodeMapPos(nodeId: string): { x: number; y: number } | null {
  const overrides = readOverrides();
  if (overrides[nodeId]) return overrides[nodeId];
  return getMapNodeById(nodeId)?.mapPos ?? null;
}

/** 所有节点的当前坐标（含覆盖），用于导出/调试。 */
export function getAllNodeMapPos(): Record<string, { x: number; y: number }> {
  const result: Record<string, { x: number; y: number }> = {};
  for (const id of Object.keys(readOverrides())) {
    const p = getNodeMapPos(id);
    if (p) result[id] = p;
  }
  return result;
}

/** 编辑模式：覆盖某节点坐标（写 localStorage）。 */
export function setNodeMapPos(nodeId: string, pos: { x: number; y: number }): void {
  if (!isBrowser()) return;
  const overrides = readOverrides();
  overrides[nodeId] = { x: Math.round(pos.x * 10) / 10, y: Math.round(pos.y * 10) / 10 };
  window.localStorage.setItem(LS_KEY, JSON.stringify(overrides));
}

/** 清除所有覆盖（恢复配置默认坐标）。 */
export function clearNodeMapPosOverrides(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(LS_KEY);
}
