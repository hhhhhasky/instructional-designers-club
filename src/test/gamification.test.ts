import { describe, expect, it } from 'vitest';
import { buildGamificationSnapshot } from '@/lib/gamification';
import type { SeriesProgress } from '@/types/types';

function makeSeries(categoryName: string, status: 'not_started' | 'completed'): SeriesProgress {
  const completed = status === 'completed' ? 1 : 0;
  return {
    categoryName,
    totalCourses: 1,
    completedCourses: completed,
    inProgressCourses: 0,
    completionPercentage: completed * 100,
    courses: [
      {
        courseId: `${categoryName}-course`,
        title: `${categoryName}第一课`,
        credits: 1,
        status,
        progress: completed * 100,
        imageUrl: null,
        membershipType: 'plus',
        sortOrder: 1,
        duration: 12,
      },
    ],
  };
}

describe('buildGamificationSnapshot', () => {
  it('为课程表中新增的系列课自动生成徽章和任务进度', () => {
    const snapshot = buildGamificationSnapshot({
      overview: {
        totalCourses: 1,
        totalCredits: 0,
        completedCourses: 0,
        inProgressCourses: 0,
      },
      seriesProgress: [makeSeries('新增系列', 'not_started')],
      recentLearning: [],
      accessLevel: 'plus',
    });

    expect(snapshot.achievements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'series-新增系列',
        name: '新增系列研修者',
        completed: 0,
        target: 1,
      }),
    ]));
    expect(snapshot.quests).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'series',
        description: '新增系列 已完成 0/1 节。',
      }),
    ]));
  });

  it('新课完成后会同步更新动态徽章数字', () => {
    const snapshot = buildGamificationSnapshot({
      overview: {
        totalCourses: 1,
        totalCredits: 1,
        completedCourses: 1,
        inProgressCourses: 0,
      },
      seriesProgress: [makeSeries('新增系列', 'completed')],
      recentLearning: [],
      accessLevel: 'plus',
    });

    expect(snapshot.achievements.find(item => item.id === 'series-新增系列')).toEqual(
      expect.objectContaining({ state: 'unlocked', completed: 1, target: 1, progress: 100 }),
    );
  });
});
