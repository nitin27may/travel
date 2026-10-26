import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadTrips } from '@/lib/data/trips';
import { travelRoot } from '@/lib/data/root';
import { builtOutDir } from '../helpers/built';

// PRIV-TD (BACKLOG 15.328, R-257, owner Q308), the built half: no served trip page, list row or payload says "Finished plan", carries
// the `data-trip-done` marker or `isDone`, or holds a value of the household's real trip dates. The API half is trip-status.test.ts.

// the hub's countdown badge is matched as written ("Past trip"); the home legend's generic "a past trip used as the template" is copy
const BADGE = /\bPast trip\b/;
const STATUS_WORDS = /finished plan|kept as a template|use (?:it )?as a template|data-trip-done/i;

function realDateValues(): string[] {
  const out = new Set<string>();
  for (const t of loadTrips(travelRoot())) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(t.date)) out.add(t.date);
    if (t.dates.trim().length >= 6) out.add(t.dates.trim());
  }
  return [...out];
}

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const f = path.join(dir, n);
    if (statSync(f).isDirectory()) walk(f, out);
    else out.push(f);
  }
  return out;
}

describe('built trip pages carry no household-derived status (PRIV-TD)', () => {
  const out = builtOutDir();
  const real = realDateValues();
  const served = [
    ...walk(path.join(out, 'trips')).filter((f) => /\.(html|txt|json)$/.test(f)),
    ...['index.html', 'index.txt'].map((f) => path.join(out, f)).filter((f) => existsSync(f)),
  ];

  it('found the trip pages and the real dates to look for', () => {
    expect(real.length).toBeGreaterThan(5);
    expect(served.some((f) => f.endsWith(path.join('trips', 'index.html')))).toBe(true);
    expect(served.filter((f) => f.endsWith('index.html')).length).toBeGreaterThan(10);
  });

  it('no trip page or list holds "Finished plan", the done marker, isDone or a real trip date', () => {
    const hits: string[] = [];
    for (const f of served) {
      const text = readFileSync(f, 'utf8');
      const rel = path.relative(out, f);
      if (STATUS_WORDS.test(text) || BADGE.test(text)) hits.push(`${rel}: a finished-trip status word`);
      if (/isDone/.test(text)) hits.push(`${rel}: isDone`);
      if (real.some((v) => text.includes(v))) hits.push(`${rel}: a real trip date`);
    }
    expect(hits).toEqual([]);
  });

  it('every full or summary trip page reads "Published plan" on its cover', () => {
    const pages = served.filter((f) => /trips[/\\][^/\\]+[/\\]index\.html$/.test(f));
    expect(pages.length).toBeGreaterThan(5);
    for (const f of pages) {
      const kicker = /<p class="trip-kicker">([^<]*)/.exec(readFileSync(f, 'utf8'))?.[1] ?? '';
      expect(kicker, path.relative(out, f)).toMatch(/^(Published plan|Overview)\b/);
    }
  });
});
