import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { handleWorkWorker } from "./handler.ts";

const secret = "s".repeat(32);
const source = { id: "news", name: "测试用信源", category: "社会时政", stages: ["初中"], url: "https://news.example.org", kind: "case" };
function fixture() {
  const job: any = { run_id: "10000000-0000-0000-0000-000000000001", user_id: "owner", task_id: "task", client_request_id: "request", lease_token: "lease", phase: "initial", attempts: [], payload: {
    prompt: { system: "公开课规则", user: "备课需求" }, module: { slug: "subject-lesson-design", model_provider_id: null }, completionOptions: { model: "test", maxTokens: 6000, thinkingEnabled: false },
    workflow: { version: 2, revision: 3, stage: "result", selected_focus: { title: "规则与自由" }, selected_mode: { title: "议题式" } },
    lessonReferences: { result: [{ path: "template.md", content: "原有教案模板", max_chars: 100 }] }, caseInput: { stage: "初中", grade: "八年级" },
    caseRetrieval: { version_id: "case-v1", instructions: "三条标准", sources: [source], searches: 2, pages: 3 },
  } };
  const calls: any[] = []; const prompts: any[] = [];
  const admin = { rpc: async (name: string, args: any) => {
    calls.push({ name, args: structuredClone(args) });
    if (name === "hai_checkpoint_case_retrieval") {
      // Emulate JSONB round-tripping, including nested object key reordering.
      job.payload.caseState = JSON.parse(JSON.stringify(args.p_state), (_key, value) => value && !Array.isArray(value) && typeof value === "object"
        ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
      if (args.p_attempt) (job.payload.workflow.attempts ??= []).push(args.p_attempt);
      if (args.p_error) job.phase = "complete";
    }
    return { data: name === "hai_claim_work_job" ? structuredClone(job) : true, error: null };
  } } as unknown as SupabaseClient;
  const value = (output: string) => ({ output, started_at: "2026-10-25T00:00:00Z", completed_at: "2026-10-25T00:00:01Z", duration_ms: 1000, usage: null, provider_code: "deepseek", reasoning_chars: 0, first_reasoning_at: null, first_content_at: null });
  const deps = { admin, secret, generate: async (p: any) => {
    prompts.push(p);
    if (p.system.includes("只制定检索词")) return value('{"queries":[{"keywords":"公共空间规则","source_id":"news"}]}');
    if (p.system.includes("只核查已读资料")) return value(JSON.stringify({ cases: [{ page_id: 1, title: "测试用虚构案例", focus: { pass: true, reason: "呈现规则如何协调需求" }, learners: { pass: true, reason: "背景易理解" }, completeness: { pass: true, reason: "有协商行动及结果" }, facts: [{ text: "居民协商规则。", quote: "居民共同协商公共空间使用规则。" }] }], gaps: [] }));
    return value("# 完整教案\n按已确认重点和模式生成。");
  }, recordCall: async () => {}, caseWeb: {
    search: async () => [{ title: "测试页", url: "https://news.example.org/story", date: null, source_id: "news" }],
    read: async () => ({ id: 1, title: "测试页", url: "https://news.example.org/story", date: null, source_id: "news", content: "测试夹具，非真实新闻：居民共同协商公共空间使用规则。", truncated: false }),
  } };
  const run = () => handleWorkWorker(new Request("https://test/worker", { method: "POST", headers: { "x-hai-work-secret": secret }, body: JSON.stringify({ runId: job.run_id }) }), deps);
  return { job, calls, prompts, deps, run };
}

Deno.test("后台自动跑完检索与核查，再把证据送入原有教案模板", async () => {
  const f = fixture();
  for (let i = 0; i < 8 && f.job.payload.caseState?.phase !== "done"; i++) assertEquals((await f.run()).status, 200);
  assertEquals(f.job.payload.caseState.phase, "done");
  assertEquals(f.job.payload.caseState.searches, 1); assertEquals(f.job.payload.caseState.reads, 1);
  const previous = f.prompts.length;
  await f.run();
  assertEquals(f.prompts.length, previous + 1);
  const generation = f.prompts.at(-1);
  assertStringIncludes(generation.user, "原有教案模板"); assertStringIncludes(generation.user, "居民协商规则");
  const output = f.calls.find(c => c.name === "hai_checkpoint_work_job").args.p_attempt.markdown;
  assertStringIncludes(output, "案例资料来源"); assertStringIncludes(output, "https://news.example.org/story");
  assertEquals(f.job.payload.workflow.attempts.length, 2);
  // A retry of final generation reuses the completed case state, without search.
  const checkpoints = f.calls.filter(c => c.name === "hai_checkpoint_case_retrieval").length;
  await f.run();
  assertEquals(f.calls.filter(c => c.name === "hai_checkpoint_case_retrieval").length, checkpoints);
});

Deno.test("搜索失败保留已消耗预算，不能继续生成无依据教案", async () => {
  const f = fixture(); await f.run();
  let count = 0;
  f.deps.caseWeb.search = async () => { count++; throw new Error("搜索暂不可用"); };
  await f.run();
  assertEquals(count, 1); assertEquals(f.job.phase, "complete"); assertEquals(f.job.payload.caseState.searches, 1);
  assertEquals(f.calls.some(c => c.name === "hai_checkpoint_work_job"), false);
  assertEquals(f.calls.at(-2).args.p_error, "搜索暂不可用");
});

Deno.test("失去执行权时不执行网络请求", async () => {
  const f = fixture(); let requests = 0;
  f.deps.caseWeb.search = async () => { requests++; return []; };
  f.deps.admin.rpc = (async (name: string) => name === "hai_claim_work_job" ? { data: f.job, error: null } : { data: null, error: { message: "lease lost" } }) as any;
  assertEquals((await f.run()).status, 500); assertEquals(requests, 0); assertEquals(f.prompts.length, 0);
});

Deno.test("计费任务分别记录一次成功搜索与抓取，复用资料不新增费用", async () => {
  const f = fixture(); f.job.payload.caseRetrieval.billing_version = 1;
  for (let i = 0; i < 8 && f.job.payload.caseState?.phase !== "done"; i++) await f.run();
  const receipts = f.calls.filter(c => c.name === "hai_record_web_tool_success");
  assertEquals(receipts.map(c => [c.args.p_tool_kind, c.args.p_request_number]), [["search", 1], ["fetch", 1]]);
  const firstSearch = f.calls.findIndex(c => c.name === "hai_record_web_tool_success");
  assertEquals(f.calls.slice(0, firstSearch).some(c => c.name === "hai_prepare_web_tool_billing"), true);
  await f.run(); await f.run();
  assertEquals(f.calls.filter(c => c.name === "hai_record_web_tool_success").length, 2);
});

Deno.test("搜索失败或没有结果均不记录成功计费", async () => {
  for (const fail of [false, true]) {
    const f = fixture(); f.job.payload.caseRetrieval.billing_version = 1; await f.run();
    f.deps.caseWeb.search = async () => { if (fail) throw new Error("超时"); return []; };
    await f.run();
    assertEquals(f.calls.filter(c => c.name === "hai_record_web_tool_success").length, 0);
  }
});
