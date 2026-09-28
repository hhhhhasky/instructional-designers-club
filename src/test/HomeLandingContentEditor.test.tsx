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

  it('serves the existing founder portrait from the project asset', () => {
    expect(normalizeFounderAvatarUrl('https://miaoda-conversation-file.cdn.bcebos.com/user-75tmduypbkzk/app-7iwdhpt0pypt/20260512/ChatGPT Image 2026年4月22日 12_26_23.png')).toBe(FOUNDER_PORTRAIT_URL);
    expect(normalizeFounderAvatarUrl('/images/my-new-portrait.jpg')).toBe('/images/my-new-portrait.jpg');
  });
});
