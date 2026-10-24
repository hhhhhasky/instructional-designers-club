// Shared by the Edge planner and browser reader; no runtime/provider dependencies.
export type CoursewareSourceMapping = {
  section: string;
  task: string;
  sourceExcerpt: string;
};
export type CoursewareMaterialProvenance = {
  sourceType:
    | "lesson_plan"
    | "textbook"
    | "user_material"
    | "case_library"
    | "generated_adaptation";
  sourceTitle: string;
  fidelity: "verbatim" | "adapted" | "generated";
  verification: "verified" | "needs_review";
  teachingPurpose: string;
};
export type CoursewareVisual = {
  kind:
    | "photo"
    | "illustration"
    | "mind_map"
    | "concept_map"
    | "structure_diagram"
    | "flowchart"
    | "venn";
  purpose: string;
  description: string;
  sourceExcerpt: string;
  nodes: Array<{ id: string; label: string; items: string[] }>;
  edges: Array<
    {
      from: string;
      to: string;
      relation:
        | "link"
        | "contains"
        | "subset"
        | "proper_subset"
        | "equal"
        | "overlap"
        | "disjoint";
      label: string;
    }
  >;
  intersectionItems: string[];
};
type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue
    : {};
export const displayText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";
export const displayItems = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(displayText).filter(Boolean) : [];

export function readSourceMapping(
  value: unknown,
): CoursewareSourceMapping | undefined {
  const raw = object(value);
  return displayText(raw.section)
    ? {
      section: displayText(raw.section),
      task: displayText(raw.task),
      sourceExcerpt: displayText(raw.sourceExcerpt),
    }
    : undefined;
}

export function readCoursewareMaterialProvenance(
  value: unknown,
): CoursewareMaterialProvenance | undefined {
  if (value == null) return undefined;
  const raw = object(value);
  const sourceTypes = [
    "lesson_plan",
    "textbook",
    "user_material",
    "case_library",
    "generated_adaptation",
  ];
  const fidelities = ["verbatim", "adapted", "generated"];
  const verifications = ["verified", "needs_review"];
  if (
    !sourceTypes.includes(String(raw.sourceType)) ||
    !fidelities.includes(String(raw.fidelity)) ||
    !verifications.includes(String(raw.verification))
  ) return undefined;
  return {
    sourceType: raw.sourceType as CoursewareMaterialProvenance["sourceType"],
    sourceTitle: displayText(raw.sourceTitle),
    fidelity: raw.fidelity as CoursewareMaterialProvenance["fidelity"],
    verification: raw
      .verification as CoursewareMaterialProvenance["verification"],
    teachingPurpose: displayText(raw.teachingPurpose),
  };
}

export function isTeacherComponent(value: unknown): boolean {
  const raw = object(value);
  return raw.audience === "teacher" ||
    [raw.variant, raw.role].some((item) =>
      typeof item === "string" &&
      /^(teacher[-_ ]?(note|notes|instruction|instructions)?|教师备注|教师说明)$/i
        .test(item)
    );
}

export function separateCoursewareAudience(
  components: unknown[],
  notes: unknown,
) {
  const teacherNotes = displayItems(notes);
  const studentComponents = components.filter((value) => {
    if (!isTeacherComponent(value)) return true;
    const raw = object(value);
    const note = [displayText(raw.text), ...displayItems(raw.items)].filter(
      Boolean,
    ).join("\n");
    if (note && !teacherNotes.includes(note)) teacherNotes.push(note);
    return false;
  });
  return { studentComponents, teacherNotes };
}

export function readCoursewareVisual(
  value: unknown,
  fallbackRelations: unknown[] = [],
): CoursewareVisual | undefined {
  if (value == null) return undefined;
  const raw = object(value);
  const kinds = [
    "photo",
    "illustration",
    "mind_map",
    "concept_map",
    "structure_diagram",
    "flowchart",
    "venn",
  ];
  if (!kinds.includes(String(raw.kind)) || !displayText(raw.description)) {
    throw new Error("配图需要合法 kind 和具体 description。");
  }
  let nodes = (Array.isArray(raw.nodes) ? raw.nodes : []).map((value) => {
    const node = object(value);
    if (!displayText(node.id) || !displayText(node.label)) {
      throw new Error("知识图示节点需要 id 和实际显示的 label。");
    }
    return {
      id: displayText(node.id),
      label: displayText(node.label),
      items: displayItems(node.items),
    };
  });
  const ids = new Set(nodes.map((node) => node.id));
  if (ids.size !== nodes.length) {
    throw new Error("同一图示的节点 id 不能重复。");
  }
  let edges = (Array.isArray(raw.edges) ? raw.edges : []).map((value) => {
    const edge = object(value);
    const relations = [
      "link",
      "contains",
      "subset",
      "proper_subset",
      "equal",
      "overlap",
      "disjoint",
    ];
    if (
      !ids.has(displayText(edge.from)) || !ids.has(displayText(edge.to)) ||
      !relations.includes(String(edge.relation))
    ) throw new Error("知识图示连线需要有效节点和明确 relation。");
    return {
      from: displayText(edge.from),
      to: displayText(edge.to),
      relation: edge.relation as CoursewareVisual["edges"][number]["relation"],
      label: displayText(edge.label),
    };
  });
  const isDiagram = !["photo", "illustration"].includes(String(raw.kind));
  if (isDiagram && String(raw.kind) !== "venn") {
    const relationEntries = fallbackRelations
      .map((value) => object(value))
      .map((entry) => ({
        label: displayText(entry.label || entry.title),
        value: displayText(entry.value || entry.description),
      }))
      .filter((entry) => entry.label);
    if (!nodes.length && relationEntries.length) {
      nodes = relationEntries.map((entry, index) => ({
        id: `relation-${index + 1}`,
        label: entry.label,
        items: entry.value ? [entry.value] : [],
      }));
    }
    if (nodes.length > 1 && !edges.length) {
      edges = nodes.slice(1).map((node, index) => ({
        from: nodes[index].id,
        to: node.id,
        relation: "link" as const,
        label: relationEntries[index + 1]?.value || "",
      }));
    }
  }
  if (isDiagram && (!nodes.length || (nodes.length > 1 && !edges.length))) {
    throw new Error("知识图示必须明确节点与关系。");
  }
  if (
    raw.kind === "venn" &&
    (nodes.length !== 2 || edges.length !== 1 ||
      !["subset", "proper_subset", "equal", "overlap", "disjoint"].includes(
        edges[0].relation,
      ))
  ) throw new Error("每张维恩图需要两个集合及一个明确的集合关系。");
  return {
    kind: raw.kind as CoursewareVisual["kind"],
    purpose: displayText(raw.purpose),
    description: displayText(raw.description),
    sourceExcerpt: displayText(raw.sourceExcerpt),
    nodes,
    edges,
    intersectionItems: displayItems(raw.intersectionItems),
  };
}
