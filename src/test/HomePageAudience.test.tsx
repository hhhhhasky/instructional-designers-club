import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/pages/HomePage";

const { authState, homeContent } = vi.hoisted(() => ({
  authState: {
    user: { id: "member-1" } as { id: string } | null,
    accessLevel: "pro",
    loading: false,
  },
  homeContent: {
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
vi.mock("@/hooks/useHomeContent", () => ({ useHomeContent: () => homeContent }));
vi.mock("@/hooks/useHomeSnapshot", () => ({
  HomeSnapshotProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/layout/Header", () => ({ default: () => <div data-testid="header" /> }));
vi.mock("@/components/common/PageNavigation", () => ({ default: () => <div data-testid="page-navigation" /> }));
vi.mock("@/components/home/MemberHomeHero", () => ({ default: () => <div data-testid="member-home" /> }));
vi.mock("@/components/home/NotificationCard", () => ({ default: () => <div data-testid="member-notifications" /> }));
vi.mock("@/components/home/AnnouncementFeed", () => ({ default: () => <div data-testid="announcement-feed" /> }));
vi.mock("@/components/pricing/PricingSection", () => ({ default: () => <div data-testid="pricing-note" /> }));
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
  });

  it("shows the teaching desk and hides acquisition content for a member", () => {
    renderHome();

    expect(screen.getByTestId("member-home")).toBeInTheDocument();
    expect(screen.queryByTestId("pricing-note")).not.toBeInTheDocument();
    expect(screen.queryByText("访客主标题")).not.toBeInTheDocument();
  });

  it("keeps the lightweight membership note at the end of the guest home", () => {
    authState.user = null;
    renderHome();

    expect(screen.queryByTestId("member-home")).not.toBeInTheDocument();
    expect(screen.getByText("访客主标题")).toBeInTheDocument();
    expect(screen.getByTestId("pricing-note")).toBeInTheDocument();
  });
});
