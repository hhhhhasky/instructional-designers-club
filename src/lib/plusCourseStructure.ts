import {
  Award,
  BookOpen,
  Brain,
  ClipboardCheck,
  Compass,
  FileText,
  GraduationCap,
  Layers,
  Lightbulb,
  ListChecks,
  MessageSquare,
  Presentation,
  RefreshCcw,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react';
import type { Course, PlusCourseModuleRow, PlusCourseTrackId, PlusCourseTrackRow } from '@/types/types';

export interface PlusModuleConfig {
  id: string;
  title: string;
  description: string;
  shortTitle?: string;
  iconKey?: string;
  order: number;
  categoryNames: string[];
  representativeTitles: string[];
}

export interface PlusTrackConfig {
  id: PlusCourseTrackId;
  title: string;
  shortTitle: string;
  subtitle: string;
  description: string;
  audience: string;
  iconKey?: string;
  icon: LucideIcon;
  accent: string;
  order?: number;
  modules: PlusModuleConfig[];
}

export interface PlusProblemEntry {
  label: string;
  description: string;
  trackId: PlusCourseTrackId;
  moduleId?: string;
}

export interface PlusRecommendedPath {
  title: string;
  description: string;
  steps: string[];
  trackId: PlusCourseTrackId;
  moduleId?: string;
}

export interface StructuredPlusCourse extends Course {
  resolvedTrackId: PlusCourseTrackId;
  resolvedModuleId: string;
  resolvedModuleOrder: number;
  resolvedLessonOrder: number;
}

export const PLUS_TRACKS: PlusTrackConfig[] = [
  {
    id: 'theory',
    title: '理论篇',
    shortTitle: '理论基石',
    subtitle: '理解学习、教学和认知的底层规律',
    description: '回答“学习如何发生、教学为什么有效、哪些方法有研究依据”。适合作为长期复盘和专业进阶的理论库。',
    audience: '想把教学设计做深、做稳的老师',
    icon: Brain,
    accent: 'from-[#8b5a2b] to-[#c45d3e]',
    modules: [
      {
        id: 'learning-science',
        title: '学习科学',
        description: '建立对学习科学、教学科学和评估科学的基础认识。',
        order: 10,
        categoryNames: ['学习科学篇', '应用学习科学', '应用学习科学共读'],
        representativeTitles: ['学习科学导论', '初识学习科学', '初识教学科学'],
      },
      {
        id: 'constructivism',
        title: '建构主义',
        description: '理解知识观、学习观、教学观，以及它们如何影响教学设计。',
        order: 20,
        categoryNames: ['建构主义', '建构主义学习营'],
        representativeTitles: ['建构主义的知识观', '建构主义的学习观', '建构主义的教学设计'],
      },
      {
        id: 'cognitive-load',
        title: '认知负荷理论',
        description: '用工作记忆和负荷管理解释知识呈现、任务安排与练习设计。',
        order: 30,
        categoryNames: ['认知负荷理论', '认知负荷理论共读'],
        representativeTitles: ['初识认知负荷理论', '认知负荷理论基本原理', '优化内部认知负荷的教学策略'],
      },
      {
        id: 'rosenshine',
        title: '罗森海因教学原理',
        shortTitle: '罗森海因',
        description: '把有效教学研究转化为清晰讲解、提问、复习和练习策略。',
        order: 40,
        categoryNames: ['罗森海因篇', '罗森海因共读'],
        representativeTitles: ['初识罗森海因教学原理', '教学原理01：调扶放', '教学原理03：勤复习'],
      },
      {
        id: 'teaching-illusion',
        title: '教学幻象',
        description: '从常见教学误区切入，辨析课堂中“看似有效”的幻象。',
        order: 50,
        categoryNames: ['教学幻象', '选修课'],
        representativeTitles: ['教学幻象'],
      },
    ],
  },
  {
    id: 'design-principles',
    title: '教学设计原理篇',
    shortTitle: '设计原理',
    subtitle: '把理论转化为可操作的备课方法',
    description: '围绕教材、学情、目标、任务、讲授和评价形成一节课的设计闭环。',
    audience: '想系统提升教学设计能力的一线老师',
    icon: Target,
    accent: 'from-[#2a7a6e] to-[#c45d3e]',
    modules: [
      {
        id: 'design-foundation',
        title: '设计总论',
        description: '建立教学设计的整体框架，理解一节课从问题到方案的基本逻辑。',
        order: 5,
        categoryNames: ['教学原理篇', '教学设计', '教学设计101Course'],
        representativeTitles: ['教学设计', '教学原理', '整体结构'],
      },
      {
        id: 'student-insight',
        title: '学情分析',
        description: '从用户洞察、质量光谱和工具箱入手，判断学生真实学习起点。',
        order: 10,
        categoryNames: ['学情分析篇'],
        representativeTitles: ['为什么需要用户洞察？', '洞察三维度', '用户洞察工具箱'],
      },
      {
        id: 'goals',
        title: '教学目标',
        description: '用布鲁姆、马扎诺和 SOLO 等框架，把课标和教材转成可执行目标。',
        order: 20,
        categoryNames: ['教学目标篇', '教学目标学习营'],
        representativeTitles: ['初识布鲁姆教育目标分类学框架', '教学目标设计三步法', '分析12个优质课教案的教学目标'],
      },
      {
        id: 'task-context',
        title: '任务情境',
        description: '从真实任务、KMR、任务脚本到任务串，设计有驱动力的学习活动。',
        order: 30,
        categoryNames: ['任务情境篇', '真实任务设计', '真实任务设计实操营', 'PBL项目式学习'],
        representativeTitles: ['AI时代为什么需要任务教学？', 'KMR设计法：如何改造课后习题？', '任务脚本：如何从0到1原创任务？'],
      },
      {
        id: 'assessment',
        title: '教学评价',
        description: '用逆向设计、提问互动、评价量规和课堂小结形成评价闭环。',
        order: 40,
        categoryNames: ['教学评价篇', '课堂管理'],
        representativeTitles: ['为什么现在这么看重评价？', '评价方法1：逆向设计', '评价方法3：评价量规'],
      },
      {
        id: 'concept-teaching',
        title: '概念教学',
        description: '从“教教材”转向“教概念”，掌握归纳和演绎两类核心策略。',
        order: 50,
        categoryNames: ['概念教学篇'],
        representativeTitles: ['为什么你需要掌握概念教学？', '重新理解概念', '如何教概念：归纳策略'],
      },
      {
        id: 'lecture-method',
        title: '讲授法',
        description: '重新认识讲授，设计纯讲授、互动讲授和讲授形式。',
        order: 60,
        categoryNames: ['讲授法篇'],
        representativeTitles: ['重新认识讲授法', '如何设计60分钟纯粹讲授？', '如何设计互动讲授？'],
      },
    ],
  },
  {
    id: 'scenarios',
    title: '场景篇',
    shortTitle: '场景应用',
    subtitle: '把教学设计原理用到真实任务里',
    description: '不按知识点拆课，而按老师正在完成的任务组织内容：日常备课、说课、公开课和未来场景。',
    audience: '马上要备课、说课或打磨公开课的老师',
    icon: Compass,
    accent: 'from-[#b8860b] to-[#2a7a6e]',
    modules: [
      {
        id: 'daily-lesson',
        title: '日常课篇',
        description: '用最小闭环快速完成普通课设计：教材、学情、目标、活动、评价。',
        order: 10,
        categoryNames: ['日常课篇', '讲授法篇', '罗森海因篇'],
        representativeTitles: ['单课任务驱动：任务串与子任务拆解', '如何设计互动讲授？', '教学原理03：勤复习'],
      },
      {
        id: 'shuoke',
        title: '说课篇',
        description: '完整保留说课 01-08，解决说课结构、表达和评委沟通问题。',
        order: 20,
        categoryNames: ['说课篇'],
        representativeTitles: ['说课篇01：整体结构', '说课篇02：教材分析', '说课篇07：教学过程'],
      },
      {
        id: 'open-class',
        title: '公开课篇',
        description: '从选题、教材深挖、任务情境、主问题到磨课和材料包。',
        order: 30,
        categoryNames: ['公开课篇', '课例分析'],
        representativeTitles: ['公开课任务情境导入', '初中思政同课异构《历久弥新的思想理念》', '公开课案例拆解'],
      },
      {
        id: 'future-scenarios',
        title: '未来场景',
        description: '复习课、试卷讲评课、家庭教育、教育机构和教育产品等后续扩展方向。',
        order: 90,
        categoryNames: ['复习课篇', '试卷讲评课篇', '家庭教育篇', '教育机构篇', '教育产品篇'],
        representativeTitles: [],
      },
    ],
  },
];

export const PLUS_TOOLBOX_MODULE: PlusModuleConfig = {
  id: 'toolbox',
  title: 'AI 与工具箱',
  description: 'AI 通识、图片/PPT 生成、NotebookLM 等工具内容，适合作为学习过程中的辅助资源。',
  order: 100,
  categoryNames: ['AI 通识课', 'AI工具', 'AI工具应用', '教育技术', 'ClaudeCode教程', 'AI科普'],
  representativeTitles: ['AI 通识课', 'NotebookLM', 'Gemini'],
};

export const PLUS_PROBLEM_ENTRIES: PlusProblemEntry[] = [
  { label: '我想系统提升教学设计能力', description: '从学情、目标、活动到评价建立完整方法。', trackId: 'design-principles' },
  { label: '我想理解教学背后的科学依据', description: '从学习科学、认知负荷和有效教学原理入手。', trackId: 'theory' },
  { label: '我明天就要备一节课', description: '进入日常课篇，用最小闭环快速备课。', trackId: 'scenarios', moduleId: 'daily-lesson' },
  { label: '我最近要参加说课', description: '完整学习说课结构、稿件和表达逻辑。', trackId: 'scenarios', moduleId: 'shuoke' },
  { label: '我要打磨一节公开课', description: '从选题、任务情境、主问题到磨课推进。', trackId: 'scenarios', moduleId: 'open-class' },
  { label: '我想提升课堂讲授效果', description: '结合讲授法与认知负荷优化表达。', trackId: 'design-principles', moduleId: 'lecture-method' },
  { label: '我想设计真实任务', description: '进入任务情境模块，学习 KMR 和任务脚本。', trackId: 'design-principles', moduleId: 'task-context' },
  { label: '我想写好教学目标', description: '用分类学工具把目标写具体、可评估。', trackId: 'design-principles', moduleId: 'goals' },
  { label: '我想让课堂评价更有效', description: '用逆向设计、提问互动和评价量规形成证据。', trackId: 'design-principles', moduleId: 'assessment' },
  { label: '我想教会学生真正理解概念', description: '学习概念教学的归纳和演绎策略。', trackId: 'design-principles', moduleId: 'concept-teaching' },
];

export const PLUS_RECOMMENDED_PATHS: PlusRecommendedPath[] = [
  {
    title: '新老师入门路径',
    description: '先把普通课设计闭环跑通。',
    steps: ['学情分析', '教学目标', '讲授法', '教学评价', '日常课篇'],
    trackId: 'design-principles',
  },
  {
    title: '公开课备赛路径',
    description: '从核心立意到课堂呈现逐步打磨。',
    steps: ['教材深挖', '任务情境导入', '主问题与任务链', '评价量规', '公开课案例拆解'],
    trackId: 'scenarios',
    moduleId: 'open-class',
  },
  {
    title: '说课备赛路径',
    description: '完整保留说课 01-08 的任务结构。',
    steps: ['整体结构', '教材分析', '学情分析', '教学目标', '教学过程', '板书总结'],
    trackId: 'scenarios',
    moduleId: 'shuoke',
  },
  {
    title: '教学理论进阶路径',
    description: '把底层理论变成专业判断力。',
    steps: ['学习科学', '建构主义', '认知负荷', '罗森海因', '教学幻象'],
    trackId: 'theory',
  },
];

export const TRACK_FLOW = [
  { title: '理论基石', icon: Brain, text: '学习如何发生' },
  { title: '设计原理', icon: Layers, text: '一节课如何设计' },
  { title: '场景应用', icon: Presentation, text: '真实任务如何落地' },
];

const MODULE_ICONS: Record<string, LucideIcon> = {
  'award': Award,
  'book-open': BookOpen,
  'brain': Brain,
  'clipboard-check': ClipboardCheck,
  'compass': Compass,
  'file-text': FileText,
  'graduation-cap': GraduationCap,
  'layers': Layers,
  'lightbulb': Lightbulb,
  'list-checks': ListChecks,
  'message-square': MessageSquare,
  'presentation': Presentation,
  'refresh-ccw': RefreshCcw,
  'sparkles': Sparkles,
  'target': Target,
  'learning-science': GraduationCap,
  constructivism: Lightbulb,
  'cognitive-load': Brain,
  rosenshine: ListChecks,
  'teaching-illusion': Sparkles,
  'design-foundation': Layers,
  'student-insight': Compass,
  goals: Target,
  'task-context': Layers,
  assessment: ClipboardCheck,
  'concept-teaching': BookOpen,
  'lecture-method': MessageSquare,
  'daily-lesson': FileText,
  shuoke: MessageSquare,
  'open-class': Presentation,
  'future-scenarios': RefreshCcw,
  toolbox: Sparkles,
};

function clonePlusTracks(tracks: PlusTrackConfig[]): PlusTrackConfig[] {
  return tracks.map((track) => ({
    ...track,
    modules: track.modules.map((module) => ({ ...module })),
  }));
}

function getIcon(iconKey: string | null | undefined): LucideIcon {
  if (!iconKey) return BookOpen;
  return MODULE_ICONS[iconKey] || BookOpen;
}

export function normalizePlusCourseStructure(
  trackRows: PlusCourseTrackRow[],
  moduleRows: PlusCourseModuleRow[],
): PlusTrackConfig[] {
  const modulesByTrack = new Map<string, PlusCourseModuleRow[]>();
  moduleRows.forEach((module) => {
    const modules = modulesByTrack.get(module.track_id) || [];
    modules.push(module);
    modulesByTrack.set(module.track_id, modules);
  });

  return trackRows
    .map((track) => ({
      id: track.id,
      title: track.title,
      shortTitle: track.short_title || track.title,
      subtitle: track.subtitle,
      description: track.description,
      audience: track.audience,
      iconKey: track.icon_key,
      icon: getIcon(track.icon_key),
      accent: track.accent || 'from-[#2a7a6e] to-[#c45d3e]',
      order: track.sort_order,
      modules: (modulesByTrack.get(track.id) || [])
        .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
        .map((module) => ({
          id: module.id,
          title: module.title,
          shortTitle: module.short_title || undefined,
          description: module.description,
          iconKey: module.icon_key || undefined,
          order: module.sort_order,
          categoryNames: module.category_names || [],
          representativeTitles: module.representative_titles || [],
        })),
    }))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.id.localeCompare(b.id));
}

export function getEffectivePlusTracks(
  courses: Course[],
  baseTracks: PlusTrackConfig[] = PLUS_TRACKS,
): PlusTrackConfig[] {
  const tracks = clonePlusTracks(baseTracks.length > 0 ? baseTracks : PLUS_TRACKS);
  const trackById = new Map(tracks.map((track) => [track.id, track]));

  courses
    .filter((course) => course.membership_type === 'plus' && course.plus_track_id && course.plus_module_id)
    .forEach((course) => {
      const trackId = course.plus_track_id as string;
      const moduleId = course.plus_module_id as string;
      let track = trackById.get(trackId);

      if (!track) {
        track = {
          id: trackId,
          title: trackId,
          shortTitle: trackId,
          subtitle: '',
          description: '',
          audience: '',
          iconKey: 'book-open',
          icon: BookOpen,
          accent: 'from-[#2a7a6e] to-[#c45d3e]',
          order: course.plus_module_order ?? 999,
          modules: [],
        };
        tracks.push(track);
        trackById.set(trackId, track);
      }

      if (!track.modules.some((module) => module.id === moduleId)) {
        track.modules.push({
          id: moduleId,
          title: moduleId,
          description: '这个模块正在整理中，相关课程会陆续补充到这里。',
          iconKey: 'book-open',
          order: course.plus_module_order ?? 999,
          categoryNames: [],
          representativeTitles: [],
        });
      }
    });

  return tracks
    .map((track) => ({
      ...track,
      modules: [...track.modules].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.id.localeCompare(b.id));
}

export function getPlusTrack(trackId: string | undefined, tracks: PlusTrackConfig[] = PLUS_TRACKS): PlusTrackConfig | undefined {
  return tracks.find((track) => track.id === trackId);
}

export function getPlusModule(
  trackId: PlusCourseTrackId,
  moduleId: string | null | undefined,
  tracks: PlusTrackConfig[] = PLUS_TRACKS,
): PlusModuleConfig | undefined {
  return getPlusTrack(trackId, tracks)?.modules.find((module) => module.id === moduleId);
}

export function getModuleIcon(moduleId: string): LucideIcon {
  return MODULE_ICONS[moduleId] || BookOpen;
}

export function buildPlusTrackUrl(trackId: PlusCourseTrackId, moduleId?: string): string {
  return `/courses/plus/${trackId}${moduleId ? `#${moduleId}` : ''}`;
}

export function resolvePlusCoursePlacement(
  course: Course,
  tracks: PlusTrackConfig[] = PLUS_TRACKS,
): StructuredPlusCourse | null {
  if (course.membership_type !== 'plus') return null;

  const normalizedTitle = course.title.replace(/\s+/g, '');
  if (/^说课篇0[1-8]/.test(normalizedTitle)) {
    return {
      ...course,
      resolvedTrackId: 'scenarios',
      resolvedModuleId: 'shuoke',
      resolvedModuleOrder: 20,
      resolvedLessonOrder: course.plus_lesson_order ?? course.sort_order ?? 999,
    };
  }

  const explicitTrackId = course.plus_track_id || undefined;
  const explicitModuleId = course.plus_module_id || undefined;

  if (explicitTrackId && explicitModuleId) {
    const module = getPlusModule(explicitTrackId, explicitModuleId, tracks);
    if (module) {
      return {
        ...course,
        resolvedTrackId: explicitTrackId,
        resolvedModuleId: explicitModuleId,
        resolvedModuleOrder: course.plus_module_order ?? module.order,
        resolvedLessonOrder: course.plus_lesson_order ?? course.sort_order ?? 999,
      };
    }
  }

  const category = course.category || '';
  for (const track of tracks) {
    for (const module of track.modules) {
      if (module.categoryNames.includes(category)) {
        return {
          ...course,
          resolvedTrackId: track.id,
          resolvedModuleId: module.id,
          resolvedModuleOrder: module.order,
          resolvedLessonOrder: course.sort_order ?? 999,
        };
      }
    }
  }

  if (PLUS_TOOLBOX_MODULE.categoryNames.includes(category)) {
    return {
      ...course,
      resolvedTrackId: 'design-principles',
      resolvedModuleId: PLUS_TOOLBOX_MODULE.id,
      resolvedModuleOrder: PLUS_TOOLBOX_MODULE.order,
      resolvedLessonOrder: course.sort_order ?? 999,
    };
  }

  return {
    ...course,
    resolvedTrackId: 'design-principles',
    resolvedModuleId: 'task-context',
    resolvedModuleOrder: 999,
    resolvedLessonOrder: course.sort_order ?? 999,
  };
}

export function structurePlusCourses(courses: Course[], tracks: PlusTrackConfig[] = PLUS_TRACKS): StructuredPlusCourse[] {
  return courses
    .map((course) => resolvePlusCoursePlacement(course, tracks))
    .filter((course): course is StructuredPlusCourse => Boolean(course))
    .sort((a, b) => (
      a.resolvedModuleOrder - b.resolvedModuleOrder ||
      a.resolvedLessonOrder - b.resolvedLessonOrder ||
      a.title.localeCompare(b.title, 'zh-Hans-CN')
    ));
}

export function getCoursesForTrack(
  courses: Course[],
  trackId: PlusCourseTrackId,
  tracks: PlusTrackConfig[] = PLUS_TRACKS,
): StructuredPlusCourse[] {
  return structurePlusCourses(courses, tracks).filter((course) => course.resolvedTrackId === trackId);
}

export function getCoursesForModule(
  courses: Course[],
  trackId: PlusCourseTrackId,
  moduleId: string,
  tracks: PlusTrackConfig[] = PLUS_TRACKS,
): StructuredPlusCourse[] {
  const module = getPlusModule(trackId, moduleId, tracks);
  const structured = structurePlusCourses(courses, tracks);
  const matched = structured.filter((course) => (
    course.resolvedTrackId === trackId && course.resolvedModuleId === moduleId
  ));

  if (!module) return matched;

  const reused = structured
    .filter((course) => module.categoryNames.includes(course.category || ''))
    .map((course) => ({
      ...course,
      resolvedTrackId: trackId,
      resolvedModuleId: moduleId,
      resolvedModuleOrder: module.order,
    }));

  const seen = new Set<string>();
  return [...matched, ...reused]
    .filter((course) => {
      if (seen.has(course.id)) return false;
      seen.add(course.id);
      return true;
    })
    .sort((a, b) => (
      a.resolvedLessonOrder - b.resolvedLessonOrder ||
      a.title.localeCompare(b.title, 'zh-Hans-CN')
    ));
}

export function getRepresentativeCourses(
  courses: Course[],
  module: PlusModuleConfig,
  max = 3,
  tracks: PlusTrackConfig[] = PLUS_TRACKS,
): Course[] {
  const normalized = courses.filter((course) => course.membership_type === 'plus');
  const explicit = normalized.filter((course) => {
    if (!course.plus_representative) return false;
    return resolvePlusCoursePlacement(course, tracks)?.resolvedModuleId === module.id;
  });
  const byTitle = module.representativeTitles
    .map((title) => normalized.find((course) => course.title.includes(title)))
    .filter((course): course is Course => Boolean(course));
  const byCategory = normalized.filter((course) => module.categoryNames.includes(course.category || ''));
  const merged = [...explicit, ...byTitle, ...byCategory];
  const seen = new Set<string>();
  return merged.filter((course) => {
    if (seen.has(course.id)) return false;
    seen.add(course.id);
    return true;
  }).slice(0, max);
}

export function getTrackCourseCount(
  courses: Course[],
  trackId: PlusCourseTrackId,
  tracks: PlusTrackConfig[] = PLUS_TRACKS,
): number {
  const track = getPlusTrack(trackId, tracks);
  if (!track) return 0;
  const seen = new Set<string>();
  track.modules.forEach((module) => {
    getCoursesForModule(courses, trackId, module.id, tracks).forEach((course) => seen.add(course.id));
  });
  return seen.size;
}

export function getModuleCourseCount(
  courses: Course[],
  trackId: PlusCourseTrackId,
  moduleId: string,
  tracks: PlusTrackConfig[] = PLUS_TRACKS,
): number {
  return getCoursesForModule(courses, trackId, moduleId, tracks).length;
}
