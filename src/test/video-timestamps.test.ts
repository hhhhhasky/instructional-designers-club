import { describe, expect, it } from 'vitest';
import { convertVideoTimestampText } from '@/lib/video-timestamps';

describe('convertVideoTimestampText', () => {
  it('converts downloaded timestamp lines and preserves non-timestamp notes', () => {
    const result = convertVideoTimestampText(
      '00:01 开宗明义\n\n07:43 三要素模型\n内容由 AI 生成，仅供参考',
    );

    expect(result.timestampCount).toBe(2);
    expect(result.markdown).toContain('- [00:01](#t=00:01) 开宗明义');
    expect(result.markdown).toContain('- [07:43](#t=07:43) 三要素模型');
    expect(result.markdown).toContain('内容由 AI 生成，仅供参考');
    expect(result.preservedLines).toEqual(['内容由 AI 生成，仅供参考']);
  });

  it('supports hour timestamps and rejects files without timestamp lines', () => {
    expect(convertVideoTimestampText('1:02:03 课程总结').markdown).toContain(
      '- [1:02:03](#t=1:02:03) 课程总结',
    );
    expect(() => convertVideoTimestampText('这不是时间轴文本')).toThrow('没有识别到时间戳');
  });
});
