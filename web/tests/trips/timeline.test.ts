import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scheduleDay, scheduleTrip } from '@travel/core/schedule/schedule.ts';
import { DEFAULT_PROFILE, type DayTimeline, type Profile } from '@travel/core/schedule/types.ts';
import { travelRoot } from '@/lib/data/root';
import { createPublicData } from '@/lib/public';
import { isDated } from '@/lib/public/dateless';
import { dolomitesLegPairs } from '@/lib/public/legs-pairs';
import { readLegsFile, readScheduleFile } from '@/lib/public/timeline';

const data = createPublicData();
const rockies = data.getTrip('canadian-rockies-2029')!;
const dolo = data.getTrip('dolomites-2027')!;
const P = (o: Partial<Profile> = {}): Profile => ({ ...DEFAULT_PROFILE, party: 'family', youngest: 6, ...o });
const adults = (o: Partial<Profile> = {}): Profile => P({ party: 'adults', youngest: null, ...o });
const day = (trip: typeof rockies, n: number) => trip.days.find((d) => d.n === n)!;
const run = (trip: typeof rockies, p: Profile, opts = {}) => trip.days.map((d) => scheduleDay(d.scheduleInput!, p, opts));
const strings = (v: unknown, out: string[] = []): string[] => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
};

describe('which trips get a timeline', () => {
  const trips = data.internals.trips;
  it('the 2 full and 6 summary trips have one, with a timeline for every day', () => {
    const withDays = trips.filter((t) => t.depth !== 'overview');
    expect(withDays.map((t) => t.slug).sort()).toEqual([
      'algonquin-muskoka-2026', 'canadian-rockies-2029', 'chamonix-mont-blanc-2028', 'dolomites-2027', 'iceland-ring-road-2027', 'patagonia-2027', 'utah-five-parks', 'vermont-fall-2026',
    ]);
    for (const t of withDays) {
      expect(t.schedule, t.slug).not.toBeNull();
      expect(t.schedule!.timelines.map((x) => x.day), t.slug).toEqual(t.days.map((d) => d.n));
      expect(t.days.every((d) => d.scheduleInput !== null), t.slug).toBe(true);
    }
  });
  it('the 6 overview trips have none', () => {
    const overview = trips.filter((t) => t.depth === 'overview');
    expect(overview).toHaveLength(6);
    for (const t of overview) {
      expect(t.schedule).toBeNull();
      expect(t.days).toEqual([]);
    }
  });
  it('summary trips are condensed: every time is suggested, nothing is fixed', () => {
    for (const t of trips.filter((x) => x.depth === 'summary')) {
      expect(t.schedule!.condensed).toBe(true);
      const conf = new Set(t.schedule!.timelines.flatMap((tl) => tl.entries.filter((e) => e.kind !== 'sun').map((e) => e.time.confidence)));
      expect(conf.has('fixed'), t.slug).toBe(false);
    }
  });
  it('writes a suitability line, never a description of the party', () => {
    expect(rockies.schedule!.writtenFor).toBe('families with a child from about 6');
    expect(dolo.schedule!.writtenFor).toBe('adults and children from about 8');
    for (const t of trips.filter((x) => x.schedule)) expect(t.schedule!.writtenFor, t.slug).not.toMatch(/\b\d+ adults?\b|\byear old|\byear-old|\bour\b|\bplus\b/i);
  });
});

describe('Rockies: the profile picks the version of each day (spec 3.3)', () => {
  it('the default (a family) gets the family version on every day, with split options on the split days', () => {
    const tl = rockies.schedule!.timelines;
    expect(tl.every((t) => t.variant.key === 'B')).toBe(true);
    for (const n of [2, 5, 7, 9, 10, 11, 13]) {
      const t = tl.find((x) => x.day === n)!;
      const note = t.notes.find((x) => x.kind === 'split-option');
      expect(note, `day ${n}`).toBeDefined();
      expect(note!.text).toMatch(/^Split option: /);
    }
    // the days with only an optional Track A say so more quietly
    for (const n of [3, 4, 6, 8, 12]) expect(tl.find((x) => x.day === n)!.notes.find((x) => x.kind === 'split-option')!.text).toMatch(/^Optional split: /);
    expect(tl.find((x) => x.day === 14)!.notes.find((x) => x.kind === 'split-option')).toBeUndefined();
  });
  it('adults get the adults\' hike on every day that has one, and no split row', () => {
    const t = run(rockies, adults());
    for (const x of t) {
      const hasA = day(rockies, x.day).variants.some((v) => v.key === 'A');
      expect(x.variant.key, `day ${x.day}`).toBe(hasA ? 'A' : 'B');
      expect(x.notes.find((n) => n.kind === 'split-option')).toBeUndefined();
    }
  });
  it('a family with a youngest of 14 gets the adults\' version where it fits', () => {
    const t = run(rockies, P({ youngest: 14 }));
    expect(t.find((x) => x.day === 5)!.variant.key).toBe('A');
    expect(t.find((x) => x.day === 8)!.variant.key).toBe('A');
  });
  it('a youngest of 6 stays on the family version even where the adults\' walk is short enough (Parker Ridge is listed as an adults\' walk)', () => {
    expect(run(rockies, P()).find((x) => x.day === 8)!.variant.key).toBe('B');
  });
  it('a relaxed pace never lands on a version that is over the relaxed budget, and says why when it falls to the easy one', () => {
    for (const x of run(rockies, P({ pace: 'relaxed' }))) {
      if (x.variant.key === 'C') expect(x.variant.reason).toMatch(/^Easy day: /);
    }
  });
  it('shows the no-fit chip with the numbers when even the easiest version is too much', () => {
    const t = run(dolo, P({ youngest: 4 }));
    const nofit = t.filter((x) => !x.fits);
    expect(nofit.length).toBeGreaterThan(3);
    const tre = nofit.find((x) => x.day === 3)!;
    expect(tre.notes[0]!.kind).toBe('no-fit');
    expect(tre.notes[0]!.text).toMatch(/Tre Cime di Lavaredo loop is 10 km; we plan walks up to 4 km at age 4/);
    expect(tre.notes[0]!.text).not.toMatch(/limit/);
    // the day shows one conflict line, not two overlapping times
    expect(tre.warnings.filter((w) => w.code === 'W_OVERLAP')).toEqual([]);
    const cadini = tre.entries.find((e) => e.sourceItemId === 'i6')!;
    expect(cadini.time.pinned).toBe(false);
    expect(tre.warnings.filter((w) => w.code === 'S_FIXED_MISSED')).toHaveLength(1);
    expect(tre.warnings.some((w) => w.code === 'S_NO_FIT')).toBe(true);
  });
  it('Day 5 by number: d=5C swaps to the easy version and says it was picked', () => {
    const t = scheduleDay(day(rockies, 5).scheduleInput!, P(), { variant: 'C' });
    expect(t.variant).toMatchObject({ key: 'C', chosenBy: 'override' });
    expect(t.entries.some((e) => e.id === 'mary-schaffer-loop')).toBe(false);
  });
  it('split=1 on Day 5 draws two lanes that rejoin at 14:00 at the boathouse car park', () => {
    const t = scheduleDay(day(rockies, 5).scheduleInput!, P({ split: true }));
    expect(t.lanes).toEqual(['B', 'A']);
    const together = t.entries.find((e) => e.sub === 'together')!;
    expect(together).toMatchObject({ start: '14:00', lane: 'all' });
    expect(together.title).toContain('Maligne Lake boathouse car park');
    expect(t.entries.find((e) => e.id === 'bald-hills')!.lane).toBe('A');
    // one adult: no split option
    expect(scheduleDay(day(rockies, 5).scheduleInput!, P({ adults: 1, split: true })).lanes).toEqual(['all']);
  });
  it('Day 1 is an arrival day and Day 15 a departure day; Days 3, 4, 8 and 12 are transfers', () => {
    const kinds = Object.fromEntries(rockies.days.map((d) => [d.n, d.scheduleInput!.kind]));
    expect(kinds[1]).toBe('arrival');
    expect(kinds[15]).toBe('departure');
    for (const n of [3, 4, 8, 12]) expect(kinds[n]).toBe('transfer');
    expect(kinds[5]).toBe('normal');
  });
  it("Day 1's sunset is a range from core/src/sun, not a typed time", () => {
    const t = rockies.schedule!.timelines.find((x) => x.day === 1)!;
    const vermilion = t.entries.find((e) => e.id === 'vermilion-lakes')!;
    expect(vermilion.time).toMatchObject({ confidence: 'anchored', source: 'sun' });
    expect(vermilion.time.anchor!.range).toEqual(['18:43', '19:16']);
  });
});

describe('Dolomites: authored times stay, routed legs are not estimates (check 8)', () => {
  const tl = dolo.schedule!.timelines;
  it('Day 3 keeps 11:30 and 16:30', () => {
    const t = tl.find((x) => x.day === 3)!;
    expect(t.entries.find((e) => e.sourceItemId === 'i5')).toMatchObject({ start: '11:30' });
    expect(t.entries.find((e) => e.sourceItemId === 'i6')).toMatchObject({ start: '16:30' });
    expect(t.entries.find((e) => e.sourceItemId === 'i5')!.time.confidence).toBe('fixed');
  });
  it('legs carry the stored minutes with no estimate mark where the cache has them', () => {
    const legs = tl.flatMap((t) => t.entries.filter((e) => e.kind === 'leg'));
    expect(legs.filter((l) => l.leg!.basis === 'routed').length).toBeGreaterThan(30);
    expect(legs.filter((l) => l.leg!.basis !== 'routed')).toEqual([]);
    expect(legs.every((l) => !l.honesty.includes('drive_estimated'))).toBe(true);
  });
  it('Braies is tied to first light and Limides to sunset', () => {
    const braies = tl.find((x) => x.day === 2)!.entries.find((e) => e.sourceItemId === 'i3')!;
    expect(braies.time).toMatchObject({ confidence: 'anchored', source: 'sun' });
    expect(braies.time.anchor!.to).toBe('sunrise');
    const limides = tl.find((x) => x.day === 8)!.entries.find((e) => e.sourceItemId === 'i18')!;
    expect(limides.time.anchor!.to).toBe('sunset');
  });
  it('Day 4 has the two versions with their labels', () => {
    const d4 = day(dolo, 4);
    expect(d4.variants.map((v) => [v.key, v.label])).toEqual([['A', 'Croda del Becco'], ['B', 'The Drava cycle path']]);
    expect(scheduleDay(d4.scheduleInput!, adults()).variant.key).toBe('A');
    expect(scheduleDay(d4.scheduleInput!, P({ youngest: 8 })).variant.key).toBe('B');
  });
  it('Day 14 leaves in time for the airport and Day 1 lands first', () => {
    expect(tl.find((x) => x.day === 14)!.entries.at(-1)).toMatchObject({ kind: 'end', sub: 'at-airport', start: '12:00' });
    expect(tl.find((x) => x.day === 1)!.entries[0]).toMatchObject({ kind: 'start', sub: 'land', start: '11:30' });
  });
});

describe('review round two', () => {
  it('only the genuinely long Rockies days warn about the cap at the default profile', () => {
    const capped = rockies.schedule!.timelines.filter((t) => t.warnings.some((w) => w.code === 'S_DAY_CAP')).map((t) => t.day);
    // 4 and 7 are 10 h 15 away from base; 13 runs to 21:55 with the optional Rawson Lake. Everything else, Day 5 included, is under 10 h away.
    expect(capped, capped.join()).toEqual([4, 7, 13]);
    expect(scheduleDay(day(rockies, 5).scheduleInput!, P(), { variant: 'C' }).warnings.some((w) => w.code === 'S_DAY_CAP')).toBe(false);
  });
  it('the adults version of Day 5 takes its title from its own version and keeps the on-trail lunch before the drive back', () => {
    const d5 = day(rockies, 5);
    expect(d5.variants.find((v) => v.key === 'A')!.title).toBe('Bald Hills');
    const t = scheduleDay(d5.scheduleInput!, adults());
    const lunch = t.entries.findIndex((e) => e.style === 'on-trail');
    const back = t.entries.findIndex((e) => e.kind === 'leg' && /^Back to/.test(e.title));
    if (lunch >= 0) expect(lunch).toBeLessThan(back);
  });
  it('a summary trip is a condensed plan: parts of the day and its own flight, no invented drives (Patagonia Day 2)', () => {
    const pat = data.getTrip('patagonia-2027')!;
    const t = pat.schedule!.timelines.find((x) => x.day === 2)!;
    expect(t.blocks).toBe(true);
    expect(t.entries[0]).toMatchObject({ title: 'Flight to Ushuaia', kind: 'leg', block: 'Morning' });
    expect(t.entries[0]!.leg!.mode).toBe('flight');
    expect(t.entries.filter((e) => e.kind === 'leg' && e.leg!.mode === 'drive' && e.leg!.basis === 'estimate')).toEqual([]);
    expect(t.entries.some((e) => e.kind === 'rest' || e.kind === 'break')).toBe(false);
    for (const x of data.internals.trips.filter((y) => y.depth === 'summary')) expect(x.schedule!.timelines.every((tl) => tl.blocks), x.slug).toBe(true);
  });
  it('the page model ships no adults count, and offers only places within 30 km, each with its distance', async () => {
    const { buildTripPageModel } = await import('@/components/trips/model');
    const { listPlaces, getPlace } = await import('@/lib/public');
    const m = buildTripPageModel(rockies, (s) => { const p = getPlace(s); return p ? { point: p.point ? { lat: p.point.lat, lon: p.point.lon } : null, photo: p.photo } : null; }, listPlaces());
    expect(JSON.stringify(m.timeline)).not.toMatch(/"adults":/);
    for (const c of Object.values(m.timeline!.addables)) if (c.group !== 'quick') expect(c.km!).toBeLessThanOrEqual(30);
    const d5 = m.timeline!.addByDay[5]!.map((k) => m.timeline!.addables[k]!);
    expect(d5.some((c) => /bow lake|peyto|mount robson/i.test(c.name))).toBe(false);
  });
  it('generated times are on 5 minute marks at the default profile', () => {
    for (const t of rockies.schedule!.timelines) for (const e of t.entries) if (e.addedBy === 'scheduler' && e.kind !== 'leg' && e.kind !== 'sun') expect(Number(e.start.slice(3)) % 5, `${t.day} ${e.title} ${e.start}`).toBe(0);
  });
});

describe('server and client parity (spec 2.1)', () => {
  it('re-running the scheduler on the shipped inputs gives the pre-rendered timelines', () => {
    for (const t of data.internals.trips.filter((x) => x.schedule)) {
      const inputs = JSON.parse(JSON.stringify(t.days.map((d) => d.scheduleInput)));
      expect(scheduleTrip(inputs, t.schedule!.defaultProfile), t.slug).toEqual(JSON.parse(JSON.stringify(t.schedule!.timelines)));
    }
  });
});

describe('the data files (data/schedules)', () => {
  const root = travelRoot();
  const dir = path.join(root, 'data', 'schedules');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  it('are trip-schedule/1, name their trip, and carry no calendar date', () => {
    expect(files.sort()).toEqual(['canadian-rockies-2029.json', 'dolomites-2027.json']);
    for (const f of files) {
      const text = readFileSync(path.join(dir, f), 'utf8');
      const doc = JSON.parse(text);
      expect(doc.schema).toBe('trip-schedule/1');
      expect(f).toBe(`${doc.trip}.json`);
      expect(isDated(text), f).toBe(false);
      expect(JSON.stringify(doc.defaultProfile)).not.toMatch(/name|label/i);
    }
  });
  it('every Rockies key resolves to a record or an inserted entry, and every leg end to an item or a fixed name', () => {
    const file = readScheduleFile(root, 'canadian-rockies-2029')!;
    const rdir = path.join(root, 'legacy', 'canadian-rockies-sept-2029', 'data');
    const ids = new Set(['trails', 'sights', 'adventures'].flatMap((f) => (JSON.parse(readFileSync(path.join(rdir, `${f}.json`), 'utf8')) as { id: string }[]).map((r) => r.id)));
    const problems: string[] = [];
    for (const id of Object.keys(file.titles ?? {})) if (!ids.has(id)) problems.push(`titles.${id}`);
    for (const [n, d] of Object.entries(file.days)) {
      const inserted = new Set<string>();
      const used = new Set<string>(['base', 'next-base', 'origin']);
      for (const list of Object.values(d.order ?? {})) {
        for (const e of list) {
          const id = typeof e === 'string' ? e : e.id;
          used.add(id);
          if (typeof e !== 'string' && e.kind && !ids.has(id)) inserted.add(id);
          else if (!ids.has(id)) problems.push(`day ${n} order ${id}`);
        }
      }
      for (const k of Object.keys(d.items ?? {})) if (!ids.has(k) && !inserted.has(k)) problems.push(`day ${n} items.${k}`);
      for (const l of d.legs ?? []) for (const end of [l.from, l.to]) if (!used.has(end)) problems.push(`day ${n} leg end ${end}`);
      if (d.split && !(d.order?.A && d.split.rejoin.afterItem && [...(d.order.B ?? [])].some((e) => (typeof e === 'string' ? e : e.id) === d.split!.rejoin.afterItem))) problems.push(`day ${n} rejoin afterItem`);
    }
    expect(problems).toEqual([]);
  });
  it('every Dolomites override names an item of that day', () => {
    const file = readScheduleFile(root, 'dolomites-2027')!;
    const snap = dolo.days;
    for (const [n, d] of Object.entries(file.days)) {
      const items = new Set(snap.find((x) => x.n === Number(n))!.items.map((i) => i.id));
      for (const k of Object.keys(d.items ?? {})) expect(items.has(k), `day ${n} ${k}`).toBe(true);
    }
  });
  it('the Dolomites legs cache covers every consecutive pair (what legs-ors.mjs --check asks)', () => {
    const legs = readLegsFile(root, 'dolomites-2027');
    if (!legs) return; // the cache is optional: without it every leg is an estimate
    const snap = JSON.parse(readFileSync(path.join(root, 'web', 'data-snapshots', 'prototype.json'), 'utf8'));
    const have = new Set(legs.legs.flatMap((l) => [`${l.from}|${l.to}`, `${l.to}|${l.from}`]));
    const missing = dolomitesLegPairs(snap.trip.days, snap.places).filter(([a, b]) => !have.has(`${a}|${b}`));
    expect(missing).toEqual([]);
    expect(legs.schema).toBe('trip-legs/1');
    expect(legs.attribution).toMatch(/OpenRouteService/);
    for (const l of legs.legs) expect(l.minutes).toBeGreaterThan(0);
  });
  it('the key never reaches a file under data/schedules', () => {
    for (const f of [...files.map((x) => path.join(dir, x)), path.join(dir, 'legs', 'dolomites-2027.json')].filter(existsSync)) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/api_key|Authorization|ORS_API_KEY/i);
    }
  });
});

describe('what the public timeline says', () => {
  it('has no calendar date, no marker and no research id in any string of any timeline or schedule input', () => {
    const bad: string[] = [];
    for (const t of data.internals.trips.filter((x) => x.schedule)) {
      for (const s of strings([t.schedule, t.days.map((d) => [d.scheduleInput, d.variants, d.know, d.light])])) {
        if (isDated(s)) bad.push(`${t.slug}: dated: ${s.slice(0, 80)}`);
        if (/\b(INFERENCE|CALC|GAP)\b|low confidence/.test(s)) bad.push(`${t.slug}: marker: ${s.slice(0, 80)}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it('warning messages for any profile carry no calendar date and no raw research text', () => {
    const msgs: DayTimeline[] = [];
    for (const age of [2, 4, 6, 9, 14]) for (const pace of ['relaxed', 'standard', 'full'] as const) msgs.push(...run(rockies, P({ youngest: age, pace, split: true })), ...run(dolo, P({ youngest: age, pace })));
    const all = msgs.flatMap((t) => [...t.warnings.map((w) => w.message), ...t.notes.map((n) => n.text), t.variant.reason]);
    expect(all.length).toBeGreaterThan(100);
    expect(all.filter((s) => isDated(s))).toEqual([]);
  });
});
