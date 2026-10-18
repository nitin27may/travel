import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { TEXT_FILE, WEB, allKeys, readText, walkFiles } from './helpers';

// Builds the whole app against tests/fixtures/root (three trips: public, unlisted, private, each
// carrying sentinel values) into .fixture-out, then greps every file that would be published.
const OUT = path.join(WEB, '.fixture-out');
// the real export from `next build`, which tests/global-setup.ts also runs first
const REAL_OUT = path.join(WEB, 'out');

const SENTINELS = ['CONF-SENTINEL-7Q', 'NOTE-SENTINEL-PRIVATE', 'CITIZENSHIP-SENTINEL', 'CONTACT-SENTINEL', '+1-555-0100'];
const PRIVATE_KEYS = ['height_cm', 'weight_kg', 'age_years', 'citizenship', 'confirmation', 'contact', 'price_paid_amount', 'insurer_tel', 'status', 'stayStatus'];

let files: string[] = [];

beforeAll(() => {
  // tests/global-setup.ts builds the fixture app first; build it here only if someone skipped that
  if (!existsSync(path.join(OUT, 'index.html'))) execFileSync(process.execPath, [path.join(WEB, 'scripts', 'build-fixture.mjs')], { cwd: WEB, stdio: 'pipe' });
  files = walkFiles(OUT);
}, 300_000);

const rel = (f: string) => path.relative(OUT, f).split(path.sep).join('/');

describe('privacy of the exported site', () => {
  it('exports something to check', () => {
    expect(files.length).toBeGreaterThan(80);
    expect(files.some((f) => rel(f) === 'data/places.json')).toBe(true);
    expect(files.some((f) => rel(f) === 'data/trips.json')).toBe(true);
  });

  it('contains no sentinel value anywhere', () => {
    const hits: string[] = [];
    for (const f of files.filter((f) => TEXT_FILE.test(f))) {
      const text = readText(f);
      for (const s of SENTINELS) if (text.includes(s)) hits.push(`${rel(f)}: ${s}`);
    }
    expect(hits).toEqual([]);
  });

  it('never names the private trip, in file names or contents', () => {
    expect(files.map(rel).filter((p) => p.includes('private-trip'))).toEqual([]);
    const hits = files.filter((f) => TEXT_FILE.test(f)).filter((f) => /private-trip|Private Trip Title/.test(readText(f))).map(rel);
    expect(hits).toEqual([]);
  });

  it('names the unlisted trip only under its own folder (P3a builds none, so nowhere)', () => {
    const hits = files
      .filter((f) => TEXT_FILE.test(f))
      .filter((f) => /unlisted-trip|Unlisted Trip Title/.test(readText(f)))
      .map(rel)
      .filter((p) => !p.startsWith('unlisted-trip/'));
    expect(hits).toEqual([]);
  });

  it('lists the public trip and the legacy row, and only those', () => {
    const doc = JSON.parse(readText(path.join(OUT, 'data', 'trips.json'))) as { rows: { slug: string }[] };
    expect(doc.rows.map((r) => r.slug).sort()).toEqual(['legacy-one', 'public-trip']);
  });

  it('keeps the unlisted and private trips out of the sitemap and the trips page', () => {
    const sitemap = readText(path.join(OUT, 'sitemap.xml'));
    expect(sitemap).not.toMatch(/unlisted-trip|private-trip/);
    expect(readText(path.join(OUT, 'trips', 'index.html'))).not.toMatch(/Unlisted Trip|Private Trip/);
  });

  it('has no research, inbox or screenshot strings in the published pages and data', () => {
    const hits: string[] = [];
    // the framework's own chunks are not ours to police; every page, data and text file is
    const own = files.filter((f) => TEXT_FILE.test(f) && !rel(f).startsWith('_next/static/chunks/'));
    for (const f of own) {
      const text = readText(f);
      for (const needle of ['research/', 'inbox/', 'screenshot']) if (text.includes(needle)) hits.push(`${rel(f)}: ${needle}`);
    }
    expect(hits).toEqual([]);
  });

  it('writes no private field name as a JSON key in /data/*.json', () => {
    const dataFiles = files.filter((f) => /^data\/[^/]+\.json$/.test(rel(f)));
    expect(dataFiles.length).toBeGreaterThanOrEqual(2);
    for (const f of dataFiles) {
      const keys = allKeys(JSON.parse(readText(f)));
      for (const k of PRIVATE_KEYS) expect(keys.has(k), `${rel(f)} has key ${k}`).toBe(false);
    }
  });

  it('does not name a trip a place cannot link to', () => {
    const doc = JSON.parse(readText(path.join(OUT, 'data', 'places.json'))) as { rows: { trip: string | null }[] };
    for (const r of doc.rows) expect(['private-trip', 'unlisted-trip']).not.toContain(r.trip);
  });
});

// A place's personal status (idea, shortlisted, planned, visited, dropped) and a stay's booking state are
// household data. They show only to a signed-in user on their own trips, never in a public build.
const STATUS_WORDS = 'Idea|Shortlisted|Planned|Visited|Dropped';

function statusLeaks(root: string): string[] {
  const hits: string[] = [];
  const all = walkFiles(root);
  const r = (f: string) => path.relative(root, f).split(path.sep).join('/');
  const pages = all.filter((f) => /\.(html|txt|json|csv|kml|gpx|xml)$/.test(f) && !r(f).startsWith('_next/'));
  const chunks = all.filter((f) => /\.(js|css)$/.test(f));
  for (const f of pages) {
    const text = readText(f);
    const found = (label: string, re: RegExp) => {
      if (re.test(text)) hits.push(`${r(f)}: ${label}`);
    };
    found('"status": key', /"status"\s*:/);
    found('stayStatus', /stayStatus/);
    found('data-status attribute', /data-status=/);
    found('status chip in HTML', new RegExp(`>\\s*(${STATUS_WORDS})\\s*<`));
    found('status label in an RSC payload', new RegExp(`"(?:children|text|label|title|value)":"(${STATUS_WORDS})"`));
    found('status filter in a URL', /[?&]status=/);
    found('stay booking state', /stay not chosen yet/);
  }
  for (const f of chunks) {
    const text = readText(f);
    if (/stayStatus|stIdea|stPlanned|stVisited|stShortlisted|stDropped|Shortlisted/.test(text)) hits.push(`${r(f)}: status label or glyph in a client bundle`);
    if (/\[data-status/.test(text)) hits.push(`${r(f)}: data-status style`);
  }
  return hits;
}

describe('no personal place status in public output', () => {
  it('leaves status out of the fixture build (HTML, RSC payloads, data files, bundles)', () => {
    expect(files.length).toBeGreaterThan(80);
    expect(statusLeaks(OUT)).toEqual([]);
  });

  it('leaves status out of the real build in web/out', () => {
    if (!existsSync(path.join(REAL_OUT, 'index.html'))) return; // `next build` has not run; global-setup normally builds it
    const real = walkFiles(REAL_OUT);
    expect(real.some((f) => /__next\..*\.txt$/.test(f))).toBe(true);
    expect(statusLeaks(REAL_OUT)).toEqual([]);
  });

  it('proves the check can fail', () => {
    const sample = '{"slug":"x","status":"planned","stayStatus":null}';
    expect(/"status"\s*:/.test(sample)).toBe(true);
    expect(/stayStatus/.test(sample)).toBe(true);
    expect(new RegExp(`"(?:children|text)":"(${STATUS_WORDS})"`).test('{"text":"Planned"}')).toBe(true);
  });
});
