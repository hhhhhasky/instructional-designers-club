import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Bot,
  ClipboardCheck,
  Compass,
  Focus,
  Library,
  Target,
  Users,
  Workflow,
} from 'lucide-react';

// ==================== 类型定义 ====================

/** 节点类型：中心 / 6 大要素景点 / 理论基石（聚合）/ AI 工具箱（聚合） */
export type MapNodeType = 'core' | 'element' | 'foundation' | 'toolkit';

/** 探索度档位（节点视觉强弱） */
export type ExplorationLevel = 'unexplored' | 'started' | 'explored';

/** 节点配置 */
export interface MapNodeConfig {
  id: string;
  type: MapNodeType;
  name: string;
  icon: LucideIcon;
  /** 一句话要素说明（下钻面板顶部展示） */
  desc: string;
  /** 更详细说明（课程空白景点用，解释要素 + 推荐相关理论） */
  longDesc?: string;
  /** 关联的 course category 名（一个景点可聚合多个系列） */
  categories: string[];
  /** 课程空白景点标记（无对应系列） */
  isPlanned?: boolean;
  /** 教学设计逻辑顺序（目标→学情→教材→重难点→活动→评价），用于「当前位置」判定 */
  order?: number;
  /** 地图底图上的百分比坐标（建筑中心，0-100，左上为 0,0）。坐标可被运营在 ?mapedit=1 微调覆盖 */
  mapPos?: { x: number; y: number };
  /** 下钻时推荐的关联理论 / 工具节点 id（指向聚合节点 'foundation' / 'toolkit'） */
  relatedFoundations?: string[];
  relatedToolkits?: string[];
}

export interface LearningMapConfig {
  core: MapNodeConfig;
  elements: MapNodeConfig[];
  foundations: MapNodeConfig[];
  toolkits: MapNodeConfig[];
}

// ==================== 中心节点 ====================
// 地图图片：画面正中央「教学设计系统」穹顶建筑，mapPos (50, 50)

const CORE_NODE: MapNodeConfig = {
  id: 'core-system',
  type: 'core',
  name: '一节课的教学设计系统',
  icon: Compass,
  desc: '完整一节课由目标、学情、教材、重难点、活动、评价六大要素构成。六者相互制约：目标决定评价，学情与教材共同决定重难点，活动服务于目标达成与难点突破。点击周围景点深入探索。',
  categories: ['教学原理篇', '课例分析'],
  mapPos: { x: 50, y: 50 },
  relatedFoundations: ['foundation'],
  relatedToolkits: ['toolkit'],
};

// ==================== 6 大要素景点 ====================
// order: 教学设计逻辑顺序；mapPos: 图片建筑中心（图像分析估算，可拖拽校准）

const ELEMENT_NODES: MapNodeConfig[] = [
  {
    id: 'objective',
    type: 'element',
    name: '教学目标',
    icon: Target,
    desc: '一节课要带学生去哪里。教学目标是教学设计的起点，决定后续所有环节的方向，也是评价的依据。',
    categories: ['教学目标篇'],
    order: 1,
    mapPos: { x: 50, y: 18.5 },
    relatedFoundations: ['foundation'],
    relatedToolkits: [],
  },
  {
    id: 'student-analysis',
    type: 'element',
    name: '学情分析',
    icon: Users,
    desc: '学生现在在哪里。了解学生已有的知识经验、认知水平与卡点，才能让目标可达成、活动可落地。',
    categories: ['学情分析篇'],
    order: 2,
    mapPos: { x: 82.5, y: 30.5 },
    relatedFoundations: ['foundation'],
    relatedToolkits: ['toolkit'],
  },
  {
    id: 'material',
    type: 'element',
    name: '教材分析',
    icon: BookOpen,
    desc: '这节课的内容是什么。厘清教材的知识结构、重点与逻辑层次，是确定教学重难点的基础。',
    longDesc:
      '教材分析是教学设计的基础环节，旨在厘清本节课所承载的知识结构、思想方法与逻辑层次：这节课在单元与课程体系中的位置、核心概念是什么、前后内容如何衔接、教材的编写意图如何。它是确定教学重难点、设计教学活动的直接依据。\n\n相关课程正在规划中。建议先从「学习科学」「认知负荷理论」等理论基础入手，理解内容分析的底层逻辑。',
    categories: [],
    isPlanned: true,
    order: 3,
    mapPos: { x: 82.5, y: 65.5 },
    relatedFoundations: ['foundation'],
    relatedToolkits: [],
  },
  {
    id: 'key-points',
    type: 'element',
    name: '教学重难点',
    icon: Focus,
    desc: '这节课最关键、最难的地方。基于目标、学情与教材共同确定，是教学活动要重点突破的核心。',
    longDesc:
      '教学重难点是教学设计的聚焦点，由教学目标、学情分析与教材分析共同决定：重点是这节课必须掌握的核心内容，难点是学生最易卡壳、需要特别设计策略突破的地方。它直接决定教学活动的力度分配与策略选择。\n\n相关课程正在规划中。建议先掌握「罗森海因教学原理」「认知负荷理论」，它们为识别和突破重难点提供了系统方法。',
    categories: [],
    isPlanned: true,
    order: 4,
    mapPos: { x: 50, y: 82.5 },
    relatedFoundations: ['foundation'],
    relatedToolkits: [],
  },
  {
    id: 'activity',
    type: 'element',
    name: '教学活动',
    icon: Workflow,
    desc: '怎么带学生走过去。设计任务、情境、讲授与互动，让学生在活动中达成目标、突破难点。',
    categories: ['任务情境篇', '讲授法篇', '概念教学篇'],
    order: 5,
    mapPos: { x: 18.5, y: 65.5 },
    relatedFoundations: ['foundation'],
    relatedToolkits: ['toolkit'],
  },
  {
    id: 'evaluation',
    type: 'element',
    name: '教学评价',
    icon: ClipboardCheck,
    desc: '怎么知道学生到了。设计评价工具与方式，检验目标是否达成，并反哺教学改进。',
    categories: ['教学评价篇'],
    order: 6,
    mapPos: { x: 18.5, y: 30.5 },
    relatedFoundations: ['foundation'],
    relatedToolkits: [],
  },
];

// ==================== 理论基石（聚合）====================
// 地图图片：左下角「理论基石」石碑群地标。聚合 4 个理论系列。

const FOUNDATION_NODES: MapNodeConfig[] = [
  {
    id: 'foundation',
    type: 'foundation',
    name: '理论基石',
    icon: Library,
    desc: '支撑六大要素的底层理论：建构主义解释学生如何主动建构知识，学习科学揭示学习的认知机制，认知负荷理论管理工作记忆瓶颈，罗森海因原理提炼高效教学的通用规律。打牢理论，设计才有根。',
    categories: ['建构主义', '学习科学篇', '认知负荷理论', '罗森海因篇'],
    mapPos: { x: 18.5, y: 85.5 },
  },
];

// ==================== AI 工具箱（聚合）====================
// 地图图片：右下角「AI 工具箱」机械工坊地标。聚合 4 个 AI 系列。

const TOOLKIT_NODES: MapNodeConfig[] = [
  {
    id: 'toolkit',
    type: 'toolkit',
    name: 'AI 工具箱',
    icon: Bot,
    desc: '用 AI 为教学设计赋能：AI 工具降本增效，AI 通识课建立基本认知，Claude Code 教程自动化备课流程，AI 科普零门槛入门。把重复劳动交给工具，把创造力留给设计。',
    categories: ['AI工具', 'AI 通识课', 'ClaudeCode教程', 'AI科普'],
    mapPos: { x: 82.5, y: 85.5 },
  },
];

// ==================== 导出 ====================

export const LEARNING_MAP_CONFIG: LearningMapConfig = {
  core: CORE_NODE,
  elements: ELEMENT_NODES,
  foundations: FOUNDATION_NODES,
  toolkits: TOOLKIT_NODES,
};

/** 所有节点（含 core/elements/foundations/toolkits），扁平化，便于按 id 查找与遍历渲染 */
export const ALL_MAP_NODES: MapNodeConfig[] = [
  CORE_NODE,
  ...ELEMENT_NODES,
  ...FOUNDATION_NODES,
  ...TOOLKIT_NODES,
];

/** 按 id 查节点配置 */
export function getMapNodeById(id: string): MapNodeConfig | undefined {
  return ALL_MAP_NODES.find((n) => n.id === id);
}
