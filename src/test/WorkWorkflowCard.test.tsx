import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkWorkflowCard from "@/components/hai/WorkWorkflowCard";
import type { HaiWorkRun } from "@/db/hai-api";
const act = vi.hoisted(() => vi.fn());
vi.mock("@/db/hai-api", () => ({ actOnHaiWorkflow: act }));
vi.mock("@/components/common/MarkdownRenderer", () => ({ default: ({ content }: {content:string}) => <div>{content}</div> }));
const run = {id:"run",status:"waiting_confirmation",workflow_state:{version:1,revision:2,stage:"mode",options:[{id:"a",title:"比较探究",reason:"比较知识差异",approach:"独立说明"},{id:"b",title:"问题解决",reason:"迁移",approach:"解决问题"}]}} as HaiWorkRun;
beforeEach(()=>{act.mockReset();act.mockResolvedValue({status:"queued"});});
describe("workflow card",()=>{
  const focus = { ...run, workflow_state: { ...run.workflow_state!, version: 2, stage: "focus" as const } };
  it("requires a teaching focus before asking for matching modes", async () => {
    render(<WorkWorkflowCard run={focus} tool="subject-lesson-design" onChanged={async () => {}} />);
    const progress = screen.getByRole("list", { name: "公开课设计四阶段" });
    expect(within(progress).getAllByRole("listitem").map(item => item.querySelector("p")?.textContent)).toEqual(["输入需求", "确定教什么", "确定怎么教", "生成教案"]);
    expect(within(progress).getAllByRole("listitem")[1]).toHaveAttribute("aria-current", "step");
    const confirm = screen.getByRole("button", { name: "按这个重点推荐教学模式" });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getAllByRole("radio")[1]);
    fireEvent.click(confirm);
    await waitFor(() => expect(act).toHaveBeenCalledWith("run", 2, "confirm", "b", ""));
  });
  it("revises the focus without confirming it and respects read-only tasks", async () => {
    const { rerender } = render(<WorkWorkflowCard run={focus} tool="subject-lesson-design" onChanged={async () => {}} />);
    fireEvent.click(screen.getAllByRole("radio")[0]);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "重点放在解释理由" } });
    expect(screen.getByRole("button", { name: "按这个重点推荐教学模式" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "修改这一步" }));
    await waitFor(() => expect(act).toHaveBeenCalledWith("run", 2, "revise", "a", "重点放在解释理由"));
    rerender(<WorkWorkflowCard run={focus} tool="subject-lesson-design" disabled onChanged={async () => {}} />);
    expect(screen.getAllByRole("radio")[0]).toBeDisabled();
    expect(screen.getByRole("button", { name: "停止本轮" })).toBeDisabled();
  });
  it("keeps the confirmed focus visible and lets a new workflow return to it", async () => {
    const mode = { ...run, workflow_state: { ...run.workflow_state!, version: 2, selected_focus: { id: "focus-1", title: "从记住结论到说明理由", reason: "回应教材中的推理要求", approach: "能独立解释判断依据" } } };
    render(<WorkWorkflowCard run={mode} tool="subject-lesson-design" onChanged={async () => {}} />);
    expect(screen.getByText("从记住结论到说明理由")).toBeVisible();
    expect(screen.getByText("能独立解释判断依据")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "返回确定教什么" }));
    await waitFor(() => expect(act).toHaveBeenCalledWith("run", 2, "back", "", ""));
  });
  it("does not mark an unconfirmed focus complete in legacy runs or offer unsupported back navigation", () => {
    render(<WorkWorkflowCard run={run} tool="subject-lesson-design" onChanged={async () => {}} />);
    const progress = screen.getByRole("list", { name: "公开课设计四阶段" });
    const focusStep = within(progress).getAllByRole("listitem")[1];
    expect(within(focusStep).queryByText("已完成")).not.toBeInTheDocument();
    expect(within(focusStep).getByText("本任务未单独确认")).toBeVisible();
    expect(screen.queryByRole("button", { name: "返回确定教什么" })).not.toBeInTheDocument();
  });
  it("clears obsolete choices and feedback when a revised set of candidates arrives", () => {
    const { rerender } = render(<WorkWorkflowCard run={focus} tool="subject-lesson-design" onChanged={async () => {}} />);
    fireEvent.click(screen.getAllByRole("radio")[0]);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "更换重点" } });
    rerender(<WorkWorkflowCard run={{ ...focus, workflow_state: { ...focus.workflow_state, revision: 3 } }} tool="subject-lesson-design" onChanged={async () => {}} />);
    expect(screen.getAllByRole("radio")[0]).not.toBeChecked();
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByRole("button", { name: "按这个重点推荐教学模式" })).toBeDisabled();
  });
  it("requires a selection then submits the exact revision once",async()=>{
    const changed=vi.fn().mockResolvedValue(undefined);
    render(<WorkWorkflowCard run={run} tool="subject-lesson-design" onChanged={changed}/>);
    const button=screen.getByRole("button",{name:"按这个模式生成教案"});
    expect(button).toBeDisabled();fireEvent.click(screen.getAllByRole("radio")[0]);fireEvent.click(button);
    await waitFor(()=>expect(act).toHaveBeenCalledWith("run",2,"confirm","a",""));
    expect(changed).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("确认课堂流程")).not.toBeInTheDocument();
  });
  it("editing waits for a revised proposal instead of silently confirming old content",async()=>{
    render(<WorkWorkflowCard run={run} tool="subject-lesson-design" onChanged={async()=>{}}/>);
    fireEvent.click(screen.getAllByRole("radio")[0]);fireEvent.change(screen.getByRole("textbox"),{target:{value:"改为独立练习"}});
    expect(screen.getByRole("button",{name:"按这个模式生成教案"})).toBeDisabled();
    fireEvent.click(screen.getByRole("button",{name:"修改这一步"}));
    await waitFor(()=>expect(act).toHaveBeenCalledWith("run",2,"revise","a","改为独立练习"));
  });
  it("restores the unit plan after reopening and confirms without regenerating it",async()=>{
    const plan={...run,workflow_state:{...run.workflow_state!,stage:"plan" as const,markdown:"已确认方向下的完整整体设计"}};
    render(<WorkWorkflowCard run={plan} tool="unit-learning-design" onChanged={async()=>{}}/>);
    expect(screen.getByText("已确认方向下的完整整体设计")).toBeVisible();
    const progress = screen.getByRole("list", { name: "大单元教学四步流程" });
    expect(within(progress).getAllByRole("listitem")[2]).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "重新选择模式" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button",{name:"确认整体设计，生成全部课时教案"}));
    await waitFor(()=>expect(act).toHaveBeenCalledWith("run",2,"confirm","",""));
  });
});
