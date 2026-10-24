import { describe, expect, it } from "vitest";
import { haiTaskTitle } from "@/lib/hai-task-title";

describe("历史任务课题名", () => {
  it.each(["公开课设计", "教案诊断", "教案优化", "环节优化", "研发教学方案", "大单元教学", "图片生成", "图片课件"])("移除 %s 前缀", (type) => {
    expect(haiTaskTitle(`${type}｜课题名`)).toBe("课题名");
  });
  it("保留课题中的分隔符和用户自定名称", () => {
    expect(haiTaskTitle("公开课设计｜水循环｜第一课时")).toBe("水循环｜第一课时");
    expect(haiTaskTitle("认识自己｜第二稿")).toBe("认识自己｜第二稿");
    expect(haiTaskTitle("公开课设计的几个问题")).toBe("公开课设计的几个问题");
  });
});
