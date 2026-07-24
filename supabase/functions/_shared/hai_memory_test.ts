import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { assertEquals } from "jsr:@std/assert@1";
import {
  extractExplicitMemoryCandidates,
  rememberExplicitTeacherFacts,
} from "./hai.ts";

type MemoryRow = {
  id: string;
  user_id: string;
  category: string;
  content: string;
  source_type: string | null;
  status: "active" | "candidate" | "archived";
  confidence?: number;
};

Deno.test("automatic memory ignores statements without an explicit remember instruction", () => {
  assertEquals(extractExplicitMemoryCandidates("我教八年级语文。"), []);
  assertEquals(extractExplicitMemoryCandidates("我的学生基础比较薄弱。"), []);
  assertEquals(extractExplicitMemoryCandidates("我的偏好是先给结论。"), []);
  assertEquals(extractExplicitMemoryCandidates("现在的问题是公开课时间不够。"), []);
  assertEquals(extractExplicitMemoryCandidates("我以后可能教高中语文。"), []);
});

Deno.test("automatic memory extracts only explicit facts and future response rules", () => {
  assertEquals(
    extractExplicitMemoryCandidates("请记住，我教八年级语文。"),
    [{
      category: "basic_info",
      content: "这位老师教八年级语文。",
      confidence: 0.98,
      slot: "teaching_assignment",
      intent: "remember",
    }],
  );
  assertEquals(
    extractExplicitMemoryCandidates("请你记住，我是高中数学老师。")[0]?.content,
    "这位老师教高中数学。",
  );
  assertEquals(
    extractExplicitMemoryCandidates("以后按此处理：先给结论，再问一个关键问题。"),
    [{
      category: "teaching_preference",
      content: "这位老师希望 HAI 以后按此处理：先给结论，再问一个关键问题。",
      confidence: 0.98,
      slot: "response_preference",
      intent: "future_rule",
    }],
  );
});

Deno.test("automatic memory records a new explicit fact with auditable provenance", async () => {
  const store = createMemoryStore([]);

  await rememberExplicitTeacherFacts(
    store.client,
    "user-1",
    "请记住，我的学生基础比较薄弱。",
  );

  assertEquals(store.rows, [{
    id: "memory-1",
    user_id: "user-1",
    category: "student_view",
    content: "这位老师的学生基础比较薄弱。",
    confidence: 0.98,
    source_type: "chat_explicit_v2:remember:new",
    status: "active",
  }]);
});

Deno.test("automatic memory replaces an older automatic fact in the same slot", async () => {
  const store = createMemoryStore([{
    id: "old-memory",
    user_id: "user-1",
    category: "basic_info",
    content: "这位老师教七年级语文。",
    source_type: "chat_explicit",
    status: "active",
  }]);

  await rememberExplicitTeacherFacts(
    store.client,
    "user-1",
    "请记住，我教八年级语文。",
  );

  assertEquals(store.rows[0].status, "archived");
  assertEquals(store.rows[1], {
    id: "memory-2",
    user_id: "user-1",
    category: "basic_info",
    content: "这位老师教八年级语文。",
    confidence: 0.98,
    source_type: "chat_explicit_v2:remember:update",
    status: "active",
  });
});

Deno.test("automatic memory preserves manual facts and stores conflicts as candidates", async () => {
  const store = createMemoryStore([{
    id: "manual-memory",
    user_id: "user-1",
    category: "teaching_preference",
    content: "这位老师希望 HAI 先追问背景。",
    source_type: "manual",
    status: "active",
  }]);

  await rememberExplicitTeacherFacts(
    store.client,
    "user-1",
    "请记住，我希望你先给结论。",
  );

  assertEquals(store.rows[0].status, "active");
  assertEquals(store.rows[1], {
    id: "memory-2",
    user_id: "user-1",
    category: "teaching_preference",
    content: "这位老师希望 HAI 先给结论。",
    confidence: 0.98,
    source_type: "chat_explicit_v2:remember:conflict",
    status: "candidate",
  });
});

function createMemoryStore(initialRows: MemoryRow[]) {
  const rows = initialRows.map((row) => ({ ...row }));
  const client = {
    from(table: string) {
      if (table !== "hai_user_memories") {
        throw new Error(`unexpected table: ${table}`);
      }
      const filters: Array<(row: MemoryRow) => boolean> = [];
      const query = {
        select() {
          return query;
        },
        eq(column: keyof MemoryRow, value: unknown) {
          filters.push((row) => row[column] === value);
          return query;
        },
        neq(column: keyof MemoryRow, value: unknown) {
          filters.push((row) => row[column] !== value);
          return query;
        },
        limit() {
          return Promise.resolve({
            data: rows.filter((row) => filters.every((filter) => filter(row))),
            error: null,
          });
        },
        update(value: Pick<MemoryRow, "status">) {
          return {
            in(_column: "id", ids: string[]) {
              for (const row of rows) {
                if (ids.includes(row.id)) row.status = value.status;
              }
              return Promise.resolve({ error: null });
            },
          };
        },
        insert(value: Omit<MemoryRow, "id">) {
          rows.push({
            id: `memory-${rows.length + 1}`,
            ...value,
          });
          return Promise.resolve({ error: null });
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;

  return { client, rows };
}
