// The capture-contract half of a place page (S1 Part B): for every place that has a capture record, the 14 sections, the
// "Who it suits" block and the relevance blocks, plus the research level from the core engine. Server only (reads files);
// never import it from a client file. The page components read the result from `PublicPlace`, never the files (P9).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { completeness as engineCompleteness } from '@travel/core/capture/engine.ts';
import { primaryRef, type World } from '@travel/core/capture/records.ts';
import { defaultContract, type Contract } from './contract';
import type { DropLog } from './dateless';
import { loadRelevanceContext, publicRelevance, type PublicRelevance } from './relevance';
import { scrubMarkers } from './prose';
import { buildSections, type PageModel } from './sections';
import { publicSuitability, suitMarksFor, type PublicSuitability } from './suitability';
import type { Completeness, CompletenessLevel, ItemSuit, PublicPlace, PublicTrip } from './types';
import { TextScrub } from './vals';

/** What the contract adds to one place. */
export interface PageExtras {
  sections: PageModel;
  suitability: PublicSuitability | null;
  relevance: PublicRelevance;
  /** page slug of every place or route the model links to, so a ref becomes a link; refs without a page are plain text */
  refSlugs: Record<string, string>;
  completeness: Completeness;
}

/** The public words for a research level. "Draft" is the workshop's word and never reaches a visitor (3.42). */
export const LEVEL_WORDS = { draft: 'Basics only', usable: 'Partly checked', complete: 'Checked' } as const satisfies Record<CompletenessLevel, string>;

/**
 * "Basics only", "Partly checked · 7 of 11" or "Checked". The engine's level orders and filters; the words also say how far a
 * page has got: a record short of its required checks but with half or more answered reads "Partly checked", not "Basics only".
 */
export function levelLabel(level: CompletenessLevel, passed: number, total: number): string {
  if (level === 'complete') return LEVEL_WORDS.complete;
  if (level === 'usable' || (total > 0 && passed * 2 >= total)) return `${LEVEL_WORDS.usable} · ${passed} of ${total}`;
  return LEVEL_WORDS.draft;
}

const engineLevel = (l: string | undefined): CompletenessLevel => (l === 'complete' ? 'complete' : l === 'usable' || l === 'usable_partial' ? 'usable' : 'draft');

/** The page's research level from the core engine: the place checks done out of asked, and what is missing. */
function completenessOf(world: World, ref: string, model: PageModel, contract: Contract): Completeness {
  const comp = engineCompleteness(world, ref);
  const level = engineLevel(comp?.level);
  const { done, total } = model.checks;
  const keys = comp ? [...comp.missingBase, ...comp.missingSuitability, ...comp.conditionalMissing] : [];
  const failed = keys.map((k) => ({ id: `check:${k}`, label: contract.properties[k]?.label ?? k.replace(/[._]/g, ' '), hint: contract.properties[k]?.gap ?? 'Not checked yet.' }));
  return {
    level,
    passed: done,
    total,
    notTracked: 0,
    failed,
    label: levelLabel(level, done, total),
    tooltip: `${done} of ${total} place checks done`,
  };
}

/** Runs every string of a built block through the text scrub, in place: whatever path a sentence took, no process note or file name survives (3.27). */
function deepScrub<T>(value: T, scrub: TextScrub, where: string): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return v.length > 24 ? scrub.text(v, where) : v;
    if (Array.isArray(v)) {
      v.forEach((x, i) => (v[i] = walk(x)));
    } else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      for (const k of Object.keys(o)) if (k !== 'ref' && k !== 'url') o[k] = walk(o[k]);
    }
    return v;
  };
  return walk(value) as T;
}

/** Every ref a model mentions, for the ref-to-slug table. */
function refsIn(value: unknown, out: Set<string>): void {
  if (Array.isArray(value)) for (const v of value) refsIn(v, out);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if ((k === 'ref' || k === 'judgedRef' || k === 'suitabilityRef') && typeof v === 'string') out.add(v);
      else refsIn(v, out);
    }
  }
}

export interface PageBuild {
  extras: Map<string, PageExtras>;
}

/**
 * The extras of every place that has a capture record. `refOfSlug` is the join of the adapter (bands.ts); a place without a
 * record gets nothing here and keeps the older page. Each sentence the text scrub drops goes to `log`, so the build report lists it.
 */
export function buildPageExtras(root: string, world: World, places: readonly Pick<PublicPlace, 'slug'>[], refOfSlug: ReadonlyMap<string, string | null>, log: DropLog): PageBuild {
  const extras = new Map<string, PageExtras>();
  if (!existsSync(path.join(root, 'data', 'schema', 'capture', 'contract.json'))) return { extras };
  const contract = defaultContract(root);
  const scrub = new TextScrub(log);
  const ctx = loadRelevanceContext(world, root, scrub);
  const slugOfRef = new Map<string, string>();
  for (const p of places) {
    const ref = refOfSlug.get(p.slug);
    if (ref) slugOfRef.set(primaryRef(world, ref), p.slug);
  }
  const slugFor = (ref: string): string | null => {
    const r = primaryRef(world, ref);
    // a folded part (`part/<parent>#slug`) resolves through its parent page
    return slugOfRef.get(r) ?? slugOfRef.get(primaryRef(world, r.replace(/^(?:part|offer)\//, '').split('#')[0]!)) ?? null;
  };
  for (const p of places) {
    const ref = refOfSlug.get(p.slug);
    if (!ref) continue;
    const model = buildSections(world, ref, contract, { scrub });
    if (!model) continue;
    const suitLoc = model.suitabilityRef ? world.suit.get(model.suitabilityRef) : undefined;
    const suitType = model.suitabilityRef ? (world.cap.get(model.suitabilityRef)?.rec.type ?? model.type) : model.type;
    const suitability = suitLoc
      ? publicSuitability(suitLoc, { suitMarks: suitMarksFor(contract, suitType) ?? undefined, slot3: contract.slot3For(suitType), scrub })
      : null;
    const relevance = publicRelevance(ctx, ref);
    const refs = new Set<string>();
    refsIn([model, relevance], refs);
    const refSlugs: Record<string, string> = {};
    for (const r of refs) {
      const s = slugFor(r);
      if (s && s !== p.slug) refSlugs[r] = s;
    }
    // the last pass over every string of the blocks: a research marker or a dataset word never reaches a page (3.20)
    extras.set(p.slug, scrubMarkers(deepScrub({ sections: model, suitability, relevance, refSlugs, completeness: completenessOf(world, primaryRef(world, ref), model, contract) }, scrub, `page ${p.slug}`)));
  }
  return { extras };
}

/**
 * Attaches `DayItem.suit` to every stop that is a place with a record: its chips (without the time, since the entry shows the
 * duration), the numbers the page needs for the fit chip, and the relevance badge by the rules of relevance 6.2. The first stop of
 * role anchor (else highlight) is the "top stop" of a trip under 4 nights.
 */
export function attachItemSuit(trips: readonly PublicTrip[], placeBySlug: ReadonlyMap<string, PublicPlace>): void {
  for (const trip of trips) {
    const items = trip.days.flatMap((d) => [...d.items, ...(d.tracks ?? []).flatMap((t) => t.items)]);
    const rank = (r: string | null | undefined): number => (r === 'anchor' ? 0 : r === 'highlight' ? 1 : 9);
    const withSlug = items.filter((i) => i.placeSlug && placeBySlug.get(i.placeSlug)?.relevance);
    const top = [...withSlug].sort((a, b) => rank(placeBySlug.get(a.placeSlug!)?.relevance?.role) - rank(placeBySlug.get(b.placeSlug!)?.relevance?.role))[0];
    const long = (trip.nights ?? 0) >= 4;
    for (const it of items) {
      const p = it.placeSlug ? placeBySlug.get(it.placeSlug) : undefined;
      const s = p?.suitability;
      const r = p?.relevance;
      if (!p || (!s && !r)) continue;
      const chips = s ? (s.chips.filter((c): c is NonNullable<typeof c> => c !== null)) : [];
      const badge = r?.badge && r.role === 'anchor' && long ? (r.badge.kind === 'journey' ? r.badge.label : null) : r?.badge && !long && it === top ? 'Local favourite' : null;
      const suit: ItemSuit = {
        chips,
        kidsFrom: s?.kidsFrom ?? null,
        kidsBasis: s?.card.kids?.kind === 'rule' ? 'rule' : s?.card.kids?.kind === 'advice' ? 'advice' : null,
        badge,
      };
      it.suit = suit;
    }
  }
}
