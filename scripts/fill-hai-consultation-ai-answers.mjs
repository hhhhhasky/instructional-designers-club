import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const CORPUS_DIR = join(ROOT, "docs", "hai-consultation-corpus");
const CACHE_PATH = join(ROOT, "docs", "hai-optimization-runs", "hai-consultation-live-answer-cache.json");
const MODULE_SLUG = process.env.HAI_CORPUS_MODULE_SLUG || "ask-han";
const EVAL_EMAIL = process.env.HAI_CORPUS_EVAL_EMAIL || "hai-corpus+club-site@hasky.top";
const EVAL_PASSWORD = process.env.HAI_CORPUS_EVAL_PASSWORD || `HaiCorpus-${crypto.randomUUID()}-2026`;
const LIMIT = Number(process.env.HAI_CORPUS_LIMIT || "0");
const START_AT = process.env.HAI_CORPUS_START_AT || "";

loadEnv(".env");
loadEnv(".env.upload");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase env. Need SUPABASE_URL/VITE_SUPABASE_URL, anon key, and service role key.");
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

await main();

async function main() {
  let moduleBeforeRun = null;
  const files = await corpusFiles();
  const cases = [];
  for (const file of files) cases.push(...extractCases(file, await readFile(file, "utf8")));
  const selected = selectCases(cases);
  const cache = loadCache();
  const evalUser = await ensureEvalUser();
  const accessToken = await signInEvalUser();
  try {
    moduleBeforeRun = await loadAskHanModule();
    if (!moduleBeforeRun.is_enabled) await setModuleEnabled(true);
    const module = await loadAskHanModule();
    const runtimeSettings = await loadRuntimeSettings();

    console.log(`Found ${cases.length} corpus cases. Selected ${selected.length}.`);
    console.log(`Using HAI module ${module.slug}, model ${module.default_model || "(module default missing)"}.`);
    console.log(`Runtime settings: ${runtimeSettings.map((item) => `${item.key}=${JSON.stringify(item.value)}`).join("; ")}`);

    for (const item of selected) {
      const cacheKey = `${item.id}|${item.question}`;
      if (!cache.answers[cacheKey]) {
        console.log(`Calling live HAI ${item.id}: ${item.question}`);
        await clearEvalUserMemory(evalUser.id);
        const live = await callHai(item.question, accessToken);
        if (!live.answer.trim()) throw new Error(`Empty HAI answer for ${item.id}`);
        cache.answers[cacheKey] = {
          id: item.id,
          file: item.file.replace(`${ROOT}/`, ""),
          question: item.question,
          answer: live.answer.trim(),
          conversationId: live.conversationId,
          messageId: live.messageId,
          trace: live.trace,
          createdAt: new Date().toISOString(),
        };
        saveCache(cache);
      } else {
        console.log(`Using cached live answer ${item.id}`);
      }
    }

    const byFile = new Map();
    for (const item of cases) {
      const cacheKey = `${item.id}|${item.question}`;
      const cached = cache.answers[cacheKey];
      if (!cached?.answer) continue;
      if (!byFile.has(item.file)) byFile.set(item.file, []);
      byFile.get(item.file).push({ ...item, answer: cached.answer });
    }

    let replacementCount = 0;
    for (const file of files) {
      const replacements = byFile.get(file) ?? [];
      if (replacements.length === 0) continue;
      let text = await readFile(file, "utf8");
      for (const item of replacements) {
        const next = replaceAiAnswer(text, item);
        if (next === text && !text.includes(`### 3. AI 原始回答（AI写）\n\n${item.answer}\n\n### 4. AI 哪里不像我 / 我会怎么改（我写）`)) {
          throw new Error(`Failed to replace ${item.id} in ${file}`);
        }
        text = next;
        replacementCount += 1;
      }
      await writeFile(file, text);
    }

    const check = await structuralCheck(files);
    console.log(`Replaced ${replacementCount} AI answer sections.`);
    console.log(JSON.stringify(check, null, 2));
    if (check.total !== cases.length || check.emptyAiCount > 0) {
      throw new Error(`Structural check failed: ${JSON.stringify(check)}`);
    }
  } finally {
    if (moduleBeforeRun && moduleBeforeRun.is_enabled === false) await setModuleEnabled(false);
  }
}

async function corpusFiles() {
  const { readdir } = await import("node:fs/promises");
  return (await readdir(CORPUS_DIR))
    .filter((name) => /^\d{2}-.+\.md$/.test(name))
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"))
    .map((name) => join(CORPUS_DIR, name));
}

function extractCases(file, text) {
  const blocks = text.split(/\n(?=## Q\d{3}｜)/g).filter((block) => /^## Q\d{3}｜/.test(block));
  return blocks.map((block) => {
    const id = block.match(/^## (Q\d{3})｜/)?.[1];
    const question = block.match(/### 1\. 用户原始问题\s*\n\n([\s\S]*?)\n\n### 2\. 哈老师真实回答/)?.[1]?.trim();
    if (!id || !question) throw new Error(`Unable to parse case in ${file}`);
    return { id, file, question };
  });
}

function selectCases(cases) {
  let selected = cases;
  if (START_AT) {
    const index = selected.findIndex((item) => item.id === START_AT);
    if (index < 0) throw new Error(`HAI_CORPUS_START_AT ${START_AT} not found.`);
    selected = selected.slice(index);
  }
  if (LIMIT > 0) selected = selected.slice(0, LIMIT);
  return selected;
}

function replaceAiAnswer(text, item) {
  const marker = `## ${item.id}｜`;
  const start = text.indexOf(marker);
  if (start < 0) throw new Error(`Missing marker ${marker}`);
  const nextStart = text.indexOf("\n## Q", start + marker.length);
  const end = nextStart < 0 ? text.length : nextStart;
  const block = text.slice(start, end);
  const replacedBlock = block.replace(
    /(### 3\. AI 原始回答（AI写）\n\n)[\s\S]*?(\n\n### 4\. AI 哪里不像我 \/ 我会怎么改（我写）)/,
    `$1${item.answer}$2`,
  );
  if (replacedBlock === block) return text;
  return `${text.slice(0, start)}${replacedBlock}${text.slice(end)}`;
}

async function ensureEvalUser() {
  const existing = await findUserByEmail(EVAL_EMAIL);
  let user = existing;
  if (user) {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password: EVAL_PASSWORD,
      email_confirm: true,
      user_metadata: { purpose: "hai_consultation_corpus_fill" },
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: EVAL_EMAIL,
      password: EVAL_PASSWORD,
      email_confirm: true,
      user_metadata: { purpose: "hai_consultation_corpus_fill" },
    });
    if (error) throw error;
    user = data.user;
  }

  const { error: accessError } = await admin.from("hai_user_access").upsert({
    user_id: user.id,
    status: "active",
    access_source: "admin",
    quota_policy_key: "internal",
    granted_at: new Date().toISOString(),
    notes: "Automated HAI consultation corpus fill user.",
  });
  if (accessError) throw accessError;
  return user;
}

async function findUserByEmail(email) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 1000) return null;
    page += 1;
  }
  return null;
}

async function signInEvalUser() {
  const { data, error } = await anon.auth.signInWithPassword({
    email: EVAL_EMAIL,
    password: EVAL_PASSWORD,
  });
  if (error) throw error;
  if (!data.session?.access_token) throw new Error("Eval user sign-in did not return an access token.");
  return data.session.access_token;
}

async function loadAskHanModule() {
  const { data, error } = await admin
    .from("hai_feature_modules")
    .select("id, slug, name, is_enabled, default_model, default_temperature, default_max_output_tokens, default_top_p")
    .eq("slug", MODULE_SLUG)
    .single();
  if (error) throw error;
  return data;
}

async function setModuleEnabled(isEnabled) {
  const { error } = await admin
    .from("hai_feature_modules")
    .update({ is_enabled: isEnabled })
    .eq("slug", MODULE_SLUG);
  if (error) throw error;
  console.log(`${isEnabled ? "Temporarily enabled" : "Restored disabled state for"} HAI module ${MODULE_SLUG}.`);
}

async function loadRuntimeSettings() {
  const keys = [
    "context.orchestrator_enabled",
    "orchestrator.case_max",
    "orchestrator.method_max",
    "orchestrator.theory_max",
    "orchestrator.expression_max",
    "evaluator.enabled",
    "evaluator.pass_score",
    "evaluator.max_rewrites",
  ];
  const { data, error } = await admin
    .from("hai_runtime_settings")
    .select("key, value, enabled")
    .in("key", keys)
    .order("key", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function clearEvalUserMemory(userId) {
  const { error } = await admin.from("hai_user_memories").delete().eq("user_id", userId);
  if (error) throw error;
}

async function callHai(message, accessToken) {
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/hai-chat`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      conversationId: null,
      moduleSlug: MODULE_SLUG,
      message,
      mode: "chat",
      clientRequestId: crypto.randomUUID(),
    }),
  });
  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "");
    throw new Error(`HAI request failed ${response.status}: ${body}`);
  }
  const events = await readSseEvents(response.body);
  const errorEvent = events.find((event) => event.type === "error");
  if (errorEvent) throw new Error(`HAI stream error: ${errorEvent.message || JSON.stringify(errorEvent)}`);
  const answer = events.filter((event) => event.type === "token").map((event) => event.token).join("");
  const done = events.find((event) => event.type === "done");
  const trace = done?.messageId ? await loadTrace(done.messageId) : null;
  return {
    answer,
    conversationId: done?.conversationId ?? null,
    messageId: done?.messageId ?? null,
    trace,
  };
}

async function readSseEvents(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((item) => item.startsWith("data: "));
      if (!line) continue;
      events.push(JSON.parse(line.slice(6)));
    }
  }
  return events;
}

async function loadTrace(messageId) {
  const { data, error } = await admin
    .from("hai_messages")
    .select("metadata")
    .eq("id", messageId)
    .maybeSingle();
  if (error) throw error;
  return data?.metadata?.hai_context_trace ?? null;
}

async function structuralCheck(files) {
  let total = 0;
  let emptyAiCount = 0;
  let touchedHumanCount = 0;
  for (const file of files) {
    const text = await readFile(file, "utf8");
    const blocks = text.split(/\n(?=## Q\d{3}｜)/g).filter((block) => /^## Q\d{3}｜/.test(block));
    for (const block of blocks) {
      total += 1;
      const ai = block.match(/### 3\. AI 原始回答（AI写）\s*\n\n([\s\S]*?)\n\n### 4\. AI 哪里不像我 \/ 我会怎么改（我写）/)?.[1]?.trim() ?? "";
      const human = block.match(/### 2\. 哈老师真实回答（我写）\s*\n\n([\s\S]*?)\n\n### 3\. AI 原始回答/)?.[1]?.trim() ?? "";
      const diff = block.match(/### 4\. AI 哪里不像我 \/ 我会怎么改（我写）\s*\n\n([\s\S]*?)\n\n### 5\. 可沉淀的咨询逻辑 \/ 表达特征/)?.[1]?.trim() ?? "";
      const logic = block.match(/### 5\. 可沉淀的咨询逻辑 \/ 表达特征\s*\n\n([\s\S]*?)\s*$/)?.[1]?.trim() ?? "";
      if (!ai) emptyAiCount += 1;
      if (human || diff || logic) touchedHumanCount += 1;
    }
  }
  return { total, emptyAiCount, touchedHumanCount };
}

function loadCache() {
  if (!existsSync(CACHE_PATH)) return { answers: {} };
  const parsed = JSON.parse(readFileSync(CACHE_PATH, "utf8"));
  return { answers: parsed.answers ?? {} };
}

function saveCache(cache) {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);
}

function loadEnv(path) {
  const fullPath = join(ROOT, path);
  if (!existsSync(fullPath)) return;
  const text = readFileSync(fullPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}
