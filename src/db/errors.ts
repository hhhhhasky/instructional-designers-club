export type DataErrorCode =
  | "permission"
  | "network"
  | "contract_missing"
  | "not_found"
  | "unknown";

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  status?: unknown;
};

const CONTRACT_MISSING_CODES = new Set([
  "42P01",
  "42883",
  "PGRST202",
  "PGRST204",
]);

export class DataAccessError extends Error {
  readonly code: DataErrorCode;
  readonly operation: string;
  readonly cause: unknown;

  constructor(operation: string, code: DataErrorCode, cause: unknown) {
    super(`${operation}失败：${readErrorMessage(cause)}`);
    this.name = "DataAccessError";
    this.operation = operation;
    this.code = code;
    this.cause = cause;
  }
}

export type DataResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: DataAccessError };

export function dataSuccess<T>(data: T): DataResult<T> {
  return { ok: true, data };
}

export function dataFailure<T>(
  operation: string,
  error: unknown,
): DataResult<T> {
  return { ok: false, error: toDataAccessError(operation, error) };
}

export function toDataAccessError(
  operation: string,
  error: unknown,
): DataAccessError {
  if (error instanceof DataAccessError) return error;
  const code = readErrorCode(error);
  const status = readErrorStatus(error);
  const message = readErrorMessage(error);

  if (CONTRACT_MISSING_CODES.has(code)) {
    return new DataAccessError(operation, "contract_missing", error);
  }
  if (status === 401 || status === 403 || code === "42501") {
    return new DataAccessError(operation, "permission", error);
  }
  if (status === 404 || code === "PGRST116") {
    return new DataAccessError(operation, "not_found", error);
  }
  if (
    /fetch|network|timeout|timed out|connection|load failed/i.test(message)
  ) {
    return new DataAccessError(operation, "network", error);
  }
  return new DataAccessError(operation, "unknown", error);
}

export function isMissingBackendContract(error: unknown): boolean {
  return toDataAccessError("后端契约检查", error).code === "contract_missing";
}

function readErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const value = (error as ErrorLike).code;
  return typeof value === "string" ? value : "";
}

function readErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const value = (error as ErrorLike).status;
  return typeof value === "number" ? value : null;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (!error || typeof error !== "object") return String(error || "未知错误");
  const candidate = error as ErrorLike;
  const parts = [candidate.message, candidate.details, candidate.hint]
    .filter((value): value is string =>
      typeof value === "string" && value.trim().length > 0
    );
  return parts.join("；") || "未知错误";
}
