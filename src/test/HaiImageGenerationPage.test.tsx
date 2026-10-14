import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HaiImageGenerationPage from "@/pages/HaiImageGenerationPage";

const mocks = vi.hoisted(() => ({ user:{id:"user"},getRuns:vi.fn(),refresh:vi.fn(),generate:vi.fn(),download:vi.fn(),acknowledge:vi.fn(),fail:vi.fn() }));
vi.mock("@/db/supabase",()=>({supabase:{}}));
vi.mock("@/contexts/AuthContext",()=>({useAuth:()=>({user:mocks.user,loading:false})}));
vi.mock("@/components/common/PageMeta",()=>({default:()=>null}));
vi.mock("@/components/hai/HaiWorkShell",()=>({default:({children}:any)=><div>{children}</div>}));
vi.mock("@/pages/HaiWorkPage",()=>({WorkSidebar:()=>null}));
vi.mock("@/db/hai-api",()=>({ getHaiAccessStatus:async()=>({access:{allowed:true},usage:{quota_mode:"points",current_points:100,can_consume:true}}),getHaiWorkTools:async()=>[] }));
vi.mock("@/db/hai-image-generation",async(original)=>({...await original<object>(),getHaiImageGenerationTasks:async()=>[],getHaiImageGenerationRuns:mocks.getRuns,refreshHaiImage:mocks.refresh,generateHaiImage:mocks.generate,downloadHaiImage:mocks.download,acknowledgeHaiImage:mocks.acknowledge,failHaiImage:mocks.fail}));
const base={id:"run",task_id:"task",status:"running",prompt:"水循环",image_size:"16:9",art_style:"卡通",image_type:"课件 PPT",reference_images:[],image_url:null,r2_key:null};
let run:typeof base & {delivery_deadline_at:string};
const ready=()=>({...run,image_url:"protected-image",r2_key:"key"});
function mount(){return render(<MemoryRouter initialEntries={["/image/task"]}><Routes><Route path="/image/:taskId" element={<HaiImageGenerationPage/>}/></Routes></MemoryRouter>);}
async function tick(ms=0){await act(async()=>{await vi.advanceTimersByTimeAsync(ms);});}
beforeEach(()=>{
  vi.useFakeTimers();vi.clearAllMocks();
  run={...base,delivery_deadline_at:new Date(Date.now()+150_000).toISOString()};
  mocks.getRuns.mockResolvedValue([run]);mocks.refresh.mockResolvedValue({run});
  mocks.download.mockResolvedValue(new Blob(["image"],{type:"image/png"}));
  mocks.acknowledge.mockResolvedValue({run:{...ready(),status:"completed"}});mocks.fail.mockResolvedValue({run:{...run,status:"failed"}});
  URL.createObjectURL=vi.fn(()=>"blob:preview");URL.revokeObjectURL=vi.fn();
});
afterEach(()=>{cleanup();vi.useRealTimers();});
describe("bounded image delivery",()=>{
  it("starts the 150 second deadline at submit even before the server returns a run", async () => {
    mocks.getRuns.mockResolvedValue([]); mocks.generate.mockImplementation(() => new Promise(() => {}));
    mount(); await tick();
    fireEvent.change(screen.getByRole("textbox", { name: "图片提示词" }), { target: { value: "认识水循环" } });
    const started = Date.now(); fireEvent.click(screen.getByRole("button", { name: /生成图片/ })); await tick();
    expect(mocks.generate.mock.calls[0][0].deadlineAt).toBe(started + 150_000);
    await tick(150_000);
    expect(screen.getByText("本次生成失败，本轮未扣积分，请再次尝试。")).toBeInTheDocument();
    expect(screen.queryByText("正在提交图片任务…")).not.toBeInTheDocument();
    expect(mocks.acknowledge).not.toHaveBeenCalled();
  });
  it("does not let a previous timed-out submission overwrite a new attempt", async () => {
    mocks.getRuns.mockResolvedValue([]);
    let oldResolve!:(value:any)=>void;
    mocks.generate.mockImplementationOnce(() => new Promise(resolve => { oldResolve = resolve; })).mockImplementationOnce(() => new Promise(() => {}));
    mount(); await tick();
    const input = screen.getByRole("textbox", { name: "图片提示词" });
    fireEvent.change(input, { target: { value: "第一轮" } }); fireEvent.click(screen.getByRole("button", { name: /生成图片/ })); await tick(); await tick(150_000);
    fireEvent.change(input, { target: { value: "第二轮" } }); fireEvent.click(screen.getByRole("button", { name: /生成图片/ })); await tick();
    await act(async () => { oldResolve({ task:{ id:"task" }, run:ready() }); }); await tick();
    expect(screen.getByText("第二轮")).toBeInTheDocument();
    expect(screen.getByText("正在提交图片任务…")).toBeInTheDocument();
    expect(mocks.acknowledge).not.toHaveBeenCalled();
  });
  it("charges only after image load, not after R2 persistence or blob download",async()=>{
    mocks.refresh.mockResolvedValue({run:ready()});mount();await tick();await tick(500);
    expect(screen.getByRole("img",{name:"水循环"})).toBeInTheDocument();
    expect(mocks.acknowledge).not.toHaveBeenCalled();
    fireEvent.load(screen.getByRole("img",{name:"水循环"}));await tick();
    expect(mocks.acknowledge).toHaveBeenCalledTimes(1);
    expect(screen.getByText("HAI 已生成")).toBeInTheDocument();
    await tick(151_000);expect(mocks.fail).not.toHaveBeenCalled();
  });
  it("closes at 150 seconds even when status requests hang, hides details, and unlocks input",async()=>{
    mocks.refresh.mockImplementation(()=>new Promise(()=>{}));mount();await tick();await tick(150_000);
    expect(screen.getByText("本次生成失败，本轮未扣积分，请再次尝试。")).toBeInTheDocument();
    expect(mocks.fail).toHaveBeenCalledWith("run","client_deadline");
    fireEvent.change(screen.getByRole("textbox",{name:"图片提示词"}),{target:{value:"再次尝试"}});
    expect(screen.getByRole("button",{name:/生成图片/})).toBeEnabled();
    expect(mocks.acknowledge).not.toHaveBeenCalled();expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("does not restart the clock after reopening or accept a late image",async()=>{
    mocks.getRuns.mockResolvedValue([{...run,delivery_deadline_at:new Date(Date.now()+1000).toISOString()}]);
    let resolveStatus!:(value:any)=>void;mocks.refresh.mockImplementation(()=>new Promise((resolve)=>{resolveStatus=resolve;}));
    mount();await tick();await tick(1000);
    await act(async()=>{resolveStatus({run:ready()});});await tick();
    expect(screen.getByText("本轮生成失败")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();expect(mocks.acknowledge).not.toHaveBeenCalled();
  });
  it("an undecodable image fails without acknowledgement or exposing provider details",async()=>{
    mocks.getRuns.mockResolvedValue([ready()]);mount();await tick();
    fireEvent.error(screen.getByRole("img",{name:"水循环"}));await tick();
    expect(mocks.fail).toHaveBeenCalledWith("run","image_decode");expect(mocks.acknowledge).not.toHaveBeenCalled();
    expect(screen.getByText("本次生成失败，本轮未扣积分，请再次尝试。")).toBeInTheDocument();
  });
  it("a lost acknowledgement keeps an image already delivered in time visible and does not resubmit",async()=>{
    mocks.getRuns.mockResolvedValue([ready()]);mocks.acknowledge.mockRejectedValue(new Error("offline"));mount();await tick();
    fireEvent.load(screen.getByRole("img",{name:"水循环"}));await tick();await tick(151_000);
    expect(screen.getByText("HAI 已生成")).toBeInTheDocument();expect(mocks.fail).not.toHaveBeenCalled();expect(mocks.generate).not.toHaveBeenCalled();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    mocks.download.mockRejectedValue(new Error("database task expired"));
    fireEvent.click(screen.getByRole("button", { name: "下载" })); await tick();
    expect(mocks.download).toHaveBeenCalledTimes(1); expect(click).toHaveBeenCalledTimes(1); click.mockRestore();
  });
  it("failed history exposes only the uniform message",async()=>{
    mocks.getRuns.mockResolvedValue([{...run,status:"failed",error_message:"provider 500 secret detail"}]);mount();await tick();
    expect(screen.queryByText(/secret detail/)).not.toBeInTheDocument();expect(screen.getByText("本次生成失败，本轮未扣积分，请再次尝试。")).toBeInTheDocument();
  });
  it("offers precisely four types, retains all styles, and defaults to courseware",async()=>{
    mount();await tick();const select=screen.getByRole("combobox",{name:"生成图类型"}) as HTMLSelectElement;
    expect(Array.from(select.options).map(x=>x.value)).toEqual(["课件 PPT","海报","学习单","思维导图"]);
    expect(select.value).toBe("课件 PPT");expect((screen.getByRole("combobox",{name:"艺术风格"}) as HTMLSelectElement).options.length).toBe(14);
  });
});
