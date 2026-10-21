import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadPlaces } from '@/lib/data/places';
import { isDated } from '@/lib/public/dateless';
import { nearHome } from '@/lib/public/origin';
import { describesParty } from '@/lib/public/party';
import { TRIP_SLUGS } from '@/lib/public/slugs';
import { builtOutDir } from './helpers/built';
import { FIXTURE_ROOT, TEXT_FILE, allKeys, readText, walkFiles } from './helpers';

// Builds the whole app against tests/fixtures/root (three trips: public, unlisted, private, each
// carrying sentinel values) into .fixture-out, then greps every file that would be published.
// both are export-shaped views of a server build (tests/helpers/built.ts): prerendered output, RSC payloads, route-handler bodies, client chunks and public/
const OUT = builtOutDir('.fixture-out');
const REAL_OUT = builtOutDir();

const SENTINELS = ['CONF-SENTINEL-7Q', 'NOTE-SENTINEL-PRIVATE', 'CITIZENSHIP-SENTINEL', 'CONTACT-SENTINEL', '+1-555-0100'];
const PRIVATE_KEYS = ['height_cm', 'weight_kg', 'age_years', 'citizenship', 'confirmation', 'contact', 'price_paid_amount', 'insurer_tel', 'status', 'stayStatus'];

let files: string[] = [];

beforeAll(() => {
  // tests/global-setup.ts builds the fixture app first; builtOutDir() throws when it did not (a missing build must fail, not skip)
  files = walkFiles(OUT);
}, 300_000);

const rel = (f: string) => path.relative(OUT, f).split(path.sep).join('/');

describe('privacy of the exported site', () => {
  it('exports something to check', () => {
    expect(files.length).toBeGreaterThan(80);
    expect(files.some((f) => rel(f) === 'search/manifest.json')).toBe(true);
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

  it('indexes no private or unlisted trip for search', () => {
    const search = files.filter((f) => rel(f).startsWith('search/'));
    expect(search.length).toBeGreaterThan(2);
    for (const f of search) expect(readText(f), rel(f)).not.toMatch(/private-trip|unlisted-trip|Private Trip|Unlisted Trip/);
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

  it('writes no private field name as a JSON key in the search files', () => {
    const dataFiles = files.filter((f) => /^search\/.+\.json$/.test(rel(f)));
    expect(dataFiles.length).toBeGreaterThanOrEqual(2);
    for (const f of dataFiles) {
      const keys = allKeys(JSON.parse(readText(f)));
      for (const k of PRIVATE_KEYS) expect(keys.has(k), `${rel(f)} has key ${k}`).toBe(false);
    }
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

  it('leaves status out of the real build in the server build', () => {
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
    // `"summary",null` is the <summary> element in the flight payload, not a prose field
    if (/(?:summary|standfirst)(?!",null)[^>]{0,80}>[^<]{0,400}https?:\/\//.test(text)) add('a URL inside summary text');
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
  for (const f of all.filter((x) => /^search\/.+\.json$/.test(r(x)))) {
    const records = JSON.parse(readText(f)) as { n?: string; s?: string; x?: string }[];
    if (!Array.isArray(records)) continue;
    const prose = proseOf(records).join('\n');
    for (const folder of FOLDERS_WITH_YEAR) if (prose.includes(folder)) hits.push(`${r(f)}: trip folder name ${folder} in prose`);
    for (const rec of records) {
      for (const text of [rec.n, rec.s, rec.x]) {
        if (text && isDated(text)) hits.push(`${r(f)}: a calendar date in "${text}"`);
        if (text && /https?:\/\//.test(text)) hits.push(`${r(f)}: a URL in "${text}"`);
      }
    }
  }
  return hits;
}

describe('no household notes, home town or dates in any public file', () => {
  it('scans every file of the fixture build', () => {
    expect(householdLeaks(OUT)).toEqual([]);
  });
  it('scans every file of the real build in the server build', () => {
    expect(householdLeaks(REAL_OUT)).toEqual([]);
  });
  it('can fail: it sees the home town, a nearby point and a plan note', () => {
    expect(homePoints('{"lat":43.8812,"lon":-78.9431}')).toHaveLength(1);
    expect(homePoints('{"lat":43.6532,"lon":-79.3832}')).toHaveLength(0);
    expect(homePoints('<trkpt lat="43.8801" lon="-78.9395">')).toHaveLength(1);
    expect(nearHome(43.9, -78.94)).toBe(false);
  });
  it('lists a place used by two public trips with both counted (fixture visits)', () => {
    const env = { ...process.env };
    process.env.LEGACY_TRIPS_JSON = path.join(FIXTURE_ROOT, 'legacy-trips.json');
    process.env.HUB_TODAY = '2026-10-17';
    try {
      expect(loadPlaces(FIXTURE_ROOT).find((r) => r.id === 'CA/AB/banff-national-park/lake-louise')?.plans).toBe(2);
    } finally {
      process.env.LEGACY_TRIPS_JSON = env.LEGACY_TRIPS_JSON;
      process.env.HUB_TODAY = env.HUB_TODAY;
      if (env.LEGACY_TRIPS_JSON === undefined) delete process.env.LEGACY_TRIPS_JSON;
      if (env.HUB_TODAY === undefined) delete process.env.HUB_TODAY;
    }
  });
});

// Public output says who a plan suits ("Suits ages 11 and up"), never who travelled (backlog 2.34).
const PARTY_PATTERNS: [string, RegExp][] = [
  ['a child around N', /\b(?:a|the) child around \d/i],
  // "the child" is a traveller unless it is a fare, a carrier or an age condition (backlog 2.43)
  ['"the child" as a traveller', /\bthe child(?:'s)?\b(?! (?:fares?|rates?|prices?|tickets?|carriers?|seats?|harness(?:es)?|sizes?|pass(?:es)?|menu|portions?|discount|helmets?|bikes?|trailers?)\b| is (?:under|over|younger|older|below|above|aged|less|at least|\d))/i],
  // a child's age is 1 to 17; "a 300-year-old church" is a building
  ['an N-year-old', /\b(?:1[0-7]|[1-9])-year-old\b(?! (?:church|chapel|tree|building|house|hut|bridge|town|village|tradition|wine|cheese|rule|record|school|hotel|lodge|inn|castle|fort|mill|barn|cabin|trail|road|route|mine|dam|tunnel|forest|glacier|ruin|ruins|monastery|temple|shrine|festival|company|business|brand|boat|ship|vessel)\b)/i],
  ['a family of N', /\bfamily of \d/i],
  ['N adults plus N children', /\b(?:\d+|two|three|four) adults? (?:plus|and) (?:\d+|two|three|four) (?:children|kids)/i],
  ['"with kids N+" in a title', /\bwith (?:kids|children) \d+\+?/i],
  ['"the other adult"', /\bthe other adult\b/i],
  ['"both adults"', /\bboth adults\b/i],
  ['our kids / our child', /\bour (?:kids?|child(?:ren)?|daughter|son)\b/i],
];

export function partyLeaks(root: string): string[] {
  const hits: string[] = [];
  const all = walkFiles(root);
  const r = (f: string) => path.relative(root, f).split(path.sep).join('/');
  for (const f of all.filter((x) => TEXTY.test(r(x)) || !path.extname(x))) {
    if (r(f).startsWith('_next/static/')) continue; // framework chunks and our UI strings are code, not trip prose
    const text = readText(f);
    for (const [label, re] of PARTY_PATTERNS) if (re.test(text)) hits.push(`${r(f)}: ${label}`);
  }
  return hits;
}

describe('no party description in any public file', () => {
  it('scans every file of the fixture build', () => {
    expect(partyLeaks(OUT)).toEqual([]);
  });
  it('scans every file of the real build in the server build', () => {
    expect(partyLeaks(REAL_OUT)).toEqual([]);
  });
  it('can fail: every pattern matches its own example', () => {
    const examples = [
      'a shorter option for a child around 6',
      'the other adult and the child ride',
      'Whether a 6-year-old counts',
      'a family of 3 cannot hike',
      '2 adults plus 2 children under 30 kg',
      'Patagonia with kids 11+',
      'only if both adults want',
      'the other adult walks',
      'our kids love it',
    ];
    for (const e of examples) expect(PARTY_PATTERNS.some(([, re]) => re.test(e)), e).toBe(true);
    expect(PARTY_PATTERNS.some(([, re]) => re.test('The family version suits children from about 6. Suits ages 11 and up. The child fare is 16.'))).toBe(false);
    // legitimate text the scrub keeps (backlog 2.43)
    const fine = ['A 300-year-old church stands here.', 'Bring the child carrier.', 'Not suitable if the child is under 4.', 'The child fare applies from age 12.', 'A small group can share a room.'];
    for (const e of fine) expect(PARTY_PATTERNS.some(([, re]) => re.test(e)), e).toBe(false);
  });
});

// A public page carries no email address and no Italian tax-code or certified-mail (PEC) marker: a source's publisher
// string once held a municipality's PEC and C.F. (audit 5.2-R1-4). Framework chunks are code, not prose.
const EMAIL_PATTERNS: [string, RegExp][] = [
  ['an email address', /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/],
  ['a PEC marker', /\bPEC\b[:\s]/],
  ['a codice fiscale marker', /\bC\.F\.\s*\d/],
  ['an Italian tax code', /\b[A-Z]{6}\d{2}[A-EHLMPR-T]\d{2}[A-Z]\d{3}[A-Z]\b/],
];

export function emailLeaks(root: string): string[] {
  const hits: string[] = [];
  const r = (f: string) => path.relative(root, f).split(path.sep).join('/');
  for (const f of walkFiles(root).filter((x) => TEXTY.test(r(x)) || !path.extname(x))) {
    if (r(f).startsWith('_next/static/')) continue;
    const text = readText(f);
    for (const [label, re] of EMAIL_PATTERNS) if (re.test(text)) hits.push(`${r(f)}: ${label}`);
  }
  return hits;
}

describe('no email address or tax-code marker in any public file', () => {
  it('scans every file of the fixture build', () => {
    expect(emailLeaks(OUT)).toEqual([]);
  });
  it('scans every file of the real build in the server build', () => {
    expect(emailLeaks(REAL_OUT)).toEqual([]);
  });
  it('can fail: every pattern matches its own example', () => {
    const examples = ['auronzo.bl@cert.ip-veneto.net', 'footer: PEC auronzo.bl', 'C.F. 83000710257', 'RSSMRA80A01H501U'];
    for (const e of examples) expect(EMAIL_PATTERNS.some(([, re]) => re.test(e)), e).toBe(true);
    for (const e of ['Comune di Auronzo di Cadore (auronzo.info)', 'Ask at @the desk', 'PECAN pie', 'Photo by A. Smith, CC BY 4.0']) {
      expect(EMAIL_PATTERNS.some(([, re]) => re.test(e)), e).toBe(false);
    }
  });
});

// The trip timeline (L3c) says who a plan suits, never who travelled. Its default values (family, a youngest of 6, two adults)
// are URL-state defaults and must not read as a description of the party in any string the adapter or the scheduler produces.
describe('no party description in the timeline strings', () => {
  const walk = (v: unknown, out: string[] = []): string[] => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach((x) => walk(x, out));
    else if (v && typeof v === 'object') Object.values(v).forEach((x) => walk(x, out));
    return out;
  };
  it('scans the adapter output: writtenFor, notes, know-before-you-go, scheduler inputs and the default timelines', async () => {
    const { createPublicData } = await import('@/lib/public');
    const data = createPublicData();
    const hits: string[] = [];
    for (const t of data.internals.trips.filter((x) => x.schedule)) {
      for (const s of walk([t.schedule, t.days.map((d) => [d.scheduleInput, d.variants, d.know, d.light, d.summaryProse])])) {
        for (const [label, re] of PARTY_PATTERNS) if (re.test(s)) hits.push(`${t.slug}: ${label}: ${s.slice(0, 90)}`);
        if (describesParty(s)) hits.push(`${t.slug}: party leak: ${s.slice(0, 90)}`);
      }
    }
    expect(hits).toEqual([]);
  });
  it('scans what the browser computes: every warning, note and reason for family profiles of every age and pace', async () => {
    const { createPublicData } = await import('@/lib/public');
    const { scheduleDay } = await import('@travel/core/schedule/schedule.ts');
    const data = createPublicData();
    const hits: string[] = [];
    for (const slug of ['canadian-rockies-2029', 'dolomites-2027', 'patagonia-2027']) {
      const trip = data.getTrip(slug)!;
      for (const youngest of [0, 3, 4, 6, 8, 11, 14, 17]) {
        for (const pace of ['relaxed', 'standard', 'full'] as const) {
          for (const d of trip.days) {
            const t = scheduleDay(d.scheduleInput!, { party: 'family', youngest, pace, adults: 2, walkKm: null, split: true });
            for (const s of walk([t.warnings, t.notes, t.variant, t.entries.map((e) => [e.title, e.time.note, e.duration.basis])])) {
              for (const [label, re] of PARTY_PATTERNS) if (re.test(s)) hits.push(`${slug} d${d.n} age ${youngest}: ${label}: ${s.slice(0, 90)}`);
              if (/\byear[- ]old\b|\bour (?:kids?|child)\b|\bthe youngest is\b/i.test(s)) hits.push(`${slug} d${d.n} age ${youngest}: ${s.slice(0, 90)}`);
            }
          }
        }
      }
    }
    expect([...new Set(hits)].slice(0, 10)).toEqual([]);
  });
});

// "Draft" is the workshop's word for a place with only the basics. A visitor never reads it on any built page: the lists, every place
// page, a card footer or the rows the list ships. The public levels are Basics only, Partly checked and Checked (3.42).
function builtPages(): string[] {
  const out = ['places/index.html', 'trips/index.html'];
  const dir = path.join(REAL_OUT, 'places');
  if (existsSync(dir)) for (const d of readdirSync(dir)) if (existsSync(path.join(dir, d, 'index.html'))) out.push(`places/${d}/index.html`);
  return out;
}
describe('internal words on the built pages', () => {
  it('"Draft" appears on no list page and no place page, payload included', () => {
    for (const page of builtPages()) {
      const f = path.join(REAL_OUT, page);
      if (!existsSync(f)) continue;
      expect(readText(f).match(/\bDraft\b/g) ?? [], page).toEqual([]);
    }
  });
  it('no glossary text, record ref, link-only platform, workflow wording or dangling comma in the visible text of any place page (verifier)', () => {
    const bad: string[] = [];
    const visible = (h: string): string => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'");
    const checks: [string, RegExp][] = [
      ['glossary text', /A local word on|An operator's own levels|Other or unknown system/],
      ['record ref', /(?:^|[\s(])(?:Place|Part|Offer|Route|Trip|Legacy)\/[a-z0-9]|[a-z]#[a-z-]+(?:\s|$)/i],
      ['link-only platform in text', /\b(?:AllTrails|Komoot|Tripadvisor)\b/i],
      ['workflow wording', /search result, not opened|written from memory|from memory\b/i],
      ['dangling comma', /Not checked yet: [^<\n]{0,200}(?:,\s*$|,…)/m],
      ['a dangling fragment', /\bsnowfields until\b/],
      ['workshop hint or raw token', /needs a name|needs a type|pairs fill in|Add a point with|Record the months|Set osm_ref|wikidata_qid|\b[a-z]{3,}_[a-z]{3,}\b|see [a-z0-9-]+ sight|is a value\b/],
      ['child age', /\b(?:1[0-7]|[1-9])[- ](?:year|yr)[- ]old\b(?! (?:church|chapel|tree|building|house|hut|bridge|tradition))|\b\d{1,2}-?yo\b/i],
    ];
    for (const page of builtPages()) {
      const f = path.join(REAL_OUT, page);
      if (!existsSync(f) || !page.startsWith('places/')) continue;
      const t = visible(readText(f));
      // each element on its own line, so a list that ends in a comma is seen where the element ends
      const lines = readText(f).replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, '\n');
      const comma = /^\s*Not checked yet: [^\n]*,\s*$/m.exec(lines);
      if (comma) bad.push(`${page}: list ends in a comma: ${comma[0].trim().slice(-40)}`);
      for (const [name, re] of checks) {
        const m = re.exec(t);
        if (m) bad.push(`${page}: ${name}: ${m[0].slice(0, 60)}`);
      }
    }
    expect(bad.slice(0, 12)).toEqual([]);
  });
  it('no agent or process note, FE grade or research marker appears on any place page (3.27, 3.20)', () => {
    const bad: string[] = [];
    for (const page of builtPages()) {
      const f = path.join(REAL_OUT, page);
      if (!existsSync(f)) continue;
      const m = /agent[- ]confirmed|by travel-(?:researcher|builder|planner|verifier)|needs? a person['\u2019]s (?:check|fix|review)|\bFE[1-5]\b|\b(?:INFERENCE|CALC)\b|suitability\.md|this repo/.exec(readText(f));
      if (m) bad.push(`${page}: ${m[0]}`);
    }
    expect(bad).toEqual([]);
  });
});
