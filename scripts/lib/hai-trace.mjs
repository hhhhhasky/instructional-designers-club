export function readHaiTrace(metadata) {
  const record = asRecord(metadata);
  if (!record) return null;

  const current = asRecord(record.hai_trace);
  if (current) {
    const skill = asRecord(current.skill);
    const version = asRecord(skill?.version);
    return {
      ...current,
      skill_id: text(skill?.id),
      skill_slug: text(skill?.slug),
      skill_version_id: text(version?.id),
      skill_version: text(version?.label),
      skill_snapshot_hash: text(version?.snapshot_hash),
      diagnostic_module: text(current.diagnostic_module),
      methodology_ids: strings(current.method_card_ids),
      reference_paths: records(current.references).map((item) => text(item.path)).filter(Boolean),
      reference_hashes: records(current.references).map((item) => text(item.content_hash)).filter(Boolean),
      retrieved_context_ids: [],
    };
  }

  const legacySkill = asRecord(record.hai_skill_trace);
  if (legacySkill) {
    return {
      ...legacySkill,
      question: text(legacySkill.question),
      intent_result: asRecord(legacySkill.intent_result),
      evaluation_result: asRecord(legacySkill.evaluation_result),
      methodology_ids: strings(legacySkill.method_card_ids),
      retrieved_context_ids: [],
    };
  }

  return asRecord(record.hai_context_trace);
}

export function hasHaiTrace(metadata) {
  return readHaiTrace(metadata) !== null;
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function records(value) {
  return Array.isArray(value) ? value.map(asRecord).filter(Boolean) : [];
}

function strings(value) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}
