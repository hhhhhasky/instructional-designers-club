import { describe, expect, it } from 'vitest';
import { getCoursesForModule, getEffectivePlusTracks, PLUS_TRACKS } from '@/lib/plusCourseStructure';
import type { Course } from '@/types/types';

const makeCourse = (overrides: Partial<Course>): Course => ({
  id: 'course-1',
  title: '动态模块测试课',
  description: null,
  instructor: null,
  category_id: null,
  category: null,
  level: '入门',
  semester: null,
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
  plus_track_id: null,
  plus_module_id: null,
  plus_module_order: null,
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
  it('课程字段里出现的新 module id 会自动生成可渲染模块', () => {
    const courses = [
      makeCourse({
        id: 'course-dynamic-1',
        title: '复习课设计导论',
        plus_track_id: 'scenarios',
        plus_module_id: 'review-lesson',
        plus_module_order: 40,
        plus_lesson_order: 1,
      }),
    ];

    const tracks = getEffectivePlusTracks(courses, PLUS_TRACKS);
    const scenarios = tracks.find((track) => track.id === 'scenarios');
    const dynamicModule = scenarios?.modules.find((module) => module.id === 'review-lesson');

    expect(dynamicModule?.title).toBe('review-lesson');
    expect(dynamicModule?.order).toBe(40);
    expect(getCoursesForModule(courses, 'scenarios', 'review-lesson', tracks)).toHaveLength(1);
  });
});
