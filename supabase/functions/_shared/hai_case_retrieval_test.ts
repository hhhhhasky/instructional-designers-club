import { assertEquals, assertRejects, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { caseEvidenceContext, caseNeed, caseSourceAppendix, DeepSeekCaseWeb, initialCaseState, parseCaseJudgments, stepCaseRetrieval, type CaseConfig, type CasePage } from "./hai_case_retrieval.ts";

const source = { id: "news", name: "测试新闻源", category: "社会时政", stages: ["初中"], url: "https://news.example.org/politics", kind: "case" };
const config: CaseConfig = { version_id: "v1", instructions: "按三条标准核查。", sources: [source], searches: 2, pages: 3 };
const need = caseNeed({ stage: "初中", learner_context: "学生能说出规则但不能解释理由" }, { selected_focus: { title: "规则与自由的关系" }, selected_mode: { title: "议题式" } });
const page: CasePage = { id: 1, title: "某公共议事活动", url: "https://news.example.org/story", date: null, source_id: "news", content: "以下为测试用虚构原文，不是真实报道：居民在协商中说明不同需求，共同商定公共空间的使用规则。", truncated: false };
const judgment = { page_id: 1, title: "公共空间议事", focus: { pass: true, reason: "具体呈现规则与不同需求的关系" }, learners: { pass: true, reason: "学生可以理解公共空间使用问题" }, completeness: { pass: true, reason: "有分歧、协商行动及达成规则的信息" }, facts: [{ text: "居民协商公共空间使用规则。", quote: "居民在协商中说明不同需求，共同商定公共空间的使用规则。" }] };
const review = JSON.stringify({ cases: [judgment], gaps: [] });
const web = { search: async () => [{ title: page.title, url: page.url, date: null, source_id: source.id }], read: async () => page };

Deno.test("完整检索先读原文，三条标准通过即停止并保留来源", async () => {
  let state = initialCaseState(need); let calls = 0;
  const model = async () => ++calls === 1 ? JSON.stringify({ queries: [{ keywords: "公共空间 协商 规则", source_id: "news" }, { keywords: "另一检索词", source_id: "news" }] }) : review;
  for (let i = 0; i < 10 && state.phase !== "done"; i++) state = await stepCaseRetrieval(state, config, web, model);
  assertEquals(state.phase, "done"); assertEquals(state.searches, 1); assertEquals(state.reads, 1); assertEquals(calls, 2);
  assertEquals(caseEvidenceContext(state).includes(page.url), true);
  assertEquals(caseSourceAppendix(state).includes("页面发布日期未提供"), true);
});

Deno.test("未通过教学匹配不能因有来源而采用", () => {
  const rejected = { ...judgment, focus: { pass: false, reason: "只有主题相同，没有解释关系" } };
  assertEquals(parseCaseJudgments(JSON.stringify({ cases: [rejected], gaps: ["缺少知识关系"] }), [page]).cases, []);
});

Deno.test("拒绝模型编造的引文与未读页面，且不透传模型网址", () => {
  assertThrows(() => parseCaseJudgments(JSON.stringify({ cases: [{ ...judgment, facts: [{ text: "虚构事实", quote: "这是模型编造但网页并未出现的文字" }] }], gaps: [] }), [page]));
  assertThrows(() => parseCaseJudgments(JSON.stringify({ cases: [{ ...judgment, page_id: 99 }], gaps: [] }), [page]));
  const accepted = parseCaseJudgments(JSON.stringify({ cases: [{ ...judgment, url: "https://evil.invalid" }], gaps: [] }), [page]);
  assertEquals("url" in accepted.cases[0], false);
});

Deno.test("没有合格材料时预算用尽失败，不拼成虚构案例", async () => {
  let state = initialCaseState(need);
  const model = async () => state.phase === "plan" ? JSON.stringify({ queries: [{ keywords: "词", source_id: "news" }, { keywords: "词二", source_id: "news" }] }) : JSON.stringify({ cases: [], gaps: ["缺少关键行动"] });
  const more = { ...web, search: async () => [1, 2, 3, 4].map(i => ({ title: "测试", url: `${page.url}/${i}`, date: null, source_id: source.id })) };
  for (let i = 0; i < 20 && state.phase !== "failed"; i++) state = await stepCaseRetrieval(state, config, more, model);
  assertEquals(state.phase, "failed"); assertEquals(state.reads, 3); assertEquals(state.searches <= 2, true);
  assertThrows(() => caseEvidenceContext(state));
});

Deno.test("改变重点使旧资料失效，但不恢复任务搜索预算", () => {
  const old = initialCaseState(need); old.reads = 2; old.searches = 1; old.pages = [page]; old.cases = [judgment]; old.phase = "done";
  assertEquals(initialCaseState(need, old).phase, "done");
  const fresh = initialCaseState({ ...need, focus: { title: "新的重点" } }, old);
  assertEquals(fresh.pages, []); assertEquals(fresh.searches, 1); assertEquals(fresh.reads, 2);
});

Deno.test("数据库重排对象字段后仍恢复检索进度，不重复规划搜索词", async () => {
  const storedNeed = JSON.parse(JSON.stringify(need), (_key, value) => value && !Array.isArray(value) && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
  const prior = initialCaseState(storedNeed); prior.phase = "search";
  prior.queries = [{ keywords: "规则 协商", source_id: "news" }];
  const resumed = initialCaseState(need, prior);
  assertEquals(resumed.phase, "search"); assertEquals(resumed.queries, prior.queries);
  let modelCalls = 0;
  const next = await stepCaseRetrieval(resumed, config, web, async () => { modelCalls++; return "{}"; });
  assertEquals(modelCalls, 0); assertEquals(next.searches, 1); assertEquals(next.phase, "read");
  const nestedNeed = { ...need, focus: { title: "规则与自由", details: { b: 2, a: 1 } } };
  const nestedStored = initialCaseState({ ...nestedNeed, focus: { details: { a: 1, b: 2 }, title: "规则与自由" } });
  nestedStored.phase = "done";
  assertEquals(initialCaseState(nestedNeed, nestedStored).phase, "done");
  assertEquals(initialCaseState({ ...nestedNeed, focus: { title: "规则与自由", details: { b: 3, a: 1 } } }, nestedStored).phase, "plan");
});

Deno.test("搜索限域、去掉正文请求，伪装子域不进入候选", async () => {
  const requests: any[] = [];
  const client = new DeepSeekCaseWeb("secret", (async (url, init) => {
    requests.push({ url, body: JSON.parse(String((init as RequestInit)?.body)) });
    return Response.json({ results: [{ url: page.url, title: "真实源" }, { url: "https://news.example.org.evil.invalid/", title: "冒充源" }, { url: "https://evil.invalid/?from=news.example.org", title: "冒充源" }] });
  }) as typeof fetch);
  const results = await client.search("关键词".repeat(100), source);
  assertEquals(results.length, 1); assertEquals(requests[0].body.need_content, false);
  assertEquals([...requests[0].body.query].length <= 128, true);
  assertEquals(requests[0].body.query.endsWith("site:news.example.org"), true);
});

Deno.test("正文截取明确标记，不把摘要视为正文", async () => {
  const client = new DeepSeekCaseWeb("secret", (async () => Response.json({ title: "页", content: "文".repeat(12000) })) as typeof fetch);
  const read = await client.read(page, source); assertEquals(read.content.length, 10000); assertEquals(read.truncated, true);
  await assertRejects(() => client.read({ ...page, url: "http://127.0.0.1/" }, source));
});

Deno.test("检索API错误不泄露服务返回的敏感文本", async () => {
  const client = new DeepSeekCaseWeb("secret", (async () => new Response("secret credential", { status: 401 })) as typeof fetch);
  await assertRejects(() => client.search("规则", source), Error, "401");
});

Deno.test("检索计费以供应商非空结果为准，不按返回条数或本地筛选结果计量", async () => {
  const empty = new DeepSeekCaseWeb("secret", (async () => Response.json({ results: [] })) as typeof fetch);
  assertEquals((await empty.search("规则", source)).billable, false);
  const excluded = new DeepSeekCaseWeb("secret", (async () => Response.json({ results: [{ url: "https://other.invalid/", title: "本地不采用" }] })) as typeof fetch);
  const results = await excluded.search("规则", source);
  assertEquals(results.length, 0); assertEquals(results.billable, true);
});

Deno.test("没有确认重点或信源不匹配学段时不消耗服务请求", async () => {
  let calls = 0; const model = async () => { calls++; return "{}"; };
  await assertRejects(() => stepCaseRetrieval(initialCaseState({ ...need, focus: null }), config, web, model));
  await assertRejects(() => stepCaseRetrieval(initialCaseState({ ...need, stage: "小学" }), config, web, model));
  assertEquals(calls, 0);
});

Deno.test("先保存本课主题判断，再限定同主题信源，不新增模型调用", async () => {
  const topicConfig: CaseConfig = { ...config, topics: [{ id: "law", name: "法律与司法案例", keywords: ["规则"], guidance: "依据具体争议选择" }], sources: [{ ...source, categories: ["law"] }] };
  let calls = 0;
  const next = await stepCaseRetrieval(initialCaseState(need), topicConfig, web, async prompt => {
    calls++; assertEquals(prompt.user.includes("法律与司法案例"), true);
    return JSON.stringify({ topic_selection: { ids: ["law"], reason: "重点需要说明规则与个人行为的关系" }, queries: [{ keywords: "公共空间 协商", source_id: "news" }] });
  });
  assertEquals(calls, 1); assertEquals(next.phase, "search"); assertEquals(next.topic_selection?.ids, ["law"]);
});

Deno.test("不允许跨主题选站点，登录来源不进入自动检索候选", async () => {
  const topics = [{ id: "law", name: "法律", keywords: [], guidance: "" }, { id: "economy", name: "经济", keywords: [], guidance: "" }];
  const topicConfig: CaseConfig = { ...config, topics, sources: [{ ...source, categories: ["economy"] }, { ...source, id: "private", categories: ["law"], access: "requires_login" }] };
  await assertRejects(() => stepCaseRetrieval(initialCaseState(need), topicConfig, web, async prompt => {
    assertEquals(JSON.parse(prompt.user).sources.some((s: any) => s.id === "private"), false);
    return JSON.stringify({ topic_selection: { ids: ["law"], reason: "本课需要法律案例" }, queries: [{ keywords: "测试", source_id: "news" }] });
  }), Error, "不属于");
});

Deno.test("同一站点可以属于多个主题，任一主题匹配即可选用", async () => {
  const topicConfig: CaseConfig = { ...config, topics: [{ id: "law", name: "法律", keywords: [], guidance: "" }, { id: "society", name: "社会", keywords: [], guidance: "" }], sources: [{ ...source, categories: ["law", "society"] }] };
  const next = await stepCaseRetrieval(initialCaseState(need), topicConfig, web, async () => JSON.stringify({ topic_selection: { ids: ["society"], reason: "用社会事件理解规则" }, queries: [{ keywords: "协商", source_id: "news" }] }));
  assertEquals(next.phase, "search");
});
