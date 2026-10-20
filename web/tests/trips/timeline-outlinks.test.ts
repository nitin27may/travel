import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WEB } from '../helpers';

const OUT = path.join(WEB, 'out');

// Over the exported site: every place link a trip page draws lands on a page that was built (row 3.54, 3.57: no stop link 404s).
describe.skipIf(!existsSync(path.join(OUT, 'trips')))('trip page links (web/out)', () => {
  const trips = existsSync(path.join(OUT, 'trips')) ? readdirSync(path.join(OUT, 'trips')).filter((d) => existsSync(path.join(OUT, 'trips', d, 'index.html'))) : [];
  it('every /places/ link on every trip page has a built page', () => {
    const dead: string[] = [];
    let links = 0;
    for (const t of trips) {
      const html = readFileSync(path.join(OUT, 'trips', t, 'index.html'), 'utf8');
      for (const m of html.matchAll(/href="(\/places\/[^"#?]+)"/g)) {
        links += 1;
        if (!existsSync(path.join(OUT, m[1]!, 'index.html'))) dead.push(`${t}: ${m[1]}`);
      }
    }
    expect(links).toBeGreaterThan(50);
    expect([...new Set(dead)]).toEqual([]);
  });
  it('the Dolomites page links five or more places, and the Rockies timeline links its stops', () => {
    const rk = readFileSync(path.join(OUT, 'trips', 'canadian-rockies-2029', 'index.html'), 'utf8');
    expect(new Set([...rk.matchAll(/class="tl-title"><a href="(\/places\/[^"]+)"/g)].map((m) => m[1])).size).toBeGreaterThan(10);
    const dolo = readFileSync(path.join(OUT, 'trips', 'dolomites-2027', 'index.html'), 'utf8');
    expect(new Set([...dolo.matchAll(/href="(\/places\/[^"]+)"/g)].map((m) => m[1])).size).toBeGreaterThanOrEqual(5);
  });
});
