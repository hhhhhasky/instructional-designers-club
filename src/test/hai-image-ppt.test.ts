import { describe, expect, it } from "vitest";
import {
  normalizePptCourse,
  normalizePptPages,
  normalizePptSettings,
  parsePptMarkdown,
  pptPagePrompt,
  pptPagesToMarkdown,
  extractPptTeachingFlow,
  pptStageInstructions,
} from "../../supabase/functions/_shared/hai_image_ppt";
const course = normalizePptCourse({
  subject: "数学",
  topic: "比较方案",
  teacher: "李老师",
});
function settings() {
  return {
    typography: Object.fromEntries(
      ["cover_title", "title", "body", "caption"].map(
        (k) => [k, { font: "思源黑体", weight: "Regular", size: 36 }],
      ),
    ),
    anchors: {
      title: "左对齐",
      navigation: "左上",
      page_number: "右下",
      margins: "四边留白",
    },
    palette: Object.fromEntries(
      ["primary", "secondary", "accent", "background", "text"].map(
        (k) => [k, { hex: "#b43a32", use: k }],
      ),
    ),
    navigation_label: "比较方案",
  };
}
describe("图片课件逐页与整套设定", () => {
  it("教学流程输入保留活动正文并排除前后章节", () => {
    expect(extractPptTeachingFlow("# 教案\n\n## 一、教学目标\n目标内容\n\n## 七、教学流程\n### 任务一\n学生阅读材料。\n\n## 八、评价\n评价内容")).toBe("### 任务一\n学生阅读材料。");
    expect(() => extractPptTeachingFlow("# 教案\n正文")).toThrow("教学流程章节");
  });
  it("大纲只加载该阶段规则与输出参考", () => {
    const input = "开场\n## 文字大纲阶段\n大纲规则\n### 功能页\n任务页\n## 整套共用设定阶段\n字体配色\n## 逐页执行\n出图\n# 大纲输出\n文档格式\n# 共用设定输出\n字号格式";
    const instructions = pptStageInstructions(input, "outline");
    expect(instructions).toContain("任务页");
    expect(instructions).toContain("文档格式");
    expect(instructions).not.toContain("字体配色");
    expect(instructions).not.toContain("字号格式");
    expect(instructions).not.toContain("出图");
  });
  it("文档仅按分页标题拆分，完整保留自由表达与表格", () => {
    const markdown =
      "# 整套思路\n先观察，再比较。\n\n## 第1页｜封面\n\n## 第2页｜比较\n\n| 条件 | A | B |\n| --- | --- | --- |\n| 预算 | 80 | 100 |\n\n> 排版建议：先呈现材料，后呈现问题。\n\n小明：我的依据是预算。";
    const pages = parsePptMarkdown(markdown);
    expect(pages).toHaveLength(2);
    expect(pages[0].content_markdown).toBe("");
    expect(pages[1].content_markdown).toContain("| 预算 | 80 | 100 |");
    expect(pages[1].content_markdown).toContain("小明：我的依据是预算。");
    expect(pages[1].text).toBe("");
    expect(pages[1].image_description).toBe("");
  });
  it("代码块中的分页示例不会生成额外页面", () => {
    const pages = parsePptMarkdown(
      "## 第 1 页：观察\n\n```md\n## 第2页｜这是示例\n```\n\n## 第3页 | 讨论\n请说明理由。",
    );
    expect(pages.map((p) => p.title)).toEqual(["观察", "讨论"]);
    expect(pages[0].content_markdown).toContain("## 第2页｜这是示例");
    expect(pages[1].id).toBe("P02");
  });
  it("只要求明确页边界，不按旧正文长度截断文档", () => {
    expect(() => parsePptMarkdown("只有整段正文")).toThrow("标明分页");
    const body = "完整材料".repeat(3500);
    const page = parsePptMarkdown(`## 第1页｜完整材料\n\n${body}`)[0];
    expect(normalizePptPages([page])[0].content_markdown).toBe(body);
    expect(pptPagePrompt(page, normalizePptSettings(settings(), course), 0, 1))
      .toContain(body);
  });
  it("历史卡片大纲可转换为连续文档，材料和执行建议不丢失", () => {
    const legacy = normalizePptPages([{
      title: "观察",
      text: "原始材料",
      image_description: "两个方案",
      layout: "并排",
    }]);
    const pages = parsePptMarkdown(pptPagesToMarkdown(legacy));
    expect(pages[0].title).toBe("观察");
    expect(pages[0].content_markdown).toContain("原始材料");
    expect(pages[0].content_markdown).toContain("### 配图建议\n\n两个方案");
    expect(
      pptPagePrompt(pages[0], normalizePptSettings(settings(), course), 0, 1),
    ).toContain("不作为文字印到页面上");
  });
  it("完整保留正文与材料，不沿用旧课件页数档位", () => {
    const pages = normalizePptPages([{
      title: "观察",
      text: "材料一\n比较 A 与 B。",
      layout: "左图右文",
    }]);
    expect(pages).toHaveLength(1);
    expect(pages[0].text).toBe("材料一\n比较 A 与 B。");
    expect(pages[0].id).toBe("P01");
  });
  it("缺少投屏正文时明确拒绝", () =>
    expect(() => normalizePptPages([{ title: "只有标题" }])).toThrow(
      "完整投屏文字",
    ));
  it("统一HEX色号且不允许设置阶段改写课程信息", () => {
    const value = normalizePptSettings({
      ...settings(),
      course: { topic: "擅自改名" },
    }, course);
    expect(value.palette.primary.hex).toBe("#B43A32");
    expect(value.course).toEqual(course);
    expect(value).not.toHaveProperty("art_style");
  });
  it("缺少色号或字号时不伪装为完整共用设定", () => {
    const value = settings();
    value.palette.primary.hex = "红色";
    expect(() => normalizePptSettings(value, course)).toThrow("HEX");
    value.palette.primary.hex = "#B43A32";
    value.typography.body.size = 0;
    expect(() => normalizePptSettings(value, course)).toThrow("文字设定");
  });
  it("每页携带相同的具体设定、真实页码和本页原文", () => {
    const shared = normalizePptSettings(settings(), course);
    const pages = normalizePptPages([{
      title: "观察",
      text: "先观察，不提前公布结论。",
    }, { title: "比较", text: "说明你的依据。" }]);
    const p1 = pptPagePrompt(pages[0], shared, 0, 2);
    const p2 = pptPagePrompt(pages[1], shared, 1, 2);
    expect(p1).toContain(JSON.stringify(shared));
    expect(p2).toContain(JSON.stringify(shared));
    expect(p1).toContain("1 / 2");
    expect(p2).toContain("2 / 2");
    expect(p2).toContain("说明你的依据。");
    expect(p1).not.toContain("同上页");
  });
});
