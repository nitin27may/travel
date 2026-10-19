import { globeIndex, listPlaces, listTrips } from '@/lib/public';
import type { GlobeCard, GlobeCardFile, GlobeData, GlobeTree, GlobeTreeNode, LightPin } from './types';

const DEPTH_BADGE: Record<string, string> = { full: 'Full plan', summary: 'Condensed from the full plan', overview: 'Overview only' };

/**
 * Server-side, at build time: every pin and every card, in memory. The site never ships this as one object: the build splits
 * it into the files below (backlog 2.39) and the browser loads the tree, then one country of pins, then one card at a time.
 * Only listed trips are pinned, so a private trip never reaches the output (README 2.3).
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
    pins.push({ ...pin, kindLabel: cards[key].kindLabel });
  }
  // Trip counts in the tree include only listed trips already (the adapter builds them from public trips).
  return { index: { continents: withCentres(idx.continents, pins), pins }, cards };
}

const mean = (pins: LightPin[]): [number, number] | null =>
  pins.length ? [pins.reduce((n, p) => n + p.lon, 0) / pins.length, pins.reduce((n, p) => n + p.lat, 0) / pins.length] : null;

/** Gives each country the point its disc sits on in the world view, so that view needs no pins. */
function withCentres(continents: GlobeTree['continents'], pins: LightPin[]): GlobeTree['continents'] {
  return continents.map((c) => ({
    ...c,
    countries: c.countries.map((n): GlobeTreeNode => ({ ...n, at: mean(pins.filter((p) => p.path[0] === n.slug && !p.approx)) })),
  }));
}

/** The files the globe loads, built once per build. */
export interface GlobeFiles {
  tree: GlobeTree;
  /** Country slug (`xx` when a pin has no country) to the light pins under it. */
  pins: Record<string, LightPin[]>;
  /** `<kind>/<slug>` to the card file. */
  cards: Record<string, GlobeCardFile>;
}

let files: GlobeFiles | null = null;
export function buildGlobeFiles(): GlobeFiles {
  if (files) return files;
  const data = buildGlobeData();
  const pins: Record<string, LightPin[]> = {};
  const cards: Record<string, GlobeCardFile> = {};
  for (const pin of data.index.pins) {
    (pins[pin.path[0] ?? 'xx'] ??= []).push(pin);
    const key = `${pin.kind}:${pin.slug}`;
    cards[`${pin.kind}/${pin.slug}`] = { card: data.cards[key], pin };
  }
  files = { tree: { continents: data.index.continents }, pins, cards };
  return files;
}

/** The tree for the home cover: countries with their centre and counts, no states or districts. */
export function coverTree(): GlobeTree {
  const { tree } = buildGlobeFiles();
  return { continents: tree.continents.map((c) => ({ ...c, countries: c.countries.map((n) => ({ ...n, children: [] })) })) };
}

/** Slugs the static export pre-renders under /globe/place and /globe/trip: the pinned ones. */
export function pinnedSlugs(kind: 'place' | 'trip'): string[] {
  return buildGlobeData().index.pins.filter((p) => p.kind === kind).map((p) => p.slug);
}
