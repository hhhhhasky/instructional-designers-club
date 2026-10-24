import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HaiImagePromptManagement from "@/components/admin/HaiImagePromptManagement";
import { HaiConfigPage, HaiConfigWorkspace } from "@/components/admin/hai/HaiConfigWorkspace";
const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  rows: [] as Array<Record<string, unknown>>,
  error: null as null | { message: string },
}));
vi.mock("@/db/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({ like: async () => ({ data: mocks.rows, error: mocks.error }) }),
      upsert: (payload: Record<string, unknown>) => {
        mocks.upsert(payload);
        return {
          select: () => ({
            single: async () => ({
              data: { ...payload, updated_at: "2026-10-24T01:00:00Z" },
              error: mocks.error,
            }),
          }),
        };
      },
    }),
  },
}));
beforeEach(() => {
  mocks.rows = [];
  mocks.error = null;
  mocks.upsert.mockClear();
});
describe("image prompt configuration editor", () => {
  it("loads default text and saves real configuration with required placeholders intact", async () => {
    render(<HaiImagePromptManagement />);
    const editor = await screen.findByRole("textbox", { name: "提示词正文" });
    fireEvent.change(editor, {
      target: { value: `${(editor as HTMLTextAreaElement).value}\n本次只用蓝绿配色。` },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存提示词" }));
    await screen.findByText(/已保存“生图总模板”/);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "image_prompt.compose",
        category: "image_prompts",
        enabled: true,
        value: expect.stringContaining("本次只用蓝绿配色。"),
      }),
    );
  });
  it("blocks a template missing user input and retains edits when switching prompts", async () => {
    render(<HaiImagePromptManagement />);
    const editor = await screen.findByRole("textbox", { name: "提示词正文" });
    fireEvent.change(editor, { target: { value: "缺少变量的内容" } });
    expect(screen.getByRole("alert")).toHaveTextContent("请保留必需变量");
    expect(screen.getByRole("button", { name: "保存提示词" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /参考图修改规则/ }));
    fireEvent.click(screen.getByRole("button", { name: /生图总模板/ }));
    expect(screen.getByRole("textbox", { name: "提示词正文" })).toHaveValue("缺少变量的内容");
    fireEvent.click(screen.getByRole("button", { name: "恢复默认" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("keeps the workspace mounted when switching configuration categories", async () => {
    render(
      <HaiConfigWorkspace>
        <HaiConfigPage section="images" title="生图" description="">
          <HaiImagePromptManagement />
        </HaiConfigPage>
        <HaiConfigPage section="work" title="工具" description="">
          <p>工具内容</p>
        </HaiConfigPage>
      </HaiConfigWorkspace>,
    );
    expect(screen.queryByRole("textbox", { name: "提示词正文" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /生图提示词/ }));
    const editor = await screen.findByRole("textbox", { name: "提示词正文" });
    fireEvent.change(editor, { target: { value: "草稿内容" } });
    fireEvent.click(screen.getByRole("button", { name: /Work 工具/ }));
    fireEvent.click(screen.getByRole("button", { name: /生图提示词/ }));
    expect(screen.getByRole("textbox", { name: "提示词正文" })).toHaveValue("草稿内容");
  });
  it("does not allow overwriting settings after a failed read", async () => {
    mocks.error = { message: "读取失败" };
    render(<HaiImagePromptManagement />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("加载失败"));
    expect(screen.queryByRole("button", { name: "保存提示词" })).not.toBeInTheDocument();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
