// Does this device or the signed-in account already hold a copy of a public trip? Plain JSON reads of the two lists, no schema: this runs
// on every public trip page for a person who has copies, in a lazy chunk, and must stay light (P1, P8). A list this cannot read gives no
// line (the copy sheet and Mine are where a damaged list is reported). Pure over a minimal storage so a test passes a memory one.
import { ACCT_KEY_PREFIX, COPIES_KEY } from '@/lib/mine/keys';

/** The slice of `Storage` it uses. */
export interface KeyedStorage {
  readonly length: number;
  key(i: number): string | null;
  getItem(k: string): string | null;
}

const parse = (raw: string | null): unknown => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const items = (x: unknown, field: string): Record<string, unknown>[] => {
  const list = x && typeof x === 'object' ? (x as Record<string, unknown>)[field] : null;
  return Array.isArray(list) ? list.filter((i): i is Record<string, unknown> => !!i && typeof i === 'object') : [];
};

/** A copy id, as `randomUUID()` makes it (the link goes to `/t/<id>/`, which answers notFound() for anything else). */
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The id of the newest copy of `slug` on this device (`copies/1` or `/2`), else in an account cache on this device (a trip not removed and
 * not waiting for its tombstone), else null.
 */
export function findCopyId(s: KeyedStorage, slug: string): string | null {
  try {
    const here = items(parse(s.getItem(COPIES_KEY)), 'items')
      .filter((c) => c.slug === slug && typeof c.id === 'string' && ID.test(c.id))
      .sort((a, b) => (Date.parse(String(b.copiedAt)) || 0) - (Date.parse(String(a.copiedAt)) || 0));
    if (here[0]) return here[0].id as string;
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (!k?.startsWith(ACCT_KEY_PREFIX)) continue;
      const row = items(parse(s.getItem(k)), 'rows').find((r) => r.source_trip === slug && !r.deleted_at && !r.removing && typeof r.id === 'string' && ID.test(r.id));
      if (row) return row.id as string;
    }
  } catch {
    /* an unreadable store gives no line */
  }
  return null;
}
