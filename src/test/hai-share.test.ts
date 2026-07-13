import { describe, expect, it } from "vitest";
import { markdownToShareText } from "@/lib/hai-share";

describe("markdownToShareText", () => {
  it("keeps readable structure while removing markdown decoration", () => {
    expect(markdownToShareText("## 判断\n\n- **先看目标**\n- [再看活动](https://example.com)"))
      .toBe("判断\n• 先看目标\n• 再看活动");
  });
});
