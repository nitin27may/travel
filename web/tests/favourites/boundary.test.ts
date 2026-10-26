import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readText, walkFiles } from '../helpers';
import { builtOutDir } from '../helpers/built';
import { startScripts } from '../../scripts/budget-report.mjs';

// FAV-1 boundary (brief 7.12): no favourites module in any start chunk, and nothing of the heart in a place or trip page's HTML. The hearts,
// the badges and the panel load after hydration (P1, P9, the budgets of visitor spec 7).
const OUT = builtOutDir();
// strings only the favourites modules carry (the shell's key literals and the dot are allowed at start: they are the bar's own)
const MARKERS = ['fav-badge', 'fav-heart', 'fav-glyph', 'in your favourites', 'Favourite ', 'favourites/1', 'No longer listed', 'We couldn’t refresh', "We couldn't refresh"];

describe('favourites stay out of the start chunks', () => {
  const pages = walkFiles(OUT).filter((f) => f.endsWith('index.html'));
  const scripts = new Set(pages.flatMap((f) => startScripts(readText(f))));

  it('measures start scripts', () => expect(scripts.size).toBeGreaterThan(5));

  it('no start script holds a favourites marker', () => {
    for (const s of scripts) {
      const text = readText(path.join(OUT, s.split('?')[0]));
      for (const m of MARKERS) expect(text.includes(m), `${s} holds "${m}"`).toBe(false);
    }
  });

  it('the places, trips, home and mine pages carry no heart markup and no favourites strings in their HTML', () => {
    for (const rel of ['places/lago-di-braies/index.html', 'trips/dolomites-2027/index.html', 'places/index.html', 'trips/index.html', 'index.html', 'mine/index.html']) {
      const html = readFileSync(path.join(OUT, rel), 'utf8');
      for (const m of ['fav-badge', 'fav-heart', 'in your favourites', 'aria-pressed']) expect(html.includes(m), `${rel} holds "${m}"`).toBe(false);
    }
  });
});
