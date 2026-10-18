import { globeIndex, listPlaces, listTrips } from '@/lib/public';
import type { GlobeCard, GlobeData } from './types';

const DEPTH_BADGE: Record<string, string> = { full: 'Full plan', summary: 'Condensed from the full plan', overview: 'Overview only' };

/**
 * Server-side: the pins and the cards behind them, as plain JSON for the client (the globe page, and the home page's
 * cover globe). Only listed trips are pinned, so a private trip never reaches the page (README 2.3).
 */
export function buildGlobeData(): GlobeData {
  const idx = globeIndex();
  const places = new Map(listPlaces().map((p) => [p.slug, p]));
  const trips = new Map(listTrips().map((t) => [t.slug, t]));
  const cards: Record<string, GlobeCard> = {};
  const pins = [];
  for (const pin of idx.pins) {
    const key = `${pin.kind}:${pin.slug}`;
    if (pin.kind === 'place') {
      const p = places.get(pin.slug);
      if (!p) continue;
      cards[key] = {
        key, kind: 'place', slug: p.slug, title: p.name, kindLabel: p.kindLabel, glyph: p.kind, areaLabel: p.areaLabel,
        photo: p.photo ? { url: p.photo.url, width: p.photo.width, author: p.photo.author, licence: p.photo.licence, sourceUrl: p.photo.sourceUrl } : null,
        badge: p.completeness.label, approx: pin.approx, href: `/places/${p.slug}/`,
      };
    } else {
      const t = trips.get(pin.slug);
      if (!t) continue;
      cards[key] = {
        key, kind: 'trip', slug: t.slug, title: t.title, kindLabel: 'Trip', glyph: 'trip', areaLabel: t.region,
        photo: t.cover ? { url: t.cover.url, width: t.cover.width, author: t.cover.author, licence: t.cover.licence, sourceUrl: t.cover.sourceUrl } : null,
        badge: DEPTH_BADGE[t.depth] ?? null, approx: pin.approx, href: `/trips/${t.slug}/`,
      };
    }
    pins.push(pin);
  }
  // Trip counts in the tree include only listed trips already (the adapter builds them from public trips).
  return { index: { continents: idx.continents, pins }, cards };
}

/** Slugs the static export pre-renders under /globe/place and /globe/trip: the pinned ones. */
export function pinnedSlugs(kind: 'place' | 'trip'): string[] {
  return buildGlobeData().index.pins.filter((p) => p.kind === kind).map((p) => p.slug);
}
