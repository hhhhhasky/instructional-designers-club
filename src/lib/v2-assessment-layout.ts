import type { V2DictionaryItem, V2LessonBundle } from "@/db/v2-api";

type V2Assessment = V2LessonBundle["assessments"][number];

export interface V2AssessmentGroup {
  key: string;
  label: string;
  assessments: V2Assessment[];
}

export interface V2AssessmentLayout {
  beforeContent: V2AssessmentGroup[];
  afterContent: V2AssessmentGroup[];
  afterLearning: V2AssessmentGroup[];
}

const ASSESSMENT_ORDER: Record<string, number> = {
  pretest: 10,
  practice: 20,
  posttest: 30,
  authentic_task: 40,
};

function placementFor(key: string): keyof V2AssessmentLayout {
  if (key === "pretest") return "beforeContent";
  if (key === "practice") return "afterContent";
  return "afterLearning";
}

export function buildV2AssessmentLayout(
  assessments: V2Assessment[],
  dictionaryItems: V2DictionaryItem[],
): V2AssessmentLayout {
  const dictionaryById = new Map(dictionaryItems.map((item) => [item.id, item]));
  const groups = new Map<string, V2AssessmentGroup & { order: number; placement: keyof V2AssessmentLayout }>();

  assessments.forEach((assessment, index) => {
    const type = assessment.assessment_type_id
      ? dictionaryById.get(assessment.assessment_type_id)
      : undefined;
    const key = type?.key ?? `untyped-${assessment.id}`;
    const groupKey = type?.id ?? key;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.assessments.push(assessment);
      return;
    }
    groups.set(groupKey, {
      key,
      label: type?.label ?? "评估任务",
      assessments: [assessment],
      order: ASSESSMENT_ORDER[key] ?? 100 + index,
      placement: placementFor(key),
    });
  });

  const layout: V2AssessmentLayout = {
    beforeContent: [],
    afterContent: [],
    afterLearning: [],
  };
  [...groups.values()]
    .sort((left, right) => left.order - right.order)
    .forEach(({ placement, order: _order, ...group }) => {
      layout[placement].push(group);
    });
  return layout;
}
