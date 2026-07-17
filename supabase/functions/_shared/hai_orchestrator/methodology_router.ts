import {
  getHanMethodCard,
  hanCourseMethodCards,
  type HanMethodCard,
  methodIntentTagFor,
} from "./knowledge/method_bank/han_course_method_cards.ts";
import type {
  IntentResult,
  ProblemRewrite,
  SemanticRouteResult,
} from "./types.ts";

export type HanMethodologySelection = {
  cards: HanMethodCard[];
  focus: string;
  reason: string;
};

export function selectHanMethodology(params: {
  question: string;
  intent: IntentResult;
  rewrite: ProblemRewrite;
  semanticRoute?: SemanticRouteResult | null;
  maxMethods?: number;
  methodCards?: HanMethodCard[];
}): HanMethodologySelection {
  const methodCards = params.methodCards ?? hanCourseMethodCards;
  const maxMethods = Math.max(
    0,
    Math.min(2, Math.round(params.maxMethods ?? 1)),
  );
  if (maxMethods === 0) {
    return {
      cards: [],
      reason: "当前运行配置关闭了课程方法卡选择。",
      focus:
        "当前运行配置关闭了课程方法卡选择，不得声称本轮调用了哈老师课程方法。",
    };
  }
  const preferredIds = params.semanticRoute?.methodology_ids ?? [];
  const preferredCards = uniqueCards(
    preferredIds
      .map((id) => getHanMethodCard(id, methodCards))
      .filter((card): card is HanMethodCard => Boolean(card)),
  );
  const cards = preferredCards.length > 0
    ? preferredCards.slice(0, maxMethods)
    : selectFallbackCards(
      params.question,
      params.intent,
      params.rewrite,
      1,
      methodCards,
    );

  if (cards.length === 0) {
    return {
      cards: [],
      reason: "当前问题没有命中已确认的教学通识课方法卡。",
      focus: `本轮没有命中已确认的教学通识课方法卡。
可以使用诊断框架和通用教学常识回答，但不得编造哈老师的课程名称、方法、个人经历或课程结论。
如果问题依赖具体教材、课文、课标或学生证据，材料不足时先说明边界。`,
    };
  }

  const main = cards[0];
  const secondary = cards[1];
  const semanticReason = params.semanticRoute?.methodology_reason?.trim();
  const reason = semanticReason || `当前问题与“${main.name}”的适用情境最匹配。`;
  const secondaryText = secondary
    ? `辅助方法只允许一句带过：${secondary.name}。只有主方法无法解释必要依赖时才提，不展开第二套步骤。`
    : "不要再叠加第二套课程框架。";
  const namingRequirement = main.id === "lesson-preparation-design-master"
    ? "总方法论名称是稳定术语。最终回答必须原样出现“备课流程＋教学设计框架”，不能改写成备课步骤、教案要素或其他近义说法。"
    : "最终回答要自然出现方法名称或标志性核心术语。";

  return {
    cards,
    reason,
    focus: `本轮主方法：${main.name}
所属课程：${main.course}
选择理由：${reason}
核心判断：${main.coreJudgement}
可用动作：${main.moves.join("；")}
回答聚焦：${main.answerFocus}
来源边界：${
      main.ownership === "han_course"
        ? "哈老师课程原创或课程内稳定使用的方法"
        : main.ownership === "course_adapted_theory"
        ? "哈老师课程吸收并改造使用的理论或方法，不要说成哈老师原创理论"
        : "来自哈老师真实咨询反馈校准"
    }。
${secondaryText}
${namingRequirement}
回答必须真正用这个方法完成判断和建议，不能只报方法名称。本轮已经确认方法与问题匹配，课程出处句不可省略，回答中必须完整出现课程名“${main.course}”，并自然说明这个方法来自我的这门或这一篇课程。只说明来源，不介绍或推销课程。`,
  };
}

function selectFallbackCards(
  question: string,
  intent: IntentResult,
  rewrite: ProblemRewrite,
  maxMethods: number,
  methodCards: HanMethodCard[],
) {
  const haystack = normalize(
    [
      question,
      intent.explicit_need,
      intent.implicit_need,
      rewrite.surface_problem,
      rewrite.deeper_problem,
      rewrite.hai_reframing,
      rewrite.recommended_answer_direction,
    ].filter(Boolean).join(" "),
  );

  return methodCards
    .map((card) => {
      let termMatches = 0;
      let score = 0;
      for (const term of [card.name, ...card.aliases, ...card.queryTerms]) {
        if (!term || !haystack.includes(normalize(term))) continue;
        termMatches += 1;
        score += term === card.name || card.aliases.includes(term) ? 12 : 8;
      }
      if (card.intents.includes(methodIntentTagFor(intent.primary_intent))) {
        score += 3;
      }
      score += card.priority / 100;
      return { card, score, termMatches };
    })
    .filter((item) => item.termMatches > 0)
    .sort((a, b) => b.score - a.score || b.card.priority - a.card.priority)
    .slice(0, maxMethods)
    .map((item) => item.card);
}

function uniqueCards(cards: HanMethodCard[]) {
  const seen = new Set<string>();
  return cards.filter((card) => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
}

function normalize(text: string) {
  return text.toLowerCase().replace(
    /[\s，。！？、；：,.!?;:'"“”‘’（）()\-_]/g,
    "",
  );
}
