import { publicModel } from './aliases';
import { buildGlobe, globePathsOf } from './globe';
import { buildPlaces } from './places';
import { buildTrips } from './trips';
import { DropLog, type DroppedText } from './dateless';
import { scrubOrigin } from './origin';
import { loadSources, type SourceOptions } from './sources';
import { placeFacets } from './bands';
import { attachEntry } from './entry';
import { buildTripTags } from './tags';
import type { TagConflict } from './tags';
import { fromHubsOf, publicWorld, tagLabels } from './world';
import { attachItemSuit, buildPageExtras, mapLegacyFacts } from './pages';
import { lengthClass } from '@travel/core/derive/length.ts';
import type { PublicData, PublicPlace, PublicPlaceCard, PublicTrip, PublicTripCard } from './types';

export * from './types';
export { photoSrcSet, commonsUrl } from './photos';
export { computeCompleteness } from './completeness';

const card = <T extends PublicPlace>(p: T): Omit<PublicPlaceCard, 'type' | 'bands' | 'badge'> => {
  const { elevationM: _e, access: _a, lines: _l, facts: _f, hazards: _h, links: _k, seasonNote: _s, photos: _p, wikidata: _w, notes: _n, minAge: _m, booking: _b, sections: _x, suitability: _u, relevance: _r, refSlugs: _g, ...c } = p;
  void [_e, _a, _l, _f, _h, _k, _s, _p, _w, _n, _m, _b, _x, _u, _r, _g];
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
  /** Hand-typed Kids from and Hike effort that the scheduler's value replaced, where they differ. */
  tagReport: TagConflict[];
  /** page slug -> the page's identity key (its `ref`: a capture ref, else `place/<slug>`), D-B2, A24. JsonStore reads it for every row and detail. */
  refBySlug: Map<string, string>;
  /** identity key -> slug, merged records included: what data/catalogue/slugs.json pins (D-B1). */
  slugByRef: Map<string, string>;
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
  const world = publicWorld(src.root);
  // the parks each trip enters and the Book ahead rows its mapped requirement records give (PA-W; server only, the graph index never leaves here)
  attachEntry(tb.trips, { root: src.root, world, pages: pb });
  // the household's home town never reaches a public path: names, titles, notes and points near it
  scrubOrigin(pb.places);
  scrubOrigin(tb.trips);
  const listed = new Map([...tb.built].filter(([, slug]) => tb.trips.find((t) => t.slug === slug)?.visibility === 'public'));
  const tripsBySlug = new Map(tb.trips.map((t) => [t.slug, t]));
  const globe = buildGlobe(src.root, pb.places, tb.trips.filter((t) => t.visibility === 'public'), listed);
  // facets for the list filters: the type and the bands of each place, the tags of each public trip (L3b)
  const facets = placeFacets(world, src.root, pb.places, pb.byProtoId, pb.byCaptureRef);
  // the capture contract's half of each place page (S1): sections, who it suits, relevance, and the research level from the engine
  const { extras } = buildPageExtras(src.root, world, pb.places, new Map([...facets].map(([slug, f]) => [slug, f.ref])), log);
  for (const p of pb.places) {
    const x = extras.get(p.slug);
    if (!x) continue;
    mapLegacyFacts(p, x.sections);
    p.sections = x.sections;
    p.suitability = x.suitability;
    p.relevance = x.relevance;
    p.refSlugs = x.refSlugs;
    p.completeness = x.completeness;
  }
  attachItemSuit(tb.trips, pb.bySlug);
  const cards = pb.places.map((p): PublicPlaceCard => ({ ...card(p), type: facets.get(p.slug)?.type ?? null, bands: facets.get(p.slug)!.bands, badge: p.relevance?.badge?.label ?? null }));
  const folderOfSlug = new Map([...tb.built].map(([folder, slug]) => [slug, folder]));
  const labels = tagLabels(src.root);
  const refOfSlug = new Map([...facets].map(([slug, f]) => [slug, f.ref]));
  const tagReport: TagConflict[] = [];
  const publicTrips = tb.trips.filter((t) => t.visibility === 'public');
  const tripCards = publicTrips.map((t): PublicTripCard => ({
    ...tripCard(t),
    tags: buildTripTags(t, { root: src.root, world, folder: folderOfSlug.get(t.slug) ?? '', placeBySlug: pb.bySlug, refOfSlug, tagLabel: (id) => labels.get(id) ?? null }, tagReport),
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
    internals: { dropped: log.items, places: pb.places, trips: tb.trips, tagReport, refBySlug: pb.refBySlug, slugByRef: pb.slugByRef },
  };
}

let shared: ReturnType<typeof createPublicData> | null = null;
const data = () => (shared ??= createPublicData());

/** The one dataset of this process: the pages, the prerendered JSON routes and the API store (web/lib/server/store.ts) all read it, so none can disagree. */
export const sharedPublicData = (): ReturnType<typeof createPublicData> => data();

// Every getter below returns the PUBLIC form (public-ref-aliases 5.1 B2): refs with a dated trip folder carry its alias, so element ids,
// row ids, RSC payloads, data-* attributes and keys built from a ref never hold a month. `sharedPublicData()` and `createPublicData()` stay
// internal (the JsonStore, wrapped by publicStore in lib/server/store.ts, aliases their answers at the API boundary).
export const listTrips = (): PublicTripCard[] => publicModel(data().listTrips());
export const getTrip = (slug: string): PublicTrip | null => publicModel(data().getTrip(slug));
export const tripSlugs = (): string[] => data().tripSlugs();
export const listPlaces = (): PublicPlaceCard[] => publicModel(data().listPlaces());
export const getPlace = (slug: string): PublicPlace | null => publicModel(data().getPlace(slug));
export const placeSlugs = (): string[] => data().placeSlugs();
export const globeIndex = () => publicModel(data().globeIndex());
export const globePaths = (): string[][] => data().globePaths();
export const legacyPlaceRedirects = () => publicModel(data().legacyPlaceRedirects());
