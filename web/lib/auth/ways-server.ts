import 'server-only';
import { accountRows } from './account-rows';
import type { SessionUser } from './server';
import { googleJustAdded, parseNeonRows, publicRows, type WayRow } from './ways';

/**
 * The rows "Ways to sign in" shows (GSI-WAYS), read on the server from Neon's `list-accounts` with the session cookie: provider and
 * date only. Null when they cannot be read (an error, a throw, or an answer that is not the expected shape): the section then shows
 * Email only and says it could not check the rest, and offers no Add or Remove.
 */
export async function accountWays(user: SessionUser): Promise<WayRow[] | null> {
  const res = await accountRows(user.id);
  if (!res.ok) return null;
  const rows = parseNeonRows(res.data);
  if (!rows) {
    console.warn('[account] list-accounts answer unreadable');
    return null;
  }
  return publicRows(rows);
}

/** The return of Add Google said so (`?added=google`) and the rows agree: a Google row from the last minutes (string 35). */
export function googleAddedNow(added: boolean, rows: WayRow[] | null): boolean {
  return added && rows !== null && googleJustAdded(rows, Date.now());
}
