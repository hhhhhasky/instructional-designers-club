/**
 * 相对时间格式化（用于动态流等场景）。
 * 过去：「3 分钟前」「2 小时前」「5 天前」；超过约 30 天显示「M月D日」。
 * 未来：「3 分钟后」「2 小时后」「5 天后」；超过约 30 天显示「M月D日」。
 * 解析失败或为空返回空串（调用方自行兜底）。
 */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";

  const diff = Date.now() - t; // 正=过去，负=未来
  const past = diff >= 0;
  const abs = Math.abs(diff);

  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  if (abs < HOUR) {
    const m = Math.max(1, Math.floor(abs / MIN));
    return past ? `${m} 分钟前` : `${m} 分钟后`;
  }
  if (abs < DAY) {
    const h = Math.max(1, Math.floor(abs / HOUR));
    return past ? `${h} 小时前` : `${h} 小时后`;
  }
  if (abs < 30 * DAY) {
    const d = Math.max(1, Math.floor(abs / DAY));
    return past ? `${d} 天前` : `${d} 天后`;
  }

  // 超过约 30 天，回退到绝对日期
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
