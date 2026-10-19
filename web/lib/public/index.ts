import { buildGlobe, globePathsOf } from './globe';
import { buildPlaces } from './places';
import { buildTrips } from './trips';
import { DropLog, type DroppedText } from './dateless';
import { scrubOrigin } from './origin';
import { loadSources, type SourceOptions } from './sources';
import { placeFacets } from './bands';
import { buildTripTags } from './tags';
import { fromHubsOf, publicWorld, tagLabels } from './world';
import { lengthClass } from '@travel/core/derive/length.ts';
import type { PublicData, PublicPlace, PublicPlaceCard, PublicTrip, PublicTripCard } from './types';

export * from './types';
export { photoSrcSet, commonsUrl } from './photos';
export { computeCompleteness } from './completeness';

const card = <T extends PublicPlace>(p: T): Omit<PublicPlaceCard, 'type' | 'bands'> => {
  const { elevationM: _e, access: _a, lines: _l, facts: _f, hazards: _h, links: _k, seasonNote: _s, photos: _p, wikidata: _w, notes: _n, minAge: _m, booking: _b, ...c } = p;
  void [_e, _a, _l, _f, _h, _k, _s, _p, _w, _n, _m, _b];
  return c;
};
const tripCard = (t: PublicTrip): Omit<PublicTripCard, 'tags' | 'lengthClass' | 'fromHubs'> => {
  const { bases: _b, days: _d, categories: _c, gallery: _g, effort: _e, ageFit: _a, driveAvgMin: _v, ...c } = t;
  void [_b, _d, _c, _g, _e, _a, _v];
  return c;
};

export interface PublicDataInternals {
  dropped: DroppedText[];
  places: PublicPlace[];
  trips: PublicTrip[];
}

/**
 * Builds the whole read-only dataset once, synchronously, from JSON. Pages call the functions of the default
 * instance below; tests build their own with another root.
 */
export function createPublicData(opts: SourceOptions = {}): PublicData & { internals: PublicDataInternals } {
  const src = loadSources(opts);
  const log = new DropLog();
  const pb = buildPlaces(src);
  const tb = buildTrips(src, pb, log);
  // the household's home town never reaches a public path: names, titles, notes and points near it
  scrubOrigin(pb.places);
  scrubOrigin(tb.trips);
  const listed = new Map([...tb.built].filter(([, slug]) => tb.trips.find((t) => t.slug === slug)?.visibility === 'public'));
  const tripsBySlug = new Map(tb.trips.map((t) => [t.slug, t]));
  const globe = buildGlobe(src.root, pb.places, tb.trips.filter((t) => t.visibility === 'public'), listed);
  // facets for the list filters: the type and the bands of each place, the tags of each public trip (L3b)
  const world = publicWorld(src.root);
  const facets = placeFacets(world, src.root, pb.places, pb.byProtoId);
  const cards = pb.places.map((p): PublicPlaceCard => ({ ...card(p), type: facets.get(p.slug)?.type ?? null, bands: facets.get(p.slug)!.bands }));
  const folderOfSlug = new Map([...tb.built].map(([folder, slug]) => [slug, folder]));
  const labels = tagLabels(src.root);
  const refOfSlug = new Map([...facets].map(([slug, f]) => [slug, f.ref]));
  const publicTrips = tb.trips.filter((t) => t.visibility === 'public');
  const tripCards = publicTrips.map((t): PublicTripCard => ({
    ...tripCard(t),
    tags: buildTripTags(t, { root: src.root, world, folder: folderOfSlug.get(t.slug) ?? '', placeBySlug: pb.bySlug, refOfSlug, tagLabel: (id) => labels.get(id) ?? null }),
    lengthClass: t.nights === null ? null : lengthClass(t.nights),
    fromHubs: fromHubsOf(src.root, t.slug),
  }));
  return {
    listTrips: () => tripCards,
    getTrip: (slug) => tripsBySlug.get(slug) ?? null,
    tripSlugs: () => tb.trips.map((t) => t.slug),
    listPlaces: () => cards,
    getPlace: (slug) => pb.bySlug.get(slug) ?? null,
    placeSlugs: () => pb.places.map((p) => p.slug),
    globeIndex: () => globe,
    globePaths: () => globePathsOf(globe),
    legacyPlaceRedirects: () => [...pb.legacyPaths].map(([from, slug]) => ({ from, to: `/places/${slug}/` })).sort((a, b) => a.from.localeCompare(b.from)),
    internals: { dropped: log.items, places: pb.places, trips: tb.trips },
  };
}

let shared: ReturnType<typeof createPublicData> | null = null;
const data = () => (shared ??= createPublicData());

export const listTrips = (): PublicTripCard[] => data().listTrips();
export const getTrip = (slug: string): PublicTrip | null => data().getTrip(slug);
export const tripSlugs = (): string[] => data().tripSlugs();
export const listPlaces = (): PublicPlaceCard[] => data().listPlaces();
export const getPlace = (slug: string): PublicPlace | null => data().getPlace(slug);
export const placeSlugs = (): string[] => data().placeSlugs();
export const globeIndex = () => data().globeIndex();
export const globePaths = (): string[][] => data().globePaths();
export const legacyPlaceRedirects = () => data().legacyPlaceRedirects();
