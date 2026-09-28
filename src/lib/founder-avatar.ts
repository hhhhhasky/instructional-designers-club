export const FOUNDER_PORTRAIT_URL = '/images/han-teacher-portrait.jpg';

const LEGACY_FOUNDER_PORTRAIT_URL =
  'https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/app-7iwdhpt0pypt/20260512/ChatGPT Image 2026年4月22日 12_26_23.png';

export function normalizeFounderAvatarUrl(value: string): string {
  return value === LEGACY_FOUNDER_PORTRAIT_URL ? FOUNDER_PORTRAIT_URL : value;
}
