// The account plan routes' contract (edit-my-trip.md 3, 4.1, 4.5; task EM-C): `/api/account/plans/**`, same-origin, a verified
// session on each, owner-predicate RLS underneath. Shapes, byte caps, the revision and tombstone decisions as pure functions, and
// the description of the table change task EM-M writes as a migration (`PLAN_DOC_MIGRATION`; no migration number is chosen here).
//
// NOT part of the public API: nothing here is exported from ./index.ts or the OpenAPI document. These are private, signed-in routes;
// every body carries household data (a trip's start, its travellers' ages, notes), so none is cached, logged or shown to anyone but
// its owner (edit-my-trip 7).
//
// THE DOCUMENT is `plan-draft/1` (core/src/schema/plan-draft.ts). This file does not import it: the builder's fence
// (web/tests/plan/isolation.test.ts G1) forbids a file outside the builder's paths from importing the plan document. The shapes carry
// the document as an object naming its schema (`accountPlanDoc`), and the parsers take the document's parser as an argument, so the
// route (EM-1) passes `parsePlanDraft` and checks the WHOLE document on every write (R5).
import { z } from "zod";
import { PLAN_DOC_LIMITS, PLAN_SYNC } from "../../config/plans.ts";
import { DEVICE_COPY_CAP, ENVELOPE_MAX_BYTES } from "../copies.ts";
import { byteLength, type Checked, issuesOf, SLUG } from "../trip-custom.ts";

/** The account row's `kind`: the document's mode (plan-draft.ts PLAN_DOC_MODES; core/test/plan/plan-doc.test.ts pins them equal). */
export const ACCOUNT_PLAN_KINDS = ["template", "built"] as const;
export type AccountPlanKind = (typeof ACCOUNT_PLAN_KINDS)[number];

/** The routes' numbers (R5, 4.1). */
export const ACCOUNT_PLANS_LIMITS = {
  /** one document, as UTF-8 JSON */
  docBytes: PLAN_DOC_LIMITS.docBytes,
  /** a PUT body: the document plus `base`, `title` and `restore` */
  putBodyBytes: PLAN_DOC_LIMITS.docBytes + 1024,
  /** a DELETE body */
  deleteBodyBytes: 256,
  /** the merge body: the device's copies, as the envelope's cap (84 KB) */
  mergeBodyBytes: ENVELOPE_MAX_BYTES,
  /** copies in one merge */
  mergeCopies: DEVICE_COPY_CAP,
  /** live rows per user (the cap trigger is the rule; this is the list's check) */
  accountPlans: PLAN_DOC_LIMITS.accountPlans,
  /** rows one list answer may hold: the live ones and the tombstones of the last PLAN_SYNC.tombstoneDays */
  listRows: PLAN_DOC_LIMITS.accountPlans * 4,
  /** the row title column's check (0009) */
  titleMax: 160,
  /** writes a minute per user, in the `plans:write` quota bucket */
  writesPerMinute: PLAN_SYNC.writesPerMinute,
} as const;

/** The quota bucket every write route takes from (`quota_take`, 0011; HMAC-keyed user id). */
export const ACCOUNT_PLANS_QUOTA_BUCKET = "plans:write";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const accountPlanId = z.string().regex(UUID_V4, "a lower-case UUID v4");
/** The row's optimistic-concurrency counter (`revision bigint`, bumped by the update trigger); safe as a JSON number. */
export const accountPlanRevision = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const instant = z.iso.datetime();
const title = z.string().min(1).max(ACCOUNT_PLANS_LIMITS.titleMax).regex(/\S/, "not blank");

/** The document as the routes carry it: an object naming a `plan-draft/<n>` schema. Checked whole by the document's own parser. */
export const accountPlanDoc = z.looseObject({ schema: z.string().regex(/^plan-draft\/[1-9]\d{0,3}$/, "a plan-draft document") });

/**
 * One row of `GET /api/account/plans` (the light list, P8: never the document). A tombstone has `deleted_at` set and keeps its title
 * so a device can say "Canadian Rockies was removed on another device" (4.5).
 */
export const accountPlanRow = z.strictObject({
  id: accountPlanId,
  title,
  /** null for a titled draft made before the document existed ("Empty plan") */
  kind: z.enum(ACCOUNT_PLAN_KINDS).nullable(),
  /** the template's public trip slug; the list's photo and current title come from the catalogue by it */
  source_trip: z.string().regex(SLUG).nullable(),
  /** Day 1, for Upcoming, Past and No date. Household data */
  start: z.iso.date().nullable(),
  days: z.number().int().min(1).max(PLAN_DOC_LIMITS.templateDays).nullable(),
  revision: accountPlanRevision,
  updated_at: instant,
  /** the tombstone (4.5): set by DELETE, purged after PLAN_SYNC.tombstoneDays */
  deleted_at: instant.nullable(),
});
export const accountPlanList = z.strictObject({ items: z.array(accountPlanRow).max(ACCOUNT_PLANS_LIMITS.listRows) });

/** `GET /api/account/plans/{id}`: 404 for an id that is not the caller's (no existence leak) or a tombstone. */
export const accountPlanGet = z.strictObject({ revision: accountPlanRevision, doc: accountPlanDoc });

/**
 * `PUT /api/account/plans/{id}`. `base: null` creates; a number updates when it is the row's revision. `restore: true` with the
 * tombstone's revision clears `deleted_at` (the Undo of 4.5). The document's `id` is the path's id.
 */
export const accountPlanPut = z.strictObject({ base: accountPlanRevision.nullable(), title, doc: accountPlanDoc, restore: z.literal(true).optional() });
/** A write's answer. */
export const accountPlanWritten = z.strictObject({ revision: accountPlanRevision });
/** A 409's body: the row as it is now, so the device can rebase (4.4 step 3). `doc` is null for a tombstone. */
export const accountPlanConflict = z.strictObject({ revision: accountPlanRevision, doc: accountPlanDoc.nullable(), deleted_at: instant.nullable() });
/** `DELETE /api/account/plans/{id}`: the revision the device last saw. */
export const accountPlanDelete = z.strictObject({ base: accountPlanRevision });
/**
 * `POST /api/account/plans/merge` answers which copies the account now holds (edit-my-trip 4.2): the device passes `inserted`,
 * `already` and `sameTrip` to `markMerged`; `both` (a subset of `inserted`) are the copies kept beside an account row of the same trip
 * and start (M3); `overCap` and `refused` stay on the device (M4). The body is the `copies/1` items (`parseCopyList`).
 */
export const accountPlanMergeAnswer = z.strictObject({
  inserted: z.array(accountPlanId).max(DEVICE_COPY_CAP),
  already: z.array(accountPlanId).max(DEVICE_COPY_CAP),
  sameTrip: z.array(accountPlanId).max(DEVICE_COPY_CAP),
  both: z.array(accountPlanId).max(DEVICE_COPY_CAP),
  overCap: z.array(accountPlanId).max(DEVICE_COPY_CAP),
  refused: z.array(accountPlanId).max(DEVICE_COPY_CAP),
});

export type AccountPlanRow = z.infer<typeof accountPlanRow>;
export type AccountPlanList = z.infer<typeof accountPlanList>;
export type AccountPlanPut = z.infer<typeof accountPlanPut>;
export type AccountPlanConflict = z.infer<typeof accountPlanConflict>;
export type AccountPlanMergeAnswer = z.infer<typeof accountPlanMergeAnswer>;

// ---- parsing a request ----------------------------------------------------------------------------------------------------------

/** A body's bytes against its cap, before it is parsed (4.1: 16 KB for one document, 84 KB for the merge). */
export const withinBytes = (text: string, max: number): boolean => byteLength(text) <= max;

/** Parses a PUT body: the shape, the byte cap, then the WHOLE document with the caller's parser (R5), whose `id` must be the path's. */
export function parseAccountPlanPut<D extends { id: string }>(
  x: unknown,
  pathId: string,
  parseDoc: (doc: unknown) => Checked<D>,
): Checked<{ base: number | null; title: string; restore: boolean; doc: D }> {
  const r = accountPlanPut.safeParse(x);
  if (!r.success) return { success: false, issues: issuesOf(r.error) };
  if (byteLength(JSON.stringify(r.data.doc)) > ACCOUNT_PLANS_LIMITS.docBytes) return { success: false, issues: [`$.doc: at most ${ACCOUNT_PLANS_LIMITS.docBytes} bytes`] };
  const d = parseDoc(r.data.doc);
  if (!d.success) return { success: false, issues: d.issues.map((i) => (i.startsWith("$") ? `$.doc${i.slice(1)}` : `$.doc: ${i}`)) };
  if (d.data.id !== pathId) return { success: false, issues: ["$.doc.id: the row's id"] };
  return { success: true, data: { base: r.data.base, title: r.data.title, restore: r.data.restore === true, doc: d.data } };
}

/** Parses a DELETE body. */
export function parseAccountPlanDelete(x: unknown): Checked<{ base: number }> {
  const r = accountPlanDelete.safeParse(x);
  return r.success ? { success: true, data: r.data } : { success: false, issues: issuesOf(r.error) };
}

/** A list answer's rules: one row per id, at most ACCOUNT_PLANS_LIMITS.accountPlans live rows. */
export function accountPlanListRules(l: AccountPlanList): string[] {
  const out: string[] = [];
  const ids = l.items.map((r) => r.id);
  if (new Set(ids).size !== ids.length) out.push("$.items: one row per id");
  if (l.items.filter((r) => r.deleted_at === null).length > ACCOUNT_PLANS_LIMITS.accountPlans) out.push(`$.items: at most ${ACCOUNT_PLANS_LIMITS.accountPlans} live rows`);
  return out;
}

/** A list answer, as the device receives it: the shape, then the rules. */
export function parseAccountPlanList(x: unknown): Checked<AccountPlanList> {
  const r = accountPlanList.safeParse(x);
  if (!r.success) return { success: false, issues: issuesOf(r.error) };
  const rules = accountPlanListRules(r.data);
  return rules.length ? { success: false, issues: rules } : { success: true, data: r.data };
}

// ---- revisions and tombstones (pure decisions the route runs inside its transaction) ------------------------------------------

/** The row a write finds, read `for update` under RLS (null: no row the caller can see). */
export interface PlanRowNow {
  revision: number;
  deleted_at: string | null;
}

export type PutDecision = "insert" | "update" | "conflict" | "not-found";

/**
 * What a PUT does (4.1, 4.5). No visible row: `base: null` inserts (`on conflict (id) do nothing returning id`; nothing returned means
 * another user's id, answered 404), any other base is `not-found` (purged, or never this user's). A tombstone: `restore` with its
 * revision brings it back, anything else is a `conflict` (the device learns of the removal). A live row: its revision updates,
 * anything else (a stale base, or a create of an id that exists) is a `conflict` answered with the row.
 */
export function decidePut(base: number | null, now: PlanRowNow | null, restore = false): PutDecision {
  if (now === null) return base === null ? "insert" : "not-found";
  if (now.deleted_at !== null) return restore && base === now.revision ? "update" : "conflict";
  return base === now.revision ? "update" : "conflict";
}

export type DeleteDecision = "delete" | "already" | "conflict" | "not-found";

/** What a DELETE does: a tombstone for the current revision; a second delete is `already` (idempotent); a stale base is a conflict. */
export function decideDelete(base: number, now: PlanRowNow | null): DeleteDecision {
  if (now === null) return "not-found";
  if (now.deleted_at !== null) return "already";
  return base === now.revision ? "delete" : "conflict";
}

/** The instant before which tombstones are purged (4.5): `now` less PLAN_SYNC.tombstoneDays. */
export function tombstoneCutoff(now: Date, days: number = PLAN_SYNC.tombstoneDays): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

/** A tombstone older than the cutoff: the purge job drops it, and an Undo can no longer restore it. */
export const isPurgeable = (deletedAt: string | null, now: Date, days: number = PLAN_SYNC.tombstoneDays): boolean =>
  deletedAt !== null && Date.parse(deletedAt) < Date.parse(tombstoneCutoff(now, days));

/**
 * What a device does with a fresh list (EM7: on focus, on `visibilitychange`, after a write and every 60 s): `fetch` the documents
 * that are new or whose revision moved, `drop` the cached ones that are tombstoned or gone from the list (purged), keep the rest.
 * A tombstoned draft with pending changes is the caller's notice (4.5), with `removed` naming them.
 */
export function diffPlanList(
  cached: readonly { id: string; revision: number }[],
  server: readonly Pick<AccountPlanRow, "id" | "revision" | "deleted_at">[],
): { fetch: string[]; drop: string[]; keep: string[]; removed: string[] } {
  const live = new Map(server.filter((r) => r.deleted_at === null).map((r) => [r.id, r.revision]));
  const tomb = new Set(server.filter((r) => r.deleted_at !== null).map((r) => r.id));
  const have = new Map(cached.map((c) => [c.id, c.revision]));
  const fetch = [...live].filter(([id, rev]) => have.get(id) !== rev).map(([id]) => id);
  const drop = cached.filter((c) => !live.has(c.id)).map((c) => c.id);
  const keep = cached.filter((c) => live.get(c.id) === c.revision).map((c) => c.id);
  const removed = cached.filter((c) => tomb.has(c.id)).map((c) => c.id);
  return { fetch, drop, keep, removed };
}

// ---- the table change, for EM-M (no migration is written here) -------------------------------------------------------------------

/**
 * The `plan_doc` change to the live `planner_draft` table (0009), as EM-M writes it in a migration of its own (the number is chosen
 * at merge; ACCT-PC's `account_profile` is another migration in flight). Every check below matches the constants of this module and
 * core/src/config/plans.ts, pinned by core/test/plan/plan-doc.test.ts. It absorbs NAV-D's draft cap and the column half of CUS-C.
 */
export const PLAN_DOC_MIGRATION = {
  slug: "plan_doc",
  table: "planner_draft",
  columns: [
    {
      name: "doc",
      type: "jsonb",
      nullable: true,
      note: "plan-draft/<n>; null for the titled drafts made on /account/ before this ships (listed as Empty plan). The route checks the whole document (R5); the check is a backstop: jsonb text adds spaces, so it allows half again the route's 16 KB",
      check: "doc is null or (jsonb_typeof(doc) = 'object' and doc->>'schema' ~ '^plan-draft/[1-9][0-9]{0,3}$' and doc->>'id' = id::text and octet_length(doc::text) <= 24576)",
    },
    {
      name: "kind",
      type: "text",
      nullable: true,
      note: "derived from the doc on every write (core/src/plan/doc.ts planRowFields), never from the client separately",
      check: "kind is null or kind in ('template', 'built')",
    },
    { name: "source_trip", type: "text", nullable: true, note: "the template's public trip slug; null for a built draft", check: "source_trip is null or source_trip ~ '^[a-z0-9][a-z0-9-]{0,99}$'" },
    { name: "start", type: "date", nullable: true, note: "the doc's start; household data", check: null },
    { name: "days", type: "int", nullable: true, note: "the doc's nights plus one", check: "days is null or days between 1 and 99" },
    { name: "revision", type: "bigint", nullable: false, default: "0", note: "optimistic concurrency; bumped by the update trigger, never by the client", check: "revision >= 0" },
    { name: "deleted_at", type: "timestamptz", nullable: true, note: "the tombstone (4.5); purged after 30 days", check: null },
  ],
  /** row-level consistency between the derived columns and the document */
  checks: [
    "(doc is null) = (kind is null)",
    "kind is null or ((kind = 'template') = (source_trip is not null))",
  ],
  triggers: [
    "revision: before update, new.revision := old.revision + 1 (beside 0009's updated_at touch)",
    "cap: before insert, and before an update that clears deleted_at, at most 50 rows with deleted_at null per user_id, else raise a PLAN_CAP error the route answers 409; raced on the child branch (NAV-D's test, kept)",
  ],
  indexes: ["(user_id, deleted_at, updated_at desc)", "(user_id, source_trip, start) where deleted_at is null"],
  purge: "delete from planner_draft where deleted_at < now() - interval '30 days'; the account-deletion job (F17) deletes every row of the user",
  rls: "0009's owner-predicate policies cover the new columns; no new policy. The cross-user suite extends to doc, kind, source_trip, start, days, revision, deleted_at",
  signal: "0010's content-free signal keeps firing on any change and carries none of these columns; sync does not depend on it (EM7)",
} as const;
