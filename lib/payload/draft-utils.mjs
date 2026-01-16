function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDraftStatusValue(value) {
  if (value === "draft") return true;
  if (Array.isArray(value)) return value.some(isDraftStatusValue);
  if (!isPlainObject(value)) return false;
  if (Object.prototype.hasOwnProperty.call(value, "equals") && value.equals === "draft") {
    return true;
  }
  if (Object.prototype.hasOwnProperty.call(value, "in") && Array.isArray(value.in)) {
    return value.in.includes("draft");
  }
  return false;
}

function hasDraftStatusFilter(where) {
  if (where === undefined || where === null) return false;
  if (isDraftStatusValue(where)) return true;
  if (Array.isArray(where)) return where.some(hasDraftStatusFilter);
  if (!isPlainObject(where)) return false;
  for (const [key, value] of Object.entries(where)) {
    if (key === "_status") {
      if (isDraftStatusValue(value) || hasDraftStatusFilter(value)) return true;
      continue;
    }
    if (key === "and" || key === "or") {
      if (Array.isArray(value) && value.some(hasDraftStatusFilter)) return true;
    }
    if (hasDraftStatusFilter(value)) return true;
  }
  return false;
}

function resolveDraft({ status, draft, where } = {}) {
  if (status === "draft") return true;
  if (hasDraftStatusFilter(where)) return true;
  return draft;
}

export { resolveDraft, hasDraftStatusFilter };
