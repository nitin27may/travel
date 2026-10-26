import type { CopyItem } from '@travel/core/schema/copies.ts';

/** What the catalogue says about one copy's trip now. `title` is the current name, to refresh a placeholder or a stale snapshot. */
export type Listing = { state: 'listed'; title: string | null } | { state: 'unlisted' };

/**
 * Where each copy's trip stands now, through `DataClient.resolveRefs` (FAV-1W, P9: one data boundary). A trip that is `withdrawn` or
 * `unknown` is "No longer listed"; `current`, `moved` and `merged` are listed. Resolves to null when the adapter cannot answer (static
 * build, server without the endpoint) or the request fails: the rows keep their stored snapshots and nothing is marked, so a failed
 * check never hides or removes a copy.
 */
export async function resolveListing(items: readonly CopyItem[]): Promise<Map<string, Listing> | null> {
  const slugs = [...new Set(items.map((i) => i.slug))].slice(0, 48);
  if (slugs.length === 0) return new Map();
  if (process.env.NODE_ENV !== 'production') {
    // dev builds only (dead code in a production build): lets a screenshot script put a row in the "No longer listed" state
    const hook = (window as unknown as { __mineListing?: (s: string[]) => Record<string, 'unlisted' | 'listed'> }).__mineListing;
    if (hook) return new Map(Object.entries(hook(slugs)).map(([k, v]) => [k, v === 'unlisted' ? { state: 'unlisted' } : { state: 'listed', title: null }] as const));
  }
  try {
    const { resolveRefs } = await import('@/lib/client/data');
    const rows = await resolveRefs(slugs.map((s) => `trip:${s}`));
    if (!rows) return null;
    const out = new Map<string, Listing>();
    slugs.forEach((slug, i) => {
      const r = rows[i];
      if (!r) return;
      out.set(slug, r.state === 'withdrawn' || r.state === 'unknown' ? { state: 'unlisted' } : { state: 'listed', title: r.name });
    });
    return out;
  } catch {
    return null;
  }
}
