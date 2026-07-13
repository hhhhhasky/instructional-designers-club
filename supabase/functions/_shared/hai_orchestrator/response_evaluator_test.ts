import { evaluateResponse } from "./response_evaluator.ts";
import type { HAIContextPackage } from "./types.ts";

const context = {} as HAIContextPackage;

Deno.test("evaluator rejects invented personal consultation experience", () => {
  for (
    const answer of [
      "这个问题我遇到过很多次。",
      "这个问题我太熟悉了。",
      "我见过很多老师都这样备课。",
    ]
  ) {
    const result = evaluateResponse(answer, context);
    if (result.pass) throw new Error(`should reject: ${answer}`);
    if (!result.problems.some((item) => item.includes("亲身经历"))) {
      throw new Error(`missing invented-experience violation: ${answer}`);
    }
  }
});

Deno.test("evaluator allows personal judgement without invented experience", () => {
  const result = evaluateResponse(
    "我的看法是，先检查目标和评价证据是否对齐。",
    context,
  );
  if (!result.pass) throw new Error(result.problems.join("；"));
});
