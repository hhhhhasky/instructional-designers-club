/**
 * Final presentation cleanup for HAI Chat. This is intentionally formatting
 * only; diagnosis and response policy stay inside the published Skill.
 */
export function normalizeHaiVoiceFormatting(answer: string) {
  return answer
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.、]\s*/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/第一个/g, "先看")
    .replace(/第二个/g, "再看")
    .replace(/第三个/g, "最后看")
    .replace(/第一[，,、]/g, "先看，")
    .replace(/第二[，,、]/g, "再看，")
    .replace(/第三[，,、]/g, "最后看，")
    .replace(/一是/g, "先看")
    .replace(/二是/g, "再看")
    .replace(/三是/g, "最后看")
    .replace(/这三件事/g, "这条主线")
    .replace(/三件事/g, "下面这条主线")
    .replace(/只写三行/g, "只写清一条主线")
    .replace(/[“”]/g, "")
    .replace(/：/g, "，")
    .replace(/；/g, "。")
    .replace(/——/g, "，")
    .replace(/，{2,}/g, "，")
    .replace(/。{2,}/g, "。")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/(?<!\n)\n(?!\n)/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
