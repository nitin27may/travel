import type { PlaceExport, TripExport } from '@/lib/export/types';
import type { EntityDescriptor } from '@/lib/entities/types';
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

export interface ReportInput {
  /** The page the visitor was on: a pathname such as `/places/moraine-lake/`. Nothing else is sent. */
  page: string;
}

/** `link`: open this URL (today). `submitted`: a server stored the report (`POST /api/v1/report`, same input). `off`: not available yet, render nothing. */
export type ReportResult = { kind: 'link'; url: string } | { kind: 'submitted'; id: string } | { kind: 'off' };

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
  /** The rows of one list file (a country, or one 300-row part of a large one) in the list's default order. `d` is the list's descriptor. */
  shardRows(type: 'place' | 'trip', id: string, d: EntityDescriptor<never>): Promise<readonly unknown[]>;
  /** One full-text file (backlog 3.60). */
  textIndex(id: string): Promise<TextIndex>;
}
