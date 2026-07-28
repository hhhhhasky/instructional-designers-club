import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MarkdownRenderer, { parseVideoTimestamp } from '@/components/common/MarkdownRenderer';

describe('MarkdownRenderer', () => {
  it('parses supported video timestamp formats', () => {
    expect(parseVideoTimestamp('01:15')).toBe(75);
    expect(parseVideoTimestamp('1:02:03')).toBe(3723);
    expect(parseVideoTimestamp('75')).toBe(75);
    expect(parseVideoTimestamp('1:75')).toBeNull();
  });

  it('renders timestamp links as seek buttons when a video callback is provided', async () => {
    const onVideoSeek = vi.fn();
    const { getByRole } = render(
      <MarkdownRenderer content="[01:15](#t=01:15) 目标与活动" onVideoSeek={onVideoSeek} />,
    );

    await userEvent.setup().click(getByRole('button', { name: '跳转到视频时间点 01:15' }));
    expect(onVideoSeek).toHaveBeenCalledWith(75);
  });

  it('renders details and summary answer blocks while parsing markdown inside', () => {
    render(
      <MarkdownRenderer
        content={`题目正文

<details>
<summary>🔒 答案（做完再看）</summary>

\`−x = −4\`，两边同除以 \`−1\`，得 \`x = 4\`。
验算：左边 \`(2×4 + 1)/3 = 9/3 = 3\`；右边 \`4 − 1 = 3\` ✅。

</details>`}
      />
    );

    const details = screen.getByText('🔒 答案（做完再看）').closest('details');
    expect(details).toBeInTheDocument();
    expect(screen.getByText('−x = −4')).toBeInTheDocument();
    expect(screen.getByText('(2×4 + 1)/3 = 9/3 = 3')).toBeInTheDocument();
    expect(screen.queryByText('<details>')).not.toBeInTheDocument();
  });

  it('keeps common GFM syntax available', () => {
    render(
      <MarkdownRenderer
        content={`| 步骤 | 判断 |
| --- | --- |
| 去分母 | ✅ |

- [x] 已完成
- [ ] 待完成

~~旧答案~~`}
      />
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('去分母')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
    expect(screen.getByText('旧答案').tagName.toLowerCase()).toBe('del');
  });

  it('does not enable arbitrary raw html', () => {
    const { container } = render(<MarkdownRenderer content={'<script>alert("xss")</script>'} />);

    expect(container.querySelector('script')).not.toBeInTheDocument();
    expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument();
  });
});
