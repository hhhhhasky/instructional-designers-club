import { strictEqual } from "node:assert";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { finalizeUsage } from "./hai.ts";

Deno.test("settlement uses the trusted client and binds the authenticated owner", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const adminClient = {
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return Promise.resolve({ error: null });
    },
  } as unknown as SupabaseClient;
  await finalizeUsage({
    adminClient, userId: "owner-1", requestId: "request-1", status: "completed",
    route: "hai-chat", inputTokens: 100, outputTokens: 20,
  });
  strictEqual(calls.length, 1);
  strictEqual(calls[0].name, "hai_finalize_usage_service");
  strictEqual(calls[0].args.p_user_id, "owner-1");
  strictEqual(calls[0].args.p_request_id, "request-1");
  strictEqual(calls[0].args.p_route, "hai-chat");
});
