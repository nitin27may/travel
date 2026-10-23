import { privacyHits, type Hit } from '@travel/core/privacy/detect.ts';

// The privacy detector lives in core (core/src/privacy/detect.ts: one list for respond(), the contract kit and the web privacy test).
export { privacyHits };
export type { Hit };

/** The first key outside the allowlist in any row of a paged answer, or null: rows carry exactly the contract's keys (P8, case K2). */
export function rowOutsideAllowlist(items: unknown, allowed: ReadonlySet<string>): string | null {
  if (!Array.isArray(items)) return null;
  for (const row of items) {
    if (row && typeof row === 'object') for (const k of Object.keys(row)) if (!allowed.has(k)) return k;
  }
  return null;
}
