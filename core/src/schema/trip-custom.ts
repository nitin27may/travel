// trip-custom/1: the private delta of a visitor's copy of a public trip, held in `planner_draft.doc` under owner-predicate RLS
// (trip-overview-and-customisation.md 5.6). Plain zod, not a registered table, so nothing is exported to data/schema/generated/.
//
// This file is the SKELETON (NAV-C, master order 6.4). It holds what a device copy (`copies/1`, ./copies.ts) maps into at the
// sign-in merge (navigation-and-mine.md 4.2 rule 2) plus the reserved private fields of the origin spec
// (trip-origin-and-nearest-airport.md 10):
//   profile, overrides, added      the timeline choices (trip-timeline 3.9)
//   start, travellers              the copy's dates and party (nav 4.2 rule 2)
//   fromRef, gw                    the visitor's origin and airport choice (origin spec 10), reserved now so the shape holds to v0.8;
//                                  stored as `fromRef` (owner, 26 Oct 2026, review NAV-C Q1), not `from`: the URL key stays `from`
//   rev                            the public trip's content revision when copied (`planner_draft.source_revision`), reserved
// CUS-C extends it with `window`, `removed`, `maybe`, `title`, `moved`, `days`, `notes` and `custom` before its migration is applied.
//
// FORWARD COMPATIBILITY (review NAV-C M4). The object is strict: a key this reader does not know makes the doc `invalid`, not
// `newer`. Adding optional keys to `/1` is safe only while no `trip-custom/1` doc is stored anywhere (before the CUS-C migration is
// applied). After the first stored doc, every new key is `trip-custom/2`, or a stale tab or a rolled-back deploy reports good docs as
// invalid. The same rule holds for `copies/1` once NAV-2 ships.
//
// Everything here is household data: `travellers`, `fromRef`, `gw`, `profile.youngest` and `added` never reach a public payload. The
// privacy detector (core/src/privacy/detect.ts) fails a served body that carries `travellers`, `fromRef`, `gw` or `added` under any
// value, or an origin reference under `from`. This module imports nothing from privacy/ on purpose: the Mine page loads it in the browser, and the detector pulls
// the household config in with it.
import { z } from "zod";

export const TRIP_CUSTOM_SCHEMA = "trip-custom/1";
/** The `doc` column's limit (overview 5.6). */
export const TRIP_CUSTOM_MAX_BYTES = 64 * 1024;

/** A public trip or place slug, as the URL carries it. */
export const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;
/** Three capital letters, as OurAirports holds them. */
export const IATA = /^[A-Z]{3}$/;
/**
 * An origin reference (origin spec 10; the origin codec ORG-C writes parses it): `iata:BOM`, `hub:toronto`, `town:in-mh-mumbai`
 * (towns layer id) or `gn:1275339` (a GeoNames world town). A label and a point come from the reference files, never from the visitor,
 * so the reference is all a copy stores.
 */
export const ORIGIN_REFERENCE = /^(?:iata:[A-Z]{3}|hub:[a-z0-9][a-z0-9-]{0,59}|town:[a-z0-9][a-z0-9-]{0,99}|gn:[1-9]\d{0,9})$/;
/** A catalogue ref of 1 to 200 characters without spaces and without a household origin key (`loc:`, `proto:`; detect.ts ORIGIN_REF). */
export const CATALOGUE_REF = /^(?!.*\b(?:loc|proto):)\S{1,200}$/;

/** A visitor's origin: one reference string. */
export const originRef = z.string().regex(ORIGIN_REFERENCE, "an origin reference: iata:XXX, hub:<id>, town:<id> or gn:<number>");
/** A public trip's content revision (a hash or a date stamp), so the planner can tell template drift (overview 5.6). */
export const sourceRevision = z.string().regex(/^[A-Za-z0-9._:-]{1,64}$/, "a content revision");
/** The arrival and departure airports the visitor picked (`gw=yeg,yyc`); the same code twice for one airport both ways. */
export const gateways = z.strictObject({ in: z.string().regex(IATA), out: z.string().regex(IATA) });

/**
 * The timeline profile as a copy stores it (CopyDraft.profile, web/lib/export/draft.ts). `walk` is core Profile's `walkKm` (the URL
 * offers 5, 8 or 12 km; null means from the age). `adults` is 1, or 2 for two or more (types.ts Profile). Lenient on purpose: a copy
 * holds whatever the trip page published, and the profile codec re-checks it when the copy opens (an unknown value falls back).
 */
export const timelineProfile = z.strictObject({
  party: z.enum(["adults", "family"]),
  youngest: z.number().int().min(0).max(17).nullable(),
  pace: z.enum(["relaxed", "standard", "full"]),
  adults: z.number().int().min(1).max(12),
  walk: z.number().positive().max(100).nullable(),
  split: z.boolean(),
});

/** Day number (as an object key) to variant key A, B or C (timeline 3.6, `d=5C`). */
export const MAX_OVERRIDES = 60;
export const overrides = z.record(z.string().regex(/^[1-9]\d?$/, "a day number 1 to 99"), z.enum(["A", "B", "C"]));

/** The party: adults and the children's ages. Household data (nav gotchas): on the device or in an RLS table, never in a URL. */
export const MAX_ADULTS = 12;
export const MAX_CHILDREN = 12;
export const travellers = z.strictObject({
  adults: z.number().int().min(1).max(MAX_ADULTS),
  children: z.array(z.number().int().min(0).max(17)).max(MAX_CHILDREN),
});

/** One added catalogue item. `op` is the operation id that added it (undo, overview 5.5); `after` the schedule id it follows. */
export const MAX_ADDED = 30;
export const customAdded = z.strictObject({
  op: z.string().regex(/^o-\d{1,6}$/),
  day: z.number().int().min(1).max(99),
  /** a catalogue ref (`place/<slug>`, a capture record id); never a household origin key (`loc:`, `proto:`) */
  ref: z.string().regex(CATALOGUE_REF, "a catalogue ref, never a household origin key"),
  after: z.string().min(1).max(120).optional(),
});

export const tripCustom = z.strictObject({
  schema: z.literal(TRIP_CUSTOM_SCHEMA),
  profile: timelineProfile.nullable(),
  overrides,
  added: z.array(customAdded).max(MAX_ADDED),
  /** ISO date of Day 1; absent for an own plan with no date (Mine "No date" group). */
  start: z.iso.date().optional(),
  travellers: travellers.optional(),
  /** reserved (origin spec 10): the visitor's origin for this copy; the stored name of the URL's `from` */
  fromRef: originRef.optional(),
  /** reserved (origin spec 10): the airports the visitor picked */
  gw: gateways.optional(),
  /** reserved: the public trip's content revision when copied (`planner_draft.source_revision`, overview 5.6) */
  rev: sourceRevision.optional(),
});

export type TimelineProfile = z.infer<typeof timelineProfile>;
export type Travellers = z.infer<typeof travellers>;
export type Gateways = z.infer<typeof gateways>;
export type TripCustomAdded = z.infer<typeof customAdded>;
export type TripCustom = z.infer<typeof tripCustom>;

/** UTF-8 bytes, without Buffer or TextEncoder assumptions beyond the platform's. */
export function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

/**
 * The cross-field rules JSON Schema cannot hold (the schema files stay exportable, core/test/subset.test.ts): at most 60 overrides,
 * one op id per added item, at most 64 KB. Each names a path and a rule, never a value.
 */
export function tripCustomRules(d: TripCustom): string[] {
  const out: string[] = [];
  if (Object.keys(d.overrides).length > MAX_OVERRIDES) out.push(`$.overrides: at most ${MAX_OVERRIDES} overrides`);
  const ops = d.added.map((a) => a.op);
  if (new Set(ops).size !== ops.length) out.push("$.added: each added item has its own op id");
  if (byteLength(JSON.stringify(d)) > TRIP_CUSTOM_MAX_BYTES) out.push(`$: at most ${TRIP_CUSTOM_MAX_BYTES} bytes`);
  return out;
}

/**
 * Zod issues as paths and rules, never values (review NAV-C L4): a record's key (an override's day, an account hash) and an
 * unrecognised key's name are data, so a path element that is not a plain field name reads `[key]`, and an unrecognised-key message
 * names no key. Array indexes stay.
 */
export const issuesOf = (e: z.ZodError): string[] =>
  e.issues.map((i) => {
    const path = i.path.map((p) => (typeof p === "number" ? String(p) : typeof p === "string" && /^[A-Za-z_]{1,40}$/.test(p) ? p : "[key]"));
    const message = i.code === "unrecognized_keys" ? "an unrecognised key" : i.code === "invalid_key" ? "an invalid key" : i.message;
    return `${path.length ? `$.${path.join(".")}` : "$"}: ${message}`;
  });

export type Checked<T> = { success: true; data: T } | { success: false; issues: string[] };

/** The schema, then the rules: what every write of a `planner_draft.doc` runs (overview 5.6). */
export function parseTripCustom(x: unknown): Checked<TripCustom> {
  const r = tripCustom.safeParse(x);
  if (!r.success) return { success: false, issues: issuesOf(r.error) };
  const rules = tripCustomRules(r.data);
  return rules.length ? { success: false, issues: rules } : { success: true, data: r.data };
}

/** Parses a stored doc. A doc of a newer schema is reported as `newer`, never coerced (the planner shows it read-only). */
export function readTripCustom(x: unknown): { ok: true; doc: TripCustom } | { ok: false; reason: "newer" | "invalid"; issues: string[] } {
  if (x && typeof x === "object" && typeof (x as { schema?: unknown }).schema === "string") {
    const s = (x as { schema: string }).schema;
    const m = /^trip-custom\/(\d+)$/.exec(s);
    if (m && Number(m[1]) > 1) return { ok: false, reason: "newer", issues: [`$.schema: ${s}`] };
  }
  const r = parseTripCustom(x);
  return r.success ? { ok: true, doc: r.data } : { ok: false, reason: "invalid", issues: r.issues };
}
