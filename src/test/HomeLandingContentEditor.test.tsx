import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeLandingEditor } from '@/components/admin/content/editors/HomeLandingEditors';
import { HOME_LANDING_DEFAULTS, mergeHomeLandingContent } from '@/lib/home-landing-content';
import { FOUNDER_PORTRAIT_URL, normalizeFounderAvatarUrl } from '@/lib/founder-avatar';

const api = vi.hoisted(() => ({
  getAdminSiteContent: vi.fn(),
  adminUpsertSiteContent: vi.fn(),
}));

vi.mock('@/db/admin-api', () => api);

describe('homepage copy editing', () => {
  beforeEach(() => {
    api.getAdminSiteContent.mockReset().mockResolvedValue(null);
    api.adminUpsertSiteContent.mockReset().mockResolvedValue(undefined);
  });

  it('shows default copy as editable fields and saves the changed section to site_content', async () => {
    render(<HomeLandingEditor sectionKey="home_hero" />);
    const title = await screen.findByDisplayValue(HOME_LANDING_DEFAULTS.home_hero.title_line1);
    fireEvent.change(title, { target: { value: '我的新首页标题' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(api.adminUpsertSiteContent).toHaveBeenCalledWith(
      'home_hero', '首屏与按钮', expect.objectContaining({ title_line1: '我的新首页标题' }),
    ));
  });

  it('uses saved fields while keeping defaults for fields the admin has not edited', () => {
    const content = mergeHomeLandingContent({ home_hero: { data: { title_line1: '数据库里的标题' } } });
    expect(content.home_hero.title_line1).toBe('数据库里的标题');
    expect(content.home_hero.title_line2).toBe(HOME_LANDING_DEFAULTS.home_hero.title_line2);
    expect(content.home_courses.items.map((item) => item.code)).toEqual([
      'teaching-general-v1', 'teacher-ai', 'daofa-textbook',
    ]);
  });

  it('refreshes known old wording without overwriting custom purchase instructions', () => {
    const content = mergeHomeLandingContent({
      home_courses: { data: { footnote: '下单在小红书完成；本站课程权限由运营按现有流程核对并开通。' } },
      home_learning: { data: { items: [{ title: '等待短信', detail: '按短信要求添加企业微信。' }] } },
    });
    expect(content.home_courses.footnote).toBe('在小红书下单后，请按短信说明联系哈老师，为你的官网账号开通课程。');
    expect(content.home_learning.items).toEqual([{ title: '等待短信', detail: '按短信要求添加企业微信。' }]);
  });

  it('serves the existing founder portrait from the project asset', () => {
    expect(normalizeFounderAvatarUrl('https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/app-7iwdhpt0pypt/20260512/ChatGPT Image 2026年4月22日 12_26_23.png')).toBe(FOUNDER_PORTRAIT_URL);
    expect(normalizeFounderAvatarUrl('/images/my-new-portrait.jpg')).toBe('/images/my-new-portrait.jpg');
  });

  it('uses the new biography even when saved homepage content only has the old introduction fields', () => {
    const content = mergeHomeLandingContent({ home_founder: { data: { description: '旧简介', closing: '旧结语' } } });
    expect(content.home_founder.biography).toEqual(HOME_LANDING_DEFAULTS.home_founder.biography);
    expect(content.home_founder.roles).toBe('教师培训师、课程产品研发者、AI教育应用研发者');
    const edited = mergeHomeLandingContent({ home_founder: { data: { biography: ['后台修改后的简介'] } } });
    expect(edited.home_founder.biography).toEqual(['后台修改后的简介']);
  });

  it('lets the owner edit and save the new biography and platform names', async () => {
    render(<HomeLandingEditor sectionKey="home_founder" />);
    const biography = await screen.findByDisplayValue(HOME_LANDING_DEFAULTS.home_founder.biography[0]);
    fireEvent.change(biography, { target: { value: '更新后的个人经历' } });
    expect(screen.getByDisplayValue('哈士奇聊教学设计')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(api.adminUpsertSiteContent).toHaveBeenCalledWith(
      'home_founder', '哈老师是谁', expect.objectContaining({ biography: ['更新后的个人经历', HOME_LANDING_DEFAULTS.home_founder.biography[1]] }),
    ));
  });
});
