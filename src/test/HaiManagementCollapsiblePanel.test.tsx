import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CollapsiblePanel } from "@/components/admin/HaiManagementSection";

describe("HAI configuration collapsible panels", () => {
  it("keeps panel content collapsed until the administrator expands it", () => {
    render(
      <CollapsiblePanel
        title="知识库"
        description="管理共享知识条目"
        icon={<span aria-hidden="true">K</span>}
        summary="12 条"
      >
        <p>知识库编辑内容</p>
      </CollapsiblePanel>,
    );

    const trigger = screen.getByRole("button", { name: /知识库/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("知识库编辑内容")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("知识库编辑内容")).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByText("知识库编辑内容")).not.toBeInTheDocument();
  });
});
