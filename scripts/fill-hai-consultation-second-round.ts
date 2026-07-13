import { HAIContextOrchestrator } from "../supabase/functions/_shared/hai_orchestrator/context_orchestrator.ts";
import { buildComposedSystemPrompt, normalizeHaiVoiceFormatting } from "../supabase/functions/_shared/hai_orchestrator/response_composer.ts";

const ROOT = new URL("../", import.meta.url);
const DEFAULT_DOC = new URL("docs/哈老师语料/01-新教师与备课入门.md", ROOT);
const MARKER = "### 3.1 AI 第二轮回答（R09 本地候选提示词）";
const shouldWrite = Deno.args.includes("--write");
const docArg = valueAfter("--doc");
const docUrl = docArg ? new URL(docArg, ROOT) : DEFAULT_DOC;
const model = Deno.env.get("DEEPSEEK_MODEL") || "deepseek-v4-flash";
const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
const baseUrl = (Deno.env.get("DEEPSEEK_BASE_URL") || "https://api.deepseek.com").replace(/\/$/, "");

if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY in the process environment.");

const original = await Deno.readTextFile(docUrl);
if (original.includes(MARKER)) {
  throw new Error(`Document already contains ${MARKER}; refusing to duplicate or overwrite the second round.`);
}

const cases = extractCases(original);
if (cases.length === 0) throw new Error("No consultation cases found.");

const orchestrator = new HAIContextOrchestrator();
const answers = new Map<string, string>();

for (const [index, item] of cases.entries()) {
  console.log(`[${index + 1}/${cases.length}] Generating ${item.id}...`);
  const context = orchestrator.buildInitialPackage(item.question, {
    caseMax: 0,
    methodMax: 0,
    theoryMax: 0,
    expressionMax: 5,
  });
  const systemPrompt = buildComposedSystemPrompt({
    module: { name: "问问哈老师", slug: "ask-han" },
    context,
    memories: [],
    materialContext: { text: "", citations: [] },
    knowledgeContext: { text: "", citations: [] },
  });
  answers.set(item.id, await generateAnswer(systemPrompt, item.question));
}

let updated = original;
for (const item of cases) {
  const answer = answers.get(item.id);
  if (!answer) throw new Error(`Missing generated answer for ${item.id}`);
  const replacement = `${item.aiAnswer}\n\n${MARKER}\n\n${answer}\n`;
  updated = replaceOnce(updated, item.aiAnswer, replacement, item.id);
}

const inserted = (updated.match(/^### 3\.1 AI 第二轮回答（R09 本地候选提示词）$/gm) ?? []).length;
if (inserted !== cases.length) {
  throw new Error(`Structural validation failed: expected ${cases.length} inserted blocks, found ${inserted}.`);
}

if (!shouldWrite) {
  console.log(`[dry-run] Generated ${cases.length} answers; add --write to update ${decodeURIComponent(docUrl.pathname)}.`);
  Deno.exit(0);
}

const tempUrl = new URL(`${docUrl.pathname}.tmp`, "file://");
await Deno.writeTextFile(tempUrl, updated);
await Deno.rename(tempUrl, docUrl);
console.log(`Inserted ${inserted} second-round answers into ${decodeURIComponent(docUrl.pathname)}.`);

function extractCases(text: string) {
  return text
    .split(/(?=^## Q\d+)/m)
    .filter((chunk) => /^## Q\d+/m.test(chunk))
    .map((chunk) => {
      const id = chunk.match(/^## (Q\d+)/m)?.[1];
      if (!id) throw new Error("Case without Q id.");
      const question = between(chunk, "### 1. 用户原始问题", "### 2. 哈老师真实回答（我写）");
      const aiAnswer = betweenWithHeading(chunk, "### 3. AI 原始回答（AI写）", "### 4. AI 哪里不像我 / 我会怎么改（我写）");
      if (!question || !aiAnswer) throw new Error(`Incomplete case structure: ${id}`);
      return { id, question, aiAnswer };
    });
}

function between(text: string, startHeading: string, endHeading: string) {
  const start = text.indexOf(startHeading);
  const end = text.indexOf(endHeading, start + startHeading.length);
  if (start < 0 || end < 0) return "";
  return text.slice(start + startHeading.length, end).trim();
}

function betweenWithHeading(text: string, startHeading: string, endHeading: string) {
  const start = text.indexOf(startHeading);
  const end = text.indexOf(endHeading, start + startHeading.length);
  if (start < 0 || end < 0) return "";
  return text.slice(start, end).trimEnd();
}

function replaceOnce(text: string, target: string, replacement: string, id: string) {
  const first = text.indexOf(target);
  if (first < 0) throw new Error(`Could not locate original AI block for ${id}.`);
  if (text.indexOf(target, first + target.length) >= 0) {
    throw new Error(`Original AI block for ${id} is not unique.`);
  }
  return text.slice(0, first) + replacement + text.slice(first + target.length);
}

async function generateAnswer(systemPrompt: string, question: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: question },
          ],
          temperature: 0.35,
          max_tokens: 1400,
          stream: false,
          thinking: { type: "disabled" },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(data?.error?.message || data?.message || `HTTP ${response.status}`));
      }
      const answer = String(data?.choices?.[0]?.message?.content || "").trim();
      if (!answer) throw new Error("Model returned an empty answer.");
      return normalizeHaiVoiceFormatting(answer);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError;
}

function valueAfter(flag: string) {
  const index = Deno.args.indexOf(flag);
  return index >= 0 ? Deno.args[index + 1] : undefined;
}
