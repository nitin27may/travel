// What `JsonStore` reads (API-1b; EXECUTION-PLAN 4.1). core/ never imports web/, so the dataset the site builds (createPublicData() and
// the files around it) reaches the store through this interface: web/lib/server/source.ts implements it, the contract kit's
// json target builds one over the real data/, and a test can build one over a handful of rows.
//
// Everything a source hands over is ALREADY in the contract's shapes (PlaceRow, PlaceDetail, TripRow, TripDetail, the globe shapes)
// and already scrubbed: the privacy scrub lives in the dataset builder (store.ts A18). The store adds what the contract owns and a
// source must not decide: input validation, the caps, the sort and paging rules, region and `ids` resolution, the revision, the
// error codes. The pieces that are the web app's today (the filter engine, the smart-search parser, the searcher, the export
// builders) arrive as functions here and move into core with API-2.
import type * as S from "../../schema/api/index.ts";
import type { SlugRegistry } from "../slugs.ts";

/** The filter part of a list query, after the store has resolved `region`, `ids` and `q` itself. `facets` hold only keys the engine knows. */
export interface ListFilter {
  facets: Record<string, string[]>;
  bbox?: [number, number, number, number];
}

/** What the facet counts of a list are made of (store.ts A22), before the store orders the options. */
export interface EngineCounts {
  facets: Record<string, S.FacetCount[]>;
  gaps: Record<string, number>;
  notes: string[];
  /** rows inside the query's scope (Kind and country), whatever else it filters */
  scope: number;
  /** rows left out only because they have no answer for a selected constraint (H1) */
  unchecked: number;
}

/** The query engine of one list (store.ts A21, A22): the web filter today, core/src/query after API-2. */
export interface ListEngine<Row> {
  /** True when the engine can evaluate the facet key; a store answers `not_available` for a key it cannot (A21). */
  knows(param: string): boolean;
  /** Rows that pass every facet and the bbox (a key is OR inside, AND across). */
  match(rows: readonly Row[], f: ListFilter): Row[];
  /** `rows` already passed `q`, `ids` and `region`; `all` is the whole list (the scope count ignores everything but Kind and country). */
  counts(rows: readonly Row[], f: ListFilter, all: readonly Row[]): EngineCounts;
}

/** One searchable group of records for the searcher: the records of one kind (and optionally one country). */
export interface SearchScope {
  kind?: "trip" | "place" | "area";
  /** lower-case ISO alpha-2 */
  country?: string;
}

export interface JsonSource {
  /** The pinned slug registry the dataset was built with (data/catalogue/slugs.json). */
  registry: SlugRegistry;

  placeRows: readonly S.PlaceRow[];
  /** The detail of a live place (its page model in the contract's shape), or null. Called for every place when the revision is computed. */
  placeDetail(slug: string): S.PlaceDetail | null;
  placeEngine: ListEngine<S.PlaceRow>;

  tripRows: readonly S.TripRow[];
  /** A public trip scheduled for its own default profile, or null. */
  tripDetail(slug: string): S.TripDetail | null;
  tripEngine: ListEngine<S.TripRow>;

  /** The words a human typed, read as filters (smart search). Pure over the vocabulary. */
  parse(input: S.ParseInput): S.ParsedQuery;
  /** Name search over the records of a scope; `limit` is the hits per group, already within the cap. */
  search(q: string, scope: SearchScope, limit: number): S.SearchResult;

  /** One export file for one item, or null when the item does not exist (or is not public). */
  exportFile(q: S.ExportQuery): S.ExportFile | null;

  globe: {
    tree(): S.GlobeTree;
    /** The light pins of one country, or null when the country has none. */
    pins(cc: string): S.LightPin[] | null;
    /** `place:<slug>` or `trip:<slug>` */
    card(key: string): S.GlobeCardFile | null;
    feature(id: string): S.GlobeFeature | null;
    line(id: string): S.GlobeLine | null;
  };

  /** The feedback form's URL for a page path, or null when reporting is off. */
  reportLink(page: string): string | null;

  /**
   * The served inputs the dataset does not hold, as parsed content (store.ts A8): the globe files, the parser vocabulary, the cited
   * source entries and the towns layer (null until META-2). The store adds the rows and details itself.
   */
  snapshot(): { globe: unknown; vocab: unknown; citations: unknown; towns: unknown };
}
