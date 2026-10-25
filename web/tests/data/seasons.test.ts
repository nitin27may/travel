import { mkdirSync, readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DropLog } from '@/lib/public/dateless';
import { monthsLabel } from '@/lib/public/trips';
import { parseSeasonFile, readSeason } from '@/lib/public/seasons';
import { realData, REPO } from './support';

const SIX = ['costa-rica-2027', 'new-hampshire-stopover-2026', 'niagara-day-2026', 'norway-summer-2028', 'quebec-2026', 'switzerland-2027'];
const d = realData();
const field = (value: unknown, basis = 'plan') => ({ value, basis });
const doc = (over: Record<string, unknown> = {}) => ({
  schema: 'trip-season-basic/1', trip: 't', windows: [],
  season: {
    months: field([2]), label: field('Mid-February'), why: field('Deep dry season.', 'official'),
    weather: { tempC: field('17 to 36 C', 'official'), rain: field('Dry.', 'official'), daylight: field('11 hours.', 'computed'), notes: [{ text: 'Bring a hat.', basis: 'official' }] },
    ...over,
  },
});
function rootWith(name: string, content: unknown): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'seasons-'));
  mkdirSync(path.join(root, 'data', 'seasons'), { recursive: true });
  writeFileSync(path.join(root, 'data', 'seasons', `${name}.json`), typeof content === 'string' ? content : JSON.stringify(content));
  return root;
}

describe('data/seasons through the adapter', () => {
  it.each(SIX)('%s shows the file\'s months and label', (slug) => {
    const file = JSON.parse(readFileSync(path.join(REPO, 'data', 'seasons', `${slug}.json`), 'utf8')).season;
    const t = d.internals.trips.find((x) => x.slug === slug)!;
    expect(t.season).not.toBeNull();
    expect(t.seasonNotSet).toBe(false);
    expect(t.season!.months).toEqual(file.months.value);
    expect(t.season!.label).toBe(file.label.value);
    expect(t.season!.why.length).toBeGreaterThan(10);
  });

  it('every one of the six is marked as the plan\'s own window (basis plan)', () => {
    for (const slug of SIX) expect(d.internals.trips.find((x) => x.slug === slug)!.season!.basis).toBe('plan');
  });
  it('a seed season is researched', () => {
    for (const t of d.internals.trips.filter((x) => x.season && !SIX.includes(x.slug))) expect(t.season!.basis).toBe('researched');
  });

  it('a trip with a seed season keeps it (no file is read)', () => {
    const seeded = d.internals.trips.filter((t) => t.season && !SIX.includes(t.slug));
    expect(seeded.length).toBeGreaterThan(0);
    for (const t of seeded) expect(t.season!.label.length).toBeGreaterThan(0);
  });

  it('no trip in the six is left without a season', () => {
    expect(d.internals.trips.filter((t) => SIX.includes(t.slug) && t.seasonNotSet)).toEqual([]);
  });

  it('season texts pass the dateless rule', () => {
    const log = new DropLog();
    for (const slug of SIX) readSeason(REPO, slug, log, monthsLabel);
    expect(log.items).toEqual([]);
  });
});

describe('readSeason', () => {
  it('returns null with no file', () => {
    expect(readSeason(rootWith('other', doc()), 'none', new DropLog(), monthsLabel)).toBeNull();
  });
  it('maps { value } fields to the Season shape', () => {
    const s = readSeason(rootWith('t', doc()), 't', new DropLog(), monthsLabel)!;
    expect(s).toMatchObject({ months: [2], label: 'Mid-February', weather: { tempC: '17 to 36 C', notes: ['Bring a hat.'] } });
  });
  it('carries the basis: plan for a plan-only window, researched otherwise', () => {
    expect(readSeason(rootWith('t', doc()), 't', new DropLog(), monthsLabel)!.basis).toBe('plan');
    expect(readSeason(rootWith('t', doc({ months: field([2], 'official') })), 't', new DropLog(), monthsLabel)!.basis).toBe('researched');
  });
  it('leaves the reason line as written (the marker comes from the basis, not from a word in the text)', () => {
    expect(readSeason(rootWith('t', doc()), 't', new DropLog(), monthsLabel)!.why).toBe('Deep dry season.');
  });
  it('drops a dated text and falls back to the months for the label', () => {
    const log = new DropLog();
    const s = readSeason(rootWith('t', doc({ label: field('Opens 15 Jun') })), 't', log, monthsLabel)!;
    expect(s.label).toBe('February');
    expect(log.items.length).toBe(1);
  });
  it('a malformed file fails with the file name', () => {
    expect(() => readSeason(rootWith('t', doc({ months: field([13]) })), 't', new DropLog(), monthsLabel)).toThrow(/t\.json: season file is not trip-season-basic\/1 at \/season\/months/);
    expect(() => readSeason(rootWith('t', '{oops'), 't', new DropLog(), monthsLabel)).toThrow(/t\.json: not valid JSON/);
    expect(() => parseSeasonFile({ schema: 'x' }, 'f.json', 'f')).toThrow(/f\.json: season file is not/);
  });
  it('a file whose trip is not its name fails (a copied file would show another trip\'s season)', () => {
    expect(() => readSeason(rootWith('other', doc()), 'other', new DropLog(), monthsLabel)).toThrow(/"trip" is "t" but the file is for "other"/);
  });
});
