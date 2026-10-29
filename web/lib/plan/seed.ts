// "Start from this trip" (X7; FLOW C-stage "seed, not fork", TB8): a public trip's places, bases and nights become the first answers of a
// new builder plan. `?seed=<slug>` is read once and stripped (entry.ts). The plan is the visitor's own from the first tap; our trip is only
// named in the document's `seed`. Two parts: `seedState` is pure (tested), `loadSeed` reads the public trip through the one data boundary.
// Nothing private is read or sent: the slug, the trip's public plan model and public place rows.
import type { PlanBaseChoice, PlanPick } from '@travel/core/schema/plan-draft.ts';
import { clampBases, MAX_BASES, type BaseInfo } from './bases';
import { newFlow, nightsRange, type FlowState } from './flow';
import { kindDef, kindOfDraft } from './kinds';

/** The most places a seed carries over (a plan holds 40). */
export const SEED_MAX_PICKS = 40;

export interface SeedRow {
  ref: string;
  slug: string;
  name: string;
  /** upper-case country code, or empty */
  country: string;
  /** the canonical region slug, or empty */
  region: string;
}

export interface SeedBase {
  town: string;
  name: string;
  lat: number;
  lon: number;
  /** the nights the trip sleeps there */
  nights: number;
}

export interface SeedParts {
  slug: string;
  title: string | null;
  /** the trip's days with a number from 1 (day 0 is not a day) */
  days: number;
  /** the stops' place slugs in the trip's order, once each */
  order: readonly string[];
  rows: readonly SeedRow[];
  /** region ids the country offers (`planRegions`), or null when they could not be read */
  offeredRegions: ReadonlySet<string> | null;
  bases: readonly SeedBase[];
}

export interface Seeded {
  state: FlowState;
  /** places of the trip that are not in our list (no public row) */
  skipped: number;
}

/** The country most of the rows share (ties by first seen). */
export function majorityCountry(rows: readonly Pick<SeedRow, 'country'>[]): string | null {
  const n = new Map<string, number>();
  for (const r of rows) if (r.country) n.set(r.country, (n.get(r.country) ?? 0) + 1);
  let best: string | null = null;
  for (const [c, k] of n) if (best === null || k > n.get(best)!) best = c;
  return best;
}

/** "british-columbia" as "British Columbia". */
export const areaWords = (slug: string): string => slug.split('-').map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w)).join(' ');

/** A region id the way the plan routes name it: `<CC>/<region slug>` (planRegions). */
export const regionIdOf = (cc: string, region: string): string => `${cc.toUpperCase()}/${region}`;

/**
 * The flow state a trip seeds, landing on Start (who and when are still the visitor's). Pure. The places keep the trip's order, only those
 * in the main country (one plan is one country), at most 40; the areas are those of the picks the country offers; the bases keep the trip's
 * order and nights, cut to the nights the plan has. Nights come from the days: the trip's last day is the day home.
 */
export function seedState(p: SeedParts, id: string, nowIso: string, countryName: (cc: string) => string): Seeded {
  const bySlug = new Map(p.rows.map((r) => [r.slug, r]));
  const cc = majorityCountry(p.rows);
  const ordered = p.order.map((s) => bySlug.get(s)).filter((r): r is SeedRow => r !== undefined);
  const inCountry = ordered.filter((r) => r.country === cc);
  const kept = inCountry.slice(0, SEED_MAX_PICKS);
  const skipped = p.order.length - kept.length;
  const nights = Math.max(1, p.days - 1);
  const kind = kindOfDraft(nights, 'trip');
  const range = nightsRange(kind);
  const total = Math.min(Math.max(nights, range.min), range.max);
  const base = newFlow(id, nowIso);
  const picks: PlanPick[] = kept.map((r) => ({ ref: r.ref, slug: r.slug, name: r.name, must: false }));
  const regions = cc
    ? [...new Set(kept.filter((r) => r.region).map((r) => regionIdOf(cc, r.region)))].filter((r) => p.offeredRegions === null || p.offeredRegions.has(r))
    : [];
  const chosen: PlanBaseChoice[] = p.bases.slice(0, MAX_BASES).map((b) => ({ town: b.town, nights: b.nights > 0 ? b.nights : null, pinned: true }));
  const info: Record<string, BaseInfo> = Object.fromEntries(p.bases.slice(0, MAX_BASES).map((b) => [b.town, { name: b.name, lat: b.lat, lon: b.lon }]));
  const k = kindDef(kind);
  const state: FlowState = {
    ...base,
    kind,
    stage: 1,
    nights: total,
    cc,
    ccName: cc ? countryName(cc) : null,
    regions,
    picks,
    visit: Object.fromEntries(picks.map((x) => [x.ref, null])),
    pickAreas: Object.fromEntries(kept.filter((r) => r.region).map((r) => [r.ref, areaWords(r.region)])),
    bases: clampBases(chosen, total),
    baseInfo: info,
    seed: p.slug,
    seedName: p.title,
    driveLimitMin: k.reachMin ?? base.driveLimitMin,
  };
  return { state, skipped: Math.max(0, skipped) };
}
