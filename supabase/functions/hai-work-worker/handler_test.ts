import { handleWorkWorker } from "./handler.ts";
import { normalizeWorkMarkdown } from "../_shared/hai_work_execution.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const secret = "s".repeat(32);
const runId = "10000000-0000-0000-0000-000000000001";
const sample = {
  run_id: runId,
  user_id: "owner",
  task_id: "task",
  client_request_id: "request",
  lease_token: "lease",
  phase: "initial",
  attempts: [],
  payload: {
    prompt: { system: "system", user: "user" },
    module: { slug: "lesson-diagnosis", model_provider_id: null },
    completionOptions: {
      model: "deepseek-v4-flash",
      maxTokens: 4096,
      temperature: 0.2,
      thinkingEnabled: false,
    },
  },
};
const result = {
  output: "# 教案",
  started_at: "2026-10-16T00:00:00Z",
  completed_at: "2026-10-16T00:01:00Z",
  duration_ms: 60000,
  usage: null,
  provider_code: "deepseek",
  reasoning_chars: 0,
  first_reasoning_at: null,
  first_content_at: null,
};
const request = (key = secret) =>
  new Request("https://local/hai-work-worker", {
    method: "POST",
    headers: { "x-hai-work-secret": key, "content-type": "application/json" },
    body: JSON.stringify({ runId }),
  });
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function fixture(job: unknown = sample) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const admin = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: name === "hai_claim_work_job" ? job : true, error: null };
    },
  } as unknown as SupabaseClient;
  let generations = 0;
  let records = 0;
  const dependencies = {
    admin,
    secret,
    generate: async (_params?: any) => {
      generations++;
      return result;
    },
    recordCall: async () => {
      records++;
    },
  };
  return { dependencies, calls, count: () => ({ generations, records }) };
}

Deno.test("worker rejects missing or incorrect scheduler credentials before touching the database", async () => {
  const f = fixture();
  assert(
    (await handleWorkWorker(request("wrong"), f.dependencies)).status === 401,
    "invalid secret accepted",
  );
  assert(
    f.calls.length === 0 && f.count().generations === 0,
    "unauthenticated work executed",
  );
});
Deno.test("duplicate or already completed worker wakeups do not call a model", async () => {
  const f = fixture(null);
  assert(
    (await handleWorkWorker(request(), f.dependencies)).ok,
    "duplicate wakeup failed",
  );
  assert(f.count().generations === 0, "duplicate model call");
});
Deno.test("each worker performs only one model phase and durably checkpoints before dispatching", async () => {
  const f = fixture();
  assert(
    (await handleWorkWorker(request(), f.dependencies)).ok,
    "generation failed",
  );
  assert(f.count().generations === 1, "model called more than once");
  const checkpoint = f.calls.find((c) => c.name === "hai_checkpoint_work_job");
  assert(checkpoint?.args.p_lease_token === "lease", "missing ownership token");
  assert(
    (checkpoint?.args.p_attempt as { markdown: string }).markdown === "# 教案",
    "output not saved",
  );
  assert(
    !f.calls.some((c) => c.name === "hai_finish_work_job"),
    "generation and settlement share an invocation",
  );
  assert(
    f.calls.at(-1)?.name === "hai_dispatch_work_jobs",
    "checkpoint not followed by wakeup",
  );
});
Deno.test("empty-output repair receives its own invocation instead of a second inline model call", async () => {
  const f = fixture({
    ...sample,
    phase: "repair",
    attempts: [{ markdown: "" }],
  });
  assert(
    (await handleWorkWorker(request(), f.dependencies)).ok,
    "repair failed",
  );
  assert(f.count().generations === 1, "repair called model repeatedly");
  const saved = f.calls.find((c) => c.name === "hai_checkpoint_work_job")?.args
    .p_attempt as { attempt: number; purpose: string };
  assert(
    saved.attempt === 2 && saved.purpose === "empty_output_repair",
    "repair history lost",
  );
});
Deno.test("completion retries consume saved output and record usage without calling the model", async () => {
  const f = fixture({
    ...sample,
    phase: "complete",
    attempts: [{ ...result, attempt: 1, markdown: "# 教案" }],
  });
  assert(
    (await handleWorkWorker(request(), f.dependencies)).ok,
    "completion failed",
  );
  assert(
    f.count().generations === 0 && f.count().records === 1,
    "completion regenerated output",
  );
  assert(
    f.calls.some((c) => c.name === "hai_finish_work_job"),
    "atomic settlement not invoked",
  );
});
Deno.test("failed settlement leaves saved output intact for a later worker", async () => {
  const f = fixture({
    ...sample,
    phase: "complete",
    attempts: [{ ...result, attempt: 1, markdown: "# 教案" }],
  });
  const rpc = f.dependencies.admin.rpc.bind(f.dependencies.admin);
  f.dependencies.admin.rpc =
    ((name: string, args: Record<string, unknown>) =>
      name === "hai_finish_work_job"
        ? Promise.resolve({
          data: null,
          error: { message: "synthetic billing outage" },
        })
        : rpc(name, args)) as typeof f.dependencies.admin.rpc;
  assert(
    (await handleWorkWorker(request(), f.dependencies)).status === 500,
    "failed settlement reported success",
  );
  assert(
    f.count().generations === 0,
    "settlement failure regenerated the model",
  );
  assert(
    !f.calls.some((c) => c.name === "hai_checkpoint_work_job"),
    "saved attempt overwritten",
  );
});
Deno.test("a fresh heartbeat extends the claim, and a lost lease cannot save late output", async () => {
  const f = fixture();
  f.dependencies.generate = async () => {
    await new Promise((resolve) => setTimeout(resolve, 12));
    return result;
  };
  const rpc = f.dependencies.admin.rpc.bind(f.dependencies.admin);
  f.dependencies.admin.rpc =
    ((name: string, args: Record<string, unknown>) =>
      name === "hai_heartbeat_work_job"
        ? Promise.resolve({ data: false, error: null })
        : rpc(name, args)) as typeof f.dependencies.admin.rpc;
  assert(
    (await handleWorkWorker(request(), { ...f.dependencies, heartbeatMs: 1 }))
      .status === 500,
    "lost lease accepted",
  );
  assert(
    !f.calls.some((c) => c.name === "hai_checkpoint_work_job"),
    "late output saved after losing lease",
  );
});
Deno.test("normalization preserves markdown but removes model wrappers and thinking", () => {
  assert(
    normalizeWorkMarkdown(
      "```markdown\n【思考】private【/思考】\n# 教案\n正文\n```",
    ) === "# 教案\n正文",
    "normalization changed",
  );
});

Deno.test("unit worker checkpoints the overall design then one lesson per invocation", async () => {
  const { UNIT_SECTION_NAMES, LESSON_SECTION_NAMES } = await import("../_shared/hai_unit_design.ts");
  const doc = (names: string[]) => ["# 设计", ...["基本信息", ...names].map((name) => `## ${name}\n教学材料与学生表现有具体要求，按照实际内容设置评价任务及判断标准。`)].join("\n\n");
  const plan = { markdown: doc(UNIT_SECTION_NAMES), lessons: [{ title: "课题1", lesson_type: "新授课", subtask: "比较实例", subquestion: "如何解释", connection: "承接起点诊断", objectives: "解释现象", source_paths: ["单元1/课1"] }] };
  const unitJob = { ...sample, payload: { ...sample.payload, module: { slug: "unit-learning-design", model_provider_id: null } } };
  const first = fixture(unitJob);
  first.dependencies.generate = async (params) => {
    assert(params.completionOptions.responseFormat === "json_object", "overall plan must use JSON mode");
    assert(params.user.includes("先写 lessons") && params.user.includes("两个字段缺一"), "missing required manifest directive");
    return { ...result, output: JSON.stringify(plan) };
  };
  await handleWorkWorker(request(), first.dependencies);
  const saved = first.calls.find((c) => c.name === "hai_checkpoint_unit_work_job")!.args.p_attempt as any;
  assert(saved.file.kind === "unit" && saved.unit_plan.lessons.length === 1, "plan not saved");
  const next = fixture({ ...unitJob, attempts: [saved] });
  next.dependencies.generate = async (params) => {
    assert(params.completionOptions.responseFormat === "text", "lesson must use Markdown mode");
    return { ...result, output: doc(LESSON_SECTION_NAMES) };
  };
  await handleWorkWorker(request(), next.dependencies);
  const lesson = next.calls.find((c) => c.name === "hai_checkpoint_unit_work_job")!.args.p_attempt as any;
  assert(lesson.file.kind === "lesson" && lesson.file.filename.startsWith("01_"), "lesson not saved independently");
  const incomplete = fixture(unitJob);
  await handleWorkWorker(request(), incomplete.dependencies);
  const failed = incomplete.calls.find((c) => c.name === "hai_checkpoint_unit_work_job")!.args.p_attempt as any;
  assert(Boolean(failed.error) && !failed.file, "incomplete output treated as a complete unit");
});

Deno.test("guided mode output waits durably instead of producing an artifact", async () => {
  const job = structuredClone(sample) as any;
  job.payload.module.slug = "subject-lesson-design";
  job.payload.workflow = {version:1,revision:1,stage:"mode"};
  const f=fixture(job);
  f.dependencies.generate=async()=>({...result,output:JSON.stringify({options:[{id:"a",title:"A",reason:"知识",approach:"比较"},{id:"b",title:"B",reason:"素养",approach:"探究"}]})});
  const response=await handleWorkWorker(request(),f.dependencies);
  assert(response.status===200,"guided generation failed");
  assert(f.calls.some(c=>c.name==="hai_checkpoint_workflow"),"did not save waiting stage");
  assert(!f.calls.some(c=>c.name==="hai_finish_work_job" || c.name==="hai_checkpoint_work_job"),"mode became artifact");
  assert(f.count().records===1,"preview cost not recorded");
});
Deno.test("guided final unit starts from confirmed plan and generates only next lesson", async () => {
  const job=structuredClone(sample) as any;
  job.payload.module.slug="unit-learning-design";
  job.payload.workflow={version:1,revision:3,stage:"result",selected_mode:{title:"单元问题"}};
  job.attempts=[{purpose:"confirmed_plan",unit_plan:{markdown:"教师确认的整体",lessons:[{title:"第一课"}]},file:{markdown:"教师确认的整体"}}];
  const f=fixture(job);let prompt="";
  f.dependencies.generate=async(p:any)=>{prompt=p.user;return {...result,output:"invalid lesson"};};
  await handleWorkWorker(request(),f.dependencies);
  assert(prompt.includes("教师确认的整体")&&prompt.includes("第一课"),"confirmed plan missing");
  assert(f.calls.some(c=>c.name==="hai_checkpoint_unit_work_job"),"did not use per-lesson persistence");
});

Deno.test("four-stage worker persists focus without generating a lesson and loads only the current phase", async () => {
  const job=structuredClone(sample) as any;
  job.payload.module.slug="subject-lesson-design";
  job.payload.workflow={version:2,revision:1,stage:"focus"};
  job.payload.lessonReferences={mode:[{path:"modes.md",content:"mode-only",max_chars:100}],result:[{path:"template.md",content:"template-only",max_chars:100}]};
  const options=[{id:"a",title:"从记忆到说明算理",reason:"概念关系",approach:"独立说明依据"},{id:"b",title:"辨认条件",reason:"理解边界",approach:"比较两个实例"}];
  const first=fixture(job);
  first.dependencies.generate=async(p:any)=>{
    assert(p.system.includes("只确定教什么"),"focus stage missing");
    assert(!p.user.includes("mode-only")&&!p.user.includes("template-only"),"future phase leaked");
    return {...result,output:JSON.stringify({options})};
  };
  const response=await handleWorkWorker(request(),first.dependencies);
  assert(response.status===200 && first.calls.some(c=>c.name==="hai_checkpoint_workflow"),"focus not persisted");
  assert(!first.calls.some(c=>c.name==="hai_checkpoint_work_job"),"focus became artifact");
  job.payload.workflow={version:2,revision:2,stage:"mode",selected_focus:options[0]};
  const next=fixture(job);
  next.dependencies.generate=async(p:any)=>{
    assert(p.user.includes("mode-only")&&!p.user.includes("template-only"),"wrong phase references");
    assert(p.user.includes("从记忆到说明算理"),"focus lost");
    return {...result,output:JSON.stringify({options})};
  };
  await handleWorkWorker(request(),next.dependencies);
  assert(next.calls.some(c=>c.name==="hai_checkpoint_workflow"),"mode not persisted");
});

Deno.test("new unit workflow loads a matched overall template then its lesson template", async () => {
  const job: any = structuredClone(sample);
  job.payload.module.slug = "unit-learning-design";
  job.payload.workflow = { version: 1, revision: 2, stage: "plan", selected_mode: { id: "concept-led", title: "大概念统领型", reason: "概念关系", approach: "由比较到迁移" } };
  job.payload.unitReferences = [
    { path: "assets/unit-concept-led.md", content: "本阶段整体模板", max_chars: 100 },
    { path: "assets/lesson-concept-led.md", content: "本阶段单课模板", max_chars: 100 },
    { path: "references/quality-criteria.md", content: "质量要求", max_chars: 100 },
  ];
  const f = fixture(job);
  f.dependencies.generate = async (p: any) => {
    assert(p.user.includes("本阶段整体模板") && !p.user.includes("本阶段单课模板"), "wrong unit phase references");
    return { ...result, output: "invalid plan" };
  };
  await handleWorkWorker(request(), f.dependencies);
  job.payload.workflow.stage = "result";
  job.payload.workflow.feedback = "不应发送的当前反馈";
  job.payload.workflow.history = [{ action: "revise", feedback: "不应发送的历史修改" }];
  job.payload.prompt.user = '## 任务输入\n{"constraints":"保留40分钟约束","curriculum_sources":[{"excerpt":"不应发送的课标节选"}]}\n\n## 内置教材知识库（精确命中）\n不应发送的教材正文';
  job.attempts = [{ purpose: "confirmed_plan", unit_plan: { markdown: "教师已经确认的整体", lessons: [{ title: "第一课" }] }, file: { markdown: "教师已经确认的整体" } }];
  const next = fixture(job);
  next.dependencies.generate = async (p: any) => {
    assert(p.user.includes("本阶段单课模板") && !p.user.includes("本阶段整体模板"), "wrong lesson phase references");
    assert(p.user.includes("教师已经确认的整体"), "lost confirmed overall design");
    assert(p.user.includes("保留40分钟约束"), "teaching constraint lost");
    for (const text of ["前一课教案", "不应发送的教材正文", "不应发送的课标节选", "不应发送的当前反馈", "不应发送的历史修改", "教师已确认的教学模式", "references/quality-criteria.md"]) assert(!p.user.includes(text), "lesson leaked omitted content: " + text);
    assert(!p.system.includes("3—4 项目标"), "obsolete fixed objective count");
    return { ...result, output: "invalid lesson" };
  };
  await handleWorkWorker(request(), next.dependencies);
});
