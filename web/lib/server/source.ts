import type { LegsSource } from '@travel/core/catalogue/json/legs.ts';
import { hasTownsFiles, readTownsFiles } from '@travel/core/derive/townsData.ts';
import { loadDriveData } from '@travel/core/drive/load.ts';
import { indexDriveData } from '@travel/core/drive/model.ts';
import type { CardMatches, JsonSource, SearchScope } from '@travel/core/catalogue/json/source.ts';
import { readSlugRegistry } from '@/lib/public/places';
import type { SlugRegistry } from '@travel/core/catalogue/slugs.ts';
import { tripLegsFile, type GlobeFeature, type GlobeLine, type ParseInput, type ParsedQuery, type PlaceDetail, type PlaceRow, type SearchResult, type TripDetail, type TripRow } from '@travel/core/schema/api/index.ts';
import { placeShards } from '@/app/places/shards';
import { tripListRows } from '@/app/trips/rows';
import { reportLink, reportUrl } from '@/lib/config/product';
import { travelRoot } from '@/lib/data/root';
import { placeDescriptor } from '@/lib/entities/descriptors/place';
import { tripDescriptor } from '@/lib/entities/descriptors/trip';
import { buildGlobeFiles } from '@/lib/globe/data';
import { sharedPublicData } from '@/lib/public';
import type { PublicData } from '@/lib/public';
import { readGazetteer, readGlobeLine } from '@/lib/public/globe';
import { readLegsFile } from '@/lib/public/timeline';
import snapshotJson from '../../data-snapshots/prototype.json';
import { buildTextIndex, cardText, searchTexts, terms, type TextIndex } from '@/lib/search/fulltext';
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
import { revisionInputs } from './inputs';
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

  // ---- card search (store.ts A28) ---------------------------------------------------------------------------------------------
  // BM25 over the card text of the query's country scope (core/src/search/bm25.ts, store.ts A28). The index of a
  // scope is built on its first use and kept.
  const textIndexes = new Map<string, TextIndex>();
  const textIndexOf = (scope: readonly PlaceRow[]): TextIndex => {
    const key = `${scope.length}|${[...new Set(scope.map((r) => r.country))].sort().join(',')}`;
    let ix = textIndexes.get(key);
    if (!ix) {
      ix = buildTextIndex(scope.flatMap((r) => (cards.get(r.slug) ? [{ id: r.slug, text: cardText(cards.get(r.slug)!) }] : [])));
      textIndexes.set(key, ix);
    }
    return ix;
  };

  // ---- trip legs (store.ts A34) ------------------------------------------------------------------------------------------------
  // The Dolomites file keys its pairs by prototype place id; the public stop keys are the prototype's item ids (`i2`) and `base:<town>`.
  const protoPlaceOfItem = new Map<string, string>();
  for (const day of snapshotJson.trip.days) for (const it of day.items) protoPlaceOfItem.set(it.id, it.placeId);

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
    cards(q, rows, scope): CardMatches {
      const score = new Map(searchTexts([textIndexOf(scope)], q, Number.MAX_SAFE_INTEGER).map((h) => [h.id, h.score]));
      return { terms: [...new Set(terms(q))], hits: rows.flatMap((row) => (score.has(row.slug) ? [{ row, score: score.get(row.slug)! }] : [])) };
    },
    legsFile(slug): LegsSource | null {
      const raw = readLegsFile(root, slug);
      const parsed = raw ? tripLegsFile.safeParse(raw) : null;
      if (!parsed?.success) return null;
      const protoTrip = slug === snapshotJson.trip.id;
      return {
        file: parsed.data,
        pairKeyOf: (stopKey) => (stopKey.startsWith('base:') ? stopKey.slice(5) : protoTrip ? (protoPlaceOfItem.get(stopKey) ?? null) : stopKey),
      };
    },
    revisionInputs: () => revisionInputs(root),
    exportFile: (q) => exportFileOf(q, { place: (s) => data.getPlace(s), trip: (s) => (tripCards.has(s) ? data.getTrip(s) : null) }),
    globe: {
      tree: () => buildGlobeFiles().tree,
      pins: (cc) => buildGlobeFiles().pins[cc] ?? null,
      card: (key) => withRenditions(buildGlobeFiles().cards[key.replace(':', '/')] ?? null),
      feature: (id) => gazetteer().get(id) ?? null,
      line: (id) => readGlobeLine(id) as GlobeLine | null,
    },
    reportLink: (page) => reportLink(reportUrl, page),
    // the towns layer (META-2): data/reference/towns, verified against its manifest when first read, served exactly as the GeoNames dump has it
    ...(hasTownsFiles(root) ? { towns: lazy(() => readTownsFiles(root).rows) } : {}),
    // the drive model's data (data/reference/drive, in the revision's `data` tree): near's drive bands (store.ts A41), read on first use
    drive: lazy(() => indexDriveData(loadDriveData(root).data)),
  };
}
