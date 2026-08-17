import { useEffect, useCallback } from 'react';
import type { CoursePlaybackRate } from '@/components/course/CoursePlaybackRateControl';

interface UseAudioKeyboardOptions {
  audioRef: React.RefObject<HTMLAudioElement>;
  isEnabled: boolean;
  onPlaybackRateChange?: (rate: CoursePlaybackRate) => void;
  currentPlaybackRate: CoursePlaybackRate;
}

const RATES: CoursePlaybackRate[] = [1, 1.25, 1.5, 2];
const SKIP_SECONDS = 15;
const FINE_SKIP_SECONDS = 5;

/**
 * 音频播放器快捷键支持
 * - 空格: 播放/暂停
 * - ←/→: 快退/快进 15 秒
 * - Shift + ←/→: 快退/快进 5 秒
 * - ↑/↓: 倍速切换
 */
export function useAudioKeyboard({
  audioRef,
  isEnabled,
  onPlaybackRateChange,
  currentPlaybackRate,
}: UseAudioKeyboardOptions) {
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (!isEnabled || !audioRef.current) return;

    const audio = audioRef.current;
    const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
      (event.target as HTMLElement).tagName
    );
    if (isInputFocused) return;

    switch (event.key) {
      case ' ':
        event.preventDefault();
        if (audio.paused) {
          void audio.play();
        } else {
          audio.pause();
        }
        break;

      case 'ArrowLeft':
        event.preventDefault();
        audio.currentTime = Math.max(0, audio.currentTime - (event.shiftKey ? FINE_SKIP_SECONDS : SKIP_SECONDS));
        break;

      case 'ArrowRight':
        event.preventDefault();
        audio.currentTime = Math.min(audio.duration ?? 0, audio.currentTime + (event.shiftKey ? FINE_SKIP_SECONDS : SKIP_SECONDS));
        break;

      case 'ArrowUp':
      case 'ArrowDown':
        if (onPlaybackRateChange) {
          event.preventDefault();
          const currentIndex = RATES.indexOf(currentPlaybackRate);
          const direction = event.key === 'ArrowUp' ? 1 : -1;
          const nextIndex = (currentIndex + direction + RATES.length) % RATES.length;
          onPlaybackRateChange(RATES[nextIndex]);
        }
        break;
    }
  }, [isEnabled, audioRef, onPlaybackRateChange, currentPlaybackRate]);

  useEffect(() => {
    if (!isEnabled) return;
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress, isEnabled]);
}
