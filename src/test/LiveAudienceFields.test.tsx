import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LiveAudienceFields from "@/components/live/LiveAudienceFields";

describe("Live audience selector", () => {
  it("combines selected learners and participant tags for a targeted question", () => {
    const onTargetUserIdsChange = vi.fn();
    const onTargetTagsChange = vi.fn();

    render(
      <LiveAudienceFields
        mode="targeted"
        targetUserIds={[]}
        targetTags={["进度较快"]}
        participants={[{
          user_id: "user-1",
          nickname: "张老师",
          joined_at: "2026-08-25T01:00:00Z",
          last_seen_at: "2026-08-25T01:10:00Z",
          tags: ["需要挑战"],
        }]}
        availableTags={["进度较快", "进度较慢"]}
        onlineUserIds={["user-1"]}
        onModeChange={vi.fn()}
        onTargetUserIdsChange={onTargetUserIdsChange}
        onTargetTagsChange={onTargetTagsChange}
      />,
    );

    expect(screen.getByText("定向学员")).toBeInTheDocument();
    expect(screen.getByText("张老师")).toBeInTheDocument();
    expect(screen.getByText("进度较快")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /张老师/ }));
    expect(onTargetUserIdsChange).toHaveBeenCalledWith(["user-1"]);

    fireEvent.click(screen.getByRole("button", { name: "+ 进度较慢" }));
    expect(onTargetTagsChange).toHaveBeenCalledWith(["进度较快", "进度较慢"]);
  });
});
