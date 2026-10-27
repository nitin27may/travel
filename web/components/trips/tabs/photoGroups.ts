import { nameCores } from '@travel/core/trips/summary.ts';
import type { Photo } from '@/lib/public/types';

/** One row of the plan a gallery section can name: a stop (place, trail, activity) with the days it is on. */
export interface PlanRow {
  name: string;
  placeSlug: string | null;
  days: readonly number[];
}

export interface PhotoGroup {
  /** The gallery section's own name; null for photos that sit in no section. */
  name: string | null;
  photos: Photo[];
  /** The place page of the first plan row the section names, when that row has one. */
  placeSlug: string | null;
  /** The plan days that visit it, ascending. */
  days: number[];
  /** True when the plan has rows and none of them is this section: "Nearby, not in this plan". Never true for a trip with no rows. */
  nearby: boolean;
}

const norm = (s: string): string => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const hasPhrase = (hay: string, needle: string): boolean => ` ${hay} `.includes(` ${needle} `);

/**
 * The gallery's sections in the gallery's own order, each matched to the plan rows whose name it carries ("Lake Louise and Lake Agnes" holds
 * "Lake Louise"; "Tre Cime loop" is "Tre Cime"). A section no row names is "nearby, not in this plan" only when the plan has rows to
 * compare with: an overview trip has none, so nothing is labelled.
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
  const cored = rows.map((r) => ({ r, cores: nameCores(r.name) }));
  return order.map((name) => {
    const list = by.get(name)!;
    if (name === null) return { name, photos: list, placeSlug: null, days: [], nearby: false };
    const hay = norm(name);
    const secCores = nameCores(name);
    // a row whose own name the section carries first; only when none does, a row whose name carries a phrase of the section ("Mount Robson" in "Mount Robson Visitor Centre viewpoint")
    const exact = cored.filter(({ cores }) => cores.some((c) => hasPhrase(hay, c)));
    const hit = exact.length ? exact : cored.filter(({ r }) => secCores.some((c) => hasPhrase(norm(r.name), c)));
    const days = [...new Set(hit.flatMap(({ r }) => r.days))].sort((a, b) => a - b);
    const placeSlug = hit.find(({ r }) => r.placeSlug)?.r.placeSlug ?? null;
    return { name, photos: list, placeSlug, days, nearby: rows.length > 0 && hit.length === 0 && looksLikePlace(name) };
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
