// Bounded paid integration check. No task creation, wallet changes, Skill
// publication, or deployment. Credentials are never included in the report.
import { CaseConfig, CaseState, DeepSeekCaseWeb, initialCaseState, stepCaseRetrieval } from "../supabase/functions/_shared/hai_case_retrieval.ts";
const env: Record<string, string> = {};
for (const line of (await Deno.readTextFile(".env")).split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (match) env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
}
const base = env.VITE_SUPABASE_URL;
const adminKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const endpoint = new URL("/rest/v1/hai_model_providers", base);
endpoint.search = new URLSearchParams({ select: "api_key,model_name,base_url", is_enabled: "eq.true", base_url: "like.*api.deepseek.com*", limit: "5" }).toString();
const providers = await fetch(endpoint, { headers: { apikey: adminKey, Authorization: `Bearer ${adminKey}` }, signal: AbortSignal.timeout(15000) });
if (!providers.ok) throw new Error(`读取官方模型配置失败（${providers.status}）`);
const rows = await providers.json();
const provider = rows.find((row: any) => typeof row.api_key === "string" && (!row.api_key.startsWith("ENV:") || env[row.api_key.slice(4)] || Deno.env.get(row.api_key.slice(4))));
if (!provider) throw new Error("本地无法取得可用的官方 DeepSeek API Key；未发起付费检索。");
const key = provider.api_key.startsWith("ENV:") ? env[provider.api_key.slice(4)] || Deno.env.get(provider.api_key.slice(4)) : provider.api_key;
const bundle = JSON.parse(await Deno.readTextFile("supabase/seed-data/case-retrieval-work-skill.json"));
const config: CaseConfig = { version_id: "local-v1.0.0", instructions: bundle.instructions,
  sources: JSON.parse(bundle.references[0].content), searches: 2, pages: 3,
  ...(bundle.references.find((r: any) => r.path === "references/topics.json") ? { topics: JSON.parse(bundle.references.find((r: any) => r.path === "references/topics.json").content) } : {}) };
let state: CaseState = initialCaseState({ stage: "高中", learners: "机制测试：高中生能理解职业与社会分工，但容易把敬业只理解为工作时间长。", focus: { title: "理解敬业精神如何体现在具体行动中，能依据事实解释个人价值与社会价值的关系" }, mode: { title: "案例式", approach: "比较人物行动与服务对象的关系，解释价值实现" }, feedback: "" });
let calls: unknown[] = [];
const reportPath = Deno.args.includes("--topics") ? "output/hai-case-retrieval/live-topics-result.json" : "output/hai-case-retrieval/live-result.json";
if (Deno.args.includes("--resume")) {
  const report = JSON.parse(await Deno.readTextFile(reportPath)); state = report.state; calls = report.calls;
}
await Deno.mkdir("output/hai-case-retrieval", { recursive: true });
const save = async () => Deno.writeTextFile(reportPath, JSON.stringify({ state, calls, note: "真实检索及核查样例；非教材匹配、完整教案或登录页面验收。" }, null, 2));
const web = new DeepSeekCaseWeb(key);
for (let i = 0; i < 14 && !["done", "failed"].includes(state.phase); i++) {
  try {
  state = await stepCaseRetrieval(state, config, web, async prompt => {
    const response = await fetch("https://api.deepseek.com/chat/completions", { method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "deepseek-flash", messages: [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }], thinking: { type: "disabled" }, response_format: { type: "json_object" }, max_tokens: 2400 }), signal: AbortSignal.timeout(90000) });
    if (!response.ok) throw new Error(`真实模型调用失败（${response.status}）`);
    const data = await response.json();
    calls.push({ phase: state.phase, usage: data.usage, model: data.model, finish_reason: data.choices[0].finish_reason, output: data.choices[0].message.content });
    if (data.choices[0].finish_reason === "length") throw new Error("核查模型输出被长度上限截断。");
    return data.choices[0].message.content;
  });
  console.log(JSON.stringify({ phase: state.phase, searches: state.searches, reads: state.reads, cases: state.cases.length }));
  } finally { await save(); }
}
await save();
if (state.phase !== "done") throw new Error("真实样例未取得三条标准通过的案例，见保存的缺口。");
console.log(JSON.stringify({ status: "done", sources: state.pages.filter(p => state.cases.some(c => c.page_id === p.id)).map(p => ({ title: p.title, url: p.url })) }));
