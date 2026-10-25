import 'server-only';

/**
 * A log-safe description of an error for server logs. Database and Realtime error messages can
 * embed private data — a draft title, the SQL text, bound parameters, even connection details — so
 * we never log `e.message`. We log only the error's class name and, when present, a Postgres
 * SQLSTATE code (a fixed five-character token that carries no private content).
 */
export function safeError(e: unknown): string {
  const name = e instanceof Error ? e.name : typeof e;
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^[0-9A-Za-z]{5}$/.test(code) ? `${name} (${code})` : name;
}
