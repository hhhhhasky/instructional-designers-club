import {
  handleCors,
  HttpError,
  jsonResponse,
  requireUser,
} from "../_shared/hai.ts";
import { hanCourseMethodCards } from "../_shared/hai_orchestrator/knowledge/method_bank/han_course_method_cards.ts";

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    if (request.method !== "POST") {
      throw new HttpError(405, "只支持 POST。");
    }
    const auth = await requireUser(request);
    const { data: profile, error: profileError } = await auth.admin
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profileError) throw new HttpError(500, profileError.message);
    if (profile?.role !== "admin") {
      throw new HttpError(403, "仅管理员可以读取 HAI 方法卡配置。");
    }

    const { data, error } = await auth.admin
      .from("hai_method_card_configs")
      .select(
        "id, name, aliases, course, kind, ownership, priority, summary, use_when, avoid_when, core_judgement, moves, answer_focus, query_terms, intents, related, source_refs, enabled, is_deleted, updated_at, created_at",
      )
      .order("priority", { ascending: false })
      .order("id", { ascending: true });
    if (error) throw new HttpError(500, error.message);

    return jsonResponse({
      default_cards: hanCourseMethodCards,
      override_rows: data ?? [],
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error
      ? error.message
      : "读取 HAI 方法卡失败。";
    return jsonResponse({ message }, status);
  }
});
