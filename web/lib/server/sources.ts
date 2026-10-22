import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REGISTRY_PATH } from '@travel/core/sources/build.ts';
import { normaliseUrl, sourceId } from '@travel/core/sources/normalize.ts';
import type { ApiCitation } from '@travel/core/schema/api/index.ts';
import { publicSource } from '@/components/suit/html';
import { travelRoot } from '@/lib/data/root';
import { registryIdOf, type SourceRow } from '@/lib/public/vals';

// Provenance in API output (D-B4): a page value cites the rows of its lane file's own source table (`src-0027`, local to that file);
// the API cites registry ids (`s-` plus 10 hex characters, data/sources/registry.json) and carries each cited source once in the
// detail's `citations`. The mapping is the registry's own rule (core/src/sources/normalize.ts), applied to the row's url.
//
// A source a visitor cannot open (our own repo, a plan file, a relative path) is the workshop, not a source: the page never shows it
// (components/suit/html.ts publicSource) and neither does the API. It is still checked against the registry here, so a lane file that
// the registry does not know about stops the build instead of being dropped silently.

export interface RegistryView {
  ids: ReadonlySet<string>;
}

let cache: { root: string; ids: Set<string> } | null = null;

/** The ids in data/sources/registry.json. */
export function registryIds(root = travelRoot()): ReadonlySet<string> {
  if (cache?.root === root) return cache.ids;
  const doc = JSON.parse(readFileSync(path.join(root, REGISTRY_PATH), 'utf8')) as { entries: { id: string }[] };
  cache = { root, ids: new Set(doc.entries.map((e) => e.id)) };
  return cache.ids;
}

export interface CitedSource {
  id: string;
  citation: ApiCitation;
}

/**
 * The registry id of a page source row, with the citation the popover shows; null for a source the page does not show. Throws when the
 * row has no registry entry (contract case K12: an unknown id fails, it is never dropped).
 */
export function citedSource(row: SourceRow, ids: ReadonlySet<string>): CitedSource | null {
  // the id was taken from the lane file's own url when the table was read (vals.ts), before the page scrub blanked an own-repo source
  const id = registryIdOf.get(row) ?? sourceId(normaliseUrl(row.url));
  if (!ids.has(id)) throw new Error(`source ${row.id} (${row.url}) is not in the source registry; run node core/bin/sources.ts build`);
  if (!publicSource(row)) return null;
  return { id, citation: { id, url: row.url, title: row.title, publisher: row.publisher, kind: row.kind, read: row.read || null } };
}
