import { canAccessCourse } from '@/lib/access-control';
import { buildLearningMapData, type LearningMapData, type RecommendedNextCourse } from '@/lib/learningMap';
import type {
  Course,
  LearningOverview,
  MembershipType,
  RecentLearningItem,
  SeriesCourseItem,
  SeriesProgress,
} from '@/types/types';

export type AchievementState = 'locked' | 'in_progress' | 'unlocked' | 'planned';
export type QuestKind = 'continue' | 'short_course' | 'map_node' | 'series' | 'return';

interface AchievementDefinition {
  id: string;
  name: string;
  shortName: string;
  description: string;
  categories: string[];
  asset: string;
  accent: 'ac' | 'tl' | 'am' | 'pp';
}

export interface Achievement {
  id: string;
  name: string;
  shortName: string;
  description: string;
  categories: string[];
  asset: string;
  accent: 'ac' | 'tl' | 'am' | 'pp';
  state: AchievementState;
  completed: number;
  target: number;
  progress: number;
  remaining: number;
}

export interface Quest {
  id: string;
  kind: QuestKind;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  progress: number;
  target: number;
  accent: 'ac' | 'tl' | 'am' | 'pp';
}

export interface GamificationSnapshot {
  levelName: string;
  levelLabel: string;
  statusLine: string;
  completedCourses: number;
  totalCredits: number;
  unlockedAchievementCount: number;
  totalAchievementCount: number;
  exploredNodeCount: number;
  explorableNodeCount: number;
  explorationPercentage: number;
  currentNodeName: string | null;
  achievements: Achievement[];
  quests: Quest[];
  nextCourse: RecommendedNextCourse | null;
  mapData: LearningMapData;
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: 'objective-navigator',
    name: '目标导航者',
    shortName: '目标',
    description: '完成教学目标相关课程，能为一节课确定清晰方向。',
    categories: ['教学目标篇'],
    asset: '/images/gamification/badge-objective.svg',
    accent: 'ac',
  },
  {
    id: 'student-scout',
    name: '学情侦察员',
    shortName: '学情',
    description: '完成学情分析课程，能看见学生真实起点。',
    categories: ['学情分析篇'],
    asset: '/images/gamification/badge-student.svg',
    accent: 'tl',
  },
  {
    id: 'material-cartographer',
    name: '教材测绘师',
    shortName: '教材',
    description: '完成教材分析相关课程，能拆解内容结构和教学价值。',
    categories: ['教材分析篇'],
    asset: '/images/gamification/badge-material.svg',
    accent: 'am',
  },
  {
    id: 'keypoint-lens',
    name: '重难点透镜',
    shortName: '重难点',
    description: '完成重难点相关课程，能判断一节课真正要突破什么。',
    categories: ['教学重难点篇'],
    asset: '/images/gamification/badge-keypoint.svg',
    accent: 'pp',
  },
  {
    id: 'activity-designer',
    name: '活动设计师',
    shortName: '活动',
    description: '完成活动设计相关课程，能把目标转化为课堂任务。',
    categories: ['任务情境篇', '讲授法篇', '概念教学篇'],
    asset: '/images/gamification/badge-activity.svg',
    accent: 'ac',
  },
  {
    id: 'evaluation-calibrator',
    name: '评价校准师',
    shortName: '评价',
    description: '完成教学评价课程，能用证据判断学习是否发生。',
    categories: ['教学评价篇'],
    asset: '/images/gamification/badge-evaluation.svg',
    accent: 'tl',
  },
  {
    id: 'theory-grounder',
    name: '理论打底者',
    shortName: '理论',
    description: '完成基础理论课程，让教学设计有可解释的底层依据。',
    categories: ['建构主义', '学习科学篇', '认知负荷理论', '罗森海因篇'],
    asset: '/images/gamification/badge-theory.svg',
    accent: 'pp',
  },
  {
    id: 'ai-craftsperson',
    name: 'AI 教学工匠',
    shortName: 'AI',
    description: '完成 AI 工具与通识课程，把重复劳动交给工具。',
    categories: ['AI工具', 'AI 通识课', 'ClaudeCode教程', 'AI科普'],
    asset: '/images/gamification/badge-ai.svg',
    accent: 'am',
  },
];

export function buildGamificationSnapshot({
  overview,
  seriesProgress,
  recentLearning,
  accessLevel,
}: {
  overview: LearningOverview;
  seriesProgress: SeriesProgress[];
  recentLearning: RecentLearningItem[];
  accessLevel: MembershipType;
}): GamificationSnapshot {
  const mapData = buildLearningMapData(seriesProgress, accessLevel);
  const achievements = buildAchievements(seriesProgress, accessLevel);
  const unlockedAchievementCount = achievements.filter((a) => a.state === 'unlocked').length;
  const explorableNodes = Object.values(mapData.nodes).filter((n) => n.totalCourses > 0);
  const exploredNodeCount = explorableNodes.filter((n) => n.explorationLevel === 'explored').length;
  const explorationPercentage =
    explorableNodes.length > 0 ? Math.round((exploredNodeCount / explorableNodes.length) * 100) : 0;
  const currentNodeName = mapData.currentPositionNodeId
    ? getCurrentNodeName(mapData.currentPositionNodeId)
    : null;

  return {
    levelName: getLevelName(overview.completedCourses),
    levelLabel: getLevelLabel(overview.completedCourses),
    statusLine: buildStatusLine(currentNodeName, mapData.recommendedNextCourse, overview.completedCourses),
    completedCourses: overview.completedCourses,
    totalCredits: overview.totalCredits,
    unlockedAchievementCount,
    totalAchievementCount: achievements.length,
    exploredNodeCount,
    explorableNodeCount: explorableNodes.length,
    explorationPercentage,
    currentNodeName,
    achievements,
    quests: buildQuests(seriesProgress, recentLearning, achievements, mapData, accessLevel),
    nextCourse: mapData.recommendedNextCourse,
    mapData,
  };
}

export function findAchievementForCourse(
  course: Pick<Course, 'category'>,
  achievements: Achievement[],
): Achievement | null {
  if (!course.category) return null;
  return achievements.find((achievement) => achievement.categories.includes(course.category as string)) ?? null;
}

function buildAchievements(seriesProgress: SeriesProgress[], accessLevel: MembershipType): Achievement[] {
  return ACHIEVEMENT_DEFINITIONS.map((definition) => {
    const courses = getAccessibleCoursesForCategories(seriesProgress, definition.categories, accessLevel);
    const completed = courses.filter((course) => course.status === 'completed').length;
    const target = courses.length;
    const progress = target > 0 ? Math.round((completed / target) * 100) : 0;
    const state: AchievementState =
      target === 0 ? 'planned' : completed >= target ? 'unlocked' : completed > 0 ? 'in_progress' : 'locked';

    return {
      ...definition,
      state,
      completed,
      target,
      progress,
      remaining: Math.max(target - completed, 0),
    };
  });
}

function buildQuests(
  seriesProgress: SeriesProgress[],
  recentLearning: RecentLearningItem[],
  achievements: Achievement[],
  mapData: LearningMapData,
  accessLevel: MembershipType,
): Quest[] {
  const quests: Quest[] = [];
  const continueItem = recentLearning.find((item) => item.status === 'in_progress');
  if (continueItem) {
    quests.push({
      id: 'continue-current-course',
      kind: 'continue',
      title: '继续学习轨迹',
      description: `把《${continueItem.title}》推进到 100%。`,
      ctaLabel: '继续',
      href: `/courses/${continueItem.courseId}`,
      progress: Math.round(continueItem.progress || 0),
      target: 100,
      accent: 'ac',
    });
  }

  const shortCourse = findShortCourse(seriesProgress, accessLevel);
  if (shortCourse) {
    quests.push({
      id: 'finish-short-course',
      kind: 'short_course',
      title: '完成一节短课',
      description: `用 ${shortCourse.duration ?? 10} 分钟完成《${shortCourse.title}》。`,
      ctaLabel: '开始',
      href: `/courses/${shortCourse.courseId}`,
      progress: 0,
      target: 1,
      accent: 'am',
    });
  }

  const nextAchievement = achievements.find((item) => item.state === 'in_progress')
    ?? achievements.find((item) => item.state === 'locked' && item.target > 0);
  if (nextAchievement) {
    quests.push({
      id: `unlock-${nextAchievement.id}`,
      kind: 'map_node',
      title: `点亮${nextAchievement.shortName}徽章`,
      description: `还差 ${nextAchievement.remaining} 节课获得「${nextAchievement.name}」。`,
      ctaLabel: '查看地图',
      href: '/learning-map',
      progress: nextAchievement.completed,
      target: nextAchievement.target,
      accent: nextAchievement.accent,
    });
  }

  const nextSeries = findNextSeries(seriesProgress, accessLevel);
  if (nextSeries) {
    quests.push({
      id: `complete-series-${nextSeries.categoryName}`,
      kind: 'series',
      title: '完成一个系列课',
      description: `${nextSeries.categoryName} 已完成 ${nextSeries.completed}/${nextSeries.total} 节。`,
      ctaLabel: '查看课程',
      href: '/learning',
      progress: nextSeries.completed,
      target: nextSeries.total,
      accent: 'tl',
    });
  }

  const lastLearning = recentLearning[0];
  if (lastLearning && isOlderThanDays(lastLearning.lastWatchedAt, 3)) {
    quests.unshift({
      id: 'return-to-track',
      kind: 'return',
      title: '找回学习轨迹',
      description: '距离上次学习已超过 3 天，先接回最近的课程。',
      ctaLabel: '回到课程',
      href: `/courses/${lastLearning.courseId}`,
      progress: 0,
      target: 1,
      accent: 'pp',
    });
  }

  if (quests.length === 0 && mapData.recommendedNextCourse) {
    quests.push({
      id: 'start-first-map-course',
      kind: 'map_node',
      title: '开启第一段探索',
      description: `从《${mapData.recommendedNextCourse.course.title}》开始点亮学习地图。`,
      ctaLabel: '开始',
      href: `/courses/${mapData.recommendedNextCourse.course.courseId}`,
      progress: 0,
      target: 1,
      accent: 'ac',
    });
  }

  return quests.slice(0, 4);
}

function getAccessibleCoursesForCategories(
  seriesProgress: SeriesProgress[],
  categories: string[],
  accessLevel: MembershipType,
): SeriesCourseItem[] {
  return categories.flatMap((category) => {
    const series = seriesProgress.find((item) => item.categoryName === category);
    return series?.courses.filter((course) => canAccessCourse(accessLevel, course.membershipType)) ?? [];
  });
}

function findShortCourse(seriesProgress: SeriesProgress[], accessLevel: MembershipType): SeriesCourseItem | null {
  for (const series of seriesProgress) {
    const course = series.courses.find(
      (item) =>
        item.status !== 'completed' &&
        canAccessCourse(accessLevel, item.membershipType) &&
        typeof item.duration === 'number' &&
        item.duration <= 10,
    );
    if (course) return course;
  }
  return null;
}

function findNextSeries(
  seriesProgress: SeriesProgress[],
  accessLevel: MembershipType,
): { categoryName: string; completed: number; total: number } | null {
  for (const series of seriesProgress) {
    const accessible = series.courses.filter((course) => canAccessCourse(accessLevel, course.membershipType));
    if (accessible.length === 0) continue;
    const completed = accessible.filter((course) => course.status === 'completed').length;
    if (completed < accessible.length) {
      return { categoryName: series.categoryName, completed, total: accessible.length };
    }
  }
  return null;
}

function getLevelName(completedCourses: number): string {
  if (completedCourses >= 40) return '系统建构者';
  if (completedCourses >= 20) return '深度研修者';
  if (completedCourses >= 8) return '稳定探索者';
  if (completedCourses >= 1) return '学习启航者';
  return '新手探索者';
}

function getLevelLabel(completedCourses: number): string {
  if (completedCourses >= 40) return 'Lv.5';
  if (completedCourses >= 20) return 'Lv.4';
  if (completedCourses >= 8) return 'Lv.3';
  if (completedCourses >= 1) return 'Lv.2';
  return 'Lv.1';
}

function getCurrentNodeName(nodeId: string): string | null {
  const nodeNames: Record<string, string> = {
    objective: '教学目标',
    'student-analysis': '学情分析',
    material: '教材分析',
    'key-points': '教学重难点',
    activity: '教学活动',
    evaluation: '教学评价',
    foundation: '理论基石',
    toolkit: 'AI 工具箱',
  };
  return nodeNames[nodeId] ?? null;
}

function buildStatusLine(
  currentNodeName: string | null,
  nextCourse: RecommendedNextCourse | null,
  completedCourses: number,
): string {
  if (currentNodeName && nextCourse) {
    return `你正在探索${currentNodeName}区域，下一步是《${nextCourse.course.title}》。`;
  }
  if (completedCourses > 0) return '你已通览当前可访问的主线区域，可以回到地图复盘或探索工具课程。';
  return '从第一节课程开始，逐步点亮你的教学设计探索地图。';
}

function isOlderThanDays(date: string | null, days: number): boolean {
  if (!date) return false;
  return Date.now() - new Date(date).getTime() > days * 24 * 60 * 60 * 1000;
}
