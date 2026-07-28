import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CoursePlaybackRateControl, {
  readStoredCoursePlaybackRate,
  writeStoredCoursePlaybackRate,
} from '@/components/course/CoursePlaybackRateControl';

describe('CoursePlaybackRateControl', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
        clear: () => values.clear(),
      } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>,
    });
  });

  it('allows selecting the supported playback rates', async () => {
    const user = userEvent.setup();
    let selected = 1 as 1 | 1.25 | 1.5 | 2;
    render(
      <CoursePlaybackRateControl
        value={selected}
        onChange={(rate) => {
          selected = rate;
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /当前 1\.0×/ }));
    await user.click(screen.getByRole('menuitemradio', { name: '1.5×' }));

    expect(selected).toBe(1.5);
  });

  it('reads valid stored values and falls back for invalid values', () => {
    writeStoredCoursePlaybackRate(2);
    expect(readStoredCoursePlaybackRate()).toBe(2);

    window.localStorage.setItem('course-playback-rate', '1.75');
    expect(readStoredCoursePlaybackRate()).toBe(1);
  });
});
