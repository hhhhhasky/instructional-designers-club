import { describe, expect, it } from "vitest";
import { HAI_SHARE_CTA, HAI_SHARE_QR_URL, markdownToShareText } from "@/lib/hai-share";

describe("markdownToShareText", () => {
  it("keeps readable structure while removing markdown decoration", () => {
    expect(markdownToShareText("## 判断\n\n- **先看目标**\n- [再看活动](https://example.com)"))
      .toBe("判断\n• 先看目标\n• 再看活动");
  });

  it("keeps the registration CTA and QR asset in the share template", () => {
    expect(HAI_SHARE_QR_URL).toBe("/images/hai/hai-register-qr.png");
    expect(HAI_SHARE_CTA).toMatchObject({
      headline: "注册 HAI，免费送",
      benefit: "10 万 Token",
      promise: "解答你的备课难题",
    });
  });
});
