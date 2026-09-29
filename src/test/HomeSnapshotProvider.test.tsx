import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HomePageSnapshot } from "@/db/api";
import {
  HomeSnapshotProvider,
  useHomeSnapshot,
} from "@/hooks/useHomeSnapshot";
import { useHomeContent } from "@/hooks/useHomeContent";

const { getCachedHomePageSnapshot, getHomePageSnapshot } = vi.hoisted(() => ({
  getCachedHomePageSnapshot: vi.fn(),
  getHomePageSnapshot: vi.fn(),
}));

vi.mock("@/db/api", () => ({
  getCachedHomePageSnapshot,
  getHomePageSnapshot,
}));

const snapshot = {
  site_content: null,
  member_profiles: [],
  testimonials: [],
  faqs: [],
  announcements: [],
  latest_courses: [],
  activities: [],
  home_courses: { free: [], plus: [], pro: [] },
  stats_counts: { camps: 0, courses: 0, totalMinutes: 0, members: 0 },
  generated_at: "2026-07-24T00:00:00.000Z",
  source_updated_at: null,
  source: "rpc",
} satisfies HomePageSnapshot;

function SnapshotProbe({ label }: { label: string }) {
  const { snapshot: value, loading } = useHomeSnapshot();
  return <span>{label}:{loading ? "loading" : value?.source}</span>;
}

function CopyProbe() {
  const { loaded, landing } = useHomeContent();
  return <span>{loaded ? landing.home_hero.title_line1 : "首页文案加载中"}</span>;
}

describe("HomeSnapshotProvider", () => {
  beforeEach(() => {
    getCachedHomePageSnapshot.mockReset().mockReturnValue(null);
    getHomePageSnapshot.mockReset();
    getHomePageSnapshot.mockResolvedValue(snapshot);
  });

  it("waits for fresh copy instead of displaying an older cached headline", async () => {
    const oldSnapshot: HomePageSnapshot = {
      ...snapshot,
      site_content: { home_hero: { section_key: "home_hero", section_label: "首屏与按钮", data: { title_line1: "旧标题" }, updated_at: "2026-09-28T00:00:00.000Z" } },
    };
    const newSnapshot: HomePageSnapshot = {
      ...snapshot,
      site_content: { home_hero: { section_key: "home_hero", section_label: "首屏与按钮", data: { title_line1: "新标题" }, updated_at: "2026-09-29T00:00:00.000Z" } },
    };
    let resolveFresh!: (value: HomePageSnapshot) => void;
    getCachedHomePageSnapshot.mockReturnValue(oldSnapshot);
    getHomePageSnapshot.mockReturnValue(new Promise<HomePageSnapshot>((resolve) => { resolveFresh = resolve; }));

    render(<HomeSnapshotProvider><CopyProbe /></HomeSnapshotProvider>);
    expect(screen.getByText("首页文案加载中")).toBeInTheDocument();
    expect(screen.queryByText("旧标题")).not.toBeInTheDocument();

    await act(async () => { resolveFresh(newSnapshot); });
    expect(screen.getByText("新标题")).toBeInTheDocument();
  });

  it("shares one request and one state across all homepage consumers", async () => {
    render(
      <HomeSnapshotProvider>
        <SnapshotProbe label="content" />
        <SnapshotProbe label="feed" />
      </HomeSnapshotProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("content:rpc")).toBeInTheDocument();
      expect(screen.getByText("feed:rpc")).toBeInTheDocument();
    });
    expect(getHomePageSnapshot).toHaveBeenCalledTimes(1);
  });
});
