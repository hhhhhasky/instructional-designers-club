import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MarkdownEditor from '@/components/admin/MarkdownEditor';
import { uploadCourseImage } from '@/db/course-media';

vi.mock('@/db/course-media', () => ({
  uploadCourseImage: vi.fn(),
}));

function ControlledEditor({ initialValue = '', enableVideoTimestamps = false }: { initialValue?: string; enableVideoTimestamps?: boolean }) {
  const [value, setValue] = useState(initialValue);
  return <MarkdownEditor value={value} onChange={setValue} enableVideoTimestamps={enableVideoTimestamps} />;
}

describe('MarkdownEditor image upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads a local image and inserts its R2 URL at the cursor', async () => {
    const user = userEvent.setup();
    vi.mocked(uploadCourseImage).mockResolvedValue('https://cdn.example.com/course-images/example.png');
    render(<ControlledEditor initialValue={'开头\n结尾'} />);

    const editor = screen.getByRole('textbox') as HTMLTextAreaElement;
    editor.focus();
    editor.setSelectionRange(3, 3);
    await user.upload(
      screen.getByLabelText('选择要上传的图片'),
      new File(['image'], '课堂照片.png', { type: 'image/png' }),
    );

    await waitFor(() => {
      expect(editor).toHaveValue(
        '开头\n![课堂照片](https://cdn.example.com/course-images/example.png)结尾',
      );
    });
    expect(uploadCourseImage).toHaveBeenCalledOnce();
  });

  it('removes the placeholder and shows the server error when upload fails', async () => {
    const user = userEvent.setup();
    vi.mocked(uploadCourseImage).mockRejectedValue(new Error('图片不能超过 10MB'));
    render(<ControlledEditor initialValue="正文" />);

    await user.upload(
      screen.getByLabelText('选择要上传的图片'),
      new File(['image'], 'too-large.png', { type: 'image/png' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('图片不能超过 10MB');
    expect(screen.getByRole('textbox')).toHaveValue('正文');
  });

  it('inserts a video timestamp template when enabled', async () => {
    const user = userEvent.setup();
    render(<ControlledEditor initialValue="前文" enableVideoTimestamps />);

    const editor = screen.getByRole('textbox') as HTMLTextAreaElement;
    editor.focus();
    editor.setSelectionRange(2, 2);
    await user.click(screen.getByRole('button', { name: '插入视频时间点' }));

    expect(screen.getByRole('textbox')).toHaveValue('前文[00:00](#t=00:00) 讲解内容');
  });

  it('imports a downloaded timestamp text file and converts it at the cursor', async () => {
    const user = userEvent.setup();
    render(<ControlledEditor initialValue={'课程简介\n'} enableVideoTimestamps />);

    const editor = screen.getByRole('textbox') as HTMLTextAreaElement;
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
    await user.upload(
      screen.getByLabelText('选择时间轴 TXT 文件'),
      new File(['00:01 开宗明义\n07:43 三要素模型\n内容由 AI 生成，仅供参考'], '时间轴.txt', {
        type: 'text/plain',
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue(
        '课程简介\n- [00:01](#t=00:01) 开宗明义\n- [07:43](#t=07:43) 三要素模型\n\n内容由 AI 生成，仅供参考',
      );
    });
  });
});
