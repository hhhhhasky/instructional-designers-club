import { initialWorkflow, parseWorkflowOutput, workflowPrompt } from "./hai_workflow.ts";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
Deno.test("guided routing is fixed and politics selection is accepted only from its three choices", () => {
  assert(initialWorkflow("lesson-diagnosis", {}, false) === null, "simple task changed");
  assert(initialWorkflow("subject-lesson-design", {}, true) === null, "legacy revision changed");
  assert(initialWorkflow("subject-lesson-design", { subject: "道德与法治", teaching_mode: "案例式" }, false)?.stage === "result", "duplicate confirmation");
  assert(initialWorkflow("subject-lesson-design", { subject: "数学", teaching_mode: "案例式" }, false)?.stage === "mode", "non-politics choice trusted");
  assert(initialWorkflow("unit-learning-design", {}, false)?.stage === "mode", "unit stage missing");
});
Deno.test("mode parser rejects malformed or repeated options and does not accept a full lesson as a choice", () => {
  for (const data of [{markdown:"full lesson"},{options:[]},{options:[{id:"a"},{id:"a"}]}]) {
    let rejected=false;try { parseWorkflowOutput(JSON.stringify(data),"mode","subject-lesson-design"); } catch {rejected=true;}
    assert(rejected,"malformed choice accepted");
  }
});
Deno.test("chosen mode and earlier teacher edits reach generation without another classroom confirmation", () => {
  const prompt = workflowPrompt({system:"skill",user:"original request"},{version:1,revision:3,stage:"result",selected_mode:{id:"a",title:"比较探究",reason:"概念辨析",approach:"独立说明"},history:[{action:"revise",feedback:"保留个人书面表达"}]},"subject-lesson-design");
  assert(prompt.user.includes("比较探究") && prompt.user.includes("保留个人书面表达"),"teacher choices lost");
  assert(prompt.system.includes("不增加课堂流程确认"),"extra confirmation requested");
});
