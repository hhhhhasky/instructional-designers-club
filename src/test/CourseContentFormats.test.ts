import { describe, expect, it } from 'vitest';
import { getCourseContentFormats } from '@/components/course/CourseContentStack';
import type { Course } from '@/types/types';

describe('getCourseContentFormats', () => {
  it('uses public format flags without requiring protected content fields', () => {
    const metadataOnlyCourse = {
      has_video: true,
      has_body: true,
      has_audio: false,
      has_essence: true,
      has_images: false,
    } as Course;

    expect(getCourseContentFormats(metadataOnlyCourse)).toEqual(['video', 'article', 'essence']);
  });
});
