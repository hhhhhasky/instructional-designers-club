import { readFileSync } from "node:fs";

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = "isjflmyhbvdlmcsaewbq";

if (!ACCESS_TOKEN) {
  console.error("❌ SUPABASE_ACCESS_TOKEN not set");
  process.exit(1);
}

const sql = readFileSync("supabase/migrations/20260705224000_manual_credits.sql", "utf-8");

// Strip comment lines (ones starting with --)
function stripComments(stmt) {
  return stmt
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .trim();
}

// Split into statements, respecting $$-quoted function bodies
function splitStatements(sql) {
  const statements = [];
  let current = "";
  let inDollar = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    current += ch;

    // Check for $$ opening/closing
    if (ch === "$" && sql[i + 1] === "$" && !inDollar) {
      inDollar = true;
      i++;
      current += "$";
    } else if (inDollar && ch === "$" && sql[i + 1] === "$") {
      inDollar = false;
      i++;
      current += "$";
    }

    if (ch === ";" && !inDollar) {
      const raw = current.trim();
      // Strip comments then check if there's actual SQL
      const clean = stripComments(raw);
      if (clean) {
        statements.push(raw); // keep original for debug display
      }
      current = "";
    }
  }

  // Final fragment
  const raw = current.trim();
  const clean = stripComments(raw);
  if (clean) {
    statements.push(raw);
  }

  return statements;
}

async function runQuery(query) {
  const clean = stripComments(query);
  if (!clean) return { success: true, skipped: true };

  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: clean }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  return { success: true };
}

const statements = splitStatements(sql);
console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  // Show first line of statement for progress
  const firstLine = stmt.split("\n")[0].trim().slice(0, 80);
  try {
    await runQuery(stmt);
    console.log(`✅ [${i + 1}/${statements.length}] ${firstLine}`);
  } catch (err) {
    console.error(`❌ [${i + 1}/${statements.length}] ${firstLine}`);
    console.error(`   ${err.message}`);
    process.exit(1);
  }
}

console.log(`\n🎉 Migration applied successfully!`);
