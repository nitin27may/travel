// The result envelope every CatalogueStore method returns (EXECUTION-PLAN 4.2): `{ok:true, data, revision}` or `{ok:false, error}`.
// A store never throws for a request it can answer with a code; a throw is a bug, and `respond()` (API-1b) maps it to `internal`.
import { API_ERROR_STATUS, type ApiError, type ApiErrorCode, type Result } from "../schema/api/common.ts";

export type { ApiError, ApiErrorCode, Result } from "../schema/api/common.ts";

export const ok = <T>(data: T, revision: string): Result<T> => ({ ok: true, data, revision });

export const fail = <T = never>(code: ApiErrorCode, message: string, details?: Record<string, unknown>): Result<T> => ({
  ok: false,
  error: details ? { code, message, details } : { code, message },
});

/** The HTTP status of an error code: 400, 400, 404, 413, 501, 500. */
export const httpStatus = (code: ApiErrorCode): number => API_ERROR_STATUS[code];

/** The data of a result, or a throw naming the error: for tests and build-time callers that cannot go on without the data. */
export function unwrap<T>(r: Result<T>): T {
  if (r.ok) return r.data;
  throw new Error(`${r.error.code}: ${r.error.message}`);
}

export const isError = (r: Result<unknown>, code?: ApiErrorCode): r is { ok: false; error: ApiError } => !r.ok && (code === undefined || r.error.code === code);
