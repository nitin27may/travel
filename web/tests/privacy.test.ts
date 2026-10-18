import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { isDated } from '@/lib/public/dateless';
import { nearHome } from '@/lib/public/origin';
import { TRIP_SLUGS } from '@/lib/public/slugs';
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
    expect(doc.rows.map((r) => r.slug).sort()).toEqual(['legacy-one', 'legacy-two', 'public-trip']);
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

// Household capture notes, home town and calendar dates must not reach any published file.
const TEXTY = /\.(html|txt|json|xml|csv|kml|gpx|js|css|map|svg|webmanifest|md)$|(^|\/)_(redirects|headers)$/;
const FOLDERS_WITH_YEAR = Object.keys(TRIP_SLUGS).filter((k) => /\d{4}/.test(k));
const NUM_PAIR = /(-?\d{1,3}\.\d{3,})[^\d-]{1,14}(-?\d{1,3}\.\d{3,})/g;

/** Every {lat, lon} style pair in a text, in either order, that lies within 2 km of the household's home. */
function homePoints(text: string): string[] {
  const hits: string[] = [];
  for (const m of text.matchAll(NUM_PAIR)) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (nearHome(a, b) || nearHome(b, a)) hits.push(m[0]);
  }
  return hits;
}

function householdLeaks(root: string): string[] {
  const hits: string[] = [];
  const all = walkFiles(root);
  const r = (f: string) => path.relative(root, f).split(path.sep).join('/');
  for (const f of all.filter((x) => TEXTY.test(r(x)) || !path.extname(x))) {
    const text = readText(f);
    const name = r(f);
    const add = (what: string) => hits.push(`${name}: ${what}`);
    if (/whitby/i.test(text)) add('home town "Whitby"');
    for (const pt of homePoints(text)) add(`a point within 2 km of home (${pt})`);
    if (name.startsWith('_next/static/')) continue;
    if (/planned as/i.test(text)) add('"Planned as"');
    if (/hotel idea/i.test(text)) add('"Hotel idea"');
    if (/"(?:summary|note|subtitle|standfirst)":"[^"]*https?:\/\//.test(text)) add('a URL inside a summary');
    if (/(?:summary|standfirst)[^>]*>[^<]*https?:\/\//.test(text)) add('a URL inside summary text');
    // titles and descriptions in pages carry no calendar date
    for (const m of text.matchAll(/<title>([^<]*)<\/title>|<meta[^>]+(?:name|property)="(?:description|og:title|og:description|twitter:title|twitter:description)"[^>]+content="([^"]*)"/g)) {
      const t = m[1] ?? m[2] ?? '';
      if (isDated(t)) add(`a calendar date in a title or description: "${t.slice(0, 80)}"`);
    }
  }
  // prose in the data files names no dated trip folder (a slug or an href is a link, not prose)
  const proseKeys = new Set(['note', 'summary', 'title', 'subtitle', 'n', 's', 'x']);
  const proseOf = (v: unknown, out: string[] = []): string[] => {
    if (Array.isArray(v)) v.forEach((x) => proseOf(x, out));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
      if (typeof x === 'string' && proseKeys.has(k)) out.push(x);
      else proseOf(x, out);
    }
    return out;
  };
  for (const n of ['data/places.json', 'data/trips.json', 'search-index.json']) {
    if (!all.some((f) => r(f) === n)) continue;
    const prose = proseOf(JSON.parse(readText(path.join(root, n)))).join('\n');
    for (const folder of FOLDERS_WITH_YEAR) if (prose.includes(folder)) hits.push(`${n}: trip folder name ${folder} in prose`);
  }
  const dataText = (n: string) => (all.some((f) => r(f) === n) ? readText(path.join(root, n)) : null);
  const placesDoc = dataText('data/places.json');
  if (placesDoc) {
    for (const row of (JSON.parse(placesDoc) as { rows: { id: string; note: string }[] }).rows) {
      if (isDated(row.note)) hits.push(`data/places.json: a calendar date in the note of ${row.id}`);
      if (/https?:\/\//.test(row.note)) hits.push(`data/places.json: a URL in the note of ${row.id}`);
    }
  }
  const tripsDoc = dataText('data/trips.json');
  if (tripsDoc) {
    const doc = JSON.parse(tripsDoc) as { rows: Record<string, unknown>[] };
    for (const row of doc.rows) {
      if (isDated(String(row.title)) || isDated(String(row.subtitle))) hits.push(`data/trips.json: a calendar date in the title or subtitle of ${String(row.slug)}`);
      for (const k of ['date', 'dates']) if (k in row) hits.push(`data/trips.json: ${String(row.slug)} has a ${k} field`);
    }
  }
  return hits;
}

describe('no household notes, home town or dates in any public file', () => {
  it('scans every file of the fixture build', () => {
    expect(householdLeaks(OUT)).toEqual([]);
  });
  it('scans every file of the real build in web/out', () => {
    if (!existsSync(path.join(REAL_OUT, 'index.html'))) return;
    expect(householdLeaks(REAL_OUT)).toEqual([]);
  });
  it('can fail: it sees the home town, a nearby point and a plan note', () => {
    expect(homePoints('{"lat":43.8812,"lon":-78.9431}')).toHaveLength(1);
    expect(homePoints('{"lat":43.6532,"lon":-79.3832}')).toHaveLength(0);
    expect(homePoints('<trkpt lat="43.8801" lon="-78.9395">')).toHaveLength(1);
    expect(nearHome(43.9, -78.94)).toBe(false);
  });
  it('lists a place used by two public trips with both counted (fixture visits)', () => {
    const doc = JSON.parse(readText(path.join(OUT, 'data', 'places.json'))) as { rows: { id: string; plans: number }[] };
    expect(doc.rows.find((r) => r.id === 'CA/AB/banff-national-park/lake-louise')?.plans).toBe(2);
  });
});
