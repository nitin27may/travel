import type { NearRow, PlaceRow, ResolveRow, TripLegs, TripPlanModel } from '@travel/core/schema/api/index.ts';
import type { PlanBuildAnswer, PlanBuildInput, PlanCandidatePage, PlanCandidatesQuery, PlanErrorCode, PlanRegions, PlanStarts } from '@travel/core/schema/api/plan.ts';
import type { PlaceExport, TripExport } from '@/lib/export/types';
import type { EntityDescriptor, FacetParam, ListState } from '@/lib/entities/types';
import type { GlobeCardFile, GlobeTree, LightPin } from '@/lib/globe/types';
import type { TextIndex } from '@/lib/search/fulltext';
import type { ParseOptions, ParsedQuery, VocabFile } from '@/lib/search/parse/types';
import type { Suggestion } from '@/lib/search/suggest';
import type { SearchManifest, SearchPartRef, SearchRecord, SearchResult } from '@/lib/search/types';

// The contract between lib/client/data.ts and its adapters (EXECUTION-PLAN 4.5). data.ts keeps every export name and signature the
// components already use; the functions that reach for catalogue data are calls on a `DataClient`:
//   ApiAdapter     api.ts     the default: `fetch` to /api/v1/*
//   StaticAdapter  static.ts  today's functions over the files the build wrote (NEXT_PUBLIC_DATA_ADAPTER=static, needs its own build)
//   StubAdapter    stub.ts    a StubStore in memory, for unit tests
// The list engine (registered lists, shards in memory, filtering, counts) stays in data.ts: it is the browser's own evaluation over rows,
// and an adapter only says where a file of rows comes from.

export interface SearchScope {
  kind?: SearchRecord['k'];
  /** Lower-case ISO alpha-2. */
  country?: string;
}

export interface GlobeScope {
  /** Lower-case ISO alpha-2. Without it, every country (the whole list; ask for one country when you can). */
  country?: string;
}

/** One landform's or river's own simplified line or outline, loaded when it is picked (never in bulk). Natural Earth, public domain. */
export interface GlobeLineFile {
  id: string;
  name: string;
  kind: 'line' | 'area';
  /** [west, south, east, north]; east may pass 180 for a shape across the antimeridian. */
  bbox: [number, number, number, number];
  geometry: { type: 'MultiLineString' | 'MultiPolygon'; coordinates: unknown };
  credit: string;
}

/** The most distinct values one `resolveRefs` call takes: core's RESOLVE_MAX (pinned equal in tests/api/adapters.test.ts; a literal here so no schema code loads). */
export const RESOLVE_MAX_CLIENT = 48;

export interface ReportInput {
  /** The page the visitor was on: a pathname such as `/places/moraine-lake/`. Nothing else is sent. */
  page: string;
}

/** `link`: open this URL (today). `submitted`: a server stored the report (`POST /api/v1/report`, same input). `off`: not available yet, render nothing. */
export type ReportResult = { kind: 'link'; url: string } | { kind: 'submitted'; id: string } | { kind: 'off' };

/**
 * One `nearPage` read (N2; store.ts A41): a centre, a radius and an optional kind filter. A `point` is the asker's own point: the
 * adapter rounds it to the near cell before it builds the URL and never sends it finer; `place` is a public slug.
 */
export interface NearRead {
  centre: { point: { lat: number; lon: number } } | { place: string } | { town: string };
  /** km; the server clamps above its cap */
  r: number;
  /** place kinds to keep (the `kind` facet); absent: every kind */
  kinds?: readonly string[];
}

export interface DataClient {
  searchManifest(): Promise<SearchManifest>;
  searchPart(id: string): Promise<SearchRecord[]>;
  searchParts(scope?: SearchScope): Promise<SearchPartRef[]>;
  loadSearchRecords(scope?: SearchScope, onRecords?: (soFar: SearchRecord[]) => void): Promise<SearchRecord[]>;
  onSearchGrow(fn: () => void): () => void;
  search(q: string, scope?: SearchScope, limit?: number): Promise<SearchResult>;
  suggest(q: string, scope?: SearchScope): Promise<Suggestion | null>;
  searchVocab(): Promise<VocabFile>;
  parseQuery(q: string, opts?: ParseOptions): Promise<ParsedQuery>;
  loadExport(type: 'trip' | 'place', slug: string): Promise<TripExport | PlaceExport>;
  globeTree(): Promise<GlobeTree>;
  globePins(scope?: GlobeScope): Promise<LightPin[]>;
  globeCard(key: string): Promise<GlobeCardFile | null>;
  globeLine(id: string): Promise<GlobeLineFile | null>;
  reportProblem(input: ReportInput): Promise<ReportResult>;
  /**
   * The routed legs of one public trip (`GET /api/v1/trips/{slug}/legs/`, TRP2b): read when the trip's map mounts, never with the trip. A trip with no
   * legs file answers an empty list. Resolves to null when the adapter has no such endpoint (the static files) or the trip is unknown: the map then draws
   * dashed estimates only.
   */
  tripLegs(slug: string): Promise<TripLegs | null>;
  /**
   * The model one public trip's page embeds (`GET /api/v1/trips/{slug}/plan-model/`, STEP2-M): its days, timeline inputs, addables per day,
   * sections, route and gallery, so `/t/<id>/` renders a copy from the same model and applies the person's delta on the device (P9). One
   * trip a call (P8); cached by the catalogue revision. Resolves to null for an unknown trip, or when the adapter has no such endpoint (the
   * static files): the caller shows its not-found state. Rejects for a failed request.
   */
  tripPlanModel(slug: string): Promise<TripPlanModel | null>;
  /**
   * The rows of one list file (a country, or one 300-row part of a large one) in the list's default order. `d` is the list's descriptor and
   * `countryRows` the number of rows the list's manifest says that country has, so an adapter can ask for all of them at once.
   */
  shardRows(type: 'place' | 'trip', id: string, d: EntityDescriptor<never>, countryRows?: number): Promise<readonly unknown[]>;
  /** One full-text file (backlog 3.60). */
  textIndex(id: string): Promise<TextIndex>;

  // ---- FAV-1W: resolveRefs (visitor spec 4.5, 8.2) ---------------------------------------------------------------------------------
  /**
   * Where each favourite or copy stands now, for up to RESOLVE_MAX_CLIENT (48) handles (`place:<slug>`, `trip:<slug>`) or public refs:
   * one row per asked value, in the order asked (a repeat answers twice), each `current`, `moved`, `merged`, `withdrawn` or `unknown`
   * with its light snapshot (name, kind, cc; P8). `GET /api/v1/resolve?ref=..`, cached by the catalogue revision. Resolves to null when
   * the adapter has no such endpoint (the StaticAdapter, or a server answering 501 `not_available`): keep the stored snapshots. Rejects
   * for more than 48 distinct values (ask one visible page at a time), a value that is neither a handle nor a public ref, or a failed
   * request; the caller keeps its stored snapshots then too.
   */
  resolveRefs(refs: readonly string[]): Promise<ResolveRow[] | null>;

  /**
   * One page of light place rows for a map box (`bbox` "west,south,east,north"), words (`q`) or a few slugs (`ids`): `GET /api/v1/places/`.
   * The add picker's three reads (STEP2-E3; P8: one page at a time, never the list). Null when the adapter has no such endpoint (the
   * StaticAdapter) or the request failed or was aborted.
   */
  placesPage(q: { q?: string; bbox?: string; ids?: readonly string[] }, page: number, pageSize: number, signal?: AbortSignal): Promise<{ items: PlaceRow[]; nextPage: number | null } | null>;

  /**
   * One page of the places around a centre, nearest first, each with its straight-line distance, bearing and drive band (an
   * estimate): `GET /api/v1/near/` (N2, store.ts A41). A point centre is rounded to the near cell first, so distances are from the
   * cell (within `nearCellSlackKm()` of the asker's own). Null when the adapter has no such endpoint (the StaticAdapter), the server
   * answers 501, or the read failed or was aborted: the caller keeps its fallback.
   */
  nearPage(q: NearRead, page: number, pageSize: number, signal?: AbortSignal): Promise<{ items: NearRow[]; total: number; nextPage: number | null } | null>;

  // ---- TB-API: the trip builder's three calls (trip-builder.md 5; X2) ----------------------------------------------------------------
  /**
   * The region groups and regions of one country with counts of researched places: `GET /api/v1/plan/regions/{cc}`, cached by the
   * catalogue revision. Null when the adapter has no such endpoint (the StaticAdapter), the `planBuilder` flag is off (404) or the server
   * answers 501. Rejects with a `PlanCallError` for any other failure.
   */
  planRegions(cc: string): Promise<PlanRegions | null>;
  /** The public hubs and airports the start picker lists (TB-W1): `GET /api/v1/plan/starts`. Names only, no point. Null and rejection as `planRegions`; empty lists while the reference files are absent. */
  planStarts(): Promise<PlanStarts | null>;
  /** One page (40 at most) of ranked candidates: `GET /api/v1/plan/candidates`. Null and rejection as `planRegions`. The query carries no party, only a band. */
  planCandidates(q: PlanCandidatesQuery, signal?: AbortSignal): Promise<PlanCandidatePage | null>;
  /**
   * Builds a plan: `POST /api/v1/plan/build`. The body holds the party and is sent over this call only (never a URL, never stored). Null
   * and rejection as `planRegions`; a 429 rejects with code `rate_limited` and `retryAfterS`, a 503 with `plan_paused`.
   */
  planBuild(input: PlanBuildInput, signal?: AbortSignal): Promise<PlanBuildAnswer | null>;

  // ---- API-3: the server's evaluation (P9) ---------------------------------------------------------------------------------------
  // The ApiAdapter has these three and answers them from /api/v1/; the StaticAdapter does not, and data.ts evaluates the same in the
  // browser over the files it loaded. Each resolves to null when the server cannot answer the state (an advanced filter `f`, a saved
  // view `sv`, a facet the server's engine does not publish): data.ts then evaluates locally, as before.
  /** How many places a list state opens, and how many more are listed apart as "not checked yet"; with `parsed`, the count of the state with that parse merged in. */
  countPlaces?(state: ListState, parsed?: { q: string; facets: ListState['facets'] }): Promise<{ n: number; unchecked: number } | null>;
  /** The slugs left out only because of a gap, per constraint, in the server's group order. `only` limits the constraints (the ones a parse wrote). */
  uncheckedGroups?(state: ListState, only?: readonly FacetParam[]): Promise<{ param: FacetParam; label: string; note: string; slugs: string[] }[] | null>;
  /** The slugs whose card text holds the words of `state.q`, best first, with every other filter of the state applied (at most 50). */
  cardRank?(state: ListState): Promise<string[] | null>;
}

/** A builder call the server refused or could not answer: the contract's code, the HTTP status and, for `rate_limited`, the seconds to wait. Never holds a body. */
export class PlanCallError extends Error {
  constructor(
    readonly code: PlanErrorCode,
    readonly status: number,
    readonly retryAfterS: number | null = null,
  ) {
    super(`plan: ${code}`);
    this.name = 'PlanCallError';
  }
}
