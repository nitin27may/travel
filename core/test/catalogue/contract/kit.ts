// The contract kit's shared types and helpers (EXECUTION-PLAN 4.6; PHASE-B-START section 6, cases K1 to K19).
//
// A case table is a plain array of cases per store method (`<method>.cases.ts`). A runner (core/test/catalogue/contract.test.ts now;
// web/tests/api/contract.test.ts through the handlers in API-1b; SRV-0 adds SupabaseStore) runs every case against every target.
// A target names what it cannot run yet in `pending` (with the task that fills it) or never can in `notApplicable` (with why); the
// runner turns both into `it.todo` lines, so nothing is skipped silently and the hand-back can count them.
import { expect } from "vitest";
import type { CatalogueMethod, CatalogueStore } from "../../../src/catalogue/store.ts";
import type { Result } from "../../../src/catalogue/result.ts";
import type { ApiErrorCode } from "../../../src/schema/api/index.ts";
import { privacyHits } from "../../../src/privacy/detect.ts";

/** What a case needs to know about a target's data, so the same case runs on the fixture and on the real catalogue. */
export interface ContractFacts {
  /** a place that exists, with an exact point */
  placeSlug: string;
  /** a public trip */
  tripSlug: string;
  /** a slug retired by `slugs.ts rename`, and the slug it answers with now */
  retired?: { from: string; to: string };
  /** the slug of a merged record, and its survivor's slug (R-1, case K9.merged) */
  merged?: { from: string; to: string };
  /** a withdrawn slug (R-3, case K9.withdrawn) */
  withdrawn?: string;
  /** a ref replaced by `alias`, and the slug it still resolves to (R-2, case K8.former) */
  former?: { ref: string; slug: string };
  /** a retired trip slug and its current slug (R-18) */
  tripRetired?: { from: string; to: string };
  /** a region alias two countries share, the countries, and one country that settles it (R-20, case K14.ambiguous) */
  ambiguousRegion?: { alias: string; cc: string };
  /** a tag id and the slugs that carry it (R-23, case listPlaces.tag) */
  tag?: { id: string; slugs: string[] };
  /** every place whose point is marked approximate (case K16: approx is true for these and only these) */
  approxSlugs: string[];
  /** two refs whose names share a sort key, in the order the tiebreak must give (case K11) */
  sortKeyTie?: [string, string];
  /** one region with the spellings that must all give the canonical value (case K14) */
  region: { cc: string; canonical: string; aliases: string[] };
  /** a near token that resolves, one that does not (cases K3, K4) */
  near: { token: string; unknown: string };
  /** a town id for `city=` (case K15), and whether the towns layer exists on this target */
  town: { id: string; layer: boolean };
  /** a place whose export is a single item with a point we may hand out */
  exportPlace: string;
  /** source registry ids: every `src` in output must be one of these (case K12) */
  registryIds: ReadonlySet<string>;
  /** a gazetteer feature id with a line */
  featureId: string;
  /** a country with pins */
  pinCountry: string;
}

export interface ContractTarget {
  name: string;
  /** a store over the target's data */
  make(): CatalogueStore | Promise<CatalogueStore>;
  /** a store over the same data with ONE served value changed (case K10) */
  makeChanged?(): CatalogueStore | Promise<CatalogueStore>;
  /** touch every data file's mtime without changing a byte (case K10); absent for an in-memory store */
  touch?(): void;
  /** the slug registry the store serves from (cases K8.former) */
  registry?(): import("../../../src/catalogue/slugs.ts").SlugRegistry;
  /** how many row or shard reads the store has made so far (case K4) */
  rowReads?(store: CatalogueStore): number;
  facts: ContractFacts;
  /** case id -> the task that makes it run on this target */
  pending?: Record<string, string>;
  /** case id -> why it can never apply to this target */
  notApplicable?: Record<string, string>;
}

export interface ContractCase {
  /** `K<n>` for the start sheet's cases, `<method>.<what>` for the shape cases */
  id: string;
  title: string;
  method: CatalogueMethod | "handler" | "all";
  /** `handler` cases need respond(): the web runner runs them, the store runner lists them as todo */
  layer?: "store" | "handler";
  run(store: CatalogueStore, t: ContractTarget): Promise<void>;
}

// ---- assertions ---------------------------------------------------------------------------------------------------------------

export function expectOk<T>(r: Result<T>, what = "result"): T {
  if (!r.ok) throw new Error(`${what}: expected ok, got ${r.error.code}: ${r.error.message}`);
  return r.data;
}

export function expectError(r: Result<unknown>, code: ApiErrorCode, what = "result"): void {
  expect(r.ok, `${what}: expected ${code}, got ok`).toBe(false);
  if (!r.ok) expect(r.error.code, `${what}: ${r.error.message}`).toBe(code);
}

/** Every row of a paged list method, page by page at the largest page size. */
export async function allRows<T>(page: (n: number) => Promise<Result<{ items: T[]; nextPage: number | null }>>): Promise<T[]> {
  const out: T[] = [];
  for (let n: number | null = 1; n !== null; ) {
    const got: { items: T[]; nextPage: number | null } = expectOk(await page(n), `page ${n}`);
    out.push(...got.items);
    n = got.nextPage;
  }
  return out;
}

// ---- household strings (case K7) --------------------------------------------------------------------------------------------------

/**
 * Case K7 runs the one detector (core/src/privacy/detect.ts: the home town, planning notes, addresses, private keys, status words and a
 * point near home as an object, an array or a number pair in text), so respond(), this kit and the web privacy test cannot drift. The
 * sentinels below are what the privacy test's fixture plants; they exist only in tests.
 */
const SENTINELS: readonly RegExp[] = [/CONF-SENTINEL-7Q/, /NOTE-SENTINEL-PRIVATE/, /CITIZENSHIP-SENTINEL/, /CONTACT-SENTINEL/, /\+1-555-0100/];

/** Household strings, private keys and points near home in one output; empty when clean. A hit names a path and a reason, never a coordinate. */
export function householdHits(out: unknown, where: string): string[] {
  const hits = privacyHits(out).map((h) => `${where}${h.where.slice(1)}: ${h.why}`);
  const text = JSON.stringify(out);
  for (const re of SENTINELS) if (re.test(text)) hits.push(`${where}: ${re}`);
  return hits;
}
