import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { incomingOf, loadWorld } from '@travel/core/capture/records.ts';
import type { CaptureDoc } from '@travel/core/schema/capture/records.ts';
import { SECTION_IDS, defaultContract } from '@/lib/public/contract';
import { buildSections, SECTION_TITLES, type PageModel, type Row } from '@/lib/public/sections';
import { describesParty } from '@/lib/public/party';
import { REPO, WEB_DIR } from './support';

const world = loadWorld(REPO);
const contract = defaultContract(REPO);
const page = (ref: string): PageModel => buildSections(world, ref, contract)!;
const refEnd = (suffix: string): string => [...world.cap.keys()].find((r) => r.endsWith(suffix) && !r.startsWith('part/') && !r.startsWith('offer/'))!;
const sec = (m: PageModel, id: string) => m.sections.find((s) => s.id === id)!;
const rowOf = (m: PageModel, key: string): Row | undefined => m.sections.flatMap((s) => s.rows).find((r) => r.key === key);

describe('buildSections: the 14 sections in order', () => {
  it('returns every section in the contract order, with titles from one table', () => {
    const m = page('place/lake-louise');
    expect(m.sections.map((s) => s.id)).toEqual([...SECTION_IDS]);
    expect(m.sections.map((s) => s.n)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    expect(sec(m, 'warnings').title).toBe('Before you go'); // Q29 recommended
    expect(SECTION_TITLES.warnings).toBe('Before you go');
  });

  it('lets the caller change a title without code (Q29 to Q32 are open)', () => {
    const m = buildSections(world, 'place/lake-louise', contract, { titles: { warnings: 'Warnings' }, words: { gap: 'No data' } })!;
    expect(sec(m, 'warnings').title).toBe('Warnings');
    expect(rowOf(m, 'access_points')!.gapWording).toBeTruthy();
  });

  it('returns null for a ref with no capture record or a type the contract does not know', () => {
    expect(buildSections(world, 'place/not-a-place', contract)).toBeNull();
  });

  it('builds every capture record without throwing, with one home per property and no N property', () => {
    let built = 0;
    for (const [ref, l] of world.cap) {
      const m = buildSections(world, ref, contract);
      if (!m) continue;
      built += 1;
      expect(m.sections, ref).toHaveLength(14);
      const seen = new Set<string>();
      const marks = contract.marks(l.rec.type, l.rec.layer as never, { suitabilityFrom: m.ticket ? 'offer' : undefined });
      for (const s of m.sections) {
        for (const row of s.rows) {
          expect(marks.has(row.key), `${ref}: ${row.key} is N for ${l.rec.type} but has a row`).toBe(true);
          expect(seen.has(row.key), `${ref}: ${row.key} drawn twice`).toBe(false);
          seen.add(row.key);
          if (row.gap) expect(row.text, `${ref} ${row.key}`).toBeNull();
        }
      }
    }
    expect(built).toBeGreaterThan(200);
  });
});

describe('buildSections: the owner rule for empty sections (Lake Louise)', () => {
  const m = page('place/lake-louise');

  it('draws sections 1 to 4 and 6 to 14, and not the route section (all N for a lake)', () => {
    for (const s of m.sections) {
      if (s.id === 'activity') expect(s.drawn, 'activity').toBe(false);
      else expect(s.drawn, s.id).toBe(true);
    }
    expect(sec(m, 'activity').rows).toEqual([]);
    expect(sec(m, 'activity').closing).toBeNull();
  });

  it('shows a gap row for a missing R property and folds a section with no value into one closing line', () => {
    expect(rowOf(m, 'access_points')).toMatchObject({ gap: true, text: null, mark: 'R' });
    const options = sec(m, 'options');
    expect(options.empty).toBe(true); // the page draws the closing line, not a gap chip
    expect(options.rows.every((r) => r.gap)).toBe(true);
    expect(options.closing).toMatch(/^Not checked yet: price/);
  });

  it('collapses missing A properties into one closing line per section', () => {
    const when = sec(m, 'when');
    expect(when.closing).toMatch(/^Not checked yet: /);
    expect(when.closing!.match(/Not checked yet/g)).toHaveLength(1);
  });

  it('keeps the present values: how to get there and the access season', () => {
    expect(rowOf(m, 'walk_m')).toMatchObject({ gap: false });
    expect(rowOf(m, 'access_season')!.text).toMatch(/Shuttle: open 15 May to 12 Oct/);
    expect(rowOf(m, 'access_season')!.val!.basisLabel).toBeTruthy();
    expect(rowOf(m, 'access_season')!.val!.read).toBe('2026-10-18');
  });
});

describe('buildSections: the capture model read correctly (CC-adapter 3 to 5)', () => {
  it('a lift line reads its ticket offer: the ticket, the top station, and the suitability block', () => {
    const m = page(refEnd('adventures/banff-gondola'));
    expect(m.ticket!.ref).toMatch(/banff-gondola#ticket$/);
    expect(m.suitabilityRef).toBe(m.ticket!.ref);
    expect(m.payoff!.ref).toMatch(/banff-gondola#top$/);
    expect(m.routeStops.some((s) => s.role === 'reaches' && /#top$/.test(s.ref))).toBe(true);
    // Who it suits is drawn for a line whose route layer carries no suitability block, and the lift rows are in When to go
    expect(sec(m, 'suits').drawn).toBe(true);
    expect(sec(m, 'suits').delegate).toBe('suitability');
    expect(rowOf(m, 'ext.lift.last_down')!.text).toMatch(/20:50/);
    // the ticket is the content of Options and prices
    expect(sec(m, 'options').drawn).toBe(true);
    expect(m.offers[0]!.ref).toBe(m.ticket!.ref);
    expect(m.offers[0]!.offerClass).toBe('ticket');
  });

  it('a place lists its canoe rental under "At this place you can also", and not under its own tickets', () => {
    const m = page(refEnd('sights/moraine-lake'));
    const names = m.around.flatMap((g) => g.items.map((i) => i.name));
    expect(names).toContain('Moraine Lake canoe rental');
    expect(m.offers.map((o) => o.name)).not.toContain('Moraine Lake canoe rental');
    expect(sec(m, 'around').title).toBe('At this place you can also');
  });

  // a small synthetic trip for the cases the real data has not reached yet (the minitrekking has no place; a trail with a payoff)
  const synthetic: CaptureDoc = {
    schema: 'capture/1',
    trip: 'test-trip',
    lane: 'test',
    researched: '2026-10-18',
    agent: 'test',
    model: 'test',
    sources: [],
    records: [
      { ref: 'test/place/lakeview', type: 'water.body.lake', layer: 'place', name: 'Lakeview' },
      { ref: 'test/place/trailhead-lot', type: 'access.park.parking', layer: 'place', name: 'Trailhead lot', parks_for: ['test/route/ridge'] },
      { ref: 'test/place/pass', type: 'nature.summit.summit', layer: 'place', name: 'Ridge Pass' },
      { ref: 'test/place/tarn', type: 'water.body.lake', layer: 'place', name: 'Little Tarn' },
      { ref: 'test/route/ridge', type: 'nature.trail.hike', layer: 'route', name: 'Ridge trail', starts_at: ['test/place/lakeview'], passes: [{ ref: 'test/place/tarn', at_km: 2.5 }], reaches: ['test/place/pass'] },
      { ref: 'test/offer/minitrek', type: 'water.paddle.canoe.rental', layer: 'offer', offer_class: 'experience', name: 'Minitrekking' },
      { ref: 'test/offer/canoe', type: 'water.paddle.canoe.rental', layer: 'offer', offer_class: 'rental', name: 'Canoe hire', at: ['test/place/lakeview'] },
      { ref: 'part/test/route/ridge#payoff', type: 'nature.summit.summit', layer: 'place', name: 'Ridge Pass summit', part_of: ['test/route/ridge'] },
    ],
  } as unknown as CaptureDoc;
  const synth = loadWorld(REPO, undefined, [synthetic]);
  const synthPage = (ref: string): PageModel => buildSections(synth, ref, contract)!;

  it('an offer with no `at` place shows the gap "Where: not checked yet"; one with a place names it', () => {
    const orphan = synthPage('test/offer/minitrek');
    expect(rowOf(orphan, 'at')).toMatchObject({ gap: true, text: null });
    expect(rowOf(orphan, 'at')!.gapWording).toBeTruthy();
    expect(rowOf(synthPage('test/offer/canoe'), 'at')!.text).toBe('Lakeview');
  });

  it('a place lists the rental offered at it under "at this place you can also", grouped by domain', () => {
    const lake = synthPage('test/place/lakeview');
    expect(lake.around.flatMap((g) => g.items.map((i) => i.name))).toEqual(['Canoe hire']);
    expect(lake.around[0]!.domain).toBe('water');
    expect(lake.ways.map((w) => w.name)).toEqual([]);
  });

  it('a route lists its start, what it passes with the distance along, and its payoff; the place lists the route as a way', () => {
    const m = synthPage('test/route/ridge');
    expect(m.routeStops.map((s) => `${s.role}:${s.name}:${s.atKm}`)).toEqual(['starts_at:Lakeview:0', 'passes:Little Tarn:2.5', 'reaches:Ridge Pass:null']);
    expect(m.accessPoints.map((a) => `${a.role}:${a.name}`)).toContain('starts_at:Lakeview');
    expect(m.accessPoints.map((a) => `${a.role}:${a.name}`)).toContain('parks_for:Trailhead lot');
    expect(synthPage('test/place/pass').ways.map((w) => w.name)).toEqual(['Ridge trail']);
  });

  it('folds a `part/...#...` record into its parent page', () => {
    const m = synthPage('test/route/ridge');
    expect(m.parts.map((p) => p.name)).toEqual(['Ridge Pass summit']);
    expect(synthPage('part/test/route/ridge#payoff').name).toBe('Ridge Pass summit');
  });

  it('"How to get there" for a place lists the routes that reach it, and never an offer', () => {
    let checked = 0;
    for (const [ref] of world.cap) {
      const inc = incomingOf(world, ref);
      if (inc.reached_by.length === 0) continue;
      const m = buildSections(world, ref, contract);
      if (!m) continue;
      for (const w of m.ways) expect(world.cap.get(w.ref)!.rec.layer).toBe('route');
      expect(m.ways.length).toBeGreaterThan(0);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('a route with no judgement of its own says it takes the draw from the place it reaches', () => {
    const m = page(refEnd('adventures/banff-gondola'));
    expect(m.payoff!.name).toMatch(/top station/);
    const draw = rowOf(m, 'draw');
    expect(draw).toMatchObject({ gap: false, echo: true });
  });
});

describe('buildSections: one home, glance echoes and the warning lines', () => {
  it('the glance names properties, not labels, and each is homed in one row', () => {
    const m = page('place/lake-louise');
    expect(m.glance.length).toBeGreaterThan(0);
    expect(m.glance.length).toBeLessThanOrEqual(6);
    for (const k of m.glance) expect(contract.properties[k]).toBeDefined();
  });

  it('section 3 lists a booking rule with its kind label and basis', () => {
    const m = page(refEnd('adventures/banff-gondola'));
    const w = sec(m, 'warnings');
    expect(w.lines[0]).toMatchObject({ kind: 'Book', home: 'access_cost' });
    expect(w.rows.find((r) => r.key === 'access_cost')!.val!.basisLabel).toBeTruthy();
  });

  it('the place checks count answered base R properties and carry the engine level', () => {
    const m = page('place/lake-louise');
    expect(m.checks.total).toBeGreaterThan(5);
    expect(m.checks.done).toBeLessThan(m.checks.total);
    expect(m.checks.level).toBe('draft');
  });
});

describe('buildSections: honesty and privacy', () => {
  it('carries no household text, party description, rating or link-only platform in any string', () => {
    const bad = /planned as|hotel idea|base camp:|whitby|\b\d(?:\.\d)? ?stars?\b|alltrails|komoot|tripadvisor|\b[\d,]+ reviews\b/i;
    const texts: string[] = [];
    // link tabs keep the kind name of a link-only platform (a link out is allowed; its figures are never read)
    const walk = (v: unknown, key = ''): void => {
      if (typeof v === 'string') texts.push(v);
      else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'sources' && k !== 'links' && !(key === 'links' && k === 'kind')) walk(x, k);
    };
    for (const [ref] of world.cap) {
      const m = buildSections(world, ref, contract);
      if (m) walk(m);
    }
    expect(texts.length).toBeGreaterThan(2000);
    expect(texts.filter((t) => bad.test(t))).toEqual([]);
    expect(texts.filter(describesParty)).toEqual([]);
  });

  it('S3: no rendering decision by type id in the page modules', () => {
    const files = ['contract.ts', 'sections.ts', 'suitability.ts', 'relevance.ts', 'vals.ts'].map((f) => readFileSync(path.join(WEB_DIR, 'lib', 'public', f), 'utf8'));
    for (const src of files) expect(src).not.toMatch(/\b(?:typeId|type|cap\.type|rec\.type)\s*===\s*['"`]/);
    for (const src of files) expect(src).not.toMatch(/\.startsWith\(['"`](?:nature|water|air|ride|mountain|play|snow|wheels|culture|food|stay)\./);
  });
});
