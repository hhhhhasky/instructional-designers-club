export type HaiTextbookHierarchySample = {
  subject?: string;
  unit_label?: string | null;
  lesson_label?: string | null;
  frame_label?: string | null;
};

export type HaiTextbookHierarchy = {
  top: string;
  middle: string;
  bottom: string;
  hasThirdLevel: boolean;
  guide: string;
};

function hasLabel(value: string | null | undefined, pattern: RegExp) {
  return pattern.test(value?.trim() || "");
}

function inferTopLabel(samples: HaiTextbookHierarchySample[]) {
  const labels = samples.map((item) => item.unit_label || "").join(" ");
  if (hasLabel(labels, /单课|课次/)) return "单课";
  if (hasLabel(labels, /章/)) return "章";
  return "单元";
}

function inferMiddleLabel(samples: HaiTextbookHierarchySample[], subject: string) {
  if (subject === "英语") return "课时 / 课题";
  const labels = samples.map((item) => item.lesson_label || "").join(" ");
  if (hasLabel(labels, /框题|框/)) return "框题";
  if (hasLabel(labels, /节/)) return "节";
  if (hasLabel(labels, /章/)) return "章";
  if (hasLabel(labels, /课时/)) return "课时";
  return "课题";
}

function inferBottomLabel(samples: HaiTextbookHierarchySample[], subject: string) {
  if (subject === "英语") return "教材证据";
  const labels = samples.map((item) => item.frame_label || "").join(" ");
  if (hasLabel(labels, /框题|框/)) return "框题";
  if (hasLabel(labels, /节/)) return "节";
  if (hasLabel(labels, /课题|课/)) return "课题";
  return "教材细目";
}

export function getHaiTextbookHierarchy(
  subject: string,
  samples: HaiTextbookHierarchySample[] = [],
): HaiTextbookHierarchy {
  const top = inferTopLabel(samples);
  const middle = inferMiddleLabel(samples, subject);
  const bottom = inferBottomLabel(samples, subject);
  const hasThirdLevel = subject === "英语"
    ? false
    : samples.length === 0 || samples.some((item) => Boolean(item.frame_label?.trim()));

  return {
    top,
    middle,
    bottom,
    hasThirdLevel,
    guide: `一级是教材范围（${top}），用于先确定教材中的大块内容；二级是具体教学内容（${middle}），用于选择本次要教的内容；三级是更细的教材细目（${bottom}），仅在教材确实有这一层时选择。没有三级目录时，二级内容本身就是最终课题。`,
  };
}
