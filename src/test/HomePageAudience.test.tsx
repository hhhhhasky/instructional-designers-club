import { render, screen } from "@testing-library/react";
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
    homeCourses: { free: [], plus: [], pro: [] },
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
vi.mock("@/components/common/PageNavigation", () => ({ default: () => <div data-testid="page-navigation" /> }));
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
    const ids = ['real-situations', 'why-stuck', 'teaching-method', 'about-han', 'learning-outcomes', 'course-products', 'how-to-learn'];
    const actualOrder = Array.from(container.querySelectorAll('main [id]')).map((element) => element.id).filter((id) => ids.includes(id));
    expect(actualOrder).toEqual(ids);
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
