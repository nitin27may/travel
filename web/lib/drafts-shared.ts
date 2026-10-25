/**
 * Draft title rules and shared types, safe for both server and client bundles (no `server-only`,
 * no database import). The server adapter re-exports these; the account UI imports them directly.
 */

export type DraftRow = {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
};

/**
 * The content-free Realtime stream row: a user id and a monotonic version. No draft content ever
 * appears here (see migration 0010 / NEON-SETUP.md). `version` is a Postgres bigint, delivered as a
 * string by both node-postgres and the Realtime client parsers.
 */
export type SignalRow = {
  user_id: string;
  version: string;
};

/**
 * Parse a drafts re-fetch JSON payload into `DraftRow`s, converting the ISO date strings back to
 * `Date`. Shared so the UI and its tests agree on the shape. Throws on a malformed row rather than
 * silently coercing, so a bad payload surfaces as an error state instead of a broken list.
 */
export function parseDraftRows(raw: unknown): DraftRow[] {
  if (!Array.isArray(raw)) throw new Error("drafts payload is not an array");
  return raw.map((r) => {
    if (typeof r !== "object" || r === null) throw new Error("draft row is not an object");
    const row = r as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.title !== "string") throw new Error("draft row missing id/title");
    const created = new Date(row.created_at as string);
    const updated = new Date(row.updated_at as string);
    if (Number.isNaN(created.getTime()) || Number.isNaN(updated.getTime())) throw new Error("draft row has an invalid date");
    return { id: row.id, title: row.title, created_at: created, updated_at: updated };
  });
}

export const TITLE_MIN = 1;
export const TITLE_MAX = 160;

export type TitleCheck = { ok: true; title: string } | { ok: false; reason: 'empty' | 'too_long' };

/** Validate a draft title: 1..160 characters after trimming. Shared by server actions and the UI. */
export function checkTitle(raw: unknown): TitleCheck {
  const title = typeof raw === 'string' ? raw.trim() : '';
  if (title.length < TITLE_MIN) return { ok: false, reason: 'empty' };
  if (title.length > TITLE_MAX) return { ok: false, reason: 'too_long' };
  return { ok: true, title };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);
