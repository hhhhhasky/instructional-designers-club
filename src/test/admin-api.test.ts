import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminCreateCourse } from '@/db/admin-api';
import { supabase } from '@/db/supabase';
import type { Course } from '@/types/types';

vi.mock('@/db/api', () => ({
  clearAllLearningDataCaches: vi.fn(),
  clearCourseCatalogCache: vi.fn(),
  clearCourseDetailCache: vi.fn(),
  clearHomePageSnapshotCache: vi.fn(),
  clearResourcesCache: vi.fn(),
  getCourseProtectedContent: vi.fn(),
}));

vi.mock('@/db/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

const makeCoursePayload = (overrides: Partial<Omit<Course, 'id' | 'view_count' | 'created_at' | 'updated_at'>> = {}) => ({
  title: '长文课程',
  description: null,
  instructor: '哈老师',
  category_id: null,
  category: '日常课篇',
  level: '入门' as const,
  duration: 45,
  credits: '0.5',
  status: 'draft' as const,
  membership_type: 'plus' as const,
  is_trial: false,
  image_url: null,
  video_url: null,
  audio_url: null,
  body: null,
  essence: null,
  images: [],
  plus_lesson_order: null,
  plus_representative: false,
  meeting_url: null,
  sort_order: 0,
  ...overrides,
});

describe('admin course write payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a course with long markdown body and normalizes empty image urls', async () => {
    const insertedPayloads: unknown[] = [];
    const createdCourse = {
      ...makeCoursePayload(),
      id: 'course-1',
      view_count: 0,
      created_at: '2026-07-08T00:00:00Z',
      updated_at: '2026-07-08T00:00:00Z',
    };
    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn((payload) => {
        insertedPayloads.push(payload);
        return {
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: createdCourse, error: null }),
          })),
        };
      }),
    } as never);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: createdCourse, error: null } as never);

    const longBody = `# 《解一元一次方程》日常课教学设计\n\n${'把隐性的专家思考说出来。\n\n'.repeat(1200)}`;

    await adminCreateCourse(makeCoursePayload({
      body: longBody,
      images: [' https://example.com/one.png ', '', '   '],
    }));

    expect(insertedPayloads).toHaveLength(1);
    expect(insertedPayloads[0]).toMatchObject({
      title: '长文课程',
      body: longBody,
      images: ['https://example.com/one.png'],
    });
  });
});
