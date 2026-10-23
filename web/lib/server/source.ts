import type { JsonSource, SearchScope } from '@travel/core/catalogue/json/source.ts';
import { readSlugRegistry } from '@/lib/public/places';
import type { SlugRegistry } from '@travel/core/catalogue/slugs.ts';
import type { GlobeFeature, GlobeLine, ParseInput, ParsedQuery, PlaceDetail, PlaceRow, SearchResult, TripDetail, TripRow } from '@travel/core/schema/api/index.ts';
import { placeShards } from '@/app/places/shards';
import { tripListRows } from '@/app/trips/rows';
import { reportLink, reportUrl } from '@/lib/config/product';
import { travelRoot } from '@/lib/data/root';
import { placeDescriptor } from '@/lib/entities/descriptors/place';
import { tripDescriptor } from '@/lib/entities/descriptors/trip';
import { buildGlobeFiles } from '@/lib/globe/data';
import { sharedPublicData } from '@/lib/public';
import type { PublicData } from '@/lib/public';
import { globeLineIds, readGazetteer, readGlobeLine } from '@/lib/public/globe';
import { parse } from '@/lib/search/parse/parse';
import type { ParseOptions, VocabFile } from '@/lib/search/parse/types';
import { buildSearchParts } from '@/lib/search/build';
import { createSearcher, type Searcher } from '@/lib/search/search';
import type { SearchRecord } from '@/lib/search/types';
import vocabJson from '../../public/search/vocab.json';
import { engineFor } from './engine';
import { withRenditions } from './images';
import { exportFileOf } from './exports';
import { isApproxPoint, placeDetailOf } from './placeDetail';
import { registryIds } from './sources';
import { tripDetailOf } from './tripDetail';

// The JsonSource over the site's own dataset (createPublicData(): the one instance the pages read too), in the contract's shapes. Every
// place and trip is mapped once, on first use, and kept; the privacy scrub already ran inside the dataset builder (store.ts A18).

export interface ServerSourceOptions {
  data?: ReturnType<typeof sharedPublicData>;
  registry?: SlugRegistry;
}

const lazy = <T>(make: () => T): (() => T) => {
  let v: { value: T } | null = null;
  return () => (v ??= { value: make() }).value;
};

/** `[kind, name, lon, lat, a3, extra, rank, population, aliases, bbox, lineId]` -> the contract's feature (globe.ts GlobeFeature). */
function featureOf(row: ReturnType<typeof readGazetteer>[number], id: string): GlobeFeature {
  const r = row as unknown as [string, string, number, number, string | null, string | null, number?, number?, string?, [number, number, number, number]?, string?];
  return {
    id, kind: r[0], name: r[1], lon: r[2], lat: r[3], a3: r[4] ?? null, extra: r[5] ?? null, rank: r[6] ?? null, population: r[7] ?? null,
    aliases: r[8] ? r[8].split('|') : [], bbox: r[9] ?? null, lineId: r[10] ?? null,
  };
}

const kebabId = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function createJsonSource(opts: ServerSourceOptions = {}): JsonSource {
  const data: PublicData & { internals: { refBySlug: Map<string, string> } } = opts.data ?? sharedPublicData();
  const root = travelRoot();
  const registry = opts.registry ?? readSlugRegistry(root);
  const ids = registryIds(root);
  const refBySlug = data.internals.refBySlug;
  const cards = new Map(data.listPlaces().map((c) => [c.slug, c]));
  const tripCards = new Map(data.listTrips().map((c) => [c.slug, c]));

  const placeRows: PlaceRow[] = Object.values(placeShards().files).flatMap((rows) =>
    rows.map((r): PlaceRow => {
      const ref = refBySlug.get(r.slug);
      if (!ref) throw new Error(`place ${r.slug} has no ref`);
      // nearTown: null until META-2 derives `near_town` and the row builder carries it (store.ts A35)
      return withRenditions({ ...r, ref, approx: isApproxPoint(data.getPlace(r.slug)?.point), nearTown: null });
    }),
  );
  const tripRows: TripRow[] = tripListRows(data.listTrips()).map((r) => withRenditions({ ...r, ref: `trip/${r.slug}` }) as TripRow);

  const places = new Map<string, PlaceDetail>();
  const trips = new Map<string, TripDetail>();

  // ---- search and parse -------------------------------------------------------------------------------------------------------
  const parts = lazy(() => buildSearchParts());
  const allRecords = lazy((): SearchRecord[] => Object.values(parts().parts).flat());
  const searchers = new Map<string, Searcher>();
  const searcherFor = (scope: SearchScope): Searcher => {
    const key = `${scope.kind ?? ''}|${scope.country ?? ''}`;
    let s = searchers.get(key);
    if (!s) {
      const wanted = parts().manifest.parts.filter((p) => (!scope.kind || p.k === scope.kind) && (!scope.country || p.cc === scope.country));
      s = createSearcher(wanted.flatMap((p) => parts().parts[p.id] ?? []));
      searchers.set(key, s);
    }
    return s;
  };

  // ---- the globe ----------------------------------------------------------------------------------------------------------------
  const gazetteer = lazy(() => {
    const byId = new Map<string, GlobeFeature>();
    readGazetteer().forEach((row, i) => {
      const r = row as unknown as [string, string, number, number, string | null, ...unknown[]];
      const lineId = (row as unknown as unknown[])[10] as string | undefined;
      let id = lineId || kebabId(`${r[0]}-${r[1]}-${r[4] ?? ''}`) || `${r[0]}-${i}`;
      for (let n = 2; byId.has(id); n++) id = `${id.replace(/-\d+$/, '')}-${n}`;
      byId.set(id, featureOf(row, id));
    });
    return byId;
  });

  return {
    registry,
    placeRows,
    placeDetail(slug) {
      let d = places.get(slug);
      if (!d) {
        const p = data.getPlace(slug);
        const ref = refBySlug.get(slug);
        if (!p || !ref) return null;
        const card = cards.get(slug);
        d = withRenditions(placeDetailOf(p, ref, ids, { type: card?.type ?? null, badge: card?.badge ?? null }));
        places.set(slug, d);
      }
      return d;
    },
    placeEngine: engineFor<PlaceRow>(placeDescriptor as never),
    tripRows,
    tripDetail(slug) {
      let d = trips.get(slug);
      if (!d) {
        const t = data.getTrip(slug);
        const card = tripCards.get(slug);
        if (!t || !card) return null;
        d = withRenditions(tripDetailOf(t, card));
        trips.set(slug, d);
      }
      return d;
    },
    tripEngine: engineFor<TripRow>(tripDescriptor as never),
    parse(input: ParseInput): ParsedQuery {
      const o: ParseOptions = { ...(input.target ? { target: input.target } : {}), ...(input.dropped ? { dropped: input.dropped } : {}) };
      return parse(input.q, vocabJson as unknown as VocabFile, allRecords(), o) as ParsedQuery;
    },
    search(q: string, scope: SearchScope, limit: number): SearchResult {
      return { ...searcherFor(scope).search(q, limit), partial: false } as SearchResult;
    },
    exportFile: (q) => exportFileOf(q, { place: (s) => data.getPlace(s), trip: (s) => (tripCards.has(s) ? data.getTrip(s) : null) }),
    globe: {
      tree: () => buildGlobeFiles().tree,
      pins: (cc) => buildGlobeFiles().pins[cc] ?? null,
      card: (key) => withRenditions(buildGlobeFiles().cards[key.replace(':', '/')] ?? null),
      feature: (id) => gazetteer().get(id) ?? null,
      line: (id) => readGlobeLine(id) as GlobeLine | null,
    },
    reportLink: (page) => reportLink(reportUrl, page),
    snapshot() {
      const files = buildGlobeFiles();
      const cited = new Map<string, unknown>();
      for (const row of placeRows) for (const [id, c] of Object.entries(this.placeDetail(row.slug)?.citations ?? {})) cited.set(id, c);
      return {
        globe: { tree: files.tree, pins: files.pins, cards: withRenditions(files.cards), gazetteer: readGazetteer(), lines: globeLineIds().map((id) => readGlobeLine(id)) },
        vocab: vocabJson,
        citations: [...cited].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, c]) => c),
        towns: null,
      };
    },
  };
}
