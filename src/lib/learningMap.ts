import type {
  ExplorationLevel,
  MapNodeConfig,
} from '@/components/learning/map/learningMapConfig';
import {
  getMapNodeById,
  LEARNING_MAP_CONFIG,
} from '@/components/learning/map/learningMapConfig';
import { canAccessCourse } from '@/lib/access-control';
import type {
  MembershipType,
  SeriesCourseItem,
  SeriesProgress,
} from '@/types/types';

// ==================== 类型 ====================

/** 景点内的一个系列分组（下钻面板按系列展示课程用） */
export interface NodeSeriesGroup {
  categoryName: string;
  /** 该系列下全部课程（含不可访问的，下钻面板用锁图标区分） */
  courses: SeriesCourseItem[];
}

/** 单个景点的探索度聚合结果 */
export interface NodeExploration {
  nodeId: string;
  /** 可访问课程总数（分母，canAccess 过滤，按会员等级公平） */
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  /** 完成百分比 0-100 */
  completionPercentage: number;
  explorationLevel: ExplorationLevel;
  /** 按 node.categories 顺序的系列分组（下钻面板用） */
  seriesGroups: NodeSeriesGroup[];
  /** 该节点推荐下一课（进行中优先，否则未开始；已过滤 canAccess）。planned 节点为 null */
  nextCourse: { course: SeriesCourseItem; seriesName: string } | null;
}

export interface RecommendedNextCourse {
  course: SeriesCourseItem;
  seriesName: string;
  nodeId: string;
}

export interface LearningMapData {
  /** 全部节点（core/elements/foundations/toolkits）的探索度 */
  nodes: Record<string, NodeExploration>;
  /** 当前位置节点 id（按教学设计逻辑顺序，第一个有课且未通览的 element） */
  currentPositionNodeId: string | null;
  recommendedNextCourse: RecommendedNextCourse | null;
}

// ==================== 聚合 ====================

/**
 * 聚合单个节点的探索度。
 * - 按 node.categories 顺序找命中的 series，保留为 seriesGroups（含全部课程，下钻用）。
 * - 进度分母只计 canAccess 为真的课程（Pro 课不计入 Plus 用户分母）。
 */
export function aggregateNodeExploration(
  node: MapNodeConfig,
  seriesProgress: SeriesProgress[],
  accessLevel: MembershipType,
): NodeExploration {
  const seriesGroups: NodeSeriesGroup[] = [];
  for (const cat of node.categories) {
    const series = seriesProgress.find((s) => s.categoryName === cat);
    if (series && series.courses.length > 0) {
      seriesGroups.push({ categoryName: cat, courses: series.courses });
    }
  }

  let totalCourses = 0;
  let completedCourses = 0;
  let inProgressCourses = 0;
  for (const group of seriesGroups) {
    for (const c of group.courses) {
      if (!canAccessCourse(accessLevel, c.membershipType)) continue;
      totalCourses++;
      if (c.status === 'completed') completedCourses++;
      else if (c.status === 'in_progress') inProgressCourses++;
    }
  }

  const completionPercentage =
    totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;

  let explorationLevel: ExplorationLevel;
  if (node.isPlanned || totalCourses === 0) {
    explorationLevel = 'unexplored';
  } else if (completionPercentage >= 100) {
    explorationLevel = 'explored';
  } else {
    explorationLevel = 'started';
  }

  return {
    nodeId: node.id,
    totalCourses,
    completedCourses,
    inProgressCourses,
    completionPercentage,
    explorationLevel,
    seriesGroups,
    nextCourse: node.isPlanned ? null : pickNextCourseInNode(node, seriesProgress, accessLevel),
  };
}

/**
 * 在指定节点范围内找推荐下一课：优先「进行中」（继续学），否则「未开始」（开始新的）。
 * 推荐结果也过滤 canAccess（不推荐无权访问的课）。
 */
export function pickNextCourseInNode(
  node: MapNodeConfig,
  seriesProgress: SeriesProgress[],
  accessLevel: MembershipType,
): { course: SeriesCourseItem; seriesName: string } | null {
  const accessible = (c: SeriesCourseItem) => canAccessCourse(accessLevel, c.membershipType);

  // 优先：进行中
  for (const cat of node.categories) {
    const series = seriesProgress.find((s) => s.categoryName === cat);
    if (!series) continue;
    const inProg = series.courses.find((c) => c.status === 'in_progress' && accessible(c));
    if (inProg) return { course: inProg, seriesName: cat };
  }
  // 其次：未开始
  for (const cat of node.categories) {
    const series = seriesProgress.find((s) => s.categoryName === cat);
    if (!series) continue;
    const notStarted = series.courses.find((c) => c.status === 'not_started' && accessible(c));
    if (notStarted) return { course: notStarted, seriesName: cat };
  }
  return null;
}

/** 组装完整地图数据（从 seriesProgress 派生，零网络开销） */
export function buildLearningMapData(
  seriesProgress: SeriesProgress[],
  accessLevel: MembershipType,
): LearningMapData {
  const { core, elements, foundations, toolkits } = LEARNING_MAP_CONFIG;
  const allNodes = [core, ...elements, ...foundations, ...toolkits];

  const nodes: Record<string, NodeExploration> = {};
  for (const node of allNodes) {
    nodes[node.id] = aggregateNodeExploration(node, seriesProgress, accessLevel);
  }

  // 当前位置：按 order 遍历 elements，跳过 planned（无课可推），找第一个未通览的
  let currentPositionNodeId: string | null = null;
  const orderedElements = [...elements].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const node of orderedElements) {
    if (node.isPlanned) continue;
    if (nodes[node.id].explorationLevel !== 'explored') {
      currentPositionNodeId = node.id;
      break;
    }
  }

  // 推荐下一课：基于当前位置节点
  let recommendedNextCourse: RecommendedNextCourse | null = null;
  if (currentPositionNodeId) {
    const node = getMapNodeById(currentPositionNodeId);
    if (node) {
      const next = pickNextCourseInNode(node, seriesProgress, accessLevel);
      if (next) {
        recommendedNextCourse = { ...next, nodeId: currentPositionNodeId };
      }
    }
  }

  return { nodes, currentPositionNodeId, recommendedNextCourse };
}

/** 是否所有「已上线」（非 planned）要素景点都已通览（庆祝态） */
export function isAllElementsExplored(data: LearningMapData): boolean {
  return (
    data.currentPositionNodeId === null &&
    LEARNING_MAP_CONFIG.elements.some((e) => !e.isPlanned)
  );
}
