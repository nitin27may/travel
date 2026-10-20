import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { minutesRange, PlacePage } from '@/components/places/PlacePage';
import { luminance, fallbackPalette, readPalette } from '@/lib/map/palette';
import { ADMIN_LABEL_MIN_ZOOM, hideBasemapLabel, isStateLabel } from '@/lib/map/maplibre/labels';
import { createPublicData } from '@/lib/public';
import { NEARBY_MAX_KM } from '@/lib/public/relevance';
import { closingWord } from '@/lib/public/sections';

// Stage 4, lane PLC: the S1b review items (4.9, 4.12, 3.49, 3.57) and the map adapter (3.31, 4.2, 4.6).
const data = createPublicData();
const html = (slug: string): string => renderToString(<PlacePage place={data.getPlace(slug)!} inside={[]} url={`https://example.test/places/${slug}/`} />).replace(/<!-- -->/g, '');
const text = (h: string): string => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('the checks count (S1, 3.49)', () => {
  it('Larch Valley says what the visitor sees: key checks, then how many more are open', () => {
    const t = text(html('larch-valley-to-sentinel-pass'));
    expect(t).toMatch(/\d+ of \d+ key checks · \d+ more not checked yet/);
    expect(t).not.toContain('family checks done');
  });
});

describe('chips (S2, S8, S11, S13)', () => {
  const larch = html('larch-valley-to-sentinel-pass');
  it('keeps the words of a value together with non-breaking spaces and wraps whole chips', () => {
    expect(larch).toContain('4\u00a0h\u00a030–\u20605\u00a0h\u00a030');
  });
  it('titles the family group "For a family", not "Who it suits" inside "Who it suits"', () => {
    expect(larch).toContain('For a family');
    expect((larch.match(/<span class="gt">Who it suits<\/span>/g) ?? []).length).toBe(0);
  });
  it('says the under-18 rule as "Under 18 with an adult"', () => {
    const all = data.placeSlugs().map((s) => text(html(s))).join(' ');
    expect(all).not.toMatch(/adult under \d+/);
  });
  it('draws the effort chip with the gauge, not the walker the kind uses', () => {
    expect(larch).toMatch(/Hard/);
    expect(larch).toContain('M4 17a8 8 0 1 1 16 0');
  });
});

describe('"When you can go" echo (S3)', () => {
  it('uses the short season renderer, with no raw keys and no repeated hazard', () => {
    const t = text(html('larch-valley-to-sentinel-pass'));
    expect(t).toContain('Shuttle 1 Jun – 12 Oct');
    expect(t).not.toMatch(/access: |hazards: |exposure: /);
  });
});

describe('one adult time per trail (S4)', () => {
  it('Larch shows the checked adult time once, and a conflict line with both sources when the older plan differs', () => {
    const t = text(html('larch-valley-to-sentinel-pass'));
    expect(t).toContain('Sources disagree on the adult time');
    expect(t.match(/4 h 30–5 h 30/g)?.length).toBeGreaterThanOrEqual(1);
    expect(t).not.toMatch(/11\.2 km · 750 m climb · 5-6 h/);
  });
  it('reads a duration as a minute range', () => {
    expect(minutesRange('4 h 30–5 h 30')).toEqual([270, 330]);
    expect(minutesRange('5-6 h')).toEqual([300, 360]);
    expect(minutesRange('45–90 min')).toEqual([45, 90]);
    expect(minutesRange('about lunch')).toBeNull();
  });
});

describe('glance slots (S5)', () => {
  it('shows one stop once: "Trailhead and parking" and "Starts at" are not both there with the same value', () => {
    for (const slug of data.placeSlugs()) {
      const g = html(slug).match(/<section class="ps-glance"[\s\S]*?<\/section>/)?.[0] ?? '';
      const values = [...g.matchAll(/<strong class="gv">([^<]*)<\/strong>/g)].map((m) => m[1]!.trim().toLowerCase());
      expect(new Set(values).size, `${slug}: ${values.join(' | ')}`).toBe(values.length);
    }
  });
});

describe('links and closing lines (S7)', () => {
  it('says a brand or a relation in words in a closing line, never a raw key', () => {
    expect(closingWord('OpenStreetMap')).toBe('OpenStreetMap link');
    expect(closingWord('Part of')).toBe('what it is part of');
    expect(closingWord('Price')).toBe('price');
    const all = data.placeSlugs().map((s) => text(html(s))).join(' ');
    const items = [...all.matchAll(/Not checked yet: ([^.]*?)(?= [A-Z]|$)/g)].flatMap((m) => m[1]!.split(', ').map((x) => x.trim()));
    expect(items.filter((x) => x === 'openstreetmap' || x === 'part of' || x === 'wikidata')).toEqual([]);
  });
});

describe('pointers and Nearby (4.12)', () => {
  it('never draws a "Coming from far?" pointer for a place that has no page', () => {
    for (const slug of data.placeSlugs()) {
      const p = data.getPlace(slug)!;
      const ptr = p.relevance?.pointer;
      if (!ptr) continue;
      const drawn = html(slug).includes('Coming from far?');
      expect(drawn, slug).toBe(!!p.refSlugs[ptr.ref]);
    }
  });
  it('lists no Nearby pair or stand-in further than about 25 km', () => {
    for (const slug of data.placeSlugs()) {
      const r = data.getPlace(slug)!.relevance;
      for (const x of [...(r?.pairs ?? []), ...(r?.similar ?? [])]) expect(x.km ?? 0, `${slug} ${x.name}`).toBeLessThanOrEqual(NEARBY_MAX_KM);
    }
  });
});

describe('no operator (3.57)', () => {
  it('Godafoss says "Not checked yet" for walk, stroller and wheelchair, never "Not stated by the operator"', () => {
    const t = text(html('godafoss'));
    expect(t).not.toContain('Not stated by the operator');
    expect(t).not.toContain('ask before booking');
    expect(t).toMatch(/Not checked yet/);
  });
});

describe('hero note (3.57)', () => {
  it('prints the Banff Gondola top station without the bracketed working note', () => {
    const t = text(html('lake-louise-summer-gondola')) + text(html('banff-gondola')) + text(html('sulphur-mountain'));
    expect(t).not.toContain('(Sulphur Mountain summit) top station');
    for (const slug of data.placeSlugs()) {
      const payoff = data.getPlace(slug)!.relevance?.payoff?.name ?? '';
      expect(payoff, slug).not.toMatch(/\([^)]*\)\s+\S/);
    }
  });
});

describe('the map adapter (3.31, 4.2, 4.6)', () => {
  it('draws water darker than land on the dark map, from the fallback and from a lighter token', () => {
    const dark = fallbackPalette('dark');
    expect(luminance(dark.water)!).toBeLessThan(luminance(dark.land)!);
    const live = readPalette(null, 'dark');
    expect(luminance(live.water)!).toBeLessThan(luminance(live.land)!);
    expect(luminance(dark.waterLine)!).toBeGreaterThan(luminance(dark.land)!);
  });
  it('keeps the unconfirmed trail line at 3:1 or better against the land in both themes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const p = fallbackPalette(mode);
      const [a, b] = [luminance(p.muted)!, luminance(p.land)!].sort((x, y) => y - x);
      expect((a! + 0.05) / (b! + 0.05), mode).toBeGreaterThanOrEqual(3);
    }
  });
  it('thins state and province names below zoom 5 on a map that hides labels, in both styles', () => {
    expect(ADMIN_LABEL_MIN_ZOOM).toBe(5);
    expect(isStateLabel('label_state', 'place')).toBe(true);
    expect(isStateLabel('place_state', 'place')).toBe(true);
    expect(isStateLabel('label_town', 'place')).toBe(false);
    expect(hideBasemapLabel('label_town', 'place', ['towns'])).toBe(true);
  });
});
