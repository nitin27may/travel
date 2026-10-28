// The editable trip document's bridges (edit-my-trip.md 2, 3, 4.2; task EM-C): a device copy (`copies/1`) as a `plan-draft/1` in
// template mode, the account row a draft becomes (its light columns derived from the document, never sent separately), the content
// key the sign-in merge compares (M3), and the merge itself with the plan mapper (`planCopyMerge`, which reuses `planMerge` and
// `markMerged` of core/src/schema/copies.ts; nothing of the merge rule is duplicated here).
//
// Why this file sits in the builder's paths: it imports the plan document, and the builder fence (web/tests/plan/isolation.test.ts G1)
// lets only builder files and the named extension points do that. It may import the copy module (the fence is one way), and it names
// no other feature's storage key or table. Pure: no clock (times come from the copy or an argument), no storage, no fetch.
import {
  ACCOUNT_DRAFT_CAP,
  copyContentKey,
  parseCopy,
  planMerge,
  templateContentKey,
  type AccountDraftKey,
  type CopyItem,
  type MergePlan,
  type TemplateContent,
} from "../schema/copies.ts";
import {
  type Checked,
  isTemplateDraft,
  parsePlanDraft,
  PLAN_DRAFT_SCHEMA,
  planModeOf,
  type PlanDocMode,
  type PlanDraft,
  type PlanTemplateDraft,
} from "../schema/plan-draft.ts";

/** What the catalogue knows of a public trip that a copy's snapshot may lack (a copy moved from the old key has no country or days). */
export interface PlanTripFacts {
  /** ISO 3166-1 alpha-2 */
  cc: string;
  /** days of the published plan */
  days: number;
}

export interface CopyMapOptions {
  /**
   * The public slug of a copy's trip: a dated legacy folder becomes its alias (public-ref-aliases 4; the server holds the table).
   * Return null for a trip that is not public and listed: the copy is refused. Default: the copy's slug as it is.
   */
  publicSlug?: (slug: string) => string | null;
  /** The trip's country and days when the copy's snapshot lacks them (the server reads the catalogue). */
  facts?: (slug: string) => PlanTripFacts | null;
  /** The row's title, when it is not the copy's (M3's "(from this device)"); the document keeps it as the person's own title. */
  title?: string;
}

/**
 * The account row of one draft (edit-my-trip 3): the light columns are derived from the document by `planRowFields`, so they can
 * never disagree with it. `title` is what the list shows: the person's own title, else the trip's (the route re-reads a template
 * draft's trip title from the catalogue).
 */
export interface PlanRow {
  id: string;
  title: string;
  kind: PlanDocMode;
  source_trip: string | null;
  start: string | null;
  days: number | null;
  doc: PlanDraft;
}

/** The derived columns of an account row (EM-M's `kind`, `source_trip`, `start`, `days`): what the list reads without the document (P8). */
export function planRowFields(d: PlanDraft): Pick<PlanRow, "kind" | "source_trip" | "start" | "days"> {
  return {
    kind: planModeOf(d),
    // a converted copy (built mode, `convertedAt` set) still names the trip it came from, in `seed` (edit-mode-spec 13.2)
    source_trip: d.template?.trip ?? (d.convertedAt !== undefined ? d.seed : null),
    start: d.start ?? null,
    days: d.nights === null ? null : d.nights + 1,
  };
}

const monthOf = (iso: string): number => Number(iso.slice(5, 7));
const fail = (issues: string[]): { success: false; issues: string[] } => ({ success: false, issues });

/** A parsed copy as a template draft (`copyToPlanDraft` without the parse of its input). */
function draftOfCopy(c: CopyItem, opts: CopyMapOptions): Checked<PlanTemplateDraft> {
  const trip = opts.publicSlug ? opts.publicSlug(c.slug) : c.slug;
  if (trip === null) return fail(["$.slug: a public, listed trip"]);
  let cc = c.cc;
  let days = c.days;
  if (cc === null || days === null) {
    const f = opts.facts?.(trip) ?? null;
    cc = cc ?? f?.cc ?? null;
    days = days ?? f?.days ?? null;
  }
  if (cc === null) return fail(["$.cc: the trip's country is not known"]);
  if (days === null) return fail(["$.days: the trip's days are not known"]);
  // one entry per place: an old copy may list a place twice; the first addition wins
  const seen = new Set<string>();
  const added = c.added.flatMap((a) => {
    const ref = `place/${a.placeSlug}`;
    if (seen.has(ref)) return [];
    seen.add(ref);
    return [{ day: a.day, ref }];
  });
  const overrides = Object.fromEntries(Object.entries(c.overrides).sort((a, b) => Number(a[0]) - Number(b[0])));
  const title = opts.title !== undefined && opts.title !== c.title ? opts.title : null;
  const doc = {
    schema: PLAN_DRAFT_SCHEMA,
    id: c.id,
    title,
    where: { mode: "trip", cc, regions: [] },
    nights: days - 1,
    pace: c.profile?.pace ?? "standard",
    moves: "balanced",
    month: monthOf(c.start),
    party: "trip",
    picks: [],
    bases: [],
    edits: [],
    origin: null,
    seed: null,
    lastBuild: null,
    createdAt: c.copiedAt,
    updatedAt: c.copiedAt,
    template: {
      trip,
      rev: c.rev ?? null,
      profile: c.profile,
      window: null,
      overrides,
      added: added.map((a, i) => ({ op: `o-${i + 1}`, day: a.day, ref: a.ref })),
      removed: [],
      moved: [],
      days: [],
      notes: {},
      maybe: [],
    },
    start: c.start,
    travellers: { adults: c.adults, children: [...c.children] },
    ...(c.fromRef !== undefined ? { fromRef: c.fromRef } : {}),
    ...(c.gw !== undefined ? { gw: { in: c.gw.in, out: c.gw.out } } : {}),
  };
  const r = parsePlanDraft(doc);
  if (!r.success) return r;
  return isTemplateDraft(r.data) ? { success: true, data: r.data } : fail(["$.template: present"]);
}

/**
 * A device copy (`copies/1`, as received: it is parsed) as a `plan-draft/1` in template mode (edit-my-trip 2, "Mapping a device
 * copy"): its id, start, travellers (`party: "trip"`), trip, profile, overrides, additions (operation ids `o-1`, `o-2`, ...), revision,
 * origin and airports. The title stays null (the trip's) unless `opts.title` differs from the copy's. The snapshot fields `days`,
 * `cc` and `photo` are not document keys: `days` and `cc` set `nights` and `where`, and the row carries the rest (P8).
 */
export function copyToPlanDraft(x: unknown, opts: CopyMapOptions = {}): Checked<PlanTemplateDraft> {
  const c = parseCopy(x);
  return c.success ? draftOfCopy(c.data, opts) : c;
}

/** A parsed copy's account row. */
function rowOfCopy(c: CopyItem, opts: CopyMapOptions): Checked<PlanRow> {
  const d = draftOfCopy(c, opts);
  if (!d.success) return d;
  return { success: true, data: { id: c.id, title: opts.title ?? c.title, ...planRowFields(d.data), doc: d.data } };
}

/** The account row of a device copy (parses; the id is a client-chosen primary key, review C2). */
export function copyToPlanRow(x: unknown, opts: CopyMapOptions = {}): Checked<PlanRow> {
  const c = parseCopy(x);
  return c.success ? rowOfCopy(c.data, opts) : c;
}

/** A template draft's content in the canonical form M3 compares (copies.ts `templateContentKey`); null for a built draft. */
export function draftContent(d: PlanDraft): TemplateContent | null {
  const t = d.template;
  if (t === undefined) return null;
  return {
    trip: t.trip,
    start: d.start ?? null,
    travellers: d.travellers ?? null,
    profile: t.profile,
    window: t.window,
    overrides: t.overrides,
    added: t.added,
    removed: t.removed,
    moved: t.moved,
    days: t.days,
    notes: t.notes,
    maybe: t.maybe,
    fromRef: d.fromRef ?? null,
    gw: d.gw ?? null,
  };
}

/** The M3 content key of a stored document, for `AccountDraftKey.content`; null for a built draft or a row with no document. */
export function draftContentKey(d: PlanDraft | null): string | null {
  const c = d === null ? null : draftContent(d);
  return c === null ? null : templateContentKey(c);
}

/** An account draft as the merge reads it, with its content key REQUIRED (so the old "account wins" rule can never apply by omission). */
export type AccountPlanKey = AccountDraftKey & { content: string | null };

/**
 * The sign-in merge (edit-my-trip 4.2 M1 to M4) with the plan mapper: `planMerge` (copies.ts) parses the copies, keeps the merge
 * idempotent on the copy id, honours the cap with the newest copies first, and applies M3; each copy becomes its `plan-draft/1` row.
 * A copy whose trip is not public, or whose country or days are unknown, is `refused` and stays on the device. `account` is every
 * live row's key, with `content` read for the rows whose trip and start match a device copy.
 */
export function planCopyMerge(
  input: unknown,
  account: readonly AccountPlanKey[],
  opts: Omit<CopyMapOptions, "title"> & { cap?: number } = {},
): Checked<MergePlan<PlanRow>> {
  const slugOf = (s: string): string => (opts.publicSlug ? (opts.publicSlug(s) ?? s) : s);
  return planMerge<PlanRow>(input, account, opts.cap ?? ACCOUNT_DRAFT_CAP, {
    toRow: (c, title) => {
      const r = rowOfCopy(c, { ...opts, title });
      return r.success ? r.data : null;
    },
    contentKey: (c) => copyContentKey(c, slugOf),
    tripOf: slugOf,
  });
}
