import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { travelRoot } from '@/lib/data/root';
import { seasonLabel } from '@/lib/format/season';
import { getPlace, getTrip, globeIndex, listPlaces, listTrips } from '@/lib/public';
import { describesParty } from '@/lib/public/party';
import { normName } from '@/lib/public/places';
import { photoUrl } from '@/lib/server/images';
import type { CardFact, CardImage, GlobeCard, GlobeCardFile, GlobeData, GlobeTree, GlobeTreeNode, LightPin } from './types';

const DEPTH_BADGE: Record<string, string> = { full: 'Full plan', summary: 'Condensed from the full plan', overview: 'Overview only' };
const KID_FACT: Record<string, string> = { yes: 'Easy with kids', 'strong-kid': 'Older or strong kids', no: 'Not for kids' };

interface P18Row { file?: string; author?: string; licence?: string; licenceUrl?: string | null; sourceUrl?: string; none?: boolean }

/** The Wikidata P18 images with their Commons credits, looked up by `web/scripts/globe-images.mjs` and committed. The build never asks Wikidata. */
export function readP18(root = travelRoot()): Record<string, P18Row> {
  const file = path.join(root, 'data', 'reference', 'globe', 'p18.json');
  if (!existsSync(file)) return {};
  try { return JSON.parse(readFileSync(file, 'utf8')) as Record<string, P18Row>; } catch { return {}; }
}

/** At most 120 characters, cut at a word, and never a sentence about who travelled (principle P8, privacy). */
export function cardSummary(text: string): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || describesParty(t)) return '';
  const first = /^(.+?[.!?])(\s|$)/.exec(t)?.[1] ?? t;
  if (first.length <= 120) return first;
  const cut = first.slice(0, 119);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 60)).replace(/[,;:\s-]+$/, '')}\u2026`;
}

const credited = (p: { author: string; licence: string; url: string; width: number; sourceUrl: string } | null | undefined, from: CardImage['from']): CardImage | null =>
  p && p.author && p.licence && p.url ? { url: p.url, width: p.width, author: p.author, licence: p.licence, sourceUrl: p.sourceUrl, from } : null;

const commonsAt = (file: string, width = 640): string | null => photoUrl(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}?width=${width}`);

/**
 * The image behind a place card, by the fallback chain (spec 4.3): the place's own credited photo; the gallery photo of a public
 * trip that uses the place and is filed under it; the Wikidata P18 image with its credit; else none (the card shows a compact header).
 */
export function placeImage(
  place: { name: string; photo: Parameters<typeof credited>[0]; trips: { slug: string }[]; wikidata?: string | null },
  galleryOf: (slug: string) => { group: string | null; author: string; licence: string; url: string; width: number; sourceUrl: string }[],
  p18: Record<string, P18Row>,
): CardImage | null {
  const own = credited(place.photo, 'place');
  if (own) return own;
  const n = normName(place.name);
  for (const t of place.trips) {
    const hit = galleryOf(t.slug).find((g) => g.group && normName(g.group) === n && credited(g, 'trip'));
    if (hit) return credited(hit, 'trip');
  }
  const row = place.wikidata ? p18[place.wikidata] : undefined;
  const p18Url = row && !row.none && row.file ? commonsAt(row.file) : null;
  if (row?.file && p18Url && row.author && row.licence) return { url: p18Url, width: 640, author: row.author, licence: row.licence, sourceUrl: row.sourceUrl ?? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(row.file)}`, from: 'wikidata' };
  return null;
}

/**
 * Server-side, at build time: every pin and every card, in memory. The site never ships this as one object: the build splits
 * it into the files below (backlog 2.39) and the browser loads the tree, then one country of pins, then one card at a time.
 * Only listed trips are pinned, so a private trip never reaches the output (README 2.3).
 */
export function buildGlobeData(): GlobeData {
  const idx = globeIndex();
  const places = new Map(listPlaces().map((p) => [p.slug, p]));
  const trips = new Map(listTrips().map((t) => [t.slug, t]));
  const p18 = readP18();
  const galleryOf = (slug: string) => getTrip(slug)?.gallery ?? [];
  const dayOf = (tripSlug: string, placeSlug: string): number | null => getTrip(tripSlug)?.days.find((d) => d.items.some((i) => i.placeSlug === placeSlug) || d.tracks?.some((t) => t.items.some((i) => i.placeSlug === placeSlug)))?.n ?? null;
  const cards: Record<string, GlobeCard> = {};
  const pins = [];
  for (const pin of idx.pins) {
    const key = `${pin.kind}:${pin.slug}`;
    if (pin.kind === 'place') {
      const p = places.get(pin.slug);
      if (!p) continue;
      const full = getPlace(p.slug);
      const facts: CardFact[] = [];
      const months = seasonLabel(p.season);
      if (months) facts.push({ label: 'Best months', text: months });
      if (KID_FACT[p.kidFit]) facts.push({ label: 'Kids', text: KID_FACT[p.kidFit] });
      // Up to three facts from what the card already holds (review S10): length or elevation, then climb and time for a trail, then a minimum age.
      if (p.stats.distanceKm) facts.push({ label: 'Length', distanceKm: p.stats.distanceKm });
      if (typeof full?.elevationM === 'number' && !p.stats.distanceKm) facts.push({ label: 'Elevation', elevationM: full.elevationM });
      if (p.stats.gainM) facts.push({ label: 'Climb', elevationM: p.stats.gainM });
      if (p.stats.hours) facts.push({ label: 'Time', text: /^[\d.]+$/.test(String(p.stats.hours)) ? `${p.stats.hours} h` : String(p.stats.hours) });
      if (typeof full?.minAge === 'number' && full.minAge > 0) facts.push({ label: 'Age', text: `${full.minAge}+` });
      const first = p.trips[0];
      cards[key] = {
        key, kind: 'place', slug: p.slug, title: p.name, kindLabel: p.kindLabel, glyph: p.kind, areaLabel: p.areaLabel,
        summary: cardSummary(p.summary), facts: facts.slice(0, 3),
        usedIn: first ? { slug: first.slug, title: first.title, day: dayOf(first.slug, p.slug) } : null,
        image: placeImage({ name: p.name, photo: p.photo, trips: p.trips, wikidata: full?.wikidata ?? null }, galleryOf, p18),
        badge: p.completeness.level === 'draft' ? null : p.completeness.label, approx: pin.approx, href: `/places/${p.slug}/`,
      };
    } else {
      const t = trips.get(pin.slug);
      if (!t) continue;
      const full = getTrip(t.slug);
      const facts: CardFact[] = [];
      if (t.nights) facts.push({ label: 'Length', text: `${t.nights} nights` });
      if (t.season && !t.seasonNotSet) facts.push({ label: 'Season', text: t.season.label });
      if (full?.bases.length) facts.push({ label: 'Bases', text: `${full.bases.length} ${full.bases.length === 1 ? 'base' : 'bases'}` });
      cards[key] = {
        key, kind: 'trip', slug: t.slug, title: t.title, kindLabel: 'Trip', glyph: 'trip', areaLabel: t.region,
        summary: cardSummary(t.subtitle), facts: facts.slice(0, 3), usedIn: null,
        image: credited(t.cover, 'trip') ?? (() => { const g = galleryOf(t.slug).find((x) => credited(x, 'trip')); return g ? credited(g, 'trip') : null; })(),
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
