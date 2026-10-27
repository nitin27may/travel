import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WEB, walkFiles } from '../helpers';

// Principle P9 (backlog 2.23): all catalogue data reaches the browser through one module, lib/client/data.ts, whose
// functions have the shape of a future API. A component or another module that fetches a data URL itself would have to be
// found and rewritten when a function moves to the server, so the build refuses it.

const SOURCE_DIRS = ['app', 'components', 'lib'];
const SOURCE = /\.(ts|tsx|mjs)$/;
const THE_MODULE = 'lib/client/data.ts';
/** The adapters behind the data module (API-1b): they are where the reads happen, so they are the data boundary too. */
const ADAPTERS = ['lib/client/api.ts', 'lib/client/static.ts'];

/**
 * The few other places that call fetch(), each for something that is not catalogue data. A new entry needs a reason.
 * The globe reads country outlines, admin boundaries and a world gazetteer (geography from public sources, not our
 * researched content); the map loader reads its own worker script.
 */
const NOT_CATALOGUE: Record<string, string> = {
  'components/map/MapLibreMap.tsx': 'the map library worker script',
  'app/account/SavedTrips.tsx': 'per-user authenticated saved-trips re-fetch after a write and on focus (not catalogue data; RLS-scoped, same-origin)',
  'app/account/ways-api.ts': 'the Ways to sign in section calling the same-origin auth proxy (GSI-WAYS; no catalogue data)',
  'components/auth/api.ts': 'the sign-in card posting to the same-origin auth proxy /api/auth/* (EML-1; no catalogue data)',
};

/** A URL of catalogue data: search parts, exports, the old whole-list files. */
const CATALOGUE_URL = /['"`]\/(?:search\/|globe-data\/|list\/|search-index|export-data|data\/(?:places|trips))|\/export-data\/|search-index\.json|data\/(?:places|trips)\.json/;

function sources(): { rel: string; text: string }[] {
  const out: { rel: string; text: string }[] = [];
  for (const d of SOURCE_DIRS) {
    for (const f of walkFiles(path.join(WEB, d))) {
      if (!SOURCE.test(f)) continue;
      out.push({ rel: path.relative(WEB, f).split(path.sep).join('/'), text: readFileSync(f, 'utf8') });
    }
  }
  return out;
}

describe('the client data boundary (principle P9)', () => {
  const all = sources();

  it('finds the module and the source files', () => {
    expect(all.length).toBeGreaterThan(100);
    expect(all.some((s) => s.rel === THE_MODULE)).toBe(true);
  });

  it('only the data module and the listed geography loaders call fetch()', () => {
    const callers = all.filter((s) => /\bfetch\s*\(/.test(s.text)).map((s) => s.rel).sort();
    expect(callers).toEqual([THE_MODULE, ...ADAPTERS, ...Object.keys(NOT_CATALOGUE)].sort());
  });

  it('no module but the data module names a catalogue data URL', () => {
    const hits = all.filter((s) => s.rel !== THE_MODULE && !ADAPTERS.includes(s.rel) && CATALOGUE_URL.test(s.text)).map((s) => s.rel);
    // the server routes that write the files live under app/search, app/globe-data and app/list
    expect(hits.filter((h) => !h.startsWith('app/search/') && !h.startsWith('app/globe-data/') && !h.startsWith('app/list/'))).toEqual([]);
  });

  it('the data module exposes the functions a future API keeps', () => {
    const text = all.find((s) => s.rel === THE_MODULE)!.text;
    for (const fn of ['searchManifest', 'searchPart', 'searchParts', 'loadSearchRecords', 'loadExport', 'searchVocab', 'parseQuery', 'relaxQuery', 'listPlacesChecked', 'listPlaces', 'ensureShards', 'registerShardedList', 'countListAsync']) expect(text, fn).toMatch(new RegExp(`export (async )?function ${fn}\\b`));
  });

  it('no globe module calls fetch(): reference geometry goes through the data module (2.49)', () => {
    const direct = all.filter((s) => /^(?:lib\/globe|components\/globe)\//.test(s.rel) && /\bfetch\s*\(/.test(s.text)).map((s) => s.rel);
    expect(direct).toEqual([]);
  });

  it('the data module exposes the globe reference readers', () => {
    const text = all.find((s) => s.rel === THE_MODULE)!.text;
    expect(text).toContain('// ---------------------------------------------------------------- globe reference geo (2.49)');
    for (const fn of ['globeCountries', 'globeCountryFacts', 'globeAdminManifest', 'globeAdmin', 'globeGazetteer', 'globeLakes', 'globeCityAreas']) expect(text, fn).toMatch(new RegExp(`export (async )?(function|const) ${fn}\\b`));
  });

  it('the check can fail: a stray fetch of a search part would be caught', () => {
    expect(CATALOGUE_URL.test("fetch('/search/place-ca/data.json')")).toBe(true);
    expect(CATALOGUE_URL.test('fetch(`/export-data/trips/${slug}/data.json`)')).toBe(true);
    expect(CATALOGUE_URL.test("fetch('/globe/data/gazetteer.json')")).toBe(false);
  });

  it('the list row files are catalogue URLs, and the data module keeps their section (3.59)', () => {
    expect(CATALOGUE_URL.test("fetch('/list/places/ca/data.json')")).toBe(true);
    expect(CATALOGUE_URL.test('fetch(`/list/places/${id}/data.json`)')).toBe(true);
    expect(all.find((s) => s.rel === THE_MODULE)!.text).toContain('// ---------------------------------------------------------------- list shards (3.59)');
  });

  it('the smart-search files are catalogue URLs too: the vocabulary and, later, the vector shards (smart-search 9.1)', () => {
    expect(CATALOGUE_URL.test("fetch('/search/vocab.json')")).toBe(true);
    expect(CATALOGUE_URL.test('fetch(`/search/vec/${part}/data.bin`)')).toBe(true);
  });
});
