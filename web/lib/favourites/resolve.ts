import { applyResolution, updateFavourites } from '@travel/core/favourites/envelope.ts';
import { FAV_LOCAL_KEY } from '@travel/core/schema/favourites.ts';
import type { FavItem } from '@travel/core/schema/favourites.ts';
import type { StorageLike } from '@travel/core/schema/copies.ts';
import { handleOf } from '@travel/core/favourites/envelope.ts';

/**
 * Where the visible page's favourites stand now (visitor spec 4.5, P9: through `DataClient.resolveRefs`, which asks `/api/v1/resolve` for
 * light rows only). A renamed row takes its new name, a moved or merged row its new slug (folded into a survivor already held), a withdrawn
 * or unknown row becomes "No longer listed" and stays until the visitor removes it. Asked once per visit per page of handles.
 *
 * `unavailable` means the build has no resolve endpoint (a static build): the rows keep their stored snapshots and nothing is marked.
 * `failed` means the request failed: the panel says so and offers Try again; the list is untouched.
 */
export type Refresh = { kind: 'unavailable' } | { kind: 'failed' } | { kind: 'done'; changed: boolean };

const asked = new Set<string>();

/** Tests only: forget what this visit already asked. */
export const forgetAsked = (): void => asked.clear();

export async function refreshPage(storage: StorageLike, rows: readonly FavItem[], opts: { force?: boolean; now?: Date } = {}): Promise<Refresh> {
  const handles = rows.map(handleOf);
  if (handles.length === 0) return { kind: 'done', changed: false };
  const key = [...handles].sort().join(',');
  if (!opts.force && asked.has(key)) return { kind: 'done', changed: false };
  let answer: unknown;
  try {
    const { resolveRefs } = await import('@/lib/client/data');
    answer = await resolveRefs(handles);
  } catch {
    return { kind: 'failed' };
  }
  if (answer === null) return { kind: 'unavailable' };
  asked.add(key);
  const now = opts.now ?? new Date();
  const r = updateFavourites(storage, FAV_LOCAL_KEY, (env) => {
    const a = applyResolution(env, answer, now);
    return a.success ? { envelope: a.data.envelope, value: a.data.changed } : { envelope: null, value: false };
  });
  if (!r.ok) return r.reason === 'refused' ? { kind: 'failed' } : { kind: 'done', changed: false };
  return { kind: 'done', changed: r.value };
}
