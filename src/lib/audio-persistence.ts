const STORAGE_KEY = 'audio-playback-position';

interface StoredAudioState {
  courseId: string;
  currentTime: number;
  timestamp: number;
}

/**
 * 保存音频播放位置
 */
export function saveAudioPosition(courseId: string, currentTime: number): void {
  if (typeof window === 'undefined') return;
  try {
    const state: StoredAudioState = {
      courseId,
      currentTime,
      timestamp: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing or blocked storage
  }
}

/**
 * 读取音频播放位置（仅当课程ID匹配时返回）
 */
export function loadAudioPosition(courseId: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const state: StoredAudioState = JSON.parse(raw);
    // 课程不匹配或数据过期（超过7天）则忽略
    if (state.courseId !== courseId || Date.now() - state.timestamp > 7 * 24 * 60 * 60 * 1000) {
      return null;
    }

    return state.currentTime;
  } catch {
    return null;
  }
}

/**
 * 清除音频播放位置
 */
export function clearAudioPosition(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
