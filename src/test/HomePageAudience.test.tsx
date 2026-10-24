import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/pages/HomePage";
import { HOME_LANDING_DEFAULTS } from "@/lib/home-landing-content";

const { authState, homeContent } = vi.hoisted(() => ({
  authState: {
    user: { id: "member-1" } as { id: string } | null,
    accessLevel: "pro",
    loading: false,
  },
  homeContent: {
    loaded: true,
    statsCounts: { members: 0, camps: 0, courses: 0, totalMinutes: 0 },
    homeCourses: { free: [
      { id: '4c36aaa4-2e66-4a18-8f0b-d1d9c6cae516', title: '教学设计和备课有什么区别？', membership_type: 'free', description: '教学设计体验课', duration: 90 },
      { id: 'e342b2c8-6734-49f1-a16c-891b7cbf9c6f', title: '给老师第一节教学通识课', membership_type: 'free', description: '教学通识体验课', duration: 55 },
    ], plus: [], pro: [] },
    loadingHomeCourses: false,
    hero: { title_line1: "访客主标题", title_line2: "教研副标题", subtitle: "访客说明" },
    intro: {
      section_title: "俱乐部介绍",
      section_subtitle: "",
      welcome_title: "欢迎",
      welcome_paragraphs: [],
      product_intro_heading: "课程",
      plus_text: "Plus",
      pro_text: "Pro",
    },
    values: { values_title: "价值观", values_subtitle: "", items: [] },
    founder: {
      section_title: "创始人",
      avatar_url: "",
      avatar_alt: "",
      name: "哈老师",
      tags: [],
      motto: "",
      info_items: [],
      stats: [],
    },
    stats: { section_title: "数据", section_subtitle: "", start_date: "2026-01-01", footnote: "" },
    membersMeta: { section_title: "会员", subtitle: "", footnote: "" },
    members: [],
    testimonialsMeta: { section_title: "评价", autoplay_ms: 10_000, footnote: "" },
    testimonials: [],
    faqTitle: "常见问题",
    faqs: [],
  },
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("@/hooks/useHomeContent", () => ({ useHomeContent: () => ({ ...homeContent, landing: HOME_LANDING_DEFAULTS }) }));
vi.mock("@/hooks/useHomeSnapshot", () => ({
  HomeSnapshotProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/layout/Header", () => ({ default: () => <div data-testid="header" /> }));
vi.mock("@/components/common/PageNavigation", () => ({ default: ({ items }: { items: { id: string; label: string }[] }) => <nav data-testid="page-navigation">{items.map((item) => <a key={item.id} href={`#${item.id}`}>{item.label}</a>)}</nav> }));
vi.mock("@/components/home/MemberHomeHero", () => ({ default: () => <div data-testid="member-home" /> }));
vi.mock("@/components/home/NotificationCard", () => ({ default: () => <div data-testid="member-notifications" /> }));
vi.mock("@/components/home/AnnouncementFeed", () => ({ default: () => <div data-testid="announcement-feed" /> }));
vi.mock("@/components/pricing/CoursePurchaseSection", () => ({ default: () => <div id="course-products" data-testid="course-purchases" /> }));
vi.mock("@/components/testimonials/TestimonialCarousel", () => ({ TestimonialCarousel: () => <div /> }));
vi.mock("@/components/ui/CountUp", () => ({ default: ({ end }: { end: number }) => <span>{end}</span> }));
vi.mock("@/components/common/Footer", () => ({ default: () => <div data-testid="footer" /> }));
vi.mock("@/components/common/UpgradePopup", () => ({ default: () => null }));
vi.mock("@/components/common/PageMeta", () => ({ default: () => null }));

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

describe("home page audience split", () => {
  afterEach(() => {
    authState.user = { id: "member-1" };
    homeContent.loaded = true;
  });

  it("gives returning learners the same problem-first story and a learning shortcut", () => {
    renderHome();

    expect(screen.getByRole('heading', { level: 1, name: /教案写得很完整/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /直接回到我的学习/ })).toHaveAttribute('href', '/learning');
    expect(screen.getByTestId("member-home")).toBeInTheDocument();
    expect(screen.getByTestId("course-purchases")).toBeInTheDocument();
    expect(screen.queryByText('会员课程体系')).not.toBeInTheDocument();
  });

  it("takes guests from teaching situations to the method before course choices", () => {
    authState.user = null;
    const { container } = renderHome();

    expect(screen.queryByTestId("member-home")).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /教案写得很完整/ })).toBeInTheDocument();
    expect(screen.getByTestId("course-purchases")).toBeInTheDocument();
    const ids = ['free-courses', 'real-situations', 'why-stuck', 'teaching-method', 'about-han', 'learning-outcomes', 'course-products', 'how-to-learn'];
    const actualOrder = Array.from(container.querySelectorAll('main [id]')).map((element) => element.id).filter((id) => ids.includes(id));
    expect(actualOrder).toEqual(ids);
  });

  it.each([null, { id: 'member-1' }])('shows both free lessons before teaching situations for user %j', (user) => {
    authState.user = user;
    const { container } = renderHome();
    const section = screen.getByRole('region', { name: HOME_LANDING_DEFAULTS.home_extra.free_title });
    const links = within(section).getAllByRole('link', { name: /开始体验/ });

    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/courses/4c36aaa4-2e66-4a18-8f0b-d1d9c6cae516');
    expect(links[1]).toHaveAttribute('href', '/courses/e342b2c8-6734-49f1-a16c-891b7cbf9c6f');
    expect(within(section).getByText('教学设计和备课有什么区别？')).toBeInTheDocument();
    expect(within(section).getByText('给老师第一节教学通识课')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '免费体验课程' })).toHaveLength(1);
    expect(screen.queryByTestId('page-navigation')).not.toBeInTheDocument();
    expect(Array.from(container.querySelectorAll('main > section')).slice(0, 3).map((element) => element.id))
      .toEqual(['teaching-problems', 'free-courses', 'real-situations']);
  });

  it('shows the updated biography and accounts without the previous identity badges', () => {
    renderHome();
    const about = screen.getByRole('region', { name: '哈老师是谁？' });
    expect(within(about).getByText('教师培训师、课程产品研发者、AI教育应用研发者')).toBeInTheDocument();
    for (const paragraph of HOME_LANDING_DEFAULTS.home_founder.biography) {
      expect(within(about).getByText(paragraph)).toBeInTheDocument();
    }
    expect(within(about).getByText('哈老师聊教学设计')).toBeInTheDocument();
    expect(within(about).getByText('哈士奇聊教学设计')).toBeInTheDocument();
    expect(within(about).queryByText('开发小白')).not.toBeInTheDocument();
  });

  it("shows a text-free placeholder until homepage copy is ready", () => {
    homeContent.loaded = false;
    const view = renderHome();

    expect(screen.getByRole('main', { name: '首页内容加载中' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('heading', { level: 1, name: /教案写得很完整/ })).not.toBeInTheDocument();

    homeContent.loaded = true;
    view.rerender(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: /教案写得很完整/ })).toBeInTheDocument();
  });
});
