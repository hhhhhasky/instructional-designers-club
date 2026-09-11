import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import V2SubjectExampleExplorer from "@/components/course/V2SubjectExampleExplorer";
import type { V2Resource } from "@/db/v2-api";

const resource: V2Resource = {
  id: "resource-1", lesson_id: "lesson-5", resource_type_id: null, usage_type_id: null,
  title: "案例选择器", description: null, storage_provider: null, storage_key: null,
  external_url: null, file_name: null, mime_type: null, file_size: null,
  is_downloadable: false, sort_order: 0, is_active: true,
  metadata: {
    component: "subject_example_explorer",
    subjects: [
      { id: "math", label: "数学", structure: "类型二", example: "全等三角形", route: "数学路径", focus: "数学聚焦", direction: "数学方向", contribution: "数学贡献", pitfall: "只背口诀" },
      { id: "chinese", label: "语文", structure: "类型四", example: "思辨与创造", route: "语文路径", focus: "语文聚焦", direction: "语文方向", contribution: "语文贡献", pitfall: "只搜体裁" },
    ],
  },
};

describe("V2SubjectExampleExplorer", () => {
  it("switches the visible case without rendering the cases as one long sequence", () => {
    render(<V2SubjectExampleExplorer resource={resource} />);

    expect(screen.getByText("全等三角形")).toBeInTheDocument();
    expect(screen.queryByText("思辨与创造")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /语文/ }));

    expect(screen.getByText("思辨与创造")).toBeInTheDocument();
    expect(screen.queryByText("全等三角形")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /语文/ })).toHaveAttribute("aria-selected", "true");
  });
});
