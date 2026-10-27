import { nameCores } from '@travel/core/trips/summary.ts';
import type { Photo } from '@/lib/public/types';

/** One row of the plan a gallery section can name: a stop (place, trail, activity) with the days it is on. */
export interface PlanRow {
  name: string;
  placeSlug: string | null;
  days: readonly number[];
}

/** A piece of a section heading: plain text, or a link to the place page of the plan row that segment names. */
export interface HeadingPart {
  text: string;
  slug: string | null;
}

export interface PhotoGroup {
  /** The gallery section's own name; null for photos that sit in no section. */
  name: string | null;
  photos: Photo[];
  /** The heading as parts that join back into `name`; each place the section names is its own link, so no link points at a place the words do not say. */
  parts: HeadingPart[];
  /** The plan days that visit what the section names, ascending; empty when no row matches reliably (no day sign is better than a guessed one). */
  days: number[];
  /** True when the plan has rows and none of them is this section: "Nearby, not in this plan". Never true for a trip with no rows or for a theme. */
  nearby: boolean;
  /** True when the section names a place of this plan (it has at least one matching row). */
  inPlan: boolean;
}

/** PP and NP are how the plan abbreviates a park; a section spells it out. */
const norm = (s: string): string =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\bpp\b/g, 'provincial park').replace(/\bnp\b/g, 'national park').replace(/[^a-z0-9]+/g, ' ').trim();
const hasPhrase = (hay: string, needle: string): boolean => ` ${hay} `.includes(` ${needle} `);

/** One word that names a kind of thing, not a place ("Park and Ride" is not "Provincial Park"): never a match on its own. */
const GENERIC = new Set(['park', 'ride', 'lake', 'lakes', 'pass', 'road', 'trail', 'view', 'falls', 'canyon', 'village', 'lot', 'parking', 'valley', 'river', 'mountain', 'town', 'meadows', 'glacier', 'drive', 'loop', 'walk', 'hike', 'bridge', 'center', 'centre', 'station', 'visitor', 'upper', 'lower']);
const usable = (core: string): boolean => core.split(' ').length >= 2 || !GENERIC.has(core);
const expand = (s: string): string => s.replace(/\bPP\b/g, 'Provincial Park').replace(/\bNP\b/g, 'National Park');
const coresOf = (name: string): string[] => nameCores(expand(name)).filter(usable);

/** A section name cut where nameCores cuts it ("and", "&", ":", ",", "/"), separators kept so the pieces join back into the name. */
function segments(name: string): string[] {
  return name.split(/(\s+(?:and|&)\s+|[:,/]\s*)/i).filter((s) => s !== '');
}
const isSep = (s: string): boolean => /^(?:\s+(?:and|&)\s+|[:,/]\s*)$/i.test(s);

/**
 * The gallery's sections in the gallery's own order, each matched to the plan rows whose name it carries ("Lake Louise and Lake Agnes" holds
 * "Lake Louise"; "Tre Cime loop" is "Tre Cime"). Matching is per segment of the heading, so each place it names links to its own page and
 * days come only from rows that name what the section names. A one-word generic core ("park") never matches. A section no row names is
 * "nearby, not in this plan" only when the plan has rows to compare with and the name reads like a place.
 */
export function photoGroups(photos: readonly Photo[], rows: readonly PlanRow[]): PhotoGroup[] {
  const order: (string | null)[] = [];
  const by = new Map<string | null, Photo[]>();
  for (const p of photos) {
    const g = p.group?.trim() || null;
    if (!by.has(g)) {
      by.set(g, []);
      order.push(g);
    }
    by.get(g)!.push(p);
  }
  const cored = rows.map((r) => ({ r, cores: coresOf(r.name), n: norm(r.name) }));
  return order.map((name) => {
    const list = by.get(name)!;
    if (name === null) return { name, photos: list, parts: [], days: [], nearby: false, inPlan: false };
    const days = new Set<number>();
    const linked = new Set<string>();
    let inPlan = false;
    const parts = segments(name).map((seg): HeadingPart => {
      if (isSep(seg)) return { text: seg, slug: null };
      const core = norm(seg.replace(/\s+(?:lookout|viewpoint|overlook|scenic drive|drive|loop|trail|walk|hike|circuit|route)$/i, ''));
      if (!core || !usable(core)) return { text: seg, slug: null };
      // a row whose own name the segment carries first; only when none does, a row whose name carries the segment
      const exact = cored.filter(({ cores }) => cores.some((c) => hasPhrase(core, c)));
      const hit = exact.length ? exact : cored.filter(({ n }) => hasPhrase(n, core));
      if (!hit.length) return { text: seg, slug: null };
      inPlan = true;
      for (const { r } of hit) for (const d of r.days) days.add(d);
      const slug = hit.find(({ r }) => r.placeSlug && !linked.has(r.placeSlug))?.r.placeSlug ?? null;
      if (slug) linked.add(slug);
      return { text: seg, slug };
    });
    return { name, photos: list, parts, days: [...days].sort((a, b) => a - b), nearby: rows.length > 0 && !inPlan && looksLikePlace(name), inPlan };
  });
}

/** A section named like a place has a capital beyond its first word ("Mount Assiniboine and the Sunshine Meadows"); a theme ("Larches and early autumn") has none, and is not a place the plan could have visited. */
const looksLikePlace = (name: string): boolean => name.split(/\s+/).slice(1).some((w) => /^\p{Lu}/u.test(w));

/** "Day 11", "Days 3 and 10", "Days 4, 8 and 12". */
export function daysLabel(days: readonly number[]): string {
  if (days.length === 0) return '';
  if (days.length === 1) return `Day ${days[0]}`;
  return `Days ${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`;
}

/** How the gallery is counted, said once for the Summary card and the tab: sections, never "places" (a theme and a nearby park are sections too). */
export const sectionsLabel = (n: number): string => `${n} ${n === 1 ? 'section' : 'sections'}`;
