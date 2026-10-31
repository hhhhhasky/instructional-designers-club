import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CoursePurchaseButton from '@/components/course/CoursePurchaseButton';

describe('课程购买方式', () => {
  it.each([
    ['daofa-textbook', '/images/course-purchase/daofa-wechat.png', 'https://xhslink.com/m/277IB24mn8I'],
    ['teacher-ai', '/images/course-purchase/general-wechat.png', 'https://xhslink.com/m/4neOp7EhPHm'],
    ['teaching-general-v1', '/images/course-purchase/general-wechat.png', 'https://xhslink.com/m/5JAHDTqPSdk'],
  ] as const)('为 %s 显示对应渠道', async (code, wechat, xhs) => {
    render(<CoursePurchaseButton productCode={code} />);
    fireEvent.click(screen.getByRole('button', { name: /购买/ }));
    expect(screen.getByRole('link', { name: /小红书支付/ })).toHaveAttribute('href', xhs);
    fireEvent.click(screen.getByRole('button', { name: '微信支付' }));
    expect(screen.getByRole('img', { name: /微信小店购买二维码/ })).toHaveAttribute('src', wechat);
  });
});
