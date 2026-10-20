// List shards (backlog 3.59, principles P1, P8, P9). A long list page used to carry every row in its HTML (1 KB a row: 526 KB at 353
// places, 10.9 MB at 10,000). Now the page carries its first page of rows and a small manifest; the rest of the rows are files of at most
// SHARD_ROWS rows, one country at a time, that the browser loads through `lib/client/data.ts` only when a view needs them.
//
// This module is pure (no fetch, no fs): the build writes the files from it and the data module reads them by it. A server step later
// replaces the files with a query and keeps every caller.
import { defaultOrder } from './sort';
import { facetCounts, gapNotes } from './filter';
import type { FacetCount } from './filter';
import { emptyState } from './url';
import type { EntityDescriptor, ListState } from './types';

/** Rows the page itself carries: one page of cards. */
export const HEAD_ROWS = 48;
/** The most rows in one shard file (about 300 KB raw, 30 KB gzip at today's row size). */
export const SHARD_ROWS = 300;

export interface ShardRef {
  /** `<cc>` for a country that fits one file, `<cc>-<n>` for the n-th file of a larger one; also the file name under /list/<type>s/. */
  id: string;
  /** Lower-case ISO alpha-2, or `xx` for a row with none. */
  cc: string;
  /** Rows in the file. */
  n: number;
}

/** What a list page carries besides its first rows: enough for the first view, nothing of the rows beyond it. */
export interface ListManifest {
  v: 1;
  /** Rows in the whole list. */
  total: number;
  /** Rows the page carries (the first page of the default order). */
  head: number;
  /** The files, in the default order: a page of the plain list is a run of rows across them. */
  shards: ShardRef[];
  /** Option counts for the unfiltered list, so the filter bar is complete before any file loads. */
  counts: [param: string, options: FacetCount[]][];
  /** The count line's notes for the unfiltered list. */
  countNotes: string[];
}

export interface BuiltShards<Row> {
  head: Row[];
  manifest: ListManifest;
  /** File id to rows. Their union is the list; no one file holds it all unless the list is one country that fits one file. */
  files: Record<string, Row[]>;
}

/**
 * Splits a list into files by country, in the default order, and cuts the first page for the page itself. `ccOf` gives the country
 * of a row. The default order keeps a country's rows together (the descriptor's tier), so a plain page is a run of rows across files.
 */
export function buildShards<Row>(rows: readonly Row[], d: EntityDescriptor<Row>, ccOf: (row: Row) => string): BuiltShards<Row> {
  const ordered = defaultOrder(rows, d);
  const byCountry = new Map<string, Row[]>();
  for (const r of ordered) {
    const cc = (ccOf(r) || 'xx').toLowerCase();
    const list = byCountry.get(cc);
    if (list) list.push(r);
    else byCountry.set(cc, [r]);
  }
  const files: Record<string, Row[]> = {};
  const shards: ShardRef[] = [];
  const flat: Row[] = [];
  for (const [cc, list] of byCountry) {
    const parts = Math.max(1, Math.ceil(list.length / SHARD_ROWS));
    for (let i = 0; i < parts; i++) {
      const id = parts === 1 ? cc : `${cc}-${i + 1}`;
      const part = list.slice(i * SHARD_ROWS, (i + 1) * SHARD_ROWS);
      files[id] = part;
      shards.push({ id, cc, n: part.length });
      flat.push(...part);
    }
  }
  const blank = emptyState();
  // a facet that shows only under another (region and area under a country) is counted when that country's files load, not here: at 10,000 places
  // the area options alone would be most of the manifest
  // (a list of pairs, not an object: a facet's name is data here, and a key named `stroller` would read as a stroller fact in the page's payload)
  const counts = Object.entries(facetCounts(flat, blank, d)).filter(([param]) => !d.facets.find((f) => f.param === param)?.dependsOn);
  return {
    head: flat.slice(0, HEAD_ROWS),
    files,
    manifest: { v: 1, total: flat.length, head: Math.min(HEAD_ROWS, flat.length), shards, counts, countNotes: gapNotes(flat, blank, d) },
  };
}

const countsCache = new WeakMap<ListManifest, Record<string, FacetCount[]>>();
/** The manifest's option counts by facet name. */
export function manifestCounts(m: ListManifest): Record<string, FacetCount[]> {
  let c = countsCache.get(m);
  if (!c) countsCache.set(m, (c = Object.fromEntries(m.counts)));
  return c;
}

/** The unfiltered, default-ordered list: the one case whose rows are a run of the files in order, so a page needs only the files it touches. */
export function isPlain(q: ListState): boolean {
  return (
    !q.q.trim() &&
    !Object.values(q.facets).some((v) => v && v.length) &&
    !q.bbox &&
    !q.f &&
    !q.sv &&
    !q.ids.length &&
    !q.sort.length
  );
}

/** The files a filtered query can hold rows from: those of the countries it names, or all of them when it names none. */
export function shardsForScope(m: ListManifest, q: ListState): ShardRef[] {
  const named = (q.facets.country ?? []).map((c) => c.toLowerCase());
  return named.length ? m.shards.filter((s) => named.includes(s.cc)) : m.shards;
}

export interface PageWindow {
  /** Rank of the first row of the page in the plain list. */
  offset: number;
  /** Rows the page holds. */
  count: number;
  /** The files that hold them, in order, with the rank of their first row. Empty when the page carries them itself. */
  files: { ref: ShardRef; start: number }[];
}

/** Which rows a page of the plain list holds. The page is clamped to the last one, as the pager does. */
export function pageWindow(m: ListManifest, page: number, pageSize: number): PageWindow {
  const pages = Math.max(1, Math.ceil(m.total / pageSize));
  const offset = (Math.min(Math.max(1, page), pages) - 1) * pageSize;
  const count = Math.max(0, Math.min(pageSize, m.total - offset));
  if (offset + count <= m.head) return { offset, count, files: [] };
  const files: PageWindow['files'] = [];
  let start = 0;
  for (const ref of m.shards) {
    if (start < offset + count && start + ref.n > offset) files.push({ ref, start });
    start += ref.n;
  }
  return { offset, count, files };
}
