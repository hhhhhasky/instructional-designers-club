import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HomePageSnapshot } from "@/db/api";
import {
  HomeSnapshotProvider,
  useHomeSnapshot,
} from "@/hooks/useHomeSnapshot";

const { getHomePageSnapshot } = vi.hoisted(() => ({
  getHomePageSnapshot: vi.fn(),
}));

vi.mock("@/db/api", () => ({
  getCachedHomePageSnapshot: () => null,
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

describe("HomeSnapshotProvider", () => {
  beforeEach(() => {
    getHomePageSnapshot.mockReset();
    getHomePageSnapshot.mockResolvedValue(snapshot);
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
