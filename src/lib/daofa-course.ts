export interface DaofaLesson {
  id: string;
  title: string;
  subtitle: string;
  kind: 'video' | 'canvas';
  mediaAvailable?: boolean;
}

export interface DaofaChapter {
  id: string;
  title: string;
  description: string;
  lessons: DaofaLesson[];
}

const bookLessons: DaofaLesson[] = Array.from({ length: 9 }, (_, index) => index + 1)
  .flatMap((grade) => ['上', '下'].map((semester, semesterIndex) => ({
    id: `grade-${grade}-${semesterIndex === 0 ? 'up' : 'down'}`,
    title: `${['一', '二', '三', '四', '五', '六', '七', '八', '九'][grade - 1]}年级${semester}册`,
    subtitle: '按教材定位、单元关系、单课作用三个层次读懂这一册。',
    kind: 'video' as const,
  })));

export const DAOFA_CHAPTERS: DaofaChapter[] = [
  {
    id: 'overview',
    title: '总论篇',
    description: '先建立课标到教材的整体地图，再用同一套方法进入每一册。',
    lessons: [
      { id: 'introduction', title: '第 0 课｜这套课怎样帮你看懂教材', subtitle: '课程定位、学习顺序与使用方法。', kind: 'video', mediaAvailable: true },
      { id: 'standard-to-unit', title: '第 1 课｜从课标到单元', subtitle: '18 册教材怎样落实课标。', kind: 'video', mediaAvailable: true },
      { id: 'unit-to-lesson', title: '第 2 课｜从单元到单课', subtitle: '看懂教材的内部逻辑与单课作用。', kind: 'video', mediaAvailable: true },
      { id: 'alignment-canvas-guide', title: '附加课｜三元对齐画布操作与查证', subtitle: '用路径画布和册次分布追溯单元位置。', kind: 'video', mediaAvailable: true },
      { id: 'alignment-canvas', title: '交互画布｜课标素养 × 内容要求 × 教材单元', subtitle: '阅读 X → C → U 对齐路径，按学段、主题和册次筛选。', kind: 'canvas' },
    ],
  },
  {
    id: 'books',
    title: '分册解读篇',
    description: '覆盖一至九年级上下册，共 18 册；可按正在使用的教材直接查阅。',
    lessons: bookLessons,
  },
];

export const DAOFA_LESSONS = DAOFA_CHAPTERS.flatMap((chapter) => chapter.lessons);

export function getDaofaLesson(id: string | undefined) {
  return DAOFA_LESSONS.find((lesson) => lesson.id === id);
}
