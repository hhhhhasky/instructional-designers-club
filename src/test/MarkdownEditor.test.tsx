import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MarkdownEditor from '@/components/admin/MarkdownEditor';
import { uploadCourseImage } from '@/db/course-media';

vi.mock('@/db/course-media', () => ({
  uploadCourseImage: vi.fn(),
}));

function ControlledEditor({ initialValue = '' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return <MarkdownEditor value={value} onChange={setValue} />;
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
});
