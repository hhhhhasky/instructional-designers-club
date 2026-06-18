import { describe, expect, it } from 'vitest';
import {
  getCoursesForModule,
  normalizePlusCourseStructure,
  PLUS_TRACKS,
  resolvePlusCoursePlacement,
} from '@/lib/plusCourseStructure';
import type { Course } from '@/types/types';

const makeCourse = (overrides: Partial<Course>): Course => ({
  id: 'course-1',
  title: '动态模块测试课',
  description: null,
  instructor: null,
  category_id: null,
  category: null,
  level: '入门',
  duration: null,
  credits: null,
  status: 'published',
  membership_type: 'plus',
  is_trial: false,
  image_url: null,
  video_url: null,
  audio_url: null,
  body: null,
  essence: null,
  images: null,
  plus_lesson_order: null,
  plus_representative: false,
  meeting_url: null,
  sort_order: null,
  view_count: null,
  created_at: null,
  updated_at: null,
  ...overrides,
});

describe('plusCourseStructure dynamic modules', () => {
  it('从分类 plus_track_id 生成可渲染模块', () => {
    const courses = [
      makeCourse({
        id: 'course-dynamic-1',
        title: '复习课设计导论',
        category: '复习课篇',
        plus_lesson_order: 1,
      }),
    ];
    const tracks = normalizePlusCourseStructure(
      [
        {
          id: 'scenarios',
          title: '场景篇',
          short_title: '场景',
          subtitle: '',
          description: '',
          audience: '',
          icon_key: 'compass',
          accent: '',
          sort_order: 1,
          is_active: true,
          created_at: '',
          updated_at: '',
        },
      ],
      [],
      [
        {
          id: 'cat-review',
          name: '复习课篇',
          description: '复习课设计场景。',
          sort_order: 40,
          plus_track_id: 'scenarios',
          created_at: '',
          updated_at: '',
          is_active: true,
          applicable_audience: [],
          applicable_scenarios: [],
          content_types: [],
        },
      ],
    );

    const scenarios = tracks.find((track) => track.id === 'scenarios');
    const dynamicModule = scenarios?.modules.find((module) => module.id === '复习课篇');

    expect(dynamicModule?.title).toBe('复习课篇');
    expect(dynamicModule?.order).toBe(40);
    expect(getCoursesForModule(courses, 'scenarios', '复习课篇', tracks)).toHaveLength(1);
  });

  it('不会把 Pro 专属 AI 分类兜底归入 Plus 篇章', () => {
    const course = makeCourse({
      id: 'pro-ai-category-in-plus-map',
      title: 'AI 工具课',
      category: 'AI工具',
      membership_type: 'plus',
      sort_order: 1,
    });

    expect(resolvePlusCoursePlacement(course, PLUS_TRACKS)).toBeNull();
  });
});
