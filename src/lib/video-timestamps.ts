export interface ConvertedVideoTimestampText {
  markdown: string;
  timestampCount: number;
  preservedLines: string[];
}

const TIMESTAMP_LINE_RE = /^\s*(?:[-*]\s*)?(?:\[)?((?:\d{1,2}:)?\d{1,2}:\d{2})(?:\])?\s+(.+?)\s*$/;

function parseTimestamp(value: string): number | null {
  const parts = value.split(':').map(Number);
  if (!parts.every(Number.isFinite)) return null;

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    if (seconds >= 60) return null;
    return minutes * 60 + seconds;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    if (minutes >= 60 || seconds >= 60) return null;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
}

/**
 * 将下载的“时间戳 + 梗概”纯文本转换为课程正文 Markdown。
 * 未匹配的行会原样保留在转换结果末尾，避免导入时静默丢失免责声明或备注。
 */
export function convertVideoTimestampText(input: string): ConvertedVideoTimestampText {
  const lines = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const converted: string[] = [];
  const preservedLines: string[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const match = line.match(TIMESTAMP_LINE_RE);
    if (!match || parseTimestamp(match[1]) === null) {
      preservedLines.push(line.trim());
      continue;
    }
    converted.push(`- [${match[1]}](#t=${match[1]}) ${match[2]}`);
  }

  if (converted.length === 0) {
    throw new Error('没有识别到时间戳。格式应为“00:01 这一段讲了什么”。');
  }

  const markdown = [
    converted.join('\n'),
    preservedLines.length > 0 ? preservedLines.join('\n') : '',
  ].filter(Boolean).join('\n\n');

  return {
    markdown,
    timestampCount: converted.length,
    preservedLines,
  };
}
