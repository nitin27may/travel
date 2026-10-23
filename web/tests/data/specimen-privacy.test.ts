import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { builtHtml, builtStatic } from '../helpers/built';

// /specimen/ is a built, served (noindex) page. Its demo values must name no real trip: no date range of a trip we have, no departure of
// that shape, no party line (audit G-B, GB-B-1). The page's own values are invented ones (a year no plan uses).
const MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)';
/** Years the real plans run in (2026 to 2029); the specimen uses another year. */
const REAL_YEAR = '(?:2026|2027|2028|2029)';

export const LEAKS: [string, RegExp][] = [
  ['a trip date range', new RegExp(`\\b\\d{1,2}\\s*[–-]\\s*\\d{1,2}\\s+${MONTH}\\s+${REAL_YEAR}\\b`)],
  ['a trip date range across months', new RegExp(`\\b\\d{1,2}\\s+${MONTH}\\s*[–-]\\s*\\d{1,2}\\s+${MONTH}\\s+${REAL_YEAR}\\b`)],
  ['a departure with a day, a date and a time', new RegExp(`\\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\\s+\\d{1,2}\\s+${MONTH}\\s+${REAL_YEAR}\\s+\\d{1,2}:\\d{2}\\b`)],
  ['a party line', /\b\d+\s+adults?\b|\b\d+\s+child(?:ren)?\b|Travellers?:\s*\d/i],
  ['a countdown to a real trip', /\bIn \d+ days\b/],
];

export function leaksIn(text: string): string[] {
  return LEAKS.filter(([, re]) => re.test(text)).map(([what]) => what);
}

function builtSpecimen(): { html: string; chunks: string[] } {
  const file = builtHtml('/specimen/');
  if (!existsSync(file)) throw new Error('no built /specimen/ page: run the web build first');
  const html = readFileSync(file, 'utf8');
  const srcs = [...html.matchAll(/<script\b[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]!).filter((s) => s.startsWith('/_next/static/'));
  return { html, chunks: srcs.map((s) => readFileSync(builtStatic(s), 'utf8')) };
}

describe('/specimen/ names no real trip, date or party', () => {
  it('the scan is live: the values the page used to ship are found', () => {
    // synthetic strings in the formats the page had (audit GB-B-1)
    expect(leaksIn('Save 13 – 26 Jul 2027 · 13 nights')).toContain('a trip date range');
    expect(leaksIn('26 Feb – 11 Mar 2027 · 13 nights')).toContain('a trip date range across months');
    expect(leaksIn('In 131 days')).toContain('a countdown to a real trip');
    expect(leaksIn('Fri 26 Feb 2027 23:50')).toContain('a departure with a day, a date and a time');
    expect(leaksIn('Travellers: 2 adults, 1 child')).toContain('a party line');
    expect(leaksIn('3 – 16 May 2031 · 13 nights · Mon 5 May 2031 08:10 · 3 travellers')).toEqual([]);
  });

  it('the built page and every client file it loads are clean', () => {
    const { html, chunks } = builtSpecimen();
    expect(leaksIn(html), 'the page HTML').toEqual([]);
    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((c, i) => expect(leaksIn(c), `client chunk ${i}`).toEqual([]));
  });
});
